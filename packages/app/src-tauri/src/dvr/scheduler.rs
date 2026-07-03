//! Recording scheduler
//!
//! Polls the database for upcoming recordings and triggers them.
//! Uses tokio-cron-scheduler for efficient job scheduling.

use std::sync::Arc;
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::{error, info, warn};

use crate::dvr::database::DvrDatabase;
use crate::dvr::models::{Schedule, ScheduleStatus};
use crate::dvr::recorder::RecordingManager;

/// Window in seconds to look ahead for recordings
const SCHEDULING_WINDOW_SECONDS: i64 = 60;

/// Grace period for missed recordings (5 minutes)
const MISSED_RECORDING_GRACE_SECONDS: i64 = 300;

/// Poll interval in seconds
const POLL_INTERVAL_SECONDS: u32 = 30;

/// Manages the recording schedule
pub struct Scheduler {
    db: Arc<DvrDatabase>,
    recorder: Arc<RecordingManager>,
    scheduler: Option<JobScheduler>,
    is_running: bool,
}

// SAFETY: Scheduler is only accessed from the Tokio runtime and all fields
// are thread-safe (Arc, Option). JobScheduler is wrapped in Option and only
// accessed from within the async context.
unsafe impl Send for Scheduler {}
unsafe impl Sync for Scheduler {}

impl Scheduler {
    /// Create a new scheduler
    pub fn new(db: Arc<DvrDatabase>, recorder: Arc<RecordingManager>) -> Self {
        Self {
            db,
            recorder,
            scheduler: None,
            is_running: false,
        }
    }

    /// Start the scheduler background task
    pub async fn start(&mut self) -> anyhow::Result<()> {
        if self.is_running {
            warn!("Scheduler already running");
            return Ok(());
        }

        info!("Starting DVR scheduler (polling every {} seconds)", POLL_INTERVAL_SECONDS);

        // Create job scheduler
        let sched = JobScheduler::new().await?;

        // Add polling job
        let db = self.db.clone();
        let recorder = self.recorder.clone();

        let job = Job::new_repeated_async(
            std::time::Duration::from_secs(POLL_INTERVAL_SECONDS as u64),
            move |_uuid, _l| {
                let db = db.clone();
                let recorder = recorder.clone();
                Box::pin(async move {
                    if let Err(e) = poll_schedules(&db, &recorder).await {
                        error!("Error polling schedules: {}", e);
                    }
                })
            },
        )?;

        sched.add(job).await?;

        // Run initial poll immediately
        if let Err(e) = poll_schedules(&self.db, &self.recorder).await {
            error!("Error in initial poll: {}", e);
        }

        // Start scheduler
        sched.start().await?;

        self.scheduler = Some(sched);
        self.is_running = true;

        info!("DVR scheduler started successfully");
        Ok(())
    }

    /// Stop the scheduler
    pub async fn stop(&mut self) {
        if !self.is_running {
            return;
        }

        info!("Stopping DVR scheduler");

        if let Some(mut sched) = self.scheduler.take() {
            if let Err(e) = sched.shutdown().await {
                error!("Error shutting down scheduler: {}", e);
            }
        }

        self.is_running = false;
        info!("DVR scheduler stopped");
    }
}

/// Poll for schedules that should start recording
async fn poll_schedules(
    db: &Arc<DvrDatabase>,
    recorder: &Arc<RecordingManager>,
) -> anyhow::Result<()> {
    let now = chrono::Utc::now().timestamp();
    println!("[DVR Scheduler] Polling at timestamp: {} ({})", now, chrono::DateTime::from_timestamp(now, 0).map(|dt| dt.to_rfc2822()).unwrap_or_default());

    // Quick check if any scheduled recordings exist
    let count = db.count_scheduled()?;
    println!("[DVR Scheduler] Found {} scheduled recordings", count);

    if count == 0 {
        return Ok(());
    }

    // Get recordings that should start
    let window_start = now - SCHEDULING_WINDOW_SECONDS;
    let window_end = now + SCHEDULING_WINDOW_SECONDS;
    println!("[DVR Scheduler] Looking for recordings between {} and {} (window: ±{}s)",
        window_start, window_end, SCHEDULING_WINDOW_SECONDS);

    let schedules = db.get_scheduled_recordings(
        now,
        SCHEDULING_WINDOW_SECONDS,
        MISSED_RECORDING_GRACE_SECONDS,
    )?;

    println!("[DVR Scheduler] Found {} recordings ready to start", schedules.len());
    for schedule in &schedules {
        println!("[DVR Scheduler]   - ID {}: {} (start: {}, end: {}, actual_start: {})",
            schedule.id, schedule.program_title, schedule.scheduled_start,
            schedule.scheduled_end, schedule.actual_start());
    }

    if schedules.is_empty() {
        return Ok(());
    }

    info!(
        "Found {} recording(s) ready to start",
        schedules.len()
    );

    // Start each recording
    for schedule in schedules {
        println!("[DVR Scheduler] About to start recording ID {}: {}", schedule.id, schedule.program_title);
        if let Err(e) = start_recording(db, recorder, schedule).await {
            error!("Failed to start recording: {}", e);
            println!("[DVR Scheduler] ERROR: Failed to start recording: {}", e);
        } else {
            println!("[DVR Scheduler] Recording started successfully");
        }
    }

    Ok(())
}

/// Start a single recording
pub async fn start_recording(
    db: &Arc<DvrDatabase>,
    recorder: &Arc<RecordingManager>,
    schedule: Schedule,
) -> anyhow::Result<()> {
    println!("[DVR Scheduler] start_recording called for ID {}: {}", schedule.id, schedule.program_title);
    info!(
        "Starting recording: {} - {} on {}",
        schedule.program_title, schedule.channel_name, schedule.channel_id
    );

    // Update status to recording
    println!("[DVR Scheduler] Updating schedule status to Recording...");
    db.update_schedule_status(schedule.id, ScheduleStatus::Recording)?;
    println!("[DVR Scheduler] Status updated, spawning recording task...");

    // Spawn recording task
    let db = db.clone();
    let recorder = recorder.clone();

    tokio::spawn(async move {
        println!("[DVR Scheduler] Recording task spawned for ID {}: {}", schedule.id, schedule.program_title);
        let record_res = recorder.record(schedule.clone()).await;

        let final_status = match record_res {
            Ok(()) => {
                println!("[DVR Scheduler] Recording completed successfully for ID {}", schedule.id);
                ScheduleStatus::Completed
            }
            Err(e) => {
                error!("Recording failed for {}: {}", schedule.program_title, e);
                println!("[DVR Scheduler] ERROR: Recording failed for {}: {}", schedule.program_title, e);
                ScheduleStatus::Failed
            }
        };

        // Note: record() internally updates schedule status to Completed on success.
        // If it failed, update schedule status to Failed.
        if final_status == ScheduleStatus::Failed {
            if let Err(e) = db.update_schedule_status(schedule.id, ScheduleStatus::Failed) {
                error!("Failed to update schedule status: {}", e);
            }
        }

        // Check if schedule is not Canceled, and reschedule if recurring
        if let Ok(Some(current_schedule)) = db.get_schedule(schedule.id) {
            if current_schedule.status != ScheduleStatus::Canceled {
                if let Some(ref rec_str) = current_schedule.recurrence {
                    if rec_str != "once" && !rec_str.is_empty() {
                        if let Err(e) = handle_reschedule(&db, &current_schedule, rec_str) {
                            error!("Failed to reschedule recurring recording: {}", e);
                        }
                    }
                }
            }
        }
    });

    Ok(())
}

/// Helper to handle rescheduling of recurring recordings
pub fn handle_reschedule(
    db: &Arc<DvrDatabase>,
    schedule: &Schedule,
    recurrence: &str,
) -> anyhow::Result<()> {
    // Parse recurrence and compute next start/end times
    let interval_days = match recurrence {
        "daily" => 1,
        "weekly" => 7,
        _ if recurrence.starts_with("every:") => {
            let parts: Vec<&str> = recurrence.split(':').collect();
            if parts.len() == 2 {
                parts[1].parse::<i64>().unwrap_or(0)
            } else {
                0
            }
        }
        _ => 0,
    };

    if interval_days <= 0 {
        return Ok(());
    }

    let interval_seconds = interval_days * 24 * 3600;
    let now = chrono::Utc::now().timestamp();

    let mut next_start = schedule.scheduled_start + interval_seconds;
    let mut next_end = schedule.scheduled_end + interval_seconds;

    // Ensure scheduled_start is in the future
    while next_start <= now {
        next_start += interval_seconds;
        next_end += interval_seconds;
    }

    // Prepare new schedule request
    let request = crate::dvr::models::ScheduleRequest {
        source_id: schedule.source_id.clone(),
        channel_id: schedule.channel_id.clone(),
        channel_name: schedule.channel_name.clone(),
        program_title: schedule.program_title.clone(),
        scheduled_start: next_start,
        scheduled_end: next_end,
        start_padding_sec: schedule.start_padding_sec,
        end_padding_sec: schedule.end_padding_sec,
        series_match_title: schedule.series_match_title.clone(),
        recurrence: Some(recurrence.to_string()),
        stream_url: None, // Resolve stream URL at recording time
    };

    info!(
        "Rescheduling recurring recording '{}' to start at {} (recurrence: {})",
        request.program_title,
        chrono::DateTime::from_timestamp(next_start, 0)
            .map(|dt| dt.to_rfc2822())
            .unwrap_or_default(),
        recurrence
    );

    db.add_schedule(&request)?;

    Ok(())
}

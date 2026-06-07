use std::sync::Arc;
use std::sync::mpsc::{channel, Sender, Receiver, TryRecvError};
use std::time::{Duration, Instant};
use mdns_sd::{ServiceDaemon, ServiceEvent};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use rust_cast::{
    CastDevice,
    channels::{
        media::{Media, StreamType, Metadata, GenericMediaMetadata},
        receiver::CastDeviceApp,
    },
};

// ── Types ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredDevice {
    pub id: String,
    pub name: String,
    pub ip: String,
    pub port: u16,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CastStatus {
    connected: bool,
    device_name: String,
    player_state: String,
    current_time: f64,
    duration: f64,
    volume: f32,
    muted: bool,
}

// ── Actor command enum ────────────────────────────────────────────────────────

/// Commands that can be sent to the cast actor thread.
/// Each variant carries a `Sender<Result<(), String>>` for the response.
enum CastCmd {
    LoadMedia {
        url: String,
        title: String,
        subtitle: String,
        mime_type: String,
        reply: Sender<Result<(), String>>,
    },
    Play {
        reply: Sender<Result<(), String>>,
    },
    Pause {
        reply: Sender<Result<(), String>>,
    },
    Stop {
        reply: Sender<Result<(), String>>,
    },
    Seek {
        seconds: f32,
        reply: Sender<Result<(), String>>,
    },
    SetVolume {
        level: f32,
        reply: Sender<Result<(), String>>,
    },
    ToggleMute {
        reply: Sender<Result<(), String>>,
    },
    /// Ask the actor to terminate gracefully.
    Disconnect,
}

// ── Shared session metadata (no device reference) ─────────────────────────────

/// Metadata that commands need in order to build requests — stored separately
/// from the device so the Tauri commands never need to touch the socket.
#[derive(Clone)]
pub struct CastSessionMeta {
    pub device_name: String,
    pub device_ip: String,
    pub device_port: u16,
    pub transport_id: Option<String>,
    pub session_id: Option<String>,
    pub media_session_id: Option<i32>,
}

// ── CastManager ───────────────────────────────────────────────────────────────

pub struct CastManager {
    /// Channel to send commands to the actor thread.
    /// `None` when not connected.
    pub cmd_tx: Mutex<Option<Sender<CastCmd>>>,
    /// Metadata about the active session (populated by the actor thread).
    pub session_meta: Mutex<Option<CastSessionMeta>>,
    /// mDNS discovered devices.
    pub devices: Mutex<Vec<DiscoveredDevice>>,
    pub discovery_active: Mutex<bool>,
    pub mdns_daemon: Mutex<Option<ServiceDaemon>>,
}

impl CastManager {
    pub fn new() -> Self {
        Self {
            cmd_tx: Mutex::new(None),
            session_meta: Mutex::new(None),
            devices: Mutex::new(Vec::new()),
            discovery_active: Mutex::new(false),
            mdns_daemon: Mutex::new(None),
        }
    }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

fn emit_disconnected(app: &AppHandle, device_name: &str) {
    if !device_name.is_empty() {
        log::warn!("[Cast] Connection to device {} lost (ping error or disconnected)", device_name);
    }
    let _ = app.emit("cast-status", CastStatus {
        connected: false,
        device_name: String::new(),
        player_state: "IDLE".to_string(),
        current_time: 0.0,
        duration: 0.0,
        volume: 1.0,
        muted: false,
    });
}

/// Reconnect the CastDevice TCP socket, set a short read timeout, and re-establish the receiver channel.
fn reconnect_device(ip: &str, port: u16) -> Result<CastDevice<'static>, String> {
    let device = CastDevice::connect_without_host_verification_timeout(
        ip.to_string(), port,
        Some(Duration::from_millis(200)), // short timeout so receive_nonblocking works
    ).map_err(|e| format!("Reconnect to {}:{} failed: {:?}", ip, port, e))?;
    device.connection.connect("receiver-0".to_string())
        .map_err(|e| format!("Reconnect receiver channel failed: {:?}", e))?;
    device.heartbeat.ping()
        .map_err(|e| format!("Reconnect heartbeat failed: {:?}", e))?;
    Ok(device)
}

// ── Actor thread ──────────────────────────────────────────────────────────────

/// Runs on a dedicated OS thread.  Owns `device` exclusively — no other code
/// may touch the socket while this thread is alive.
fn run_cast_actor(
    mut device: CastDevice<'static>,
    ip: String,
    port: u16,
    name: String,
    cmd_rx: Receiver<CastCmd>,
    state: Arc<CastManager>,
    app: AppHandle,
) {
    // Local copies of session IDs — updated after every LoadMedia.
    let mut transport_id: Option<String> = None;
    let mut session_id: Option<String> = None;
    let mut media_session_id: Option<i32> = None;

    // Set a short read timeout so receive_nonblocking() works without blocking.
    if let Err(e) = device.set_read_timeout(Some(Duration::from_millis(200))) {
        log::warn!("[Cast] Could not set read timeout: {}", e);
    }

    let mut error_count = 0u32;
    let poll_interval = Duration::from_millis(3000);
    let mut last_poll = Instant::now() - poll_interval; // poll immediately on first tick

    loop {
        // ── 0. Drain incoming messages from Chromecast (non-blocking) ────────
        //    The Chromecast sends its own PING messages (from Tr@n$p0rt-0) that
        //    we MUST respond to with PONG or it will drop the connection ~15s later.
        //    We also watch for CLOSE on the transport so we can clear stale IDs.
        loop {
            match device.receive_nonblocking() {
                Ok(Some(msg)) => {
                    use rust_cast::ChannelMessage;
                    match msg {
                        ChannelMessage::Heartbeat(hb) => {
                            use rust_cast::channels::heartbeat::HeartbeatResponse;
                            if let HeartbeatResponse::Ping = hb {
                                // Chromecast pinged us — respond immediately.
                                let _ = device.heartbeat.pong();
                                log::debug!("[Cast] Responded to Chromecast PING with PONG");
                            }
                        }
                        ChannelMessage::Connection(conn) => {
                            use rust_cast::channels::connection::ConnectionResponse;
                            if let ConnectionResponse::Close = conn {
                                // Transport closed — the media session is gone.
                                log::info!("[Cast] Transport CLOSE received, clearing session IDs");
                                transport_id = None;
                                session_id = None;
                                media_session_id = None;
                                if let Some(ref mut meta) = *state.session_meta.lock() {
                                    meta.transport_id = None;
                                    meta.session_id = None;
                                    meta.media_session_id = None;
                                }
                            }
                        }
                        _ => {} // Media/Receiver messages handled during poll
                    }
                }
                Ok(None) => break, // No more messages right now
                Err(_) => break,   // Errors handled during explicit poll/ping
            }
        }

        // ── 1. Drain all pending commands (non-blocking) ─────────────────────
        loop {
            match cmd_rx.try_recv() {
                Ok(cmd) => {
                    match handle_command(
                        cmd,
                        &mut device,
                        &ip, port,
                        &mut transport_id,
                        &mut session_id,
                        &mut media_session_id,
                        &state,
                    ) {
                        // Actor was asked to stop.
                        Ok(true) => {
                            *state.cmd_tx.lock() = None;
                            *state.session_meta.lock() = None;
                            emit_disconnected(&app, "");
                            return;
                        }
                        Ok(false) => {}
                        Err(e) => {
                            // A command caused a fatal socket error — disconnect.
                            log::error!("[Cast] Fatal command error, disconnecting: {}", e);
                            *state.cmd_tx.lock() = None;
                            *state.session_meta.lock() = None;
                            emit_disconnected(&app, &name);
                            return;
                        }
                    }
                }
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => {
                    // All senders were dropped — shut down.
                    *state.cmd_tx.lock() = None;
                    *state.session_meta.lock() = None;
                    return;
                }
            }
        }

        // ── 2. Periodic status poll ─────────────────────────────────────────
        if last_poll.elapsed() >= poll_interval {
            last_poll = Instant::now();

            // Ping — fast round-trip to keep connection alive
            if let Err(_) = device.heartbeat.ping() {
                error_count += 1;
                if error_count > 3 {
                    log::warn!("[Cast] Ping failed {} times, trying reconnect...", error_count);
                    match reconnect_device(&ip, port) {
                        Ok(new_device) => {
                            device = new_device;
                            error_count = 0;
                            // Clear stale session IDs — they belonged to the old TCP connection.
                            // The Chromecast will reject GET_STATUS for a transport it doesn't know about.
                            transport_id = None;
                            session_id = None;
                            media_session_id = None;
                            if let Some(ref mut meta) = *state.session_meta.lock() {
                                meta.transport_id = None;
                                meta.session_id = None;
                                meta.media_session_id = None;
                            }
                            log::info!("[Cast] Reconnected successfully after ping failure");
                        }
                        Err(e) => {
                            log::error!("[Cast] Reconnect failed: {}", e);
                            *state.cmd_tx.lock() = None;
                            *state.session_meta.lock() = None;
                            emit_disconnected(&app, &name);
                            return;
                        }
                    }
                }
                std::thread::sleep(Duration::from_millis(300));
                continue;
            }
            error_count = 0;


            // ── Drain commands AGAIN after ping so load_media isn't blocked
            //    by the upcoming get_status call.
            let mut should_exit = false;
            let mut fatal = false;
            loop {
                match cmd_rx.try_recv() {
                    Ok(cmd) => {
                        match handle_command(
                            cmd,
                            &mut device,
                            &ip, port,
                            &mut transport_id,
                            &mut session_id,
                            &mut media_session_id,
                            &state,
                        ) {
                            Ok(true) => { should_exit = true; break; }
                            Ok(false) => {}
                            Err(_) => { fatal = true; break; }
                        }
                    }
                    Err(TryRecvError::Empty) => break,
                    Err(TryRecvError::Disconnected) => { should_exit = true; break; }
                }
            }
            if should_exit || fatal {
                *state.cmd_tx.lock() = None;
                *state.session_meta.lock() = None;
                if fatal { emit_disconnected(&app, &name); }
                return;
            }

            // Media status — only when we have a live media session.
            // We skip receiver.get_status() to avoid the extra blocking round-trip;
            // volume/muted are updated reactively when cast_set_volume/cast_toggle_mute are used.
            let mut player_state = "IDLE".to_string();
            let mut current_time = 0.0f64;
            let mut duration = 0.0f64;
            let volume = 1.0f32;
            let muted = false;

            if let (Some(ref tid), Some(msid)) = (&transport_id, media_session_id) {
                // Lift the short timeout: get_status uses receive_find_map which blocks.
                let _ = device.set_read_timeout(None);
                let status_result = device.media.get_status(tid.as_str(), Some(msid));
                let _ = device.set_read_timeout(Some(Duration::from_millis(200)));

                match status_result {
                    Ok(media_status) => {
                        if let Some(entry) = media_status.entries.first() {
                            player_state = entry.player_state.to_string();
                            current_time = entry.current_time.unwrap_or(0.0) as f64;
                            if let Some(ref m) = entry.media {
                                duration = m.duration.unwrap_or(0.0) as f64;
                            }
                            // Update stored media_session_id if the receiver replaced it
                            media_session_id = Some(entry.media_session_id);

                            // Sync metadata back into shared slot
                            if let Some(ref mut meta) = *state.session_meta.lock() {
                                meta.media_session_id = media_session_id;
                                meta.transport_id = transport_id.clone();
                                meta.session_id = session_id.clone();
                            }
                        } else {
                            // Empty status means this media session is dead (e.g. from a prior
                            // connection). Clear it so we don't keep querying a stale session ID.
                            log::debug!("[Cast] Empty media status for session {}, clearing stale ID", msid);
                            media_session_id = None;
                            transport_id = None;
                            session_id = None;
                            if let Some(ref mut meta) = *state.session_meta.lock() {
                                meta.media_session_id = None;
                                meta.transport_id = None;
                                meta.session_id = None;
                            }
                        }
                    }
                    Err(_) => {
                        // media.get_status can fail transiently (e.g. right after a channel switch).
                        // Don't treat as fatal — the next LoadMedia will supply fresh IDs.
                    }
                }
            }

            let _ = app.emit("cast-status", CastStatus {
                connected: true,
                device_name: name.clone(),
                player_state,
                current_time,
                duration,
                volume,
                muted,
            });
        }

        // Sleep a short slice so we're responsive to commands without busy-spinning.
        std::thread::sleep(Duration::from_millis(50));
    }
}


/// Returns `Ok(true)` if the actor should exit, `Ok(false)` to continue,
/// `Err(msg)` on a fatal socket failure.
fn handle_command(
    cmd: CastCmd,
    device: &mut CastDevice<'static>,
    ip: &str,
    port: u16,
    transport_id: &mut Option<String>,
    session_id: &mut Option<String>,
    media_session_id: &mut Option<i32>,
    state: &Arc<CastManager>,
) -> Result<bool, String> {
    match cmd {
        CastCmd::Disconnect => {
            // Gracefully stop media then close the receiver app.
            if let (Some(ref tid), Some(msid)) = (transport_id.as_ref(), *media_session_id) {
                let _ = device.media.stop(tid.as_str(), msid);
            }
            if let Some(ref sid) = *session_id {
                let _ = device.receiver.stop_app(sid.as_str());
            }
            let _ = device.connection.disconnect("receiver-0".to_string());
            return Ok(true);
        }

        CastCmd::LoadMedia { url, title, subtitle, mime_type, reply } => {
            let result = do_load_media(
                device, ip, port,
                url, title, subtitle, mime_type,
                transport_id, session_id, media_session_id,
            );
            // Update shared metadata regardless of success/failure.
            if let Some(ref mut meta) = *state.session_meta.lock() {
                meta.transport_id = transport_id.clone();
                meta.session_id = session_id.clone();
                meta.media_session_id = *media_session_id;
            }
            let _ = reply.send(result);
        }

        CastCmd::Play { reply } => {
            let _ = device.set_read_timeout(None);
            let result = if let (Some(ref tid), Some(msid)) = (transport_id.as_ref(), *media_session_id) {
                device.media.play(tid.as_str(), msid)
                    .map(|_| ())
                    .map_err(|e| format!("Failed to play: {:?}", e))
            } else {
                Err("No media session".to_string())
            };
            let _ = device.set_read_timeout(Some(Duration::from_millis(200)));
            let _ = reply.send(result);
        }

        CastCmd::Pause { reply } => {
            let _ = device.set_read_timeout(None);
            let result = if let (Some(ref tid), Some(msid)) = (transport_id.as_ref(), *media_session_id) {
                device.media.pause(tid.as_str(), msid)
                    .map(|_| ())
                    .map_err(|e| format!("Failed to pause: {:?}", e))
            } else {
                Err("No media session".to_string())
            };
            let _ = device.set_read_timeout(Some(Duration::from_millis(200)));
            let _ = reply.send(result);
        }

        CastCmd::Stop { reply } => {
            let _ = device.set_read_timeout(None);
            let result = if let (Some(ref tid), Some(msid)) = (transport_id.as_ref(), *media_session_id) {
                let r = device.media.stop(tid.as_str(), msid)
                    .map(|_| ())
                    .map_err(|e| format!("Failed to stop: {:?}", e));
                // Clear IDs so the poller doesn't query a stale session.
                *transport_id = None;
                *session_id = None;
                *media_session_id = None;
                if let Some(ref mut meta) = *state.session_meta.lock() {
                    meta.transport_id = None;
                    meta.session_id = None;
                    meta.media_session_id = None;
                }
                r
            } else {
                Err("No media session".to_string())
            };
            let _ = device.set_read_timeout(Some(Duration::from_millis(200)));
            let _ = reply.send(result);
        }

        CastCmd::Seek { seconds, reply } => {
            let _ = device.set_read_timeout(None);
            let result = if let (Some(ref tid), Some(msid)) = (transport_id.as_ref(), *media_session_id) {
                device.media.seek(tid.as_str(), msid, Some(seconds), None)
                    .map(|_| ())
                    .map_err(|e| format!("Failed to seek: {:?}", e))
            } else {
                Err("No media session".to_string())
            };
            let _ = device.set_read_timeout(Some(Duration::from_millis(200)));
            let _ = reply.send(result);
        }

        CastCmd::SetVolume { level, reply } => {
            let _ = device.set_read_timeout(None);
            let result = device.receiver.set_volume(level)
                .map(|_| ())
                .map_err(|e| format!("Failed to set volume: {:?}", e));
            let _ = device.set_read_timeout(Some(Duration::from_millis(200)));
            let _ = reply.send(result);
        }

        CastCmd::ToggleMute { reply } => {
            let _ = device.set_read_timeout(None);
            let muted = device.receiver.get_status()
                .map(|s| s.volume.muted.unwrap_or(false))
                .unwrap_or(false);
            let result = device.receiver.set_volume(!muted)
                .map(|_| ())
                .map_err(|e| format!("Failed to toggle mute: {:?}", e));
            let _ = device.set_read_timeout(Some(Duration::from_millis(200)));
            let _ = reply.send(result);
        }
    }
    Ok(false)
}


/// All the blocking socket work for loading a media item — runs on the actor thread.
fn do_load_media(
    device: &mut CastDevice<'static>,
    ip: &str,
    port: u16,
    url: String,
    title: String,
    subtitle: String,
    mime_type: String,
    transport_id: &mut Option<String>,
    session_id: &mut Option<String>,
    media_session_id: &mut Option<i32>,
) -> Result<(), String> {
    log::info!("[Cast] Load media: url=\"{}\", title=\"{}\", mime_type=\"{}\"", url, title, mime_type);

    // Clear stale IDs immediately so the poller skips media queries during this load.
    *transport_id = None;
    *media_session_id = None;

    // Lift the 200ms read timeout for blocking protocol calls (launch_app, media.load).
    // These use receive_find_map() internally and legitimately take 1-3 seconds.
    let _ = device.set_read_timeout(None);

    // Launch the DefaultMediaReceiver app, reconnecting on connection errors.
    let app = match device.receiver.launch_app(&CastDeviceApp::DefaultMediaReceiver) {
        Ok(a) => a,
        Err(e) => {
            let s = format!("{:?}", e);
            let is_conn = s.contains("10053") || s.contains("10060")
                || s.contains("ConnectionAborted") || s.contains("ConnectionReset")
                || s.contains("BrokenPipe") || s.contains("TimedOut")
                || s.to_lowercase().contains("connection");
            if !is_conn {
                let _ = device.set_read_timeout(Some(Duration::from_millis(200)));
                return Err(format!("Failed to launch media receiver: {:?}", e));
            }
            log::warn!("[Cast] Connection error on launch_app ({}), reconnecting...", s);
            *device = reconnect_device(ip, port)?;
            // Restore blocking mode for the reconnected device before launch retry.
            let _ = device.set_read_timeout(None);
            device.receiver.launch_app(&CastDeviceApp::DefaultMediaReceiver)
                .map_err(|e2| format!("Failed to launch media receiver after reconnect: {:?}", e2))?
        }
    };

    device.connection.connect(app.transport_id.as_str())
        .map_err(|e| format!("Failed to connect to media receiver: {:?}", e))?;

    let stream_type = if subtitle.to_lowercase().contains("live") {
        StreamType::Live
    } else {
        StreamType::Buffered
    };

    let media = Media {
        content_id: url,
        stream_type,
        content_type: mime_type,
        duration: None,
        metadata: Some(Metadata::Generic(GenericMediaMetadata {
            title: Some(title),
            subtitle: Some(subtitle),
            images: vec![],
            release_date: None,
        })),
    };

    let status = device.media.load(app.transport_id.as_str(), app.session_id.as_str(), &media)
        .map_err(|e| format!("Failed to load media: {:?}", e))?;

    // Restore the short timeout so the drain loop stays non-blocking.
    let _ = device.set_read_timeout(Some(Duration::from_millis(200)));

    *transport_id = Some(app.transport_id.clone());
    *session_id = Some(app.session_id.clone());
    if let Some(entry) = status.entries.first() {
        *media_session_id = Some(entry.media_session_id);
        log::info!("[Cast] Media loaded. Media Session ID: {}", entry.media_session_id);
    } else {
        *media_session_id = None;
        log::warn!("[Cast] Media loaded, but response returned no media entries");
    }

    Ok(())
}


// ── Helper: send a command to the actor and await the reply ───────────────────

fn send_cmd<T, F>(state: &CastManager, build: F) -> Result<T, String>
where
    F: FnOnce(Sender<T>) -> CastCmd,
    T: Send + 'static,
{
    let tx_guard = state.cmd_tx.lock();
    let tx = tx_guard.as_ref().ok_or_else(|| "No active cast session".to_string())?;
    let (reply_tx, reply_rx) = channel::<T>();
    tx.send(build(reply_tx)).map_err(|_| "Cast actor has shut down".to_string())?;
    drop(tx_guard); // release the lock before blocking on the reply
    reply_rx.recv_timeout(Duration::from_secs(30))
        .map_err(|_| "Cast command timed out".to_string())
}

// ── Discovery commands ────────────────────────────────────────────────────────

#[tauri::command]
pub fn cast_start_discovery(
    state: State<'_, Arc<CastManager>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    log::info!("[Cast] Starting discovery...");
    let mut discovery_active = state.discovery_active.lock();
    if *discovery_active {
        return Ok(());
    }

    let mdns = ServiceDaemon::new().map_err(|e| {
        log::error!("[Cast] Failed to create ServiceDaemon: {:?}", e);
        format!("Failed to create mDNS daemon: {:?}", e)
    })?;

    let receiver = mdns.browse("_googlecast._tcp.local.").map_err(|e| {
        format!("Failed to browse: {:?}", e)
    })?;

    let state_clone = state.inner().clone();
    let app_clone = app_handle.clone();

    std::thread::spawn(move || {
        let mut devices: Vec<DiscoveredDevice> = Vec::new();
        while let Ok(event) = receiver.recv() {
            match event {
                ServiceEvent::ServiceResolved(info) => {
                    let full_name = info.get_fullname().to_string();
                    let friendly_name = info.get_properties()
                        .get("fn")
                        .map(|p| p.val_str().to_string())
                        .unwrap_or_else(|| full_name.clone());

                    let addr_str = info.get_addresses().iter()
                        .find(|addr| addr.is_ipv4())
                        .or_else(|| info.get_addresses().iter().next())
                        .map(|a| a.to_string())
                        .unwrap_or_default();

                    if !addr_str.is_empty() {
                        log::info!("[Cast] Discovered Chromecast device: {} ({}:{})",
                            friendly_name, addr_str, info.get_port());

                        let device = DiscoveredDevice {
                            id: full_name,
                            name: friendly_name,
                            ip: addr_str,
                            port: info.get_port(),
                        };

                        // Replace existing entry with same name or add new one.
                        if let Some(existing) = devices.iter_mut().find(|d| d.name == device.name) {
                            *existing = device.clone();
                        } else {
                            devices.push(device.clone());
                        }

                        *state_clone.devices.lock() = devices.clone();
                        let _ = app_clone.emit("cast-devices", &devices);
                    }
                }
                ServiceEvent::SearchStopped(_) => break,
                _ => {}
            }
        }
    });

    *state.mdns_daemon.lock() = Some(mdns);
    *discovery_active = true;
    Ok(())
}

#[tauri::command]
pub fn cast_stop_discovery(state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    log::info!("[Cast] Stopping discovery...");
    let mut discovery_active = state.discovery_active.lock();
    *discovery_active = false;
    if let Some(mdns) = state.mdns_daemon.lock().take() {
        let _ = mdns.stop_browse("_googlecast._tcp.local.");
    }
    *state.devices.lock() = Vec::new();
    Ok(())
}

#[tauri::command]
pub fn cast_get_devices(state: State<'_, Arc<CastManager>>) -> Vec<DiscoveredDevice> {
    state.devices.lock().clone()
}

// ── Connection commands ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn cast_connect(
    ip: String,
    port: u16,
    name: String,
    state: State<'_, Arc<CastManager>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    log::info!("[Cast] Connecting to Chromecast: {} at {}:{}", name, ip, port);

    // Shut down any existing actor first.
    {
        let mut tx_guard = state.cmd_tx.lock();
        if let Some(tx) = tx_guard.take() {
            let _ = tx.send(CastCmd::Disconnect);
            // Give it a moment to shut down cleanly.
            std::thread::sleep(Duration::from_millis(200));
        }
        *state.session_meta.lock() = None;
    }

    // Open a fresh TCP connection with a 200ms read timeout so the actor's
    // receive_nonblocking() loop can drain incoming Chromecast PINGs without blocking.
    let device = CastDevice::connect_without_host_verification_timeout(
        ip.clone(), port,
        Some(Duration::from_millis(200)),
    ).map_err(|e| format!("Failed to connect to {}: {:?}", name, e))?;

    device.connection.connect("receiver-0".to_string())
        .map_err(|e| format!("Failed receiver connection: {:?}", e))?;

    device.heartbeat.ping()
        .map_err(|e| format!("Failed heartbeat: {:?}", e))?;

    // Store session metadata.
    *state.session_meta.lock() = Some(CastSessionMeta {
        device_name: name.clone(),
        device_ip: ip.clone(),
        device_port: port,
        transport_id: None,
        session_id: None,
        media_session_id: None,
    });

    // Create the command channel and start the actor thread.
    let (cmd_tx, cmd_rx) = channel::<CastCmd>();
    *state.cmd_tx.lock() = Some(cmd_tx);

    let state_clone = state.inner().clone();
    let app_clone = app_handle.clone();
    let ip_clone = ip.clone();
    let name_clone = name.clone();

    std::thread::spawn(move || {
        run_cast_actor(device, ip_clone, port, name_clone, cmd_rx, state_clone, app_clone);
    });

    log::info!("[Cast] Connected successfully to device: {}", name);

    // Emit initial connected status.
    let _ = app_handle.emit("cast-status", CastStatus {
        connected: true,
        device_name: name,
        player_state: "IDLE".to_string(),
        current_time: 0.0,
        duration: 0.0,
        volume: 1.0,
        muted: false,
    });

    Ok(())
}

#[tauri::command]
pub async fn cast_disconnect(
    state: State<'_, Arc<CastManager>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    log::info!("[Cast] Disconnect requested by client");
    let mut tx_guard = state.cmd_tx.lock();
    if let Some(tx) = tx_guard.take() {
        let _ = tx.send(CastCmd::Disconnect);
    }
    *state.session_meta.lock() = None;
    let _ = app_handle.emit("cast-status", CastStatus {
        connected: false,
        device_name: String::new(),
        player_state: "IDLE".to_string(),
        current_time: 0.0,
        duration: 0.0,
        volume: 1.0,
        muted: false,
    });
    Ok(())
}

// ── Media commands — all dispatched to the actor thread ───────────────────────

#[tauri::command]
pub async fn cast_load_media(
    url: String,
    title: String,
    subtitle: String,
    mime_type: String,
    state: State<'_, Arc<CastManager>>,
) -> Result<(), String> {
    log::info!("[Cast] Load media requested: url=\"{}\", title=\"{}\"", url, title);
    send_cmd(&state, |reply| CastCmd::LoadMedia { url, title, subtitle, mime_type, reply })?
}

#[tauri::command]
pub async fn cast_play(state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    log::info!("[Cast] Play command received");
    send_cmd(&state, |reply| CastCmd::Play { reply })?
}

#[tauri::command]
pub async fn cast_pause(state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    log::info!("[Cast] Pause command received");
    send_cmd(&state, |reply| CastCmd::Pause { reply })?
}

#[tauri::command]
pub async fn cast_stop(state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    log::info!("[Cast] Stop command received");
    send_cmd(&state, |reply| CastCmd::Stop { reply })?
}

#[tauri::command]
pub async fn cast_seek(seconds: f32, state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    log::info!("[Cast] Seek command received (seconds={})", seconds);
    send_cmd(&state, |reply| CastCmd::Seek { seconds, reply })?
}

#[tauri::command]
pub async fn cast_set_volume(level: f32, state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    log::info!("[Cast] Set volume command received (level={})", level);
    send_cmd(&state, |reply| CastCmd::SetVolume { level, reply })?
}

#[tauri::command]
pub async fn cast_toggle_mute(state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    log::info!("[Cast] Toggle mute command received");
    send_cmd(&state, |reply| CastCmd::ToggleMute { reply })?
}

// ── URL resolution (no socket involvement) ────────────────────────────────────

/// Resolves a stream URL by following HTTP redirects server-side.
#[tauri::command]
pub async fn cast_resolve_url(url: String, user_agent: Option<String>) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::limited(10))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let mut request = client.get(&url);
    let ua = user_agent.filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Mozilla/5.0 (compatible; Chromecast)".to_string());
    request = request.header("User-Agent", ua);

    let response = request
        .send()
        .await
        .map_err(|e| format!("Failed to resolve URL: {}", e))?;

    let final_url = response.url().to_string();
    log::info!("[Cast] Resolved URL: {} -> {}", url, final_url);
    Ok(final_url)
}

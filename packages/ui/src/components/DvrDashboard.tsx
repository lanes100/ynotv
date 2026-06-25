import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
    getScheduledRecordings,
    getCompletedRecordings,
    getActiveRecordings,
    cancelRecording,
    deleteRecording,
    updateSchedulePaddings,
    type DvrSchedule,
    type DvrRecording,
    type RecordingProgress,
} from '../db';
import { dbEvents } from '../db/sqlite-adapter';
import { useModal } from './Modal';
import { DvrTab } from './settings/DvrTab';
import { useDownloadStore } from '../stores/downloadStore';
import './DvrDashboard.css';

interface DvrDashboardProps {
    onPlay?: (recording: DvrRecording) => void;
    onClose: () => void;
}

type DvrDashboardTab = 'scheduled' | 'recorded' | 'downloads' | 'settings';

export function DvrDashboard({ onPlay, onClose }: DvrDashboardProps) {
    const [activeTab, setActiveTab] = useState<DvrDashboardTab>('scheduled');
    const [scheduled, setScheduled] = useState<DvrSchedule[]>([]);
    const [recorded, setRecorded] = useState<DvrRecording[]>([]);
    const [activeRecordings, setActiveRecordings] = useState<RecordingProgress[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit schedule state
    const [editingSchedule, setEditingSchedule] = useState<DvrSchedule | null>(null);
    const [editStartPadding, setEditStartPadding] = useState(60);
    const [editEndPadding, setEditEndPadding] = useState(300);
    const [savingEdit, setSavingEdit] = useState(false);

    // Modal hook
    const { showConfirm, showError, showSuccess, ModalComponent } = useModal();

    async function loadData(showLoading = true) {
        if (showLoading) setLoading(true);
        try {
            const [schedData, recData] = await Promise.all([
                getScheduledRecordings(),
                getCompletedRecordings(),
            ]);
            setScheduled(schedData);
            setRecorded(recData);
        } catch (error) {
            console.error('Failed to load DVR data:', error);
        } finally {
            if (showLoading) setLoading(false);
        }
    }

    useEffect(() => {
        loadData();

        // Subscribe to database changes for live updates
        const unsubscribeSchedules = dbEvents.subscribe((event) => {
            if (event.tableName === 'dvr_schedules') {
                loadData();
            }
        });

        const unsubscribeRecordings = dbEvents.subscribe((event) => {
            if (event.tableName === 'dvr_recordings') {
                loadData();
            }
        });

        return () => {
            unsubscribeSchedules();
            unsubscribeRecordings();
        };
    }, []);

    // Poll for active recording progress every 1 second
    const prevActiveCountRef = useRef(0);
    useEffect(() => {
        const pollActiveRecordings = async () => {
            const active = await getActiveRecordings();
            setActiveRecordings(active);

            if (active.length !== prevActiveCountRef.current) {
                prevActiveCountRef.current = active.length;
                const schedData = await getScheduledRecordings();
                setScheduled(schedData);
            }
        };

        pollActiveRecordings();
        const interval = setInterval(pollActiveRecordings, 1000);
        return () => clearInterval(interval);
    }, []);

    // Listen for DVR events from backend
    useEffect(() => {
        let unlistenFn: (() => void) | undefined;

        const setupListener = async () => {
            try {
                const unlisten = await listen('dvr:event', (event) => {
                    const data = event.payload as {
                        event_type: string;
                        schedule_id: number;
                        recording_id?: number;
                        channel_name: string;
                        program_title: string;
                        message?: string;
                    };
                    console.log('[DVR Dashboard] Event received:', data.event_type, data);

                    if (data.event_type === 'started' || data.event_type === 'completed' || data.event_type === 'failed') {
                        loadData(false);
                        getActiveRecordings().then(setActiveRecordings);
                    }
                });
                unlistenFn = unlisten;
            } catch (error) {
                console.error('[DVR Dashboard] Failed to setup event listener:', error);
            }
        };

        setupListener();

        return () => {
            if (unlistenFn) {
                unlistenFn();
            }
        };
    }, []);

    async function handleCancel(id: number) {
        showConfirm(
            'Cancel Recording',
            'Are you sure you want to cancel this recording?',
            async () => {
                try {
                    await cancelRecording(id);
                    await loadData();
                } catch (error) {
                    console.error('Failed to cancel recording:', error);
                    showError('Error', 'Failed to cancel recording');
                }
            },
            undefined,
            'Cancel Recording',
            'Keep'
        );
    }

    function handleEditStart(item: DvrSchedule) {
        setEditingSchedule(item);
        setEditStartPadding(item.start_padding_sec || 60);
        setEditEndPadding(item.end_padding_sec || 300);
    }

    function handleEditCancel() {
        setEditingSchedule(null);
        setEditStartPadding(60);
        setEditEndPadding(300);
    }

    async function handleSaveEdit() {
        if (!editingSchedule?.id) return;

        setSavingEdit(true);
        try {
            await updateSchedulePaddings(
                editingSchedule.id,
                editStartPadding,
                editEndPadding
            );
            await loadData(false);
            setEditingSchedule(null);
        } catch (error) {
            console.error('Failed to update schedule:', error);
            showError('Error', 'Failed to update schedule padding');
        } finally {
            setSavingEdit(false);
        }
    }

    async function handleDelete(id: number, filePath?: string) {
        const title = filePath ? 'Delete Recording File' : 'Remove Recording';
        const message = filePath
            ? 'Are you sure you want to delete this recording file from disk? This action cannot be undone.'
            : 'Are you sure you want to remove this recording from the list?';

        showConfirm(
            title,
            message,
            async () => {
                try {
                    await deleteRecording(id);
                    await loadData();
                } catch (error) {
                    console.error('Failed to delete recording:', error);
                    showError('Error', 'Failed to delete recording');
                }
            },
            undefined,
            filePath ? 'Delete' : 'Remove',
            'Cancel'
        );
    }

    function formatDateTime(timestamp: number): string {
        return new Date(timestamp * 1000).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function formatDuration(start: number, end: number): string {
        const mins = Math.round((end - start) / 60);
        const hours = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        if (hours > 0) {
            return `${hours}h ${remainingMins}m`;
        }
        return `${mins}m`;
    }

    function formatElapsed(seconds: number): string {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function getRecordingProgress(scheduleId: number): RecordingProgress | undefined {
        return activeRecordings.find(r => r.schedule_id === scheduleId);
    }

    const activeCount = scheduled.filter(s => s.status === 'recording').length;
    const upcomingCount = scheduled.filter(s => s.status === 'scheduled').length;
    const downloads = useDownloadStore((s) => s.downloads) || [];
    const activeDownloadsCount = downloads.filter((d) => d.status === 'downloading').length;

    return (
        <div className="dvr-dashboard">
            {/* Top Navigation */}
            <header className="dvr-topbar">
                <div className="dvr-topbar-left">
                    <div className="dvr-brand">
                        <svg className="dvr-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z" />
                        </svg>
                        <span className="dvr-brand-name">DVR</span>
                    </div>
                </div>

                <div className="dvr-topbar-center">
                    <button
                        className={`dvr-topbar-item ${activeTab === 'scheduled' ? 'active' : ''}`}
                        onClick={() => setActiveTab('scheduled')}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dvr-topbar-icon">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>Scheduled</span>
                        {upcomingCount > 0 && <span className="dvr-topbar-badge">{upcomingCount}</span>}
                    </button>

                    <button
                        className={`dvr-topbar-item ${activeTab === 'recorded' ? 'active' : ''}`}
                        onClick={() => setActiveTab('recorded')}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dvr-topbar-icon">
                            <polygon points="23 7 16 12 23 17 23 7" />
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                        <span>Recordings</span>
                        {recorded.length > 0 && <span className="dvr-topbar-badge">{recorded.length}</span>}
                    </button>

                    <button
                        className={`dvr-topbar-item ${activeTab === 'downloads' ? 'active' : ''}`}
                        onClick={() => setActiveTab('downloads')}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dvr-topbar-icon">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>Downloads</span>
                        {activeDownloadsCount > 0 ? (
                            <span className="dvr-topbar-badge">{activeDownloadsCount}</span>
                        ) : downloads.length > 0 ? (
                            <span className="dvr-topbar-badge dvr-topbar-badge-inactive">{downloads.length}</span>
                        ) : null}
                    </button>

                    <button
                        className={`dvr-topbar-item ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dvr-topbar-icon">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                        <span>Settings</span>
                    </button>
                </div>

                <div className="dvr-topbar-right">
                    {activeCount > 0 && (
                        <div className="dvr-recording-indicator">
                            <span className="dvr-recording-pulse" />
                            <span className="dvr-recording-text">{activeCount} active</span>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="dvr-main">


                <div className="dvr-content">
                    {loading ? (
                        <div className="dvr-loading">
                            <div className="dvr-spinner" />
                            <span>Loading...</span>
                        </div>
                    ) : activeTab === 'scheduled' ? (
                        <ScheduledTab
                            scheduled={scheduled}
                            activeRecordings={activeRecordings}
                            onEdit={handleEditStart}
                            onCancel={handleCancel}
                            onPlay={onPlay}
                            formatDateTime={formatDateTime}
                            formatDuration={formatDuration}
                            formatElapsed={formatElapsed}
                            getRecordingProgress={getRecordingProgress}
                        />
                    ) : activeTab === 'recorded' ? (
                        <RecordedTab
                            recorded={recorded}
                            onPlay={onPlay}
                            onDelete={handleDelete}
                            formatDateTime={formatDateTime}
                        />
                    ) : activeTab === 'downloads' ? (
                        <DownloadsTab
                            onPlay={onPlay}
                        />
                    ) : (
                        <DvrTab />
                    )}
                </div>
            </main>

            {/* Edit Modal */}
            {editingSchedule && (
                <EditModal
                    schedule={editingSchedule}
                    startPadding={editStartPadding}
                    endPadding={editEndPadding}
                    onStartPaddingChange={setEditStartPadding}
                    onEndPaddingChange={setEditEndPadding}
                    onSave={handleSaveEdit}
                    onCancel={handleEditCancel}
                    saving={savingEdit}
                    formatDateTime={formatDateTime}
                />
            )}

            {/* Themed Modal */}
            <ModalComponent />
        </div>
    );
}

// Scheduled Tab Component
interface ScheduledTabProps {
    scheduled: DvrSchedule[];
    activeRecordings: RecordingProgress[];
    onEdit: (item: DvrSchedule) => void;
    onCancel: (id: number) => void;
    onPlay?: (recording: DvrRecording) => void;
    formatDateTime: (timestamp: number) => string;
    formatDuration: (start: number, end: number) => string;
    formatElapsed: (seconds: number) => string;
    getRecordingProgress: (scheduleId: number) => RecordingProgress | undefined;
}

function ScheduledTab({
    scheduled,
    activeRecordings,
    onEdit,
    onCancel,
    onPlay,
    formatDateTime,
    formatDuration,
    formatElapsed,
    getRecordingProgress,
}: ScheduledTabProps) {
    if (scheduled.length === 0) {
        return (
            <div className="dvr-empty-state">
                <div className="dvr-empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                </div>
                <h3>No Scheduled Recordings</h3>
                <p>Right-click on programs in the TV Guide to schedule recordings</p>
            </div>
        );
    }

    const active = scheduled.filter(s => s.status === 'recording');
    const upcoming = scheduled.filter(s => s.status === 'scheduled');

    return (
        <div className="dvr-scheduled">
            {active.length > 0 && (
                <section className="dvr-section">
                    <h2 className="dvr-section-title">
                        <span className="dvr-status-dot recording" />
                        Currently Recording
                    </h2>
                    <div className="dvr-card-grid">
                        {active.map(item => {
                            const progress = getRecordingProgress(item.id!);
                            return (
                                <RecordingCard
                                    key={item.id}
                                    item={item}
                                    progress={progress}
                                    onEdit={() => onEdit(item)}
                                    onCancel={() => onCancel(item.id!)}
                                    onPlay={onPlay ? () => {
                                        if (progress?.file_path) {
                                            onPlay({
                                                id: progress.recording_id,
                                                file_path: progress.file_path,
                                                filename: '',
                                                channel_name: item.channel_name,
                                                program_title: item.program_title,
                                                status: 'recording',
                                                auto_delete_policy: 'space_needed',
                                                created_at: item.created_at,
                                                actual_start: item.scheduled_start,
                                                scheduled_start: item.scheduled_start,
                                                scheduled_end: item.scheduled_end,
                                            });
                                        }
                                    } : undefined}
                                    formatDateTime={formatDateTime}
                                    formatDuration={formatDuration}
                                    formatElapsed={formatElapsed}
                                />
                            );
                        })}
                    </div>
                </section>
            )}

            {upcoming.length > 0 && (
                <section className="dvr-section">
                    <h2 className="dvr-section-title">
                        <span className="dvr-status-dot scheduled" />
                        Upcoming
                    </h2>
                    <div className="dvr-card-grid">
                        {upcoming.map(item => (
                            <ScheduledCard
                                key={item.id}
                                item={item}
                                onEdit={() => onEdit(item)}
                                onCancel={() => onCancel(item.id!)}
                                formatDateTime={formatDateTime}
                                formatDuration={formatDuration}
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

// Recorded Tab Component
interface RecordedTabProps {
    recorded: DvrRecording[];
    onPlay?: (recording: DvrRecording) => void;
    onDelete: (id: number, filePath?: string) => void;
    formatDateTime: (timestamp: number) => string;
}

function RecordedTab({ recorded, onPlay, onDelete, formatDateTime }: RecordedTabProps) {
    // Store thumbnail URLs by recording ID
    const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
    const [convertingIds, setConvertingIds] = useState<Record<number, boolean>>({});
    const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

    const handleConvert = async (id: number, format: string) => {
        setActiveMenuId(null);
        setConvertingIds(prev => ({ ...prev, [id]: true }));
        try {
            const { convertRecording } = await import('../db');
            await convertRecording(id, format);
        } catch (error) {
            console.error('Manual conversion failed:', error);
            alert('Manual conversion failed: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setConvertingIds(prev => ({ ...prev, [id]: false }));
        }
    };

    // Fetch thumbnails when recordings change
    useEffect(() => {
        const loadThumbnails = async () => {
            const newThumbnails: Record<number, string> = {};
            const prevThumbnails = { ...thumbnails };

            for (const item of recorded) {
                if (item.id && item.thumbnail_path) {
                    // Skip if we already have this thumbnail loaded
                    if (thumbnails[item.id]) {
                        newThumbnails[item.id] = thumbnails[item.id];
                        continue;
                    }

                    try {
                        const { getRecordingThumbnail } = await import('../db');
                        const data = await getRecordingThumbnail(item.id);
                        if (data) {
                            // Convert Uint8Array to Blob URL
                            const blob = new Blob([data.buffer as ArrayBuffer], { type: 'image/jpeg' });
                            newThumbnails[item.id] = URL.createObjectURL(blob);
                        }
                    } catch (error) {
                        console.error(`Failed to load thumbnail for recording ${item.id}:`, error);
                    }
                }
            }

            // Revoke URLs for recordings that are no longer present
            Object.entries(prevThumbnails).forEach(([id, url]) => {
                if (!newThumbnails[Number(id)]) {
                    URL.revokeObjectURL(url);
                }
            });

            setThumbnails(newThumbnails);
        };

        loadThumbnails();

        // Only cleanup on component unmount
        return () => {
            Object.values(thumbnails).forEach(url => URL.revokeObjectURL(url));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recorded]);

    if (recorded.length === 0) {
        return (
            <div className="dvr-empty-state">
                <div className="dvr-empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                </div>
                <h3>No Recordings Yet</h3>
                <p>Your recordings will appear here once they start or complete</p>
            </div>
        );
    }

    return (
        <div className="dvr-recorded-grid">
            {recorded.map(item => (
                <div key={item.id} className={`dvr-media-card ${item.status}`}>
                    <div className="dvr-media-thumbnail">
                        {item.id && thumbnails[item.id] ? (
                            <img
                                src={thumbnails[item.id]}
                                alt={item.program_title}
                                className="dvr-media-thumbnail-img"
                            />
                        ) : (
                            <div className="dvr-media-icon">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                            </div>
                        )}
                        {/* Watch progress bar */}
                        {item.progress_seconds && item.duration_sec ? (
                            <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                width: '100%',
                                height: '4px',
                                background: 'rgba(255, 255, 255, 0.2)',
                                zIndex: 2
                            }}>
                                <div style={{
                                    width: `${Math.min(100, Math.max(0, (item.progress_seconds / item.duration_sec) * 100))}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #c0392b, #e74c3c)'
                                }} />
                            </div>
                        ) : null}
                        <div className="dvr-media-overlay">
                            {(item.status === 'completed' || item.status === 'partial' || item.status === 'recording') && item.file_path && onPlay && (
                                <button
                                    className="dvr-play-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        console.log('[DVR] Play button clicked for:', item.file_path);
                                        onPlay(item);
                                    }}
                                    title={item.status === 'recording' ? 'Play While Recording' : item.status === 'partial' ? 'Play Partial Recording' : 'Play Recording'}
                                >
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                        <polygon points="5 3 19 12 5 21 5 3" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <span className={`dvr-media-badge ${item.status}`}>
                            {item.status === 'completed' ? 'Completed' : item.status === 'recording' ? 'REC' : item.status === 'partial' ? 'Partial' : item.status === 'failed' ? 'Failed' : item.status}
                        </span>
                    </div>
                    <div className="dvr-media-info">
                        <h3 className="dvr-media-title">{item.program_title}</h3>
                        <p className="dvr-media-channel">{item.channel_name}</p>
                        <p className="dvr-media-date">
                            {item.actual_end
                                ? formatDateTime(item.actual_end)
                                : item.actual_start
                                    ? formatDateTime(item.actual_start)
                                    : 'Unknown date'}
                        </p>
                        {item.duration_sec && (
                            <p className="dvr-media-duration">
                                {Math.round(item.duration_sec / 60)} min
                            </p>
                        )}
                    </div>
                    {(() => {
                        const isTs = item.file_path?.toLowerCase().endsWith('.ts');
                        const canConvert = isTs && (item.status === 'completed' || item.status === 'partial');
                        return (
                            <>
                                {canConvert && !convertingIds[item.id!] && (
                                    <button
                                        className="dvr-media-convert"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuId(item.id!);
                                        }}
                                        title="Convert Recording"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="23 4 23 10 17 10" />
                                            <polyline points="1 20 1 14 7 14" />
                                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                        </svg>
                                    </button>
                                )}

                                {activeMenuId === item.id && (
                                    <>
                                        <div 
                                            style={{
                                                position: 'fixed',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                zIndex: 14,
                                                cursor: 'default'
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMenuId(null);
                                            }}
                                        />
                                        <div className="dvr-convert-dropdown" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={(e) => { e.stopPropagation(); handleConvert(item.id!, 'mp4'); }}>Convert to MP4</button>
                                            <button onClick={(e) => { e.stopPropagation(); handleConvert(item.id!, 'mkv'); }}>Convert to MKV</button>
                                        </div>
                                    </>
                                )}

                                {convertingIds[item.id!] && (
                                    <div className="dvr-media-converting-overlay" onClick={(e) => e.stopPropagation()}>
                                        <div className="dvr-converting-spinner" />
                                        <span className="dvr-converting-text">Converting...</span>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                    <button
                        className="dvr-media-delete"
                        onClick={() => onDelete(item.id!, item.file_path)}
                        title="Delete"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
}

// Recording Card (for active recordings)
interface RecordingCardProps {
    item: DvrSchedule;
    progress?: RecordingProgress;
    onEdit: () => void;
    onCancel: () => void;
    onPlay?: () => void;
    formatDateTime: (timestamp: number) => string;
    formatDuration: (start: number, end: number) => string;
    formatElapsed: (seconds: number) => string;
}

function RecordingCard({ item, progress, onEdit, onCancel, onPlay, formatDateTime, formatDuration, formatElapsed }: RecordingCardProps) {
    const percent = progress
        ? Math.min(100, (progress.elapsed_seconds / progress.scheduled_duration) * 100)
        : 0;

    return (
        <div className="dvr-card recording">
            <div className="dvr-card-header">
                <span className="dvr-card-status-badge recording">REC</span>
                <div className="dvr-card-actions">
                    {onPlay && progress?.file_path && (
                        <button className="dvr-btn-icon play" onClick={onPlay} title="Play while recording">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                        </button>
                    )}
                    <button className="dvr-btn-icon" onClick={onEdit} title="Edit padding">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button className="dvr-btn-icon danger" onClick={onCancel} title="Stop recording">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        </svg>
                    </button>
                </div>
            </div>
            <div className="dvr-card-body">
                <h3 className="dvr-card-title">{item.program_title}</h3>
                <div className="dvr-card-meta">
                    <span className="dvr-meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                        {item.channel_name}
                    </span>
                    <span className="dvr-meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {formatDateTime(item.scheduled_start)}
                    </span>
                    <span className="dvr-meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 16" />
                        </svg>
                        {formatDuration(item.scheduled_start, item.scheduled_end)}
                    </span>
                </div>
                {progress && (
                    <div className="dvr-card-progress">
                        <div className="dvr-progress-header">
                            <span className="dvr-progress-label">Recording in progress</span>
                            <span className="dvr-progress-time">{formatElapsed(progress.elapsed_seconds)}</span>
                        </div>
                        <div className="dvr-progress-bar">
                            <div className="dvr-progress-fill" style={{ width: `${percent}%` }} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Scheduled Card (for upcoming recordings)
interface ScheduledCardProps {
    item: DvrSchedule;
    onEdit: () => void;
    onCancel: () => void;
    formatDateTime: (timestamp: number) => string;
    formatDuration: (start: number, end: number) => string;
}

function ScheduledCard({ item, onEdit, onCancel, formatDateTime, formatDuration }: ScheduledCardProps) {
    return (
        <div className="dvr-card scheduled">
            <div className="dvr-card-header">
                <span className="dvr-card-status-badge scheduled">SCHEDULED</span>
                <div className="dvr-card-actions">
                    <button className="dvr-btn-icon" onClick={onEdit} title="Edit padding">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button className="dvr-btn-icon danger" onClick={onCancel} title="Cancel recording">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>
            <div className="dvr-card-body">
                <h3 className="dvr-card-title">{item.program_title}</h3>
                <div className="dvr-card-meta">
                    <span className="dvr-meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                        {item.channel_name}
                    </span>
                    <span className="dvr-meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {formatDateTime(item.scheduled_start)}
                    </span>
                    <span className="dvr-meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 16" />
                        </svg>
                        {formatDuration(item.scheduled_start, item.scheduled_end)}
                    </span>
                </div>
                {(item.start_padding_sec > 0 || item.end_padding_sec > 0) && (
                    <div className="dvr-card-padding">
                        <span className="dvr-padding-label">Padding:</span>
                        <span className="dvr-padding-value">+{item.start_padding_sec}s start, +{item.end_padding_sec}s end</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// Edit Modal Component
interface EditModalProps {
    schedule: DvrSchedule;
    startPadding: number;
    endPadding: number;
    onStartPaddingChange: (value: number) => void;
    onEndPaddingChange: (value: number) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
    formatDateTime: (timestamp: number) => string;
}

function EditModal({
    schedule,
    startPadding,
    endPadding,
    onStartPaddingChange,
    onEndPaddingChange,
    onSave,
    onCancel,
    saving,
    formatDateTime,
}: EditModalProps) {
    return (
        <div className="dvr-modal-overlay" onClick={onCancel}>
            <div className="dvr-modal" onClick={(e) => e.stopPropagation()}>
                <div className="dvr-modal-header">
                    <h3>Edit Recording</h3>
                    <button className="dvr-modal-close" onClick={onCancel}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="dvr-modal-body">
                    <div className="dvr-modal-info">
                        <h4>{schedule.program_title}</h4>
                        <p>{schedule.channel_name}</p>
                        <p>{formatDateTime(schedule.scheduled_start)}</p>
                    </div>

                    <div className="dvr-form-group">
                        <label>Start Padding</label>
                        <div className="dvr-form-control">
                            <input
                                type="range"
                                min="0"
                                max="300"
                                step="30"
                                value={startPadding}
                                onChange={(e) => onStartPaddingChange(Number(e.target.value))}
                            />
                            <span className="dvr-form-value">{startPadding}s</span>
                        </div>
                        <span className="dvr-form-hint">Record this many seconds before start time</span>
                    </div>

                    <div className="dvr-form-group">
                        <label>End Padding</label>
                        <div className="dvr-form-control">
                            <input
                                type="range"
                                min="0"
                                max="600"
                                step="30"
                                value={endPadding}
                                onChange={(e) => onEndPaddingChange(Number(e.target.value))}
                            />
                            <span className="dvr-form-value">{endPadding}s</span>
                        </div>
                        <span className="dvr-form-hint">Record this many seconds after end time</span>
                    </div>
                </div>

                <div className="dvr-modal-footer">
                    <button className="dvr-btn secondary" onClick={onCancel}>Cancel</button>
                    <button className="dvr-btn primary" onClick={onSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Downloads Tab Component
interface DownloadsTabProps {
    onPlay?: (recording: DvrRecording) => void;
}

function DownloadsTab({ onPlay }: DownloadsTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showPosters, setShowPosters] = useState<boolean>(() => {
        try {
            return localStorage.getItem('ynotv-downloads-show-posters') !== 'false';
        } catch {
            return true;
        }
    });
    const downloads = useDownloadStore((s) => s.downloads) || [];
    const cancelDownload = useDownloadStore((s) => s.cancelDownload);
    const removeDownload = useDownloadStore((s) => s.removeDownload);
    const clearCompleted = useDownloadStore((s) => s.clearCompleted);

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatSpeed = (bytesPerSec: number): string => {
        if (!bytesPerSec || bytesPerSec === 0) return '0 KB/s';
        const kb = bytesPerSec / 1024;
        if (kb < 1024) {
            return `${kb.toFixed(1)} KB/s`;
        }
        const mb = kb / 1024;
        return `${mb.toFixed(2)} MB/s`;
    };

    const activeDownloads = downloads.filter((d) => d.status === 'downloading');
    const queuedDownloads = downloads.filter((d) => d.status === 'queued');
    const completedDownloads = downloads.filter((d) => d.status === 'completed');
    const otherDownloads = downloads.filter((d) => d.status !== 'downloading' && d.status !== 'queued' && d.status !== 'completed');

    const filteredDownloads = downloads.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.savePath.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="dvr-downloads">
            <div className="dvr-downloads-header" style={{ gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 0 150px', display: 'flex', alignItems: 'center' }}>
                    <div className="dvr-downloads-stats-chips">
                        {activeDownloads.length > 0 && (
                            <span className="dvr-downloads-stats-chip downloading" title="Currently downloading">
                                <span className="dvr-downloads-stats-dot downloading" />
                                {activeDownloads.length} downloading
                            </span>
                        )}
                        {queuedDownloads.length > 0 && (
                            <span className="dvr-downloads-stats-chip queued" title="Queued waiting to download">
                                <span className="dvr-downloads-stats-dot queued" />
                                {queuedDownloads.length} queued
                            </span>
                        )}
                        {completedDownloads.length > 0 && (
                            <span className="dvr-downloads-stats-chip completed" title="Successfully downloaded">
                                <span className="dvr-downloads-stats-dot completed" />
                                {completedDownloads.length} downloaded
                            </span>
                        )}
                        {otherDownloads.length > 0 && (
                            <span className="dvr-downloads-stats-chip failed" title="Canceled or failed downloads">
                                <span className="dvr-downloads-stats-dot failed" />
                                {otherDownloads.length} canceled/failed
                            </span>
                        )}
                        {downloads.length === 0 && (
                            <span className="dvr-downloads-stats-chip empty">
                                0 downloads
                            </span>
                        )}
                    </div>
                </div>

                <div className="dvr-downloads-search-container" style={{ position: 'relative', flex: '0 1 300px', width: '100%', minWidth: '200px', margin: '0 auto' }}>
                    <input
                        type="text"
                        placeholder="Search downloads..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 12px 8px 34px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '0.85rem',
                            outline: 'none',
                            transition: 'all 0.15s ease',
                        }}
                        className="dvr-downloads-search-input"
                    />
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{
                            position: 'absolute',
                            left: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '16px',
                            height: '16px',
                            color: 'rgba(255,255,255,0.4)',
                        }}
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                cursor: 'pointer',
                                padding: '4px',
                                fontSize: '0.8rem',
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div style={{ flex: '1 0 150px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                    <label className="dvr-downloads-toggle-posters" title="Toggle poster visibility">
                        <input
                            type="checkbox"
                            checked={showPosters}
                            onChange={(e) => {
                                setShowPosters(e.target.checked);
                                try {
                                    localStorage.setItem('ynotv-downloads-show-posters', String(e.target.checked));
                                } catch (err) {
                                    console.error('[DownloadsTab] Failed to save poster preference:', err);
                                }
                            }}
                        />
                        Show Posters
                    </label>

                    {downloads.some((d) => d.status !== 'downloading' && d.status !== 'queued') && (
                        <button className="dvr-btn-clear" onClick={clearCompleted}>
                            Clear Completed/Failed
                        </button>
                    )}
                </div>
            </div>

            {downloads.length === 0 ? (
                <div className="dvr-empty-state">
                    <div className="dvr-empty-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h3>No Downloads</h3>
                    <p>Start a download from Movie or Series details</p>
                </div>
            ) : filteredDownloads.length === 0 ? (
                <div className="dvr-empty-state">
                    <div className="dvr-empty-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </div>
                    <h3>No matching downloads</h3>
                    <p>Try searching for a different keyword</p>
                </div>
            ) : (
                <div className={`dvr-downloads-list ${showPosters ? 'show-posters' : ''}`}>
                    {filteredDownloads.map((item) => {
                        const isDownloading = item.status === 'downloading';
                        const isQueued = item.status === 'queued';
                        const isCompleted = item.status === 'completed';
                        const isFailed = item.status === 'failed';
                        const isDownloadingOrQueued = isDownloading || isQueued;

                        const seriesMatch = item.title.match(/^(.*?) - (S\d+E\d+)(?: - (.*))?$/);
                        const displayTitle = seriesMatch ? seriesMatch[1] : item.title;
                        const subtitle = seriesMatch ? seriesMatch[2] + (seriesMatch[3] ? ` · ${seriesMatch[3]}` : '') : '';

                        return (
                            <div key={item.id} className={`dvr-download-card ${item.status} ${showPosters && item.poster ? 'has-poster' : ''}`}>
                                <div className="dvr-download-card-header">
                                    {item.status !== 'completed' && (
                                        <span className={`dvr-download-status-badge ${item.status}`}>
                                            {item.status === 'downloading'
                                                ? 'DOWNLOADING'
                                                : item.status === 'queued'
                                                ? 'QUEUED'
                                                : item.status === 'failed'
                                                ? 'FAILED'
                                                : 'CANCELED'}
                                        </span>
                                    )}
                                    <div className="dvr-download-actions">
                                        {isCompleted && onPlay && (
                                            <button
                                                className="dvr-btn-icon play"
                                                onClick={() => {
                                                    onPlay({
                                                        file_path: item.savePath,
                                                        program_title: item.title,
                                                        channel_name: 'Media Download',
                                                        status: 'completed',
                                                        filename: '',
                                                        auto_delete_policy: 'keep_forever',
                                                        created_at: Math.floor(item.addedAt / 1000),
                                                        actual_start: Math.floor(item.addedAt / 1000),
                                                        scheduled_start: Math.floor(item.addedAt / 1000),
                                                        scheduled_end: Math.floor(item.addedAt / 1000),
                                                    });
                                                }}
                                                title="Play Downloaded File"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                    <polygon points="5 3 19 12 5 21 5 3" />
                                                </svg>
                                            </button>
                                        )}
                                        {isDownloadingOrQueued && (
                                            <button
                                                className="dvr-btn-icon danger"
                                                onClick={() => cancelDownload(item.id)}
                                                title="Cancel Download"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            </button>
                                        )}
                                        {!isDownloadingOrQueued && (
                                            <button
                                                className="dvr-btn-icon danger"
                                                onClick={() => removeDownload(item.id)}
                                                title="Remove from list"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="dvr-download-card-content">
                                    {showPosters && item.poster && (
                                        <div className="dvr-download-poster" style={{ position: 'relative' }}>
                                            <img
                                                src={item.poster}
                                                alt={item.title}
                                                className="dvr-download-poster-img"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                            {/* Watch progress overlay on poster */}
                                            {item.status === 'completed' && item.watchProgressSeconds && item.durationSecs ? (
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: '4px',
                                                    background: 'rgba(255, 255, 255, 0.2)'
                                                }}>
                                                    <div style={{
                                                        width: `${Math.min(100, Math.max(0, (item.watchProgressSeconds / item.durationSecs) * 100))}%`,
                                                        height: '100%',
                                                        background: 'linear-gradient(90deg, #c0392b, #e74c3c)'
                                                    }} />
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                    <div className="dvr-download-card-body">
                                        <h3 className="dvr-download-title" title={item.title}>
                                            {displayTitle}
                                        </h3>
                                        {subtitle && (
                                            <p className="dvr-download-subtitle" title={subtitle}>
                                                {subtitle}
                                            </p>
                                        )}
                                        <p className="dvr-download-path" title={item.savePath}>
                                            {item.savePath}
                                        </p>

                                        {/* Watch progress bar for completed downloads without posters */}
                                        {item.status === 'completed' && item.watchProgressSeconds && item.durationSecs && (!showPosters || !item.poster) ? (
                                            <div style={{ marginTop: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                                                    <span>Watched: {Math.round((item.watchProgressSeconds / item.durationSecs) * 100)}%</span>
                                                </div>
                                                <div className="dvr-progress-bar">
                                                    <div
                                                        className="dvr-progress-fill"
                                                        style={{ width: `${Math.min(100, Math.max(0, (item.watchProgressSeconds / item.durationSecs) * 100))}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ) : null}

                                        {isDownloading && (
                                            <div className="dvr-download-progress-section">
                                                <div className="dvr-download-progress-header">
                                                    <span className="dvr-download-progress-bytes">
                                                        {formatBytes(item.bytesWritten)}
                                                        {item.totalBytes ? ` / ${formatBytes(item.totalBytes)}` : ''}
                                                    </span>
                                                    <span className="dvr-download-progress-speed">
                                                        {formatSpeed(item.speedBytes)}
                                                    </span>
                                                    <span className="dvr-download-progress-percent">
                                                        {Math.round(item.progress)}%
                                                    </span>
                                                </div>
                                                <div className="dvr-progress-bar">
                                                    <div
                                                        className="dvr-progress-fill downloads"
                                                        style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {isQueued && (
                                            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '8px 0 0 0' }}>
                                                Waiting in queue...
                                            </p>
                                        )}

                                        {isFailed && item.error && (
                                            <p className="dvr-download-error">
                                                Error: {item.error}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

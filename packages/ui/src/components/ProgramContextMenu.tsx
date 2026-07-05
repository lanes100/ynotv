import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { scheduleRecording, detectScheduleConflicts, addToWatchlist, db, type DvrSchedule, getDvrSettings } from '../db';
import type { StoredProgram, WatchlistOptions } from '../db';
import { StalkerClient } from '@ynotv/local-adapter';
import { useModal } from './Modal';
import { WatchlistOptionsModal } from './WatchlistOptionsModal';
import { TVMazeSearchModal } from './TVMazeSearchModal';
import { DvrScheduleOptionsModal } from './DvrScheduleOptionsModal';
import './ProgramContextMenu.css';

interface ProgramContextMenuProps {
    program: StoredProgram;
    sourceId: string;
    channelId: string;
    channelName: string;
    position: { x: number; y: number };
    onClose: () => void;
}

export function ProgramContextMenu({
    program,
    sourceId,
    channelId,
    channelName,
    position,
    onClose,
}: ProgramContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [scheduling, setScheduling] = useState(false);
    const [addingToWatchlist, setAddingToWatchlist] = useState(false);
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(undefined);
    const [showWatchlistModal, setShowWatchlistModal] = useState(false);
    const [showTVMazeModal, setShowTVMazeModal] = useState(false);
    const [channelForWatchlist, setChannelForWatchlist] = useState<import('../db').StoredChannel | null>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);
    const [menuHidden, setMenuHidden] = useState(false);
    const [defaultStartPadding, setDefaultStartPadding] = useState(60);
    const [defaultEndPadding, setDefaultEndPadding] = useState(300);
    const { showSuccess, showError, showInfo, showConfirm, showModal, ModalComponent } = useModal();

    useEffect(() => {
        async function loadDefaults() {
            try {
                const settings = await getDvrSettings();
                setDefaultStartPadding(settings.default_start_padding_sec);
                setDefaultEndPadding(settings.default_end_padding_sec);
            } catch (e) {
                console.error('Failed to load DVR settings:', e);
            }
        }
        loadDefaults();
    }, []);

    useLayoutEffect(() => {
        if (menuRef.current) {
            const menu = menuRef.current;
            const menuWidth = menu.offsetWidth;
            const menuHeight = menu.offsetHeight;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let x = position.x;
            let y = position.y;

            // Determine if click was in top or bottom half of the screen
            const isBottomHalf = position.y > viewportHeight / 2;

            if (isBottomHalf) {
                // If bottom half, menu pops UP (bottom left is at cursor)
                y = position.y - menuHeight;
            }

            // Prevent menu from going off right edge
            if (x + menuWidth > viewportWidth) {
                x = viewportWidth - menuWidth - 10;
            }

            // Prevent menu from going off left edge
            if (x < 10) x = 10;

            // Safety bounds for Y-axis (in case menu is extremely tall)
            if (y + menuHeight > viewportHeight) y = viewportHeight - menuHeight - 10;
            if (y < 10) y = 10;

            setAdjustedPosition({ x, y });
        }
    }, [position]);

    // Close on click outside (but not when modal is open)
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (showWatchlistModal) return; // Don't close if watchlist modal is open
            if (showTVMazeModal) return; // Don't close if TVMaze modal is open
            if (showOptionsModal) return; // Don't close if options modal is open
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, showWatchlistModal, showTVMazeModal, showOptionsModal]);

    // Close on escape (but not when modal is open)
    useEffect(() => {
        function handleEscape(e: KeyboardEvent) {
            if (showWatchlistModal) return; // Don't close if watchlist modal is open
            if (showTVMazeModal) return; // Don't close if TVMaze modal is open
            if (showOptionsModal) return; // Don't close if options modal is open
            if (e.key === 'Escape') {
                onClose();
            }
        }

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose, showWatchlistModal, showTVMazeModal, showOptionsModal]);

    async function handleAddToWatchlistClick() {
        const channel = await db.channels.get(channelId);
        if (channel) {
            setChannelForWatchlist(channel);
            setShowWatchlistModal(true);
        } else {
            showError('Error', 'Channel not found');
            onClose();
        }
    }

    async function handleWatchlistConfirm(options: WatchlistOptions) {
        setShowWatchlistModal(false);
        setAddingToWatchlist(true);

        try {
            if (!channelForWatchlist) {
                setMenuHidden(true);
                showModal({
                    title: 'Error',
                    message: 'Channel not found',
                    type: 'error',
                    confirmText: 'OK',
                    onConfirm: () => onClose(),
                    onCancel: () => onClose(),
                });
                return;
            }

            const added = await addToWatchlist(program, channelForWatchlist, options);
            setMenuHidden(true);
            if (added) {
                const reminderText = options.reminder_enabled
                    ? options.reminder_minutes > 0
                        ? ` (Reminder: ${options.reminder_minutes} min before)`
                        : ' (Reminder at start time)'
                    : '';
                showModal({
                    title: 'Added to Watchlist',
                    message: `${program.title}${reminderText}`,
                    type: 'success',
                    confirmText: 'OK',
                    onConfirm: () => onClose(),
                    onCancel: () => onClose(),
                });
                // Dispatch event to refresh watchlist UI
                window.dispatchEvent(new CustomEvent('watchlist-updated'));
            } else {
                showModal({
                    title: 'Already in Watchlist',
                    message: `${program.title} is already in your watchlist`,
                    type: 'info',
                    confirmText: 'OK',
                    onConfirm: () => onClose(),
                    onCancel: () => onClose(),
                });
            }
        } catch (error: any) {
            console.error('Failed to add to watchlist:', error);
            setMenuHidden(true);
            showModal({
                title: 'Failed to Add',
                message: error?.message || 'Failed to add to watchlist',
                type: 'error',
                confirmText: 'OK',
                onConfirm: () => onClose(),
                onCancel: () => onClose(),
            });
        } finally {
            setAddingToWatchlist(false);
        }
    }

    async function handleScheduleRecording() {
        if (scheduling) return;
        setScheduling(true);

        try {
            // Get channel info to check if we need URL resolution
            const channel = await db.channels.get(channelId);
            let resolved: string | undefined;

            // For Stalker sources, resolve the URL before scheduling
            if (channel?.direct_url?.startsWith('stalker_')) {
                if (!window.storage) {
                    throw new Error('Storage API not available');
                }

                const sourceRes = await window.storage.getSource(sourceId);
                if (sourceRes.data?.type === 'stalker' && sourceRes.data.mac) {
                    const client = new StalkerClient({
                        baseUrl: sourceRes.data.url,
                        mac: sourceRes.data.mac,
                        userAgent: sourceRes.data.user_agent
                    }, sourceId);

                    resolved = await client.resolveStreamUrl(channel.direct_url);
                    console.log('[ProgramContextMenu] Resolved Stalker URL:', resolved);
                }
            }

            setResolvedUrl(resolved);
            setShowOptionsModal(true);
            setMenuHidden(true); // Hide the context menu since modal is opening
        } catch (error: any) {
            console.error('Failed to resolve stream URL:', error);
            showModal({
                title: 'Scheduling Failed',
                message: error?.message || 'Failed to resolve stream URL',
                type: 'error',
                confirmText: 'OK',
                onConfirm: () => onClose(),
                onCancel: () => onClose(),
            });
        } finally {
            setScheduling(false);
        }
    }

    async function handleConfirmSchedule(options: {
        startPadding: number;
        endPadding: number;
        recurrence: string;
    }) {
        setShowOptionsModal(false);
        setScheduling(true);
        try {
            const startTime = program.start instanceof Date ? program.start : new Date(program.start);
            const endTime = program.end instanceof Date ? program.end : new Date(program.end);

            const schedule: Omit<DvrSchedule, 'id' | 'created_at' | 'status'> = {
                source_id: sourceId,
                channel_id: channelId,
                channel_name: channelName,
                program_title: program.title,
                scheduled_start: Math.floor(startTime.getTime() / 1000),
                scheduled_end: Math.floor(endTime.getTime() / 1000),
                start_padding_sec: options.startPadding,
                end_padding_sec: options.endPadding,
                series_match_title: undefined,
                recurrence: options.recurrence !== 'once' ? options.recurrence : undefined,
                stream_url: resolvedUrl,
            };

            // Check for conflicts
            const conflictResult = await detectScheduleConflicts(schedule);
            if (conflictResult.hasConflict) {
                const sourceMeta = await db.sourcesMeta.get(sourceId);
                const maxConnections = parseInt(sourceMeta?.max_connections || '1');

                if (maxConnections === 1) {
                    showConfirm(
                        '1 Connection Limit',
                        'This source only has a 1 connection limit. Are you sure you want to record?',
                        async () => {
                            try {
                                setScheduling(true);
                                await scheduleRecording(schedule);
                                showModal({
                                    title: 'Recording Scheduled',
                                    message: `${program.title} has been scheduled`,
                                    type: 'success',
                                    confirmText: 'OK',
                                    onConfirm: () => onClose(),
                                    onCancel: () => onClose(),
                                });
                            } catch (err: any) {
                                showModal({
                                    title: 'Scheduling Failed',
                                    message: err?.message || 'Failed to schedule recording',
                                    type: 'error',
                                    confirmText: 'OK',
                                    onConfirm: () => onClose(),
                                    onCancel: () => onClose(),
                                });
                            } finally {
                                setScheduling(false);
                            }
                        },
                        () => onClose(),
                        'Record',
                        'Cancel'
                    );
                } else {
                    showModal({
                        title: 'Scheduling Conflict',
                        message: conflictResult.message || 'This program conflicts with an existing recording.',
                        type: 'error',
                        confirmText: 'OK',
                        onConfirm: () => onClose(),
                        onCancel: () => onClose(),
                    });
                }
                return;
            }

            // Schedule the recording
            await scheduleRecording(schedule);
            showModal({
                title: 'Recording Scheduled',
                message: `${program.title} has been scheduled`,
                type: 'success',
                confirmText: 'OK',
                onConfirm: () => onClose(),
                onCancel: () => onClose(),
            });
        } catch (error: any) {
            console.error('Failed to schedule recording:', error);
            showModal({
                title: 'Scheduling Failed',
                message: error?.message || 'Failed to schedule recording',
                type: 'error',
                confirmText: 'OK',
                onConfirm: () => onClose(),
                onCancel: () => onClose(),
            });
        } finally {
            setScheduling(false);
        }
    }

    return createPortal(
        <>
            <div
                ref={menuRef}
                className="program-context-menu"
                style={{
                    left: `${adjustedPosition.x}px`,
                    top: `${adjustedPosition.y}px`,
                    display: menuHidden ? 'none' : undefined,
                }}
            >
                <div className="context-menu-item" onClick={handleScheduleRecording}>
                    {scheduling ? '⏳ Scheduling...' : '📹 Schedule Recording'}
                </div>
                <div className="context-menu-item" onClick={handleAddToWatchlistClick}>
                    {addingToWatchlist ? '⏳ Adding...' : '⭐ Add to Watchlist'}
                </div>
                <div className="context-menu-separator" />
                <div className="context-menu-item" onClick={() => {
                    console.log('[ProgramContextMenu] Opening TVMaze modal for:', program.title);
                    setShowTVMazeModal(true);
                }}>
                    📺 Track Show
                </div>
                <div className="context-menu-separator" />
                <div className="context-menu-item context-menu-item-secondary" onClick={onClose}>
                    Cancel
                </div>
                <ModalComponent />
            </div>
            <WatchlistOptionsModal
                isOpen={showWatchlistModal}
                program={program}
                channel={channelForWatchlist}
                onConfirm={handleWatchlistConfirm}
                onCancel={() => setShowWatchlistModal(false)}
            />
            {showTVMazeModal && (
                <TVMazeSearchModal
                    programTitle={program.title}
                    channelName={channelName}
                    channelId={channelId}
                    onClose={() => setShowTVMazeModal(false)}
                />
            )}
            <DvrScheduleOptionsModal
                isOpen={showOptionsModal}
                programTitle={program.title}
                channelName={channelName}
                timeString={`${new Date(program.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(program.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                defaultStartPadding={defaultStartPadding}
                defaultEndPadding={defaultEndPadding}
                onConfirm={handleConfirmSchedule}
                onCancel={() => {
                    setShowOptionsModal(false);
                    onClose();
                }}
            />
        </>,
        document.body
    );
}

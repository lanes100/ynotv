import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { scheduleRecording, detectScheduleConflicts, type DvrSchedule, db, updateChannelAlias } from '../db';
import type { StoredChannel } from '../db';
import { StalkerClient } from '@ynotv/local-adapter';
import { useModal } from './Modal';
import { addChannelsToGroup } from '../services/custom-groups';
import { addChannelToFailoverGroup, createFailoverGroup } from '../services/failover-groups';
import { addToRecentChannels } from '../utils/recentChannels';
import { EpgEditorModal } from './EpgEditorModal';
import './ProgramContextMenu.css'; // Reuse the same styles

type MenuView = 'main' | 'quick' | 'custom' | 'group' | 'failover';

interface ChannelContextMenuProps {
    channel: StoredChannel;
    position: { x: number; y: number };
    onClose: () => void;
    // Multiview props
    currentLayout?: string;
    onSendToSlot?: (slotId: 2 | 3 | 4, channelName: string, channelUrl: string, sourceName?: string | null) => void;
    // Popout props
    onPlayInPopout?: (channel: StoredChannel) => void;
    // External player prop
    onPlayInExternal?: (channel: StoredChannel) => void;
}

// Helper to format date for datetime-local input
function formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
}

function formatTimeForInput(date: Date): string {
    return date.toTimeString().slice(0, 5);
}

export function ChannelContextMenu({
    channel,
    position,
    onClose,
    currentLayout,
    onSendToSlot,
    onPlayInPopout,
    onPlayInExternal,
}: ChannelContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [currentView, setCurrentView] = useState<MenuView>('main');
    const [durationMinutes, setDurationMinutes] = useState(30);
    const [scheduling, setScheduling] = useState(false);
    const [adjustedPosition, setAdjustedPosition] = useState(position);
    const [showEpgEditor, setShowEpgEditor] = useState(false);
    const [menuHidden, setMenuHidden] = useState(false);
    const { showSuccess, showError, showPrompt, showConfirm, showModal, ModalComponent } = useModal();

    // Group state
    const [customGroups, setCustomGroups] = useState<{ group_id: string; name: string }[]>([]);
    const [addingToGroup, setAddingToGroup] = useState<string | null>(null);

    // Failover group state
    const [failoverGroups, setFailoverGroups] = useState<{ group_id: string; name: string }[]>([]);
    const [addingToFailoverGroup, setAddingToFailoverGroup] = useState<string | null>(null);
    const [creatingFailoverGroup, setCreatingFailoverGroup] = useState(false);
    const [newFailoverGroupName, setNewFailoverGroupName] = useState('');
    const failoverNameInputRef = useRef<HTMLInputElement>(null);

    // Custom date/time state
    const now = new Date();
    const defaultEnd = new Date(now.getTime() + 30 * 60 * 1000);
    const [startDate, setStartDate] = useState(formatDateForInput(now));
    const [startTime, setStartTime] = useState(formatTimeForInput(now));
    const [endDate, setEndDate] = useState(formatDateForInput(defaultEnd));
    const [endTime, setEndTime] = useState(formatTimeForInput(defaultEnd));

    // Load custom groups when the user opens the group submenu
    useEffect(() => {
        if (currentView !== 'group') return;
        let isMounted = true;
        db.customGroups.toArray().then(groups => {
            if (isMounted) setCustomGroups(groups.sort((a, b) => a.name.localeCompare(b.name)));
        }).catch(() => {
            if (isMounted) setCustomGroups([]);
        });
        return () => { isMounted = false; };
    }, [currentView]);

    // Load failover groups when the user opens the failover group submenu
    useEffect(() => {
        if (currentView !== 'failover') return;
        let isMounted = true;
        db.failoverGroups.toArray().then(groups => {
            if (isMounted) setFailoverGroups(groups.sort((a, b) => a.name.localeCompare(b.name)));
        }).catch(() => {
            if (isMounted) setFailoverGroups([]);
        });
        return () => { isMounted = false; };
    }, [currentView]);

    // Adjust position to keep menu within viewport
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

            if (x + menuWidth > viewportWidth) x = viewportWidth - menuWidth - 10;
            if (x < 10) x = 10;

            // Safety bounds for Y-axis
            if (y + menuHeight > viewportHeight) y = viewportHeight - menuHeight - 10;
            if (y < 10) y = 10;

            setAdjustedPosition({ x, y });
        }
    }, [position, currentView]);

    const getMenuStyle = (extra: React.CSSProperties = {}): React.CSSProperties => ({
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        display: menuHidden ? 'none' : undefined,
        ...extra,
    });

    // Close on click outside (ignore clicks inside modals since they are rendered in portals)
    useEffect(() => {
        function isInsideModal(target: Node): boolean {
            const el = target as HTMLElement;
            return !!el.closest?.('.modal-overlay') || !!el.closest?.('.modal-container');
        }
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) && !isInsideModal(e.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Close on escape
    useEffect(() => {
        function handleEscape(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    async function handleCopyStreamUrl() {
        try {
            let streamUrl = channel.direct_url || '';

            // If it's an Xtream source and direct_url isn't already a full URL, we need to build it
            if (channel.source_id && window.storage && !streamUrl.startsWith('http')) {
                const sourceRes = await window.storage.getSource(channel.source_id);
                if (sourceRes.data?.type === 'xtream' && sourceRes.data.username && sourceRes.data.password) {
                    const baseUrl = sourceRes.data.url.replace(/\/+$/, '');
                    const rawStreamId = channel.stream_id.replace(`${channel.source_id}_`, '');
                    streamUrl = `${baseUrl}/live/${encodeURIComponent(sourceRes.data.username)}/${encodeURIComponent(sourceRes.data.password)}/${rawStreamId}.ts`;
                }
            }

            setMenuHidden(true);
            if (streamUrl) {
                await navigator.clipboard.writeText(streamUrl);
                showModal({
                    title: 'Copied',
                    message: 'Stream URL copied to clipboard',
                    type: 'success',
                    confirmText: 'OK',
                    onConfirm: () => onClose(),
                    onCancel: () => onClose(),
                });
            } else {
                showModal({
                    title: 'Error',
                    message: 'Could not resolve stream URL',
                    type: 'error',
                    confirmText: 'OK',
                    onConfirm: () => onClose(),
                    onCancel: () => onClose(),
                });
            }
        } catch (e: any) {
            console.error('Failed to copy stream URL:', e);
            setMenuHidden(true);
            showModal({
                title: 'Error',
                message: e?.message || 'Failed to copy stream URL',
                type: 'error',
                confirmText: 'OK',
                onConfirm: () => onClose(),
                onCancel: () => onClose(),
            });
        }
    }

    async function createRecording(startTimestamp: number, endTimestamp: number, title: string) {
        let resolvedUrl: string | undefined;

        if (channel.direct_url?.startsWith('stalker_')) {
            if (!window.storage) throw new Error('Storage API not available');
            const sourceRes = await window.storage.getSource(channel.source_id);
            if (sourceRes.data?.type === 'stalker' && sourceRes.data.mac) {
                const client = new StalkerClient({
                    baseUrl: sourceRes.data.url,
                    mac: sourceRes.data.mac,
                    userAgent: sourceRes.data.user_agent
                }, channel.source_id);
                resolvedUrl = await client.resolveStreamUrl(channel.direct_url);
            }
        }

        const schedule: Omit<DvrSchedule, 'id' | 'created_at' | 'status'> = {
            source_id: channel.source_id,
            channel_id: channel.stream_id,
            channel_name: channel.name,
            program_title: title,
            scheduled_start: startTimestamp,
            scheduled_end: endTimestamp,
            start_padding_sec: 0,
            end_padding_sec: 0,
            series_match_title: undefined,
            recurrence: undefined,
            stream_url: resolvedUrl,
        };

        const conflictResult = await detectScheduleConflicts(schedule);
        if (conflictResult.hasConflict) {
            const sourceMeta = await db.sourcesMeta.get(channel.source_id);
            const maxConnections = parseInt(sourceMeta?.max_connections || '1');
            const isViewingConflict = conflictResult.message?.toLowerCase().includes('watching this source');

            setMenuHidden(true);
            if (maxConnections === 1 && isViewingConflict) {
                showConfirm(
                    '1 Connection Limit',
                    "Your provider has a maximum of 1 connection and you're already viewing this source.",
                    async () => {
                        try {
                            setScheduling(true);
                            await scheduleRecording(schedule);
                            const durationMins = Math.round((endTimestamp - startTimestamp) / 60);
                            showModal({
                                title: 'Recording Scheduled',
                                message: `${channel.name} scheduled for ${durationMins} minutes`,
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
                    'Ignore & Record',
                    'OK'
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

        await scheduleRecording(schedule);
        const durationMins = Math.round((endTimestamp - startTimestamp) / 60);
        setMenuHidden(true);
        showModal({
            title: 'Recording Scheduled',
            message: `${channel.name} scheduled for ${durationMins} minutes`,
            type: 'success',
            confirmText: 'OK',
            onConfirm: () => onClose(),
            onCancel: () => onClose(),
        });
    }

    async function handleConfirmQuickRecord() {
        setScheduling(true);
        try {
            const now = new Date();
            const startTimestamp = Math.floor(now.getTime() / 1000);
            const endTimestamp = startTimestamp + (durationMinutes * 60);
            await createRecording(startTimestamp, endTimestamp, `${channel.name} - Quick Record`);
        } catch (error: any) {
            console.error('Failed to schedule recording:', error);
            setMenuHidden(true);
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

    async function handleConfirmCustomRecord() {
        setScheduling(true);
        try {
            const startDateTime = new Date(`${startDate}T${startTime}`);
            const endDateTime = new Date(`${endDate}T${endTime}`);

            if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
                setMenuHidden(true);
                showModal({
                    title: 'Invalid Input',
                    message: 'Invalid date/time selected',
                    type: 'error',
                    confirmText: 'OK',
                    onConfirm: () => onClose(),
                    onCancel: () => onClose(),
                });
                return;
            }
            if (endDateTime <= startDateTime) {
                setMenuHidden(true);
                showModal({
                    title: 'Invalid Input',
                    message: 'End time must be after start time',
                    type: 'error',
                    confirmText: 'OK',
                    onConfirm: () => onClose(),
                    onCancel: () => onClose(),
                });
                return;
            }

            const startTimestamp = Math.floor(startDateTime.getTime() / 1000);
            const endTimestamp = Math.floor(endDateTime.getTime() / 1000);
            await createRecording(startTimestamp, endTimestamp, `${channel.name} - Scheduled`);
        } catch (error: any) {
            console.error('Failed to schedule recording:', error);
            setMenuHidden(true);
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

    async function handleAddToGroup(groupId: string, groupName: string) {
        if (addingToGroup) return;
        setAddingToGroup(groupId);
        try {
            await addChannelsToGroup(groupId, [channel.stream_id]);
            setMenuHidden(true);
            showModal({
                title: 'Added to Group',
                message: `${channel.name} added to "${groupName}"`,
                type: 'success',
                confirmText: 'OK',
                onConfirm: () => onClose(),
                onCancel: () => onClose(),
            });
        } catch (e: any) {
            console.error('Failed to add channel to group:', e);
            setMenuHidden(true);
            showModal({
                title: 'Failed',
                message: e?.message || 'Could not add channel to group',
                type: 'error',
                confirmText: 'OK',
                onConfirm: () => onClose(),
                onCancel: () => onClose(),
            });
            setAddingToGroup(null);
        }
    }

    async function handleAddToFailoverGroup(groupId: string, groupName: string) {
        if (addingToFailoverGroup) return;
        setAddingToFailoverGroup(groupId);
        try {
            await addChannelToFailoverGroup(groupId, channel.stream_id);
            setMenuHidden(true);
            showModal({
                title: 'Added to Failover Group',
                message: `${channel.name} added to "${groupName}"`,
                type: 'success',
                confirmText: 'OK',
                onConfirm: () => onClose(),
                onCancel: () => onClose(),
            });
        } catch (e: any) {
            console.error('Failed to add channel to failover group:', e);
            setMenuHidden(true);
            showModal({
                title: 'Failed',
                message: e?.message || 'Could not add channel to failover group',
                type: 'error',
                confirmText: 'OK',
                onConfirm: () => onClose(),
                onCancel: () => onClose(),
            });
            setAddingToFailoverGroup(null);
        }
    }

    async function handleCreateAndAddToFailoverGroup() {
        const trimmed = newFailoverGroupName.trim();
        if (!trimmed) return;
        try {
            const newGroupId = await createFailoverGroup(trimmed);
            await addChannelToFailoverGroup(newGroupId, channel.stream_id);
            setMenuHidden(true);
            showModal({
                title: 'Created & Added',
                message: `Failover group "${trimmed}" created and ${channel.name} added`,
                type: 'success',
                confirmText: 'OK',
                onConfirm: () => onClose(),
                onCancel: () => onClose(),
            });
        } catch (e: any) {
            console.error('Failed to create failover group:', e);
            setMenuHidden(true);
            showModal({
                title: 'Failed',
                message: e?.message || 'Could not create failover group',
                type: 'error',
                confirmText: 'OK',
                onConfirm: () => onClose(),
                onCancel: () => onClose(),
            });
        }
    }

    async function handleHideChannel() {
        try {
            await db.channels.update(channel.stream_id, { enabled: false });
            setMenuHidden(true);
            showModal({
                title: 'Channel Hidden',
                message: `${channel.name} has been hidden`,
                type: 'success',
                confirmText: 'OK',
                onConfirm: () => onClose(),
                onCancel: () => onClose(),
            });
        } catch (e: any) {
            console.error('Failed to hide channel:', e);
            setMenuHidden(true);
            showModal({
                title: 'Failed',
                message: e?.message || 'Could not hide channel',
                type: 'error',
                confirmText: 'OK',
                onConfirm: () => onClose(),
                onCancel: () => onClose(),
            });
        }
    }

    function handleRenameChannel() {
        showPrompt(
            'Rename Channel',
            'Enter a new display name for this channel:',
            async (newName) => {
                const trimmed = newName.trim();
                if (trimmed && trimmed !== (channel.alias || channel.name)) {
                    try {
                        await updateChannelAlias(channel.stream_id, trimmed);
                        setMenuHidden(true);
                        showModal({
                            title: 'Channel Renamed',
                            message: `${channel.name} is now displayed as "${trimmed}"`,
                            type: 'success',
                            confirmText: 'OK',
                            onConfirm: () => onClose(),
                            onCancel: () => onClose(),
                        });
                        return;
                    } catch (e: any) {
                        console.error('Failed to rename channel:', e);
                        setMenuHidden(true);
                        showModal({
                            title: 'Failed',
                            message: e?.message || 'Could not rename channel',
                            type: 'error',
                            confirmText: 'OK',
                            onConfirm: () => onClose(),
                            onCancel: () => onClose(),
                        });
                        return;
                    }
                }
                onClose();
            },
            () => onClose(),
            'Channel name...',
            channel.alias || channel.name,
            'Rename',
            'Cancel',
            false
        );
    }

    const durationOptions = [5, 15, 30, 60, 90, 120, 180, 240];

    // ── ADD TO GROUP VIEW ──
    if (currentView === 'group') {
        return createPortal(
            <div
                ref={menuRef}
                className="program-context-menu"
                style={getMenuStyle({ minWidth: '200px' })}
            >
                <div className="context-menu-header">
                    Add to Group
                </div>
                <div className="context-menu-separator" />
                <div className="context-menu-scrollable-container">
                    {customGroups.length === 0 && (
                        <div style={{ padding: '10px 16px', opacity: 0.5, fontSize: '0.85rem' }}>
                            No custom groups yet
                        </div>
                    )}
                    {customGroups.map(group => (
                        <div
                            key={group.group_id}
                            className="context-menu-item"
                            onClick={() => handleAddToGroup(group.group_id, group.name)}
                            style={{ opacity: addingToGroup === group.group_id ? 0.5 : 1 }}
                        >
                            {group.name}
                        </div>
                    ))}
                </div>
                <div className="context-menu-separator" />
                <div className="context-menu-item context-menu-item-secondary" onClick={() => setCurrentView('main')}>
                    ← Back
                </div>
                <ModalComponent />
            </div>,
            document.body
        );
    }

    // ── ADD TO FAILOVER GROUP VIEW ──
    if (currentView === 'failover') {
        return createPortal(
            <div
                ref={menuRef}
                className="program-context-menu"
                style={getMenuStyle({ minWidth: '200px' })}
            >
                <div className="context-menu-header">
                    Add to Failover Group
                </div>
                <div className="context-menu-separator" />
                <div className="context-menu-scrollable-container">
                    {!creatingFailoverGroup ? (
                        <div
                            className="context-menu-item"
                            onClick={() => {
                                setCreatingFailoverGroup(true);
                                setTimeout(() => failoverNameInputRef.current?.focus(), 50);
                            }}
                        >
                            Create New Failover Group
                        </div>
                    ) : (
                        <div style={{ padding: '6px 12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input
                                ref={failoverNameInputRef}
                                type="text"
                                placeholder="Group name…"
                                value={newFailoverGroupName}
                                onChange={e => setNewFailoverGroupName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleCreateAndAddToFailoverGroup();
                                    if (e.key === 'Escape') {
                                        setCreatingFailoverGroup(false);
                                        setNewFailoverGroupName('');
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    padding: '5px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--accent-primary, #00d4ff)',
                                    background: 'rgba(0,0,0,0.3)',
                                    color: 'var(--text-primary, #fff)',
                                    fontSize: '0.85rem',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                }}
                            />
                            <button
                                onClick={handleCreateAndAddToFailoverGroup}
                                style={{
                                    padding: '5px 10px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: 'var(--accent-primary, #00d4ff)',
                                    color: '#000',
                                    fontWeight: 600,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                }}
                            >
                                Create
                            </button>
                            <button
                                onClick={() => { setCreatingFailoverGroup(false); setNewFailoverGroupName(''); }}
                                style={{
                                    padding: '5px 10px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    background: 'rgba(255,255,255,0.06)',
                                    color: 'rgba(255,255,255,0.7)',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                    <div className="context-menu-separator" />
                    {failoverGroups.length === 0 && !creatingFailoverGroup && (
                        <div style={{ padding: '10px 16px', opacity: 0.5, fontSize: '0.85rem' }}>
                            No failover groups yet
                        </div>
                    )}
                    {failoverGroups.map(group => (
                        <div
                            key={group.group_id}
                            className="context-menu-item"
                            onClick={() => handleAddToFailoverGroup(group.group_id, group.name)}
                            style={{ opacity: addingToFailoverGroup === group.group_id ? 0.5 : 1 }}
                        >
                            {group.name}
                        </div>
                    ))}
                </div>
                <div className="context-menu-separator" />
                <div className="context-menu-item context-menu-item-secondary" onClick={() => setCurrentView('main')}>
                    ← Back
                </div>
                <ModalComponent />
            </div>,
            document.body
        );
    }

    // ── QUICK RECORD VIEW ──
    if (currentView === 'quick') {
        return createPortal(
            <div
                ref={menuRef}
                className="program-context-menu"
                style={getMenuStyle({ minWidth: '200px' })}
            >
                <div className="context-menu-header">
                    Quick Record {channel.name}
                </div>
                <div className="context-menu-separator" />
                <div className="duration-options">
                    {durationOptions.map((mins) => (
                        <button
                            key={mins}
                            className={`duration-option ${durationMinutes === mins ? 'selected' : ''}`}
                            onClick={() => setDurationMinutes(mins)}
                        >
                            {mins < 60 ? `${mins} min` : `${mins / 60} hour${mins > 60 ? 's' : ''}`}
                        </button>
                    ))}
                </div>
                <div className="context-menu-separator" />
                <div className="context-menu-actions">
                    <button
                        className="context-menu-btn context-menu-btn-primary"
                        onClick={handleConfirmQuickRecord}
                        disabled={scheduling}
                    >
                        {scheduling ? 'Starting...' : `Record ${durationMinutes} min`}
                    </button>
                    <button className="context-menu-btn context-menu-btn-secondary" onClick={onClose} disabled={scheduling}>
                        Cancel
                    </button>
                </div>
                <ModalComponent />
            </div>,
            document.body
        );
    }

    // ── CUSTOM RECORD VIEW ──
    if (currentView === 'custom') {
        return createPortal(
            <div
                ref={menuRef}
                className="program-context-menu"
                style={getMenuStyle({ minWidth: '260px' })}
            >
                <div className="context-menu-header">Schedule Recording</div>
                <div className="context-menu-separator" />

                <div className="datetime-section">
                    <label className="datetime-label">Start</label>
                    <div className="datetime-inputs">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="datetime-input" />
                        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="datetime-input" />
                    </div>
                </div>

                <div className="datetime-section">
                    <label className="datetime-label">End</label>
                    <div className="datetime-inputs">
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="datetime-input" />
                        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="datetime-input" />
                    </div>
                </div>

                <div className="context-menu-separator" />
                <div className="context-menu-actions">
                    <button
                        className="context-menu-btn context-menu-btn-primary"
                        onClick={handleConfirmCustomRecord}
                        disabled={scheduling}
                    >
                        {scheduling ? 'Scheduling...' : 'Schedule'}
                    </button>
                    <button className="context-menu-btn context-menu-btn-secondary" onClick={onClose} disabled={scheduling}>
                        Cancel
                    </button>
                </div>
                <ModalComponent />
            </div>,
            document.body
        );
    }

    // ── MAIN MENU VIEW ──
    // Determine which secondary slots are available based on the current layout
    const viewerSlots: Array<2 | 3 | 4> = (() => {
        if (!onSendToSlot || !currentLayout || currentLayout === 'main') return [];
        if (currentLayout === 'pip' || currentLayout === 'sbs') return [2];
        return [2, 3, 4]; // 2x2 and bigbottom have 3 secondary slots
    })();

    const handleSendToSlot = async (slotId: 2 | 3 | 4) => {
        if (!onSendToSlot) return;
        let url = channel.direct_url ?? '';

        // Resolve the stream URL (crucial for Stalker channels)
        if (channel.source_id) {
            try {
                const { resolvePlayUrl } = await import('../services/stream-resolver');
                const resolved = await resolvePlayUrl(channel.source_id, url);
                url = resolved.url;
            } catch (e) {
                console.error('[ChannelContextMenu] Failed to resolve multiview URL:', e);
            }
        }

        // Look up source name
        let sourceName: string | null = null;
        if (channel.source_id && window.storage) {
            const result = await window.storage.getSource(channel.source_id);
            if (result.data) {
                sourceName = result.data.name;
            }
        }
        onSendToSlot(slotId, channel.name, url, sourceName);
        addToRecentChannels(channel);
        onClose();
    };

    // ── EPG Editor: render OUTSIDE the context menu portal.
    // The menu's mousedown-outside listener would otherwise fire on any modal
    // tab click (since the modal portal is outside menuRef) and close everything.
    if (showEpgEditor) {
        return (
            <EpgEditorModal
                channel={channel}
                onClose={() => { setShowEpgEditor(false); onClose(); }}
            />
        );
    }

    return createPortal(
        <div
            ref={menuRef}
            className="program-context-menu"
            style={getMenuStyle()}
        >
            {/* Send to Viewer - only shown when a multiview layout is active */}
            {viewerSlots.length > 0 && (
                <>
                    {viewerSlots.map(slotId => (
                        <div
                            key={slotId}
                            className="context-menu-item"
                            onClick={() => handleSendToSlot(slotId)}
                        >
                            Send to Viewer {slotId}
                        </div>
                    ))}
                    <div className="context-menu-separator" />
                </>
            )}
            {/* Play in Popout */}
            {onPlayInPopout && (
                <>
                    <div
                        className="context-menu-item"
                        onClick={() => {
                            onPlayInPopout(channel);
                            onClose();
                        }}
                    >
                        Play in Popout
                    </div>
                    <div className="context-menu-separator" />
                </>
            )}
            {onPlayInExternal && (
                <>
                    <div
                        className="context-menu-item"
                        onClick={() => {
                            onPlayInExternal(channel);
                            onClose();
                        }}
                    >
                        Send to External Player
                    </div>
                    <div className="context-menu-separator" />
                </>
            )}
            <div className="context-menu-item" onClick={() => setCurrentView('custom')}>
                Record...
            </div>
            <div className="context-menu-item" onClick={() => setCurrentView('quick')}>
                Quick Record
            </div>
            <div className="context-menu-separator" />
            <div className="context-menu-item" onClick={() => setCurrentView('group')}>
                Add to Group →
            </div>
            <div className="context-menu-item" onClick={() => setCurrentView('failover')}>
                Add to Failover Group →
            </div>
            <div className="context-menu-separator" />
            <div className="context-menu-item" onClick={handleCopyStreamUrl}>
                Copy Stream URL
            </div>
            <div className="context-menu-item" onClick={() => { setShowEpgEditor(true); }}>
                Edit EPG
            </div>
            <div className="context-menu-separator" />
            <div className="context-menu-item" onClick={handleRenameChannel}>
                Rename Channel
            </div>
            <div className="context-menu-separator" />
            <div className="context-menu-item" onClick={handleHideChannel}>
                Hide Channel
            </div>
            <div className="context-menu-separator" />
            <div className="context-menu-item context-menu-item-secondary" onClick={onClose}>
                Cancel
            </div>
            <ModalComponent />
        </div>,
        document.body
    );
}


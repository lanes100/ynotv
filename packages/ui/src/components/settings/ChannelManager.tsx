import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from '../../hooks/useSqliteLiveQuery';
import { db, type StoredChannel } from '../../db';
import { normalizeBoolean } from '../../utils/db-helpers';
import {
  listFailoverGroups,
  createFailoverGroup,
  addChannelToFailoverGroup,
  removeChannelFromFailoverGroup,
  getFailoverGroupForChannel,
} from '../../services/failover-groups';
import './ChannelManager.css';

interface ChannelManagerProps {
    categoryId: string;
    categoryName: string;
    sourceId: string;
    onClose: () => void;
    onChange?: () => void;
    sortOrder?: 'alphabetical' | 'number';
}


export function ChannelManager({ categoryId, categoryName, sourceId, onClose, onChange, sortOrder = 'number' }: ChannelManagerProps) {
    const [channels, setChannels] = useState<StoredChannel[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const [hideDisabled, setHideDisabled] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterWords, setFilterWords] = useState<string[]>([]);
    const [newFilterWord, setNewFilterWord] = useState('');
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const isSavingRef = useRef(false);

    // Failover context menu state
    const [failoverMenu, setFailoverMenu] = useState<{
      channel: StoredChannel;
      x: number;
      y: number;
    } | null>(null);
    const [failoverGroups, setFailoverGroups] = useState<Array<{ group_id: string; name: string }>>([]);
    const [failoverGroupForChannel, setFailoverGroupForChannel] = useState<{ groupId: string; groupName: string; priority: number } | null>(null);
    const [showFailoverCreate, setShowFailoverCreate] = useState(false);
    const [newFailoverGroupName, setNewFailoverGroupName] = useState('');

    // Container-level pointer drag for reorder (same pattern as CategoryManager)
    const dragFromIdx = useRef<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const openFailoverMenu = useCallback(async (channel: StoredChannel, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const MENU_WIDTH = 260;
      const MENU_HEIGHT_EST = 180;
      // Anchor to the button: align menu right edge with button right edge
      let x = rect.right - MENU_WIDTH;
      // Clamp so it doesn't go off the left or right of the viewport
      x = Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8));
      // Place below the button; if not enough room, place above
      let y = rect.bottom + 4;
      if (y + MENU_HEIGHT_EST > window.innerHeight - 8) {
        y = rect.top - MENU_HEIGHT_EST - 4;
      }
      y = Math.max(8, y);
      setFailoverMenu({ channel, x, y });
      setShowFailoverCreate(false);
      setNewFailoverGroupName('');
      try {
        const groups = await listFailoverGroups();
        setFailoverGroups(groups.map(g => ({ group_id: g.group_id, name: g.name })));
        const membership = await getFailoverGroupForChannel(channel.stream_id);
        setFailoverGroupForChannel(membership);
      } catch (err) {
        console.error('[ChannelManager] Failed to load failover data:', err);
      }
    }, []);

    const closeFailoverMenu = useCallback(() => {
      setFailoverMenu(null);
      setShowFailoverCreate(false);
      setNewFailoverGroupName('');
    }, []);

    const handleAddToFailoverGroup = useCallback(async (groupId: string) => {
      if (!failoverMenu) return;
      try {
        await addChannelToFailoverGroup(groupId, failoverMenu.channel.stream_id);
        const membership = await getFailoverGroupForChannel(failoverMenu.channel.stream_id);
        setFailoverGroupForChannel(membership);
        // Refresh groups to update counts
        const groups = await listFailoverGroups();
        setFailoverGroups(groups.map(g => ({ group_id: g.group_id, name: g.name })));
      } catch (err: any) {
        alert(err?.message || 'Failed to add channel to group');
      }
    }, [failoverMenu]);

    const handleRemoveFromFailoverGroup = useCallback(async () => {
      if (!failoverMenu) return;
      try {
        await removeChannelFromFailoverGroup(failoverMenu.channel.stream_id);
        setFailoverGroupForChannel(null);
        const groups = await listFailoverGroups();
        setFailoverGroups(groups.map(g => ({ group_id: g.group_id, name: g.name })));
      } catch (err) {
        console.error('[ChannelManager] Failed to remove from group:', err);
      }
    }, [failoverMenu]);

    const handleCreateFailoverGroup = useCallback(async () => {
      const name = newFailoverGroupName.trim();
      if (!name || !failoverMenu) return;
      try {
        const groupId = await createFailoverGroup(name);
        await addChannelToFailoverGroup(groupId, failoverMenu.channel.stream_id);
        const groups = await listFailoverGroups();
        setFailoverGroups(groups.map(g => ({ group_id: g.group_id, name: g.name })));
        const membership = await getFailoverGroupForChannel(failoverMenu.channel.stream_id);
        setFailoverGroupForChannel(membership);
        setShowFailoverCreate(false);
        setNewFailoverGroupName('');
      } catch (err: any) {
        alert(err?.message || 'Failed to create group');
      }
    }, [failoverMenu, newFailoverGroupName]);

    const getIndexFromClientY = (clientY: number): number => {
        if (!listRef.current) return 0;
        const children = Array.from(listRef.current.children) as HTMLElement[];
        for (let i = 0; i < children.length; i++) {
            const rect = children[i].getBoundingClientRect();
            if (clientY < rect.top + rect.height / 2) return i;
        }
        return Math.max(0, children.length - 1);
    };

    // Ensure font size CSS variable is set when modal opens
    useEffect(() => {
        async function applyFontSize() {
            if (window.storage) {
                const settings = await window.storage.getSettings();
                if (settings.data?.channelFontSize) {
                    document.documentElement.style.setProperty('--channel-font-size', `${settings.data.channelFontSize}px`);
                }
            }
        }
        applyFontSize();
    }, []);

    // Load channels for this source and filter by category
    const dbChannels = useLiveQuery(
        async () => {
            const allChannels = await db.channels.where('source_id').equals(sourceId).toArray();
            return allChannels.filter(ch => ch.category_ids?.includes(categoryId));
        }
    );

    // Load category data including filter words
    useEffect(() => {
        async function loadCategoryData() {
            const category = await db.categories.get(categoryId);
            if (category?.filter_words) {
                setFilterWords(category.filter_words);
            }
        }
        loadCategoryData();
    }, [categoryId]);

    // Initialize channels from database (but not while saving)
    useEffect(() => {
        if (dbChannels && !isSavingRef.current) {
            const sorted = [...dbChannels].sort((a, b) => {
                // If any channel has a manually saved display_order, use that
                if (a.display_order != null && b.display_order != null) return a.display_order - b.display_order;
                if (a.display_order != null) return -1;
                if (b.display_order != null) return 1;
                // Fall back to the sort order preference
                if (sortOrder === 'number') {
                    const numA = a.channel_num;
                    const numB = b.channel_num;
                    // Match EPG behavior from useChannels.ts
                    if (numA !== undefined && numB !== undefined) return numA - numB;
                    if (numA !== undefined) return -1; // a has number → comes first
                    if (numB !== undefined) return 1;  // b has number → comes first
                }

                return a.name.localeCompare(b.name);
            });
            const channelsWithEnabled = sorted.map((ch) => ({
                ...ch,
                enabled: ch.enabled !== false,
            }));
            setChannels(channelsWithEnabled);
            setIsDirty(false);
        }
    }, [dbChannels, sortOrder]);

    // Toggle enable/disable
    const toggleChannel = useCallback((channelId: string) => {
        setChannels(chs => chs.map(ch =>
            ch.stream_id === channelId ? { ...ch, enabled: !ch.enabled } : ch
        ));
        setIsDirty(true);
    }, []);

    // Pointer drag handlers — on container
    const handleHandlePointerDown = useCallback((e: React.PointerEvent, index: number) => {
        if (e.button !== 0) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragFromIdx.current = index;
        setDragOverIdx(index);
    }, []);

    const handleContainerPointerMove = useCallback((e: React.PointerEvent) => {
        if (dragFromIdx.current === null) return;
        e.preventDefault();
        setDragOverIdx(getIndexFromClientY(e.clientY));
    }, []);

    const handleContainerPointerUp = useCallback((e: React.PointerEvent) => {
        if (dragFromIdx.current === null) return;
        const from = dragFromIdx.current;
        const to = getIndexFromClientY(e.clientY);
        dragFromIdx.current = null;
        setDragOverIdx(null);
        if (from === to) return;
        setChannels(chs => {
            const visible = chs.filter((_, i) => !hideDisabled || chs[i].enabled !== false);
            // Remap: find actual indices in full array
            const fromStreamId = visible[from]?.stream_id;
            const toStreamId = visible[to]?.stream_id;
            if (!fromStreamId || !toStreamId) return chs;
            const fromActual = chs.findIndex(c => c.stream_id === fromStreamId);
            const toActual = chs.findIndex(c => c.stream_id === toStreamId);
            const next = [...chs];
            const [moved] = next.splice(fromActual, 1);
            next.splice(toActual, 0, moved);
            return next.map((ch, idx) => ({ ...ch, display_order: idx }));
        });
        setIsDirty(true);
    }, [hideDisabled]);

    const handleContainerPointerCancel = useCallback(() => {
        dragFromIdx.current = null;
        setDragOverIdx(null);
    }, []);

    // Select all
    const handleSelectAll = useCallback(() => {
        setChannels(chs => chs.map(ch => ({ ...ch, enabled: true })));
        setIsDirty(true);
    }, []);

    // Select none
    const handleSelectNone = useCallback(() => {
        setChannels(chs => chs.map(ch => ({ ...ch, enabled: false })));
        setIsDirty(true);
    }, []);

    // Helper function to apply filter words to a channel name
    const applyFilterWords = useCallback((name: string) => {
        let filteredName = name;
        filterWords.forEach(word => {
            if (word.trim()) {
                filteredName = filteredName.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
            }
        });
        return filteredName;
    }, [filterWords]);

    // Add a new filter word
    const handleAddFilterWord = useCallback(() => {
        if (newFilterWord.trim() && !filterWords.includes(newFilterWord.trim())) {
            setFilterWords(prev => [...prev, newFilterWord.trim()]);
            setNewFilterWord('');
            setIsDirty(true);
        }
    }, [newFilterWord, filterWords]);

    // Remove a filter word
    const handleRemoveFilterWord = useCallback((word: string) => {
        setFilterWords(prev => prev.filter(w => w !== word));
        setIsDirty(true);
    }, []);

    // Save changes
    const handleSave = useCallback(async () => {
        try {
            isSavingRef.current = true;

            // 1. Prepare items for SQLite bulkPut
            const channelsToUpdate: StoredChannel[] = channels.map((ch, i) => ({
                ...ch,
                enabled: ch.enabled !== false,
                is_favorite: ch.is_favorite ?? false,
                display_order: i,
            }));

            // 2. Perform fast bulk replacement natively
            if (channelsToUpdate.length > 0) {
                await db.channels.bulkPut(channelsToUpdate);
            }

            // 3. Perform atomic operation for category filter words
            await db.categories.update(categoryId, {
                filter_words: filterWords
            });

            await new Promise(resolve => setTimeout(resolve, 300));
            if (onChange) await onChange();
            onClose();
        } catch (err) {
            console.error('[ChannelManager] Failed to save:', err);
            alert('Failed to save changes. Please try again.');
        } finally {
            isSavingRef.current = false;
        }
    }, [channels, filterWords, categoryId, onChange, onClose]);

    // Get visible channels based on filter and search
    const visibleChannels = useMemo(() => {
        let filtered = channels;

        // Filter by enabled status
        if (hideDisabled) {
            filtered = filtered.filter(c => c.enabled !== false);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [channels, hideDisabled, searchQuery]);

    const enabledCount = channels.filter(c => c.enabled !== false).length;
    const totalCount = channels.length;

    const modalContent = (
        <div className="channel-manager-overlay" onClick={onClose}>
            <div className="channel-manager-modal" onClick={e => e.stopPropagation()}>
                <div className="channel-manager-header">
                    <h2>Manage Channels - {categoryName}</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="channel-manager-stats">
                    {enabledCount} of {totalCount} channels visible
                </div>

                <div className="channel-manager-actions">
                    <button onClick={handleSelectAll}>✓ Enable All</button>
                    <button onClick={handleSelectNone}>✗ Disable All</button>
                    <div className="divider-vertical"></div>
                    <button
                        onClick={() => setHideDisabled(!hideDisabled)}
                        className={hideDisabled ? 'active-toggle' : ''}
                    >
                        {hideDisabled ? '👁 Show All' : '👁‍🗨 Hide Disabled'}
                    </button>
                    <div className="divider-vertical"></div>
                    <button
                        onClick={() => setShowFilterPanel(!showFilterPanel)}
                        className={showFilterPanel ? 'active-toggle' : ''}
                    >
                        🔤 Filter Words
                    </button>
                </div>

                {/* Filter Words Panel */}
                {showFilterPanel && (
                    <div className="filter-words-panel">
                        <div className="filter-words-header">
                            <span>Filter words from channel names</span>
                            <span className="filter-words-hint">Example: "US | " removes prefix from "US | CNN"</span>
                        </div>
                        <div className="filter-words-input-row">
                            <input
                                type="text"
                                placeholder="Enter word to filter (e.g., US | )"
                                value={newFilterWord}
                                onChange={(e) => setNewFilterWord(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddFilterWord()}
                            />
                            <button onClick={handleAddFilterWord} className="filter-add-btn">Add</button>
                        </div>
                        <div className="filter-words-list">
                            {filterWords.length === 0 ? (
                                <span className="filter-words-empty">No filter words added</span>
                            ) : (
                                filterWords.map((word) => (
                                    <span key={word} className="filter-word-tag">
                                        "{word}"
                                        <button onClick={() => handleRemoveFilterWord(word)} className="filter-word-remove">✕</button>
                                    </span>
                                ))
                            )}
                        </div>
                    </div>
                )}

                <div className="channel-search">
                    <input
                        type="text"
                        placeholder="Search channels..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div
                    className="channel-list"
                    ref={listRef}
                    onPointerMove={handleContainerPointerMove}
                    onPointerUp={handleContainerPointerUp}
                    onPointerCancel={handleContainerPointerCancel}
                >
                    {visibleChannels.length === 0 ? (
                        <div className="channel-empty">
                            {searchQuery ? 'No channels match your search' : 'No channels in this category'}
                        </div>
                    ) : (
                        visibleChannels.map((ch, visibleIndex) => {
                            const filteredName = applyFilterWords(ch.name);
                            const isDragging = dragFromIdx.current === visibleIndex;
                            const isDragOver = dragOverIdx === visibleIndex && dragFromIdx.current !== null && dragFromIdx.current !== visibleIndex;
                            return (
                                <div
                                    key={ch.stream_id}
                                    className={`channel-item ${ch.enabled === false ? 'disabled' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                                >
                                    <span
                                        className="drag-handle"
                                        style={{ touchAction: 'none' }}
                                        onPointerDown={e => handleHandlePointerDown(e, visibleIndex)}
                                    >⋮⋮</span>
                                    <label className="channel-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={ch.enabled !== false}
                                            onChange={() => toggleChannel(ch.stream_id)}
                                        />
                                        <span className="channel-name">
                                            <span className="channel-display-name">{filteredName}</span>
                                            {filteredName !== ch.name && (
                                                <span className="channel-original-name" title={ch.name}>
                                                    ({ch.name})
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                    <button
                                        className="channel-failover-btn"
                                        onClick={e => openFailoverMenu(ch, e)}
                                        title="Add to failover group"
                                    >
                                        🔄
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Failover context menu */}
                {failoverMenu && (
                    <>
                        <div className="failover-menu-backdrop" onClick={closeFailoverMenu} />
                        <div
                            className="failover-menu-popover"
                            style={{ left: failoverMenu.x, top: failoverMenu.y }}
                        >
                            <div className="failover-menu-header">
                                <span className="failover-menu-title">{failoverMenu.channel.name}</span>
                                <button className="failover-menu-close" onClick={closeFailoverMenu}>✕</button>
                            </div>

                            {failoverGroupForChannel ? (
                                <div className="failover-menu-current">
                                    <span>In group: <strong>{failoverGroupForChannel.groupName}</strong></span>
                                    <span className="failover-menu-priority">
                                        {failoverGroupForChannel.priority === 0 ? 'Primary' : `Backup ${failoverGroupForChannel.priority}`}
                                    </span>
                                    <button
                                        className="failover-menu-remove"
                                        onClick={handleRemoveFromFailoverGroup}
                                    >
                                        Remove from group
                                    </button>
                                </div>
                            ) : (
                                <div className="failover-menu-section">
                                    <span className="failover-menu-label">Add to group</span>
                                    {failoverGroups.length === 0 ? (
                                        <div className="failover-menu-empty">No failover groups yet.</div>
                                    ) : (
                                        <div className="failover-menu-groups">
                                            {failoverGroups.map(g => (
                                                <button
                                                    key={g.group_id}
                                                    className="failover-menu-group-btn"
                                                    onClick={() => handleAddToFailoverGroup(g.group_id)}
                                                >
                                                    {g.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {!failoverGroupForChannel && (
                                <div className="failover-menu-section">
                                    {!showFailoverCreate ? (
                                        <button
                                            className="failover-menu-create-btn"
                                            onClick={() => setShowFailoverCreate(true)}
                                        >
                                            + Create new group
                                        </button>
                                    ) : (
                                        <div className="failover-menu-create-form">
                                            <input
                                                type="text"
                                                placeholder="Group name"
                                                value={newFailoverGroupName}
                                                onChange={e => setNewFailoverGroupName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleCreateFailoverGroup()}
                                                autoFocus
                                            />
                                            <button
                                                onClick={handleCreateFailoverGroup}
                                                disabled={!newFailoverGroupName.trim()}
                                            >
                                                Create
                                            </button>
                                            <button
                                                className="cancel-btn"
                                                onClick={() => { setShowFailoverCreate(false); setNewFailoverGroupName(''); }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                <div className="channel-manager-footer">
                    <button className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button
                        className="save-btn"
                        onClick={handleSave}
                        disabled={!isDirty}
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

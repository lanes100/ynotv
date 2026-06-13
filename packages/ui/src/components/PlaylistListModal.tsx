import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLiveQuery } from '../hooks/useSqliteLiveQuery';
import { db, type CustomPlaylist } from '../db';
import {
  createPlaylist,
  deletePlaylist,
  renamePlaylist,
  reorderPlaylists,
  revertRealSourceToDefault,
} from '../services/playlist-editor';
import { PlaylistEditorModal } from './PlaylistEditorModal';
import './PlaylistListModal.css';

interface PlaylistListModalProps {
  onClose: () => void;
}

export function PlaylistListModal({ onClose }: PlaylistListModalProps) {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingPlaylist, setEditingPlaylist] = useState<{ id: string; name: string } | null>(null);

  const newNameInputRef = useRef<HTMLInputElement>(null);
  const editNameInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Drag state
  const dragFromIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Live Query custom playlists
  const playlists = useLiveQuery<CustomPlaylist[]>(
    () => db.customPlaylists.orderBy('display_order').toArray(),
    [],
    []
  ) || [];

  // Live query count of category links per playlist
  const categoryLinkCounts = useLiveQuery(
    async () => {
      const all = await db.playlistCategoryLinks.toArray();
      const counts = new Map<string, number>();
      for (const item of all) {
        counts.set(item.playlist_id, (counts.get(item.playlist_id) || 0) + 1);
      }
      return counts;
    },
    [],
    new Map<string, number>()
  );

  // Live query count of individual channels per playlist
  const individualCounts = useLiveQuery(
    async () => {
      const all = await db.playlistIndividualChannels.toArray();
      const counts = new Map<string, number>();
      for (const item of all) {
        counts.set(item.playlist_id, (counts.get(item.playlist_id) || 0) + 1);
      }
      return counts;
    },
    [],
    new Map<string, number>()
  );

  // Load enabled real sources
  const [realSources, setRealSources] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (window.storage) {
      window.storage.getSources().then(res => {
        if (res.success && res.data) {
          setRealSources(res.data.filter(s => s.enabled !== false).map(s => ({ id: s.id, name: s.name })));
        }
      });
    }
  }, []);

  // Load unified sidebar order preference
  const sidebarOrderPref = useLiveQuery(
    () => db.prefs.get('sidebar_sources_order'),
    []
  );

  const sidebarSourcesOrder = useMemo(() => {
    if (!sidebarOrderPref?.value) return null;
    try {
      return JSON.parse(sidebarOrderPref.value) as string[];
    } catch {
      return null;
    }
  }, [sidebarOrderPref]);

  interface ManagerItem {
    id: string; // real source ID or 'playlist:uuid'
    type: 'real' | 'playlist';
    name: string;
    playlistId?: string; // original UUID if playlist
  }

  // Combine real sources and custom playlists
  const combinedItems = useMemo(() => {
    const list: ManagerItem[] = [];
    
    // Add real sources
    for (const src of realSources) {
      list.push({
        id: src.id,
        type: 'real',
        name: src.name
      });
    }
    
    // Add custom playlists
    for (const playlist of playlists) {
      list.push({
        id: `playlist:${playlist.playlist_id}`,
        type: 'playlist',
        name: playlist.name,
        playlistId: playlist.playlist_id
      });
    }
    
    // Sort according to sidebarSourcesOrder if it exists
    if (sidebarSourcesOrder) {
      const orderMap = new Map<string, number>(
        sidebarSourcesOrder.map((id: string, index: number) => [id, index] as [string, number])
      );
      list.sort((a, b) => {
        const orderA = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
        const orderB = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
    }
    
    return list;
  }, [realSources, playlists, sidebarSourcesOrder]);

  // Manage loading state
  useEffect(() => {
    if (playlists) {
      setLoading(false);
    }
  }, [playlists]);

  useEffect(() => {
    if (creating) {
      setTimeout(() => newNameInputRef.current?.focus(), 50);
    }
  }, [creating]);

  useEffect(() => {
    if (editingId) {
      setTimeout(() => editNameInputRef.current?.select(), 50);
    }
  }, [editingId]);

  // Drag index calculation
  const getIndexFromClientY = (clientY: number): number => {
    if (!listRef.current) return 0;
    const children = Array.from(listRef.current.children) as HTMLElement[];
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return Math.max(0, children.length - 1);
  };

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

  const handleContainerPointerUp = useCallback(async (e: React.PointerEvent) => {
    if (dragFromIdx.current === null) return;
    const from = dragFromIdx.current;
    const to = getIndexFromClientY(e.clientY);
    dragFromIdx.current = null;
    setDragOverIdx(null);
    if (from === to) return;

    const next = [...combinedItems];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    const orderedIds = next.map(item => item.id);
    try {
      // 1. Save unified sidebar order preference
      await db.prefs.put({
        key: 'sidebar_sources_order',
        value: JSON.stringify(orderedIds)
      });
      
      // 2. Keep customPlaylists display_order sync'd for compatibility
      const playlistsOnly = next.filter(item => item.type === 'playlist');
      for (let i = 0; i < playlistsOnly.length; i++) {
        const plId = playlistsOnly[i].playlistId!;
        await db.customPlaylists.update(plId, { display_order: i });
      }
    } catch (err) {
      console.error('Failed to save sidebar source order:', err);
    }
  }, [combinedItems]);

  const handleContainerPointerCancel = useCallback(() => {
    dragFromIdx.current = null;
    setDragOverIdx(null);
  }, []);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const id = await createPlaylist(trimmed);
      setNewName('');
      setCreating(false);
      setEditingPlaylist({ id, name: trimmed });
    } catch (e) {
      console.error('Failed to create playlist:', e);
    }
  };

  const handleDelete = async (playlistId: string) => {
    try {
      await deletePlaylist(playlistId);
      setDeleteConfirmId(null);
    } catch (e) {
      console.error('Failed to delete playlist:', e);
    }
  };

  const handleRevert = async (sourceId: string, sourceName: string) => {
    const confirm = window.confirm(
      `Are you sure you want to revert "${sourceName}" to its default state? This will remove all custom-added categories/channels and reset category ordering.`
    );
    if (!confirm) return;
    try {
      await revertRealSourceToDefault(sourceId);
    } catch (e) {
      console.error('Failed to revert source to default:', e);
      alert('Failed to revert: ' + String(e));
    }
  };

  const startEdit = (playlist: CustomPlaylist) => {
    setEditingId(playlist.playlist_id);
    setEditName(playlist.name);
  };

  const commitEdit = async () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (trimmed) {
      try {
        await renamePlaylist(editingId, trimmed);
      } catch (e) {
        console.error('Failed to rename playlist:', e);
      }
    }
    setEditingId(null);
  };

  const handleExport = async (playlist: CustomPlaylist) => {
    try {
      const { generateM3uForPlaylist } = await import('../services/playlist-export');
      const content = await generateM3uForPlaylist(playlist.playlist_id);
      const result = await window.storage.saveM3UFile(content, playlist.name);
      if (result.success) {
        alert('Playlist exported successfully!');
      }
    } catch (e) {
      console.error('Failed to export playlist:', e);
      alert('Export failed: ' + String(e));
    }
  };

  const handleEditKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditingId(null);
  };

  const handleNewNameKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') {
      setCreating(false);
      setNewName('');
    }
  };

  return (
    <>
      <div className="playlist-list-overlay" onClick={onClose}>
        <div className="playlist-list-modal" onClick={e => e.stopPropagation()}>
          <div className="playlist-list-header">
            <h2>📋 Custom Playlists</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="playlist-list-content">
            <div className="playlist-list-toolbar">
              {!creating ? (
                <button className="pll-create-btn" onClick={() => setCreating(true)}>
                  <span>＋</span> Create New Playlist
                </button>
              ) : (
                <div className="pll-create-row">
                  <input
                    ref={newNameInputRef}
                    className="pll-create-input"
                    placeholder="Playlist name…"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={handleNewNameKey}
                    onBlur={() => {
                      if (!newName.trim()) {
                        setCreating(false);
                      }
                    }}
                  />
                  <button className="pll-create-ok" onClick={handleCreate}>Create</button>
                  <button className="pll-create-cancel" onClick={() => { setCreating(false); setNewName(''); }}>Cancel</button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="pll-empty">Loading…</div>
            ) : combinedItems.length === 0 ? (
              <div className="pll-empty">
                <p>No custom playlists or media sources found.</p>
              </div>
            ) : (
              <div
                className="pll-list"
                ref={listRef}
                onPointerMove={handleContainerPointerMove}
                onPointerUp={handleContainerPointerUp}
                onPointerCancel={handleContainerPointerCancel}
              >
                {combinedItems.map((item: ManagerItem, index: number) => {
                  const isDragging = dragFromIdx.current === index;
                  const isDragOver = dragOverIdx === index && dragFromIdx.current !== null && dragFromIdx.current !== index;
                  
                  if (item.type === 'real') {
                    const catCount = categoryLinkCounts?.get(item.id) || 0;
                    const indivCount = individualCounts?.get(item.id) || 0;
                    return (
                      <div
                        key={item.id}
                        className={`pll-item pll-real-source-item${isDragging ? ' dragging' : ''}${isDragOver ? ' drag-over' : ''}`}
                      >
                        <div className="pll-item-main">
                          <span
                            className="pll-drag-handle"
                            style={{ touchAction: 'none' }}
                            onPointerDown={e => handleHandlePointerDown(e, index)}
                          >⋮⋮</span>
                          
                          <div className="pll-item-info readonly">
                            <span className="pll-item-name">{item.name}</span>
                            <span className="pll-item-count source-type-badge">
                              {catCount > 0 || indivCount > 0 ? (
                                <span className="pll-custom-additions-badge">
                                  +{catCount} category links · +{indivCount} individual channels
                                </span>
                              ) : (
                                "Media Source"
                              )}
                            </span>
                          </div>
                          
                          <div className="pll-item-actions">
                            <button
                              className="pll-action-btn"
                              onClick={() => setEditingPlaylist({ id: item.id, name: item.name })}
                              title="Edit Contents"
                            >
                              ✏️ Content
                            </button>
                            <button
                              className="pll-action-btn pll-danger"
                              onClick={() => handleRevert(item.id, item.name)}
                              title="Revert to Default"
                            >
                              🔄 Revert
                            </button>
                            <span className="pll-readonly-label">Manage in Settings</span>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    const plId = item.playlistId!;
                    const catCount = categoryLinkCounts?.get(plId) || 0;
                    const indivCount = individualCounts?.get(plId) || 0;
                    const playlist = playlists.find(p => p.playlist_id === plId);
                    
                    if (!playlist) return null;

                    return (
                      <div
                        key={plId}
                        className={`pll-item${isDragging ? ' dragging' : ''}${isDragOver ? ' drag-over' : ''}`}
                      >
                        {editingId === plId ? (
                          <div className="pll-edit-row">
                            <input
                              ref={editNameInputRef}
                              className="pll-edit-input"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              onKeyDown={handleEditKey}
                              onBlur={commitEdit}
                            />
                            <button className="pll-edit-ok" onClick={commitEdit}>✓</button>
                          </div>
                        ) : (
                          <div className="pll-item-main">
                            <span
                              className="pll-drag-handle"
                              style={{ touchAction: 'none' }}
                              onPointerDown={e => handleHandlePointerDown(e, index)}
                            >⋮⋮</span>
                            
                            <div className="pll-item-info" onClick={() => setEditingPlaylist({ id: plId, name: playlist.name })}>
                              <span className="pll-item-name">{playlist.name}</span>
                              <span className="pll-item-count">
                                {catCount} category links · {indivCount} individual channels
                              </span>
                            </div>

                            <div className="pll-item-actions">
                              <button className="pll-action-btn" onClick={() => setEditingPlaylist({ id: plId, name: playlist.name })} title="Edit Contents">✏️ Content</button>
                              <button className="pll-action-btn" onClick={() => startEdit(playlist)} title="Rename">📝 Rename</button>
                              <button className="pll-action-btn" onClick={() => handleExport(playlist)} title="Export .m3u">📤 Export</button>
                              {deleteConfirmId === plId ? (
                                <>
                                  <button className="pll-action-btn pll-confirm" onClick={() => handleDelete(plId)} title="Confirm delete">✓</button>
                                  <button className="pll-action-btn" onClick={() => setDeleteConfirmId(null)} title="Cancel">✕</button>
                                </>
                              ) : (
                                <button className="pll-action-btn pll-danger" onClick={() => setDeleteConfirmId(plId)} title="Delete">🗑️</button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </div>

          <div className="playlist-list-footer">
            <span className="pll-footer-hint">Drag ⋮⋮ to reorder sidebar · Click playlist to edit contents</span>
            <button className="close-done-btn" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>

      {editingPlaylist && (
        <PlaylistEditorModal
          playlistId={editingPlaylist.id}
          playlistName={editingPlaylist.name}
          onClose={() => setEditingPlaylist(null)}
        />
      )}
    </>
  );
}

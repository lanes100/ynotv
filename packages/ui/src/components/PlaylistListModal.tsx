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
import { useModal } from './Modal';
import './PlaylistListModal.css';

const PlaylistIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2zm0 8H7v-2h10v2z"/>
  </svg>
);

const PlusIcon = ({ size = 14 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>
);

const EditIcon = ({ size = 12 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
  </svg>
);

const RevertIcon = ({ size = 12 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
    <path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6 0 2.97-2.17 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-8.22 0-4.42-3.58-8-8-8zm-6 8c0-2.97 2.17-5.43 5-5.91V5.07c-3.95.49-7 3.85-7 8.22 0 4.42 3.58 8 8 8v-3c-3.31 0-6-2.69-6-6z"/>
  </svg>
);

const RenameIcon = ({ size = 12 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
    <path d="M3 10h11v2H3zm0-4h11v2H3zm0 8h7v2H3zm12.01-1.89l.71-.71a.996.996 0 0 1 1.41 0l.71.71c.39.39.39 1.02 0 1.41l-.71.71-2.12-2.12zm-.71.71L9 14.25V17h2.75l5.37-5.37-2.13-2.12z"/>
  </svg>
);

const ExportIcon = ({ size = 12 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
    <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6-4.67V17h-2V7.33L8.41 9.92 7 8.5l5-5 5 5-1.41 1.42L13 7.33z"/>
  </svg>
);

const TrashIcon = ({ size = 14 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
  </svg>
);

interface PlaylistListModalProps {
  onClose: () => void;
}

export function PlaylistListModal({ onClose }: PlaylistListModalProps) {
  const { showConfirm, showSuccess, showError, ModalComponent } = useModal();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingPlaylist, setEditingPlaylist] = useState<{ id: string; name: string } | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);

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
  const [realSources, setRealSources] = useState<Array<{ id: string; name: string; type: string }>>([]);
  useEffect(() => {
    if (window.storage) {
      window.storage.getSources().then(res => {
        if (res.success && res.data) {
          setRealSources(res.data.filter(s => s.enabled !== false).map(s => ({ id: s.id, name: s.name, type: s.type })));
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
    sourceType?: string;
  }

  // Combine real sources and custom playlists
  const combinedItems = useMemo(() => {
    const list: ManagerItem[] = [];
    
    // Add real sources
    for (const src of realSources) {
      list.push({
        id: src.id,
        type: 'real',
        name: src.name,
        sourceType: src.type
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

  const handleRevert = (sourceId: string, sourceName: string) => {
    showConfirm(
      'Revert Source to Default',
      `Are you sure you want to revert "${sourceName}" to its default state? This will remove all custom-added categories/channels and reset category ordering.`,
      async () => {
        setRevertingId(sourceId);
        try {
          await revertRealSourceToDefault(sourceId);

          // Trigger sync to restore default provider ordering
          if (window.storage) {
            const res = await window.storage.getSources();
            if (res.success && res.data) {
              const source = res.data.find(s => s.id === sourceId);
              if (source) {
                const { syncSource } = await import('../db/sync');
                await syncSource(source);
              }
            }
          }

          showSuccess('Revert Source', `Successfully reverted "${sourceName}" to default.`);
        } catch (e) {
          console.error('Failed to revert source to default:', e);
          showError('Revert Source', 'Failed to revert: ' + String(e));
        } finally {
          setRevertingId(null);
        }
      }
    );
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

  const handleExport = async (id: string, name: string) => {
    try {
      const { generateM3uForPlaylist } = await import('../services/playlist-export');
      const content = await generateM3uForPlaylist(id);
      const result = await window.storage.saveM3UFile(content, name);
      if (result.success) {
        showSuccess('Export Playlist', 'Playlist exported successfully!');
      }
    } catch (e) {
      console.error('Failed to export playlist:', e);
      showError('Export Playlist', 'Export failed: ' + String(e));
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
            <h2><PlaylistIcon size={18} />Custom Playlists</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="playlist-list-content">
            <div className="playlist-list-toolbar">
              {!creating ? (
                <button className="pll-create-btn" onClick={() => setCreating(true)}>
                  <PlusIcon size={12} /> Create New Playlist
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
                              <EditIcon size={12} />Content
                            </button>
                            <button
                              className="pll-action-btn pll-danger"
                              onClick={() => handleRevert(item.id, item.name)}
                              title="Revert to Default"
                              disabled={revertingId !== null}
                            >
                              <RevertIcon size={12} />
                              {revertingId === item.id ? 'Reverting...' : 'Revert'}
                            </button>
                            {item.sourceType !== 'stalker' && (
                              <button
                                className="pll-action-btn"
                                onClick={() => handleExport(item.id, item.name)}
                                title="Export .m3u"
                              >
                                <ExportIcon size={12} />Export
                              </button>
                            )}
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
                              <button className="pll-action-btn" onClick={() => setEditingPlaylist({ id: plId, name: playlist.name })} title="Edit Contents"><EditIcon size={12} />Content</button>
                              <button className="pll-action-btn" onClick={() => startEdit(playlist)} title="Rename"><RenameIcon size={12} />Rename</button>
                              <button className="pll-action-btn" onClick={() => handleExport(playlist.playlist_id, playlist.name)} title="Export .m3u"><ExportIcon size={12} />Export</button>
                              {deleteConfirmId === plId ? (
                                <>
                                  <button className="pll-action-btn pll-confirm" onClick={() => handleDelete(plId)} title="Confirm delete">✓</button>
                                  <button className="pll-action-btn" onClick={() => setDeleteConfirmId(null)} title="Cancel">✕</button>
                                </>
                              ) : (
                                <button className="pll-action-btn pll-danger" onClick={() => setDeleteConfirmId(plId)} title="Delete"><TrashIcon size={14} /></button>
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
      <ModalComponent />
    </>
  );
}

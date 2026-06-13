import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from '../hooks/useSqliteLiveQuery';
import { db, type CustomPlaylist } from '../db';
import {
  createPlaylist,
  deletePlaylist,
  renamePlaylist,
  reorderPlaylists,
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
    if (from === to || !playlists) return;

    const next = [...playlists];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    try {
      await reorderPlaylists(next.map(p => p.playlist_id));
    } catch (err) {
      console.error('Failed to save playlist order:', err);
    }
  }, [playlists]);

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
            ) : playlists.length === 0 ? (
              <div className="pll-empty">
                <p>No custom playlists yet.</p>
                <p className="pll-hint">Create a playlist to group categories and channels into a custom sidebar source.</p>
              </div>
            ) : (
              <div
                className="pll-list"
                ref={listRef}
                onPointerMove={handleContainerPointerMove}
                onPointerUp={handleContainerPointerUp}
                onPointerCancel={handleContainerPointerCancel}
              >
                {playlists.map((playlist, index) => {
                  const catCount = categoryLinkCounts?.get(playlist.playlist_id) || 0;
                  const indivCount = individualCounts?.get(playlist.playlist_id) || 0;
                  const isDragging = dragFromIdx.current === index;
                  const isDragOver = dragOverIdx === index && dragFromIdx.current !== null && dragFromIdx.current !== index;

                  return (
                    <div
                      key={playlist.playlist_id}
                      className={`pll-item${isDragging ? ' dragging' : ''}${isDragOver ? ' drag-over' : ''}`}
                    >
                      {editingId === playlist.playlist_id ? (
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
                          
                          <div className="pll-item-info" onClick={() => setEditingPlaylist({ id: playlist.playlist_id, name: playlist.name })}>
                            <span className="pll-item-name">{playlist.name}</span>
                            <span className="pll-item-count">
                              {catCount} category links · {indivCount} individual channels
                            </span>
                          </div>

                          <div className="pll-item-actions">
                            <button className="pll-action-btn" onClick={() => setEditingPlaylist({ id: playlist.playlist_id, name: playlist.name })} title="Edit Contents">✏️ Content</button>
                            <button className="pll-action-btn" onClick={() => startEdit(playlist)} title="Rename">📝 Rename</button>
                            <button className="pll-action-btn" onClick={() => handleExport(playlist)} title="Export .m3u">📤 Export</button>
                            {deleteConfirmId === playlist.playlist_id ? (
                              <>
                                <button className="pll-action-btn pll-confirm" onClick={() => handleDelete(playlist.playlist_id)} title="Confirm delete">✓</button>
                                <button className="pll-action-btn" onClick={() => setDeleteConfirmId(null)} title="Cancel">✕</button>
                              </>
                            ) : (
                              <button className="pll-action-btn pll-danger" onClick={() => setDeleteConfirmId(playlist.playlist_id)} title="Delete">🗑️</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
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

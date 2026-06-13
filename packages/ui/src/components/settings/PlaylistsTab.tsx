import React, { useState } from 'react';
import { useLiveQuery } from '../../hooks/useSqliteLiveQuery';
import { db, type CustomPlaylist } from '../../db';
import {
  createPlaylist,
  deletePlaylist,
  renamePlaylist,
} from '../../services/playlist-editor';
import { PlaylistEditorModal } from '../PlaylistEditorModal';
import { useModal } from '../Modal';

export function PlaylistsTab() {
  const { showPrompt, showConfirm, ModalComponent } = useModal();
  const [editingPlaylist, setEditingPlaylist] = useState<{ id: string; name: string } | null>(null);

  // Live Query playlists
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

  const handleCreate = () => {
    showPrompt(
      'Create Custom Playlist',
      'Enter a name for the new playlist:',
      async (name) => {
        if (name.trim()) {
          const id = await createPlaylist(name.trim());
          setEditingPlaylist({ id, name: name.trim() });
        }
      },
      undefined,
      'Playlist name...',
      '',
      'Create',
      'Cancel'
    );
  };

  const handleRename = (playlist: CustomPlaylist) => {
    showPrompt(
      'Rename Playlist',
      'Enter a new name:',
      async (newName) => {
        if (newName.trim() && newName.trim() !== playlist.name) {
          await renamePlaylist(playlist.playlist_id, newName.trim());
        }
      },
      undefined,
      'Playlist name...',
      playlist.name,
      'Rename',
      'Cancel'
    );
  };

  const handleDelete = (playlistId: string) => {
    showConfirm(
      'Delete Playlist',
      'Are you sure you want to delete this custom playlist? This cannot be undone.',
      async () => {
        await deletePlaylist(playlistId);
      }
    );
  };

  const handleExport = async (playlist: CustomPlaylist) => {
    try {
      const { generateM3uForPlaylist } = await import('../../services/playlist-export');
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

  return (
    <div style={{ padding: '20px 24px', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Custom Playlists</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #aaa)' }}>
            Group categories and channels from different sources into single custom playlists.
          </p>
        </div>
        <button
          onClick={handleCreate}
          style={{
            padding: '8px 16px',
            background: 'var(--accent-primary, #00d4ff)',
            color: '#000',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ＋ New Playlist
        </button>
      </div>

      {playlists.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: 'var(--text-secondary, #aaa)' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}>📋</span>
          <h4 style={{ margin: '0 0 6px 0', color: '#fff' }}>No Playlists Yet</h4>
          <p style={{ margin: 0, fontSize: '0.8rem' }}>Create a custom playlist to start adding categories and channels.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-secondary, #aaa)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Playlist Name</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Linked Categories</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Individual Channels</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Created Date</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {playlists.map(playlist => {
                const catCount = categoryLinkCounts?.get(playlist.playlist_id) || 0;
                const indivCount = individualCounts?.get(playlist.playlist_id) || 0;
                const dateStr = new Date(playlist.created_at).toLocaleDateString();

                return (
                  <tr key={playlist.playlist_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{playlist.name}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary, #aaa)' }}>{catCount} categories</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary, #aaa)' }}>{indivCount} channels</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary, #aaa)' }}>{dateStr}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditingPlaylist({ id: playlist.playlist_id, name: playlist.name })}
                          style={{ padding: '5px 10px', background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          ✏️ Edit Contents
                        </button>
                        <button
                          onClick={() => handleRename(playlist)}
                          style={{ padding: '5px 10px', background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          📝 Rename
                        </button>
                        <button
                          onClick={() => handleExport(playlist)}
                          style={{ padding: '5px 10px', background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          📤 Export .m3u
                        </button>
                        <button
                          onClick={() => handleDelete(playlist.playlist_id)}
                          style={{ padding: '5px 10px', background: 'rgba(255, 75, 75, 0.1)', color: '#ff4b4b', border: '1px solid rgba(255, 75, 75, 0.15)', borderRadius: '4px', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ModalComponent />

      {editingPlaylist && (
        <PlaylistEditorModal
          playlistId={editingPlaylist.id}
          playlistName={editingPlaylist.name}
          onClose={() => setEditingPlaylist(null)}
        />
      )}
    </div>
  );
}

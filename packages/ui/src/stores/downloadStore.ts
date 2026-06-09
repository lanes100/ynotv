import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

export interface DownloadItem {
  id: string;
  title: string;
  url: string;
  savePath: string;
  status: 'downloading' | 'queued' | 'completed' | 'failed' | 'canceled';
  progress: number;
  bytesWritten: number;
  totalBytes: number | null;
  speedBytes: number;
  error?: string;
  addedAt: number;
  userAgent?: string;
  durationSecs?: number;
}

interface DownloadState {
  downloads: DownloadItem[];
  startDownload: (
    title: string,
    url: string,
    userAgent?: string,
    durationSecs?: number,
    preResolvedSavePath?: string
  ) => Promise<void>;
  cancelDownload: (id: string) => Promise<void>;
  removeDownload: (id: string) => void;
  clearCompleted: () => void;
  processQueue: () => Promise<void>;
  updateDownloadProgress: (payload: {
    id: string;
    title: string;
    status: 'downloading' | 'completed' | 'failed' | 'canceled';
    progress: number;
    bytes_written: number;
    total_bytes: number | null;
    speed_bytes: number;
    file_path: string;
    error: string | null;
  }) => void;
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set, get) => ({
      downloads: [],

      startDownload: async (title, url, userAgent, durationSecs, preResolvedSavePath) => {
        try {
          // 1. Resolve save path
          let savePath = '';
          if (preResolvedSavePath) {
            savePath = preResolvedSavePath;
          } else {
            let downloadsPath = '';
            if (window.storage) {
              const settingsRes = await window.storage.getSettings();
              if (settingsRes.data?.downloadsPath) {
                downloadsPath = settingsRes.data.downloadsPath;
              }
            }

            const isHls = url.includes('.m3u8') || url.includes('/mono.m3u8');
            const ext = isHls ? 'ts' : 'mp4';
            const sanitizedTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);

            if (downloadsPath) {
              const separator = downloadsPath.includes('\\') ? '\\' : '/';
              savePath = `${downloadsPath}${downloadsPath.endsWith(separator) ? '' : separator}${sanitizedTitle}.${ext}`;
            } else {
              // Prompt save dialog
              const selected = await save({
                defaultPath: `${sanitizedTitle}.${ext}`,
                filters: [{ name: 'Video', extensions: ['mp4', 'mkv', 'ts'] }]
              });
              if (!selected) return; // Canceled
              savePath = selected;
            }
          }

          // 2. Generate unique ID
          const id = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          // 3. Determine status: queue it if there is already a download in progress
          const active = (get().downloads || []).some((d) => d.status === 'downloading');
          const status = active ? 'queued' : 'downloading';

          const newItem: DownloadItem = {
            id,
            title,
            url,
            savePath,
            status,
            progress: 0,
            bytesWritten: 0,
            totalBytes: null,
            speedBytes: 0,
            addedAt: Date.now(),
            userAgent,
            durationSecs,
          };

          set((state) => ({ downloads: [newItem, ...(state.downloads || [])] }));

          // 4. If no active download is running, invoke Rust backend immediately
          if (!active) {
            await invoke('download_media', {
              request: {
                id,
                title,
                url,
                save_path: savePath,
                user_agent: userAgent || null,
                duration_secs: durationSecs || null,
              }
            });
          }
        } catch (error: any) {
          console.error('[DownloadStore] Failed to start download:', error);
          alert(`Failed to start download: ${error?.message || error}`);
        }
      },

      cancelDownload: async (id) => {
        try {
          const list = get().downloads || [];
          const item = list.find((d) => d.id === id);
          if (!item) return;

          if (item.status === 'queued') {
            // Cancel directly in frontend and process queue
            set((state) => ({
              downloads: (state.downloads || []).map((d) =>
                d.id === id ? { ...d, status: 'canceled' as const } : d
              ),
            }));
            get().processQueue();
          } else {
            await invoke('cancel_download', { id });
          }
        } catch (error) {
          console.error('[DownloadStore] Failed to cancel download:', error);
        }
      },

      removeDownload: (id) => {
        set((state) => ({
          downloads: (state.downloads || []).filter((d) => d.id !== id),
        }));
      },

      clearCompleted: () => {
        set((state) => ({
          downloads: (state.downloads || []).filter(
            (d) => d.status === 'downloading' || d.status === 'queued'
          ),
        }));
      },

      processQueue: async () => {
        const list = get().downloads || [];
        // Check if there is an active downloading item
        const hasActive = list.some((d) => d.status === 'downloading');
        if (hasActive) return;

        // Find the oldest queued item (at the end of the list since we prepend new items)
        const nextItem = [...list]
          .reverse()
          .find((d) => d.status === 'queued');

        if (nextItem) {
          set((state) => ({
            downloads: (state.downloads || []).map((d) =>
              d.id === nextItem.id ? { ...d, status: 'downloading' as const } : d
            ),
          }));

          try {
            await invoke('download_media', {
              request: {
                id: nextItem.id,
                title: nextItem.title,
                url: nextItem.url,
                save_path: nextItem.savePath,
                user_agent: nextItem.userAgent || null,
                duration_secs: nextItem.durationSecs || null,
              }
            });
          } catch (error: any) {
            console.error('[DownloadStore] Failed to start queued download:', error);
            set((state) => ({
              downloads: (state.downloads || []).map((d) =>
                d.id === nextItem.id
                  ? {
                      ...d,
                      status: 'failed' as const,
                      error: error?.message || String(error),
                    }
                  : d
              ),
            }));
            // Automatically process the next one
            setTimeout(() => {
              get().processQueue();
            }, 100);
          }
        }
      },

      updateDownloadProgress: (payload) => {
        set((state) => {
          const list = state.downloads || [];
          const idx = list.findIndex((d) => d.id === payload.id);
          if (idx === -1) return state;

          const updated = [...list];
          updated[idx] = {
            ...updated[idx],
            status: payload.status,
            progress: payload.progress,
            bytesWritten: payload.bytes_written,
            totalBytes: payload.total_bytes,
            speedBytes: payload.speed_bytes,
            error: payload.error || undefined,
          };

          return { downloads: updated };
        });

        // Trigger queue processing if the current item completed/failed/canceled
        if (
          payload.status === 'completed' ||
          payload.status === 'failed' ||
          payload.status === 'canceled'
        ) {
          get().processQueue();
        }
      },
    }),
    {
      name: 'ynotv-media-downloads',
    }
  )
);

// Subscribe to Tauri events immediately for background progress updates
listen<{
  id: string;
  title: string;
  status: 'downloading' | 'completed' | 'failed' | 'canceled';
  progress: number;
  bytes_written: number;
  total_bytes: number | null;
  speed_bytes: number;
  file_path: string;
  error: string | null;
}>('download:event', (event) => {
  useDownloadStore.getState().updateDownloadProgress(event.payload);
}).catch((err) => {
  console.error('[DownloadStore] Failed to subscribe to Tauri download:event:', err);
});

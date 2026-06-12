import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StremioMetaPreview, StremioMeta, StremioVideo } from '../types/stremio';

export interface LibraryItem extends StremioMetaPreview {
  /** Cached videos for series (for new-episode detection and calendar) */
  videos?: StremioVideo[];
  /** Total video count at last refresh */
  videoCount?: number;
  /** Timestamp of last check for new episodes */
  lastChecked?: number;
}

interface StremioLibraryStore {
  library: LibraryItem[];
  addToLibrary: (item: StremioMetaPreview | StremioMeta) => void;
  removeFromLibrary: (id: string) => void;
  isInLibrary: (id: string) => boolean;
  updateLibraryItem: (id: string, updates: Partial<LibraryItem>) => void;
}

export const useStremioLibraryStore = create<StremioLibraryStore>()(
  persist(
    (set, get) => ({
      library: [],
      addToLibrary: (item) => {
        const current = get().library;
        if (current.some((x) => x.id === item.id)) return;
        const fullMeta = item as StremioMeta;
        const libItem: LibraryItem = {
          id: item.id,
          type: item.type,
          name: item.name,
          poster: item.poster,
          posterShape: item.posterShape,
          background: item.background,
          logo: item.logo,
          description: item.description,
          releaseInfo: item.releaseInfo,
          runtime: item.runtime,
          genres: item.genres,
          imdbRating: item.imdbRating,
          year: item.year,
          trailer: item.trailer,
          links: item.links,
          videos: fullMeta.videos,
          videoCount: fullMeta.videos?.length ?? 0,
          lastChecked: Date.now(),
        };
        set({ library: [libItem, ...current] });

        // Sync to Stremio cloud if logged in & sync enabled
        import('./stremioAuthStore').then(({ useStremioAuthStore }) => {
          const auth = useStremioAuthStore.getState();
          if (auth.authKey && auth.syncLibrary) {
            import('../services/stremio-api').then(({ putStremioLibraryItem }) => {
              const cloudItem = auth.cloudLibraryItems?.find((c) => c._id === libItem.id);
              const itemToPut = {
                _id: libItem.id,
                name: libItem.name,
                type: libItem.type,
                poster: libItem.poster,
                posterShape: (libItem.posterShape as any) ?? 'poster',
                removed: false,
                temp: false,
                _ctime: cloudItem?._ctime ?? new Date().toISOString(),
                _mtime: new Date().toISOString(),
                state: cloudItem?.state ?? {},
              };
              useStremioAuthStore.setState((s) => ({
                cloudLibraryItems: s.cloudLibraryItems.map((c) => c._id === libItem.id ? itemToPut : c).concat(
                  s.cloudLibraryItems.some((c) => c._id === libItem.id) ? [] : [itemToPut]
                )
              }));
              putStremioLibraryItem(auth.authKey!, itemToPut).catch(() => {});
            });
          }
        });
      },
      removeFromLibrary: (id) => {
        const target = get().library.find(x => x.id === id);
        set({ library: get().library.filter((x) => x.id !== id) });

        // Sync to Stremio cloud if logged in & sync enabled
        if (target) {
          import('./stremioAuthStore').then(({ useStremioAuthStore }) => {
            const auth = useStremioAuthStore.getState();
            if (auth.authKey && auth.syncLibrary) {
              import('../services/stremio-api').then(({ putStremioLibraryItem }) => {
                const cloudItem = auth.cloudLibraryItems?.find((c) => c._id === target.id);
                const hasProgress = !!cloudItem?.state && ((cloudItem.state.timeOffset ?? 0) > 0 || !!cloudItem.state.watched);
                const itemToPut = {
                  _id: target.id,
                  name: target.name,
                  type: target.type,
                  poster: target.poster,
                  posterShape: (target.posterShape as any) ?? 'poster',
                  removed: !hasProgress,
                  temp: true,
                  _mtime: new Date().toISOString(),
                  state: cloudItem?.state ?? {},
                };
                useStremioAuthStore.setState((s) => ({
                  cloudLibraryItems: s.cloudLibraryItems.map((c) => c._id === target.id ? itemToPut : c).concat(
                    s.cloudLibraryItems.some((c) => c._id === target.id) ? [] : [itemToPut]
                  )
                }));
                putStremioLibraryItem(auth.authKey!, itemToPut).catch(() => {});
              });
            }
          });
        }
      },
      isInLibrary: (id) => {
        return get().library.some((x) => x.id === id);
      },
      updateLibraryItem: (id, updates) => {
        set((state) => ({
          library: state.library.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },
    }),
    {
      name: 'stremio-library',
    }
  )
);

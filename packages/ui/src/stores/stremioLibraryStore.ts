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
      },
      removeFromLibrary: (id) => {
        set({ library: get().library.filter((x) => x.id !== id) });
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

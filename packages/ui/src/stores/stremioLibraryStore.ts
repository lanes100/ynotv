import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StremioMetaPreview } from '../types/stremio';

interface StremioLibraryStore {
  library: StremioMetaPreview[];
  addToLibrary: (item: StremioMetaPreview) => void;
  removeFromLibrary: (id: string) => void;
  isInLibrary: (id: string) => boolean;
}

export const useStremioLibraryStore = create<StremioLibraryStore>()(
  persist(
    (set, get) => ({
      library: [],
      addToLibrary: (item) => {
        const current = get().library;
        if (current.some((x) => x.id === item.id)) return;
        set({ library: [item, ...current] });
      },
      removeFromLibrary: (id) => {
        set({ library: get().library.filter((x) => x.id !== id) });
      },
      isInLibrary: (id) => {
        return get().library.some((x) => x.id === id);
      },
    }),
    {
      name: 'stremio-library',
    }
  )
);

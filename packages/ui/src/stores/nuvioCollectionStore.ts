import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type NuvioCollection, fetchNuvioCollections, pushNuvioCollections } from '../services/nuvio-api';
interface NuvioCollectionState {
  collections: NuvioCollection[];
  isLoading: boolean;
  error: string | null;
  setCollections: (collections: NuvioCollection[]) => void;
  loadCollections: () => Promise<void>;
  saveCollections: (collections: NuvioCollection[]) => Promise<void>;
}

export const useNuvioCollectionStore = create<NuvioCollectionState>()(
  persist(
    (set, get) => ({
      collections: [],
      isLoading: false,
      error: null,
      setCollections: (collections) => set({ collections }),
      loadCollections: async () => {
        const { useNuvioAuthStore } = await import('./nuvioAuthStore');
        const { token, activeProfile } = useNuvioAuthStore.getState();
        if (!token || !activeProfile) return;

        set({ isLoading: true, error: null });
        try {
          const collections = await fetchNuvioCollections(token, activeProfile.profile_index);
          set({ collections, error: null });
        } catch (e: any) {
          console.error('[NuvioCollectionStore] loadCollections failed:', e);
          set({ error: e.message || 'Failed to load collections' });
        } finally {
          set({ isLoading: false });
        }
      },
      saveCollections: async (collections) => {
        const { useNuvioAuthStore } = await import('./nuvioAuthStore');
        const { token, activeProfile } = useNuvioAuthStore.getState();
        if (!token || !activeProfile) {
          // If not logged in, just update local state
          set({ collections });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          await pushNuvioCollections(token, activeProfile.profile_index, collections);
          set({ collections, error: null });
        } catch (e: any) {
          set({ error: e.message || 'Failed to save collections' });
          console.error('[NuvioCollectionStore] saveCollections failed:', e);
          throw e;
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'ynotv-nuvio-collections',
    }
  )
);

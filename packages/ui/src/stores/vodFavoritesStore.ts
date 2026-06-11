import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FavoriteItem {
  id: string;
  type: 'movie' | 'series';
  title: string;
  poster?: string | null;
  year?: string | null;
  addedAt: number;
}

interface VodFavoritesState {
  favorites: FavoriteItem[];
  addFavorite: (item: Omit<FavoriteItem, 'addedAt'>) => void;
  removeFavorite: (id: string, type: 'movie' | 'series') => void;
  isFavorite: (id: string, type: 'movie' | 'series') => boolean;
  clearFavorites: () => void;
}

export const useVodFavoritesStore = create<VodFavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],

      addFavorite: (item) => set((state) => {
        if (state.favorites.some(f => f.id === item.id && f.type === item.type)) {
          return state;
        }
        return {
          favorites: [{ ...item, addedAt: Date.now() }, ...state.favorites]
        };
      }),

      removeFavorite: (id, type) => set((state) => ({
        favorites: state.favorites.filter(f => !(f.id === id && f.type === type))
      })),

      isFavorite: (id, type) => get().favorites.some(f => f.id === id && f.type === type),

      clearFavorites: () => set({ favorites: [] }),
    }),
    {
      name: 'vod-favorites',
    }
  )
);

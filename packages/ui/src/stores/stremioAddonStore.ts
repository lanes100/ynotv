import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InstalledAddon, StremioMetaPreview, StremioMeta } from '../types/stremio';
import { fetchManifest } from '../services/stremio-addon';

const STORAGE_KEY = 'stremio-addons';

const DEFAULT_ADDONS = [
  { url: 'https://opensubtitles-v3.strem.io/manifest.json', isDefault: true },
];

interface StremioAddonStore {
  addons: InstalledAddon[];
  initialized: boolean;
  initializeDefaults: () => Promise<void>;
  addAddon: (url: string) => Promise<void>;
  removeAddon: (id: string) => void;
  getAddonsWithResource: (resource: string) => InstalledAddon[];
  reorderAddons: (currentIndex: number, direction: 'up' | 'down') => void;
}

export const useStremioAddonStore = create<StremioAddonStore>()(
  persist(
    (set, get) => ({
      addons: [],
      initialized: false,
      reorderAddons: (currentIndex: number, direction: 'up' | 'down') => {
        const state = get();
        const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (nextIndex < 0 || nextIndex >= state.addons.length) return;

        const newAddons = [...state.addons];
        const temp = newAddons[currentIndex];
        newAddons[currentIndex] = newAddons[nextIndex];
        newAddons[nextIndex] = temp;

        set({ addons: newAddons });
      },

      initializeDefaults: async () => {
        const state = get();
        if (state.initialized) return;
        set({ initialized: true });

        const existingIds = new Set(state.addons.map(a => a.id));
        for (const def of DEFAULT_ADDONS) {
          try {
            const manifest = await fetchManifest(def.url);
            if (!existingIds.has(manifest.id)) {
              set(s => ({
                addons: [
                  ...s.addons,
                  {
                    id: manifest.id,
                    baseUrl: def.url.replace(/\/manifest\.json$/, ''),
                    manifest,
                    installedAt: Date.now(),
                    isDefault: true,
                  },
                ],
              }));
            }
          } catch (e) {
            console.warn('[StremioAddonStore] Failed to install default addon:', def.url, e);
          }
        }
      },

      addAddon: async (url: string) => {
        const manifest = await fetchManifest(url);
        const state = get();
        if (state.addons.some(a => a.id === manifest.id)) {
          throw new Error(`Addon "${manifest.name}" is already installed.`);
        }
        const addon: InstalledAddon = {
          id: manifest.id,
          baseUrl: url.replace(/\/manifest\.json$/, ''),
          manifest,
          installedAt: Date.now(),
        };
        set(s => ({ addons: [...s.addons, addon] }));
      },

      removeAddon: (id: string) => {
        set(s => ({ addons: s.addons.filter(a => a.id !== id) }));
      },

      getAddonsWithResource: (resource: string) => {
        return get().addons.filter(a =>
          a.manifest.resources.some(r => {
            if (typeof r === 'string') return r === resource;
            return r.name === resource;
          })
        );
      },
    }),
    {
      name: STORAGE_KEY,
    }
  )
);

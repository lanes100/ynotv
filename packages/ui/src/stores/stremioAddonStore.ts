import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InstalledAddon } from '../types/stremio';
import { fetchManifest } from '../services/stremio-addon';

const STORAGE_KEY = 'stremio-addons';

const DEFAULT_ADDONS = [
  { url: 'https://v3-cinemeta.strem.io/manifest.json', isDefault: true },
  { url: 'https://opensubtitles-v3.strem.io/manifest.json', isDefault: true },
];

function deriveEnabled(addons: InstalledAddon[]) {
  return addons.filter(a => a.enabled !== false);
}

interface StremioAddonStore {
  addons: InstalledAddon[];
  enabledAddons: InstalledAddon[];
  initialized: boolean;
  initializeDefaults: () => Promise<void>;
  addAddon: (url: string) => Promise<void>;
  removeAddon: (id: string) => void;
  toggleAddon: (id: string) => void;
  reorderAddons: (currentIndex: number, direction: 'up' | 'down') => void;
}

export const useStremioAddonStore = create<StremioAddonStore>()(
  persist(
    (set, get) => ({
      addons: [],
      enabledAddons: [],
      initialized: false,
      reorderAddons: (currentIndex: number, direction: 'up' | 'down') => {
        const state = get();
        const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (nextIndex < 0 || nextIndex >= state.addons.length) return;

        const newAddons = [...state.addons];
        const temp = newAddons[currentIndex];
        newAddons[currentIndex] = newAddons[nextIndex];
        newAddons[nextIndex] = temp;

        set({ addons: newAddons, enabledAddons: deriveEnabled(newAddons) });
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
              set(s => {
                const newAddons = [
                  ...s.addons,
                  {
                    id: manifest.id,
                    baseUrl: def.url.replace(/\/manifest\.json$/, ''),
                    manifest,
                    installedAt: Date.now(),
                    isDefault: true,
                  },
                ];
                return { addons: newAddons, enabledAddons: deriveEnabled(newAddons) };
              });
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
        set(s => {
          const newAddons = [...s.addons, addon];
          return { addons: newAddons, enabledAddons: deriveEnabled(newAddons) };
        });
      },

      removeAddon: (id: string) => {
        set(s => {
          const newAddons = s.addons.filter(a => a.id !== id);
          return { addons: newAddons, enabledAddons: deriveEnabled(newAddons) };
        });
      },

      toggleAddon: (id: string) => {
        set(s => {
          const newAddons = s.addons.map(a =>
            a.id === id ? { ...a, enabled: a.enabled === false ? true : false } : a
          );
          return { addons: newAddons, enabledAddons: deriveEnabled(newAddons) };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ addons: state.addons }),
      merge: (persisted, current) => {
        const addons = (persisted as any)?.addons ?? current.addons;
        return { ...current, addons, enabledAddons: deriveEnabled(addons) };
      },
    }
  )
);

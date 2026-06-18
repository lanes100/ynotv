import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InstalledAddon } from '../types/stremio';
import { fetchManifest, clearCatalogCache } from '../services/stremio-addon';
import { fetchNuvioAddons, pushNuvioAddons, type NuvioAddonRow } from '../services/nuvio-api';

interface NuvioAddonStore {
  addons: InstalledAddon[];
  enabledAddons: InstalledAddon[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  
  pullAddons: (token: string, profileId: number) => Promise<void>;
  addAddon: (token: string, profileId: number, url: string) => Promise<void>;
  removeAddon: (token: string, profileId: number, id: string) => Promise<void>;
  toggleAddon: (token: string, profileId: number, id: string) => Promise<void>;
  clearStore: () => void;
}

const STORAGE_KEY = 'ynotv-nuvio-addons';

function deriveEnabled(addons: InstalledAddon[]) {
  return addons.filter(a => a.enabled !== false);
}

export const useNuvioAddonStore = create<NuvioAddonStore>()(
  persist(
    (set, get) => ({
      addons: [],
      enabledAddons: [],
      loading: false,
      error: null,
      initialized: false,

      pullAddons: async (token, profileId) => {
        set({ loading: true, error: null });
        try {
          const rows = await fetchNuvioAddons(token, profileId);

          if (rows.length === 0) {
            // User has no addons yet – show empty state, don't auto-push anything
            clearCatalogCache();
            set({ addons: [], enabledAddons: [], initialized: true, error: null });
            return;
          }

          const currentAddons = get().addons;

          // Fetch manifests for any addon URLs we don't have manifest cached for
          const loadedAddons = await Promise.all(
            rows.map(async (row) => {
              const url = row.url;
              const existing = currentAddons.find(
                (a) => a.baseUrl === url.replace(/\/manifest\.json$/, '') || `${a.baseUrl}/manifest.json` === url
              );

              const isPlaceholder = existing && (
                !existing.manifest ||
                (existing.manifest.id && (existing.manifest.id.startsWith('http') || existing.manifest.id.includes('/manifest.json'))) ||
                ((existing.manifest.resources || []).length === 0 && (existing.manifest.catalogs || []).length === 0)
              );

              if (existing && existing.manifest && !isPlaceholder) {
                return {
                  ...existing,
                  enabled: row.enabled,
                };
              }

              try {
                const manifest = await fetchManifest(url);
                return {
                  id: manifest.id,
                  baseUrl: url.replace(/\/manifest\.json$/, ''),
                  manifest,
                  installedAt: Date.now(),
                  enabled: row.enabled,
                } as InstalledAddon;
              } catch (e) {
                console.warn('[NuvioAddonStore] Failed to load manifest for addon URL:', url, e);
                // Return a placeholder so we don't silently lose the addon URL
                return {
                  id: url,
                  baseUrl: url.replace(/\/manifest\.json$/, ''),
                  manifest: {
                    id: url,
                    name: row.name || url,
                    resources: [],
                    types: [],
                    catalogs: [],
                  },
                  installedAt: Date.now(),
                  enabled: row.enabled,
                } as any;
              }
            })
          );

          clearCatalogCache();
          set({
            addons: loadedAddons,
            enabledAddons: deriveEnabled(loadedAddons),
            initialized: true,
            error: null,
          });
        } catch (err: any) {
          console.error('[NuvioAddonStore] Failed to pull Nuvio addons:', err);
          set({ error: err.message || 'Failed to pull addons' });
        } finally {
          set({ loading: false });
        }
      },

      addAddon: async (token, profileId, url) => {
        set({ loading: true });
        try {
          const manifest = await fetchManifest(url);
          const state = get();
          
          if (state.addons.some(a => a.id === manifest.id)) {
            throw new Error(`Addon "${manifest.name}" is already installed in Nuvio.`);
          }

          const newAddon: InstalledAddon = {
            id: manifest.id,
            baseUrl: url.replace(/\/manifest\.json$/, ''),
            manifest,
            installedAt: Date.now(),
            enabled: true,
          };

          const updatedAddons = [...state.addons, newAddon];
          clearCatalogCache();
          
          // Push to Nuvio backend
          const rows: NuvioAddonRow[] = updatedAddons.map((a, index) => ({
            url: `${a.baseUrl}/manifest.json`,
            name: a.manifest.name,
            enabled: a.enabled !== false,
            sort_order: index,
          }));

          await pushNuvioAddons(token, profileId, rows);
          set({ addons: updatedAddons, enabledAddons: deriveEnabled(updatedAddons) });
        } catch (err: any) {
          set({ error: err.message || 'Failed to add addon' });
          throw err;
        } finally {
          set({ loading: false });
        }
      },

      removeAddon: async (token, profileId, id) => {
        set({ loading: true });
        try {
          const state = get();
          const updatedAddons = state.addons.filter(a => a.id !== id);
          clearCatalogCache();

          const rows: NuvioAddonRow[] = updatedAddons.map((a, index) => ({
            url: `${a.baseUrl}/manifest.json`,
            name: a.manifest.name,
            enabled: a.enabled !== false,
            sort_order: index,
          }));

          await pushNuvioAddons(token, profileId, rows);
          set({ addons: updatedAddons, enabledAddons: deriveEnabled(updatedAddons) });
        } catch (err: any) {
          set({ error: err.message || 'Failed to remove addon' });
          throw err;
        } finally {
          set({ loading: false });
        }
      },

      toggleAddon: async (token, profileId, id) => {
        set({ loading: true });
        try {
          const state = get();
          const updatedAddons = state.addons.map((a) =>
            a.id === id ? { ...a, enabled: a.enabled === false ? true : false } : a
          );
          clearCatalogCache();

          const rows: NuvioAddonRow[] = updatedAddons.map((a, index) => ({
            url: `${a.baseUrl}/manifest.json`,
            name: a.manifest.name,
            enabled: a.enabled !== false,
            sort_order: index,
          }));

          await pushNuvioAddons(token, profileId, rows);
          set({ addons: updatedAddons, enabledAddons: deriveEnabled(updatedAddons) });
        } catch (err: any) {
          set({ error: err.message || 'Failed to toggle addon' });
          throw err;
        } finally {
          set({ loading: false });
        }
      },

      clearStore: () => {
        set({
          addons: [],
          enabledAddons: [],
          initialized: false,
          error: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ addons: state.addons }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.enabledAddons = state.addons ? state.addons.filter(a => a.enabled !== false) : [];
          state.initialized = true;
        }
      }
    }
  )
);

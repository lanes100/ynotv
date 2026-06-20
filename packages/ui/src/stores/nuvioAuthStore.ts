import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  loginNuvio,
  signUpNuvio,
  logoutNuvio,
  fetchNuvioProfiles,
  pushNuvioProfiles,
  deleteNuvioProfileData,
  verifyNuvioProfilePin,
  setNuvioProfilePin,
  clearNuvioProfilePin,
  clearNuvioProfilePinWithPassword,
  fetchNuvioCollections,
  pushNuvioCollections,
  fetchNuvioAddons,
  pushNuvioAddons,
  fetchNuvioPlugins,
  pushNuvioPlugins,
  fetchNuvioLibrary,
  pushNuvioLibrary,
  fetchNuvioWatchProgress,
  pushNuvioWatchProgress,
  deleteNuvioWatchProgress,
  fetchNuvioWatchedItems,
  pushNuvioWatchedItems,
  deleteNuvioWatchedItems,
  fetchNuvioProfileSettings,
  pushNuvioProfileSettings,
  fetchNuvioHomeCatalogSettings,
  pushNuvioHomeCatalogSettings,
  fetchNuvioAvatarCatalog,
  clearNuvioApiCache,
  type NuvioProfile,
  type NuvioProfilePushPayload,
  type NuvioCollection,
  type NuvioAddonRow,
  type NuvioPluginRow,
  type NuvioLibrarySyncItem,
  type NuvioWatchProgressSyncEntry,
  type NuvioWatchedSyncItem,
  type AvatarCatalogItem,
} from '../services/nuvio-api';

interface NuvioAuthStore {
  token: string | null;
  refreshToken: string | null;
  user: { id: string; email: string } | null;
  profiles: NuvioProfile[];
  activeProfile: NuvioProfile | null;
  avatarCatalog: AvatarCatalogItem[];
  isSyncing: boolean;
  error: string | null;
  lastSyncTime: number | null;
  settings: any | null;
  homeCatalogSettings: any | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfiles: () => Promise<void>;
  selectProfile: (profileIndex: number, pin?: string) => Promise<boolean>;
  createProfile: (name: string, colorHex: string, avatarId: string | null, avatarUrl: string | null) => Promise<void>;
  updateProfile: (profileIndex: number, name: string, colorHex: string, avatarId: string | null, avatarUrl: string | null) => Promise<void>;
  deleteProfile: (profileIndex: number) => Promise<void>;
  loadAvatarCatalog: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSettings: (features: any) => Promise<void>;
  fetchHomeCatalogSettings: () => Promise<void>;
  updateHomeCatalogSettings: (settings: any) => Promise<void>;
  syncNow: () => Promise<void>;
}

export const useNuvioAuthStore = create<NuvioAuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      profiles: [],
      activeProfile: null,
      avatarCatalog: [],
      isSyncing: false,
      error: null,
      lastSyncTime: null,
      settings: null,
      homeCatalogSettings: null,

      login: async (email, password) => {
        set({ isSyncing: true, error: null });
        try {
          const session = await loginNuvio(email, password);
          set({
            token: session.access_token,
            refreshToken: session.refresh_token,
            user: { id: session.user.id, email: session.user.email },
          });
          await get().fetchProfiles();
          // Don't auto-select — the UI shows a profile picker and handles PIN prompts
          set({ error: null });
        } catch (e: any) {
          set({ error: e.message || 'Login failed' });
          throw e;
        } finally {
          set({ isSyncing: false });
        }
      },

      signup: async (email, password) => {
        set({ isSyncing: true, error: null });
        try {
          const session = await signUpNuvio(email, password);
          set({
            token: session.access_token,
            refreshToken: session.refresh_token,
            user: { id: session.user.id, email: session.user.email },
            error: null,
          });
          await get().fetchProfiles();
        } catch (e: any) {
          set({ error: e.message || 'Registration failed' });
          throw e;
        } finally {
          set({ isSyncing: false });
        }
      },

      logout: async () => {
        const token = get().token;
        if (token) {
          await logoutNuvio(token).catch(() => {});
        }
        
        try {
          const { clearStore } = (await import('./nuvioAddonStore')).useNuvioAddonStore.getState();
          clearStore();
        } catch (e) {
          console.error('[NuvioAuthStore] Failed to clear Nuvio addons on logout:', e);
        }

        set({
          token: null,
          refreshToken: null,
          user: null,
          profiles: [],
          activeProfile: null,
          error: null,
          lastSyncTime: null,
        });
        clearNuvioApiCache();
      },

      fetchProfiles: async () => {
        const token = get().token;
        if (!token) return;
        try {
          const profiles = await fetchNuvioProfiles(token);
          const sortedProfiles = profiles.sort((a, b) => a.profile_index - b.profile_index);
          set({ profiles: sortedProfiles });
          
          // Update active profile copy if it still exists, otherwise leave null (UI shows picker)
          const active = get().activeProfile;
          if (active) {
            const updatedActive = sortedProfiles.find((p) => p.profile_index === active.profile_index);
            if (updatedActive) {
              set({ activeProfile: updatedActive });
            } else {
              set({ activeProfile: null });
            }
          }
        } catch (e: any) {
          console.error('[NuvioAuthStore] Failed to fetch profiles:', e);
        }
      },

      selectProfile: async (profileIndex, pin) => {
        const token = get().token;
        if (!token) return false;
        const targetProfile = get().profiles.find((p) => p.profile_index === profileIndex);
        if (!targetProfile) return false;

        if (targetProfile.pin_enabled && !pin) {
          // Requires PIN dialog, will be handled by UI
          return false;
        }

        if (targetProfile.pin_enabled && pin) {
          const verify = await verifyNuvioProfilePin(token, profileIndex, pin);
          if (!verify.unlocked) {
            throw new Error(verify.message || 'Incorrect PIN code');
          }
        }

        set({ activeProfile: targetProfile });
        // Trigger other stores to pull data for this profile
        get().syncNow().catch((e) => console.error('[NuvioAuthStore] Sync failed after profile switch:', e));
        return true;
      },

      createProfile: async (name, colorHex, avatarId, avatarUrl) => {
        const token = get().token;
        if (!token) return;
        const existingIndexes = get().profiles.map((p) => p.profile_index);
        let nextIndex = 1;
        for (let i = 1; i <= 4; i++) {
          if (!existingIndexes.includes(i)) {
            nextIndex = i;
            break;
          }
        }

        const newProfilePayload: NuvioProfilePushPayload = {
          profile_index: nextIndex,
          name,
          avatar_color_hex: colorHex,
          uses_primary_addons: false,
          uses_primary_plugins: false,
          avatar_id: avatarId,
          avatar_url: avatarUrl,
        };

        const existingPayloads: NuvioProfilePushPayload[] = get().profiles.map((p) => ({
          profile_index: p.profile_index,
          name: p.name,
          avatar_color_hex: p.avatar_color_hex,
          uses_primary_addons: p.uses_primary_addons,
          uses_primary_plugins: p.uses_primary_plugins,
          avatar_id: p.avatar_id,
          avatar_url: p.avatar_url,
        }));

        await pushNuvioProfiles(token, [...existingPayloads, newProfilePayload]);
        await get().fetchProfiles();
      },

      updateProfile: async (profileIndex, name, colorHex, avatarId, avatarUrl) => {
        const token = get().token;
        if (!token) return;

        const payloads: NuvioProfilePushPayload[] = get().profiles.map((p) => {
          if (p.profile_index === profileIndex) {
            return {
              profile_index: profileIndex,
              name,
              avatar_color_hex: colorHex,
              uses_primary_addons: p.uses_primary_addons,
              uses_primary_plugins: p.uses_primary_plugins,
              avatar_id: avatarId,
              avatar_url: avatarUrl,
            };
          }
          return {
            profile_index: p.profile_index,
            name: p.name,
            avatar_color_hex: p.avatar_color_hex,
            uses_primary_addons: p.uses_primary_addons,
            uses_primary_plugins: p.uses_primary_plugins,
            avatar_id: p.avatar_id,
            avatar_url: p.avatar_url,
          };
        });

        await pushNuvioProfiles(token, payloads);
        await get().fetchProfiles();
      },

      deleteProfile: async (profileIndex) => {
        const token = get().token;
        if (!token) return;

        await deleteNuvioProfileData(token, profileIndex);
        await get().fetchProfiles();

        const active = get().activeProfile;
        if (active?.profile_index === profileIndex) {
          const remaining = get().profiles;
          if (remaining.length > 0) {
            await get().selectProfile(remaining[0].profile_index);
          } else {
            set({ activeProfile: null });
          }
        }
      },

      loadAvatarCatalog: async () => {
        const token = get().token;
        if (!token) return;
        try {
          const avatars = await fetchNuvioAvatarCatalog(token);
          set({ avatarCatalog: avatars });
        } catch (e) {
          console.error('[NuvioAuthStore] Failed to fetch avatar catalog:', e);
        }
      },

      fetchSettings: async () => {
        const token = get().token;
        const profile = get().activeProfile;
        if (!token || !profile) return;
        try {
          const profileSettings = await fetchNuvioProfileSettings(token, profile.profile_index);
          set({ settings: profileSettings });
          // Sync TMDB key locally if found
          const tmdbKey = profileSettings?.features?.tmdb_settings?.apiKey;
          if (tmdbKey && (window as any).storage) {
            await (window as any).storage.updateSettings({ tmdbApiKey: tmdbKey });
          }
        } catch (e) {
          console.error('[NuvioAuthStore] Failed to fetch profile settings:', e);
        }
      },

      updateSettings: async (updatedFeatures) => {
        const token = get().token;
        const profile = get().activeProfile;
        if (!token || !profile) return;

        const currentSettings = get().settings || { version: 3, features: {} };
        const newSettings = {
          ...currentSettings,
          features: {
            ...currentSettings.features,
            ...updatedFeatures,
          }
        };

        set({ isSyncing: true, error: null });
        try {
          await pushNuvioProfileSettings(token, profile.profile_index, newSettings);
          set({ settings: newSettings, error: null });
          
          // Also sync TMDB API key locally if it was updated
          const tmdbKey = updatedFeatures.tmdb_settings?.apiKey;
          if (tmdbKey && (window as any).storage) {
            await (window as any).storage.updateSettings({ tmdbApiKey: tmdbKey });
          }
        } catch (e: any) {
          console.error('[NuvioAuthStore] Failed to update profile settings:', e);
          set({ error: e.message || 'Failed to update settings' });
          throw e;
        } finally {
          set({ isSyncing: false });
        }
      },

      fetchHomeCatalogSettings: async () => {
        const token = get().token;
        const profile = get().activeProfile;
        if (!token || !profile) return;
        try {
          const homeSettings = await fetchNuvioHomeCatalogSettings(token, profile.profile_index);
          set({ homeCatalogSettings: homeSettings });
        } catch (e) {
          console.error('[NuvioAuthStore] Failed to fetch home catalog settings:', e);
        }
      },

      updateHomeCatalogSettings: async (newSettings: any) => {
        const token = get().token;
        const profile = get().activeProfile;
        if (!token || !profile) return;
        set({ isSyncing: true, error: null });
        try {
          await pushNuvioHomeCatalogSettings(token, profile.profile_index, newSettings);
          set({ homeCatalogSettings: newSettings, error: null });
        } catch (e: any) {
          console.error('[NuvioAuthStore] Failed to update home catalog settings:', e);
          set({ error: e.message || 'Failed to update home catalog settings' });
          throw e;
        } finally {
          set({ isSyncing: false });
        }
      },

      syncNow: async () => {
        clearNuvioApiCache();
        const token = get().token;
        const profile = get().activeProfile;
        if (!token || !profile) return;

        set({ isSyncing: true });
        try {
          // Pull profile settings
          const profileSettings = await fetchNuvioProfileSettings(token, profile.profile_index);
          set({ settings: profileSettings });
          // Sync TMDB key locally if found
          const tmdbKey = profileSettings?.features?.tmdb_settings?.apiKey;
          if (tmdbKey && (window as any).storage) {
            await (window as any).storage.updateSettings({ tmdbApiKey: tmdbKey });
          }

          // Pull home catalog settings
          const homeSettings = await fetchNuvioHomeCatalogSettings(token, profile.profile_index);
          set({ homeCatalogSettings: homeSettings });

          // Import stores dynamically or trigger them directly if imported
          // Pull Collections
          const collections = await fetchNuvioCollections(token, profile.profile_index);
          // Set in collections store
          const { setCollections } = (await import('./nuvioCollectionStore')).useNuvioCollectionStore.getState();
          setCollections(collections);

          // Pull Plugins
          const plugins = await fetchNuvioPlugins(token, profile.profile_index);
          const { setPlugins } = (await import('./nuvioPluginStore')).useNuvioPluginStore.getState();
          await setPlugins(plugins);

          // Pull Nuvio Addons
          const { pullAddons } = (await import('./nuvioAddonStore')).useNuvioAddonStore.getState();
          const effectiveAddonProfileId =
            profile.profile_index !== 1 && profile.uses_primary_addons ? 1 : profile.profile_index;
          await pullAddons(token, effectiveAddonProfileId);

          set({ lastSyncTime: Date.now(), error: null });
        } catch (e: any) {
          console.error('[NuvioAuthStore] Synchronization failed:', e);
          set({ error: e.message || 'Sync failed' });
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: 'ynotv-nuvio-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        activeProfile: state.activeProfile,
        settings: state.settings,
        homeCatalogSettings: state.homeCatalogSettings,
      }),
    }
  )
);

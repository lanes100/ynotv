import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  loginStremio,
  logoutStremio,
  fetchStremioLibrary,
  putStremioLibraryItem,
  fetchStremioAddons,
  setStremioAddons,
  type StremioUser,
  type StremioLibraryItem,
  type StremioAddon,
} from '../services/stremio-api';
import { useStremioAddonStore } from './stremioAddonStore';
import { useStremioLibraryStore } from './stremioLibraryStore';
import { useStremioWatchStore } from './stremioWatchStore';
import { fetchMeta, fetchManifest, cleanAddonUrl, getManifestUrl } from '../services/stremio-addon';
import type { StremioMeta } from '../types/stremio';

// Helper to decode Stremio watched bitset
export async function decodeStremioWatched(
  watchedField: string | null | undefined,
  videos: { id: string; season?: number; episode?: number }[] | undefined
): Promise<Set<string>> {
  const watchedIds = new Set<string>();
  if (!watchedField || !videos || videos.length === 0) return watchedIds;

  const parts = watchedField.split(':');
  if (parts.length < 3) return watchedIds;
  const b64 = parts[parts.length - 1];
  const anchorLength = parseInt(parts[parts.length - 2], 10);
  const anchorVideoId = parts.slice(0, -2).join(':');
  if (isNaN(anchorLength) || anchorLength <= 0) return watchedIds;

  try {
    const bin = atob(b64);
    const raw = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
    const inflated = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate'));
    const bytes = new Uint8Array(await new Response(inflated).arrayBuffer());

    const bit = (i: number) =>
      i >= 0 && i < bytes.length * 8 && (bytes[i >> 3] & (1 << (i & 7))) !== 0;

    const anchorIdx = videos.findIndex((v) => v.id === anchorVideoId);
    const offset = anchorIdx >= 0 ? anchorLength - anchorIdx - 1 : 0;

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      if (v?.season !== undefined && v?.episode !== undefined && bit(i + offset)) {
        watchedIds.add(v.id);
      }
    }
  } catch (e) {
    console.error('Failed to decode watched episodes:', e);
  }
  return watchedIds;
}

// Helper to encode watched episodes bitset
export async function encodeStremioWatched(
  watchedEpisodeIds: Set<string>,
  videos: { id: string; season?: number; episode?: number }[]
): Promise<string | null> {
  if (watchedEpisodeIds.size === 0 || !videos || videos.length === 0) return null;

  let maxWatchedIdx = -1;
  for (let i = 0; i < videos.length; i++) {
    if (watchedEpisodeIds.has(videos[i].id)) {
      maxWatchedIdx = i;
    }
  }
  if (maxWatchedIdx === -1) return null;

  const anchorVideoId = videos[maxWatchedIdx].id;
  const anchorLength = maxWatchedIdx + 1;

  const byteCount = Math.ceil(anchorLength / 8);
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < anchorLength; i++) {
    if (watchedEpisodeIds.has(videos[i].id)) {
      bytes[i >> 3] |= (1 << (i & 7));
    }
  }

  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    const compressedBytes = new Uint8Array(await new Response(stream).arrayBuffer());

    let binStr = "";
    for (let i = 0; i < compressedBytes.length; i++) {
      binStr += String.fromCharCode(compressedBytes[i]);
    }
    const b64 = btoa(binStr);

    return `${anchorVideoId}:${anchorLength}:${b64}`;
  } catch (e) {
    console.error('[Stremio] Failed to encode watched bitset:', e);
    return null;
  }
}

interface StremioAuthStore {
  authKey: string | null;
  user: StremioUser | null;
  syncLibrary: boolean;
  syncProgress: boolean;
  syncAddons: boolean;
  lastSyncTime: number | null;
  isSyncing: boolean;
  error: string | null;
  cloudLibraryItems: StremioLibraryItem[];

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSyncLibrary: (val: boolean) => void;
  setSyncProgress: (val: boolean) => void;
  setSyncAddons: (val: boolean) => void;
  syncNow: () => Promise<void>;
  syncPlaybackProgress: (
    metaId: string,
    videoId: string,
    positionSec: number,
    durationSec: number,
    type: 'movie' | 'series',
    name: string,
    poster?: string
  ) => Promise<void>;
  dismissFromContinueWatching: (metaId: string, type: 'movie' | 'series') => Promise<void>;
}

export const useStremioAuthStore = create<StremioAuthStore>()(
  persist(
    (set, get) => ({
      authKey: null,
      user: null,
      syncLibrary: true,
      syncProgress: true,
      syncAddons: true,
      lastSyncTime: null,
      isSyncing: false,
      error: null,
      cloudLibraryItems: [],

      login: async (email, password) => {
        set({ isSyncing: true, error: null });
        try {
          const res = await loginStremio(email, password);
          set({
            authKey: res.authKey,
            user: res.user,
            isSyncing: false,
            cloudLibraryItems: [],
          });
          // Perform initial sync
          await get().syncNow();
        } catch (e: any) {
          set({ error: e.message ?? 'Login failed', isSyncing: false });
          throw e;
        }
      },

      logout: async () => {
        const { authKey } = get();
        if (authKey) {
          try {
            await logoutStremio(authKey);
          } catch {
            // Ignore logout failure on server
          }
        }
        set({
          authKey: null,
          user: null,
          syncLibrary: false,
          syncProgress: false,
          syncAddons: false,
          lastSyncTime: null,
          error: null,
          cloudLibraryItems: [],
        });
      },

      setSyncLibrary: (val) => set({ syncLibrary: val }),
      setSyncProgress: (val) => set({ syncProgress: val }),
      setSyncAddons: (val) => set({ syncAddons: val }),

      syncNow: async () => {
        const { authKey, syncLibrary, syncAddons, syncProgress } = get();
        if (!authKey) return;

        set({ isSyncing: true, error: null });
        try {
          // 1. Sync Addons
          if (syncAddons) {
            const cloudAddons = await fetchStremioAddons(authKey);
            const addonStore = useStremioAddonStore.getState();
            const localAddons = addonStore.addons;

            // Merge local and cloud lists
            const mergedAddons = [...localAddons];
            let changed = false;

            for (const ca of cloudAddons) {
              const caBaseUrl = cleanAddonUrl(ca.transportUrl);
              const exists = localAddons.some(la => la.baseUrl === caBaseUrl || la.id === ca.manifest.id);
              if (!exists) {
                mergedAddons.push({
                  id: ca.manifest.id,
                  baseUrl: caBaseUrl,
                  manifest: ca.manifest,
                  installedAt: Date.now(),
                });
                changed = true;
              }
            }

            if (changed) {
              useStremioAddonStore.setState({
                addons: mergedAddons,
                enabledAddons: mergedAddons.filter(a => a.enabled !== false),
              });
            }

            // Sync merged list back to cloud
            const toPushAddons: StremioAddon[] = mergedAddons.map(a => ({
              transportUrl: getManifestUrl(a.baseUrl),
              manifest: a.manifest,
            }));
            await setStremioAddons(authKey, toPushAddons);
            useStremioAddonStore.setState({ addonsReordered: false });
          }

          // 2. Sync Library and Watch Progress
          if (syncLibrary) {
            const cloudLibrary = await fetchStremioLibrary(authKey);
            set({ cloudLibraryItems: cloudLibrary });

            const libraryStore = useStremioLibraryStore.getState();
            const watchStore = useStremioWatchStore.getState();

            // Fetch current active addons to use for retrieving metadata during sync
            const enabledAddons = useStremioAddonStore.getState().enabledAddons;

            // Pre-fetch metadata in parallel only for series with active watched history (state.watched) that don't have local videos cached yet
            const seriesToFetch = cloudLibrary.filter(item => {
              if (item.removed || item.temp || item.type !== 'series') return false;
              if (!item.state?.watched) return false;
              const localItem = libraryStore.library.find(x => x.id === item._id);
              return !localItem?.videos;
            });

            const fetchedMetaMap = new Map<string, StremioMeta>();
            if (seriesToFetch.length > 0) {
              await Promise.all(
                seriesToFetch.map(async (item) => {
                  const addon = enabledAddons.find(a => a.manifest.catalogs?.some(c => c.type === item.type));
                  if (addon) {
                    try {
                      const fullMeta = await fetchMeta([addon], item.type, item._id);
                      if (fullMeta) {
                        fetchedMetaMap.set(item._id, fullMeta);
                      }
                    } catch (e) {
                      console.warn(`[Sync] Failed to pre-fetch metadata for series: ${item._id}`, e);
                    }
                  }
                })
              );
            }

            // Inbound: Sync from cloud to local
            for (const item of cloudLibrary) {
              const localItem = libraryStore.library.find(x => x.id === item._id);

              if (item.removed) {
                // If it is removed in cloud, remove from local library if present
                if (localItem) {
                  libraryStore.removeFromLibrary(item._id);
                }
                // Skip further processing only if it's a permanent watchlist item (non-temp)
                if (!item.temp) {
                  continue;
                }
              }

              // Keep local library (watchlist) strictly for non-temp items
              if (item.temp) {
                if (localItem) {
                  libraryStore.removeFromLibrary(item._id);
                }
              } else {
                // If item is not in local library, add it locally (using pre-fetched full meta or minimal info)
                if (!localItem && !item.removed) {
                  const fetchedMeta = fetchedMetaMap.get(item._id);
                  if (fetchedMeta) {
                    libraryStore.addLocalLibraryItem({
                      id: fetchedMeta.id,
                      type: fetchedMeta.type,
                      name: fetchedMeta.name,
                      poster: fetchedMeta.poster,
                      posterShape: fetchedMeta.posterShape,
                      background: fetchedMeta.background,
                      logo: fetchedMeta.logo,
                      description: fetchedMeta.description,
                      releaseInfo: fetchedMeta.releaseInfo,
                      runtime: fetchedMeta.runtime,
                      genres: fetchedMeta.genres,
                      imdbRating: fetchedMeta.imdbRating,
                      year: fetchedMeta.year,
                      trailer: fetchedMeta.trailer,
                      links: fetchedMeta.links,
                      videos: fetchedMeta.videos,
                      videoCount: fetchedMeta.videos?.length ?? 0,
                      lastChecked: Date.now(),
                    });
                  } else {
                    libraryStore.addLocalLibraryItem({
                      id: item._id,
                      type: item.type,
                      name: item.name,
                      poster: item.poster ?? undefined,
                      posterShape: item.posterShape ?? undefined,
                      lastChecked: 0, // stale, will refresh in background/on view
                    });
                  }
                }
              }

              // Inbound: Sync progress
              if (syncProgress && item.state) {
                const state = item.state;
                // Re-get localItem in case it was just added above
                const updatedLocalItem = libraryStore.library.find(x => x.id === item._id);
                let currentVideos = updatedLocalItem?.videos ?? fetchedMetaMap.get(item._id)?.videos;

                // Series progress (decoding watched bitset)
                if (item.type === 'series') {
                  if (currentVideos && state.watched) {
                    const watchedIds = await decodeStremioWatched(state.watched, currentVideos);
                    const epUpdates: Record<string, any> = {};
                    const now = Date.now();
                    for (const vidId of watchedIds) {
                      const video = currentVideos.find(v => v.id === vidId);
                      if (video && video.season !== undefined && video.episode !== undefined) {
                        const existing = watchStore.episodeProgress[vidId];
                        if (!existing || !existing.finished) {
                          epUpdates[vidId] = {
                            videoId: vidId,
                            metaId: item._id,
                            season: video.season,
                            episode: video.episode,
                            progressFraction: 1.0,
                            finished: true,
                            watchedAt: now,
                          };

                          const season = video.season;
                          const episode = video.episode;
                          const title = video.title || `Episode ${episode}`;

                          // Sync completed state to local SQLite DB
                          import('../db').then(({ recordEpisodeWatch }) => {
                            recordEpisodeWatch(
                              vidId,
                              item._id,
                              'stremio',
                              season,
                              episode,
                              title,
                              1,
                              1
                            ).catch(() => {});
                          }).catch(() => {});
                        }
                      }
                    }
                    if (Object.keys(epUpdates).length > 0) {
                      watchStore.setEpisodesFinishedDirectly(epUpdates);
                    }
                  }
                }

                // Movie progress or Series Continue Watching
                if (state.video_id && state.timeOffset && state.duration) {
                  const fraction = Math.min(1.0, state.timeOffset / state.duration);
                  const isFinished = fraction >= 0.9;
                  const timeOffsetSec = Math.floor(state.timeOffset / 1000);
                  const durationSec = Math.floor(state.duration / 1000);

                  if (item.type === 'movie') {
                    if (!isFinished) {
                      const existing = watchStore.history.find(h => h.metaId === item._id);
                      if (!existing || existing.progressFraction < fraction) {
                        watchStore.recordMovieWatch(item._id, item.name, item.poster);
                        watchStore.updateMovieProgress(item._id, fraction);

                        // Sync to local SQLite DB so resume works on play
                        import('../db').then(({ recordVodWatch, updateVodWatchProgress }) => {
                          recordVodWatch(
                            item._id,
                            'movie',
                            'stremio',
                            item.name,
                            item.poster
                          ).then(() => {
                            updateVodWatchProgress(
                              item._id,
                              'movie',
                              timeOffsetSec,
                              durationSec
                            ).catch(() => {});
                          }).catch(() => {});
                        }).catch(() => {});
                      }
                    }
                  } else if (item.type === 'series') {
                    // Try to decode season/episode directly from video_id string first
                    let season = state.season;
                    let episode = state.episode;
                    let videoTitle = `Episode ${episode}`;

                    if (state.video_id) {
                      const parts = state.video_id.split(':');
                      if (parts.length >= 3) {
                        const parsedSeason = parseInt(parts[parts.length - 2], 10);
                        const parsedEpisode = parseInt(parts[parts.length - 1], 10);
                        if (!isNaN(parsedSeason) && !isNaN(parsedEpisode)) {
                          season = parsedSeason;
                          episode = parsedEpisode;
                          videoTitle = `Episode ${episode}`;
                        }
                      }
                    }

                    if (season !== undefined && episode !== undefined) {
                      const videoId = state.video_id;

                      // Try to map actual title from currentVideos if cached
                      if (currentVideos && videoId) {
                        const video = currentVideos.find(v => v.id === videoId);
                        if (video?.title) {
                          videoTitle = video.title;
                        }
                      }

                      if (isFinished) {
                        if (currentVideos && videoId) {
                          // Find next episode
                          const sorted = [...currentVideos].sort((a, b) => {
                            if ((a.season ?? 0) !== (b.season ?? 0)) return (a.season ?? 0) - (b.season ?? 0);
                            return (a.episode ?? 0) - (b.episode ?? 0);
                          });
                          const idx = sorted.findIndex(v => v.id === videoId);
                          if (idx >= 0 && idx < sorted.length - 1) {
                            const next = sorted[idx + 1];
                            watchStore.recordEpisodeStart(
                              item._id,
                              item.name,
                              item.poster,
                              next.id,
                              next.season ?? 0,
                              next.episode ?? 0,
                              undefined, undefined, undefined
                            );
                            watchStore.updateEpisodeProgress(
                              item._id,
                              next.id,
                              0.0,
                              next.season ?? 0,
                              next.episode ?? 0
                            );
                          }
                        }
                      } else if (videoId) {
                        const existing = watchStore.episodeProgress[videoId];
                        if (!existing || existing.progressFraction < fraction) {
                          watchStore.recordEpisodeStart(
                            item._id,
                            item.name,
                            item.poster,
                            videoId,
                            season,
                            episode
                          );
                          watchStore.updateEpisodeProgress(
                            item._id,
                            videoId,
                            fraction,
                            season,
                            episode
                          );

                          // Sync to local SQLite DB so resume works on play
                          import('../db').then(({ recordVodWatch, updateVodWatchProgress, recordEpisodeWatch }) => {
                            recordVodWatch(
                              item._id,
                              'series',
                              'stremio',
                              item.name,
                              item.poster,
                              season,
                              episode,
                              videoTitle
                            ).then(() => {
                              updateVodWatchProgress(
                                item._id,
                                'series',
                                timeOffsetSec,
                                durationSec
                              ).catch(() => {});
                            }).catch(() => {});

                            recordEpisodeWatch(
                              videoId,
                              item._id,
                              'stremio',
                              season,
                              episode,
                              videoTitle,
                              timeOffsetSec,
                              durationSec
                            ).catch(() => {});
                          }).catch(() => {});
                        }
                      }
                    }
                  }
                }
              }
            }

            // Outbound: Sync local items to cloud
            for (const localItem of libraryStore.library) {
              const cloudItem = cloudLibrary.find(x => x._id === localItem.id);
              if (!cloudItem || cloudItem.removed || cloudItem.temp) {
                // Push local addition to cloud
                const state: StremioLibraryItem['state'] = { ...(cloudItem?.state ?? {}) };
                if (syncProgress) {
                  // Check if movie progress exists
                  if (localItem.type === 'movie') {
                    const hist = watchStore.history.find(h => h.metaId === localItem.id);
                    if (hist) {
                      state.video_id = localItem.id;
                      state.timeOffset = Math.floor((hist.progressFraction ?? 0) * 120 * 60 * 1000); // estimate 2h duration
                      state.duration = 120 * 60 * 1000;
                      state.flaggedWatched = hist.progressFraction >= 0.9 ? 1 : 0;
                      state.timesWatched = state.flaggedWatched;
                    }
                  } else if (localItem.type === 'series' && localItem.videos) {
                    // Try to construct watched string
                    const watchedIds = new Set<string>();
                    let latestVidId: string | undefined;
                    let latestSeason = 1;
                    let latestEpisode = 1;

                    for (const v of localItem.videos) {
                      if (watchStore.episodeProgress[v.id]?.finished) {
                        watchedIds.add(v.id);
                        latestVidId = v.id;
                        latestSeason = v.season ?? 1;
                        latestEpisode = v.episode ?? 1;
                      }
                    }

                    if (watchedIds.size > 0) {
                      const watchedStr = await encodeStremioWatched(watchedIds, localItem.videos);
                      state.watched = watchedStr;
                      if (latestVidId) {
                        state.video_id = latestVidId;
                        state.timeOffset = 0;
                        state.duration = 45 * 60 * 1000; // estimate 45m
                        state.lastWatched = new Date().toISOString();
                      }
                    }
                  }
                }

                const item: StremioLibraryItem = {
                  _id: localItem.id,
                  name: localItem.name,
                  type: localItem.type,
                  poster: localItem.poster,
                  posterShape: localItem.posterShape as any ?? 'poster',
                  removed: false,
                  temp: false,
                  _mtime: new Date().toISOString(),
                  state,
                };
                await putStremioLibraryItem(authKey, item);
              }
            }
          }

          set({ lastSyncTime: Date.now(), isSyncing: false });
        } catch (e: any) {
          set({ error: e.message ?? 'Sync failed', isSyncing: false });
          console.error('[Sync] Error syncing Stremio:', e);
        }
      },

      syncPlaybackProgress: async (metaId, videoId, positionSec, durationSec, type, name, poster) => {
        const { authKey, syncProgress } = get();
        if (!authKey || !syncProgress) return;

        try {
          const cloudItems = await fetchStremioLibrary(authKey).catch(() => [] as StremioLibraryItem[]);
          let base = cloudItems.find(x => x._id === metaId);

          const now = new Date().toISOString();
          const offsetMs = Math.floor(positionSec * 1000);
          const durationMs = Math.floor(durationSec * 1000);
          const ratio = positionSec / Math.max(1, durationSec);
          const isFinished = ratio >= 0.9;

          const state: StremioLibraryItem['state'] = {
            ...base?.state,
            lastWatched: now,
            timeOffset: isFinished ? 0 : offsetMs,
            duration: durationMs,
            video_id: videoId,
          };

          if (type === 'movie') {
            state.timeWatched = offsetMs;
            if (isFinished) {
              state.flaggedWatched = 1;
              state.timesWatched = (base?.state?.timesWatched ?? 0) + 1;
            }
          } else if (type === 'series') {
            const localItem = useStremioLibraryStore.getState().library.find(x => x.id === metaId);
            let videos = localItem?.videos;
            if (!videos) {
              const enabledAddons = useStremioAddonStore.getState().enabledAddons;
              const addon = enabledAddons.find(a => a.manifest.catalogs?.some(c => c.type === type));
              if (addon) {
                const meta = await fetchMeta([addon], type, metaId);
                if (meta?.videos) {
                  videos = meta.videos;
                  useStremioLibraryStore.getState().updateLibraryItem(metaId, {
                    videos,
                    videoCount: videos.length,
                  });
                }
              }
            }

            if (videos) {
              const watchedIds = await decodeStremioWatched(base?.state?.watched, videos);
              const watchStore = useStremioWatchStore.getState();

              for (const v of videos) {
                if (watchStore.episodeProgress[v.id]?.finished) {
                  watchedIds.add(v.id);
                }
              }

              if (isFinished) {
                watchedIds.add(videoId);
              }

              if (watchedIds.size > 0) {
                const watchedStr = await encodeStremioWatched(watchedIds, videos);
                state.watched = watchedStr;
              }
            }
          }

          // Determine removed and temp flags following Stremio standard (matching Harbor)
          let removed = base ? base.removed === true : true;
          let temp = base ? (base.temp === true || base.temp === undefined) : true;

          // If the item is in the local watchlist, treat it as a watchlist item (temp = false)
          const isWatchlistItem = useStremioLibraryStore.getState().isInLibrary(metaId);
          if (isWatchlistItem) {
            temp = false;
            removed = false;
          }

          if (temp && state.timesWatched === 0) {
            removed = true;
          }
          if (removed) {
            temp = true;
          }

          const item: StremioLibraryItem = {
            _id: metaId,
            name: base?.name ?? name,
            type,
            poster: base?.poster ?? poster,
            posterShape: base?.posterShape ?? 'poster',
            removed,
            temp,
            _mtime: now,
            state,
            behaviorHints: base?.behaviorHints,
          };

          // Update local cloudLibraryItems state
          set((s) => ({
            cloudLibraryItems: s.cloudLibraryItems.map((c) => c._id === metaId ? item : c).concat(
              s.cloudLibraryItems.some((c) => c._id === metaId) ? [] : [item]
            )
          }));

          await putStremioLibraryItem(authKey, item);
        } catch (e) {
          console.error('[Sync] Failed to sync playback progress to Stremio:', e);
        }
      },

      dismissFromContinueWatching: async (metaId: string, type: 'movie' | 'series') => {
        const { authKey, cloudLibraryItems } = get();

        // 1. Instantly update local Zustand cloud library items cache to clear progress
        const updatedCloudItems = cloudLibraryItems.map(item => {
          if (item._id === metaId) {
            return {
              ...item,
              state: {
                ...item.state,
                timeOffset: 0,
              },
              _mtime: new Date().toISOString(),
            };
          }
          return item;
        });
        set({ cloudLibraryItems: updatedCloudItems });

        // 2. Clear progress in local database and local history store
        import('../db').then(({ removeFromRecentlyWatched }) => {
          removeFromRecentlyWatched(metaId, type).catch(() => {});
        });
        useStremioWatchStore.getState().removeFromHistory(metaId);

        // 3. Sync update to Stremio Cloud if logged in
        if (authKey) {
          const cloudItem = cloudLibraryItems.find(x => x._id === metaId);
          if (cloudItem) {
            const updatedItem: StremioLibraryItem = {
              ...cloudItem,
              state: {
                ...cloudItem.state,
                timeOffset: 0,
              },
              _mtime: new Date().toISOString(),
            };
            await putStremioLibraryItem(authKey, updatedItem).catch(e => {
              console.error('[StremioAuthStore] Failed to sync Continue Watching dismissal:', e);
            });
          }
        }
      },
    }),
    {
      name: 'stremio-auth-store',
      partialize: (state) => ({
        authKey: state.authKey,
        user: state.user,
        syncLibrary: state.syncLibrary,
        syncProgress: state.syncProgress,
        syncAddons: state.syncAddons,
        lastSyncTime: state.lastSyncTime,
        cloudLibraryItems: state.cloudLibraryItems,
      }),
    }
  )
);

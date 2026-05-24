import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StremioStream } from '../types/stremio';

const FINISHED_THRESHOLD = 0.9;
const MAX_HISTORY = 20;

export interface StremioWatchEntry {
  metaId: string;
  type: 'movie' | 'series';
  name: string;
  poster?: string;
  /** 0–1 fraction watched (movie progress or last episode progress) */
  progressFraction: number;
  // Series tracking
  lastWatchedVideoId?: string;
  lastSeason?: number;
  lastEpisode?: number;
  /** Set when the last watched episode was finished (≥90%) */
  nextVideoId?: string;
  nextSeason?: number;
  nextEpisode?: number;
  watchedAt: number;
  lastSelectedStream?: StremioStream;
}

export interface StremioEpisodeProgress {
  videoId: string;
  metaId: string;
  season: number;
  episode: number;
  progressFraction: number;
  finished: boolean;
  watchedAt: number;
}

interface StremioWatchStore {
  history: StremioWatchEntry[];
  /** Keyed by StremioVideo.id */
  episodeProgress: Record<string, StremioEpisodeProgress>;

  recordMovieWatch: (metaId: string, name: string, poster?: string, lastSelectedStream?: StremioStream) => void;
  updateMovieProgress: (metaId: string, progressFraction: number) => void;

  recordEpisodeStart: (
    metaId: string,
    name: string,
    poster: string | undefined,
    videoId: string,
    season: number,
    episode: number,
    nextVideoId?: string,
    nextSeason?: number,
    nextEpisode?: number,
    lastSelectedStream?: StremioStream
  ) => void;

  updateEpisodeProgress: (
    metaId: string,
    videoId: string,
    progressFraction: number,
    season: number,
    episode: number,
    nextVideoId?: string,
    nextSeason?: number,
    nextEpisode?: number
  ) => void;

  getEpisodeWatched: (videoId: string) => boolean;
  getEpisodeProgressFraction: (videoId: string) => number;
  toggleEpisodeWatched: (videoId: string, metaId: string, season: number, episode: number) => void;
  removeFromHistory: (metaId: string) => void;
  clearHistory: () => void;
}

export const useStremioWatchStore = create<StremioWatchStore>()(
  persist(
    (set, get) => ({
      history: [],
      episodeProgress: {},

      recordMovieWatch: (metaId, name, poster, lastSelectedStream) => {
        set((state) => {
          const existing = state.history.find((h) => h.metaId === metaId);
          const entry: StremioWatchEntry = {
            metaId,
            type: 'movie',
            name,
            poster,
            progressFraction: existing?.progressFraction ?? 0,
            watchedAt: Date.now(),
            lastSelectedStream: lastSelectedStream ?? existing?.lastSelectedStream,
          };
          const filtered = state.history.filter((h) => h.metaId !== metaId);
          return { history: [entry, ...filtered].slice(0, MAX_HISTORY) };
        });
      },

      updateMovieProgress: (metaId, progressFraction) => {
        set((state) => {
          const idx = state.history.findIndex((h) => h.metaId === metaId);
          if (idx === -1) return state;
          const updated = [...state.history];
          updated[idx] = { ...updated[idx], progressFraction };
          return { history: updated };
        });
      },

      recordEpisodeStart: (metaId, name, poster, videoId, season, episode, nextVideoId, nextSeason, nextEpisode, lastSelectedStream) => {
        const now = Date.now();
        set((state) => {
          const existingEntry = state.history.find((h) => h.metaId === metaId);
          const existingEp = state.episodeProgress[videoId];

          const epProgress: StremioEpisodeProgress = {
            videoId,
            metaId,
            season,
            episode,
            progressFraction: existingEp?.progressFraction ?? 0,
            finished: existingEp?.finished ?? false,
            watchedAt: now,
          };

          const entry: StremioWatchEntry = {
            metaId,
            type: 'series',
            name,
            poster,
            progressFraction: existingEp?.progressFraction ?? 0,
            lastWatchedVideoId: videoId,
            lastSeason: season,
            lastEpisode: episode,
            // Inherit next episode if previously computed as finished; otherwise use passed values
            nextVideoId: existingEp?.finished ? (nextVideoId ?? existingEntry?.nextVideoId) : existingEntry?.nextVideoId,
            nextSeason: existingEp?.finished ? (nextSeason ?? existingEntry?.nextSeason) : existingEntry?.nextSeason,
            nextEpisode: existingEp?.finished ? (nextEpisode ?? existingEntry?.nextEpisode) : existingEntry?.nextEpisode,
            watchedAt: now,
            lastSelectedStream: lastSelectedStream ?? existingEntry?.lastSelectedStream,
          };

          const filtered = state.history.filter((h) => h.metaId !== metaId);
          return {
            history: [entry, ...filtered].slice(0, MAX_HISTORY),
            episodeProgress: { ...state.episodeProgress, [videoId]: epProgress },
          };
        });
      },

      updateEpisodeProgress: (metaId, videoId, progressFraction, season, episode, nextVideoId, nextSeason, nextEpisode) => {
        const finished = progressFraction >= FINISHED_THRESHOLD;
        set((state) => {
          const existingEp = state.episodeProgress[videoId];
          const epProgress: StremioEpisodeProgress = {
            videoId,
            metaId,
            season,
            episode,
            progressFraction,
            finished,
            watchedAt: Date.now(),
          };

          const historyIdx = state.history.findIndex((h) => h.metaId === metaId);
          let newHistory = [...state.history];
          if (historyIdx !== -1) {
            newHistory[historyIdx] = {
              ...newHistory[historyIdx],
              progressFraction,
              lastWatchedVideoId: videoId,
              lastSeason: season,
              lastEpisode: episode,
              // When finished, promote next episode; when in progress, clear next so card shows "Continue"
              nextVideoId: finished ? nextVideoId : undefined,
              nextSeason: finished ? nextSeason : undefined,
              nextEpisode: finished ? nextEpisode : undefined,
            };
          }

          void existingEp; // consumed above
          return {
            history: newHistory,
            episodeProgress: { ...state.episodeProgress, [videoId]: epProgress },
          };
        });
      },

      getEpisodeWatched: (videoId) => {
        return get().episodeProgress[videoId]?.finished ?? false;
      },

      getEpisodeProgressFraction: (videoId) => {
        return get().episodeProgress[videoId]?.progressFraction ?? 0;
      },

      toggleEpisodeWatched: (videoId, metaId, season, episode) => {
        const state = get();
        const current = state.episodeProgress[videoId];
        const isFinished = current?.finished ?? false;

        if (isFinished) {
          set((s) => {
            const next = { ...s.episodeProgress };
            delete next[videoId];
            return { episodeProgress: next };
          });
          import('../db').then(({ deleteEpisodeHistory }) => {
            deleteEpisodeHistory(videoId).catch(() => {});
          });
        } else {
          const now = Date.now();
          const epProgress: StremioEpisodeProgress = {
            videoId,
            metaId,
            season,
            episode,
            progressFraction: 1,
            finished: true,
            watchedAt: now,
          };
          set((s) => ({
            episodeProgress: { ...s.episodeProgress, [videoId]: epProgress },
          }));
          import('../db').then(({ recordEpisodeWatch }) => {
            recordEpisodeWatch(
              videoId,
              metaId,
              'stremio',
              season,
              episode,
              '',
              0,
              0
            ).catch(() => {});
          });
        }
      },

      removeFromHistory: (metaId) => {
        set((state) => ({
          history: state.history.filter((h) => h.metaId !== metaId),
        }));
      },

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'stremio-watch-history',
    }
  )
);

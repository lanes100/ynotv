import { useState, useEffect, useRef, useCallback } from 'react';
import type { VodPlayInfo } from '../types/media';
import { fetchIntroSegments } from '../services/introdb';
import { db } from '../db';
import { Bridge } from '../services/tauri-bridge';

interface UseSkipIntroOptions {
  vodInfo: VodPlayInfo | null;
  playing: boolean;
  position: number;
  duration: number;
  stremioEpisodeRef?: React.MutableRefObject<{
    metaId: string;
    name: string;
    poster?: string;
    videoId: string;
    season: number;
    episode: number;
    nextVideoId?: string;
    nextSeason?: number;
    nextEpisode?: number;
  } | null>;
}

interface SkipIntroSettings {
  skipIntroTimerSeconds: number;
  skipIntroAutoSkip: boolean;
}

const DEFAULT_SETTINGS: SkipIntroSettings = {
  skipIntroTimerSeconds: 10,
  skipIntroAutoSkip: false,
};

export function useSkipIntro(options: UseSkipIntroOptions) {
  const { vodInfo, playing, position, duration, stremioEpisodeRef } = options;
  const [showButton, setShowButton] = useState(false);
  const [countdown, setCountdown] = useState(DEFAULT_SETTINGS.skipIntroTimerSeconds);

  const introRef = useRef<{ start: number; end: number } | null>(null);
  const dismissedRef = useRef(false);
  const fetchingRef = useRef(false);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const episodeKeyRef = useRef<string | null>(null);
  const settingsRef = useRef<SkipIntroSettings>({ ...DEFAULT_SETTINGS });
  const autoSkipTriggeredRef = useRef(false);

  const currentEpisodeKey = vodInfo?.mediaId || vodInfo?.url || null;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Partial<SkipIntroSettings>>).detail;
      if (typeof detail.skipIntroTimerSeconds === 'number' && detail.skipIntroTimerSeconds >= 3) {
        settingsRef.current.skipIntroTimerSeconds = detail.skipIntroTimerSeconds;
      }
      if (typeof detail.skipIntroAutoSkip === 'boolean') {
        settingsRef.current.skipIntroAutoSkip = detail.skipIntroAutoSkip;
      }
    };
    window.addEventListener('ynotv:skip-intro-settings-changed', handler);
    return () => window.removeEventListener('ynotv:skip-intro-settings-changed', handler);
  }, []);

  useEffect(() => {
    if (currentEpisodeKey === episodeKeyRef.current) return;
    episodeKeyRef.current = currentEpisodeKey;
    introRef.current = null;
    dismissedRef.current = false;
    fetchingRef.current = false;
    autoSkipTriggeredRef.current = false;
    setShowButton(false);
    setCountdown(settingsRef.current.skipIntroTimerSeconds);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, [currentEpisodeKey]);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!vodInfo || !playing || fetchingRef.current) return;
    if (vodInfo.type !== 'series') {
      return;
    }
    if (introRef.current) {
      return;
    }

    const fetchIntro = async () => {
      fetchingRef.current = true;

      let imdbId: string | undefined;
      let season: number | undefined;
      let episode: number | undefined;

      if ((vodInfo.source_id === 'stremio' || vodInfo.source_id === 'nuvio') && stremioEpisodeRef?.current) {
        imdbId = stremioEpisodeRef.current.metaId;
        season = stremioEpisodeRef.current.season;
        episode = stremioEpisodeRef.current.episode;
      } else {
        season = vodInfo.seasonNum;
        episode = vodInfo.episodeNum;

        if (vodInfo.mediaId && vodInfo.mediaId.startsWith('tt')) {
          imdbId = vodInfo.mediaId;
        } else if (vodInfo.mediaId && vodInfo.mediaId.includes('_ep_')) {
          const parts = vodInfo.mediaId.split('_ep_');
          if (parts[0] && parts[0].startsWith('tt')) {
            imdbId = parts[0];
          }
        }

        if (!imdbId && vodInfo.seriesId) {
          try {
            const series = await db.vodSeries.get(vodInfo.seriesId);
            if (series?.imdb_id) {
              imdbId = series.imdb_id;
            }
          } catch (e) {
            // DB lookup failed
          }
        }
      }

      if (!imdbId) {
        fetchingRef.current = false;
        return;
      }
      if (!season || !episode) {
        fetchingRef.current = false;
        return;
      }

      const segment = await fetchIntroSegments(imdbId, season, episode);
      if (segment) {
        introRef.current = { start: segment.start_sec, end: segment.end_sec };
      }
      fetchingRef.current = false;
    };

    fetchIntro();
  }, [vodInfo, playing, stremioEpisodeRef]);

  useEffect(() => {
    if (!introRef.current) {
      return;
    }

    const { start, end } = introRef.current;

    if (!playing) {
      return;
    }

    if (position >= end) {
      if (showButton) {
        setShowButton(false);
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }
      return;
    }

    if (position >= start && settingsRef.current.skipIntroAutoSkip && !autoSkipTriggeredRef.current) {
      autoSkipTriggeredRef.current = true;
      dismissedRef.current = true;
      Bridge.seek(end).catch(() => {});
      return;
    }

    if (position >= start && !dismissedRef.current && !showButton && !settingsRef.current.skipIntroAutoSkip) {
      const timer = settingsRef.current.skipIntroTimerSeconds;
      setShowButton(true);
      setCountdown(timer);

      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }

      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            dismissedRef.current = true;
            setShowButton(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [position, playing, showButton]);

  const handleSkip = useCallback(() => {
    if (!introRef.current) return;
    dismissedRef.current = true;
    setShowButton(false);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    Bridge.seek(introRef.current.end).catch(() => {});
  }, []);

  return { showButton, countdown, handleSkip };
}
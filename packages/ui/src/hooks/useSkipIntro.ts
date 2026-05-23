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

  // Listen for settings changes (hot-reload)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Partial<SkipIntroSettings>>).detail;
      if (typeof detail.skipIntroTimerSeconds === 'number' && detail.skipIntroTimerSeconds >= 3) {
        settingsRef.current.skipIntroTimerSeconds = detail.skipIntroTimerSeconds;
        console.log('[SkipIntro] Timer updated to:', detail.skipIntroTimerSeconds);
      }
      if (typeof detail.skipIntroAutoSkip === 'boolean') {
        settingsRef.current.skipIntroAutoSkip = detail.skipIntroAutoSkip;
        console.log('[SkipIntro] Auto-skip updated to:', detail.skipIntroAutoSkip);
      }
    };
    window.addEventListener('ynotv:skip-intro-settings-changed', handler);
    return () => window.removeEventListener('ynotv:skip-intro-settings-changed', handler);
  }, []);

  // Reset everything when episode changes
  useEffect(() => {
    if (currentEpisodeKey === episodeKeyRef.current) return;
    console.log('[SkipIntro] Episode changed:', currentEpisodeKey);
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

  // Clear countdown timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  // Fetch intro segments when a new episode starts playing
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

      if (vodInfo.source_id === 'stremio' && stremioEpisodeRef?.current) {
        imdbId = stremioEpisodeRef.current.metaId;
        season = stremioEpisodeRef.current.season;
        episode = stremioEpisodeRef.current.episode;
        console.log('[SkipIntro] Stremio: imdbId=', imdbId, 'season=', season, 'episode=', episode);
      } else {
        season = vodInfo.seasonNum;
        episode = vodInfo.episodeNum;
        console.log('[SkipIntro] VOD: seasonNum=', season, 'episodeNum=', episode);

        if (vodInfo.mediaId && vodInfo.mediaId.startsWith('tt')) {
          imdbId = vodInfo.mediaId;
        } else if (vodInfo.mediaId && vodInfo.mediaId.includes('_ep_')) {
          const parts = vodInfo.mediaId.split('_ep_');
          if (parts[0] && parts[0].startsWith('tt')) {
            imdbId = parts[0];
          }
        }

        if (!imdbId && vodInfo.seriesId) {
          console.log('[SkipIntro] Looking up imdb_id from DB for series:', vodInfo.seriesId);
          try {
            const series = await db.vodSeries.get(vodInfo.seriesId);
            if (series?.imdb_id) {
              imdbId = series.imdb_id;
              console.log('[SkipIntro] Found imdb_id in DB:', imdbId);
            } else {
              console.log('[SkipIntro] No imdb_id found in DB for series');
            }
          } catch (e) {
            console.log('[SkipIntro] DB lookup error:', e);
          }
        }
      }

      if (!imdbId) {
        console.log('[SkipIntro] No imdbId available, skipping');
        fetchingRef.current = false;
        return;
      }
      if (!season || !episode) {
        console.log('[SkipIntro] No season/episode available, skipping');
        fetchingRef.current = false;
        return;
      }

      const segment = await fetchIntroSegments(imdbId, season, episode);
      if (segment) {
        introRef.current = { start: segment.start_sec, end: segment.end_sec };
        console.log('[SkipIntro] Stored intro:', introRef.current);
      } else {
        console.log('[SkipIntro] No intro segment returned from API');
      }
      fetchingRef.current = false;
    };

    fetchIntro();
  }, [vodInfo, playing, stremioEpisodeRef]);

  // Track position to show/hide the skip button or auto-skip
  useEffect(() => {
    if (!introRef.current) {
      return;
    }

    const { start, end } = introRef.current;
    console.log('[SkipIntro] Position check: pos=', position, 'intro=[', start, '-', end, ']', 'playing=', playing, 'dismissed=', dismissedRef.current, 'showButton=', showButton);

    if (!playing) {
      return;
    }

    if (position >= end) {
      if (showButton) {
        console.log('[SkipIntro] Past intro end, hiding button');
        setShowButton(false);
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }
      return;
    }

    // Auto-skip if enabled and not already triggered
    if (position >= start && settingsRef.current.skipIntroAutoSkip && !autoSkipTriggeredRef.current) {
      console.log('[SkipIntro] Auto-skipping to:', end);
      autoSkipTriggeredRef.current = true;
      dismissedRef.current = true;
      Bridge.seek(end).catch(() => {});
      return;
    }

    // Show button if within intro range and not dismissed
    if (position >= start && !dismissedRef.current && !showButton && !settingsRef.current.skipIntroAutoSkip) {
      const timer = settingsRef.current.skipIntroTimerSeconds;
      console.log('[SkipIntro] Inside intro range, showing button for', timer, 'seconds');
      setShowButton(true);
      setCountdown(timer);

      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }

      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            console.log('[SkipIntro] Countdown expired, dismissing');
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
    console.log('[SkipIntro] Skipping to:', introRef.current.end);
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

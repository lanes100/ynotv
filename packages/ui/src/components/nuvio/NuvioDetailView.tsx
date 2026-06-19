import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { StremioMeta, StremioStream, StremioVideo, StremioStreamBadge, StreamAutoPlayMode, StreamAutoPlaySourceScope } from '../../types/stremio';
import { useNuvioAddonStore } from '../../stores/nuvioAddonStore';
import { useNuvioPluginStore } from '../../stores/nuvioPluginStore';
import { useNuvioAuthStore } from '../../stores/nuvioAuthStore';
import { fetchMeta, fetchStreams } from '../../services/stremio-addon';
import { executePlugin } from '../../services/nuvio-plugin-runtime';
import { pushNuvioLibrary, fetchNuvioLibrary, fetchNuvioWatchProgress, pushNuvioWatchProgress, type NuvioLibrarySyncItem } from '../../services/nuvio-api';
import type { NuvioWatchProgressSyncEntry } from '../../services/nuvio-api';
import { extractStreamBadges, isLightColor, formatVideoSize } from '../../utils/streamBadges';
import { useLazyStremioCast, type StremioCastMember } from '../../hooks/useLazyStremioCast';
import { useLazyStremioTrailer } from '../../hooks/useLazyStremioTrailer';
import { useLazyStremioRecommendations, type RecommendationItem } from '../../hooks/useLazyStremioRecommendations';
import { useTmdbAccessToken } from '../../hooks/useTmdbLists';
import { getMovieDetails, getTvShowDetails, getTmdbImageUrl, tmdbPersonIdByName } from '../../services/tmdb';
import { useDownloadStore } from '../../stores/downloadStore';
import { useNuvioPreselectVideoId, useSetNuvioPreselectVideoId } from '../../stores/uiStore';
import '../stremio/StremioDetail.css';

export interface NuvioMeta {
  id: string;
  type: string;
  name: string;
  poster?: string | null;
  background?: string | null;
  logo?: string | null;
}

interface NuvioDetailViewProps {
  meta: NuvioMeta;
  onBack: () => void;
  onPlay: (stream: StremioStream, meta: NuvioMeta, episodeVideo?: StremioVideo) => void;
  onNavigate?: (meta: StremioMeta) => void;
  showStreamBadges?: boolean;
  compiledBadgeRules?: { pattern: RegExp; badge: StremioStreamBadge }[];
  showFileSizeBadges?: boolean;
  streamBadgePlacement?: 'top' | 'bottom';
  library?: NuvioLibrarySyncItem[];
  onUpdateLibrary?: (newLibrary: NuvioLibrarySyncItem[]) => void;
  nuvioAutoPlayMode?: StreamAutoPlayMode;
  nuvioAutoPlayTimeout?: number;
  nuvioAutoPlaySourceScope?: StreamAutoPlaySourceScope;
  nuvioAutoPlayAllowedAddons?: string[];
  nuvioAutoPlayAllowedPlugins?: string[];
  nuvioAutoPlayRegex?: string;
}

function formatReleaseDate(dStr?: string) {
  if (!dStr) return '';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dStr;
  }
}

export function NuvioDetailView({
  meta,
  onBack,
  onPlay,
  onNavigate,
  showStreamBadges = true,
  compiledBadgeRules = [],
  showFileSizeBadges = true,
  streamBadgePlacement = 'bottom',
  library = [],
  onUpdateLibrary,
  nuvioAutoPlayMode = 'manual',
  nuvioAutoPlayTimeout = 0,
  nuvioAutoPlaySourceScope = 'all',
  nuvioAutoPlayAllowedAddons = [],
  nuvioAutoPlayAllowedPlugins = [],
  nuvioAutoPlayRegex = '',
}: NuvioDetailViewProps) {
  const addons = useNuvioAddonStore((s) => s.enabledAddons);
  const pluginStore = useNuvioPluginStore();
  const token = useNuvioAuthStore((s) => s.token);
  const profile = useNuvioAuthStore((s) => s.activeProfile);

  const metaRef = useRef(meta);
  useEffect(() => { metaRef.current = meta; }, [meta]);

  const onPlayRef = useRef(onPlay);
  useEffect(() => { onPlayRef.current = onPlay; }, [onPlay]);

  const tmdbToken = useTmdbAccessToken();
  const { cast, loading: castLoading } = useLazyStremioCast(meta as unknown as StremioMeta, tmdbToken);
  const { trailerUrl: tmdbTrailerUrl } = useLazyStremioTrailer(meta as unknown as StremioMeta, tmdbToken);
  const { items: recommendations, loading: recsLoading } = useLazyStremioRecommendations(meta as unknown as StremioMeta, tmdbToken);

  // Full metadata from Stremio addons
  const [fullMeta, setFullMeta] = useState<StremioMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Library & watch progress
  const inLibrary = library.some((i) => i.content_id === meta.id);
  const [episodeProgress, setEpisodeProgress] = useState<Record<string, { progressFraction: number; finished: boolean }>>({});

  // Streams
  const [streams, setStreams] = useState<StremioStream[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<StremioVideo | null>(null);
  const [loadingStreams, setLoadingStreams] = useState(false);

  // UI state
  const [selectedSeason, setSelectedSeason] = useState<number | undefined>(undefined);
  const [selectedAddonFilter, setSelectedAddonFilter] = useState('All');
  const [videoSearch, setVideoSearch] = useState('');
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  const autoPlayTriggeredRef = useRef<string | null>(null);

  const startDownload = useDownloadStore((s) => s.startDownload);

  const activeRef = useRef(true);
  const fetchedIdsRef = useRef<Set<string>>(new Set());

  // ─── Fetch full metadata ───────────────────────────────────
  useEffect(() => {
    if (!meta.id || fetchedIdsRef.current.has(meta.id)) return;

    const isTmdbId = meta.id.startsWith('tmdb:');
    const isSeriesItem = meta.type === 'series';
    const isIncomplete = isTmdbId;

    if (!isIncomplete) {
      // Still try to fetch from Stremio addons to enrich the minimal NuvioMeta
    }

    let active = true;

    const fetchFull = async () => {
      let activeToken = tmdbToken;
      if (!activeToken && window.storage) {
        try {
          const settings = await (window.storage as any).getSettings();
          activeToken = (settings.data as any)?.tmdbApiKey || null;
        } catch {}
      }

      if (isTmdbId && !activeToken) return;

      let imdbId: string | null = null;
      let tmdbDetails: any = null;
      const tmdbIdStr = isTmdbId ? meta.id.replace('tmdb:', '') : null;

      if (isTmdbId && tmdbIdStr && activeToken) {
        try {
          const idNum = parseInt(tmdbIdStr, 10);
          if (!isNaN(idNum)) {
            if (isSeriesItem) {
              tmdbDetails = await getTvShowDetails(activeToken, idNum);
              imdbId = tmdbDetails.external_ids?.imdb_id || null;
            } else {
              tmdbDetails = await getMovieDetails(activeToken, idNum);
              imdbId = tmdbDetails.imdb_id || null;
            }
          }
        } catch (err) {
          console.error('[NuvioDetailView] TMDB fetch failed:', meta.id, err);
        }
      } else if (!isTmdbId) {
        imdbId = meta.id;
      }

      if (!active) return;

      let fetched: StremioMeta | null = null;
      if (imdbId) {
        try {
          fetched = await fetchMeta(addons, meta.type, imdbId);
        } catch {}
      }

      if (!active) return;
      fetchedIdsRef.current.add(meta.id);

      if (fetched) {
        setFullMeta(fetched);
        if (fetched.videos) {
          const s = [...new Set(fetched.videos.map((v) => v.season).filter((s): s is number => s != null && s > 0))].sort((a, b) => a - b);
          if (s.length > 0) setSelectedSeason(s[0]);
        }
      } else if (tmdbDetails) {
        const enriched: StremioMeta = {
          ...(metaRef.current as any),
          id: imdbId || meta.id,
          type: meta.type,
          name: meta.name,
          description: tmdbDetails.overview || undefined,
          genres: tmdbDetails.genres?.map((g: any) => g.name) || undefined,
          runtime: tmdbDetails.runtime ? `${tmdbDetails.runtime} min` : undefined,
          background: getTmdbImageUrl(tmdbDetails.backdrop_path, 'original') || meta.background || undefined,
          poster: meta.poster || undefined,
        };
        setFullMeta(enriched);
      } else {
        // Minimal fallback: use NuvioMeta as StremioMeta
        setFullMeta({
          id: meta.id,
          type: meta.type,
          name: meta.name,
          poster: meta.poster || undefined,
          background: meta.background || undefined,
        });
      }
      setLoadingMeta(false);
    };

    fetchFull();

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, meta.type, tmdbToken, addons.map((a) => `${a.id}:${a.enabled !== false}`).join(','), setFullMeta]);

  // (Library state is passed down as a prop)

  // ─── Fetch watch progress ──────────────────────────────────
  const loadWatchProgress = useCallback(() => {
    if (!token || !profile || meta.type !== 'series') return;
    fetchNuvioWatchProgress(token, profile.profile_index, null, 500)
      .then((items: NuvioWatchProgressSyncEntry[]) => {
        const map: Record<string, { progressFraction: number; finished: boolean }> = {};
        for (const item of items) {
          if (item.content_id === meta.id) {
            const fraction = item.duration > 0 ? item.position / item.duration : 0;
            map[item.video_id] = { progressFraction: Math.min(1, Math.max(0, fraction)), finished: fraction >= 0.92 };
          }
        }
        setEpisodeProgress(map);
      })
      .catch(() => {});
  }, [token, profile?.profile_index, meta.id, meta.type]);

  useEffect(() => {
    loadWatchProgress();
  }, [loadWatchProgress]);

  useEffect(() => {
    const syncHandler = () => {
      loadWatchProgress();
    };
    window.addEventListener('ynotv:nuvio-sync-required', syncHandler);
    return () => window.removeEventListener('ynotv:nuvio-sync-required', syncHandler);
  }, [loadWatchProgress]);

  // ─── Auto-select preselected video (from Continue Watching) ─
  const preselectVideoId = useNuvioPreselectVideoId();
  const setPreselectVideoId = useSetNuvioPreselectVideoId();

  useEffect(() => {
    if (meta.type !== 'series' || !preselectVideoId || !fullMeta || !fullMeta.videos) return;
    const video = fullMeta.videos.find((v) => v.id === preselectVideoId);
    if (video) {
      if (video.season != null) setSelectedSeason(video.season);
      setSelectedVideo(video);
      setPreselectVideoId(null);
    }
  }, [meta.type, preselectVideoId, fullMeta, setPreselectVideoId]);

  // ─── Fetch streams (addons + plugins) ──────────────────────
  const fetchStreamsWithPlugins = useCallback(async (
    addonsList: any[],
    type: string,
    id: string,
    onStreams?: (streams: StremioStream[]) => void
  ): Promise<StremioStream[]> => {
    const collected: StremioStream[] = [];

    // 1. Nuvio addons
    const addonPromise = fetchStreams(addonsList, type, id, (incoming) => {
      if (!activeRef.current) return;
      collected.push(...incoming);
      onStreams?.([...collected]);
    });

    // 2. Nuvio plugin scrapers
    let scraperPromise: Promise<void> = Promise.resolve();
    if (pluginStore.pluginsEnabled && pluginStore.scrapers.length > 0) {
      scraperPromise = (async () => {
        const enabled = pluginStore.scrapers.filter((s) => s.enabled);
        for (const scraper of enabled) {
          if (!activeRef.current) break;
          try {
            const season = type === 'series' ? (selectedSeason ?? null) : null;
            const episode = type === 'series' ? null : null;
            const parts = id.split(':');
            const epSeason = parts.length >= 3 ? parseInt(parts[1], 10) : null;
            const epEpisode = parts.length >= 3 ? parseInt(parts[2], 10) : null;
            const results = await executePlugin(
              scraper.code,
              meta.id,
              meta.type,
              epSeason ?? season,
              epEpisode ?? episode,
              scraper.id,
              (scraper as any).settings ?? {}
            );
            if (!activeRef.current) break;
            const scraperStreams: StremioStream[] = results.map((r: any) => ({
              name: r.title || scraper.name,
              title: r.quality || '',
              url: r.url,
              addonName: `⚙ ${scraper.name}`,
            }));
            collected.push(...scraperStreams);
            onStreams?.([...collected]);
          } catch (e) {
            console.warn('[NuvioDetailView] Scraper error:', scraper.id, e);
          }
        }
      })();
    }

    await Promise.all([addonPromise, scraperPromise]);
    return collected;
  }, [addons, meta.id, meta.type, pluginStore, selectedSeason]);

  // Stable ref to avoid re-running effects when fetchStreamsWithPlugins identity changes
  const fetchStreamsRef = useRef(fetchStreamsWithPlugins);
  useEffect(() => { fetchStreamsRef.current = fetchStreamsWithPlugins; }, [fetchStreamsWithPlugins]);

  // Movie streams on mount
  useEffect(() => {
    if (meta.type === 'series') return;
    let active = true;
    const loadStreams = async () => {
      setStreams([]);
      setLoadingStreams(true);
      const currentAddons = useNuvioAddonStore.getState().enabledAddons;
      await fetchStreamsRef.current(currentAddons, meta.type, meta.id, (newStreams) => {
        if (!active) return;
        setStreams((prev) => [...prev, ...newStreams]);
      });
      if (!active) return;
      setLoadingStreams(false);
    };
    loadStreams();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, meta.type, addons.map((a) => `${a.id}:${a.enabled !== false}`).join(',')]);

  // Series streams when episode selected
  useEffect(() => {
    if (meta.type !== 'series' || !selectedVideo) return;
    let active = true;
    const loadStreams = async () => {
      setStreams([]);
      setLoadingStreams(true);
      const currentAddons = useNuvioAddonStore.getState().enabledAddons;
      await fetchStreamsRef.current(currentAddons, 'series', selectedVideo.id, (newStreams) => {
        if (!active) return;
        setStreams((prev) => [...prev, ...newStreams]);
      });
      if (!active) return;
      setLoadingStreams(false);
    };
    loadStreams();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideo, addons.map((a) => `${a.id}:${a.enabled !== false}`).join(',')]);

  // ─── Computed values ───────────────────────────────────────
  const isSeries = meta.type === 'series';
  const effectiveMeta: StremioMeta = fullMeta ?? {
    id: meta.id,
    type: meta.type,
    name: meta.name,
    poster: meta.poster || undefined,
    background: meta.background || undefined,
  };
  const effectiveMetaRef = useRef<StremioMeta>(effectiveMeta);
  useEffect(() => {
    effectiveMetaRef.current = effectiveMeta;
  }, [effectiveMeta]);
  const effectiveTrailerUrl = effectiveMeta.trailer || tmdbTrailerUrl;

  const seasons = useMemo(() => {
    if (!isSeries || !effectiveMeta.videos) return [];
    const s = new Set<number>();
    for (const v of effectiveMeta.videos) {
      if (v.season !== undefined) s.add(v.season);
    }
    return Array.from(s).sort((a, b) => a - b);
  }, [isSeries, effectiveMeta.videos]);

  const seasonEpisodes = useMemo(() => {
    if (!isSeries || !effectiveMeta.videos || selectedSeason === undefined) return [];
    return effectiveMeta.videos
      .filter((v) => v.season === selectedSeason)
      .sort((a, b) => (a.episode || 0) - (b.episode || 0));
  }, [isSeries, effectiveMeta.videos, selectedSeason]);

  const filteredEpisodes = useMemo(() => {
    if (!seasonEpisodes.length) return [];
    if (!videoSearch.trim()) return seasonEpisodes;
    const q = videoSearch.toLowerCase();
    return seasonEpisodes.filter(
      (ep) =>
        (ep.title && ep.title.toLowerCase().includes(q)) ||
        (ep.episode !== undefined && ep.episode.toString() === q)
    );
  }, [seasonEpisodes, videoSearch]);

  const addonNames = useMemo(() => {
    const names = new Set<string>();
    for (const stream of streams) {
      if (stream.addonName) names.add(stream.addonName);
    }
    return Array.from(names).sort();
  }, [streams]);

  useEffect(() => { setSelectedAddonFilter('All'); }, [streams]);

  const filteredStreams = useMemo(() => {
    if (selectedAddonFilter === 'All') return streams;
    return streams.filter((s) => s.addonName === selectedAddonFilter);
  }, [streams, selectedAddonFilter]);

  // Set default season
  useEffect(() => {
    if (isSeries && seasons.length > 0 && selectedSeason === undefined) {
      const preferred = seasons.find((s) => s >= 1) ?? seasons[0];
      setSelectedSeason(preferred);
    }
  }, [isSeries, seasons, selectedSeason]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleDownloadStream = useCallback(
    async (stream: StremioStream, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!stream.url) return;
      setDownloadingUrl(stream.url);
      try {
        let title = '';
        if (isSeries && selectedVideo) {
          title = `${effectiveMeta.name} - S${selectedVideo.season}E${selectedVideo.episode}${selectedVideo.title ? ` - ${selectedVideo.title}` : ''}`;
        } else {
          title = `${effectiveMeta.name}${effectiveMeta.year ? ` (${effectiveMeta.year})` : ''}`;
        }
        await startDownload(title, stream.url, undefined, undefined, undefined, effectiveMeta.poster);
      } catch (error) {
        console.error('[NuvioDetailView] Download failed:', error);
        alert('Failed to start download');
      } finally {
        setDownloadingUrl(null);
      }
    },
    [effectiveMeta, isSeries, selectedVideo, startDownload]
  );

  const handleEpisodeClick = useCallback((ep: StremioVideo) => {
    setSelectedVideo(ep);
  }, []);

  const handleLibraryToggle = async () => {
    if (inLibrary) return; // No remove API yet
    if (!token || !profile) return;

    const libItem: NuvioLibrarySyncItem = {
      content_id: meta.id,
      content_type: meta.type === 'series' ? 'series' : 'movie',
      name: meta.name,
      poster: meta.poster || null,
      poster_shape: 'POSTER',
      background: meta.background || null,
      description: null,
      release_info: null,
      imdb_rating: null,
      genres: [],
      addon_base_url: null,
      added_at: Date.now(),
    };

    const updatedLibrary = [libItem, ...library.filter(i => i.content_id !== meta.id)];

    try {
      await pushNuvioLibrary(token, profile.profile_index, updatedLibrary);
      onUpdateLibrary?.(updatedLibrary);
    } catch (e) {
      console.error('[NuvioDetailView] Failed to add to library:', e);
    }
  };

  const handleToggleEpisodeWatched = async (ep: StremioVideo) => {
    const wasFinished = episodeProgress[ep.id]?.finished ?? false;
    setEpisodeProgress((prev) => ({
      ...prev,
      [ep.id]: { progressFraction: wasFinished ? 0 : 1, finished: !wasFinished },
    }));
    if (!wasFinished && token && profile) {
      try {
        await pushNuvioWatchProgress(token, profile.profile_index, [{
          content_id: meta.id,
          content_type: meta.type,
          video_id: ep.id,
          season: ep.season ?? null,
          episode: ep.episode ?? null,
          position: 0,
          duration: 0,
          last_watched: Date.now(),
          progress_key: `${meta.id}_s${ep.season}e${ep.episode}`,
        }]);
      } catch {}
    }
  };

  const handlePrevSeason = () => {
    if (selectedSeason === undefined) return;
    const idx = seasons.indexOf(selectedSeason);
    if (idx > 0) setSelectedSeason(seasons[idx - 1]);
  };

  const handleNextSeason = () => {
    if (selectedSeason === undefined) return;
    const idx = seasons.indexOf(selectedSeason);
    if (idx < seasons.length - 1) setSelectedSeason(seasons[idx + 1]);
  };

  const handleCastClick = useCallback((member: StremioCastMember) => {
    if (onNavigate && member.id) {
      onNavigate({ id: `tmdb:${member.id}`, type: 'person' as any, name: member.name } as any);
    }
  }, [onNavigate]);

  const handleRecClick = useCallback((rec: RecommendationItem) => {
    if (!onNavigate) return;
    const newMeta: StremioMeta = {
      id: `tmdb:${rec.id}`,
      type: meta.type,
      name: rec.title,
      poster: rec.posterUrl ?? undefined,
      year: rec.year ? parseInt(rec.year) : undefined,
      imdbRating: rec.rating > 0 ? String(rec.rating.toFixed(1)) : undefined,
    };
    onNavigate(newMeta);
  }, [meta.type, onNavigate]);

  // ─── Auto-play stream selection ─────────────────────────────
  useEffect(() => {
    if (nuvioAutoPlayMode === 'manual') return;
    if (loadingStreams || streams.length === 0) return;

    const contentKey = `${meta.id}:${selectedVideo?.id || ''}`;
    if (autoPlayTriggeredRef.current === contentKey) return;

    const eligible = filteredStreams.filter((s) => {
      if (nuvioAutoPlaySourceScope === 'installed-addons' && s.addonName?.startsWith('⚙ ')) return false;
      if (nuvioAutoPlaySourceScope === 'enabled-plugins' && s.addonName && !s.addonName.startsWith('⚙ ')) return false;
      if (nuvioAutoPlayAllowedAddons.length > 0 && s.addonName && !s.addonName.startsWith('⚙ ') && !nuvioAutoPlayAllowedAddons.includes(s.addonName)) return false;
      if (nuvioAutoPlayAllowedPlugins.length > 0 && s.addonName?.startsWith('⚙ ') && !nuvioAutoPlayAllowedPlugins.includes(s.addonName.replace('⚙ ', ''))) return false;
      return true;
    });

    if (eligible.length === 0) return;

    let selected = eligible[0];
    if (nuvioAutoPlayMode === 'regex-match') {
      if (!nuvioAutoPlayRegex) return;
      try {
        const pattern = nuvioAutoPlayRegex.trim();
        const userRegex = new RegExp(pattern, 'i');
        
        const exclusionMatches = [...pattern.matchAll(/\(\?!.*?\(([^)]+)\)\)/g)];
        const exclusionWords: string[] = [];
        for (const match of exclusionMatches) {
          if (match[1]) {
            match[1].split('|').forEach(word => {
              const trimmed = word.trim();
              if (trimmed) exclusionWords.push(trimmed);
            });
          }
        }
        
        const excludeRegex = exclusionWords.length > 0
          ? new RegExp(`\\b(${exclusionWords.join('|')})\\b`, 'i')
          : null;

        const matched = eligible.filter(stream => {
          const streamUrl = stream.url || '';
          const name = stream.name || '';
          const title = stream.title || '';
          const description = stream.description || '';
          const addonName = stream.addonName || '';
          
          const searchableText = `${addonName} ${name} ${title} ${description} ${streamUrl}`;
          
          if (!userRegex.test(searchableText)) return false;
          if (excludeRegex && excludeRegex.test(searchableText)) return false;
          
          return true;
        });

        if (matched.length === 0) return;
        selected = matched[0];
      } catch (err) {
        console.error("Invalid autoplay regex:", err);
        return;
      }
    }

    autoPlayTriggeredRef.current = contentKey;

    const timeoutMs = nuvioAutoPlayTimeout * 1000;
    const timer = setTimeout(() => {
      onPlayRef.current(selected, {
        id: effectiveMetaRef.current.id,
        type: effectiveMetaRef.current.type,
        name: effectiveMetaRef.current.name,
        poster: effectiveMetaRef.current.poster ?? null,
        background: effectiveMetaRef.current.background ?? null,
        logo: effectiveMetaRef.current.logo ?? null,
      }, selectedVideo ?? undefined);
    }, timeoutMs);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingStreams, streams.length, nuvioAutoPlayMode, nuvioAutoPlayTimeout, nuvioAutoPlaySourceScope, nuvioAutoPlayAllowedAddons.join(','), nuvioAutoPlayAllowedPlugins.join(','), nuvioAutoPlayRegex, meta.id, selectedVideo?.id]);

  const renderedStreams = useMemo(() => {
    return filteredStreams.map((stream, idx) => {
      const name = stream.name || '';
      const desc = stream.description || stream.title || '';
      const displayName = name.trim();
      const displayDesc = displayName ? desc : '';
      const badges = showStreamBadges ? extractStreamBadges(stream, compiledBadgeRules) : [];
      if (showStreamBadges && showFileSizeBadges && stream.behaviorHints?.videoSize) {
        const sizeStr = formatVideoSize(stream.behaviorHints.videoSize);
        if (sizeStr) {
          badges.push({
            label: sizeStr,
            color: '#4b5563',
          });
        }
      }

      const badgesContainer = badges.length > 0 && (
        <div className="stremio-detail-stream-badges" style={{ marginBottom: streamBadgePlacement === 'top' ? '8px' : '0', marginTop: streamBadgePlacement === 'top' ? '4px' : '0', '--stremio-badge-scale': 'var(--nuvio-badge-scale, 1)' } as React.CSSProperties}>
          {badges.map((badge) => {
            const bgColor = badge.color || '#1a1a1a';
            const isLightBg = isLightColor(bgColor);
            const textColor = badge.textColor || (isLightBg ? '#000000' : '#ffffff');
            return badge.imageUrl ? (
              <span
                key={badge.label}
                className="stremio-stream-badge-img"
                style={{
                  backgroundColor: bgColor,
                  borderColor: badge.borderColor,
                }}
              >
                <img src={badge.imageUrl} alt={badge.label} title={badge.label} />
              </span>
            ) : (
              <span
                key={badge.label}
                className="stremio-stream-badge"
                style={{
                  backgroundColor: bgColor,
                  color: textColor,
                  borderColor: badge.borderColor,
                }}
              >
                {badge.label}
              </span>
            );
          })}
        </div>
      );

      return (
        <div
          key={`stream-${idx}`}
          className="stremio-detail-stream-card"
          onClick={() => onPlay(stream, {
            id: effectiveMeta.id,
            type: effectiveMeta.type,
            name: effectiveMeta.name,
            poster: effectiveMeta.poster ?? null,
            background: effectiveMeta.background ?? null,
            logo: effectiveMeta.logo ?? null,
          }, selectedVideo ?? undefined)}
        >
          {stream.url && (
            <button
              className={`stremio-detail-stream-download-btn ${downloadingUrl === stream.url ? 'downloading' : ''}`}
              onClick={(e) => handleDownloadStream(stream, e)}
              disabled={downloadingUrl === stream.url}
              title="Download Stream"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {downloadingUrl === stream.url ? (
                  <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" style={{ transformOrigin: 'center', animation: 'spin 1.5s linear infinite' }} />
                ) : (
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
          )}
          {streamBadgePlacement === 'top' && badgesContainer}
          <div className="stremio-detail-stream-header-row">
            <div className="stremio-detail-stream-card-title">
              {displayName || desc || `Stream #${idx + 1}`}
            </div>
            {stream.addonName && (
              <span className="stremio-detail-stream-addon">
                via {stream.addonName}
              </span>
            )}
          </div>
          {streamBadgePlacement === 'bottom' && badgesContainer}
          {displayDesc && (
            <div className="stremio-detail-stream-description">
              {displayDesc}
            </div>
          )}
          {stream.infoHash && (
            <div className="stremio-detail-stream-hash">
              infoHash: {stream.infoHash.substring(0, 16)}...
              {stream.fileIdx !== undefined && ` | fileIdx: ${stream.fileIdx}`}
            </div>
          )}
        </div>
      );
    });
  }, [filteredStreams, downloadingUrl, handleDownloadStream, onPlay, meta, selectedVideo]);

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="stremio-detail">
      {/* Background Cover */}
      <div className="stremio-detail-backdrop-container">
        {effectiveMeta.background && (
          <img className="stremio-detail-backdrop" src={effectiveMeta.background} alt="" />
        )}
        <div className="stremio-detail-backdrop-overlay" />
      </div>

      <div className="stremio-detail-layout">
        {/* Left Side: Metadata & Description */}
        <div className="stremio-detail-left">
          <button className="stremio-detail-back-btn" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="stremio-detail-brand">
            {effectiveMeta.logo ? (
              <img className="stremio-detail-logo" src={effectiveMeta.logo} alt={effectiveMeta.name} />
            ) : (
              <h1 className="stremio-detail-title">{effectiveMeta.name}</h1>
            )}
          </div>

          <div className="stremio-detail-meta-line">
            {effectiveMeta.runtime && <span className="stremio-detail-meta-item">{effectiveMeta.runtime}</span>}
            {effectiveMeta.year && <span className="stremio-detail-meta-item">{effectiveMeta.year}</span>}
            {effectiveMeta.imdbRating && (
              <span className="stremio-detail-meta-item stremio-detail-imdb">
                {effectiveMeta.imdbRating} <span className="stremio-detail-imdb-badge">IMDb</span>
              </span>
            )}
          </div>

          {effectiveMeta.genres && effectiveMeta.genres.length > 0 && (
            <div className="stremio-detail-section">
              <div className="stremio-detail-section-label">GENRES</div>
              <div className="stremio-detail-tags">
                {effectiveMeta.genres.map((g) => (
                  <span key={g} className="stremio-detail-tag">{g}</span>
                ))}
              </div>
            </div>
          )}

          {(cast.length > 0 || castLoading) && (
            <div className="stremio-detail-section">
              <div className="stremio-detail-section-label">CAST</div>
              <div className="stremio-detail-cast-row">
                {castLoading && cast.length === 0 ? (
                  <div className="stremio-detail-cast-loading">Loading cast...</div>
                ) : (
                  cast.map((member) => (
                    <div
                      key={member.name}
                      className="stremio-detail-cast-member"
                      onClick={() => handleCastClick(member)}
                      title={`View ${member.name}`}
                    >
                      <div className="stremio-detail-cast-photo">
                        {member.photo ? (
                          <img src={member.photo} alt={member.name} loading="lazy" />
                        ) : (
                          <div className="stremio-detail-cast-photo-placeholder">
                            <span>{member.name.charAt(0)}</span>
                          </div>
                        )}
                      </div>
                      <span className="stremio-detail-cast-name">{member.name}</span>
                      {member.character && (
                        <span className="stremio-detail-cast-character">{member.character}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {effectiveMeta.cast && effectiveMeta.cast.length > 0 && cast.length === 0 && !castLoading && (
            <div className="stremio-detail-section">
              <div className="stremio-detail-section-label">CAST</div>
              <div className="stremio-detail-tags">
                {effectiveMeta.cast.slice(0, 10).map((c) => (
                  <span key={c} className="stremio-detail-tag" onClick={() => handleCastClick({ id: 0, name: c, character: '', photo: null })}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {effectiveMeta.description && (
            <div className="stremio-detail-section">
              <div className="stremio-detail-section-label">SUMMARY</div>
              <p className="stremio-detail-desc">{effectiveMeta.description}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="stremio-detail-actions">
            {effectiveTrailerUrl && (
              <button
                className="stremio-detail-action-btn"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('ynotv:play-url', {
                    detail: {
                      url: effectiveTrailerUrl,
                      title: `${effectiveMeta.name} - Trailer`,
                      backdropUrl: effectiveMeta.background,
                      logoUrl: effectiveMeta.logo,
                    },
                  }));
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                Trailer
              </button>
            )}

            <button
              className={`stremio-detail-action-btn ${inLibrary ? 'in-library' : ''}`}
              onClick={handleLibraryToggle}
            >
              {inLibrary ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  In Library
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                  </svg>
                  Add to Library
                </>
              )}
            </button>
          </div>

          {/* Recommendations */}
          {(recommendations.length > 0 || recsLoading) && (
            <div className="stremio-detail-section stremio-detail-recs-section">
              <div className="stremio-detail-section-label">RECOMMENDATIONS</div>
              <div className="stremio-detail-recs-row">
                {recsLoading && recommendations.length === 0 ? (
                  <div className="stremio-detail-cast-loading">Loading recommendations...</div>
                ) : (
                  recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="stremio-detail-rec-card"
                      onClick={() => handleRecClick(rec)}
                      title={rec.title}
                    >
                      <div className="stremio-detail-rec-poster">
                        {rec.posterUrl ? (
                          <img src={rec.posterUrl} alt={rec.title} loading="lazy" />
                        ) : (
                          <div className="stremio-detail-rec-poster-placeholder">
                            <span>{rec.title.charAt(0)}</span>
                          </div>
                        )}
                      </div>
                      <span className="stremio-detail-rec-title">{rec.title}</span>
                      <span className="stremio-detail-rec-meta">
                        {rec.year}{rec.rating > 0 && ` · ★ ${rec.rating.toFixed(1)}`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Episodes list OR streams list */}
        <div className="stremio-detail-right">
          {isSeries && !selectedVideo ? (
            <div className="stremio-detail-right-container">
              <div className="stremio-detail-right-header">
                <button
                  className="stremio-detail-nav-btn"
                  disabled={seasons.indexOf(selectedSeason || 0) === 0}
                  onClick={handlePrevSeason}
                >
                  ◀ Prev
                </button>

                <select
                  className="stremio-detail-season-select"
                  value={selectedSeason || ''}
                  onChange={(e) => setSelectedSeason(Number(e.target.value))}
                >
                  {seasons.map((s) => (
                    <option key={s} value={s}>Season {s}</option>
                  ))}
                </select>

                <button
                  className="stremio-detail-nav-btn"
                  disabled={seasons.indexOf(selectedSeason || 0) === seasons.length - 1}
                  onClick={handleNextSeason}
                >
                  Next ▶
                </button>
              </div>

              <div className="stremio-detail-search-videos">
                <svg className="stremio-video-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  placeholder="search videos"
                  value={videoSearch}
                  onChange={(e) => setVideoSearch(e.target.value)}
                />
                {videoSearch && (
                  <button className="stremio-video-search-clear" onClick={() => setVideoSearch('')}>✕</button>
                )}
              </div>

              <div className="stremio-detail-video-list">
                {filteredEpisodes.length === 0 ? (
                  <div className="stremio-detail-no-episodes">No episodes found.</div>
                ) : (
                  filteredEpisodes.map((ep) => {
                    const epProg = episodeProgress[ep.id];
                    const epFraction = epProg?.progressFraction ?? 0;
                    const epFinished = epProg?.finished ?? false;
                    const showEpProgress = epFraction > 0.02 && !epFinished;
                    return (
                      <div
                        key={ep.id}
                        className={`stremio-detail-video-card${epFinished ? ' stremio-ep-watched' : ''}`}
                        onClick={() => handleEpisodeClick(ep)}
                      >
                        <div className="stremio-detail-video-thumb-container stremio-ep-thumb-wrap">
                          {ep.thumbnail ? (
                            <img className="stremio-detail-video-thumb" src={ep.thumbnail} alt="" loading="lazy" />
                          ) : (
                            <div className="stremio-detail-video-thumb-placeholder">E{ep.episode}</div>
                          )}
                          {showEpProgress && (
                            <div className="stremio-ep-progress-track">
                              <div
                                className="stremio-ep-progress-fill"
                                style={{ width: `${Math.round(epFraction * 100)}%` }}
                              />
                            </div>
                          )}
                          {!epFinished && (
                            <div
                              className="stremio-ep-unwatched-badge"
                              title="Mark as watched"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleEpisodeWatched(ep);
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          )}
                          {epFinished && (
                            <div
                              className="stremio-ep-watched-badge"
                              title="Mark as unwatched"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleEpisodeWatched(ep);
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="stremio-detail-video-info">
                          <div className="stremio-detail-video-title">
                            {ep.episode !== undefined ? `${ep.episode}. ` : ''}
                            {ep.title || `Episode ${ep.episode}`}
                          </div>
                          {ep.released && (
                            <div className="stremio-detail-video-date">
                              {formatReleaseDate(ep.released)}
                            </div>
                          )}
                          {(ep.description || ep.overview) && (
                            <div className="stremio-detail-video-desc">
                              {ep.description || ep.overview}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="stremio-detail-right-container">
              <div className="stremio-detail-streams-header">
                {isSeries && (
                  <button className="stremio-detail-back-to-episodes" onClick={() => setSelectedVideo(null)}>
                    ← Back to Episodes
                  </button>
                )}
                <h3 className="stremio-detail-streams-title">
                  {isSeries
                    ? `Episode ${selectedVideo?.episode} Streams`
                    : 'Available Streams'}
                </h3>
              </div>

              {streams.length > 0 && addonNames.length > 0 && (
                <div className="stremio-detail-addon-filters">
                  <button
                    className={`stremio-addon-filter-btn ${selectedAddonFilter === 'All' ? 'active' : ''}`}
                    onClick={() => setSelectedAddonFilter('All')}
                  >
                    All
                  </button>
                  {addonNames.map((addon) => (
                    <button
                      key={addon}
                      className={`stremio-addon-filter-btn ${selectedAddonFilter === addon ? 'active' : ''}`}
                      onClick={() => setSelectedAddonFilter(addon)}
                    >
                      {addon}
                    </button>
                  ))}
                </div>
              )}

              <div className="stremio-detail-streams-list">
                {streams.length === 0 && loadingStreams ? (
                  <div className="stremio-detail-streams-loading">
                    <div className="stremio-spinner" />
                    <span>Loading streams...</span>
                  </div>
                ) : streams.length === 0 ? (
                  <div className="stremio-detail-streams-empty">
                    No streams found. Make sure you have stream provider addons installed.
                  </div>
                ) : filteredStreams.length === 0 ? (
                  <div className="stremio-detail-streams-empty">
                    No streams found for the selected addon filter.
                  </div>
                ) : (
                  <>
                    {loadingStreams && (
                      <div className="stremio-detail-streams-loading-mini">
                        <div className="stremio-spinner" style={{ width: 14, height: 14, borderWidth: '1.5px' }} />
                        <span>Checking more sources...</span>
                      </div>
                    )}
                    {renderedStreams}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

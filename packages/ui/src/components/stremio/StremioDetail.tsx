import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { StremioMeta, StremioStream, StremioVideo, StremioStreamBadge } from '../../types/stremio';
import { useStremioAddonStore } from '../../stores/stremioAddonStore';
import {
  useStremioSelectedSeason,
  useSetStremioSelectedSeason,
  useStremioPreselectVideoId,
  useSetStremioPreselectVideoId,
  useSetStremioSearchQuery,
  useSetStremioView,
  useSetStremioActiveMeta,
  useStremioNavigate,
} from '../../stores/uiStore';
import { useStremioLibraryStore } from '../../stores/stremioLibraryStore';
import { useStremioWatchStore } from '../../stores/stremioWatchStore';
import { fetchStreams, fetchMeta } from '../../services/stremio-addon';
import { extractStreamBadges, isLightColor, formatVideoSize } from '../../utils/streamBadges';
import { useLazyStremioCast, type StremioCastMember } from '../../hooks/useLazyStremioCast';
import { useLazyStremioTrailer } from '../../hooks/useLazyStremioTrailer';
import { useLazyStremioRecommendations, type RecommendationItem } from '../../hooks/useLazyStremioRecommendations';
import { useTmdbAccessToken } from '../../hooks/useTmdbLists';
import { getMovieDetails, getTvShowDetails, getTmdbImageUrl, tmdbPersonIdByName } from '../../services/tmdb';
import { useDownloadStore } from '../../stores/downloadStore';
import './StremioDetail.css';

interface StremioDetailProps {
  meta: StremioMeta;
  onBack: () => void;
  onPlay: (stream: StremioStream, meta: StremioMeta, episodeVideo?: StremioVideo) => void;
  streamPickerMode: 'modal' | 'autoplay';
  showStreamBadges?: boolean;
  compiledBadgeRules?: { pattern: RegExp; badge: StremioStreamBadge }[];
  showFileSizeBadges?: boolean;
  streamBadgePlacement?: 'top' | 'bottom';
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

export function StremioDetail({
  meta,
  onBack,
  onPlay,
  streamPickerMode,
  showStreamBadges = false,
  compiledBadgeRules,
  showFileSizeBadges = true,
  streamBadgePlacement = 'bottom',
}: StremioDetailProps) {
  const addons = useStremioAddonStore((s) => s.enabledAddons);
  const addonsKey = addons.map((a) => `${a.id}:${a.enabled !== false}`).join(',');

  const metaRef = useRef(meta);
  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  const onPlayRef = useRef(onPlay);
  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);

  const selectedSeason = useStremioSelectedSeason();
  const setSelectedSeason = useSetStremioSelectedSeason();
  
  const addToLibrary = useStremioLibraryStore((s) => s.addToLibrary);
  const removeFromLibrary = useStremioLibraryStore((s) => s.removeFromLibrary);
  const isInLibrary = useStremioLibraryStore((s) => s.isInLibrary);

  const episodeProgress = useStremioWatchStore((s) => s.episodeProgress || {});
  const toggleEpisodeWatched = useStremioWatchStore((s) => s.toggleEpisodeWatched);
  const preselectVideoId = useStremioPreselectVideoId();
  const setPreselectVideoId = useSetStremioPreselectVideoId();

  const setStremioSearchQuery = useSetStremioSearchQuery();
  const setStremioView = useSetStremioView();
  const setStremioActiveMeta = useSetStremioActiveMeta();
  const tmdbToken = useTmdbAccessToken();

  const { cast, loading: castLoading } = useLazyStremioCast(meta, tmdbToken);
  const { trailerUrl: tmdbTrailerUrl } = useLazyStremioTrailer(meta, tmdbToken);
  const { items: recommendations, loading: recsLoading } = useLazyStremioRecommendations(meta, tmdbToken);

  const stremioNavigate = useStremioNavigate();

  const handleCastClick = useCallback(async (member: StremioCastMember) => {
    if (member.id) {
      stremioNavigate({ view: 'person', personId: member.id });
    } else {
      // Look up TMDB ID by name first
      if (tmdbToken) {
        const id = await tmdbPersonIdByName(tmdbToken, member.name);
        if (id) {
          stremioNavigate({ view: 'person', personId: id });
          return;
        }
      }
      // Fallback: search Stremio catalog
      setStremioActiveMeta(null);
      setStremioSearchQuery(member.name);
      setStremioView('home');
    }
  }, [stremioNavigate, tmdbToken, setStremioActiveMeta, setStremioSearchQuery, setStremioView]);

  const handleRecClick = useCallback((rec: RecommendationItem) => {
    const newMeta: StremioMeta = {
      id: `tmdb:${rec.id}`,
      type: meta.type,
      name: rec.title,
      poster: rec.posterUrl ?? undefined,
      year: rec.year ? parseInt(rec.year) : undefined,
      imdbRating: rec.rating > 0 ? String(rec.rating.toFixed(1)) : undefined,
    };
    stremioNavigate({ view: 'detail', meta: newMeta });
  }, [meta.type, stremioNavigate]);

  const fetchedIdsRef = useRef<Set<string>>(new Set());

  // Auto-heal/fetch full metadata if we only have TMDB ID or incomplete metadata
  useEffect(() => {
    if (!meta.id || fetchedIdsRef.current.has(meta.id)) return;
    
    const isTmdbId = meta.id.startsWith('tmdb:');
    const isSeriesItem = meta.type === 'series';
    const isIncomplete = isTmdbId || (isSeriesItem && !metaRef.current.videos) || !metaRef.current.description;
    
    if (!isIncomplete) return;

    let active = true;

    const fetchFullMetadata = async () => {
      // Retrieve TMDB token, fallback to direct settings check if not populated yet in React state
      let activeToken = tmdbToken;
      if (!activeToken && window.storage) {
        try {
          const settings = await window.storage.getSettings();
          activeToken = (settings.data as any)?.tmdbApiKey || null;
        } catch (e) {
          console.error('[StremioDetail] Failed to read tmdbApiKey directly from storage:', e);
        }
      }

      // If we need TMDB details but don't have a token (and couldn't read one), abort and let it retry
      if (isTmdbId && !activeToken) {
        return;
      }

      let imdbId: string | null = null;
      const tmdbIdStr = isTmdbId ? meta.id.replace('tmdb:', '') : null;
      let tmdbDetails: any = null;

      // 1. If it's a TMDB ID, we need to get the IMDb ID from TMDB
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
          console.error('[StremioDetail] Failed to fetch TMDB details for ID:', meta.id, err);
        }
      } else if (!isTmdbId) {
        // It's already an IMDb ID (tt...)
        imdbId = meta.id;
      }

      if (!active) return;

      // 2. Fetch Stremio metadata using the IMDb ID
      let fullMeta: StremioMeta | null = null;
      if (imdbId) {
        try {
          fullMeta = await fetchMeta(addons, meta.type, imdbId);
        } catch (err) {
          console.error('[StremioDetail] Failed to fetch Stremio metadata for IMDb ID:', imdbId, err);
        }
      }

      if (!active) return;

      // Mark as processed only if this run is still active (not aborted)
      fetchedIdsRef.current.add(meta.id);

      // 3. Update the active meta in the store to trigger a re-render with full metadata
      if (fullMeta) {
        // Keep the TMDb rating if Stremio rating is not present
        if (!fullMeta.imdbRating && metaRef.current.imdbRating) {
          fullMeta.imdbRating = metaRef.current.imdbRating;
        }
        setStremioActiveMeta(fullMeta);
      } else if (tmdbDetails) {
        console.warn('[StremioDetail] Stremio metadata fetch failed, using TMDB fallback details');
        // Fallback: If Stremio metadata fetch failed but we have TMDB details, enrich what we have
        const enrichedMeta: StremioMeta = {
          ...metaRef.current,
          id: imdbId || meta.id,
          description: tmdbDetails.overview || metaRef.current.description,
          genres: tmdbDetails.genres?.map((g: any) => g.name) || metaRef.current.genres,
          runtime: tmdbDetails.runtime ? `${tmdbDetails.runtime} min` : metaRef.current.runtime,
          background: getTmdbImageUrl(tmdbDetails.backdrop_path, 'original') || metaRef.current.background,
        };
        setStremioActiveMeta(enrichedMeta);
      } else {
        console.error('[StremioDetail] Both Stremio metadata fetch and TMDB fetch failed.');
      }
    };

    fetchFullMetadata();

    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, meta.type, tmdbToken, addonsKey, setStremioActiveMeta]);

  const [streams, setStreams] = useState<StremioStream[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<StremioVideo | null>(null);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [videoSearch, setVideoSearch] = useState('');
  const [selectedAddonFilter, setSelectedAddonFilter] = useState<string>('All');

  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const startDownload = useDownloadStore((s) => s.startDownload);

  const handleDownloadStream = useCallback(
    async (stream: StremioStream, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!stream.url) return;
      setDownloadingUrl(stream.url);
      try {
        let title = '';
        if (meta.type === 'series' && selectedVideo) {
          title = `${meta.name} - S${selectedVideo.season}E${selectedVideo.episode}${selectedVideo.title ? ` - ${selectedVideo.title}` : ''}`;
        } else {
          title = `${meta.name}${meta.year ? ` (${meta.year})` : ''}`;
        }
        await startDownload(
          title,
          stream.url,
          undefined,
          undefined,
          undefined,
          meta?.poster || undefined
        );
      } catch (error) {
        console.error('[StremioDetail] Stream download failed:', error);
        alert('Failed to start download');
      } finally {
        setDownloadingUrl(null);
      }
    },
    [meta, selectedVideo, startDownload]
  );

  // Group streams by addon
  const addonNames = useMemo(() => {
    const names = new Set<string>();
    for (const stream of streams) {
      if (stream.addonName) {
        names.add(stream.addonName);
      }
    }
    return Array.from(names).sort();
  }, [streams]);

  // Reset addon filter when streams change
  useEffect(() => {
    setSelectedAddonFilter('All');
  }, [streams]);

  // Filter streams by addon
  const filteredStreams = useMemo(() => {
    if (selectedAddonFilter === 'All') return streams;
    return streams.filter((s) => s.addonName === selectedAddonFilter);
  }, [streams, selectedAddonFilter]);

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
        <div className="stremio-detail-stream-badges" style={{ marginBottom: streamBadgePlacement === 'top' ? '8px' : '0', marginTop: streamBadgePlacement === 'top' ? '4px' : '0' }}>
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
          key={`flat-${idx}`}
          className="stremio-detail-stream-card"
          onClick={() => onPlay(stream, meta, selectedVideo ?? undefined)}
        >
          {stream.url && !stream.url.startsWith('magnet:') && !stream.url.startsWith('infoHash:') && (
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
  }, [filteredStreams, showStreamBadges, compiledBadgeRules, downloadingUrl, handleDownloadStream, onPlay, meta, selectedVideo]);

  const isSeries = meta.type === 'series';
  const isAdded = isInLibrary(meta.id);
  const effectiveTrailerUrl = meta.trailer || tmdbTrailerUrl;

  const seasons = useMemo(() => {
    if (!isSeries || !meta.videos) return [];
    const s = new Set<number>();
    for (const v of meta.videos) {
      if (v.season !== undefined) s.add(v.season);
    }
    return Array.from(s).sort((a, b) => a - b);
  }, [isSeries, meta.videos]);

  const seasonEpisodes = useMemo(() => {
    if (!isSeries || !meta.videos || selectedSeason === undefined) return [];
    return meta.videos
      .filter((v) => v.season === selectedSeason)
      .sort((a, b) => (a.episode || 0) - (b.episode || 0));
  }, [isSeries, meta.videos, selectedSeason]);

  const filteredEpisodes = useMemo(() => {
    if (!seasonEpisodes) return [];
    if (!videoSearch.trim()) return seasonEpisodes;
    const q = videoSearch.toLowerCase();
    return seasonEpisodes.filter(
      (ep) =>
        (ep.title && ep.title.toLowerCase().includes(q)) ||
        (ep.episode !== undefined && ep.episode.toString() === q)
    );
  }, [seasonEpisodes, videoSearch]);

  // Handle season initialization — prefer Season 1 over Season 0 (specials)
  useEffect(() => {
    if (isSeries && seasons.length > 0 && selectedSeason === undefined) {
      const preferred = seasons.find((s) => s >= 1) ?? seasons[0];
      setSelectedSeason(preferred);
    }
  }, [isSeries, seasons, selectedSeason, setSelectedSeason]);

  // Auto-load streams for preselected video (from Continue Watching poster click)
  useEffect(() => {
    if (!isSeries || !preselectVideoId || !metaRef.current.videos) return;
    const video = metaRef.current.videos.find((v) => v.id === preselectVideoId);
    if (!video) return;
    setPreselectVideoId(null);
    setSelectedVideo(video);
    setStreams([]);
    setLoadingStreams(true);
    fetchStreams(addons, 'series', video.id, (newStreams) => {
      setStreams((prev) => [...prev, ...newStreams]);
    }).then((result) => {
      setLoadingStreams(false);
      if (streamPickerMode === 'autoplay' && result.length > 0) {
        const direct = result.find((s) => s.url && !s.behaviorHints?.notWebReady) || result[0];
        if (direct) onPlayRef.current(direct, metaRef.current, video);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSeries, preselectVideoId, meta.id, meta.videos?.length, addonsKey, streamPickerMode, setPreselectVideoId]);

  // Load streams on mount for Movies
  useEffect(() => {
    if (!isSeries) {
      const loadMovieStreams = async () => {
        setStreams([]);
        setLoadingStreams(true);
        const result = await fetchStreams(addons, meta.type, meta.id, (newStreams) => {
          setStreams((prev) => [...prev, ...newStreams]);
        });
        setLoadingStreams(false);

        if (streamPickerMode === 'autoplay' && result.length > 0) {
          const direct = result.find((s) => s.url && !s.behaviorHints?.notWebReady) || result[0];
          if (direct) onPlayRef.current(direct, metaRef.current);
        }
      };
      loadMovieStreams();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSeries, meta.id, meta.type, addonsKey, streamPickerMode]);

  /** Find the next episode in the series after the given one */
  const getNextEpisode = useCallback((ep: StremioVideo): StremioVideo | undefined => {
    if (!meta.videos) return undefined;
    const sorted = [...meta.videos].sort((a, b) => {
      if ((a.season ?? 0) !== (b.season ?? 0)) return (a.season ?? 0) - (b.season ?? 0);
      return (a.episode ?? 0) - (b.episode ?? 0);
    });
    const idx = sorted.findIndex((v) => v.id === ep.id);
    return idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : undefined;
  }, [meta.videos]);

  const handleEpisodeClick = useCallback(async (ep: StremioVideo) => {
    setSelectedVideo(ep);
    setStreams([]);
    setLoadingStreams(true);
    const result = await fetchStreams(addons, 'series', ep.id, (newStreams) => {
      setStreams((prev) => [...prev, ...newStreams]);
    });
    setLoadingStreams(false);

    if (streamPickerMode === 'autoplay' && result.length > 0) {
      const direct = result.find((s) => s.url && !s.behaviorHints?.notWebReady) || result[0];
      if (direct) {
        onPlay(direct, meta, ep);
        setSelectedVideo(null); // Reset back to list on play
      }
    }
  }, [addons, streamPickerMode, onPlay, meta]);

  const handleLibraryToggle = () => {
    if (isAdded) {
      removeFromLibrary(meta.id);
    } else {
      addToLibrary(meta);
    }
  };

  const handlePrevSeason = () => {
    if (selectedSeason === undefined) return;
    const idx = seasons.indexOf(selectedSeason);
    if (idx > 0) {
      setSelectedSeason(seasons[idx - 1]);
    }
  };

  const handleNextSeason = () => {
    if (selectedSeason === undefined) return;
    const idx = seasons.indexOf(selectedSeason);
    if (idx < seasons.length - 1) {
      setSelectedSeason(seasons[idx + 1]);
    }
  };

  return (
    <div className="stremio-detail">
      {/* Background Cover */}
      <div className="stremio-detail-backdrop-container">
        {meta.background && (
          <img className="stremio-detail-backdrop" src={meta.background} alt="" />
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
            {meta.logo ? (
              <img className="stremio-detail-logo" src={meta.logo} alt={meta.name} />
            ) : (
              <h1 className="stremio-detail-title">{meta.name}</h1>
            )}
          </div>

          <div className="stremio-detail-meta-line">
            {meta.runtime && <span className="stremio-detail-meta-item">{meta.runtime}</span>}
            {meta.year && <span className="stremio-detail-meta-item">{meta.year}</span>}
            {meta.imdbRating && (
              <span className="stremio-detail-meta-item stremio-detail-imdb">
                {meta.imdbRating} <span className="stremio-detail-imdb-badge">IMDb</span>
              </span>
            )}
          </div>

          {meta.genres && meta.genres.length > 0 && (
            <div className="stremio-detail-section">
              <div className="stremio-detail-section-label">GENRES</div>
              <div className="stremio-detail-tags">
                {meta.genres.map((g) => (
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

          {meta.cast && meta.cast.length > 0 && cast.length === 0 && !castLoading && (
            <div className="stremio-detail-section">
              <div className="stremio-detail-section-label">CAST</div>
              <div className="stremio-detail-tags">
                {meta.cast.slice(0, 10).map((c) => (
                  <span key={c} className="stremio-detail-tag" onClick={() => handleCastClick({ id: 0, name: c, character: '', photo: null })}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {meta.description && (
            <div className="stremio-detail-section">
              <div className="stremio-detail-section-label">SUMMARY</div>
              <p className="stremio-detail-desc">{meta.description}</p>
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
                      title: `${meta.name} - Trailer`,
                      backdropUrl: meta.background,
                      logoUrl: meta.logo,
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
              className={`stremio-detail-action-btn ${isAdded ? 'in-library' : ''}`}
              onClick={handleLibraryToggle}
            >
              {isAdded ? (
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
            /* Episode Selector Panel */
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
                          {/* Episode progress bar */}
                          {showEpProgress && (
                            <div className="stremio-ep-progress-track">
                              <div
                                className="stremio-ep-progress-fill"
                                style={{ width: `${Math.round(epFraction * 100)}%` }}
                              />
                            </div>
                          )}
                          {/* Unwatched — click to mark as watched */}
                          {!epFinished && (
                            <div
                              className="stremio-ep-unwatched-badge"
                              title="Mark as watched"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleEpisodeWatched(ep.id, meta.id, selectedSeason ?? 1, ep.episode ?? 1);
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          )}
                          {/* Watched checkmark badge — click to toggle */}
                          {epFinished && (
                            <div
                              className="stremio-ep-watched-badge"
                              title="Mark as unwatched"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleEpisodeWatched(ep.id, meta.id, selectedSeason ?? 1, ep.episode ?? 1);
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
            /* Stream Selector Panel */
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

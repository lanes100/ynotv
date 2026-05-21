import { useRef, useState, useCallback, useEffect } from 'react';
import type { InstalledAddon, StremioMeta, StremioStream, StremioMetaPreview, StremioVideo } from '../../types/stremio';
import { fetchMeta, fetchStreams } from '../../services/stremio-addon';
import { useStremioWatchStore, type StremioWatchEntry } from '../../stores/stremioWatchStore';
import { useStremioHover } from '../../contexts/StremioHoverContext';
import './StremioHome.css';

interface StremioRecentlyWatchedProps {
  addons: InstalledAddon[];
  onItemClick: (meta: StremioMeta) => void;
}

function matchStream(candidates: StremioStream[], target: StremioStream): StremioStream | null {
  if (candidates.length === 0) return null;

  // 1. If target has infoHash, look for a candidate with the same infoHash first.
  if (target.infoHash) {
    const infoHashMatch = candidates.find(
      (c) => c.infoHash && c.infoHash.toLowerCase() === target.infoHash!.toLowerCase()
    );
    if (infoHashMatch) return infoHashMatch;
  }

  // Helper to tokenize and clean strings
  const getTokens = (str?: string) => {
    if (!str) return [];
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((w) => {
        if (!w) return false;
        // Exclude season/episode indicator patterns
        if (/^s\d+$/i.test(w) || /^e\d+$/i.test(w) || /^ep\d+$/i.test(w)) return false;
        if (/^\d+$/i.test(w)) return false; // Exclude raw numbers to avoid matching episode index numbers
        return true;
      });
  };

  const targetNameTokens = getTokens(target.name);
  const targetTitleTokens = getTokens(target.title);

  let bestCandidate: StremioStream | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    let score = 0;

    // Matching addon is extremely important
    if (candidate.addonName && target.addonName && candidate.addonName === target.addonName) {
      score += 15;
    }

    // Compare name field tokens
    const candNameTokens = getTokens(candidate.name);
    const commonName = candNameTokens.filter((tok) => targetNameTokens.includes(tok));
    score += commonName.length * 3;

    // Compare title field tokens
    const candTitleTokens = getTokens(candidate.title);
    const commonTitle = candTitleTokens.filter((tok) => targetTitleTokens.includes(tok));
    score += commonTitle.length * 2;

    // Add bonus if name matches exactly (case-insensitive)
    if (candidate.name && target.name && candidate.name.toLowerCase() === target.name.toLowerCase()) {
      score += 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  // Set a minimum threshold to ensure we don't pick a completely unrelated stream.
  // If we matched the addon name, that's already score 15, which is a good baseline.
  return bestScore >= 5 ? bestCandidate : candidates[0] || null;
}

export function StremioRecentlyWatched({ addons, onItemClick }: StremioRecentlyWatchedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const history = useStremioWatchStore((s) => s.history);
  const removeFromHistory = useStremioWatchStore((s) => s.removeFromHistory);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [update, history.length]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollTo({ left: el.scrollLeft + (dir === 'left' ? -amount : amount), behavior: 'smooth' });
  };

  const handleItemClick = useCallback(async (entry: StremioWatchEntry) => {
    if (loadingId) return;
    setLoadingId(entry.metaId);
    try {
      const meta = await fetchMeta(addons, entry.type, entry.metaId);
      if (meta) onItemClick(meta);
    } catch {
      // Silently fail
    } finally {
      setLoadingId(null);
    }
  }, [addons, onItemClick, loadingId]);

  const handleDirectPlay = useCallback(async (entry: StremioWatchEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (loadingId) return;
    setLoadingId(entry.metaId);

    try {
      // 1. Fetch metadata to get the full video list for series
      const meta = await fetchMeta(addons, entry.type, entry.metaId);
      if (!meta) {
        // Fallback to detail page
        setLoadingId(null);
        const fallbackMeta = await fetchMeta(addons, entry.type, entry.metaId);
        if (fallbackMeta) onItemClick(fallbackMeta);
        return;
      }

      let selectedStream: StremioStream | null = null;
      let targetVideo: StremioVideo | undefined = undefined;

      if (entry.type === 'movie') {
        if (entry.lastSelectedStream) {
          selectedStream = entry.lastSelectedStream;
        } else {
          // Fetch streams and pick first
          const streams = await fetchStreams(addons, 'movie', entry.metaId);
          if (streams && streams.length > 0) {
            selectedStream = streams[0];
          }
        }
      } else {
        // Series
        const isSeries = entry.type === 'series';
        const hasNext = isSeries && entry.nextVideoId != null;
        const targetVideoId = hasNext ? entry.nextVideoId : entry.lastWatchedVideoId;

        if (targetVideoId) {
          // Find target episode video in meta
          if (meta.videos && Array.isArray(meta.videos)) {
            targetVideo = meta.videos.find((v) => v.id === targetVideoId);
          }

          // Fetch streams for the target video
          const streams = await fetchStreams(addons, 'series', targetVideoId);
          if (streams && streams.length > 0) {
            if (entry.lastSelectedStream) {
              selectedStream = matchStream(streams, entry.lastSelectedStream);
            } else {
              selectedStream = streams[0];
            }
          }
        }
      }

      if (selectedStream) {
        // Dispatch play event
        window.dispatchEvent(
          new CustomEvent('ynotv:stremio-play', {
            detail: {
              stream: selectedStream,
              meta,
              episodeVideo: targetVideo,
            },
          })
        );
      } else {
        // Fallback to opening details view
        onItemClick(meta);
      }
    } catch (err) {
      console.error('[StremioRecentlyWatched] Direct play failed:', err);
      // Fallback to detail page if possible
      try {
        const meta = await fetchMeta(addons, entry.type, entry.metaId);
        if (meta) onItemClick(meta);
      } catch {}
    } finally {
      setLoadingId(null);
    }
  }, [addons, onItemClick, loadingId]);

  const { onCardMouseEnter, onCardMouseLeave, onCardClick } = useStremioHover();

  if (history.length === 0) return null;

  return (
    <section className="stremio-row stremio-rw-row">
      <div className="stremio-row-header">
        <h3 className="stremio-row-title stremio-rw-title">
          <svg className="stremio-rw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Continue Watching
        </h3>
        <div className="stremio-row-nav">
          <button className="stremio-row-nav-btn" onClick={() => scroll('left')} disabled={!canScrollLeft}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button className="stremio-row-nav-btn" onClick={() => scroll('right')} disabled={!canScrollRight}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      <div className="stremio-row-scroll" ref={scrollRef} onScroll={update}>
        <div className="stremio-row-track">
          {history.map((entry) => {
            const isLoading = loadingId === entry.metaId;
            const isSeries = entry.type === 'series';
            const hasNext = isSeries && entry.nextVideoId != null;
            const progressPercent = Math.round(entry.progressFraction * 100);
            const showProgress = !hasNext && progressPercent > 2 && progressPercent < 98;

            // Badge: "▶ S2 E5" for next, or "S2 E4" for continue
            let badge: string | null = null;
            if (isSeries && hasNext && entry.nextSeason != null && entry.nextEpisode != null) {
              badge = `▶ S${entry.nextSeason} E${entry.nextEpisode}`;
            } else if (isSeries && entry.lastSeason != null && entry.lastEpisode != null) {
              badge = `S${entry.lastSeason} E${entry.lastEpisode}`;
            }

            return (
              <div
                key={entry.metaId}
                className={`stremio-row-card stremio-rw-card${isLoading ? ' stremio-rw-card--loading' : ''}`}
                onMouseEnter={(e) => {
                  const previewItem: StremioMetaPreview = {
                    id: entry.metaId,
                    type: entry.type,
                    name: entry.name,
                    poster: entry.poster || undefined,
                  };
                  onCardMouseEnter(previewItem, e.currentTarget, e);
                }}
                onMouseLeave={onCardMouseLeave}
                onClick={() => {
                  onCardClick();
                  handleItemClick(entry);
                }}
              >
                {/* Remove button */}
                <button
                  className="stremio-rw-remove-btn"
                  title="Remove from Continue Watching"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromHistory(entry.metaId);
                  }}
                >
                  ✕
                </button>

                {/* Poster */}
                <div className="stremio-rw-poster-wrap">
                  {entry.poster ? (
                    <img
                      className="stremio-row-poster"
                      src={entry.poster}
                      alt={entry.name}
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="stremio-rw-poster-placeholder">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="2" width="20" height="20" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                  )}

                  {/* Play overlay button */}
                  {!isLoading && (
                    <button
                      className="stremio-rw-play-overlay-btn"
                      title={`Play ${entry.name}`}
                      onClick={(e) => handleDirectPlay(entry, e)}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="stremio-rw-play-icon">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  )}

                  {/* Progress bar */}
                  {showProgress && (
                    <div className="stremio-rw-progress-track">
                      <div
                        className="stremio-rw-progress-fill"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}

                  {/* Episode / Next badge */}
                  {badge && (
                    <div className={`stremio-rw-ep-badge${hasNext ? ' stremio-rw-ep-badge--next' : ''}`}>
                      {badge}
                    </div>
                  )}

                  {/* Loading spinner */}
                  {isLoading && (
                    <div className="stremio-rw-loading-overlay">
                      <div className="stremio-spinner" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="stremio-row-card-info">
                  <div className="stremio-row-card-title">{entry.name}</div>
                  {hasNext ? (
                    <div className="stremio-rw-card-sub stremio-rw-card-sub--next">Next Episode</div>
                  ) : (
                    showProgress && (
                      <div className="stremio-rw-card-sub">{progressPercent}% watched</div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {canScrollLeft && <div className="stremio-row-fade stremio-row-fade-left" />}
      {canScrollRight && <div className="stremio-row-fade stremio-row-fade-right" />}
    </section>
  );
}

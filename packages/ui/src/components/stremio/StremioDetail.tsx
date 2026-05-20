import { useState, useEffect, useCallback, useMemo } from 'react';
import type { StremioMeta, StremioStream, StremioVideo } from '../../types/stremio';
import { useStremioAddonStore } from '../../stores/stremioAddonStore';
import { useStremioSelectedSeason, useSetStremioSelectedSeason } from '../../stores/uiStore';
import { useStremioLibraryStore } from '../../stores/stremioLibraryStore';
import { fetchStreams } from '../../services/stremio-addon';
import './StremioDetail.css';

interface StremioDetailProps {
  meta: StremioMeta;
  onBack: () => void;
  onPlay: (stream: StremioStream, meta: StremioMeta) => void;
  streamPickerMode: 'modal' | 'autoplay';
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

export function StremioDetail({ meta, onBack, onPlay, streamPickerMode }: StremioDetailProps) {
  const addons = useStremioAddonStore((s) => s.addons);
  const selectedSeason = useStremioSelectedSeason();
  const setSelectedSeason = useSetStremioSelectedSeason();
  
  const addToLibrary = useStremioLibraryStore((s) => s.addToLibrary);
  const removeFromLibrary = useStremioLibraryStore((s) => s.removeFromLibrary);
  const isInLibrary = useStremioLibraryStore((s) => s.isInLibrary);

  const [streams, setStreams] = useState<StremioStream[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<StremioVideo | null>(null);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [videoSearch, setVideoSearch] = useState('');

  const isSeries = meta.type === 'series';
  const isAdded = isInLibrary(meta.id);

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

  // Handle season initialization
  useEffect(() => {
    if (isSeries && seasons.length > 0 && selectedSeason === undefined) {
      setSelectedSeason(seasons[0]);
    }
  }, [isSeries, seasons, selectedSeason, setSelectedSeason]);

  // Load streams on mount for Movies
  useEffect(() => {
    if (!isSeries) {
      const loadMovieStreams = async () => {
        setLoadingStreams(true);
        const result = await fetchStreams(addons, meta.type, meta.id);
        setStreams(result);
        setLoadingStreams(false);

        if (streamPickerMode === 'autoplay' && result.length > 0) {
          const direct = result.find((s) => s.url && !s.behaviorHints?.notWebReady) || result[0];
          if (direct) onPlay(direct, meta);
        }
      };
      loadMovieStreams();
    }
  }, [isSeries, meta.id, meta.type, addons, streamPickerMode, onPlay, meta]);

  const handleEpisodeClick = useCallback(async (ep: StremioVideo) => {
    setSelectedVideo(ep);
    setLoadingStreams(true);
    const result = await fetchStreams(addons, 'series', ep.id);
    setStreams(result);
    setLoadingStreams(false);

    if (streamPickerMode === 'autoplay' && result.length > 0) {
      const direct = result.find((s) => s.url && !s.behaviorHints?.notWebReady) || result[0];
      if (direct) {
        onPlay(direct, meta);
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

          {meta.cast && meta.cast.length > 0 && (
            <div className="stremio-detail-section">
              <div className="stremio-detail-section-label">CAST</div>
              <div className="stremio-detail-tags">
                {meta.cast.slice(0, 10).map((c) => (
                  <span key={c} className="stremio-detail-tag">{c}</span>
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
            {meta.trailer && (
              <button
                className="stremio-detail-action-btn"
                onClick={() => window.open(meta.trailer, '_blank')}
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
                  filteredEpisodes.map((ep) => (
                    <div
                      key={ep.id}
                      className="stremio-detail-video-card"
                      onClick={() => handleEpisodeClick(ep)}
                    >
                      <div className="stremio-detail-video-thumb-container">
                        {ep.thumbnail ? (
                          <img className="stremio-detail-video-thumb" src={ep.thumbnail} alt="" loading="lazy" />
                        ) : (
                          <div className="stremio-detail-video-thumb-placeholder">E{ep.episode}</div>
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
                      </div>
                    </div>
                  ))
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

              <div className="stremio-detail-streams-list">
                {loadingStreams ? (
                  <div className="stremio-detail-streams-loading">
                    <div className="stremio-spinner" />
                    <span>Loading streams...</span>
                  </div>
                ) : streams.length === 0 ? (
                  <div className="stremio-detail-streams-empty">
                    No streams found. Make sure you have stream provider addons installed.
                  </div>
                ) : (
                  streams.map((stream, idx) => {
                    const name = stream.name || '';
                    const desc = stream.description || stream.title || '';
                    const displayName = name.trim();
                    const displayDesc = displayName ? desc : '';
                    return (
                      <div
                        key={idx}
                        className="stremio-detail-stream-card"
                        onClick={() => onPlay(stream, meta)}
                      >
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
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

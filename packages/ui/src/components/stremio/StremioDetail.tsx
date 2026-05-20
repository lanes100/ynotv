import { useState, useEffect, useCallback, useMemo } from 'react';
import type { StremioMeta, StremioStream, StremioVideo } from '../../types/stremio';
import { useStremioAddonStore } from '../../stores/stremioAddonStore';
import { useStremioSelectedSeason, useSetStremioSelectedSeason } from '../../stores/uiStore';
import { fetchStreams } from '../../services/stremio-addon';
import { StreamPickerModal } from './StreamPickerModal';
import './StremioDetail.css';

interface StremioDetailProps {
  meta: StremioMeta;
  onBack: () => void;
  onPlay: (stream: StremioStream, meta: StremioMeta) => void;
  streamPickerMode: 'modal' | 'autoplay';
}

export function StremioDetail({ meta, onBack, onPlay, streamPickerMode }: StremioDetailProps) {
  const addons = useStremioAddonStore((s) => s.addons);
  const selectedSeason = useStremioSelectedSeason();
  const setSelectedSeason = useSetStremioSelectedSeason();
  const [streams, setStreams] = useState<StremioStream[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loadingStreams, setLoadingStreams] = useState(false);

  const isSeries = meta.type === 'series';
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
    return meta.videos.filter(v => v.season === selectedSeason).sort((a, b) => (a.episode || 0) - (b.episode || 0));
  }, [isSeries, meta.videos, selectedSeason]);

  useEffect(() => {
    if (isSeries && seasons.length > 0 && selectedSeason === undefined) {
      setSelectedSeason(seasons[0]);
    }
  }, [isSeries, seasons, selectedSeason, setSelectedSeason]);

  const handlePlay = useCallback(async (video?: StremioVideo) => {
    const videoId = video?.id || meta.behaviorHints?.defaultVideoId || meta.id;
    const type = meta.type;
    setLoadingStreams(true);
    const result = await fetchStreams(addons, type, videoId);
    setStreams(result);
    setLoadingStreams(false);

    if (result.length === 0) return;

    if (streamPickerMode === 'autoplay') {
      const direct = result.find(s => s.url && !s.behaviorHints?.notWebReady) || result[0];
      if (direct) onPlay(direct, meta);
    } else {
      setShowPicker(true);
    }
  }, [addons, meta, streamPickerMode, onPlay]);

  const handleSelectStream = useCallback((stream: StremioStream) => {
    setShowPicker(false);
    onPlay(stream, meta);
  }, [onPlay, meta]);

  return (
    <div className="stremio-detail">
      {showPicker && (
        <StreamPickerModal
          streams={streams}
          onSelect={handleSelectStream}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Backdrop */}
      <div className="stremio-detail-backdrop-container">
        {meta.background && (
          <img className="stremio-detail-backdrop" src={meta.background} alt="" />
        )}
        <div className="stremio-detail-backdrop-overlay" />
      </div>

      <div className="stremio-detail-content">
        <button className="stremio-detail-back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="stremio-detail-hero">
          {meta.poster && (
            <img className="stremio-detail-poster" src={meta.poster} alt={meta.name} />
          )}
          <div className="stremio-detail-info">
            <h1 className="stremio-detail-title">{meta.name}</h1>
            <div className="stremio-detail-meta">
              {meta.year && <span>{meta.year}</span>}
              {meta.runtime && <span>{meta.runtime}</span>}
              {meta.releaseInfo && <span>{meta.releaseInfo}</span>}
              {meta.imdbRating && <span className="stremio-detail-rating">★ {meta.imdbRating}</span>}
            </div>
            {meta.genres && (
              <div className="stremio-detail-genres">
                {meta.genres.map(g => <span key={g} className="stremio-detail-genre">{g}</span>)}
              </div>
            )}
            {meta.description && <p className="stremio-detail-desc">{meta.description}</p>}
            {meta.cast && (
              <div className="stremio-detail-cast">
                <span className="stremio-detail-cast-label">Cast: </span>
                {meta.cast.slice(0, 5).join(', ')}
              </div>
            )}
            <button
              className="stremio-detail-play-btn"
              onClick={() => handlePlay()}
              disabled={loadingStreams}
            >
              {loadingStreams ? 'Loading...' : '▶ Play'}
            </button>
          </div>
        </div>

        {/* Series Season/Episode selector */}
        {isSeries && seasons.length > 0 && (
          <div className="stremio-detail-episodes">
            <div className="stremio-detail-season-tabs">
              {seasons.map(s => (
                <button
                  key={s}
                  className={`stremio-detail-season-tab ${selectedSeason === s ? 'active' : ''}`}
                  onClick={() => setSelectedSeason(s)}
                >
                  Season {s}
                </button>
              ))}
            </div>
            <div className="stremio-detail-episode-grid">
              {seasonEpisodes.map(ep => (
                <div key={ep.id} className="stremio-detail-episode-card" onClick={() => handlePlay(ep)}>
                  {ep.thumbnail && (
                    <img className="stremio-detail-ep-thumb" src={ep.thumbnail} alt={ep.title} loading="lazy" />
                  )}
                  <div className="stremio-detail-ep-info">
                    <div className="stremio-detail-ep-title">
                      {ep.episode !== undefined && <span>E{ep.episode} · </span>}
                      {ep.title}
                    </div>
                    {ep.released && <div className="stremio-detail-ep-date">{ep.released}</div>}
                    {ep.description && <div className="stremio-detail-ep-desc">{ep.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

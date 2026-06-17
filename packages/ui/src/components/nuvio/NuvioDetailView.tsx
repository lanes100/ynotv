import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchMeta, fetchStreams } from '../../services/stremio-addon';
import { useNuvioAddonStore } from '../../stores/nuvioAddonStore';
import { useNuvioPluginStore } from '../../stores/nuvioPluginStore';
import { executePlugin } from '../../services/nuvio-plugin-runtime';
import type { StremioMeta, StremioStream } from '../../types/stremio';

export interface NuvioMeta {
  id: string;
  type: string;
  name: string;
  poster?: string | null;
  background?: string | null;
}

interface NuvioDetailViewProps {
  meta: NuvioMeta;
  onBack: () => void;
  onPlay: (stream: StremioStream, meta: NuvioMeta) => void;
}

export function NuvioDetailView({ meta, onBack, onPlay }: NuvioDetailViewProps) {
  const addons = useNuvioAddonStore((s) => s.enabledAddons);
  const pluginStore = useNuvioPluginStore();

  const [fullMeta, setFullMeta] = useState<StremioMeta | null>(null);
  const [streams, setStreams] = useState<StremioStream[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [streamsFetched, setStreamsFetched] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [addonFilter, setAddonFilter] = useState('All');
  const [bgLoaded, setBgLoaded] = useState(false);
  const activeRef = useRef(true);

  // Fetch full metadata from Nuvio addons on mount / when meta changes
  useEffect(() => {
    activeRef.current = true;
    setFullMeta(null);
    setLoadingMeta(true);
    setStreams([]);
    setStreamsFetched(false);
    setBgLoaded(false);

    fetchMeta(addons, meta.type, meta.id)
      .then((m) => {
        if (!activeRef.current) return;
        setFullMeta(m);
        if (m?.videos) {
          const seasonsArr = [
            ...new Set(m.videos.map((v) => v.season).filter((s): s is number => s != null && s > 0)),
          ].sort((a, b) => a - b);
          if (seasonsArr.length > 0) setSelectedSeason(seasonsArr[0]);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (activeRef.current) setLoadingMeta(false);
      });

    return () => {
      activeRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, meta.type]);

  const buildStreamId = useCallback((): string | null => {
    if (meta.type !== 'series') return meta.id;
    if (selectedEpisode == null) return null;
    return `${meta.id}:${selectedSeason}:${selectedEpisode}`;
  }, [meta.id, meta.type, selectedSeason, selectedEpisode]);

  const fetchAllStreams = useCallback(async () => {
    const streamId = buildStreamId();
    if (!streamId) return;

    setLoadingStreams(true);
    setStreams([]);
    setAddonFilter('All');

    const collected: StremioStream[] = [];

    // 1. Fetch from all Nuvio addons in parallel, streaming results in progressively
    const addonPromise = fetchStreams(addons, meta.type, streamId, (incoming) => {
      if (!activeRef.current) return;
      collected.push(...incoming);
      setStreams([...collected]);
    });

    // 2. Run Nuvio plugin scrapers sequentially (they're heavyweight JS runtimes)
    let scraperPromise: Promise<void> = Promise.resolve();
    if (pluginStore.pluginsEnabled && pluginStore.scrapers.length > 0) {
      scraperPromise = (async () => {
        const enabled = pluginStore.scrapers.filter((s) => s.enabled);
        for (const scraper of enabled) {
          if (!activeRef.current) break;
          try {
            const results = await executePlugin(
              scraper.code,
              meta.id,
              meta.type,
              meta.type === 'series' ? selectedSeason : null,
              meta.type === 'series' ? selectedEpisode : null,
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
            setStreams([...collected]);
          } catch (e) {
            console.warn('[NuvioDetailView] Scraper error:', scraper.id, e);
          }
        }
      })();
    }

    await Promise.all([addonPromise, scraperPromise]);
    if (activeRef.current) {
      setLoadingStreams(false);
      setStreamsFetched(true);
    }
  }, [addons, buildStreamId, meta.id, meta.type, pluginStore, selectedSeason, selectedEpisode]);

  // Movies: fetch streams immediately when meta loads
  useEffect(() => {
    if (meta.type !== 'series') {
      fetchAllStreams();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, meta.type]);

  // Series: fetch streams when an episode is selected
  useEffect(() => {
    if (meta.type === 'series' && selectedEpisode != null) {
      fetchAllStreams();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEpisode, selectedSeason]);

  // Derived display values
  const displayName = fullMeta?.name ?? meta.name;
  const backdrop = fullMeta?.background ?? meta.background ?? meta.poster;
  const poster = fullMeta?.poster ?? meta.poster;
  const description = fullMeta?.description;
  const genres: string[] = fullMeta?.genres ?? [];
  const imdbRating = fullMeta?.imdbRating;
  const runtime = fullMeta?.runtime;
  const year = fullMeta?.year;

  const seasons = fullMeta?.videos
    ? [...new Set(fullMeta.videos.map((v) => v.season).filter((s): s is number => s != null && s > 0))].sort((a, b) => a - b)
    : [];
  const episodesForSeason = (fullMeta?.videos ?? [])
    .filter((v) => v.season === selectedSeason)
    .sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0));

  const addonNames = [...new Set(streams.map((s) => s.addonName).filter(Boolean))] as string[];
  const filteredStreams = addonFilter === 'All' ? streams : streams.filter((s) => s.addonName === addonFilter);

  return (
    <div className="nuvio-detail-overlay" onClick={onBack}>
      <div className="nuvio-detail-panel" onClick={(e) => e.stopPropagation()}>

        {/* Backdrop */}
        <div className="nuvio-detail-backdrop">
          {backdrop && (
            <img
              src={backdrop}
              alt=""
              className={`nuvio-detail-backdrop-img${bgLoaded ? ' loaded' : ''}`}
              onLoad={() => setBgLoaded(true)}
            />
          )}
          <div className="nuvio-detail-backdrop-fade" />
        </div>

        {/* Back button */}
        <button className="nuvio-detail-back" onClick={onBack} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </button>

        <div className="nuvio-detail-body">
          {/* Left: Poster */}
          <div className="nuvio-detail-left">
            {poster && <img src={poster} alt={displayName} className="nuvio-detail-poster" />}
          </div>

          {/* Right: Info + Streams */}
          <div className="nuvio-detail-right">
            <div className="nuvio-detail-type-badge">
              {meta.type === 'series' ? 'Series' : 'Movie'}
            </div>
            <h1 className="nuvio-detail-title">{displayName}</h1>

            <div className="nuvio-detail-meta-row">
              {year && <span className="nuvio-detail-pill">{year}</span>}
              {runtime && <span className="nuvio-detail-pill">{runtime}</span>}
              {imdbRating && (
                <span className="nuvio-detail-pill nuvio-detail-pill-rating">★ {imdbRating}</span>
              )}
            </div>

            {genres.length > 0 && (
              <div className="nuvio-detail-genres">
                {genres.slice(0, 4).map((g) => (
                  <span key={g} className="nuvio-detail-genre-tag">{g}</span>
                ))}
              </div>
            )}

            {loadingMeta && !fullMeta && (
              <div className="nuvio-detail-meta-loading">
                <div className="nuvio-detail-spinner" />
                <span>Loading details…</span>
              </div>
            )}

            {description && <p className="nuvio-detail-description">{description}</p>}

            {/* Season / Episode picker for series */}
            {meta.type === 'series' && seasons.length > 0 && (
              <div className="nuvio-detail-episodes-section">
                <div className="nuvio-detail-season-tabs">
                  {seasons.map((s) => (
                    <button
                      key={s}
                      className={`nuvio-detail-season-tab${selectedSeason === s ? ' active' : ''}`}
                      onClick={() => {
                        setSelectedSeason(s);
                        setSelectedEpisode(null);
                        setStreams([]);
                        setStreamsFetched(false);
                      }}
                    >
                      Season {s}
                    </button>
                  ))}
                </div>
                <div className="nuvio-detail-episode-grid">
                  {episodesForSeason.map((ep) => (
                    <button
                      key={ep.id}
                      className={`nuvio-detail-episode-btn${selectedEpisode === ep.episode ? ' active' : ''}`}
                      onClick={() => setSelectedEpisode(ep.episode ?? null)}
                    >
                      <span className="nuvio-detail-ep-num">E{ep.episode}</span>
                      <span className="nuvio-detail-ep-title">
                        {ep.title || `Episode ${ep.episode}`}
                      </span>
                    </button>
                  ))}
                  {episodesForSeason.length === 0 && (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', padding: '12px 0' }}>
                      No episodes found for this season.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Streams */}
            <div className="nuvio-detail-streams-section">
              <div className="nuvio-detail-streams-header">
                <span className="nuvio-detail-streams-title">
                  {loadingStreams
                    ? 'Finding streams…'
                    : streamsFetched
                    ? `Streams (${streams.length})`
                    : meta.type === 'series' && selectedEpisode == null
                    ? 'Select an episode to find streams'
                    : 'Streams'}
                </span>
                {loadingStreams && <div className="nuvio-detail-spinner" />}
              </div>

              {/* Per-addon filter tabs */}
              {streams.length > 0 && addonNames.length > 1 && (
                <div className="nuvio-detail-addon-tabs">
                  {(['All', ...addonNames]).map((name) => (
                    <button
                      key={name}
                      className={`nuvio-detail-addon-tab${addonFilter === name ? ' active' : ''}`}
                      onClick={() => setAddonFilter(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}

              {filteredStreams.length > 0 ? (
                <div className="nuvio-detail-stream-list">
                  {filteredStreams.map((stream, i) => (
                    <button
                      key={i}
                      className="nuvio-detail-stream-item"
                      onClick={() => onPlay(stream, meta)}
                    >
                      <div className="nuvio-detail-stream-play-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                          <polygon points="5,3 19,12 5,21" />
                        </svg>
                      </div>
                      <div className="nuvio-detail-stream-info">
                        <div className="nuvio-detail-stream-name">
                          {stream.name || stream.title || 'Stream'}
                        </div>
                        {stream.title && stream.name && (
                          <div className="nuvio-detail-stream-desc">{stream.title}</div>
                        )}
                        {stream.addonName && (
                          <div className="nuvio-detail-stream-source">{stream.addonName}</div>
                        )}
                      </div>
                      <div className="nuvio-detail-stream-type">
                        {stream.url?.startsWith('magnet:')
                          ? '🧲'
                          : stream.url?.includes('.torrent')
                          ? '🌊'
                          : '▶'}
                      </div>
                    </button>
                  ))}
                </div>
              ) : streamsFetched && !loadingStreams ? (
                <div className="nuvio-detail-no-streams">
                  No streams found from your Nuvio addons or scrapers for this title.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

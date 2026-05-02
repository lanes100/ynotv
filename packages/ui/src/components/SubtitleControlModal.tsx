import { useEffect, useState, useCallback, useRef } from 'react';
import { Bridge } from '../services/tauri-bridge';
import {
  searchSubSourceMovies,
  searchSubSourceSubtitles,
  downloadSubSourceSubtitle,
  toSubSourceLang,
  fromSubSourceLang,
  type SubSourceMovie,
  type SubSourceSubtitle,
} from '../services/subsource';
import './SubtitleControlModal.css';

interface Track {
  id: number;
  type: 'audio' | 'sub';
  title?: string;
  lang?: string;
  codec?: string;
  default: boolean;
  selected: boolean;
  external?: boolean;
  'external-filename'?: string;
}

interface SubtitleControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  vodTitle?: string;
  vodYear?: string;
}

type ViewState = 'tracks' | 'movies' | 'subtitles';

/* Module-level cache so auto-search results persist across modal open/close */
interface SearchCache {
  query: string;
  year?: string;
  lang: string;
  movies: SubSourceMovie[];
  selectedMovie: SubSourceMovie | null;
  subtitles: SubSourceSubtitle[];
  viewState: ViewState;
  timestamp: number;
}
let searchCache: SearchCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const LANG_LABELS: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', ru: 'Russian', ar: 'Arabic', hi: 'Hindi', zh: 'Chinese',
  ja: 'Japanese', ko: 'Korean', nl: 'Dutch', pl: 'Polish', tr: 'Turkish',
  sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', cs: 'Czech',
  el: 'Greek', he: 'Hebrew', id: 'Indonesian', ms: 'Malay', th: 'Thai',
  vi: 'Vietnamese', ro: 'Romanian', hu: 'Hungarian', bg: 'Bulgarian',
  uk: 'Ukrainian', sr: 'Serbian', hr: 'Croatian', sk: 'Slovak', sl: 'Slovenian',
  lt: 'Lithuanian', lv: 'Latvian', et: 'Estonian', ca: 'Catalan', tl: 'Tagalog',
  fa: 'Persian', ur: 'Urdu', bn: 'Bengali', ta: 'Tamil', te: 'Telugu',
  mr: 'Marathi', pa: 'Punjabi', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam',
  si: 'Sinhala', ne: 'Nepali', my: 'Burmese', km: 'Khmer', lo: 'Lao',
  am: 'Amharic', sw: 'Swahili', zu: 'Zulu', af: 'Afrikaans', sq: 'Albanian',
  hy: 'Armenian', ka: 'Georgian', az: 'Azerbaijani', uz: 'Uzbek', kk: 'Kazakh',
  ky: 'Kyrgyz', mn: 'Mongolian', la: 'Latin', cy: 'Welsh',
  ga: 'Irish', eu: 'Basque', gl: 'Galician', is: 'Icelandic', mt: 'Maltese',
};

export function SubtitleControlModal({ isOpen, onClose, vodTitle, vodYear }: SubtitleControlModalProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Controls
  const [delay, setDelay] = useState(0);
  const [size, setSize] = useState(35);
  const [verticalOffset, setVerticalOffset] = useState(100);

  // SubSource flow state
  const [apiKey, setApiKey] = useState('');
  const [searchLang, setSearchLang] = useState('en');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // View state
  const [viewState, setViewState] = useState<ViewState>('tracks');
  const [movies, setMovies] = useState<SubSourceMovie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<SubSourceMovie | null>(null);
  const [subtitles, setSubtitles] = useState<SubSourceSubtitle[]>([]);
  const [downloadingSubId, setDownloadingSubId] = useState<number | null>(null);

  const loadedRef = useRef(false);
  const autoSearchRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      loadTracks();
      loadSettings().then((key) => {
        // After settings load, trigger auto-search if we have a title + key
        if (!autoSearchRef.current && vodTitle && key) {
          autoSearchRef.current = true;
          const cacheKey = `${vodTitle}|${vodYear || ''}|${searchLang}`;
          if (
            searchCache &&
            searchCache.query === cacheKey &&
            Date.now() - searchCache.timestamp < CACHE_TTL_MS
          ) {
            // Use cached results
            setMovies(searchCache.movies);
            setSelectedMovie(searchCache.selectedMovie);
            setSubtitles(searchCache.subtitles);
            setViewState(searchCache.viewState);
          } else {
            // Run fresh auto-search
            doAutoSearch(vodTitle, vodYear);
          }
        }
      });
    }
  }, [isOpen]);

  // Reset auto-search flag when title changes
  useEffect(() => {
    autoSearchRef.current = false;
  }, [vodTitle, vodYear]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const loadSettings = async (): Promise<string> => {
    try {
      const result = window.storage ? await window.storage.getSettings() : { data: {} };
      const settings: any = result.data || {};
      let key = '';
      if (settings.subtitleSettings) {
        const ss = settings.subtitleSettings;
        key = ss.subsourceApiKey || '';
        setApiKey(key);
        setSearchLang(ss.defaultLanguage || 'en');
        setSize(ss.defaultSize || 35);
        if (!loadedRef.current) {
          setVerticalOffset(100 - (ss.subVerticalOffset || 0));
          setDelay(ss.subDelay || 0);
        }
      }
      if (vodTitle) {
        setSearchQuery(vodTitle + (vodYear ? ` ${vodYear}` : ''));
      }
      loadedRef.current = true;
      return key;
    } catch (e) {
      console.error('Failed to load subtitle settings:', e);
      return '';
    }
  };

  const doAutoSearch = async (title: string, year?: string) => {
    const key = apiKey;
    if (!key || !title.trim()) return;

    console.log('[SubtitleModal] Auto-searching:', { title, year });
    setSearching(true);
    setSearchError('');

    try {
      const result = await searchSubSourceMovies(key, title.trim(), year);
      console.log('[SubtitleModal] Auto-search result:', result);

      if (!result.success) {
        setSearchError(result.error || 'Auto-search failed');
        return;
      }

      if (!result.movies || result.movies.length === 0) {
        setSearchError('No movies found for auto-search.');
        return;
      }

      setMovies(result.movies);
      searchCache = {
        query: `${title}|${year || ''}|${searchLang}`,
        year,
        lang: searchLang,
        movies: result.movies,
        selectedMovie: null,
        subtitles: [],
        viewState: 'movies',
        timestamp: Date.now(),
      };

      // If there's only one movie result, auto-fetch its subtitles too
      if (result.movies.length === 1) {
        const movie = result.movies[0];
        setSelectedMovie(movie);
        const subResult = await searchSubSourceSubtitles(key, movie.movieId, searchLang);
        if (subResult.success && subResult.subtitles && subResult.subtitles.length > 0) {
          setSubtitles(subResult.subtitles);
          setViewState('subtitles');
          searchCache = {
            ...searchCache,
            selectedMovie: movie,
            subtitles: subResult.subtitles,
            viewState: 'subtitles',
            timestamp: Date.now(),
          };
        } else {
          setViewState('movies');
        }
      } else {
        setViewState('movies');
      }
    } catch (e: any) {
      console.error('[SubtitleModal] Auto-search exception:', e);
      setSearchError(e?.message || 'Auto-search failed');
    } finally {
      setSearching(false);
    }
  };

  const loadTracks = async () => {
    setLoading(true);
    try {
      const trackList = await Bridge.getTrackList();
      const filteredTracks = trackList
        .filter((t: any) => t.type === 'sub')
        .map((t: any) => ({
          id: t.id,
          type: t.type,
          title: t.title,
          lang: t.lang,
          codec: t.codec,
          default: t.default || false,
          selected: t.selected || false,
          external: t.external || false,
          'external-filename': t['external-filename'] || '',
        }));
      setTracks(filteredTracks);

      const current = filteredTracks.find((t: Track) => t.selected);
      if (current) {
        setSelectedId(current.id);
      }
    } catch (e) {
      console.error('Failed to load subtitle tracks:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (trackId: number) => {
    try {
      await Bridge.setSubtitleTrack(trackId);
      setSelectedId(trackId);
    } catch (e) {
      console.error('Failed to set subtitle track:', e);
    }
  };

  const handleDisable = async () => {
    try {
      await Bridge.setSubtitleTrack(0);
      setSelectedId(0);
    } catch (e) {
      console.error('Failed to disable subtitles:', e);
    }
  };

  const handleDelayChange = useCallback(async (value: number) => {
    setDelay(value);
    try { await Bridge.setSubtitleDelay(value); } catch (e) { console.error(e); }
  }, []);

  const handleSizeChange = useCallback(async (value: number) => {
    setSize(value);
    try { await Bridge.setSubtitleSize(value); } catch (e) { console.error(e); }
  }, []);

  const handleVerticalOffsetChange = useCallback(async (value: number) => {
    setVerticalOffset(value);
    try { await Bridge.setSubtitlePos(value); } catch (e) { console.error(e); }
  }, []);

  /* -------------------------------------------------------------- */
  /*  SubSource movie search                                          */
  /* -------------------------------------------------------------- */

  const handleSearch = async () => {
    if (!apiKey) {
      setSearchError('Configure API key in Settings > Subtitles');
      return;
    }
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError('');
    setMovies([]);
    setSubtitles([]);
    setSelectedMovie(null);

    console.log('[SubtitleModal] Starting movie search:', { query: searchQuery.trim(), year: vodYear, apiKey: apiKey ? '***' : 'missing' });

    try {
      const result = await searchSubSourceMovies(apiKey, searchQuery.trim(), vodYear);
      console.log('[SubtitleModal] Movie search result:', result);

      if (!result.success) {
        setSearchError(result.error || 'Search failed');
        return;
      }

      if (!result.movies || result.movies.length === 0) {
        setSearchError('No movies/series found for this query.');
        return;
      }

      setMovies(result.movies);
      setViewState('movies');
      searchCache = {
        query: `${searchQuery.trim()}|${vodYear || ''}|${searchLang}`,
        year: vodYear,
        lang: searchLang,
        movies: result.movies,
        selectedMovie: null,
        subtitles: [],
        viewState: 'movies',
        timestamp: Date.now(),
      };
    } catch (e: any) {
      console.error('[SubtitleModal] Movie search exception:', e);
      setSearchError(e?.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  /* -------------------------------------------------------------- */
  /*  Select movie → fetch subtitles                                  */
  /* -------------------------------------------------------------- */

  const handleSelectMovie = async (movie: SubSourceMovie) => {
    setSelectedMovie(movie);
    setSubtitles([]);
    setSearchError('');
    setSearching(true);

    console.log('[SubtitleModal] Fetching subtitles for movie:', { movieId: movie.movieId, title: movie.title, lang: searchLang });

    try {
      const result = await searchSubSourceSubtitles(apiKey, movie.movieId, searchLang);
      console.log('[SubtitleModal] Subtitle search result:', result);

      if (!result.success) {
        setSearchError(result.error || 'Failed to load subtitles for this movie.');
        setViewState('tracks');
        return;
      }

      if (!result.subtitles || result.subtitles.length === 0) {
        setSearchError(`No ${LANG_LABELS[searchLang]?.toLowerCase() || searchLang} subtitles found for "${movie.title}".`);
        setViewState('tracks');
        return;
      }

      setSubtitles(result.subtitles);
      setViewState('subtitles');
      if (searchCache) {
        searchCache = {
          ...searchCache,
          selectedMovie: movie,
          subtitles: result.subtitles,
          viewState: 'subtitles',
          timestamp: Date.now(),
        };
      }
    } catch (e: any) {
      console.error('[SubtitleModal] Subtitle fetch exception:', e);
      setSearchError(e?.message || 'Failed to load subtitles');
      setViewState('tracks');
    } finally {
      setSearching(false);
    }
  };

  /* -------------------------------------------------------------- */
  /*  Download subtitle                                               */
  /* -------------------------------------------------------------- */

  const handleDownloadSubtitle = async (sub: SubSourceSubtitle) => {
    setDownloadingSubId(sub.subtitleId);
    setSearchError('');

    console.log('[SubtitleModal] Downloading subtitle:', { subtitleId: sub.subtitleId, releaseInfo: sub.releaseInfo });

    try {
      const result = await downloadSubSourceSubtitle(apiKey, sub.subtitleId);
      console.log('[SubtitleModal] Download result:', { success: result.success, error: result.error, hasText: !!result.content });

      if (!result.success || !result.content) {
        setSearchError(result.error || 'Download failed');
        return;
      }

      // Write to disk
      const { writeTextFile, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      const { appLocalDataDir, join } = await import('@tauri-apps/api/path');
      const appDir = await appLocalDataDir();
      const safeTitle = (selectedMovie?.title || 'subtitle').replace(/[^a-zA-Z0-9]/g, '_');
      const relPath = `subtitles/${safeTitle}_${sub.language}_${sub.subtitleId}.srt`;
      const filePath = await join(appDir, relPath);

      await mkdir('subtitles', { baseDir: BaseDirectory.AppLocalData, recursive: true }).catch(() => {});
      await writeTextFile(relPath, result.content, { baseDir: BaseDirectory.AppLocalData });
      console.log('[SubtitleModal] Saved SRT to:', filePath);

      // Load into MPV
      await Bridge.addSubtitleFile(filePath);
      console.log('[SubtitleModal] Added subtitle to MPV');

      // Refresh tracks
      await loadTracks();
      setViewState('tracks');
    } catch (e: any) {
      console.error('[SubtitleModal] Download exception:', e);
      setSearchError(e?.message || 'Failed to download subtitle');
    } finally {
      setDownloadingSubId(null);
    }
  };

  /* -------------------------------------------------------------- */
  /*  Remove external subtitle                                        */
  /* -------------------------------------------------------------- */

  const handleRemoveExternal = async (trackId: number) => {
    const track = tracks.find(t => t.id === trackId);
    if (track?.external && track['external-filename']) {
      try {
        await Bridge.removeSubtitleFile(track['external-filename']);
        await loadTracks();
      } catch (e) {
        console.error('Failed to remove subtitle:', e);
      }
    }
  };

  /* -------------------------------------------------------------- */
  /*  Language change                                                 */
  /* -------------------------------------------------------------- */

  const handleLangChange = (langCode: string) => {
    setSearchLang(langCode);
    setViewState('tracks');
    setMovies([]);
    setSubtitles([]);
    setSelectedMovie(null);
    setSearchError('');
  };

  /* -------------------------------------------------------------- */
  /*  Render                                                          */
  /* -------------------------------------------------------------- */

  if (!isOpen) return null;

  const allSubTracks = tracks.filter(t => t.type === 'sub');

  // Derive available languages from actual subtitle tracks
  const availableLangs = Array.from(
    new Set(allSubTracks.map(t => t.lang).filter(Boolean))
  ).map(code => ({
    code: code!,
    label: LANG_LABELS[code!] || code!.toUpperCase(),
  }));

  // Sort: put the currently selected language first, then alphabetically
  availableLangs.sort((a, b) => {
    if (a.code === searchLang) return -1;
    if (b.code === searchLang) return 1;
    return a.label.localeCompare(b.label);
  });

  return (
    <div className="subtitle-modal-overlay">
      <div className="subtitle-modal">
        <div className="subtitle-modal-header">
          <h3>Subtitles</h3>
          <button className="subtitle-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="subtitle-modal-body">
          {/* ── Column 1: Language + Search ── */}
          <div className="subtitle-col subtitle-col-lang">
            <div className="subtitle-col-title">Language</div>
            <div className="subtitle-lang-list">
              {availableLangs.length > 0 ? (
                availableLangs.map((lang) => (
                  <button
                    key={lang.code}
                    className={`subtitle-lang-btn ${searchLang === lang.code ? 'active' : ''}`}
                    onClick={() => handleLangChange(lang.code)}
                  >
                    {lang.label}
                  </button>
                ))
              ) : loading ? (
                <div className="subtitle-empty">Loading…</div>
              ) : (
                <div className="subtitle-empty">No languages</div>
              )}
            </div>

            {/* Search box */}
            <div className="subtitle-search-box">
              <input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="subtitle-search-input"
              />
              <button
                className="subtitle-search-btn"
                onClick={handleSearch}
                disabled={searching}
              >
                {searching ? '…' : 'Search'}
              </button>
            </div>

            {searchError && (
              <div className="subtitle-search-error">{searchError}</div>
            )}
          </div>

          {/* ── Column 2: Tracks / Movies / Subtitles ── */}
          <div className="subtitle-col subtitle-col-tracks">
            {/* Dynamic header */}
            <div className="subtitle-col-title">
              {viewState === 'tracks' && 'Subtitle'}
              {viewState === 'movies' && (
                <button className="subtitle-back-btn" onClick={() => setViewState('tracks')}>
                  ← Back
                </button>
              )}
              {viewState === 'subtitles' && selectedMovie && (
                <button
                  className="subtitle-back-btn"
                  onClick={() => {
                    setViewState('movies');
                    setSubtitles([]);
                  }}
                >
                  ← Back
                </button>
              )}
            </div>

            {/* TRACKS view */}
            {viewState === 'tracks' && (
              <>
                {loading ? (
                  <div className="subtitle-empty">Loading tracks…</div>
                ) : (
                  <div className="subtitle-track-list">
                    <button
                      className={`subtitle-track-btn ${selectedId === 0 ? 'active' : ''}`}
                      onClick={handleDisable}
                    >
                      <span className="subtitle-track-label">None</span>
                    </button>
                    {allSubTracks.map((track) => (
                      <button
                        key={track.id}
                        className={`subtitle-track-btn ${selectedId === track.id ? 'active' : ''}`}
                        onClick={() => handleSelect(track.id)}
                      >
                        <span className="subtitle-track-label">
                          {track.title || `Subtitle ${track.id}`}
                          {track.external && <span className="subtitle-track-tag">EXT</span>}
                        </span>
                        <span className="subtitle-track-meta">
                          {track.lang?.toUpperCase()}
                          {track.external && (
                            <span
                              className="subtitle-track-remove"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveExternal(track.id);
                              }}
                              title="Remove"
                            >
                              ×
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Show movie search results inline when available but view is tracks */}
                {movies.length > 0 && (
                  <>
                    <div className="subtitle-col-title" style={{ marginTop: 12 }}>
                      <button className="subtitle-back-btn" onClick={() => setViewState('movies')}>
                        Show {movies.length} result{movies.length !== 1 ? 's' : ''} →
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* MOVIES view */}
            {viewState === 'movies' && (
              <div className="subtitle-movie-list">
                {movies.map((movie) => (
                  <button
                    key={movie.movieId}
                    className="subtitle-movie-btn"
                    onClick={() => handleSelectMovie(movie)}
                  >
                    <span className="subtitle-movie-title">
                      {movie.title}
                      {movie.alternateTitle && movie.alternateTitle !== movie.title && (
                        <span className="subtitle-movie-alt"> ({movie.alternateTitle})</span>
                      )}
                    </span>
                    <span className="subtitle-movie-meta">
                      {movie.releaseYear && movie.releaseYear > 0 && movie.releaseYear}
                      {movie.type === 'tvseries' && ' · TV'}
                      {movie.type === 'movie' && ' · Movie'}
                      {movie.subtitleCount > 0 && ` · ${movie.subtitleCount} subs`}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* SUBTITLES view */}
            {viewState === 'subtitles' && selectedMovie && (
              <div className="subtitle-result-list">
                <div className="subtitle-result-header">
                  {selectedMovie.title} ({selectedMovie.releaseYear || '?'}) — {LANG_LABELS[searchLang] || searchLang}
                </div>
                {subtitles.map((sub) => (
                  <button
                    key={sub.subtitleId}
                    className="subtitle-result-btn"
                    onClick={() => handleDownloadSubtitle(sub)}
                    disabled={downloadingSubId === sub.subtitleId}
                  >
                    <span className="subtitle-result-info">
                      <span className="subtitle-result-release">
                        {sub.releaseInfo?.join(' ') || 'Unknown release'}
                      </span>
                      <span className="subtitle-result-detail">
                        {sub.productionType}
                        {sub.framerate && ` · ${sub.framerate}fps`}
                        {sub.hearingImpaired && ' · CC'}
                        {sub.downloads > 0 && ` · ${sub.downloads}↓`}
                        {sub.rating && sub.rating.total > 0 && (
                          <span className="subtitle-result-rating">
                            {' '}· 👍 {sub.rating.good}/{sub.rating.total}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="subtitle-result-action">
                      {downloadingSubId === sub.subtitleId ? '…' : 'Load'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Column 3: Controls ── */}
          <div className="subtitle-col subtitle-col-controls">
            <div className="subtitle-col-title">Controls</div>
            <div className="subtitle-controls-list">
              <div className="subtitle-control-item">
                <label>Delay</label>
                <div className="subtitle-control-inputs">
                  <button
                    className="subtitle-control-nudge"
                    onClick={() => handleDelayChange(Math.round((delay - 0.5) * 10) / 10)}
                  >-</button>
                  <span className="subtitle-control-display">{delay.toFixed(1)}s</span>
                  <button
                    className="subtitle-control-nudge"
                    onClick={() => handleDelayChange(Math.round((delay + 0.5) * 10) / 10)}
                  >+</button>
                </div>
              </div>

              <div className="subtitle-control-item">
                <label>Size</label>
                <div className="subtitle-control-inputs">
                  <button
                    className="subtitle-control-nudge"
                    onClick={() => handleSizeChange(Math.max(10, size - 2))}
                  >-</button>
                  <span className="subtitle-control-display">{size}</span>
                  <button
                    className="subtitle-control-nudge"
                    onClick={() => handleSizeChange(Math.min(80, size + 2))}
                  >+</button>
                </div>
              </div>

              <div className="subtitle-control-item">
                <label>Offset</label>
                <div className="subtitle-control-inputs">
                  <button
                    className="subtitle-control-nudge"
                    onClick={() => handleVerticalOffsetChange(Math.max(0, verticalOffset - 5))}
                  >↑</button>
                  <span className="subtitle-control-display">{verticalOffset}%</span>
                  <button
                    className="subtitle-control-nudge"
                    onClick={() => handleVerticalOffsetChange(Math.min(100, verticalOffset + 5))}
                  >↓</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

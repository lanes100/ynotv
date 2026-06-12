import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { InstalledAddon, StremioMetaPreview } from '../../types/stremio';
import { useTmdbApiKey } from '../../hooks/useTmdbLists';
import { SERVICES, providerIdsFor, type StreamingService } from '../../constants/streamingProviders';
import { useStremioHover } from '../../contexts/StremioHoverContext';
import { useUIStore } from '../../stores/uiStore';
import './StreamingServiceView.css';

interface StreamingServiceViewProps {
  service: string;
  onBack: () => void;
  onItemClick: (item: StremioMetaPreview) => void;
  addons?: InstalledAddon[];
  type?: 'movie' | 'series';
}

type Category = {
  id: string;
  label: string;
  fetchMovies: boolean;
  fetchTv: boolean;
  movieGenres: number[];
  tvGenres: number[];
};

const CATEGORIES: Category[] = [
  { id: "all", label: "All", fetchMovies: true, fetchTv: true, movieGenres: [], tvGenres: [] },
  { id: "movies", label: "Movies", fetchMovies: true, fetchTv: false, movieGenres: [], tvGenres: [] },
  { id: "tv", label: "TV Shows", fetchMovies: false, fetchTv: true, movieGenres: [], tvGenres: [] },
  { id: "docs", label: "Documentaries", fetchMovies: true, fetchTv: true, movieGenres: [99], tvGenres: [99] },
  { id: "anim", label: "Animation", fetchMovies: true, fetchTv: true, movieGenres: [16], tvGenres: [16] },
  { id: "kids", label: "Kids & Family", fetchMovies: true, fetchTv: true, movieGenres: [10751], tvGenres: [10751] },
  { id: "reality", label: "Reality", fetchMovies: false, fetchTv: true, movieGenres: [], tvGenres: [10764] },
  { id: "action", label: "Action", fetchMovies: true, fetchTv: true, movieGenres: [28], tvGenres: [10759] },
  { id: "comedy", label: "Comedy", fetchMovies: true, fetchTv: true, movieGenres: [35], tvGenres: [35] },
  { id: "drama", label: "Drama", fetchMovies: true, fetchTv: true, movieGenres: [18], tvGenres: [18] },
  { id: "horror", label: "Horror", fetchMovies: true, fetchTv: true, movieGenres: [27], tvGenres: [9648] },
  { id: "scifi", label: "Sci-Fi & Fantasy", fetchMovies: true, fetchTv: true, movieGenres: [878], tvGenres: [10765] },
  { id: "thriller", label: "Thriller", fetchMovies: true, fetchTv: false, movieGenres: [53], tvGenres: [] },
  { id: "romance", label: "Romance", fetchMovies: true, fetchTv: false, movieGenres: [10749], tvGenres: [] },
];

const TMDB_API = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';
const PAGE_BATCH = 4; // Fetch 4 pages of results per scroll batch

export function StreamingServiceView({ service, onBack, onItemClick, type }: StreamingServiceViewProps) {
  const tmdbToken = useTmdbApiKey();
  const svcMeta = SERVICES[service as StreamingService];
  
  const categories = useMemo(() => {
    const isMovieType = type === 'movie';
    const isSeriesType = type === 'series';

    return CATEGORIES.map(cat => {
      if (isMovieType) {
        return { ...cat, fetchTv: false };
      } else if (isSeriesType) {
        return { ...cat, fetchMovies: false };
      }
      return cat;
    }).filter(cat => {
      if (isMovieType) {
        return cat.id !== 'tv' && cat.id !== 'reality' && cat.id !== 'movies' && cat.fetchMovies;
      } else if (isSeriesType) {
        return cat.id !== 'movies' && cat.id !== 'thriller' && cat.id !== 'romance' && cat.id !== 'tv' && cat.fetchTv;
      }
      return true;
    });
  }, [type]);

  const [activeCategory, setActiveCategory] = useState<Category>(categories[0] || CATEGORIES[0]);

  useEffect(() => {
    if (categories.length > 0 && !categories.some(c => c.id === activeCategory.id)) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  const [movies, setMovies] = useState<StremioMetaPreview[]>([]);
  const [series, setSeries] = useState<StremioMetaPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { onCardMouseEnter, onCardMouseLeave, onCardClick } = useStremioHover();

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.clientWidth > 0) {
      useUIStore.getState().setStremioCatalogScrollPosition(`service-vertical:${service}:${activeCategory.id}`, el.scrollTop);
    }
  }, [service, activeCategory.id]);

  useEffect(() => {
    if (loading) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const saved = useUIStore.getState().stremioCatalogScrollPositions[`service-vertical:${service}:${activeCategory.id}`];
    if (typeof saved === 'number' && saved > 0) {
      const timer = setTimeout(() => {
        el.scrollTop = saved;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, service, activeCategory.id]);

  // Reset and reload when service or category changes
  useEffect(() => {
    setMovies([]);
    setSeries([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);
    setError(null);
  }, [service, activeCategory.id]);

  // Main fetch call
  const fetchProviderData = useCallback(async (pageNum: number) => {
    if (!tmdbToken || !svcMeta) return;

    const providerIds = providerIdsFor(svcMeta);
    const region = 'US'; // default to US region

    const fetchPage = async (kind: 'movie' | 'tv', p: number, genres: number[]) => {
      const params = new URLSearchParams({
        with_watch_providers: providerIds,
        watch_region: region,
        with_watch_monetization_types: 'flatrate|free|ads',
        sort_by: 'popularity.desc',
        include_adult: 'false',
        page: String(p),
      });
      if (genres.length > 0) {
        params.set('with_genres', genres.join(','));
      }
      const url = `${TMDB_API}/discover/${kind}?${params.toString()}`;
      
      const headers: HeadersInit = {
        'Authorization': `Bearer ${tmdbToken}`,
        'Accept': 'application/json',
      };

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`TMDB responded with status ${res.status}`);
      const json = await res.json();
      return json.results || [];
    };

    try {
      const pagesToFetch = Array.from({ length: PAGE_BATCH }, (_, i) => (pageNum - 1) * PAGE_BATCH + 1 + i);
      
      const moviePromises = activeCategory.fetchMovies
        ? Promise.all(pagesToFetch.map(p => fetchPage('movie', p, activeCategory.movieGenres)))
        : Promise.resolve([]);
      
      const tvPromises = activeCategory.fetchTv
        ? Promise.all(pagesToFetch.map(p => fetchPage('tv', p, activeCategory.tvGenres)))
        : Promise.resolve([]);

      const [movieResults, tvResults] = await Promise.all([moviePromises, tvPromises]);
      
      const rawMovies = movieResults.flat().filter(m => m.poster_path);
      const rawTv = tvResults.flat().filter(t => t.poster_path);

      const mappedMovies: StremioMetaPreview[] = rawMovies.map(m => ({
        id: `tmdb:${m.id}`,
        type: 'movie',
        name: m.title,
        poster: `${TMDB_IMG}/w342${m.poster_path}`,
        background: m.backdrop_path ? `${TMDB_IMG}/w780${m.backdrop_path}` : undefined,
        description: m.overview,
        releaseInfo: m.release_date ? m.release_date.slice(0, 4) : undefined,
        imdbRating: m.vote_average > 0 ? String(m.vote_average.toFixed(1)) : undefined,
      }));

      const mappedSeries: StremioMetaPreview[] = rawTv.map(s => ({
        id: `tmdb:${s.id}`,
        type: 'series',
        name: s.name,
        poster: `${TMDB_IMG}/w342${s.poster_path}`,
        background: s.backdrop_path ? `${TMDB_IMG}/w780${s.backdrop_path}` : undefined,
        description: s.overview,
        releaseInfo: s.first_air_date ? s.first_air_date.slice(0, 4) : undefined,
        imdbRating: s.vote_average > 0 ? String(s.vote_average.toFixed(1)) : undefined,
      }));

      if (mappedMovies.length === 0 && mappedSeries.length === 0) {
        setHasMore(false);
      }

      setMovies(prev => {
        const merged = [...prev, ...mappedMovies];
        // Deduplicate
        const seen = new Set();
        return merged.filter(x => !seen.has(x.id) && seen.add(x.id));
      });

      setSeries(prev => {
        const merged = [...prev, ...mappedSeries];
        // Deduplicate
        const seen = new Set();
        return merged.filter(x => !seen.has(x.id) && seen.add(x.id));
      });

      setLoading(false);
      setFetchingMore(false);
    } catch (err: any) {
      console.error('[StreamingServiceView] Failed to fetch TMDB catalogs:', err);
      setError(err.message || 'Failed to load TMDB catalogs.');
      setLoading(false);
      setFetchingMore(false);
    }
  }, [tmdbToken, svcMeta, activeCategory]);

  // Trigger fetch when service/category reset page to 1
  useEffect(() => {
    if (page === 1) {
      void fetchProviderData(1);
    }
  }, [page, fetchProviderData]);

  // Trigger fetch for next batches
  useEffect(() => {
    if (page > 1) {
      setFetchingMore(true);
      void fetchProviderData(page);
    }
  }, [page, fetchProviderData]);

  // Infinite scroll listener for single-category grids
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || activeCategory.id === 'all') return;

    const handleScroll = () => {
      if (loading || fetchingMore || !hasMore) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 600) {
        setPage(prev => prev + 1);
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [loading, fetchingMore, hasMore, activeCategory.id]);

  // Merged grid items for category tabs
  const gridItems = useMemo(() => {
    const all = [...movies, ...series];
    const seen = new Set();
    return all.filter(x => !seen.has(x.id) && seen.add(x.id));
  }, [movies, series]);

  if (!svcMeta) return null;

  return (
    <div className="stremio-service-view" ref={scrollContainerRef} onScroll={handleScroll}>
      {/* Background tint overlay */}
      <div
        className="stremio-service-bg-tint"
        style={{
          backgroundImage: `radial-gradient(ellipse 90% 100% at 30% 0%, ${svcMeta.tint}22 0%, transparent 65%)`,
        }}
      />

      <div className="stremio-service-header">
        <button className="stremio-service-back-btn" onClick={onBack} title="Back to Home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="stremio-service-logo-wrap">
          <img
            className="stremio-service-logo-img"
            src={svcMeta.logo}
            alt={svcMeta.name}
            style={{
              height: svcMeta.logoHeight ? `${svcMeta.logoHeight}px` : '46px',
              filter: svcMeta.logoFilter || 'none',
            }}
          />
        </div>
        <p className="stremio-service-desc">
          Popular movies and series currently streaming on {svcMeta.name} in your region.
        </p>
      </div>

      {/* Category Pills */}
      <div className="stremio-service-categories">
        {categories.map(cat => {
          const isActive = cat.id === activeCategory.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat)}
              className={`stremio-service-category-pill${isActive ? ' active' : ''}`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      <div className="stremio-service-body">
        {loading ? (
          <div className="stremio-service-loading">
            <div className="stremio-spinner" />
            <span>Loading catalogs from TMDB...</span>
          </div>
        ) : error ? (
          <div className="stremio-service-error">{error}</div>
        ) : activeCategory.id === 'all' ? (
          <div className="stremio-service-sections">
            {/* Top 10 Movies Row */}
            {movies.length >= 10 && (
              <StreamingCatalogRow title={`Top 10 Movies on ${svcMeta.name}`}>
                {movies.slice(0, 10).map((item, idx) => (
                  <StremioTopRankCard
                    key={item.id}
                    item={item}
                    rank={idx + 1}
                    onItemClick={onItemClick}
                    onMouseEnter={onCardMouseEnter}
                    onMouseLeave={onCardMouseLeave}
                    onCardClick={onCardClick}
                  />
                ))}
              </StreamingCatalogRow>
            )}

            {/* More Movies Row */}
            {movies.length > 10 && (
              <StreamingCatalogRow title="More Movies">
                {movies.slice(10, 30).map((item) => (
                  <div
                    key={item.id}
                    className="stremio-row-card"
                    onMouseEnter={(e) => onCardMouseEnter(item, e.currentTarget, e)}
                    onMouseLeave={onCardMouseLeave}
                    onClick={() => {
                      onCardClick();
                      onItemClick(item);
                    }}
                  >
                    {item.poster && (
                      <img
                        className="stremio-row-poster"
                        src={item.poster}
                        alt={item.name}
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="stremio-row-card-info">
                      <div className="stremio-row-card-title">{item.name}</div>
                    </div>
                  </div>
                ))}
              </StreamingCatalogRow>
            )}

            {/* Top 10 Series Row */}
            {series.length >= 10 && (
              <StreamingCatalogRow title={`Top 10 Series on ${svcMeta.name}`}>
                {series.slice(0, 10).map((item, idx) => (
                  <StremioTopRankCard
                    key={item.id}
                    item={item}
                    rank={idx + 1}
                    onItemClick={onItemClick}
                    onMouseEnter={onCardMouseEnter}
                    onMouseLeave={onCardMouseLeave}
                    onCardClick={onCardClick}
                  />
                ))}
              </StreamingCatalogRow>
            )}

            {/* More Series Row */}
            {series.length > 10 && (
              <StreamingCatalogRow title="More TV Shows">
                {series.slice(10, 30).map((item) => (
                  <div
                    key={item.id}
                    className="stremio-row-card"
                    onMouseEnter={(e) => onCardMouseEnter(item, e.currentTarget, e)}
                    onMouseLeave={onCardMouseLeave}
                    onClick={() => {
                      onCardClick();
                      onItemClick(item);
                    }}
                  >
                    {item.poster && (
                      <img
                        className="stremio-row-poster"
                        src={item.poster}
                        alt={item.name}
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="stremio-row-card-info">
                      <div className="stremio-row-card-title">{item.name}</div>
                    </div>
                  </div>
                ))}
              </StreamingCatalogRow>
            )}
          </div>
        ) : (
          /* Grid View for Filtered Categories (Movies, TV Shows, genres etc.) */
          <div className="stremio-service-grid-wrap">
            {gridItems.length === 0 ? (
              <div className="stremio-service-empty">No items match this filter in your region.</div>
            ) : (
              <div className="stremio-service-grid">
                {gridItems.map((item) => (
                  <div
                    key={item.id}
                    className="stremio-row-card"
                    onMouseEnter={(e) => onCardMouseEnter(item, e.currentTarget, e)}
                    onMouseLeave={onCardMouseLeave}
                    onClick={() => {
                      onCardClick();
                      onItemClick(item);
                    }}
                  >
                    {item.poster && (
                      <img
                        className="stremio-row-poster"
                        src={item.poster}
                        alt={item.name}
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="stremio-row-card-info">
                      <div className="stremio-row-card-title">{item.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {fetchingMore && (
              <div className="stremio-service-loading-more">
                <div className="stremio-spinner" />
                <span>Loading more titles...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Scrollable row container with custom navigation buttons (< and >)
interface StreamingCatalogRowProps {
  title: string;
  children: React.ReactNode;
}

function StreamingCatalogRow({ title, children }: StreamingCatalogRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    updateScrollButtons();
    const el = e.currentTarget;
    if (el.clientWidth > 0) {
      useUIStore.getState().setStremioCatalogScrollPosition(`service-row:${title}`, el.scrollLeft);
    }
  }, [title, updateScrollButtons]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const saved = useUIStore.getState().stremioCatalogScrollPositions[`service-row:${title}`];
    if (typeof saved === 'number' && saved > 0) {
      const timer = setTimeout(() => {
        el.scrollLeft = saved;
        updateScrollButtons();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [title, children, updateScrollButtons]);

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener('resize', updateScrollButtons);
    
    // Add small delay to let children render and compute scroll width
    const timer = setTimeout(updateScrollButtons, 100);

    return () => {
      window.removeEventListener('resize', updateScrollButtons);
      clearTimeout(timer);
    };
  }, [children, updateScrollButtons]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollTo({ left: el.scrollLeft + (dir === 'left' ? -amount : amount), behavior: 'smooth' });
  };

  return (
    <div className="stremio-service-row-container">
      <div className="stremio-row-header" style={{ marginBottom: '8px' }}>
        <h3 className="stremio-service-row-title">{title}</h3>
        <div className="stremio-row-nav">
          <button className="stremio-row-nav-btn" onClick={() => scroll('left')} disabled={!canScrollLeft}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button className="stremio-row-nav-btn" onClick={() => scroll('right')} disabled={!canScrollRight}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>
      <div className="stremio-service-row-scroll-track-wrapper" style={{ position: 'relative' }}>
        <div className="stremio-service-row-scroll-track" ref={scrollRef} onScroll={handleScroll}>
          <div className="stremio-service-row-track-inner">
            {children}
          </div>
        </div>
        {canScrollLeft && <div className="stremio-row-fade stremio-row-fade-left" />}
        {canScrollRight && <div className="stremio-row-fade stremio-row-fade-right" />}
      </div>
    </div>
  );
}

// Special Overlay Rank Card Component (Netflix Style)
interface TopRankCardProps {
  item: StremioMetaPreview;
  rank: number;
  onItemClick: (item: StremioMetaPreview) => void;
  onMouseEnter: (item: StremioMetaPreview, el: HTMLElement, e: any) => void;
  onMouseLeave: () => void;
  onCardClick: () => void;
}

function StremioTopRankCard({
  item,
  rank,
  onItemClick,
  onMouseEnter,
  onMouseLeave,
  onCardClick,
}: TopRankCardProps) {
  return (
    <div
      className="stremio-rank-card-container"
      onMouseEnter={(e) => onMouseEnter(item, e.currentTarget, e)}
      onMouseLeave={onMouseLeave}
      onClick={() => {
        onCardClick();
        onItemClick(item);
      }}
    >
      <span className="stremio-rank-number">
        {rank}
      </span>
      <div className="stremio-rank-poster-wrap">
        {item.poster && (
          <img
            className="stremio-rank-poster"
            src={item.poster}
            alt={item.name}
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </div>
    </div>
  );
}

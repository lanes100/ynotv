import { useState, useEffect, useCallback, useRef } from 'react';
import type { InstalledAddon, StremioMetaPreview } from '../../types/stremio';
import { fetchCatalog } from '../../services/stremio-addon';
import { useStremioLibraryStore } from '../../stores/stremioLibraryStore';
import './StremioHeroBanner.css';

interface StremioHeroBannerProps {
  addons: InstalledAddon[];
  onItemClick: (item: StremioMetaPreview) => void;
}

export function StremioHeroBanner({ addons, onItemClick }: StremioHeroBannerProps) {
  const addonsKey = addons.map((a) => `${a.id}:${a.enabled !== false}`).join(',');
  const [items, setItems] = useState<StremioMetaPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [logoError, setLogoError] = useState(false);
  
  const autoCycleRef = useRef<any>(null);

  const addToLibrary = useStremioLibraryStore((s) => s.addToLibrary);
  const removeFromLibrary = useStremioLibraryStore((s) => s.removeFromLibrary);
  const isInLibrary = useStremioLibraryStore((s) => s.isInLibrary);

  // Fetch popular items from Cinemeta or fallbacks
  useEffect(() => {
    let active = true;
    setLoading(true);

    const loadBannerContent = async () => {
      try {
        const cinemetaAddon = addons.find(
          (a) => a.id === 'community.cinemeta' || a.baseUrl.includes('cinemeta')
        );

        let fetchedItems: StremioMetaPreview[] = [];

        if (cinemetaAddon) {
          // Fetch movie and series popular catalogs from Cinemeta
          const movieCat = cinemetaAddon.manifest.catalogs?.find(
            (c) => c.type === 'movie' && c.id === 'top'
          ) || { type: 'movie', id: 'top' };
          const seriesCat = cinemetaAddon.manifest.catalogs?.find(
            (c) => c.type === 'series' && c.id === 'top'
          ) || { type: 'series', id: 'top' };

          const [moviesResp, seriesResp] = await Promise.allSettled([
            fetchCatalog(cinemetaAddon.baseUrl, movieCat.type, movieCat.id, { limit: '15' }),
            fetchCatalog(cinemetaAddon.baseUrl, seriesCat.type, seriesCat.id, { limit: '15' }),
          ]);

          const movies = moviesResp.status === 'fulfilled' ? moviesResp.value?.metas || [] : [];
          const series = seriesResp.status === 'fulfilled' ? seriesResp.value?.metas || [] : [];

          // Interleave movie and series items to mix the content
          const maxLen = Math.max(movies.length, series.length);
          for (let i = 0; i < maxLen; i++) {
            if (i < movies.length) fetchedItems.push(movies[i]);
            if (i < series.length) fetchedItems.push(series[i]);
          }
        } else {
          // Fallback: Use top catalogs from enabled addons in order
          const fallbackCatalogs: { addon: InstalledAddon; catalog: any }[] = [];
          for (const addon of addons) {
            if (addon.manifest.catalogs) {
              for (const cat of addon.manifest.catalogs) {
                if (cat.type === 'movie' || cat.type === 'series') {
                  fallbackCatalogs.push({ addon, catalog: cat });
                  if (fallbackCatalogs.length >= 2) break;
                }
              }
            }
            if (fallbackCatalogs.length >= 2) break;
          }

          if (fallbackCatalogs.length > 0) {
            const promises = fallbackCatalogs.map(({ addon, catalog }) =>
              fetchCatalog(addon.baseUrl, catalog.type, catalog.id, { limit: '15' })
                .then((r) => r?.metas || [])
                .catch(() => [])
            );

            const results = await Promise.all(promises);
            const maxLen = Math.max(...results.map((r) => r.length));
            for (let i = 0; i < maxLen; i++) {
              for (let j = 0; j < results.length; j++) {
                if (i < results[j].length) {
                  fetchedItems.push(results[j][i]);
                }
              }
            }
          }
        }

        // Filter items that have background artwork
        fetchedItems = fetchedItems.filter((item) => item.background || item.poster);
        fetchedItems = fetchedItems.slice(0, 15);

        if (active) {
          setItems(fetchedItems);
          setLoading(false);
        }
      } catch (err) {
        console.error('[StremioHeroBanner] Error loading banner items:', err);
        if (active) {
          setLoading(false);
        }
      }
    };

    if (addons.length > 0) {
      loadBannerContent();
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addonsKey]);

  // Reset activeIndex when items change
  useEffect(() => {
    setActiveIndex(0);
  }, [items]);

  // Reset logo error when changing active index
  useEffect(() => {
    setLogoError(false);
  }, [activeIndex]);

  // Handle slideshow auto-cycle
  useEffect(() => {
    if (loading || items.length <= 1 || isHovered) {
      if (autoCycleRef.current) clearInterval(autoCycleRef.current);
      return;
    }

    autoCycleRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 10000); // 10 seconds slide interval

    return () => {
      if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    };
  }, [items, loading, isHovered]);

  const handlePrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  const handleNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  if (loading) {
    return (
      <div className="stremio-hero-banner skeleton">
        <div className="stremio-hero-overlay-left" />
        <div className="stremio-hero-overlay-bottom" />
        <div className="stremio-hero-content">
          <div className="stremio-hero-logo skeleton-logo" />
          <div className="stremio-hero-meta skeleton-meta">
            <div className="skeleton-pill" style={{ width: '80px' }} />
            <div className="skeleton-pill" style={{ width: '50px' }} />
            <div className="skeleton-pill" style={{ width: '70px' }} />
          </div>
          <div className="stremio-hero-description skeleton-desc" />
          <div className="stremio-hero-description skeleton-desc" style={{ width: '60%' }} />
          <div className="stremio-hero-btn skeleton-btn" />
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  const activeItem = items[activeIndex];
  const backdropUrl = activeItem.background || activeItem.poster;

  const isAdded = isInLibrary(activeItem.id);

  const handleWatchlistToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAdded) {
      removeFromLibrary(activeItem.id);
    } else {
      addToLibrary(activeItem);
    }
  };

  return (
    <div
      className="stremio-hero-banner"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Image Layer with key to trigger CSS crossfade animation */}
      {backdropUrl && (
        <img
          key={activeItem.id}
          src={backdropUrl}
          alt=""
          className="stremio-hero-backdrop"
          loading="eager"
        />
      )}

      {/* Aesthetic Vignette and Gradients */}
      <div className="stremio-hero-overlay-left" />
      <div className="stremio-hero-overlay-bottom" />
      <div className="stremio-hero-overlay-vignette" />

      {/* Slide Navigation Controls */}
      {items.length > 1 && (
        <>
          <button className="stremio-hero-nav-arrow left" onClick={handlePrev} aria-label="Previous Spotlight">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button className="stremio-hero-nav-arrow right" onClick={handleNext} aria-label="Next Spotlight">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      {/* Main Spotlight Metadata Content */}
      <div className="stremio-hero-content" key={`content-${activeItem.id}`}>
        {/* Title or Logo Graphic */}
        {activeItem.logo && !logoError ? (
          <img
            src={activeItem.logo}
            alt={activeItem.name}
            className="stremio-hero-logo"
            onError={() => setLogoError(true)}
          />
        ) : (
          <h1 className="stremio-hero-title">{activeItem.name}</h1>
        )}

        {/* Info Badges & Meta */}
        <div className="stremio-hero-meta">
          {activeItem.imdbRating && (
            <div className="stremio-hero-meta-badge rating">
              <svg viewBox="0 0 24 24" fill="currentColor" className="star-icon">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
              <span>{activeItem.imdbRating}</span>
            </div>
          )}

          {activeItem.releaseInfo && (
            <span className="stremio-hero-meta-text">{activeItem.releaseInfo}</span>
          )}

          <span className="stremio-hero-meta-text type-badge">
            {activeItem.type === 'movie' ? 'Movie' : activeItem.type === 'series' ? 'Series' : activeItem.type}
          </span>

          {activeItem.runtime && (
            <span className="stremio-hero-meta-text">{activeItem.runtime}</span>
          )}
        </div>

        {/* Genres row */}
        {activeItem.genres && activeItem.genres.length > 0 && (
          <div className="stremio-hero-genres">
            {activeItem.genres.slice(0, 4).map((genre) => (
              <span key={genre} className="stremio-hero-genre-tag">
                {genre}
              </span>
            ))}
          </div>
        )}

        {/* Synopsis Description */}
        {activeItem.description && (
          <p className="stremio-hero-description" title={activeItem.description}>
            {activeItem.description}
          </p>
        )}

        {/* Action Button */}
        <div className="stremio-hero-actions">
          <button
            className="stremio-hero-btn-watch"
            onClick={() => onItemClick(activeItem)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="btn-icon">
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch Now
          </button>
          <button
            className={`stremio-hero-btn-watchlist ${isAdded ? 'in-watchlist' : ''}`}
            onClick={handleWatchlistToggle}
          >
            {isAdded ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="btn-icon">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                In Watchlist
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="btn-icon">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add to Watchlist
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Dots Indicator */}
      {items.length > 1 && (
        <div className="stremio-hero-indicators">
          {items.map((_, idx) => (
            <button
              key={idx}
              className={`stremio-hero-indicator-dot ${idx === activeIndex ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(idx);
              }}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

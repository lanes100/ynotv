import { useState, useEffect, useCallback, useRef } from 'react';
import type { StoredMovie, StoredSeries } from '../../db';

import './HeroSection.css';

type MediaItem = StoredMovie | StoredSeries;

function HeroBackdropLayer({
  item,
  isActive,
}: {
  item: MediaItem;
  isActive: boolean;
}) {
  const backdropUrl = 'stream_icon' in item
    ? item.stream_icon
    : (item as StoredSeries).cover;

  if (!backdropUrl) return null;

  return (
    <img
      src={backdropUrl}
      alt=""
      aria-hidden="true"
      className={`hero__backdrop-img ${isActive ? 'hero__backdrop-img--active' : ''}`}
    />
  );
}

export interface HeroSectionProps {
  items: (StoredMovie | StoredSeries)[];
  type: 'movie' | 'series';
  onPlay?: (item: StoredMovie | StoredSeries) => void;
  onMoreInfo?: (item: StoredMovie | StoredSeries) => void;
  autoRotate?: boolean;
  rotateInterval?: number;
  loading?: boolean;
}

export function HeroSection({
  items,
  type,
  onPlay,
  onMoreInfo,
  autoRotate = true,
  rotateInterval = 8000,
  loading = false,
}: HeroSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isContentTransitioning, setIsContentTransitioning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const autoCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentItem = items[currentIndex];

  // Reset logo error when index changes
  useEffect(() => {
    setLogoError(false);
  }, [currentIndex]);

  // Auto-rotate
  useEffect(() => {
    if (autoCycleRef.current) {
      clearInterval(autoCycleRef.current);
      autoCycleRef.current = null;
    }
    if (!autoRotate || items.length <= 1 || isHovered) return;

    autoCycleRef.current = setInterval(() => {
      setIsContentTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length);
        setIsContentTransitioning(false);
      }, 300);
    }, rotateInterval);

    return () => {
      if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    };
  }, [autoRotate, items.length, rotateInterval, isHovered]);

  const handlePrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsContentTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
      setIsContentTransitioning(false);
    }, 300);
  }, [items.length]);

  const handleNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsContentTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
      setIsContentTransitioning(false);
    }, 300);
  }, [items.length]);

  const handleDotClick = useCallback((index: number) => {
    if (index === currentIndex) return;
    setIsContentTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setIsContentTransitioning(false);
    }, 300);
  }, [currentIndex]);

  if (loading || !currentItem) {
    return (
      <div className="hero hero--empty">
        <div className="hero__content">
          {loading ? (
            <>
              <div className="hero__spinner" />
              <p>Loading content...</p>
            </>
          ) : (
            <>
              <h1>No content available</h1>
              <p>Add an Xtream source in Settings to get started</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const displayTitle = currentItem.title || currentItem.name;
  const parsedRating = currentItem.rating ? parseFloat(currentItem.rating) : NaN;
  const rating = !isNaN(parsedRating) && parsedRating > 0 ? parsedRating : null;

  const anyItem = currentItem as any;
  const logoUrl = anyItem._cinemetaLogo || null;
  const runtime = anyItem._cinemetaRuntime || null;
  const releaseInfo = anyItem._cinemetaReleaseInfo || currentItem.year || null;
  const displayPlot = currentItem.plot;
  const genres = (currentItem.genre || '')
    .split(',')
    .map((g: string) => g.trim())
    .filter(Boolean);

  return (
    <section
      className="hero"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="hero__backdrop">
        {items.map((item, index) => (
          <HeroBackdropLayer
            key={'stream_id' in item ? item.stream_id : item.series_id}
            item={item}
            isActive={index === currentIndex}
          />
        ))}
        <div className="hero__overlay-left" />
        <div className="hero__overlay-bottom" />
        <div className="hero__overlay-vignette" />
      </div>

      {items.length > 1 && (
        <>
          <button className="hero__nav-arrow hero__nav-arrow--left" onClick={handlePrev} aria-label="Previous">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button className="hero__nav-arrow hero__nav-arrow--right" onClick={handleNext} aria-label="Next">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      <div className={`hero__content ${isContentTransitioning ? 'hero__content--transitioning' : ''}`} key={`content-${currentIndex}`}>
        {logoUrl && !logoError ? (
          <img
            src={logoUrl}
            alt={displayTitle}
            className="hero__logo"
            onError={() => setLogoError(true)}
          />
        ) : (
          <h1 className="hero__title">{displayTitle}</h1>
        )}

        <div className="hero__meta">
          {rating && (
            <span className="hero__rating">
              <svg viewBox="0 0 24 24" fill="currentColor" className="hero__star-icon">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
              {rating.toFixed(1)}
            </span>
          )}

          {releaseInfo && (
            <span className="hero__meta-text">{releaseInfo}</span>
          )}

          <span className="hero__type-badge">
            {type === 'movie' ? 'Movie' : 'Series'}
          </span>

          {runtime && (
            <span className="hero__meta-text">{runtime}</span>
          )}
        </div>

        {genres.length > 0 && (
          <div className="hero__genres">
            {genres.slice(0, 4).map((genre: string) => (
              <span key={genre} className="hero__genre-tag">{genre}</span>
            ))}
          </div>
        )}

        {displayPlot && (
          <p className="hero__description">{displayPlot}</p>
        )}

        <div className="hero__actions">
          <button className="hero__btn hero__btn--play" onClick={() => onPlay?.(currentItem)}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Play
          </button>
        </div>
      </div>

      {items.length > 1 && (
        <div className="hero__indicators">
          {items.map((_, idx) => (
            <button
              key={idx}
              className={`hero__dot ${idx === currentIndex ? 'hero__dot--active' : ''}`}
              onClick={() => handleDotClick(idx)}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default HeroSection;

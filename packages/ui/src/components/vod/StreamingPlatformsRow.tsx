import { useState, useEffect, useRef, useCallback } from 'react';
import { SERVICES, type StreamingService } from '../../constants/streamingProviders';

interface StreamingPlatformsRowProps {
  enabledServices: string[];
  onServiceClick: (service: string) => void;
}

export function StreamingPlatformsRow({ enabledServices, onServiceClick }: StreamingPlatformsRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  const handleScroll = useCallback(() => {
    updateScrollButtons();
  }, [updateScrollButtons]);

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener('resize', updateScrollButtons);
    
    // Add small delay to let children render and compute scroll width
    const timer = setTimeout(updateScrollButtons, 100);

    return () => {
      window.removeEventListener('resize', updateScrollButtons);
      clearTimeout(timer);
    };
  }, [updateScrollButtons, enabledServices]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollTo({ left: el.scrollLeft + (dir === 'left' ? -amount : amount), behavior: 'smooth' });
  };

  const servicesList = Object.keys(SERVICES).filter((key) => enabledServices.includes(key));
  if (servicesList.length === 0) return null;

  return (
    <section className="carousel" style={{ height: 'auto', minHeight: 'auto', paddingBottom: '24px' }}>
      <div className="carousel__header">
        <h2 className="carousel__title">Streaming Platforms</h2>
        <div className="carousel__nav">
          <button
            className="carousel__nav-btn"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            className="carousel__nav-btn"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            aria-label="Scroll right"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
      <div
        className="carousel__scroll-container"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        <div className="carousel__track">
          {servicesList.map((svcKey) => {
            const svc = SERVICES[svcKey as StreamingService];
            return (
              <button
                key={svcKey}
                className="stremio-service-tile-btn"
                onClick={() => onServiceClick(svcKey)}
                style={{ margin: 0 }}
              >
                <img
                  src={svc.logo}
                  alt={svc.name}
                  style={{
                    height: svc.logoHeightHome ? `${svc.logoHeightHome}px` : '24px',
                    width: 'auto',
                    filter: svc.logoFilter || 'none',
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
      {/* Scroll fade indicators */}
      {canScrollLeft && <div className="carousel__fade carousel__fade--left" />}
      {canScrollRight && <div className="carousel__fade carousel__fade--right" />}
    </section>
  );
}

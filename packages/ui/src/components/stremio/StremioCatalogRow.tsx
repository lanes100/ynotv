import { useRef, useState, useCallback, useEffect } from 'react';
import type { StremioMetaPreview } from '../../types/stremio';
import './StremioHome.css';

interface StremioCatalogRowProps {
  title: string;
  items: StremioMetaPreview[];
  onItemClick: (item: StremioMetaPreview) => void;
}

export function StremioCatalogRow({ title, items, onItemClick }: StremioCatalogRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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
  }, [update, items.length]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollTo({ left: el.scrollLeft + (dir === 'left' ? -amount : amount), behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  return (
    <section className="stremio-row">
      <div className="stremio-row-header">
        <h3 className="stremio-row-title">{title}</h3>
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
          {items.map((item) => (
            <div key={item.id} className="stremio-row-card" onClick={() => onItemClick(item)}>
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
                {item.releaseInfo && <div className="stremio-row-card-year">{item.releaseInfo}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {canScrollLeft && <div className="stremio-row-fade stremio-row-fade-left" />}
      {canScrollRight && <div className="stremio-row-fade stremio-row-fade-right" />}
    </section>
  );
}

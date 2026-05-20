import { useRef, useState, useCallback, useEffect } from 'react';
import type { InstalledAddon, StremioManifestCatalog, StremioMetaPreview } from '../../types/stremio';
import { fetchCatalog } from '../../services/stremio-addon';
import './StremioHome.css';

interface StremioCatalogRowProps {
  title: string;
  addon?: InstalledAddon;
  catalog?: StremioManifestCatalog;
  items?: StremioMetaPreview[];
  onItemClick: (item: StremioMetaPreview) => void;
  onSeeAll?: () => void;
  seeAllLabel?: string;
}

export function StremioCatalogRow({
  title,
  addon,
  catalog,
  items: staticItems,
  onItemClick,
  onSeeAll,
  seeAllLabel = 'See all',
}: StremioCatalogRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [items, setItems] = useState<StremioMetaPreview[]>(staticItems || []);
  const [loading, setLoading] = useState(!staticItems && !!addon && !!catalog);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    if (staticItems) {
      setItems(staticItems);
      setLoading(false);
      return;
    }
    if (!addon || !catalog) return;

    let active = true;
    setLoading(true);
    fetchCatalog(addon.baseUrl, catalog.type, catalog.id, { limit: '20' })
      .then((resp) => {
        if (!active) return;
        setItems(resp?.metas?.slice(0, 20) || []);
        setLoading(false);
      })
      .catch((e) => {
        console.warn('[StremioCatalogRow] Failed to load catalog:', catalog.name, e);
        if (!active) return;
        setItems([]);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [addon?.baseUrl, catalog?.type, catalog?.id, staticItems]);

  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [update, items.length, loading]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollTo({ left: el.scrollLeft + (dir === 'left' ? -amount : amount), behavior: 'smooth' });
  };

  if (loading) {
    return (
      <section className="stremio-row">
        <div className="stremio-row-header">
          <div className="stremio-row-title skeleton-text" style={{ width: '180px', height: '22px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px' }} />
        </div>
        <div className="stremio-row-scroll" style={{ overflowX: 'hidden' }}>
          <div className="stremio-row-track">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="stremio-row-card skeleton-card" style={{ pointerEvents: 'none' }}>
                <div className="stremio-row-poster skeleton-poster" />
                <div className="stremio-row-card-info" style={{ marginTop: '8px' }}>
                  <div className="skeleton-line" style={{ height: '14px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', width: '80%', marginBottom: '6px' }} />
                  <div className="skeleton-line" style={{ height: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="stremio-row">
      <div className="stremio-row-header">
        <h3 className="stremio-row-title">{title}</h3>
        <div className="stremio-row-nav">
          {onSeeAll && (
            <button className="stremio-row-see-all-btn" onClick={onSeeAll}>
              {seeAllLabel}
            </button>
          )}
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

import { useRef, useState, useCallback, useEffect } from 'react';
import type { InstalledAddon, StremioManifestCatalog, StremioMetaPreview } from '../../types/stremio';
import { fetchCatalog, getCachedCatalog } from '../../services/stremio-addon';
import { useStremioHover } from '../../contexts/StremioHoverContext';
import { useUIStore } from '../../stores/uiStore';
import { LazyImage } from '../LazyImage';
import './StremioHome.css';

interface StremioCatalogRowProps {
  title: string;
  addon?: InstalledAddon;
  catalog?: StremioManifestCatalog;
  items?: StremioMetaPreview[];
  onItemClick: (item: StremioMetaPreview) => void;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  currentPage?: number;
  hasMore?: boolean;
  onPageChange?: (dir: -1 | 1) => void;
  landscape?: boolean;
}

export function StremioCatalogRow({
  title,
  addon,
  catalog,
  items: staticItems,
  onItemClick,
  onSeeAll,
  seeAllLabel = 'See all',
  currentPage,
  hasMore,
  onPageChange,
  landscape,
}: StremioCatalogRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const stremioView = useUIStore((s) => s.stremioView);

  const cached = (!staticItems && addon && catalog)
    ? getCachedCatalog(addon.baseUrl, catalog.type, catalog.id, { limit: '20' })
    : undefined;

  const [items, setItems] = useState<StremioMetaPreview[]>(() => {
    if (staticItems) return staticItems;
    if (cached?.metas) return cached.metas.slice(0, 20);
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (staticItems) return false;
    if (cached) return false;
    return !!addon && !!catalog;
  });

  const isPageMode = onPageChange !== undefined;

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
    if (isPageMode) return;
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isPageMode, update, items.length, loading]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isPageMode) return;
    update();
    const el = e.currentTarget;
    if (el.clientWidth > 0) {
      useUIStore.getState().setStremioCatalogScrollPosition(title, el.scrollLeft);
    }
  }, [isPageMode, title, update]);

  useEffect(() => {
    if (loading || stremioView !== 'home') return;
    const el = scrollRef.current;
    if (!el) return;
    const saved = useUIStore.getState().stremioCatalogScrollPositions[title];
    if (typeof saved === 'number' && saved > 0) {
      const timer = setTimeout(() => {
        el.scrollLeft = saved;
        update();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, title, stremioView, update]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollTo({ left: el.scrollLeft + (dir === 'left' ? -amount : amount), behavior: 'smooth' });
  };

  const { onCardMouseEnter, onCardMouseLeave, onCardClick } = useStremioHover();

  if (loading) {
    return (
      <section className="stremio-row">
        <div className="stremio-row-header">
          <div className="stremio-row-title skeleton-text" style={{ width: '180px', height: '22px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px' }} />
        </div>
        <div className="stremio-row-scroll" style={{ overflowX: 'hidden' }}>
          <div className="stremio-row-track">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`stremio-row-card skeleton-card ${landscape ? 'landscape' : ''}`} style={{ pointerEvents: 'none' }}>
                <div className={`stremio-row-poster skeleton-poster ${landscape ? 'landscape' : ''}`} />
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
          {isPageMode ? (
            <>
              <span className="stremio-row-page-indicator" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginRight: '6px' }}>
                {currentPage}
              </span>
              <button className="stremio-row-nav-btn" onClick={() => onPageChange(-1)} disabled={!currentPage || currentPage <= 1}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button className="stremio-row-nav-btn" onClick={() => onPageChange(1)} disabled={!hasMore}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </>
          ) : (
            <>
              <button className="stremio-row-nav-btn" onClick={() => scroll('left')} disabled={!canScrollLeft}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button className="stremio-row-nav-btn" onClick={() => scroll('right')} disabled={!canScrollRight}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </>
          )}
        </div>
      </div>
      <div className="stremio-row-scroll-wrapper" style={{ position: 'relative' }}>
        <div className="stremio-row-scroll" ref={scrollRef} onScroll={handleScroll}>
          <div className="stremio-row-track">
            {items.map((item, idx) => {
              const cardImg = landscape ? (item.background || item.poster) : item.poster;
              return (
                <div
                  key={`${item.id}-${idx}`}
                  className={`stremio-row-card ${landscape ? 'landscape' : ''}`}
                  onMouseEnter={(e) => onCardMouseEnter(item, e.currentTarget, e)}
                  onMouseLeave={onCardMouseLeave}
                  onClick={() => {
                    onCardClick();
                    onItemClick(item);
                  }}
                >
                  {cardImg || (item as any).progress != null ? (
                    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: landscape ? '8px' : '0' }}>
                      {cardImg && (
                        <LazyImage
                          className={`stremio-row-poster ${landscape ? 'landscape' : ''}`}
                          src={cardImg}
                          alt={item.name}
                          fetchPriority="low"
                        />
                      )}
                      
                      {landscape && (
                        <div className="stremio-row-landscape-overlay">
                          {item.logo ? (
                            <LazyImage 
                              src={item.logo} 
                              alt="" 
                              className="stremio-row-landscape-logo" 
                              rootMargin="600px"
                            />
                          ) : (
                            <span className="stremio-row-landscape-title-fallback">{item.name}</span>
                          )}
                        </div>
                      )}
                      
                      {item.releaseInfo && /^S\d/i.test(item.releaseInfo) && (
                        <div className="stremio-rw-ep-badge">{item.releaseInfo}</div>
                      )}
                      {(() => {
                        const pct = (item as any).progress;
                        if (typeof pct === 'number' && pct > 2 && pct < 98) {
                          return (
                            <div className="stremio-rw-progress-track">
                              <div className="stremio-rw-progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ) : null}
                <div className="stremio-row-card-info">
                  <div className="stremio-row-card-title">{item.name}</div>
                  {(() => {
                    const pct = (item as any).progress;
                    if (typeof pct === 'number' && pct > 2 && pct < 98) {
                      return <div className="stremio-rw-card-sub">{Math.round(pct)}% watched</div>;
                    }
                    return null;
                  })()}
              </div>
            </div>
          );
        })}
          </div>
        </div>
        {!isPageMode && canScrollLeft && <div className="stremio-row-fade stremio-row-fade-left" />}
        {!isPageMode && canScrollRight && <div className="stremio-row-fade stremio-row-fade-right" />}
      </div>
    </section>
  );
}

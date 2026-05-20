import { useState, useEffect, useCallback, useRef } from 'react';
import type { InstalledAddon, StremioManifestCatalog, StremioMetaPreview } from '../../types/stremio';
import { fetchCatalog } from '../../services/stremio-addon';
import { useStremioCatalogScrollPositions, useSetStremioCatalogScrollPosition } from '../../stores/uiStore';
import './StremioHome.css';

interface CatalogDetailViewProps {
  addon: InstalledAddon;
  catalog: StremioManifestCatalog;
  onItemClick: (item: StremioMetaPreview) => void;
}

export function CatalogDetailView({ addon, catalog, onItemClick }: CatalogDetailViewProps) {
  const catalogKey = `${addon.id}:${catalog.type}:${catalog.id}`;
  const scrollPositions = useStremioCatalogScrollPositions();
  const setScrollPosition = useSetStremioCatalogScrollPosition();
  const [items, setItems] = useState<StremioMetaPreview[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const latestRequestRef = useRef(0);
  const restoredScrollRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingMoreRef = useRef(loadingMore);
  const hasMoreRef = useRef(hasMore);
  const PAGE_SIZE = 50;

  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  const loadPage = useCallback(async (skip: number, replace = false) => {
    if (!replace && (loadingMoreRef.current || !hasMoreRef.current)) return;
    const requestId = ++latestRequestRef.current;
    if (replace) {
      setLoadingInitial(true);
      setError(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const resp = await fetchCatalog(addon.baseUrl, catalog.type, catalog.id, {
        skip: String(skip),
        limit: String(PAGE_SIZE),
      });
      if (requestId !== latestRequestRef.current) return;
      const metas = resp?.metas || [];
      setItems((prev) => {
        const combined = replace ? metas : [...prev, ...metas];
        const seen = new Set<string>();
        return combined.filter((m) => {
          const key = `${m.type}:${m.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      if (metas.length < PAGE_SIZE) setHasMore(false);
    } catch {
      if (requestId === latestRequestRef.current && replace) setError('Failed to load catalog.');
    } finally {
      if (requestId === latestRequestRef.current) {
        if (replace) setLoadingInitial(false);
        else setLoadingMore(false);
      }
    }
  }, [addon.baseUrl, catalog.type, catalog.id]);

  useEffect(() => {
    latestRequestRef.current += 1;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setItems([]);
    setHasMore(true);
    setError(null);
    restoredScrollRef.current = false;
    debounceTimerRef.current = setTimeout(() => {
      void loadPage(0, true);
    }, 150);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [catalogKey, loadPage]);

  useEffect(() => {
    if (!sentinelRef.current || loadingInitial || loadingMore || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first?.isIntersecting) {
        void loadPage(items.length, false);
      }
    }, { rootMargin: '300px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [items.length, hasMore, loadingInitial, loadingMore, loadPage]);

  useEffect(() => {
    if (loadingInitial || restoredScrollRef.current || !containerRef.current) return;
    const saved = scrollPositions[catalogKey];
    if (typeof saved === 'number' && saved > 0) {
      containerRef.current.scrollTop = saved;
    }
    restoredScrollRef.current = true;
  }, [catalogKey, loadingInitial, scrollPositions]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      setScrollPosition(catalogKey, el.scrollTop);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      setScrollPosition(catalogKey, el.scrollTop);
    };
  }, [catalogKey, setScrollPosition]);

  if (loadingInitial) {
    return <div className="stremio-loading-text" style={{ padding: '40px' }}>Loading catalog...</div>;
  }

  if (error) {
    return <div className="stremio-loading-text" style={{ padding: '40px' }}>{error}</div>;
  }

  if (items.length === 0 && !hasMore) {
    return <div className="stremio-loading-text" style={{ padding: '40px' }}>No items in this catalog.</div>;
  }

  return (
    <div className="stremio-catalog-detail-view" ref={containerRef}>
      <div style={{ padding: '24px' }}>
      <div className="stremio-row-header" style={{ marginBottom: '16px' }}>
        <h3 className="stremio-row-title">{catalog.name || `${addon.manifest.name} - ${catalog.type}`}</h3>
      </div>
      <div className="stremio-meta-grid">
        {items.map((item) => (
          <div key={`${item.type}:${item.id}`} className="stremio-meta-card" onClick={() => onItemClick(item)}>
            {item.poster && (
              <img
                className="stremio-meta-poster"
                src={item.poster}
                alt={item.name}
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="stremio-meta-card-info">
              <div className="stremio-meta-card-title">{item.name}</div>
              {item.releaseInfo && <div className="stremio-meta-card-year">{item.releaseInfo}</div>}
              {item.imdbRating && <div className="stremio-meta-card-rating">★ {item.imdbRating}</div>}
            </div>
          </div>
        ))}
      </div>

      {loadingMore && <div className="stremio-loading-text">Loading more...</div>}
      <div ref={sentinelRef} style={{ height: '1px' }} />
    </div>
    </div>
  );
}

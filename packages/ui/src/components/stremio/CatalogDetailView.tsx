import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { InstalledAddon, StremioManifestCatalog, StremioMetaPreview } from '../../types/stremio';
import { fetchCatalog } from '../../services/stremio-addon';
import { useStremioAddonStore } from '../../stores/stremioAddonStore';
import {
  useStremioCatalogScrollPositions,
  useSetStremioCatalogScrollPosition,
  useSetStremioSelectedAddonId,
  useSetStremioSelectedCatalogId,
} from '../../stores/uiStore';
import { useStremioHover } from '../../contexts/StremioHoverContext';
import './StremioHome.css';

const HIDDEN_CATALOG_IDS = new Set(['lastVideosIds', 'calendarVideosIds']);

interface CatalogDetailViewProps {
  addon: InstalledAddon;
  catalog: StremioManifestCatalog;
  onItemClick: (item: StremioMetaPreview) => void;
}

export function CatalogDetailView({ addon, catalog, onItemClick }: CatalogDetailViewProps) {
  const catalogKey = `${addon.id}:${catalog.type}:${catalog.id}`;
  const scrollPositions = useStremioCatalogScrollPositions();
  const setScrollPosition = useSetStremioCatalogScrollPosition();
  const setSelectedAddonId = useSetStremioSelectedAddonId();
  const setSelectedCatalogId = useSetStremioSelectedCatalogId();

  const addons = useStremioAddonStore((s) => s.enabledAddons);

  const [items, setItems] = useState<StremioMetaPreview[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState('');

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const latestRequestRef = useRef(0);
  const restoredScrollRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingMoreRef = useRef(loadingMore);
  const hasMoreRef = useRef(hasMore);
  const itemsRef = useRef<StremioMetaPreview[]>(items);
  const PAGE_SIZE = 50;

  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // Compute navigation filters
  const types = useMemo(() => {
    const set = new Set<string>();
    for (const a of addons) {
      for (const c of a.manifest.catalogs || []) {
        if (!HIDDEN_CATALOG_IDS.has(c.id)) {
          set.add(c.type);
        }
      }
    }
    return Array.from(set);
  }, [addons]);

  const availableCatalogs = useMemo(() => {
    const list: { addon: InstalledAddon; catalog: StremioManifestCatalog }[] = [];
    for (const a of addons) {
      for (const c of a.manifest.catalogs || []) {
        if (c.type === catalog.type && !HIDDEN_CATALOG_IDS.has(c.id)) {
          list.push({ addon: a, catalog: c });
        }
      }
    }
    return list;
  }, [addons, catalog.type]);

  const genreExtra = useMemo(() => {
    return catalog.extra?.find((e) => e.name === 'genre');
  }, [catalog]);

  const genreOptions = useMemo(() => {
    return genreExtra?.options || [];
  }, [genreExtra]);

  const handleTypeChange = (newType: string) => {
    const match = addons
      .flatMap((a) => (a.manifest.catalogs || []).map((c) => ({ addon: a, catalog: c })))
      .find((x) => x.catalog.type === newType);
    if (match) {
      setSelectedAddonId(match.addon.id);
      setSelectedCatalogId(match.catalog.id);
      setSelectedGenre('');
    }
  };

  const handleCatalogChange = (compositeKey: string) => {
    const [addonId, catalogId] = compositeKey.split('|');
    setSelectedAddonId(addonId);
    setSelectedCatalogId(catalogId);
    setSelectedGenre('');
  };

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
      const extraParams: Record<string, string> = {
        skip: String(skip),
        limit: String(PAGE_SIZE),
      };
      if (selectedGenre) {
        extraParams.genre = selectedGenre;
      }

      const resp = await fetchCatalog(addon.baseUrl, catalog.type, catalog.id, extraParams);
      if (requestId !== latestRequestRef.current) return;
      const metas = resp?.metas || [];
      
      const prevItems = itemsRef.current;
      const combined = replace ? metas : [...prevItems, ...metas];
      const seen = new Set<string>();
      const filtered = combined.filter((m) => {
        const key = `${m.type}:${m.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const receivedAnyNew = filtered.length > prevItems.length;
      setItems(filtered);

      // If we are appending items but didn't actually add any new unique elements,
      // it means the source has no more unique elements (or is repeating them).
      if (!replace && !receivedAnyNew) {
        setHasMore(false);
      }

      // If the response returns exactly 0 metas, we have reached the end.
      if (metas.length === 0) {
        setHasMore(false);
      }
    } catch {
      if (requestId === latestRequestRef.current && replace) setError('Failed to load catalog.');
    } finally {
      if (requestId === latestRequestRef.current) {
        if (replace) setLoadingInitial(false);
        else setLoadingMore(false);
      }
    }
  }, [addon.baseUrl, catalog.type, catalog.id, selectedGenre]);

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
  }, [catalogKey, selectedGenre, loadPage]);

  // Observe sentinel intersection relative to the .stremio-main scrolling container
  useEffect(() => {
    if (!sentinelRef.current || loadingInitial || loadingMore || !hasMore) return;
    const mainEl = document.querySelector('.stremio-main');
    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first?.isIntersecting) {
        void loadPage(items.length, false);
      }
    }, { root: mainEl, rootMargin: '400px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [items.length, hasMore, loadingInitial, loadingMore, loadPage]);

  // Restore scroll position on the actual scroll container (.stremio-main)
  useEffect(() => {
    if (loadingInitial || restoredScrollRef.current) return;
    const el = document.querySelector('.stremio-main');
    if (!el) return;
    const saved = scrollPositions[catalogKey];
    if (typeof saved === 'number' && saved > 0) {
      el.scrollTop = saved;
    }
    restoredScrollRef.current = true;
  }, [catalogKey, loadingInitial, scrollPositions]);

  // Track scroll position on the actual scroll container (.stremio-main)
  useEffect(() => {
    const el = document.querySelector('.stremio-main');
    if (!el) return;
    const onScroll = () => {
      setScrollPosition(catalogKey, el.scrollTop);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (el) setScrollPosition(catalogKey, el.scrollTop);
    };
  }, [catalogKey, setScrollPosition]);

  const { onCardMouseEnter, onCardMouseLeave, onCardClick } = useStremioHover();

  return (
    <div className="stremio-catalog-detail-view" ref={containerRef}>
      <div style={{ padding: '24px' }}>
        <div className="stremio-discover-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              className="stremio-row-see-all-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}
              onClick={() => {
                setSelectedAddonId(null);
                setSelectedCatalogId(null);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h3 className="stremio-row-title" style={{ fontSize: '1.2rem' }}>Discover</h3>
          </div>

          <div className="stremio-discover-filters">
            {/* Type selector */}
            <select
              className="stremio-discover-select"
              value={catalog.type}
              onChange={(e) => handleTypeChange(e.target.value)}
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}s
                </option>
              ))}
            </select>

            {/* Catalog selector */}
            <select
              className="stremio-discover-select"
              value={`${addon.id}|${catalog.id}`}
              onChange={(e) => handleCatalogChange(e.target.value)}
            >
              {availableCatalogs.map(({ addon: a, catalog: c }) => (
                <option key={`${a.id}|${c.id}`} value={`${a.id}|${c.id}`}>
                  {c.name || `${a.manifest.name} - ${c.type}`}
                </option>
              ))}
            </select>

            {/* Genre selector (if options available) */}
            {genreOptions.length > 0 && (
              <select
                className="stremio-discover-select"
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
              >
                <option value="">All Genres</option>
                {genreOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {loadingInitial ? (
          <div className="stremio-loading-text" style={{ padding: '80px 0' }}>Loading catalog...</div>
        ) : error ? (
          <div className="stremio-loading-text" style={{ padding: '80px 0' }}>{error}</div>
        ) : items.length === 0 ? (
          <div className="stremio-loading-text" style={{ padding: '80px 0' }}>No items in this catalog.</div>
        ) : (
          <>
            <div className="stremio-meta-grid">
              {items.map((item) => (
                <div
                  key={`${item.type}:${item.id}`}
                  className="stremio-meta-card"
                  onMouseEnter={(e) => onCardMouseEnter(item, e.currentTarget, e)}
                  onMouseLeave={onCardMouseLeave}
                  onClick={() => {
                    onCardClick();
                    onItemClick(item);
                  }}
                >
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
                    {item.imdbRating && <div className="stremio-meta-card-rating">★ {item.imdbRating}</div>}
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <div ref={sentinelRef} className="stremio-loading-text" style={{ padding: '20px 0', textAlign: 'center' }}>
                {loadingMore ? 'Loading more...' : ''}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchCatalog } from '../../services/stremio-addon';
import type { InstalledAddon, StremioManifestCatalog, StremioMetaPreview } from '../../types/stremio';
import { useStremioHover } from '../../contexts/StremioHoverContext';
import './NuvioSearchPage.css';

interface NuvioSearchPageProps {
  addons: InstalledAddon[];
  onItemClick: (item: { content_id: string; content_type: string; name: string; poster: string | null }) => void;
  initialCatalogKey?: string | null;
  onBack?: () => void;
  query: string;
  onQueryChange: (query: string) => void;
}

const TYPE_OPTIONS = [
  { key: 'movie', label: 'Movies' },
  { key: 'series', label: 'Series' },
  { key: 'anime', label: 'Anime' },
  { key: 'channel', label: 'Channels' },
  { key: 'tv', label: 'TV' },
];

interface DiscoverCatalogInfo {
  key: string;
  addon: InstalledAddon;
  addonName: string;
  manifestUrl: string;
  type: string;
  catalogId: string;
  catalogName: string;
  genreOptions: string[];
  genreRequired: boolean;
}

function getTypeLabel(type: string): string {
  const opt = TYPE_OPTIONS.find(o => o.key === type);
  return opt?.label || type.charAt(0).toUpperCase() + type.slice(1);
}

function catalogSupportsSearch(catalog: StremioManifestCatalog): boolean {
  if (catalog.extra?.some(e => e.name === 'search')) {
    return !catalog.extra.some(e => e.isRequired && e.name !== 'search');
  }
  if (catalog.extraSupported?.includes('search')) {
    return !catalog.extraRequired?.some(r => r !== 'search');
  }
  return false;
}

function catalogSupportsDiscover(catalog: StremioManifestCatalog): boolean {
  if (catalog.extra?.some(e => e.name === 'search' && e.isRequired)) return false;
  const hasRequiredNonSearch = catalog.extra?.some(e => e.isRequired && e.name !== 'search' && e.name !== 'genre');
  if (hasRequiredNonSearch) return false;
  if (catalog.extraSupported) {
    const requiredNonSearch = catalog.extraRequired?.filter(r => r !== 'search' && r !== 'genre');
    if (requiredNonSearch && requiredNonSearch.length > 0) return false;
  }
  return true;
}

function getSearchCatalogs(addons: InstalledAddon[]): { addon: InstalledAddon; catalog: StremioManifestCatalog }[] {
  const seen = new Set<string>();
  const results: { addon: InstalledAddon; catalog: StremioManifestCatalog }[] = [];
  for (const addon of addons) {
    for (const catalog of addon.manifest?.catalogs || []) {
      if (!catalogSupportsSearch(catalog)) continue;
      const key = `${addon.manifest?.id || addon.id}:${catalog.type}:${catalog.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ addon, catalog });
    }
  }
  return results;
}

function getDiscoverCatalogs(addons: InstalledAddon[]): DiscoverCatalogInfo[] {
  const seen = new Set<string>();
  const results: DiscoverCatalogInfo[] = [];
  for (const addon of addons) {
    for (const catalog of addon.manifest?.catalogs || []) {
      if (!catalogSupportsDiscover(catalog)) continue;
      const genreExtra = catalog.extra?.find(e => e.name === 'genre');
      const genreOptions = genreExtra?.options || [];
      const genreRequired = genreExtra?.isRequired || false;
      const key = `${addon.manifest?.id || addon.id}:${catalog.type}:${catalog.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        key,
        addon,
        addonName: addon.manifest?.name || addon.id,
        manifestUrl: addon.baseUrl,
        type: catalog.type,
        catalogId: catalog.id,
        catalogName: catalog.name,
        genreOptions,
        genreRequired,
      });
    }
  }
  return results;
}

export function NuvioSearchPage({
  addons,
  onItemClick,
  initialCatalogKey,
  onBack,
  query,
  onQueryChange
}: NuvioSearchPageProps) {
  const { onCardMouseEnter, onCardMouseLeave, onCardClick } = useStremioHover();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCatalogKey, setSelectedCatalogKey] = useState<string | null>(initialCatalogKey || null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [discoverItems, setDiscoverItems] = useState<StremioMetaPreview[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{ addon: InstalledAddon; catalog: StremioManifestCatalog; items: StremioMetaPreview[] }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusRef = useRef<HTMLInputElement>(null);
  const discoverSkipRef = useRef(0);
  const hasMoreDiscoverRef = useRef(true);
  const discoverLoadingRef = useRef(false);

  const discoverCatalogs = useMemo(() => getDiscoverCatalogs(addons), [addons]);
  const searchCatalogs = useMemo(() => getSearchCatalogs(addons), [addons]);

  const filteredByType = useMemo(() => {
    if (!selectedType) return discoverCatalogs;
    const normType = selectedType === 'tv' ? 'series' : selectedType;
    return discoverCatalogs.filter(dc => {
      const dcType = dc.type === 'tv' ? 'series' : dc.type;
      return dcType === normType;
    });
  }, [discoverCatalogs, selectedType]);

  const selectedCatalogInfo = useMemo(() => {
    if (!selectedCatalogKey) return null;
    return discoverCatalogs.find(dc => dc.key === selectedCatalogKey) || null;
  }, [discoverCatalogs, selectedCatalogKey]);

  const genreOptions = useMemo(() => {
    const cat = selectedCatalogInfo;
    if (!cat) return [];
    if (cat.genreOptions.length > 0) return cat.genreOptions;
    if (selectedType) {
      const allGenres = new Set<string>();
      filteredByType.forEach(dc => dc.genreOptions.forEach(g => allGenres.add(g)));
      return Array.from(allGenres);
    }
    return [];
  }, [selectedCatalogInfo, filteredByType, selectedType]);

  const availableTypes = useMemo(() => {
    const types = new Set(discoverCatalogs.map(dc => dc.type));
    return TYPE_OPTIONS.filter(o => types.has(o.key) || (o.key === 'series' && types.has('tv')));
  }, [discoverCatalogs]);

  const availableCatalogs = useMemo(() => {
    return filteredByType;
  }, [filteredByType]);

  // Auto-select first type if none selected
  useEffect(() => {
    if (!selectedType && availableTypes.length > 0) {
      setSelectedType(availableTypes[0].key);
    }
  }, [availableTypes, selectedType]);

  // Auto-select catalog when type changes
  useEffect(() => {
    if (availableCatalogs.length > 0) {
      const currentStillValid = selectedCatalogKey && availableCatalogs.some(c => c.key === selectedCatalogKey);
      if (!currentStillValid) {
        setSelectedCatalogKey(availableCatalogs[0].key);
      }
    } else {
      setSelectedCatalogKey(null);
    }
  }, [availableCatalogs, selectedCatalogKey]);

  // Reset genre when catalog changes
  useEffect(() => {
    setSelectedGenre(null);
    discoverSkipRef.current = 0;
    hasMoreDiscoverRef.current = true;
  }, [selectedCatalogKey, selectedType]);

  // Load discover items with pagination
  const loadDiscover = useCallback(async (append = false) => {
    const catalog = discoverCatalogs.find(dc => dc.key === selectedCatalogKey);
    if (!catalog || !catalog.addon) return;
    if (append && discoverLoadingRef.current) return;

    discoverLoadingRef.current = true;
    if (!append) {
      discoverSkipRef.current = 0;
      hasMoreDiscoverRef.current = true;

      // Scroll parent container to top on new query/catalog change
      const el = document.querySelector('.nuvio-main');
      if (el) {
        el.scrollTop = 0;
      }
    }
    setDiscoverLoading(true);
    try {
      const extra: Record<string, string> = {
        skip: String(discoverSkipRef.current),
        limit: '50',
      };
      if (selectedGenre) extra.genre = selectedGenre;

      const resp = await fetchCatalog(catalog.addon.baseUrl, catalog.type, catalog.catalogId, extra);
      const metas = resp?.metas || [];
      if (append) {
        setDiscoverItems(prev => [...prev, ...metas]);
      } else {
        setDiscoverItems(metas);
      }
      if (metas.length === 0) {
        hasMoreDiscoverRef.current = false;
      } else {
        const nextSkip = resp?.nextSkip;
        discoverSkipRef.current = nextSkip != null ? nextSkip : discoverSkipRef.current + metas.length;
      }
    } catch {
      if (!append) setDiscoverItems([]);
    } finally {
      setDiscoverLoading(false);
      discoverLoadingRef.current = false;
    }
  }, [discoverCatalogs, selectedCatalogKey, selectedGenre]);

  useEffect(() => {
    if (query) return;
    setDiscoverItems([]);
    loadDiscover(false);
  }, [loadDiscover, query]);

  useEffect(() => {
    if (initialCatalogKey) {
      setSelectedCatalogKey(initialCatalogKey);
      const cat = discoverCatalogs.find(dc => dc.key === initialCatalogKey);
      if (cat) {
        setSelectedType(cat.type === 'tv' ? 'series' : cat.type);
      }
      onQueryChange('');
      setDiscoverItems([]);
      discoverSkipRef.current = 0;
      hasMoreDiscoverRef.current = true;
    }
  }, [initialCatalogKey, discoverCatalogs]);

  // Search execution
  const executeSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2 || searchCatalogs.length === 0) {
      setSearchResults([]);
      setSearchDone(false);
      return;
    }
    setSearchLoading(true);
    setSearchDone(false);
    try {
      const results = await Promise.all(
        searchCatalogs.map(async ({ addon, catalog }) => {
          try {
            const resp = await fetchCatalog(addon.baseUrl, catalog.type, catalog.id, { search: searchQuery, limit: '20' });
            return { addon, catalog, items: resp?.metas || [] };
          } catch {
            return { addon, catalog, items: [] };
          }
        })
      );
      setSearchResults(results.filter(r => r.items.length > 0));
    } finally {
      setSearchLoading(false);
      setSearchDone(true);
    }
  }, [searchCatalogs]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => executeSearch(query), 350);
    } else {
      setSearchResults([]);
      setSearchDone(false);
    }
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query, executeSearch]);

  const handleQueryChange = (value: string) => {
    onQueryChange(value);
  };

  const handleClear = () => {
    onQueryChange('');
    focusRef.current?.focus();
  };

  // Infinite scroll for discover
  const discoverSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = discoverSentinelRef.current;
    if (!sentinel || !selectedCatalogKey) return;
    const container = sentinel.closest('.nuvio-main');
    if (!container) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMoreDiscoverRef.current && !discoverLoadingRef.current) {
        loadDiscover(true);
      }
    }, { root: container, rootMargin: '600px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [selectedCatalogKey, loadDiscover, discoverItems.length]);

  return (
    <div className="nuvio-search-page">
      {/* Sticky Search Bar */}
      <div className="nuvio-search-bar-sticky">
        <div className="nuvio-search-bar-inner">
          <svg className="nuvio-search-bar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={focusRef}
            className="nuvio-search-bar-input"
            type="text"
            placeholder="Search movies, series, and more..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
          {query && (
            <button className="nuvio-search-bar-clear" onClick={handleClear}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!query ? (
        /* DISCOVER SECTION */
        <div className="nuvio-discover-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            {initialCatalogKey && onBack && (
              <button
                onClick={onBack}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '20px',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '6px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                  e.currentTarget.style.transform = 'translateX(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '14px', height: '14px' }}>
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>Back</span>
              </button>
            )}
            <h2 className="nuvio-discover-title" style={{ margin: 0 }}>Discover</h2>
          </div>

          {/* 3 Dropdown Filters */}
          <div className="nuvio-discover-filters">
            {/* Type Dropdown */}
            <div className="nuvio-discover-filter-chip">
              <select
                className="nuvio-discover-filter-select"
                value={selectedType || ''}
                onChange={(e) => setSelectedType(e.target.value || null)}
              >
                {availableTypes.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
              <svg className="nuvio-discover-filter-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* Catalog Dropdown */}
            <div className="nuvio-discover-filter-chip">
              <select
                className="nuvio-discover-filter-select"
                value={selectedCatalogKey || ''}
                onChange={(e) => setSelectedCatalogKey(e.target.value || null)}
                disabled={availableCatalogs.length === 0}
              >
                {availableCatalogs.map(c => (
                  <option key={c.key} value={c.key}>{c.catalogName}</option>
                ))}
              </select>
              <svg className="nuvio-discover-filter-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* Genre Dropdown */}
            <div className="nuvio-discover-filter-chip">
              <select
                className="nuvio-discover-filter-select"
                value={selectedGenre || ''}
                onChange={(e) => setSelectedGenre(e.target.value || null)}
                disabled={genreOptions.length === 0}
              >
                <option value="">All Genres</option>
                {genreOptions.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <svg className="nuvio-discover-filter-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Discover Results Grid */}
          {discoverLoading && discoverItems.length === 0 ? (
            <div className="nuvio-search-loading">
              <div className="spinner" style={{ width: '28px', height: '28px', borderRadius: '50%', border: '3px solid rgba(0,212,255,0.1)', borderTopColor: '#00d4ff', animation: 'spin 1s linear infinite' }} />
              <span>Loading discover...</span>
            </div>
          ) : discoverItems.length > 0 ? (
            <>
              <div className="nuvio-discover-grid">
                {discoverItems.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="nuvio-discover-item"
                    onMouseEnter={(e) => onCardMouseEnter(item, e.currentTarget, e)}
                    onMouseLeave={onCardMouseLeave}
                    onClick={() => {
                      onCardClick();
                      onItemClick({ content_id: item.id, content_type: item.type, name: item.name, poster: item.poster ?? null });
                    }}
                  >
                    <div className="nuvio-discover-poster-wrap">
                      {item.poster ? (
                        <img src={item.poster} alt={item.name} className="nuvio-discover-poster" />
                      ) : (
                        <div className="nuvio-discover-poster-placeholder">{item.name}</div>
                      )}
                    </div>
                    <div className="nuvio-discover-item-title">{item.name}</div>
                    {item.releaseInfo && (
                      <div className="nuvio-discover-item-year">{item.releaseInfo}</div>
                    )}
                  </div>
                ))}
              </div>
              <div ref={discoverSentinelRef} style={{ height: '1px' }} />
              {discoverLoading && (
                <div className="nuvio-search-loading" style={{ padding: '16px 0' }}>
                  <div className="spinner" style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid rgba(0,212,255,0.1)', borderTopColor: '#00d4ff', animation: 'spin 1s linear infinite' }} />
                </div>
              )}
            </>
          ) : (
            <div className="nuvio-discover-empty">
              {addons.length === 0
                ? 'No addons installed. Add one in the Addons tab to discover content.'
                : 'No items found for the selected filters.'}
            </div>
          )}
        </div>
      ) : (
        /* SEARCH RESULTS SECTION */
        <div className="nuvio-search-results">
          {searchLoading && searchResults.length === 0 ? (
            <div className="nuvio-search-loading">
              <div className="spinner" style={{ width: '28px', height: '28px', borderRadius: '50%', border: '3px solid rgba(0,212,255,0.1)', borderTopColor: '#00d4ff', animation: 'spin 1s linear infinite' }} />
              <span>Searching...</span>
            </div>
          ) : searchResults.length > 0 ? (
            searchResults.map(({ addon, catalog, items }) => (
              <div key={`${addon.id}-${catalog.type}-${catalog.id}`} className="nuvio-search-result-section">
                <div className="nuvio-row-header">
                  <h3 className="nuvio-row-title">{addon.manifest?.name || addon.id} - {catalog.name} ({getTypeLabel(catalog.type)})</h3>
                </div>
                <div className="nuvio-scroll-rail">
                  {items.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      className="nuvio-card"
                      onMouseEnter={(e) => onCardMouseEnter(item, e.currentTarget, e)}
                      onMouseLeave={onCardMouseLeave}
                      onClick={() => {
                        onCardClick();
                        onItemClick({ content_id: item.id, content_type: item.type, name: item.name, poster: item.poster ?? null });
                      }}
                    >
                      {item.poster ? (
                        <img src={item.poster} alt={item.name} className="nuvio-card-img" />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.3)', padding: '12px', boxSizing: 'border-box', textAlign: 'center', fontSize: '0.75rem' }}>
                          {item.name}
                        </div>
                      )}
                      <div className="nuvio-card-info">
                        <div className="nuvio-card-title">{item.name}</div>
                        {item.releaseInfo && <div className="nuvio-card-sub">{item.releaseInfo}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : searchDone && searchResults.length === 0 ? (
            <div className="nuvio-discover-empty">
              {searchCatalogs.length === 0
                ? 'Your installed addons do not support search.'
                : 'No results found for your search.'}
            </div>
          ) : query.length === 1 ? (
            <div className="nuvio-discover-empty" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Type at least 2 characters to search.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

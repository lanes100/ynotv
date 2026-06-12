import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { InstalledAddon, StremioMetaPreview, StremioMeta } from '../../types/stremio';
import { fetchCatalog, fetchMeta } from '../../services/stremio-addon';
import { scrobbler, TRAKT_CATALOG_DEFINITIONS, type TraktCatalogType } from '../../services/scrobbler';
import {
  useStremioSearchQuery,
  useStremioView,
  useSetStremioView,
  useStremioSelectedAddonId,
  useSetStremioSelectedAddonId,
  useStremioSelectedCatalogId,
  useSetStremioSelectedCatalogId,
  useStremioSelectedCatalogType,
  useSetStremioSelectedCatalogType,
  useTraktCatalogRefreshToken,
  useSetStremioSelectedSeason,
  useSetStremioPreselectVideoId,
  useStremioSelectedCloudCatalogKey,
  useSetStremioSelectedCloudCatalogKey,
} from '../../stores/uiStore';
import { useTmdbApiKey } from '../../hooks/useTmdbLists';
import { SERVICES, type StreamingService } from '../../constants/streamingProviders';
import { StreamingServiceView } from './StreamingServiceView';
import { StremioCatalogRow } from './StremioCatalogRow';
import { CatalogDetailView } from './CatalogDetailView';
import { CloudCatalogDetailView } from './CloudCatalogDetailView';
import { StremioRecentlyWatched } from './StremioRecentlyWatched';
import { StremioHeroBanner } from './StremioHeroBanner';
import { useStremioHover } from '../../contexts/StremioHoverContext';
import './StremioHome.css';

interface StremioHomeProps {
  addons: InstalledAddon[];
  onItemClick: (meta: StremioMeta) => void;
}

type StremioSearchResult = StremioMetaPreview & {
  sourceAddonId: string;
};

type StremioSearchRow = {
  id: string;
  title: string;
  items: StremioSearchResult[];
};

const HIDDEN_CATALOG_IDS = new Set(['last-videos', 'calendar-videos']);

function addonHasResource(addon: InstalledAddon, resource: string): boolean {
  return addon.manifest.resources.some((r) => {
    if (typeof r === 'string') return r === resource;
    return r.name === resource;
  });
}

export function StremioHome({ addons, onItemClick }: StremioHomeProps) {
  const searchQuery = useStremioSearchQuery();
  const view = useStremioView();
  const setView = useSetStremioView();
  const selectedAddonId = useStremioSelectedAddonId();
  const setSelectedAddonId = useSetStremioSelectedAddonId();
  const selectedCatalogId = useStremioSelectedCatalogId();
  const setSelectedCatalogId = useSetStremioSelectedCatalogId();
  const selectedCatalogType = useStremioSelectedCatalogType();
  const setSelectedCatalogType = useSetStremioSelectedCatalogType();
  const [searchRows, setSearchRows] = useState<StremioSearchRow[]>([]);
  const [expandedSearchRowId, setExpandedSearchRowId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState('');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const tmdbApiKey = useTmdbApiKey();
  const [streamingCatalogsEnabled, setStreamingCatalogsEnabled] = useState(true);
  const [enabledStreamingServices, setEnabledStreamingServices] = useState<string[]>(['netflix', 'disney', 'hulu', 'prime', 'apple', 'max', 'paramount', 'peacock']);

  useEffect(() => {
    async function loadSettings() {
      if (!window.storage) return;
      const res = await window.storage.getSettings();
      const s = res.data || {};
      if (s.streamingCatalogsEnabled !== undefined) {
        setStreamingCatalogsEnabled(s.streamingCatalogsEnabled);
      }
      if (s.enabledStreamingServices !== undefined) {
        setEnabledStreamingServices(s.enabledStreamingServices);
      }
    }

    loadSettings();

    const handleSettingsChange = () => {
      loadSettings();
    };

    window.addEventListener('ynotv:streaming-catalogs-changed', handleSettingsChange);
    return () => {
      window.removeEventListener('ynotv:streaming-catalogs-changed', handleSettingsChange);
    };
  }, []);

  const serviceScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollServiceLeft, setCanScrollServiceLeft] = useState(false);
  const [canScrollServiceRight, setCanScrollServiceRight] = useState(false);

  const updateServiceScrollButtons = useCallback(() => {
    const el = serviceScrollRef.current;
    if (!el) return;
    setCanScrollServiceLeft(el.scrollLeft > 2);
    setCanScrollServiceRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    if (!tmdbApiKey) return;
    updateServiceScrollButtons();
    window.addEventListener('resize', updateServiceScrollButtons);
    
    // Add small delay to let children render and compute scroll width
    const timer = setTimeout(updateServiceScrollButtons, 150);

    return () => {
      window.removeEventListener('resize', updateServiceScrollButtons);
      clearTimeout(timer);
    };
  }, [tmdbApiKey, updateServiceScrollButtons]);

  const scrollService = (dir: 'left' | 'right') => {
    const el = serviceScrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollTo({ left: el.scrollLeft + (dir === 'left' ? -amount : amount), behavior: 'smooth' });
  };

  const refreshToken = useTraktCatalogRefreshToken();
  const setSelectedSeason = useSetStremioSelectedSeason();
  const setPreselectVideoId = useSetStremioPreselectVideoId();
  const selectedCloudCatalogKey = useStremioSelectedCloudCatalogKey();
  const setSelectedCloudCatalogKey = useSetStremioSelectedCloudCatalogKey();

  interface CloudCatalogRow {
    key: string;
    title: string;
    items: StremioMetaPreview[];
    page: number;
    hasMore: boolean;
  }
  const [cloudCatalogRows, setCloudCatalogRows] = useState<CloudCatalogRow[]>([]);
  const [traktCatalogsBeforeAddon, setTraktCatalogsBeforeAddon] = useState(false);
  const [simklWatchlist, setSimklWatchlist] = useState<StremioMetaPreview[]>([]);

  // Fetch cloud catalogs on mount or when view changes back to home/search
  useEffect(() => {
    let active = true;
    const loadScrobblerCatalogs = async () => {
      if (!window.storage) return;
      try {
        const res = await window.storage.getSettings();
        const s = res.data || {};
        
        if (!active) return;
        
        // Load Trakt catalogs dynamically based on enabled settings
        const rows: CloudCatalogRow[] = [];
        if (s.traktEnabled && s.traktAccessToken) {
          const enabledCatalogs: Record<string, boolean> = s.traktCatalogsEnabled || {};
          const enabledDefs = TRAKT_CATALOG_DEFINITIONS.filter(
            (def) => enabledCatalogs[def.type] === true
          );

          const results = await Promise.all(
            enabledDefs.map((def) =>
              scrobbler.fetchTraktCatalog(def.type, 1).then(({ items, hasMore }) => ({
                key: `trakt-${def.type}`,
                title: `Trakt ${def.label}`,
                items,
                page: 1,
                hasMore,
              }))
            )
          );
          rows.push(...results.filter((r) => r.items.length > 0));

          // Load Trakt custom lists
          const enabledLists: { id: string; name: string }[] = s.traktEnabledLists || [];
          const listResults = await Promise.all(
            enabledLists.map((list) =>
              scrobbler.fetchTraktListCatalog(list.id, 1).then(({ items, hasMore }) => ({
                key: `trakt-list-${list.id}`,
                title: `Trakt \u2014 ${list.name}`,
                items,
                page: 1,
                hasMore,
              }))
            )
          );
          rows.push(...listResults.filter((r) => r.items.length > 0));

          // Apply catalog order from settings
          const order = s.traktCatalogOrder || [];
          if (order.length > 0) {
            rows.sort((a, b) => {
              const keyA = a.key.replace('trakt-', '');
              const keyB = b.key.replace('trakt-', '');
              const iA = order.indexOf(keyA);
              const iB = order.indexOf(keyB);
              return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB);
            });
          }
        }
        if (active) {
          setCloudCatalogRows(rows);
          setTraktCatalogsBeforeAddon(s.traktCatalogsBeforeAddon ?? false);
        }

        if (s.simklEnabled && s.simklAccessToken) {
          scrobbler.fetchSimklCatalog('watchlist').then((items) => {
            if (active) setSimklWatchlist(items);
          });
        } else {
          setSimklWatchlist([]);
        }
      } catch (e) {
        console.error('Failed to load scrobbler catalogs in StremioHome:', e);
      }
    };

    loadScrobblerCatalogs();
    return () => {
      active = false;
    };
  }, [view, refreshToken]);

  const handleTraktPageChange = useCallback(async (row: CloudCatalogRow, newPage: number) => {
    if (newPage < 1) return;
    try {
      const isList = row.key.startsWith('trakt-list-');
      let result: { items: StremioMetaPreview[]; hasMore: boolean };
      if (isList) {
        const listId = row.key.slice('trakt-list-'.length);
        result = await scrobbler.fetchTraktListCatalog(listId, newPage);
      } else {
        const type = row.key.replace('trakt-', '') as TraktCatalogType;
        result = await scrobbler.fetchTraktCatalog(type, newPage);
      }
      setCloudCatalogRows((prev) =>
        prev.map((r) =>
          r.key === row.key
            ? { ...r, items: result.items, page: newPage, hasMore: result.hasMore }
            : r
        )
      );
    } catch (e) {
      console.error(`Failed to load Trakt page ${newPage} for ${row.key}:`, e);
    }
  }, []);

  const { onCardMouseEnter, onCardMouseLeave, onCardClick } = useStremioHover();

  const renderedRows = useMemo(() => {
    return addons.flatMap((addon) =>
      (addon.manifest.catalogs || [])
        .filter((cat) => !HIDDEN_CATALOG_IDS.has(cat.id))
        .map((cat) => ({
          addon,
          catalog: cat,
        }))
    );
  }, [addons]);

  const filteredRows = useMemo(() => {
    if (!catalogFilter.trim()) return renderedRows;
    const lower = catalogFilter.toLowerCase().trim();
    return renderedRows.filter(({ addon, catalog }) => {
      const name = catalog.name || addon.manifest.name || '';
      return name.toLowerCase().includes(lower);
    });
  }, [renderedRows, catalogFilter]);

  const doSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchRows([]);
      setExpandedSearchRowId(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const rows: StremioSearchRow[] = [];

    for (const addon of addons) {
      if (!addonHasResource(addon, 'catalog') || !addonHasResource(addon, 'meta')) continue;
      for (const cat of addon.manifest.catalogs || []) {
        if (cat.extra?.some(e => e.name === 'search') || cat.extraSupported?.includes('search')) {
          try {
            const resp = await fetchCatalog(addon.baseUrl, cat.type, cat.id, { search: query });
            if (resp?.metas) {
              const rowItems: StremioSearchResult[] = [];
              const seenInRow = new Set<string>();
              for (const m of resp.metas) {
                const key = `${m.type}:${m.id}`;
                if (!seenInRow.has(key)) {
                  seenInRow.add(key);
                  rowItems.push({ ...m, sourceAddonId: addon.id });
                }
              }
              if (rowItems.length > 0) {
                rows.push({
                  id: `${addon.id}:${cat.type}:${cat.id}`,
                  title: `${cat.name || addon.manifest.name} \u2014 ${cat.type.charAt(0).toUpperCase() + cat.type.slice(1)}`,
                  items: rowItems,
                });
              }
            }
          } catch {
            // Skip
          }
        }
      }
    }
    setSearchRows(rows);
    setExpandedSearchRowId((prev) => {
      if (!prev) return null;
      return rows.some((r) => r.id === prev) ? prev : null;
    });
    setSearching(false);
  }, [addons]);

  useEffect(() => {
    if (view === 'search' && searchQuery.length >= 2) {
      doSearch(searchQuery);
    }
  }, [searchQuery, view, doSearch]);

  const handleItemClickWrapper = useCallback(async (preview: StremioMetaPreview | StremioSearchResult) => {
    const p = preview as any;
    // Deep-link to specific season/episode for Trakt history items
    if (p.traktSeason != null && p.traktEpisode != null) {
      setSelectedSeason(p.traktSeason);
      setPreselectVideoId(`${p.id}:${p.traktSeason}:${p.traktEpisode}`);
    }

    if (preview.id.startsWith('tmdb:')) {
      const newMeta: StremioMeta = {
        id: preview.id,
        type: preview.type,
        name: preview.name,
        poster: preview.poster ?? undefined,
        imdbRating: preview.imdbRating,
      };
      onItemClick(newMeta);
      return;
    }

    // Query across all addons to fetch full metadata
    const meta = await fetchMeta(addons, preview.type, preview.id);
    if (meta) {
      onItemClick(meta);
    }
  }, [addons, onItemClick, setSelectedSeason, setPreselectVideoId]);

  const selectedCatalogItems = useMemo(() => {
    if (selectedAddonId && selectedCatalogId && selectedCatalogType) {
      const addon = addons.find(a => a.id === selectedAddonId);
      if (addon) {
        const cat = addon.manifest.catalogs?.find(
          c => c.id === selectedCatalogId && c.type === selectedCatalogType
        );
        if (cat) return { addon, catalog: cat };
      }
    }
    return null;
  }, [addons, selectedAddonId, selectedCatalogId, selectedCatalogType]);

  if (view === 'search') {
    return (
      <div className="stremio-home">
        <div className="stremio-search-results">
          {searching ? (
            <div className="stremio-loading-text">Searching...</div>
          ) : searchRows.length > 0 ? (
            <div className="stremio-catalog-rows">
              {searchRows.map((row) => (
                <div key={row.id}>
                  <StremioCatalogRow
                    title={row.title}
                    items={row.items.slice(0, 20)}
                    onItemClick={handleItemClickWrapper}
                    onSeeAll={() => setExpandedSearchRowId((prev) => (prev === row.id ? null : row.id))}
                    seeAllLabel={expandedSearchRowId === row.id ? 'Collapse' : `See all (${row.items.length})`}
                  />
                  {expandedSearchRowId === row.id && (
                    <div className="stremio-search-expanded">
                      <div className="stremio-search-expanded-grid">
                        {row.items.map((item) => (
                          <div
                            key={`${row.id}:${item.type}:${item.id}`}
                            className="stremio-meta-card"
                            onMouseEnter={(e) => onCardMouseEnter(item, e.currentTarget, e)}
                            onMouseLeave={onCardMouseLeave}
                            onClick={() => {
                              onCardClick();
                              handleItemClickWrapper(item);
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
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : searchQuery.length >= 2 ? (
            <div className="stremio-loading-text">No results found.</div>
          ) : (
            <div className="stremio-loading-text">Type at least 2 characters to search.</div>
          )}
        </div>
      </div>
    );
  }

  if (selectedService) {
    return (
      <div className="stremio-home">
        <StreamingServiceView
          service={selectedService}
          onBack={() => setSelectedService(null)}
          onItemClick={handleItemClickWrapper}
          addons={addons}
        />
      </div>
    );
  }

  if (selectedCatalogItems) {
    const { addon: selAddon, catalog: selCat } = selectedCatalogItems;
    return (
      <div className="stremio-home">
        <CatalogDetailView
          key={`${selAddon.id}:${selCat.id}`}
          addon={selAddon}
          catalog={selCat}
          onItemClick={handleItemClickWrapper}
        />
      </div>
    );
  }

  if (selectedCloudCatalogKey) {
    return (
      <div className="stremio-home">
        <CloudCatalogDetailView
          key={selectedCloudCatalogKey}
          cloudCatalogKey={selectedCloudCatalogKey}
          onItemClick={handleItemClickWrapper}
          onBack={() => setSelectedCloudCatalogKey(null)}
        />
      </div>
    );
  }

  return (
    <div className="stremio-home">
      <div className="stremio-catalog-filter">
        <svg className="stremio-catalog-filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          className="stremio-catalog-filter-input"
          type="text"
          placeholder="Filter catalogs..."
          value={catalogFilter}
          onChange={(e) => setCatalogFilter(e.target.value)}
        />
        {catalogFilter && (
          <button className="stremio-catalog-filter-clear" onClick={() => setCatalogFilter('')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <StremioHeroBanner
        addons={addons}
        onItemClick={handleItemClickWrapper}
      />
      <div className="stremio-catalog-rows">
        <StremioRecentlyWatched
          addons={addons}
          onItemClick={onItemClick}
        />

        {tmdbApiKey && streamingCatalogsEnabled && (
          <div className="stremio-row stremio-rw-row" style={{ position: 'relative' }}>
            <div className="stremio-row-header">
              <h3 className="stremio-row-title stremio-rw-title">
                Streaming Platforms
              </h3>
              <div className="stremio-row-nav">
                <button
                  className="stremio-row-nav-btn"
                  onClick={() => scrollService('left')}
                  disabled={!canScrollServiceLeft}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button
                  className="stremio-row-nav-btn"
                  onClick={() => scrollService('right')}
                  disabled={!canScrollServiceRight}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>
            <div
              className="stremio-service-rail-scroll"
              ref={serviceScrollRef}
              onScroll={updateServiceScrollButtons}
            >
              <div className="stremio-service-rail-track">
                {Object.keys(SERVICES)
                  .filter((svcKey) => enabledStreamingServices.includes(svcKey))
                  .map((svcKey) => {
                    const svc = SERVICES[svcKey as StreamingService];
                    return (
                      <button
                        key={svcKey}
                        className="stremio-service-tile-btn"
                        onClick={() => setSelectedService(svcKey)}
                      >
                        <img
                          src={svc.logo}
                          alt={svc.name}
                          style={{
                            height: '24px',
                            width: 'auto',
                            filter: svc.logoFilter || 'none',
                          }}
                        />
                      </button>
                    );
                  })}
              </div>
            </div>
            {canScrollServiceLeft && <div className="stremio-row-fade stremio-row-fade-left" style={{ zIndex: 3 }} />}
            {canScrollServiceRight && <div className="stremio-row-fade stremio-row-fade-right" style={{ zIndex: 3 }} />}
          </div>
        )}

        {traktCatalogsBeforeAddon && cloudCatalogRows.map((row) => (
          <StremioCatalogRow
            key={row.key}
            title={row.title}
            items={row.items}
            onItemClick={handleItemClickWrapper}
            onSeeAll={() => {
              setSelectedAddonId(null);
              setSelectedCatalogId(null);
              setSelectedCatalogType(null);
              setSelectedCloudCatalogKey(row.key);
            }}
          />
        ))}

        {filteredRows.length === 0 ? (
          <div className="stremio-loading-text">
            {catalogFilter.trim() ? 'No catalogs match your filter.' : 'No catalogs available. Install an addon to get started.'}
          </div>
        ) : (
          filteredRows.map(({ addon, catalog }) => (
            <StremioCatalogRow
              key={`${addon.id}:${catalog.type}:${catalog.id}`}
              title={`${catalog.name || addon.manifest.name} \u2014 ${catalog.type.charAt(0).toUpperCase() + catalog.type.slice(1)}`}
              addon={addon}
              catalog={catalog}
              onItemClick={handleItemClickWrapper}
              onSeeAll={() => {
                setSelectedAddonId(addon.id);
                setSelectedCatalogId(catalog.id);
                setSelectedCatalogType(catalog.type);
                setView('home');
              }}
            />
          ))
        )}

        {!traktCatalogsBeforeAddon && cloudCatalogRows.map((row) => (
          <StremioCatalogRow
            key={row.key}
            title={row.title}
            items={row.items}
            onItemClick={handleItemClickWrapper}
            onSeeAll={() => {
              setSelectedAddonId(null);
              setSelectedCatalogId(null);
              setSelectedCatalogType(null);
              setSelectedCloudCatalogKey(row.key);
            }}
          />
        ))}

        {simklWatchlist.length > 0 && (
          <StremioCatalogRow
            key="simkl-watchlist"
            title="Simkl Watchlist"
            items={simklWatchlist}
            onItemClick={handleItemClickWrapper}
          />
        )}
      </div>
    </div>
  );
}

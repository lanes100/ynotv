import { useState, useEffect, useCallback, useMemo } from 'react';
import type { InstalledAddon, StremioMetaPreview, StremioMeta } from '../../types/stremio';
import { fetchCatalog, fetchMeta } from '../../services/stremio-addon';
import { scrobbler } from '../../services/scrobbler';
import {
  useStremioSearchQuery,
  useStremioView,
  useSetStremioView,
  useStremioSelectedAddonId,
  useSetStremioSelectedAddonId,
  useStremioSelectedCatalogId,
  useSetStremioSelectedCatalogId,
} from '../../stores/uiStore';
import { StremioCatalogRow } from './StremioCatalogRow';
import { CatalogDetailView } from './CatalogDetailView';
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
  const [searchRows, setSearchRows] = useState<StremioSearchRow[]>([]);
  const [expandedSearchRowId, setExpandedSearchRowId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState('');

  // Trakt and Simkl Catalog States
  const [traktWatchlist, setTraktWatchlist] = useState<StremioMetaPreview[]>([]);
  // const [traktRecommendations, setTraktRecommendations] = useState<StremioMetaPreview[]>([]);
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
        
        if (s.traktEnabled && s.traktAccessToken && s.traktWatchlistEnabled !== false) {
          scrobbler.fetchTraktCatalog('watchlist').then((items) => {
            if (active) setTraktWatchlist(items);
          });
          // scrobbler.fetchTraktCatalog('recommendations').then((items) => {
          //   if (active) setTraktRecommendations(items);
          // });
        } else {
          setTraktWatchlist([]);
          // setTraktRecommendations([]);
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
  }, [view]);

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
    const sourceAddonId = (preview as StremioSearchResult).sourceAddonId;
    const addon = sourceAddonId
      ? addons.find(a => a.id === sourceAddonId)
      : addons.find(a => a.manifest.catalogs?.some(c => c.type === preview.type));
    
    // Fallback: If no specific addon matches, query across all addons to fetch full metadata
    const meta = await fetchMeta(addon ? [addon] : addons, preview.type, preview.id);
    if (meta) {
      onItemClick(meta);
    }
  }, [addons, onItemClick]);

  const selectedCatalogItems = useMemo(() => {
    if (selectedAddonId && selectedCatalogId) {
      const addon = addons.find(a => a.id === selectedAddonId);
      if (addon) {
        const cat = addon.manifest.catalogs?.find(c => c.id === selectedCatalogId);
        if (cat) return { addon, catalog: cat };
      }
    }
    return null;
  }, [addons, selectedAddonId, selectedCatalogId]);

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

        {traktWatchlist.length > 0 && (
          <StremioCatalogRow
            key="trakt-watchlist"
            title="Trakt Watchlist"
            items={traktWatchlist}
            onItemClick={handleItemClickWrapper}
          />
        )}

        {simklWatchlist.length > 0 && (
          <StremioCatalogRow
            key="simkl-watchlist"
            title="Simkl Watchlist"
            items={simklWatchlist}
            onItemClick={handleItemClickWrapper}
          />
        )}

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
                setView('home');
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

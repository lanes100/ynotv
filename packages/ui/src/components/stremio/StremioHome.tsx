import { useState, useEffect, useCallback, useMemo } from 'react';
import type { InstalledAddon, StremioMetaPreview, StremioMeta } from '../../types/stremio';
import { fetchCatalog, fetchMeta } from '../../services/stremio-addon';
import {
  useStremioSearchQuery,
  useSetStremioSearchQuery,
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

function addonHasResource(addon: InstalledAddon, resource: string): boolean {
  return addon.manifest.resources.some((r) => {
    if (typeof r === 'string') return r === resource;
    return r.name === resource;
  });
}

export function StremioHome({ addons, onItemClick }: StremioHomeProps) {
  const searchQuery = useStremioSearchQuery();
  const setSearchQuery = useSetStremioSearchQuery();
  const view = useStremioView();
  const setView = useSetStremioView();
  const selectedAddonId = useStremioSelectedAddonId();
  const setSelectedAddonId = useSetStremioSelectedAddonId();
  const selectedCatalogId = useStremioSelectedCatalogId();
  const setSelectedCatalogId = useSetStremioSelectedCatalogId();
  const [searchRows, setSearchRows] = useState<StremioSearchRow[]>([]);
  const [expandedSearchRowId, setExpandedSearchRowId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const renderedRows = useMemo(() => {
    return addons.flatMap((addon) =>
      (addon.manifest.catalogs || []).map((cat) => ({
        addon,
        catalog: cat,
      }))
    );
  }, [addons]);

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
      // Match Stremio-like metadata search: query metadata providers, not stream-only addons.
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
                  title: cat.name || `${addon.manifest.name} - ${cat.type}`,
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

  const debouncedSearch = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>;
    return (q: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => doSearch(q), 300);
    };
  }, [doSearch]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.length >= 2) {
      setView('search');
      debouncedSearch(value);
    } else {
      setSearchRows([]);
      setExpandedSearchRowId(null);
      setSearching(false);
      if (value.length === 0) setView('home');
    }
  };

  const handleItemClickWrapper = useCallback(async (preview: StremioMetaPreview | StremioSearchResult) => {
    const sourceAddonId = (preview as StremioSearchResult).sourceAddonId;
    const addon = sourceAddonId
      ? addons.find(a => a.id === sourceAddonId)
      : addons.find(a => a.manifest.catalogs?.some(c => c.type === preview.type));
    if (addon) {
      const meta = await fetchMeta([addon], preview.type, preview.id);
      if (meta) onItemClick(meta);
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
        <div className="stremio-search-bar">
          <svg className="stremio-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="stremio-search-input"
            type="text"
            placeholder="Search across all addons..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button className="stremio-search-clear" onClick={() => handleSearchChange('')}>
              ✕
            </button>
          )}
        </div>

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
                          <div key={`${row.id}:${item.type}:${item.id}`} className="stremio-meta-card" onClick={() => handleItemClickWrapper(item)}>
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
      <div className="stremio-search-bar">
        <svg className="stremio-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          className="stremio-search-input"
          type="text"
          placeholder="Search movies, series..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button className="stremio-search-clear" onClick={() => handleSearchChange('')}>✕</button>
        )}
      </div>

      <div className="stremio-catalog-rows">
        {/* Continue Watching — always shown if there's history */}
        <StremioRecentlyWatched
          addons={addons}
          onItemClick={onItemClick}
        />

        {renderedRows.length === 0 ? (
          <div className="stremio-loading-text">No catalogs available. Install an addon to get started.</div>
        ) : (
          renderedRows.map(({ addon, catalog }) => (
            <StremioCatalogRow
              key={`${addon.id}:${catalog.type}:${catalog.id}`}
              title={catalog.name || `${addon.manifest.name} - ${catalog.type}`}
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

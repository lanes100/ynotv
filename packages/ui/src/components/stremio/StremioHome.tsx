import { useState, useEffect, useCallback, useMemo } from 'react';
import type { InstalledAddon, StremioMetaPreview, StremioMeta } from '../../types/stremio';
import { fetchCatalog, fetchMeta } from '../../services/stremio-addon';
import { useStremioSearchQuery, useSetStremioSearchQuery, useStremioView, useSetStremioView, useStremioSelectedAddonId, useStremioSelectedCatalogId } from '../../stores/uiStore';
import { StremioCatalogRow } from './StremioCatalogRow';
import { CatalogDetailView } from './CatalogDetailView';
import './StremioHome.css';

interface StremioHomeProps {
  addons: InstalledAddon[];
  onItemClick: (meta: StremioMeta) => void;
}

export function StremioHome({ addons, onItemClick }: StremioHomeProps) {
  const searchQuery = useStremioSearchQuery();
  const setSearchQuery = useSetStremioSearchQuery();
  const view = useStremioView();
  const setView = useSetStremioView();
  const selectedAddonId = useStremioSelectedAddonId();
  const selectedCatalogId = useStremioSelectedCatalogId();
  const [catalogs, setCatalogs] = useState<{ title: string; items: StremioMetaPreview[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<StremioMetaPreview[]>([]);
  const [searching, setSearching] = useState(false);

  const loadCatalogs = useCallback(async () => {
    setLoading(true);
    const rows: { title: string; items: StremioMetaPreview[] }[] = [];

    for (const addon of addons) {
      for (const cat of addon.manifest.catalogs || []) {
        try {
          const resp = await fetchCatalog(addon.baseUrl, cat.type, cat.id, { limit: '20' });
          if (resp?.metas?.length) {
            rows.push({
              title: cat.name || `${addon.manifest.name} - ${cat.type}`,
              items: resp.metas.slice(0, 20),
            });
          }
        } catch {
          // Skip
        }
      }
    }
    setCatalogs(rows);
    setLoading(false);
  }, [addons]);

  useEffect(() => {
    if (addons.length > 0) {
      loadCatalogs();
    }
  }, [addons, loadCatalogs]);

  const doSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const results: StremioMetaPreview[] = [];
    const seen = new Set<string>();

    for (const addon of addons) {
      for (const cat of addon.manifest.catalogs || []) {
        if (cat.extra?.some(e => e.name === 'search') || cat.extraSupported?.includes('search')) {
          try {
            const resp = await fetchCatalog(addon.baseUrl, cat.type, cat.id, { search: query });
            if (resp?.metas) {
              for (const m of resp.metas) {
                if (!seen.has(m.id)) {
                  seen.add(m.id);
                  results.push(m);
                }
              }
            }
          } catch {
            // Skip
          }
        }
      }
    }
    setSearchResults(results);
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
      setSearchResults([]);
      setSearching(false);
      if (value.length === 0) setView('home');
    }
  };

  const handleItemClickWrapper = useCallback(async (preview: StremioMetaPreview) => {
    const addon = addons.find(a =>
      a.manifest.catalogs?.some(c => c.type === preview.type)
    );
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
          ) : searchResults.length > 0 ? (
            <div className="stremio-meta-grid">
              {searchResults.map((item) => (
                <div key={item.id} className="stremio-meta-card" onClick={() => handleItemClickWrapper(item)}>
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
        {loading ? (
          <div className="stremio-loading-text">Loading catalogs...</div>
        ) : catalogs.length === 0 ? (
          <div className="stremio-loading-text">No catalogs available. Install an addon to get started.</div>
        ) : (
          catalogs.map((row, i) => (
            <StremioCatalogRow key={i} title={row.title} items={row.items} onItemClick={handleItemClickWrapper} />
          ))
        )}
      </div>
    </div>
  );
}

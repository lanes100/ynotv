import { useState, useEffect, useCallback } from 'react';
import type { StremioMetaPreview } from '../../types/stremio';
import { scrobbler, TRAKT_CATALOG_DEFINITIONS, type TraktCatalogType } from '../../services/scrobbler';
import { useStremioHover } from '../../contexts/StremioHoverContext';
import './StremioHome.css';

interface CloudCatalogEntry {
  key: string;
  title: string;
}

interface CloudCatalogDetailViewProps {
  cloudCatalogKey: string;
  onItemClick: (item: StremioMetaPreview) => void;
  onBack: () => void;
}

function parseCloudKey(key: string): { type: 'trakt' | 'trakt-list' | 'simkl'; id: string } {
  if (key.startsWith('trakt-list-')) {
    return { type: 'trakt-list', id: key.slice('trakt-list-'.length) };
  }
  if (key.startsWith('trakt-')) {
    return { type: 'trakt', id: key.slice('trakt-'.length) };
  }
  if (key.startsWith('simkl-')) {
    return { type: 'simkl', id: key.slice('simkl-'.length) };
  }
  return { type: 'trakt', id: key };
}

async function fetchCloudCatalogPage(key: string, page: number): Promise<{ items: StremioMetaPreview[]; hasMore: boolean }> {
  const parsed = parseCloudKey(key);
  if (parsed.type === 'trakt-list') {
    return scrobbler.fetchTraktListCatalog(parsed.id, page);
  }
  if (parsed.type === 'trakt') {
    return scrobbler.fetchTraktCatalog(parsed.id as TraktCatalogType, page);
  }
  if (parsed.type === 'simkl') {
    const items = await scrobbler.fetchSimklCatalog(parsed.id as 'watchlist' | 'history');
    return { items, hasMore: false };
  }
  return { items: [], hasMore: false };
}

export function CloudCatalogDetailView({ cloudCatalogKey, onItemClick, onBack }: CloudCatalogDetailViewProps) {
  const [items, setItems] = useState<StremioMetaPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [availableCatalogs, setAvailableCatalogs] = useState<CloudCatalogEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState(cloudCatalogKey);
  const { onCardMouseEnter, onCardMouseLeave, onCardClick } = useStremioHover();

  // Load available cloud catalogs from settings
  useEffect(() => {
    let active = true;
    const loadCatalogs = async () => {
      if (!window.storage) return;
      try {
        const res = await window.storage.getSettings();
        const s = res.data || {};
        const entries: CloudCatalogEntry[] = [];

        if (s.traktEnabled && s.traktAccessToken) {
          const enabledCatalogs: Record<string, boolean> = s.traktCatalogsEnabled || {};
          for (const def of TRAKT_CATALOG_DEFINITIONS) {
            if (enabledCatalogs[def.type] === true) {
              entries.push({ key: `trakt-${def.type}`, title: `Trakt ${def.label}` });
            }
          }

          const enabledLists: { id: string; name: string }[] = s.traktEnabledLists || [];
          for (const list of enabledLists) {
            entries.push({ key: `trakt-list-${list.id}`, title: `Trakt \u2014 ${list.name}` });
          }
        }

        if (s.simklEnabled && s.simklAccessToken) {
          entries.push({ key: 'simkl-watchlist', title: 'Simkl Watchlist' });
        }

        if (active) {
          setAvailableCatalogs(entries);
        }
      } catch {
        // Ignore
      }
    };
    loadCatalogs();
    return () => { active = false; };
  }, []);

  // Fetch items whenever selectedKey or page changes
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { items: fetched, hasMore: more } = await fetchCloudCatalogPage(selectedKey, page);
      if (active) {
        setItems(fetched);
        setHasMore(more);
        setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [selectedKey, page]);

  const handleCatalogChange = useCallback((newKey: string) => {
    setSelectedKey(newKey);
    setPage(1);
  }, []);

  const handlePrevPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    if (hasMore) setPage((p) => p + 1);
  }, [hasMore]);

  const currentEntry = availableCatalogs.find((c) => c.key === selectedKey);
  const title = currentEntry?.title || 'Cloud Catalog';

  return (
    <div className="stremio-catalog-detail-view">
      <div style={{ padding: '24px' }}>
        <div className="stremio-discover-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              className="stremio-row-see-all-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}
              onClick={onBack}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h3 className="stremio-row-title" style={{ fontSize: '1.2rem' }}>Discover</h3>
          </div>

          <div className="stremio-discover-filters">
            <select
              className="stremio-discover-select"
              value={selectedKey}
              onChange={(e) => handleCatalogChange(e.target.value)}
            >
              {availableCatalogs.map((entry) => (
                <option key={entry.key} value={entry.key}>{entry.title}</option>
              ))}
            </select>

            <div className="stremio-row-nav" style={{ marginLeft: '8px' }}>
              <button
                className="stremio-row-nav-btn"
                onClick={handlePrevPage}
                disabled={page <= 1}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', margin: '0 8px', display: 'flex', alignItems: 'center' }}>
                {page}
              </span>
              <button
                className="stremio-row-nav-btn"
                onClick={handleNextPage}
                disabled={!hasMore}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="stremio-loading-text" style={{ padding: '80px 0' }}>Loading catalog...</div>
        ) : items.length === 0 ? (
          <div className="stremio-loading-text" style={{ padding: '80px 0' }}>No items in this catalog.</div>
        ) : (
          <>
            <div className="stremio-meta-grid">
              {items.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
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
            <div className="stremio-loading-text" style={{ padding: '20px 0', textAlign: 'center' }}>
              Page {page}{hasMore ? ' \u2014 use arrows to navigate' : ''}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

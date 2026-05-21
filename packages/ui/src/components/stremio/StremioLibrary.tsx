import { useState, useMemo, useCallback, useEffect } from 'react';
import { useStremioLibraryStore, type LibraryItem } from '../../stores/stremioLibraryStore';
import { useStremioWatchStore } from '../../stores/stremioWatchStore';
import type { StremioMeta } from '../../types/stremio';
import { useStremioAddonStore } from '../../stores/stremioAddonStore';
import { fetchMeta } from '../../services/stremio-addon';
import { useStremioHover } from '../../contexts/StremioHoverContext';
import type { StremioMetaPreview } from '../../types/stremio';
import './StremioLibrary.css';

interface StremioLibraryProps {
  onItemClick: (meta: StremioMeta) => void;
}

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export function StremioLibrary({ onItemClick }: StremioLibraryProps) {
  const library = useStremioLibraryStore((s) => s.library);
  const updateLibraryItem = useStremioLibraryStore((s) => s.updateLibraryItem);
  const addons = useStremioAddonStore((s) => s.enabledAddons);
  const episodeProgress = useStremioWatchStore((s) => s.episodeProgress);

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [sortBy, setSortBy] = useState<'added' | 'name' | 'rating' | 'year'>('added');
  const [refreshing, setRefreshing] = useState(false);

  // Refresh stale library items in the background
  useEffect(() => {
    const stale = library.filter(
      (item) => item.type === 'series' && (!item.lastChecked || Date.now() - item.lastChecked > REFRESH_INTERVAL_MS)
    );
    if (stale.length === 0) return;

    let cancelled = false;
    const refresh = async () => {
      setRefreshing(true);
      for (const item of stale) {
        if (cancelled) break;
        const addon = addons.find((a) => a.manifest.catalogs?.some((c) => c.type === item.type));
        if (!addon) continue;
        try {
          const meta = await fetchMeta([addon], item.type, item.id);
          if (meta && meta.videos && !cancelled) {
            updateLibraryItem(item.id, {
              videos: meta.videos,
              videoCount: meta.videos.length,
              lastChecked: Date.now(),
            });
          }
        } catch {
          // Skip refresh failures
        }
      }
      if (!cancelled) setRefreshing(false);
    };
    refresh();
    return () => { cancelled = true; };
  }, [library, addons, updateLibraryItem]);

  const getNewCount = useCallback((item: LibraryItem): number => {
    if (item.type !== 'series' || !item.videos) return 0;
    return item.videos.filter((v) => {
      if (v.season === undefined || v.episode === undefined) return false;
      return !episodeProgress[v.id]?.finished;
    }).length;
  }, [episodeProgress]);

  const filteredItems = useMemo(() => {
    let items = [...library];

    if (selectedType !== 'All') {
      const typeLower = selectedType.toLowerCase();
      if (typeLower === 'movies') {
        items = items.filter((x) => x.type === 'movie');
      } else if (typeLower === 'series') {
        items = items.filter((x) => x.type === 'series');
      } else {
        items = items.filter((x) => x.type !== 'movie' && x.type !== 'series');
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((x) => x.name.toLowerCase().includes(q));
    }

    items.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'rating') {
        const rA = parseFloat(a.imdbRating || '0');
        const rB = parseFloat(b.imdbRating || '0');
        return rB - rA;
      }
      if (sortBy === 'year') {
        return (b.year || 0) - (a.year || 0);
      }
      return 0;
    });

    return items;
  }, [library, search, selectedType, sortBy]);

  const handleCardClick = async (item: LibraryItem) => {
    const addon = addons.find((a) => a.manifest.catalogs?.some((c) => c.type === item.type));
    if (addon) {
      const meta = await fetchMeta([addon], item.type, item.id);
      if (meta) onItemClick(meta);
    }
  };

  const { onCardMouseEnter, onCardMouseLeave, onCardClick } = useStremioHover();

  return (
    <div className="stremio-library">
      <div className="stremio-library-header">
        <h2 className="stremio-library-title">
          Library
          {refreshing && <span className="stremio-library-refreshing"> Refreshing...</span>}
        </h2>
        <div className="stremio-library-controls">
          <input
            className="stremio-library-search"
            type="text"
            placeholder="Search library..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="stremio-library-select"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="All">All Types</option>
            <option value="Movies">Movies</option>
            <option value="Series">Series</option>
            <option value="Other">Other</option>
          </select>
          <select
            className="stremio-library-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="added">Recently Added</option>
            <option value="name">A-Z</option>
            <option value="rating">IMDb Rating</option>
            <option value="year">Release Year</option>
          </select>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="stremio-library-empty">
          {library.length === 0
            ? 'Your library is empty. Go discover and add items to your library!'
            : 'No library items match your search and filter criteria.'}
        </div>
      ) : (
        <div className="stremio-library-grid">
          {filteredItems.map((item) => {
            const newCount = item.type === 'series' ? getNewCount(item) : 0;
            return (
              <div
                key={item.id}
                className="stremio-meta-card"
                onMouseEnter={(e) => onCardMouseEnter(item as StremioMetaPreview, e.currentTarget, e)}
                onMouseLeave={onCardMouseLeave}
                onClick={() => {
                  onCardClick();
                  handleCardClick(item);
                }}
              >
                {item.poster && (
                  <div className="stremio-library-poster-wrap">
                    <img
                      className="stremio-meta-poster"
                      src={item.poster}
                      alt={item.name}
                      loading="lazy"
                    />
                    {newCount > 0 && (
                      <div className="stremio-library-new-badge">
                        {newCount}
                      </div>
                    )}
                  </div>
                )}
                <div className="stremio-meta-card-info">
                  <div className="stremio-meta-card-title">{item.name}</div>
                  {item.imdbRating && <div className="stremio-meta-card-rating">★ {item.imdbRating}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
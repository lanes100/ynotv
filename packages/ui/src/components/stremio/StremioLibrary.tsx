import { useState, useMemo } from 'react';
import { useStremioLibraryStore } from '../../stores/stremioLibraryStore';
import type { StremioMetaPreview, StremioMeta } from '../../types/stremio';
import { useStremioAddonStore } from '../../stores/stremioAddonStore';
import { fetchMeta } from '../../services/stremio-addon';
import './StremioLibrary.css';

interface StremioLibraryProps {
  onItemClick: (meta: StremioMeta) => void;
}

export function StremioLibrary({ onItemClick }: StremioLibraryProps) {
  const library = useStremioLibraryStore((s) => s.library);
  const addons = useStremioAddonStore((s) => s.addons);

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [sortBy, setSortBy] = useState<'added' | 'name' | 'rating' | 'year'>('added');

  const filteredItems = useMemo(() => {
    let items = [...library];

    // Filter by type
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

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((x) => x.name.toLowerCase().includes(q));
    }

    // Sort items
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
      // default: added (which is already order of store list: newest first)
      return 0;
    });

    return items;
  }, [library, search, selectedType, sortBy]);

  const handleCardClick = async (item: StremioMetaPreview) => {
    const addon = addons.find((a) => a.manifest.catalogs?.some((c) => c.type === item.type));
    if (addon) {
      const meta = await fetchMeta([addon], item.type, item.id);
      if (meta) onItemClick(meta);
    }
  };

  return (
    <div className="stremio-library">
      <div className="stremio-library-header">
        <h2 className="stremio-library-title">Library</h2>
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
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="stremio-meta-card"
              onClick={() => handleCardClick(item)}
            >
              {item.poster && (
                <img
                  className="stremio-meta-poster"
                  src={item.poster}
                  alt={item.name}
                  loading="lazy"
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
      )}
    </div>
  );
}

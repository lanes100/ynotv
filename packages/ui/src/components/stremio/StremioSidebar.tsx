import { useState, useCallback } from 'react';
import type { InstalledAddon } from '../../types/stremio';
import {
  useStremioSearchQuery,
  useSetStremioSearchQuery,
  useStremioSelectedAddonId,
  useSetStremioSelectedAddonId,
  useStremioSelectedCatalogId,
  useSetStremioSelectedCatalogId,
  useStremioView,
  useSetStremioView,
} from '../../stores/uiStore';
import './StremioSidebar.css';

interface StremioSidebarProps {
  addons: InstalledAddon[];
  onOpenAddonManager: () => void;
}

export function StremioSidebar({ addons, onOpenAddonManager }: StremioSidebarProps) {
  const selectedAddonId = useStremioSelectedAddonId();
  const setSelectedAddonId = useSetStremioSelectedAddonId();
  const selectedCatalogId = useStremioSelectedCatalogId();
  const setSelectedCatalogId = useSetStremioSelectedCatalogId();
  const setView = useSetStremioView();
  const view = useStremioView();
  const searchQuery = useStremioSearchQuery();
  const setSearchQuery = useSetStremioSearchQuery();
  const [inputValue, setInputValue] = useState(searchQuery);

  const isHomeActive = view === 'home' && !selectedAddonId && !selectedCatalogId;
  const isDiscoverActive = view === 'home' && !!selectedAddonId && !!selectedCatalogId;
  const isLibraryActive = view === 'library';
  const isCalendarActive = view === 'calendar';

  const handleHomeClick = () => {
    setSelectedAddonId(null);
    setSelectedCatalogId(null);
    setView('home');
  };

  const handleDiscoverClick = () => {
    setView('home');
    if (!selectedAddonId || !selectedCatalogId) {
      const firstAddon = addons.find((a) => (a.manifest.catalogs?.length ?? 0) > 0);
      const firstCat = firstAddon?.manifest.catalogs?.[0];
      if (firstAddon && firstCat) {
        setSelectedAddonId(firstAddon.id);
        setSelectedCatalogId(firstCat.id);
      }
    }
  };

  const handleLibraryClick = () => {
    setView('library');
  };

  const handleCalendarClick = () => {
    setView('calendar');
  };

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = inputValue.trim();
      setSearchQuery(val);
      if (val.length >= 2) {
        setView('search');
      } else {
        setView('home');
      }
    }
  }, [inputValue, setSearchQuery, setView]);

  const handleSearchClear = useCallback(() => {
    setInputValue('');
    setSearchQuery('');
    setView('home');
  }, [setSearchQuery, setView]);

  return (
    <div className="stremio-sidebar">
      <div className="stremio-sidebar-search">
        <div className="stremio-sidebar-search-input-wrap">
          <svg className="stremio-sidebar-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="stremio-sidebar-search-input"
            type="text"
            placeholder="Search movies, series..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          {inputValue && (
            <button className="stremio-sidebar-search-clear" onClick={handleSearchClear}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="stremio-sidebar-section">
        <button
          className={`stremio-sidebar-item ${isHomeActive ? 'active' : ''}`}
          onClick={handleHomeClick}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stremio-sidebar-icon">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span className="stremio-sidebar-item-name">Home / Board</span>
        </button>

        <button
          className={`stremio-sidebar-item ${isDiscoverActive ? 'active' : ''}`}
          onClick={handleDiscoverClick}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stremio-sidebar-icon">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="stremio-sidebar-item-name">Discover</span>
        </button>

        <button
          className={`stremio-sidebar-item ${isLibraryActive ? 'active' : ''}`}
          onClick={handleLibraryClick}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stremio-sidebar-icon">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="stremio-sidebar-item-name">Library</span>
        </button>

        <button
          className={`stremio-sidebar-item ${isCalendarActive ? 'active' : ''}`}
          onClick={handleCalendarClick}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stremio-sidebar-icon">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="stremio-sidebar-item-name">Calendar</span>
        </button>
      </div>

      <div className="stremio-sidebar-footer">
        <button className="stremio-sidebar-add-btn" onClick={onOpenAddonManager}>
          ⚙ Manage Addons
        </button>
      </div>
    </div>
  );
}
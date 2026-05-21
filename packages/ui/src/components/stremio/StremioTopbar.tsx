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
import './StremioTopbar.css';

interface StremioTopbarProps {
  addons: InstalledAddon[];
  onOpenAddonManager: () => void;
}

export function StremioTopbar({ addons, onOpenAddonManager }: StremioTopbarProps) {
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
    <div className="stremio-topbar">
      {/* Brand logo & name */}
      <div className="stremio-topbar-left">
        <div className="stremio-brand">
          <svg className="stremio-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="2" y="7" width="20" height="14" rx="3" />
            <path d="M17 2l-5 5-5-5" />
          </svg>
          <span className="stremio-brand-name">Stremio</span>
        </div>
      </div>

      {/* Centered navigation items */}
      <div className="stremio-topbar-center">
        <button
          className={`stremio-topbar-item ${isHomeActive ? 'active' : ''}`}
          onClick={handleHomeClick}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stremio-topbar-icon">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span>Home</span>
        </button>

        <button
          className={`stremio-topbar-item ${isDiscoverActive ? 'active' : ''}`}
          onClick={handleDiscoverClick}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stremio-topbar-icon">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Discover</span>
        </button>

        <button
          className={`stremio-topbar-item ${isLibraryActive ? 'active' : ''}`}
          onClick={handleLibraryClick}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stremio-topbar-icon">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>Library</span>
        </button>

        <button
          className={`stremio-topbar-item ${isCalendarActive ? 'active' : ''}`}
          onClick={handleCalendarClick}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stremio-topbar-icon">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Calendar</span>
        </button>

        <button className="stremio-topbar-item stremio-topbar-addons-btn" onClick={onOpenAddonManager}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stremio-topbar-icon">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Manage Addons</span>
        </button>
      </div>

      {/* Right aligned search bar */}
      <div className="stremio-topbar-right">
        <div className="stremio-topbar-search">
          <div className="stremio-topbar-search-input-wrap">
            <svg className="stremio-topbar-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              className="stremio-topbar-search-input"
              type="text"
              placeholder="Search"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {inputValue && (
              <button className="stremio-topbar-search-clear" onClick={handleSearchClear}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

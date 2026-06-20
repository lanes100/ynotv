import { useState } from 'react';
import './PlaybackTab.css'; // Reuse existing tab styles

interface NavigationTabProps {
  navHiddenTabs: string[];
  onNavHiddenTabsChange: (tabs: string[]) => void;
  epgHiddenButtons: string[];
  onEpgHiddenButtonsChange: (buttons: string[]) => void;
  // Category props
  showAllChannels: boolean;
  onShowAllChannelsChange: (enabled: boolean) => void;
  showFavorites: boolean;
  onShowFavoritesChange: (enabled: boolean) => void;
  showWatchlist: boolean;
  onShowWatchlistChange: (enabled: boolean) => void;
  showRecentlyViewed: boolean;
  onShowRecentlyViewedChange: (enabled: boolean) => void;
}

const NAV_ITEMS = [
  { id: 'movies', label: 'Movies' },
  { id: 'series', label: 'Series' },
  { id: 'dvr', label: 'DVR' },
  { id: 'sports', label: 'Sports' },
  { id: 'stremio', label: 'Strem' },
  { id: 'nuvio', label: 'Nuvio' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'cast', label: 'Cast' },
];

const EPG_BUTTONS = [
  { id: 'manage-channels', label: 'Manage Channels' },
  { id: 'refresh-source', label: 'Refresh Source' },
  { id: 'epg-shift', label: 'EPG Shift' },
  { id: 'playlist-editor', label: 'Playlist Editor' },
  { id: 'failover-group', label: 'Failover Group' },
];

export function NavigationTab({
  navHiddenTabs,
  onNavHiddenTabsChange,
  epgHiddenButtons,
  onEpgHiddenButtonsChange,
  showAllChannels,
  onShowAllChannelsChange,
  showFavorites,
  onShowFavoritesChange,
  showWatchlist,
  onShowWatchlistChange,
  showRecentlyViewed,
  onShowRecentlyViewedChange,
}: NavigationTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'titlebar' | 'category' | 'epg'>('titlebar');
  const isVisible = (id: string) => !navHiddenTabs.includes(id);

  const handleToggle = (id: string, checked: boolean) => {
    if (checked) {
      onNavHiddenTabsChange(navHiddenTabs.filter((t) => t !== id));
    } else {
      onNavHiddenTabsChange([...navHiddenTabs, id]);
    }
  };

  const isEpgButtonVisible = (id: string) => !epgHiddenButtons.includes(id);

  const handleEpgToggle = (id: string, checked: boolean) => {
    if (checked) {
      onEpgHiddenButtonsChange(epgHiddenButtons.filter((b) => b !== id));
    } else {
      onEpgHiddenButtonsChange([...epgHiddenButtons, id]);
    }
  };

  return (
    <div className="playback-tab-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="settings-tabs" style={{ padding: '0 20px', flexShrink: 0 }}>
        <button
          className={`settings-tab ${activeSubTab === 'titlebar' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('titlebar')}
        >
          Titlebar
        </button>
        <button
          className={`settings-tab ${activeSubTab === 'category' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('category')}
        >
          Category
        </button>
        <button
          className={`settings-tab ${activeSubTab === 'epg' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('epg')}
        >
          EPG
        </button>
      </div>

      <div className="settings-tab-content">
        {activeSubTab === 'titlebar' && (
          <div className="settings-section" style={{ paddingBottom: '8px' }}>
            <div className="section-header">
              <h3>Titlebar Navigation</h3>
            </div>

            <p className="section-description" style={{ marginBottom: '12px' }}>
              Show or hide navigation buttons in the titlebar.
            </p>

            {NAV_ITEMS.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem' }}>
                    {item.label}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isVisible(item.id)}
                  onChange={(e) => handleToggle(item.id, e.target.checked)}
                  style={{ cursor: 'pointer', marginLeft: '1rem' }}
                />
              </div>
            ))}
          </div>
        )}

        {activeSubTab === 'category' && (
          <div className="settings-section">
            <div className="section-header">
              <h3>Category Sidebar</h3>
            </div>
            <p className="section-description">
              Choose which category groups are displayed in the LiveTV sidebar.
            </p>

            <div className="timeshift-settings">
              {/* All Channels Toggle */}
              <div className="timeshift-toggle-row">
                <div className="timeshift-toggle-info">
                  <span className="timeshift-toggle-label">All Channels</span>
                  <span className="timeshift-toggle-sub">Show the "All Channels" category in the sidebar.</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showAllChannels}
                    onChange={(e) => onShowAllChannelsChange(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* Favorites Toggle */}
              <div className="timeshift-toggle-row" style={{ marginTop: '12px' }}>
                <div className="timeshift-toggle-info">
                  <span className="timeshift-toggle-label">Favorites</span>
                  <span className="timeshift-toggle-sub">Show the "Favorites" category in the sidebar.</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showFavorites}
                    onChange={(e) => onShowFavoritesChange(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* Watchlist Toggle */}
              <div className="timeshift-toggle-row" style={{ marginTop: '12px' }}>
                <div className="timeshift-toggle-info">
                  <span className="timeshift-toggle-label">Watchlist</span>
                  <span className="timeshift-toggle-sub">Show the "Watchlist" category in the sidebar.</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showWatchlist}
                    onChange={(e) => onShowWatchlistChange(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* Recently Viewed Toggle */}
              <div className="timeshift-toggle-row" style={{ marginTop: '12px' }}>
                <div className="timeshift-toggle-info">
                  <span className="timeshift-toggle-label">Recently Viewed</span>
                  <span className="timeshift-toggle-sub">Show the "Recently Viewed" category in the sidebar.</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showRecentlyViewed}
                    onChange={(e) => onShowRecentlyViewedChange(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'epg' && (
          <div className="settings-section" style={{ paddingBottom: '8px' }}>
            <div className="section-header">
              <h3>EPG Button Visibility</h3>
            </div>

            <p className="section-description" style={{ marginBottom: '12px' }}>
              Show or hide buttons in the LiveTV EPG header.
            </p>

            {EPG_BUTTONS.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem' }}>
                    {item.label}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isEpgButtonVisible(item.id)}
                  onChange={(e) => handleEpgToggle(item.id, e.target.checked)}
                  style={{ cursor: 'pointer', marginLeft: '1rem' }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

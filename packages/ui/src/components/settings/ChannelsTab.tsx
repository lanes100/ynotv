import { useSetChannelSortOrder, useSetCategorySortOrder, useSetIncludeAllChannelsToPlaylist } from '../../stores/uiStore';
import './PlaybackTab.css'; // Reuse existing tab styles for toggle

interface ChannelsTabProps {
  channelSortOrder: 'alphabetical' | 'number' | 'provider';
  onChannelSortOrderChange: (order: 'alphabetical' | 'number' | 'provider') => void;
  categorySortOrder: 'default' | 'alphabetical';
  onCategorySortOrderChange: (order: 'default' | 'alphabetical') => void;
  includeSourceInSearch: boolean;
  onIncludeSourceInSearchChange: (enabled: boolean) => void;
  includeSourceInVodSearch: boolean;
  onIncludeSourceInVodSearchChange: (enabled: boolean) => void;
  maxSearchResults: number;
  onMaxSearchResultsChange: (limit: number) => void;
  searchResultsOrder: 'default' | 'alphabetical';
  onSearchResultsOrderChange: (order: 'default' | 'alphabetical') => void;
  includeAllChannelsToPlaylist: boolean;
  onIncludeAllChannelsToPlaylistChange: (enabled: boolean) => void;
  showMode?: 'sort-order' | 'search' | 'all';
}

async function saveIncludeSourceInSearch(enabled: boolean) {
  if (!window.storage) return;
  await window.storage.updateSettings({ includeSourceInSearch: enabled });
}

async function saveIncludeSourceInVodSearch(enabled: boolean) {
  if (!window.storage) return;
  await window.storage.updateSettings({ includeSourceInVodSearch: enabled });
}

async function saveMaxSearchResults(limit: number) {
  if (!window.storage) return;
  await window.storage.updateSettings({ maxSearchResults: limit });
}

async function saveSearchResultsOrder(order: 'default' | 'alphabetical') {
  if (!window.storage) return;
  await window.storage.updateSettings({ searchResultsOrder: order });
}

async function saveIncludeAllChannelsToPlaylist(enabled: boolean) {
  if (!window.storage) return;
  await window.storage.updateSettings({ includeAllChannelsToPlaylist: enabled });
}

export function ChannelsTab({
  channelSortOrder,
  onChannelSortOrderChange,
  categorySortOrder,
  onCategorySortOrderChange,
  includeSourceInSearch,
  onIncludeSourceInSearchChange,
  includeSourceInVodSearch,
  onIncludeSourceInVodSearchChange,
  maxSearchResults,
  onMaxSearchResultsChange,
  searchResultsOrder,
  onSearchResultsOrderChange,
  includeAllChannelsToPlaylist,
  onIncludeAllChannelsToPlaylistChange,
  showMode = 'all',
}: ChannelsTabProps) {
  const setChannelSortOrder = useSetChannelSortOrder();
  const setCategorySortOrder = useSetCategorySortOrder();
  const setIncludeAllChannelsToPlaylist = useSetIncludeAllChannelsToPlaylist();

  async function handleSortOrderChange(order: 'alphabetical' | 'number' | 'provider') {
    onChannelSortOrderChange(order);
    setChannelSortOrder(order); // Update global store immediately
    if (!window.storage) return;
    await window.storage.updateSettings({ channelSortOrder: order });
  }

  async function handleCategorySortOrderChange(order: 'default' | 'alphabetical') {
    onCategorySortOrderChange(order);
    setCategorySortOrder(order); // Update global store immediately
    if (!window.storage) return;
    await window.storage.updateSettings({ categorySortOrder: order });
  }

  const showSortOrder = showMode === 'all' || showMode === 'sort-order';
  const showSearch = showMode === 'all' || showMode === 'search';

  return (
    <div>
      {showSortOrder && (
        <>
          <div className="settings-section">
            <div className="section-header">
              <h3>Channel Display</h3>
            </div>

            <p className="section-description">
              Configure how channels are sorted in the guide.
            </p>

            <div className="refresh-settings">
              <div className="form-group inline">
                <label>Sort Order</label>
                <select
                  value={channelSortOrder}
                  onChange={(e) => handleSortOrderChange(e.target.value as 'alphabetical' | 'number' | 'provider')}
                >
                  <option value="provider">Provider</option>
                  <option value="alphabetical">Alphabetical (A-Z)</option>
                  <option value="number">Channel Number</option>
                </select>
              </div>
            </div>

            <p className="form-hint" style={{ marginTop: '0.75rem' }}>
              "Provider" preserves the order channels appear in the M3U file or provider response.
              <br />
              "Alphabetical" sorts all channels A-Z.
              <br />
              "Channel Number" uses the order from your provider (Xtream num or M3U tvg-chno).
              Channels without a number will appear at the end, sorted alphabetically.
            </p>
          </div>

          <div className="settings-section" style={{ marginTop: '24px' }}>
            <div className="section-header">
              <h3>Category Display</h3>
            </div>

            <p className="section-description">
              Configure how categories are sorted under each source.
            </p>

            <div className="refresh-settings">
              <div className="form-group inline">
                <label>Sort Order</label>
                <select
                  value={categorySortOrder}
                  onChange={(e) => handleCategorySortOrderChange(e.target.value as 'default' | 'alphabetical')}
                >
                  <option value="default">Default</option>
                  <option value="alphabetical">Alphabetical (A-Z)</option>
                </select>
              </div>
            </div>

            <p className="form-hint" style={{ marginTop: '0.75rem' }}>
              "Default" uses the order from your provider or any custom order set in Manage Categories.
              "Alphabetical" sorts all categories alphabetically (A-Z).
            </p>

            <div className="timeshift-settings" style={{ marginTop: '20px' }}>
              <div className="timeshift-toggle-row">
                <div className="timeshift-toggle-info">
                  <span className="timeshift-toggle-label">Include All Channels to Playlist</span>
                  <span className="timeshift-toggle-sub">
                    When enabled, each playlist/source will show an "All Channels" category at the top that displays
                    all enabled channels from that source in the EPG.
                  </span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={includeAllChannelsToPlaylist}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      onIncludeAllChannelsToPlaylistChange(enabled);
                      setIncludeAllChannelsToPlaylist(enabled);
                      saveIncludeAllChannelsToPlaylist(enabled);
                    }}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </div>
        </>
      )}

      {showSearch && (
        <div className="settings-section" style={{ marginTop: showSortOrder ? '24px' : '0' }}>
          <div className="section-header">
            <h3>Search</h3>
          </div>

          <p className="section-description">
            Configure how channel search works.
          </p>

          <div className="timeshift-settings">
            <div className="timeshift-toggle-row">
              <div className="timeshift-toggle-info">
                <span className="timeshift-toggle-label">Include Source name in search</span>
                <span className="timeshift-toggle-sub">
                  When enabled, search will also match against source names, and the source name will be displayed in search results.
                  This helps distinguish between channels with the same name from different sources.
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={includeSourceInSearch}
                  onChange={(e) => {
                  onIncludeSourceInSearchChange(e.target.checked);
                  saveIncludeSourceInSearch(e.target.checked);
                }}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          <div className="timeshift-settings" style={{ marginTop: '16px' }}>
            <div className="timeshift-toggle-row">
              <div className="timeshift-toggle-info">
                <span className="timeshift-toggle-label">Include Source name in VOD Search</span>
                <span className="timeshift-toggle-sub">
                  When enabled, the source name will be displayed for the search results when searching VOD Movies and Series.
                  This helps distinguish between VOD content with the same name from different sources.
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={includeSourceInVodSearch}
                  onChange={(e) => {
                    onIncludeSourceInVodSearchChange(e.target.checked);
                    saveIncludeSourceInVodSearch(e.target.checked);
                  }}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          <div className="refresh-settings" style={{ marginTop: '20px' }}>
            <div className="form-group inline">
              <label>Max search results</label>
              <select
                value={maxSearchResults}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  onMaxSearchResultsChange(value);
                  saveMaxSearchResults(value);
                }}
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200 (default)</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </div>
            <p className="form-hint" style={{ marginTop: '0.5rem' }}>
              Maximum number of results to show in channel search, custom group search, and calendar channel selector.
              Higher values may impact performance.
            </p>
          </div>

          <div className="refresh-settings" style={{ marginTop: '20px' }}>
            <div className="form-group inline">
              <label>Search results order</label>
              <select
                value={searchResultsOrder}
                onChange={(e) => {
                  const value = e.target.value as 'default' | 'alphabetical';
                  onSearchResultsOrderChange(value);
                  saveSearchResultsOrder(value);
                }}
              >
                <option value="default">Default</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
            </div>
            <p className="form-hint" style={{ marginTop: '0.5rem' }}>
              Choose how search results are sorted. "Default" shows results in database order.
              "Alphabetical" sorts channels and programs by name (A-Z).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

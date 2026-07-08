import { useState, useEffect } from 'react';
import { ChannelsTab } from './ChannelsTab';
import { LiveViewTab } from './LiveViewTab';
import { WidgetsTab } from './WidgetsTab';
import './PlaybackTab.css'; // Reuse existing tab styles

export type LiveTVSubTabId = 'epg' | 'font-size' | 'sort-order' | 'search' | 'live-view' | 'widgets';

interface LiveTVTabProps {
  initialSubTab?: LiveTVSubTabId;
  // EPG props
  epgDarkenCurrent: boolean;
  onEpgDarkenCurrentChange: (enabled: boolean) => void;
  epgVisibleHours: 'auto' | number;
  onEpgVisibleHoursChange: (hours: 'auto' | number) => void;
  epgBoldChannelNames: boolean;
  onEpgBoldChannelNamesChange: (enabled: boolean) => void;
  epgBoldTopCategories: boolean;
  onEpgBoldTopCategoriesChange: (enabled: boolean) => void;
  epgBoldSourceCategories: boolean;
  onEpgBoldSourceCategoriesChange: (enabled: boolean) => void;
  epgPreferEpgLogos: boolean;
  onEpgPreferEpgLogosChange: (enabled: boolean) => void;
  epgView: 'traditional' | 'alternate';
  onEpgViewChange: (view: 'traditional' | 'alternate') => void;
  epgTitleFontSize: number;
  onEpgTitleFontSizeChange: (size: number) => void;
  epgBodyFontSize: number;
  onEpgBodyFontSizeChange: (size: number) => void;
  // Font Size props
  channelFontSize: number;
  onChannelFontSizeChange: (size: number) => void;
  categoryFontSize: number;
  onCategoryFontSizeChange: (size: number) => void;
  // Sort Order props (from ChannelsTab)
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
  // Channel Overlay props
  channelInfoOverlayEnabled: boolean;
  onChannelInfoOverlayChange: (enabled: boolean) => void;
  channelInfoOverlayFontSize: number;
  onChannelInfoOverlayFontSizeChange: (size: number) => void;
  channelInfoOverlayLogoSize: number;
  onChannelInfoOverlayLogoSizeChange: (size: number) => void;
  channelInfoOverlayBoxWidth: number;
  onChannelInfoOverlayBoxWidthChange: (width: number) => void;
  channelInfoOverlayOpacity: number;
  onChannelInfoOverlayOpacityChange: (opacity: number) => void;
  channelInfoOverlayHideDescription: boolean;
  onChannelInfoOverlayHideDescriptionChange: (hide: boolean) => void;
  // Widgets props
  widgetScale: number;
  onWidgetScaleChange: (scale: number) => void;
  widgetBgOpacity: number;
  onWidgetBgOpacityChange: (opacity: number) => void;
  sportsScale: number;
  onSportsScaleChange: (scale: number) => void;
  sportsBgOpacity: number;
  onSportsBgOpacityChange: (opacity: number) => void;
  // Transparent guide overlay props
  transparentGuideHeight: number;
  onTransparentGuideHeightChange: (height: number) => void;
  transparentGuideHideHeader: boolean;
  onTransparentGuideHideHeaderChange: (hide: boolean) => void;
  transparentGuideOnZap: boolean;
  onTransparentGuideOnZapChange: (enabled: boolean) => void;
  transparentGuideOverlayOpacity: number;
  onTransparentGuideOverlayOpacityChange: (opacity: number) => void;
  transparentGuideSidebarOpacity: number;
  onTransparentGuideSidebarOpacityChange: (opacity: number) => void;
  modernUiEnabled?: boolean | string;
}

export function LiveTVTab({
  initialSubTab,
  epgDarkenCurrent,
  onEpgDarkenCurrentChange,
  epgVisibleHours,
  onEpgVisibleHoursChange,
  epgBoldChannelNames,
  onEpgBoldChannelNamesChange,
  epgBoldTopCategories,
  onEpgBoldTopCategoriesChange,
  epgBoldSourceCategories,
  onEpgBoldSourceCategoriesChange,
  epgPreferEpgLogos,
  onEpgPreferEpgLogosChange,
  epgView,
  onEpgViewChange,
  epgTitleFontSize,
  onEpgTitleFontSizeChange,
  epgBodyFontSize,
  onEpgBodyFontSizeChange,
  channelFontSize,
  onChannelFontSizeChange,
  categoryFontSize,
  onCategoryFontSizeChange,
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
  channelInfoOverlayEnabled,
  onChannelInfoOverlayChange,
  channelInfoOverlayFontSize,
  onChannelInfoOverlayFontSizeChange,
  channelInfoOverlayLogoSize,
  onChannelInfoOverlayLogoSizeChange,
  channelInfoOverlayBoxWidth,
  onChannelInfoOverlayBoxWidthChange,
  channelInfoOverlayOpacity,
  onChannelInfoOverlayOpacityChange,
  channelInfoOverlayHideDescription,
  onChannelInfoOverlayHideDescriptionChange,
  widgetScale,
  onWidgetScaleChange,
  widgetBgOpacity,
  onWidgetBgOpacityChange,
  sportsScale,
  onSportsScaleChange,
  sportsBgOpacity,
  onSportsBgOpacityChange,
  transparentGuideHeight,
  onTransparentGuideHeightChange,
  transparentGuideHideHeader,
  onTransparentGuideHideHeaderChange,
  transparentGuideOnZap,
  onTransparentGuideOnZapChange,
  transparentGuideOverlayOpacity,
  onTransparentGuideOverlayOpacityChange,
  transparentGuideSidebarOpacity,
  onTransparentGuideSidebarOpacityChange,
  modernUiEnabled,
}: LiveTVTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'epg' | 'font-size' | 'sort-order' | 'search' | 'live-view' | 'widgets'>('epg');

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab as any);
    }
  }, [initialSubTab]);

  return (
    <div className="playback-tab-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="settings-tabs" style={{ padding: '0 20px', flexShrink: 0 }}>
        <button
          className={`settings-tab ${activeSubTab === 'epg' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('epg')}
        >
          EPG
        </button>
        <button
          className={`settings-tab ${activeSubTab === 'font-size' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('font-size')}
        >
          Font Size
        </button>
        <button
          className={`settings-tab ${activeSubTab === 'sort-order' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('sort-order')}
        >
          Sort Order
        </button>
        <button
          className={`settings-tab ${activeSubTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('search')}
        >
          Search
        </button>
        <button
          className={`settings-tab ${activeSubTab === 'live-view' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('live-view')}
        >
          Channel Overlay
        </button>
        <button
          className={`settings-tab ${activeSubTab === 'widgets' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('widgets')}
        >
          Widgets
        </button>
      </div>

      <div className="settings-tab-content">
        {activeSubTab === 'epg' && (
          <>
            <div className="settings-section">
              <div className="timeshift-settings" style={{ marginTop: 0 }}>
                {/* EPG Visible Hours */}
                <div className="timeshift-toggle-row">
                  <div className="timeshift-toggle-info">
                    <span className="timeshift-toggle-label">EPG Visible Hours</span>
                    <span className="timeshift-toggle-sub">Customize the number of hours visible in the grid (Automatic uses 2-5 hours dynamically based on width).</span>
                  </div>
                  <select
                    value={epgVisibleHours}
                    onChange={(e) => {
                      const val = e.target.value;
                      onEpgVisibleHoursChange(val === 'auto' ? 'auto' : parseInt(val, 10));
                    }}
                  >
                    <option value="auto">Automatic (Default)</option>
                    <option value="2">2 Hours</option>
                    <option value="3">3 Hours</option>
                    <option value="4">4 Hours</option>
                    <option value="5">5 Hours</option>
                    <option value="6">6 Hours</option>
                  </select>
                </div>

                {/* Enable darker current program block */}
                <div className="timeshift-toggle-row">
                  <div className="timeshift-toggle-info">
                    <span className="timeshift-toggle-label">Make EPG Current airing program blocks darker</span>
                    <span className="timeshift-toggle-sub">When enabled, the currently airing program in the EPG will have a deeper/darker highlight, making it easier to identify on all themes.</span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={epgDarkenCurrent}
                      onChange={(e) => onEpgDarkenCurrentChange(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                {/* Prefer EPG channel logos globally */}
                <div className="timeshift-toggle-row">
                  <div className="timeshift-toggle-info">
                    <span className="timeshift-toggle-label">Prefer EPG logos globally</span>
                    <span className="timeshift-toggle-sub">When enabled, channels with EPG data will display the matched EPG channel's logo instead of the playlist's logo.</span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={epgPreferEpgLogos}
                      onChange={(e) => onEpgPreferEpgLogosChange(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                {/* Preview example */}
                <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>Preview:</h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Regular program block */}
                    <div style={{
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '4px',
                      borderLeft: '2px solid transparent',
                      flex: 1,
                      fontSize: '0.8rem'
                    }}>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>Other Program</span>
                    </div>
                    {/* Current program block */}
                    <div style={{
                      padding: '8px 12px',
                      background: epgDarkenCurrent
                        ? 'color-mix(in srgb, var(--accent-primary, #00d4ff) 25%, rgba(0,0,0,0.3))'
                        : 'color-mix(in srgb, var(--accent-primary, #00d4ff) 8%, transparent)',
                      borderRadius: '4px',
                      borderLeft: '3px solid var(--accent-primary, #00d4ff)',
                      flex: 1,
                      fontSize: '0.8rem'
                    }}>
                      <span style={{ color: 'rgba(255,255,255,0.95)' }}>Current Program</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bold Typography Settings - hidden for v3 design */}
            {modernUiEnabled !== 'v3' && <div className="settings-section">
              <div className="section-header">
                <h3>Bold Typography</h3>
              </div>
              <p className="section-description">
                Enable bold font formatting for EPG elements and sidebar categories.
              </p>

              <div style={{ marginTop: '16px', overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.9rem',
                  background: 'rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600, fontSize: '0.85rem' }}>Channel Names</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600, fontSize: '0.85rem' }}>Top Categories</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600, fontSize: '0.85rem' }}>Source Categories</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '16px', textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <label className="toggle-switch" style={{ margin: '0 auto' }}>
                          <input
                            type="checkbox"
                            checked={epgBoldChannelNames}
                            onChange={(e) => onEpgBoldChannelNamesChange(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <label className="toggle-switch" style={{ margin: '0 auto' }}>
                          <input
                            type="checkbox"
                            checked={epgBoldTopCategories}
                            onChange={(e) => onEpgBoldTopCategoriesChange(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <label className="toggle-switch" style={{ margin: '0 auto' }}>
                          <input
                            type="checkbox"
                            checked={epgBoldSourceCategories}
                            onChange={(e) => onEpgBoldSourceCategoriesChange(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>}

            {/* EPG Font Size Settings */}
            <div className="settings-section">
              <div className="section-header">
                <h3>EPG</h3>
              </div>
              <p className="section-description">
                Adjust the font size for program information displayed in the EPG preview panel.
              </p>

              <div className="timeshift-settings">
                {/* EPG Title Font Size */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.9)' }}>Title Font Size</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <input
                      type="range"
                      min="16"
                      max="64"
                      value={epgTitleFontSize}
                      onChange={(e) => onEpgTitleFontSizeChange(parseInt(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ minWidth: '3rem', textAlign: 'right', color: 'rgba(255,255,255,0.8)' }}>
                      {epgTitleFontSize}px
                    </span>
                  </div>
                  <p className="form-hint" style={{ marginTop: '0.5rem' }}>
                    Preview: <span style={{ fontSize: `${epgTitleFontSize}px`, color: '#00d4ff' }}>Program Title</span>
                  </p>
                </div>

                {/* EPG Body Font Size */}
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.9)' }}>Body Text Font Size</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <input
                      type="range"
                      min="10"
                      max="32"
                      value={epgBodyFontSize}
                      onChange={(e) => onEpgBodyFontSizeChange(parseInt(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ minWidth: '3rem', textAlign: 'right', color: 'rgba(255,255,255,0.8)' }}>
                      {epgBodyFontSize}px
                    </span>
                  </div>
                  <p className="form-hint" style={{ marginTop: '0.5rem' }}>
                    Preview: <span style={{ fontSize: `${epgBodyFontSize}px`, color: '#00d4ff' }}>Program description text displayed in the preview panel.</span>
                  </p>
                </div>

                {/* Reset Button */}
                <div style={{ marginTop: '16px' }}>
                  <button
                    className="sync-btn"
                    onClick={() => {
                      onEpgTitleFontSizeChange(32);
                      onEpgBodyFontSizeChange(16);
                    }}
                    style={{ maxWidth: '200px' }}
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            </div>

            {/* Preview Panel Settings */}
            <div className="settings-section">
              <div className="section-header">
                <h3>Preview Panel</h3>
              </div>
              <p className="section-description">
                Customize the video preview panel in the LiveTV/EPG view.
              </p>

              <div className="timeshift-settings">
                {/* EPG View Dropdown */}
                <div className="timeshift-toggle-row">
                  <div className="timeshift-toggle-info">
                    <span className="timeshift-toggle-label">EPG View Layout</span>
                    <span className="timeshift-toggle-sub">Select between the standard left-to-right setup or the full-width cinematic format.</span>
                  </div>
                  <select
                    value={epgView}
                    onChange={(e) => onEpgViewChange(e.target.value as 'traditional' | 'alternate')}
                  >
                    <option value="traditional">Traditional EPG View</option>
                    <option value="alternate">Alternate EPG View</option>
                  </select>
                </div>

              </div>
            </div>

            {/* Transparent EPG Overlay Settings */}
            <div className="settings-section">
              <div className="section-header">
                <h3>Transparent EPG Overlay</h3>
              </div>
              <p className="section-description">
                When using Transparent Guide mode (press Z), controls how much of the screen the EPG/channel list covers, from the bottom up.
              </p>

              <div className="timeshift-settings">
                <div className="timeshift-toggle-row">
                  <div className="timeshift-toggle-info">
                    <span className="timeshift-toggle-label">Overlay Height</span>
                    <span className="timeshift-toggle-sub">Percentage of the app height the EPG overlay covers (25–100%).</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="25"
                      max="100"
                      value={transparentGuideHeight}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) onTransparentGuideHeightChange(val);
                      }}
                      style={{ width: '70px', padding: '4px 8px', textAlign: 'center' }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>%</span>
                    <input
                      type="range"
                      min="25"
                      max="100"
                      value={transparentGuideHeight}
                      onChange={(e) => onTransparentGuideHeightChange(parseInt(e.target.value))}
                      style={{ width: '120px' }}
                    />
                  </div>
                </div>

                <div className="timeshift-toggle-row" style={{ marginTop: '12px' }}>
                  <div className="timeshift-toggle-info">
                    <span className="timeshift-toggle-label">Hide Top Row</span>
                    <span className="timeshift-toggle-sub">Hide the time, manage, refresh, shift, and Now buttons. The channel list fills the extra space.</span>
                  </div>
                  <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={transparentGuideHideHeader}
                      onChange={(e) => onTransparentGuideHideHeaderChange(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', inset: 0,
                      backgroundColor: transparentGuideHideHeader ? 'var(--accent-primary, #00d4ff)' : 'rgba(255,255,255,0.2)',
                      borderRadius: '24px',
                      transition: 'background-color 0.2s',
                    }}>
                      <span style={{
                        position: 'absolute', top: '2px',
                        left: transparentGuideHideHeader ? '22px' : '2px',
                        width: '20px', height: '20px', borderRadius: '50%',
                        backgroundColor: '#fff', transition: 'left 0.2s',
                      }} />
                    </span>
                  </label>
                </div>

                <div className="timeshift-toggle-row" style={{ marginTop: '12px' }}>
                  <div className="timeshift-toggle-info">
                    <span className="timeshift-toggle-label">Display on Channel Zap</span>
                    <span className="timeshift-toggle-sub">When zapping channels (channel up/down), the transparent EPG overlay appears briefly and auto-hides.</span>
                  </div>
                  <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={transparentGuideOnZap}
                      onChange={(e) => onTransparentGuideOnZapChange(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', inset: 0,
                      backgroundColor: transparentGuideOnZap ? 'var(--accent-primary, #00d4ff)' : 'rgba(255,255,255,0.2)',
                      borderRadius: '24px',
                      transition: 'background-color 0.2s',
                    }}>
                      <span style={{
                        position: 'absolute', top: '2px',
                        left: transparentGuideOnZap ? '22px' : '2px',
                        width: '20px', height: '20px', borderRadius: '50%',
                        backgroundColor: '#fff', transition: 'left 0.2s',
                      }} />
                    </span>
                  </label>
                </div>

                <div className="timeshift-toggle-row" style={{ marginTop: '12px' }}>
                  <div className="timeshift-toggle-info">
                    <span className="timeshift-toggle-label">EPG Overlay Opacity</span>
                    <span className="timeshift-toggle-sub">Opacity level of the transparent EPG overlay (0–100%).</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={transparentGuideOverlayOpacity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) onTransparentGuideOverlayOpacityChange(val);
                      }}
                      style={{ width: '70px', padding: '4px 8px', textAlign: 'center' }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>%</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={transparentGuideOverlayOpacity}
                      onChange={(e) => onTransparentGuideOverlayOpacityChange(parseInt(e.target.value))}
                      style={{ width: '120px' }}
                    />
                  </div>
                </div>

                <div className="timeshift-toggle-row" style={{ marginTop: '12px' }}>
                  <div className="timeshift-toggle-info">
                    <span className="timeshift-toggle-label">Category Sidebar Opacity</span>
                    <span className="timeshift-toggle-sub">Opacity level of the category sidebar in transparent guide mode (0–100%).</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={transparentGuideSidebarOpacity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) onTransparentGuideSidebarOpacityChange(val);
                      }}
                      style={{ width: '70px', padding: '4px 8px', textAlign: 'center' }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>%</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={transparentGuideSidebarOpacity}
                      onChange={(e) => onTransparentGuideSidebarOpacityChange(parseInt(e.target.value))}
                      style={{ width: '120px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeSubTab === 'font-size' && (
          <div className="settings-section">
            <div className="section-header">
              <h3>Font Size</h3>
            </div>

            <p className="section-description" style={{ marginBottom: '12px' }}>
              Adjust the font size for channel names and category labels to improve readability.
            </p>

            {/* Channel Font Size */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.9)' }}>Channel Font Size</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={channelFontSize}
                  onChange={(e) => onChannelFontSizeChange(parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ minWidth: '3rem', textAlign: 'right', color: 'rgba(255,255,255,0.8)' }}>
                  {channelFontSize}px
                </span>
              </div>
              <p className="form-hint" style={{ marginTop: '0.5rem' }}>
                Preview: <span style={{ fontSize: `${channelFontSize}px`, color: '#00d4ff' }}>Channel Name Example</span>
              </p>
            </div>

            {/* Category Font Size */}
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.9)' }}>Category Font Size</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={categoryFontSize}
                  onChange={(e) => onCategoryFontSizeChange(parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ minWidth: '3rem', textAlign: 'right', color: 'rgba(255,255,255,0.8)' }}>
                  {categoryFontSize}px
                </span>
              </div>
              <p className="form-hint" style={{ marginTop: '0.5rem' }}>
                Preview: <span style={{ fontSize: `${categoryFontSize}px`, color: '#00d4ff' }}>Category Name Example</span>
              </p>
            </div>

            {/* Reset Button */}
            <div style={{ marginTop: '16px' }}>
              <button
                className="sync-btn"
                onClick={() => {
                  onChannelFontSizeChange(14);
                  onCategoryFontSizeChange(14);
                }}
                style={{ maxWidth: '200px' }}
              >
                Reset to Default
              </button>
            </div>
          </div>
        )}

        {(activeSubTab === 'sort-order' || activeSubTab === 'search') && (
          <ChannelsTab
            channelSortOrder={channelSortOrder}
            onChannelSortOrderChange={onChannelSortOrderChange}
            categorySortOrder={categorySortOrder}
            onCategorySortOrderChange={onCategorySortOrderChange}
            includeSourceInSearch={includeSourceInSearch}
            onIncludeSourceInSearchChange={onIncludeSourceInSearchChange}
            includeSourceInVodSearch={includeSourceInVodSearch}
            onIncludeSourceInVodSearchChange={onIncludeSourceInVodSearchChange}
            maxSearchResults={maxSearchResults}
            onMaxSearchResultsChange={onMaxSearchResultsChange}
            searchResultsOrder={searchResultsOrder}
            onSearchResultsOrderChange={onSearchResultsOrderChange}
            includeAllChannelsToPlaylist={includeAllChannelsToPlaylist}
            onIncludeAllChannelsToPlaylistChange={onIncludeAllChannelsToPlaylistChange}
            showMode={activeSubTab === 'sort-order' ? 'sort-order' : 'search'}
          />
        )}

        {activeSubTab === 'live-view' && (
          <LiveViewTab
            channelInfoOverlayEnabled={channelInfoOverlayEnabled}
            onChannelInfoOverlayChange={onChannelInfoOverlayChange}
            channelInfoOverlayFontSize={channelInfoOverlayFontSize}
            onChannelInfoOverlayFontSizeChange={onChannelInfoOverlayFontSizeChange}
            channelInfoOverlayLogoSize={channelInfoOverlayLogoSize}
            onChannelInfoOverlayLogoSizeChange={onChannelInfoOverlayLogoSizeChange}
            channelInfoOverlayBoxWidth={channelInfoOverlayBoxWidth}
            onChannelInfoOverlayBoxWidthChange={onChannelInfoOverlayBoxWidthChange}
            channelInfoOverlayOpacity={channelInfoOverlayOpacity}
            onChannelInfoOverlayOpacityChange={onChannelInfoOverlayOpacityChange}
            channelInfoOverlayHideDescription={channelInfoOverlayHideDescription}
            onChannelInfoOverlayHideDescriptionChange={onChannelInfoOverlayHideDescriptionChange}
          />
        )}

        {activeSubTab === 'widgets' && (
          <WidgetsTab
            widgetScale={widgetScale}
            onWidgetScaleChange={onWidgetScaleChange}
            widgetBgOpacity={widgetBgOpacity}
            onWidgetBgOpacityChange={onWidgetBgOpacityChange}
            sportsScale={sportsScale}
            onSportsScaleChange={onSportsScaleChange}
            sportsBgOpacity={sportsBgOpacity}
            onSportsBgOpacityChange={onSportsBgOpacityChange}
          />
        )}
      </div>
    </div>
  );
}

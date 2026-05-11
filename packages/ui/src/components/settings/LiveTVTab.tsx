import './PlaybackTab.css'; // Reuse existing tab styles

interface LiveTVTabProps {
  epgDarkenCurrent: boolean;
  onEpgDarkenCurrentChange: (enabled: boolean) => void;
  epgView: 'traditional' | 'alternate';
  onEpgViewChange: (view: 'traditional' | 'alternate') => void;
  collapseSourceCategoriesOnStartup: boolean;
  onCollapseSourceCategoriesOnStartupChange: (enabled: boolean) => void;
  epgTitleFontSize: number;
  onEpgTitleFontSizeChange: (size: number) => void;
  epgBodyFontSize: number;
  onEpgBodyFontSizeChange: (size: number) => void;
}

export function LiveTVTab({
  epgDarkenCurrent,
  onEpgDarkenCurrentChange,
  epgView,
  onEpgViewChange,
  collapseSourceCategoriesOnStartup,
  onCollapseSourceCategoriesOnStartupChange,
  epgTitleFontSize,
  onEpgTitleFontSizeChange,
  epgBodyFontSize,
  onEpgBodyFontSizeChange,
}: LiveTVTabProps) {
  return (
    <div className="settings-tab-content playback-tab-content">
      <div className="settings-section">
        <div className="timeshift-settings" style={{ marginTop: 0 }}>
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
      {/* Categories Settings */}
      <div className="settings-section">
        <div className="section-header">
          <h3>Categories</h3>
        </div>
        <p className="section-description">
          Customize how source categories are displayed in the LiveTV view.
        </p>

        <div className="timeshift-settings">
          {/* Collapse Source Categories on Startup */}
          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Collapse Source Categories on Startup</span>
              <span className="timeshift-toggle-sub">When enabled, source categories will be collapsed by default when the LiveTV Categories view loads.</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={collapseSourceCategoriesOnStartup}
                onChange={(e) => onCollapseSourceCategoriesOnStartupChange(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>

    </div>
  );
}

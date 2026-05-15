import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './SourcesTab.css'; // Import shared tooltip styles

interface UITabProps {
  settings: {
    startupWidth?: number;
    startupHeight?: number;
    dontSaveWindowSizeOnClose?: boolean;
    modernUiEnabled?: boolean;
    collapseSourceCategoriesOnStartup?: boolean;
    overlayAutohideTimer?: number;
  };
  onSettingsChange: (settings: {
    startupWidth?: number;
    startupHeight?: number;
    dontSaveWindowSizeOnClose?: boolean;
    modernUiEnabled?: boolean;
    collapseSourceCategoriesOnStartup?: boolean;
    overlayAutohideTimer?: number;
  }) => void;
}

function WindowSizeSettings({ width, height, onChange }: { width: number; height: number; onChange: (w: number, h: number) => void }) {
  const [localWidth, setLocalWidth] = useState(width);
  const [localHeight, setLocalHeight] = useState(height);
  const [status, setStatus] = useState<'' | 'saved'>('');

  // Update local state when props change (e.g. initial load)
  useEffect(() => {
    setLocalWidth(width);
    setLocalHeight(height);
  }, [width, height]);

  const handleApply = () => {
    onChange(localWidth, localHeight);
    setStatus('saved');
    setTimeout(() => setStatus(''), 2000);
  };

  const handleReset = () => {
    const defW = 1920;
    const defH = 1080;
    setLocalWidth(defW);
    setLocalHeight(defH);
    onChange(defW, defH);
    setStatus('saved');
    setTimeout(() => setStatus(''), 2000);
  };

  const handleUseCurrentSize = async () => {
    try {
      const appWindow = getCurrentWindow();
      // Use innerSize to match what we save and apply (inner size, not outer)
      const size = await appWindow.innerSize();
      // Convert from physical pixels to logical pixels
      const factor = await appWindow.scaleFactor();
      const logicalWidth = Math.round(size.width / factor);
      const logicalHeight = Math.round(size.height / factor);

      setLocalWidth(logicalWidth);
      setLocalHeight(logicalHeight);
      onChange(logicalWidth, logicalHeight);
      setStatus('saved');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      console.error('Failed to get current window size:', err);
    }
  };

  return (
    <div className="form-group" style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.9)' }}>Width (px)</label>
          <input
            type="number"
            min="800"
            max="7680"
            value={localWidth}
            onChange={(e) => setLocalWidth(parseInt(e.target.value) || 1920)}
            className="query-input"
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.9)' }}>Height (px)</label>
          <input
            type="number"
            min="600"
            max="4320"
            value={localHeight}
            onChange={(e) => setLocalHeight(parseInt(e.target.value) || 1080)}
            className="query-input"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button
          className="sync-btn"
          onClick={handleApply}
          style={{ padding: '0.5rem 1.5rem', background: '#00d4ff', color: 'black', fontWeight: 600 }}
        >
          {status === 'saved' ? 'Saved!' : 'Apply'}
        </button>

        <button
          className="sync-btn secondary"
          onClick={handleUseCurrentSize}
          style={{ background: 'rgba(255,255,255,0.15)' }}
        >
          Use Current Size
        </button>

        <button
          className="sync-btn secondary"
          onClick={handleReset}
          style={{ background: 'rgba(255,255,255,0.1)' }}
        >
          Reset to Default
        </button>
      </div>

      <p className="form-hint" style={{ marginTop: '0.75rem' }}>
        Window size is automatically saved when you close the app. Default: 1920 x 1080.
      </p>
    </div>
  );
}

export function UITab({ settings, onSettingsChange }: UITabProps) {
  return (
    <div className="settings-tab-content">
      {/* Modern UI Section */}
      <div className="settings-section" style={{ paddingTop: '8px' }}>
        <div className="timeshift-settings">
          <div className="timeshift-toggle-row" style={{ position: 'relative' }}>
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Enable Modern UI Design
                <div className="epg-tooltip">
                  <span className="epg-tooltip-icon">?</span>
                  <div className="epg-tooltip-content">
                    When enabled, applies a modern glass-morphism aesthetic with enhanced animations, gradients, and visual effects to the Categories and EPG views. Works best with glass themes.
                  </div>
                </div>
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.modernUiEnabled ?? true}
                onChange={(e) => onSettingsChange({ ...settings, modernUiEnabled: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Collapse Source Categories on Startup */}
          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Collapse Source Categories on Startup
                <div className="epg-tooltip">
                  <span className="epg-tooltip-icon">?</span>
                  <div className="epg-tooltip-content">
                    When enabled, source categories will be collapsed by default when the LiveTV Categories view loads.
                  </div>
                </div>
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.collapseSourceCategoriesOnStartup ?? false}
                onChange={(e) => onSettingsChange({ ...settings, collapseSourceCategoriesOnStartup: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Autohide Overlay Timer */}
          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Autohide Overlay Timer (seconds)
                <div className="epg-tooltip">
                  <span className="epg-tooltip-icon">?</span>
                  <div className="epg-tooltip-content">
                    How long to wait before automatically hiding the UI controls and overlay when inactive.
                  </div>
                </div>
              </span>
            </div>
            <input
              type="number"
              min="1"
              max="60"
              value={settings.overlayAutohideTimer ?? 3}
              onChange={(e) => onSettingsChange({ ...settings, overlayAutohideTimer: parseInt(e.target.value) || 3 })}
              className="query-input"
              style={{ width: '80px', textAlign: 'center' }}
            />
          </div>
        </div>
      </div>

      {/* Window Settings Section */}
      <div className="settings-section" style={{ paddingTop: '8px' }}>
        <div className="section-header">
          <h3>Window Settings</h3>
        </div>

        <p className="section-description" style={{ marginBottom: '12px' }}>
          Set the default window size when the application starts.
        </p>

        <WindowSizeSettings
          width={settings.startupWidth || 1920}
          height={settings.startupHeight || 1080}
          onChange={(w, h) => onSettingsChange({ ...settings, startupWidth: w, startupHeight: h })}
        />

        {/* Don't Save Window Size on Close */}
        <div style={{ marginTop: '1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 0',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem' }}>
                Do not save size on close
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                When enabled, the window size will not be saved when closing. The app will always launch with the dimensions set above.
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.dontSaveWindowSizeOnClose ?? false}
              onChange={(e) => onSettingsChange({ ...settings, dontSaveWindowSizeOnClose: e.target.checked })}
              style={{ cursor: 'pointer', marginLeft: '1rem' }}
            />
          </div>
        </div>
      </div>

    </div>
  );
}

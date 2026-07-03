import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAppSettings } from '../../hooks/useAppSettings';
import './SourcesTab.css'; // Import shared tooltip styles

interface UITabProps {
  settings: {
    startupWidth?: number;
    startupHeight?: number;
    dontSaveWindowSizeOnClose?: boolean;
    modernUiEnabled?: boolean | string;
    collapseSourceCategoriesOnStartup?: boolean;
    overlayAutohideTimer?: number;
    uiScale?: number;
  };
  onSettingsChange: (settings: {
    startupWidth?: number;
    startupHeight?: number;
    dontSaveWindowSizeOnClose?: boolean;
    modernUiEnabled?: boolean | string;
    collapseSourceCategoriesOnStartup?: boolean;
    overlayAutohideTimer?: number;
    uiScale?: number;
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
  const {
    appFontFamily,
    appCustomFontBase64,
    appCustomFontFormat,
    appCustomFontName,
    updateAppFont
  } = useAppSettings();

  const [localScale, setLocalScale] = useState(settings.uiScale ?? 100);
  const [scaleStatus, setScaleStatus] = useState<'' | 'applied'>('');

  // Keep localScale in sync if setting changes externally
  useEffect(() => {
    setLocalScale(settings.uiScale ?? 100);
  }, [settings.uiScale]);

  const handleApplyScale = () => {
    onSettingsChange({ ...settings, uiScale: localScale });
    setScaleStatus('applied');
    setTimeout(() => setScaleStatus(''), 2000);
  };

  return (
    <div className="settings-tab-content">
      {/* Modern UI Section */}
      <div className="settings-section" style={{ paddingTop: '8px' }}>
        <div className="timeshift-settings">
          <div className="timeshift-toggle-row" style={{ position: 'relative' }}>
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                UI Design
                <div className="epg-tooltip">
                  <span className="epg-tooltip-icon">?</span>
                  <div className="epg-tooltip-content">
                    Choose the design layout: V1 (Classic), V2 (Modern), or V3 (with dynamic blurred backgrounds).
                  </div>
                </div>
              </span>
            </div>
            <select
              value={
                settings.modernUiEnabled === false || settings.modernUiEnabled === 'v1'
                  ? 'v1'
                  : settings.modernUiEnabled === 'v3'
                  ? 'v3'
                  : 'v2'
              }
              onChange={(e) => onSettingsChange({ ...settings, modernUiEnabled: e.target.value })}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: 'var(--bg-tertiary, #1f1f2e)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                borderRadius: '6px',
                color: 'var(--text-primary, #ffffff)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                minWidth: '130px',
                outline: 'none'
              }}
            >
              <option value="v1" style={{ backgroundColor: '#1f1f2e' }}>v1 (Classic)</option>
              <option value="v2" style={{ backgroundColor: '#1f1f2e' }}>v2 (Modern)</option>
              <option value="v3" style={{ backgroundColor: '#1f1f2e' }}>v3</option>
            </select>
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

          {/* Application UI Scale */}
          <div className="timeshift-toggle-row" style={{ alignItems: 'flex-start', gap: '1rem' }}>
            <div className="timeshift-toggle-info" style={{ flex: 1 }}>
              <span className="timeshift-toggle-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Application UI Scale
                <div className="epg-tooltip">
                  <span className="epg-tooltip-icon">?</span>
                  <div className="epg-tooltip-content">
                    Adjust the overall scale of the application interface. Helpful for fitting more content on lower resolution displays (e.g., 80% or 90%) or making elements larger on high DPI displays.
                  </div>
                </div>
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '220px', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="range"
                  min="70"
                  max="150"
                  step="5"
                  value={localScale}
                  onChange={(e) => setLocalScale(parseInt(e.target.value) || 100)}
                  style={{ flex: 1, cursor: 'pointer' }}
                />
                <span style={{ minWidth: '3.5rem', textAlign: 'right', color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem' }}>
                  {localScale}%
                </span>
              </div>
              <button
                className="sync-btn"
                onClick={handleApplyScale}
                style={{
                  padding: '0.4rem 1.25rem',
                  background: '#00d4ff',
                  color: 'black',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  alignSelf: 'flex-end',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {scaleStatus === 'applied' ? 'Applied!' : 'Apply Scale'}
              </button>
            </div>
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

      {/* Typography & Fonts Section */}
      <div className="settings-section" style={{ paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '20px' }}>
        <div className="section-header">
          <h3>Typography & Fonts</h3>
        </div>

        <p className="section-description" style={{ marginBottom: '16px' }}>
          Customize the global typography and select the font family used across the application.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
              App Font Family
            </label>
            <select
              value={appFontFamily}
              onChange={(e) => updateAppFont(e.target.value, appCustomFontBase64, appCustomFontFormat, appCustomFontName)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: 'white',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer',
                width: '100%',
                height: '36px'
              }}
            >
              <option value="inter" style={{ background: '#1c1c1e', color: 'white' }}>Inter (Default)</option>
              <option value="switzer" style={{ background: '#1c1c1e', color: 'white' }}>Switzer (Sans-Serif)</option>
              <option value="cabinet-grotesk" style={{ background: '#1c1c1e', color: 'white' }}>Cabinet Grotesk (Display Sans)</option>
              <option value="fraunces" style={{ background: '#1c1c1e', color: 'white' }}>Fraunces (Serif)</option>
              <option value="sentient" style={{ background: '#1c1c1e', color: 'white' }}>Sentient (Serif)</option>
              <option value="custom" style={{ background: '#1c1c1e', color: 'white' }}>Custom Uploaded Font...</option>
            </select>
          </div>

          {/* Custom Font Upload UI */}
          {appFontFamily === 'custom' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: 'rgba(255,255,255,0.01)',
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: '6px',
              padding: '12px'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', lineHeight: '1.4' }}>
                Upload a TTF, OTF, WOFF, or WOFF2 font file. It will be loaded and persisted locally in your app settings.
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => document.getElementById('ui-font-uploader')?.click()}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    height: '32px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                >
                  Choose Font File
                </button>
                <input
                  id="ui-font-uploader"
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        let format = 'woff2';
                        if (file.name.endsWith('.ttf')) format = 'truetype';
                        else if (file.name.endsWith('.otf')) format = 'opentype';
                        else if (file.name.endsWith('.woff')) format = 'woff';
                        
                        updateAppFont('custom', base64, format, file.name);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                
                {appCustomFontName && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary, #00d4ff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }} title={appCustomFontName}>
                    {appCustomFontName}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

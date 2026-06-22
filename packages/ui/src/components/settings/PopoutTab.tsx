import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as dialog from '@tauri-apps/plugin-dialog';
import './PlaybackTab.css';

interface PopoutTabProps {
  popoutStopMain: boolean;
  onPopoutStopMainChange: (stop: boolean) => void;
  popoutAlwaysOnTop: boolean;
  onPopoutAlwaysOnTopChange: (onTop: boolean) => void;
  popoutMpvParamsEnabled: boolean;
  onPopoutMpvParamsEnabledChange: (enabled: boolean) => void;
  popoutMpvParams: string;
  onPopoutMpvParamsChange: (params: string) => void;
  externalPlayerPath: string;
  onExternalPlayerPathChange: (path: string) => void;
  externalPlayerReuse: boolean;
  onExternalPlayerReuseChange: (reuse: boolean) => void;
  mpvDisableWhitelist: boolean;
  onMpvDisableWhitelistChange: (disabled: boolean) => Promise<void>;
}

export function PopoutTab({
  popoutStopMain,
  onPopoutStopMainChange,
  popoutAlwaysOnTop,
  onPopoutAlwaysOnTopChange,
  popoutMpvParamsEnabled,
  onPopoutMpvParamsEnabledChange,
  popoutMpvParams,
  onPopoutMpvParamsChange,
  externalPlayerPath,
  onExternalPlayerPathChange,
  externalPlayerReuse,
  onExternalPlayerReuseChange,
  mpvDisableWhitelist,
  onMpvDisableWhitelistChange,
}: PopoutTabProps) {
  const [localParams, setLocalParams] = useState(popoutMpvParams);
  const [hasChanges, setHasChanges] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  useEffect(() => {
    setLocalParams(popoutMpvParams);
    setHasChanges(false);
  }, [popoutMpvParams]);

  const handleParamsChange = (value: string) => {
    setLocalParams(value);
    setHasChanges(value !== popoutMpvParams);
  };

  const handleSave = () => {
    onPopoutMpvParamsChange(localParams.trim());
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalParams('');
    onPopoutMpvParamsChange('');
    setHasChanges(false);
  };

  const checkPopoutParams = async () => {
    try {
      const result = await invoke('popout_get_params_debug') as Record<string, unknown>;
      setDebugInfo(JSON.stringify(result, null, 2));
    } catch (e) {
      setDebugInfo(`Error: ${e}`);
    }
  };

  return (
    <div className="settings-tab-content">
      {/* External Player Section */}
      <div className="settings-section" style={{ paddingTop: '8px' }}>
        <div className="section-header">
          <h3>External Player</h3>
        </div>
        <p className="section-description">
          Configure an external media player (e.g. mpv, VLC) to stream channels directly.
          When the EPG popout mode is set to "External", clicking any channel will send its
          stream to the configured player.
        </p>

        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem' }}>
              Player Executable Path
            </label>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginBottom: '4px' }}>
              Full path to your player executable (e.g. C:\Program Files\mpv\mpv.exe or C:\Program Files\VideoLAN\VLC\vlc.exe).
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={externalPlayerPath}
                onChange={(e) => onExternalPlayerPathChange(e.target.value)}
                placeholder="C:\Program Files\mpv\mpv.exe"
                className="query-input"
                style={{ flex: 1 }}
              />
              <button
                className="sync-btn"
                onClick={async () => {
                  const selected = await dialog.open({
                    multiple: false,
                    filters: [{ name: 'Executable', extensions: ['exe', 'cmd', 'bat'] }]
                  });
                  if (selected) {
                    onExternalPlayerPathChange(selected as string);
                  }
                }}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                Browse
              </button>
            </div>
          </div>

          <div className="timeshift-toggle-row" style={{ marginTop: '16px' }}>
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Reuse same player instance</span>
              <span className="timeshift-toggle-sub">
                When enabled, switching channels will close the previous player before opening a new one,
                instead of spawning multiple player windows.
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={externalPlayerReuse}
                onChange={(e) => onExternalPlayerReuseChange(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0 0 8px 0' }} />

      {/* Popout Player Section */}
      <div className="settings-section" style={{ paddingTop: '8px' }}>
        <div className="section-header">
          <h3>Popout Player</h3>
        </div>
        <p className="section-description">
          Control how the standalone popout MPV player behaves when activated.
        </p>

        <div className="timeshift-settings">
          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Stop main player when popout opens</span>
              <span className="timeshift-toggle-sub">
                When enabled, the embedded player in the main window will stop when a popout is opened.
                Disable this to keep both playing simultaneously.
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={popoutStopMain}
                onChange={(e) => onPopoutStopMainChange(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Always on top</span>
              <span className="timeshift-toggle-sub">
                Keep the popout window above all other windows. Useful for watching while browsing.
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={popoutAlwaysOnTop}
                onChange={(e) => onPopoutAlwaysOnTopChange(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Disable Parameter Whitelist</span>
              <span className="timeshift-toggle-sub">
                Allows any MPV parameter to be passed, including potentially unsafe ones. Use with caution.
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={mpvDisableWhitelist}
                onChange={(e) => onMpvDisableWhitelistChange(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="timeshift-toggle-row" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Enable additional MPV parameters</span>
              <span className="timeshift-toggle-sub">
                Pass custom command-line arguments to the popout MPV instance.
                These are applied each time a new popout is opened.
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={popoutMpvParamsEnabled}
                onChange={(e) => onPopoutMpvParamsEnabledChange(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {popoutMpvParamsEnabled && (
            <div style={{ marginTop: '12px' }}>
              <div className="playback-section">
                <div className="playback-label">
                  <span>Additional MPV Parameters</span>
                  <small>
                    One parameter per line. These flags are passed to the popout MPV on startup.
                  </small>
                </div>

                <textarea
                  className="mpv-params-input"
                  value={localParams}
                  onChange={(e) => handleParamsChange(e.target.value)}
                  placeholder="--hwdec=auto&#10;--cache=yes&#10;--network-timeout=10"
                  rows={8}
                  spellCheck={false}
                />

                <div className="playback-actions">
                  <button
                    className="save-btn"
                    onClick={handleSave}
                    disabled={!hasChanges}
                  >
                    {hasChanges ? 'Save Changes' : 'Saved'}
                  </button>
                  <button className="clear-btn" onClick={handleReset}>
                    Clear All
                  </button>
                </div>

                <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                  <button
                    className="sync-btn"
                    onClick={checkPopoutParams}
                    style={{ maxWidth: '260px' }}
                  >
                    Check Loaded Popout Parameters
                  </button>
                  {debugInfo && (
                    <pre style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      maxHeight: '300px',
                      color: 'rgba(255,255,255,0.8)'
                    }}>
                      {debugInfo}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
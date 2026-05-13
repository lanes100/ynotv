import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './PlaybackTab.css'; // Reuse existing tab styles

interface PopoutTabProps {
  popoutStopMain: boolean;
  onPopoutStopMainChange: (stop: boolean) => void;
  popoutAlwaysOnTop: boolean;
  onPopoutAlwaysOnTopChange: (onTop: boolean) => void;
  popoutMpvParamsEnabled: boolean;
  onPopoutMpvParamsEnabledChange: (enabled: boolean) => void;
  popoutMpvParams: string;
  onPopoutMpvParamsChange: (params: string) => void;
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
    <div className="playback-tab-content" style={{ overflow: 'auto', height: '100%' }}>
      <div className="settings-section">
        <h3 className="settings-section-title">Popout Player</h3>
        <p className="settings-section-description">
          Control how the standalone popout MPV player behaves when activated.
        </p>

        <div className="timeshift-settings" style={{ marginTop: '16px' }}>
          {/* Stop main player */}
          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Stop main player when popout opens</span>
              <span className="timeshift-toggle-sub">
                When enabled, the embedded player in the main window will stop when a popout is opened.
                Disable this to keep both playing simultaneously (like multiview in separate windows).
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

          {/* Always on top */}
          <div className="timeshift-toggle-row" style={{ marginTop: '12px' }}>
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

          {/* Enable custom MPV parameters */}
          <div className="timeshift-toggle-row" style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
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

          {/* Custom params textarea */}
          {popoutMpvParamsEnabled && (
            <div style={{ marginTop: '12px' }}>
              <div className="playback-section">
                <div className="playback-label">
                  <span>Additional MPV Parameters</span>
                  <small>
                    One parameter per line. These flags are passed to the popout MPV on startup.
                    <br />
                    Example: --hwdec=auto --cache=yes --network-timeout=10
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

                <div className="playback-help">
                  <h4>Common Parameters</h4>
                  <div className="help-grid">
                    <div className="help-item">
                      <code>--hwdec=auto</code>
                      <span>Enable hardware decoding</span>
                    </div>
                    <div className="help-item">
                      <code>--cache=yes</code>
                      <span>Enable stream caching</span>
                    </div>
                    <div className="help-item">
                      <code>--network-timeout=10</code>
                      <span>Network timeout in seconds</span>
                    </div>
                    <div className="help-item">
                      <code>--video-sync=display-resample</code>
                      <span>Smooth video playback</span>
                    </div>
                    <div className="help-item">
                      <code>--demuxer-max-bytes=50MiB</code>
                      <span>Maximum cache size</span>
                    </div>
                    <div className="help-item">
                      <code>--stream-lavf-o=reconnect=1</code>
                      <span>Auto-reconnect on disconnect</span>
                    </div>
                  </div>
                </div>

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

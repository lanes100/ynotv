import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import '../Modal.css';
import './PlaybackTab.css';
import { PopoutTab } from './PopoutTab';
import { SkipIntroTab } from './SkipIntroTab';

interface PlaybackTabProps {
  mpvParams: string;
  mpvDisableWhitelist: boolean;
  onMpvParamsChange: (params: string) => Promise<void>;
  onMpvDisableWhitelistChange: (disabled: boolean) => Promise<void>;
  streamWatchdogSeconds: number;
  streamMaxRetries: number;
  onStreamWatchdogSecondsChange: (seconds: number) => Promise<void>;
  onStreamMaxRetriesChange: (retries: number) => Promise<void>;
  castEnabled?: boolean;
  onCastEnabledChange?: (enabled: boolean) => Promise<void>;
  castRewriteTs?: boolean;
  onCastRewriteTsChange?: (enabled: boolean) => Promise<void>;
  useEventBasedReconnect: boolean;
  onUseEventBasedReconnectChange: (enabled: boolean) => Promise<void>;
  stallDetectionEnabled: boolean;
  onStallDetectionEnabledChange: (enabled: boolean) => Promise<void>;
  // Popout Player props
  popoutStopMain: boolean;
  onPopoutStopMainChange: (stop: boolean) => void;
  popoutAlwaysOnTop: boolean;
  onPopoutAlwaysOnTopChange: (onTop: boolean) => void;
  popoutMpvParamsEnabled: boolean;
  onPopoutMpvParamsEnabledChange: (enabled: boolean) => void;
  popoutMpvParams: string;
  onPopoutMpvParamsChange: (params: string) => void;
  // External Player props
  externalPlayerPath: string;
  onExternalPlayerPathChange: (path: string) => void;
  externalPlayerReuse: boolean;
  onExternalPlayerReuseChange: (reuse: boolean) => void;
  // Skip Intro props
  skipIntroTimerSeconds: number;
  onSkipIntroTimerSecondsChange: (seconds: number) => void;
  skipIntroAutoSkip: boolean;
  onSkipIntroAutoSkipChange: (auto: boolean) => void;
}

const DEFAULT_MPV_PARAMS = `--hwdec=auto
--vo=gpu
--cache=yes
--demuxer-max-bytes=50MiB
--network-timeout=10
--video-sync=display-resample
--audio-stream-silence=yes
--stream-lavf-o=reconnect=1
--stream-lavf-o=reconnect_streamed=1
--stream-lavf-o=reconnect_delay_max=5`;

export function PlaybackTab({
  mpvParams,
  mpvDisableWhitelist,
  onMpvParamsChange,
  onMpvDisableWhitelistChange,
  streamWatchdogSeconds,
  streamMaxRetries,
  onStreamWatchdogSecondsChange,
  onStreamMaxRetriesChange,
  castEnabled,
  onCastEnabledChange,
  castRewriteTs,
  onCastRewriteTsChange,
  useEventBasedReconnect,
  onUseEventBasedReconnectChange,
  stallDetectionEnabled,
  onStallDetectionEnabledChange,
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
  skipIntroTimerSeconds,
  onSkipIntroTimerSecondsChange,
  skipIntroAutoSkip,
  onSkipIntroAutoSkipChange,
}: PlaybackTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'mpv' | 'reconnect' | 'cast' | 'popout' | 'skipintro'>('mpv');
  const [localParams, setLocalParams] = useState(mpvParams);
  const [hasChanges, setHasChanges] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [showRestartModal, setShowRestartModal] = useState(false);

  // Local state for retry settings (committed on blur / enter)
  const [localWatchdog, setLocalWatchdog] = useState(String(streamWatchdogSeconds));
  const [localMaxRetries, setLocalMaxRetries] = useState(String(streamMaxRetries));
  const [localUseEventBased, setLocalUseEventBased] = useState(useEventBasedReconnect);
  const [localStallDetection, setLocalStallDetection] = useState(stallDetectionEnabled);

  // Sync if parent value changes (e.g. loaded from storage after mount)
  useEffect(() => { setLocalWatchdog(String(streamWatchdogSeconds)); }, [streamWatchdogSeconds]);
  useEffect(() => { setLocalMaxRetries(String(streamMaxRetries)); }, [streamMaxRetries]);
  useEffect(() => { setLocalUseEventBased(useEventBasedReconnect); }, [useEventBasedReconnect]);
  useEffect(() => { setLocalStallDetection(stallDetectionEnabled); }, [stallDetectionEnabled]);

  useEffect(() => {
    setLocalParams(mpvParams);
  }, [mpvParams]);

  const handleChange = (value: string) => {
    setLocalParams(value);
    setHasChanges(value !== mpvParams);
  };

  const handleSave = () => {
    setShowRestartModal(true);
  };

  const confirmSaveWithRestart = async () => {
    await onMpvParamsChange(localParams.trim());
    setHasChanges(false);
    setShowRestartModal(false);
    try {
      await relaunch();
    } catch (e) {
      console.error('[PlaybackTab] Failed to relaunch:', e);
    }
  };

  const confirmSaveWithoutRestart = async () => {
    await onMpvParamsChange(localParams.trim());
    setHasChanges(false);
    setShowRestartModal(false);
  };

  const handleReset = async () => {
    if (confirm('Reset to recommended default parameters?')) {
      setLocalParams(DEFAULT_MPV_PARAMS);
      await onMpvParamsChange(DEFAULT_MPV_PARAMS);
      setHasChanges(false);
    }
  };

  const handleClear = async () => {
    if (confirm('Clear all custom parameters?')) {
      setLocalParams('');
      await onMpvParamsChange('');
      setHasChanges(false);
    }
  };

  const checkMpvParams = async () => {
    try {
      const result = await invoke('mpv_get_params_debug') as Record<string, unknown>;
      setDebugInfo(JSON.stringify(result, null, 2));
    } catch (e) {
      setDebugInfo(`Error: ${e}`);
    }
  };

  return (
    <div className="playback-tab-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="settings-tabs" style={{ padding: '0 20px', flexShrink: 0 }}>
        <button
          className={`settings-tab ${activeSubTab === 'mpv' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('mpv')}
        >
          MPV Parameters
        </button>
        <button
          className={`settings-tab ${activeSubTab === 'reconnect' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('reconnect')}
        >
          Reconnect
        </button>
        <button
          className={`settings-tab ${activeSubTab === 'cast' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('cast')}
        >
          Google Cast
        </button>
        <button
          className={`settings-tab ${activeSubTab === 'popout' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('popout')}
        >
          External/Popout Player
        </button>
        <button
          className={`settings-tab ${activeSubTab === 'skipintro' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('skipintro')}
        >
          Skip Intro
        </button>
      </div>

      <div className="settings-tab-content">
        {activeSubTab === 'mpv' && (
          <div className="settings-section">
            <div className="section-header">
              <h3>Playback Settings</h3>
            </div>
            <p className="section-description">
              Configure MPV player parameters for stream playback. Changes take effect on next channel load.
            </p>

            <div className="playback-section">
              <div className="playback-label">
                <span>MPV Parameters</span>
                <small>
                  One parameter per line. These flags are passed to MPV on startup.
                  <br />
                  Example: --hwdec=auto --cache=yes --network-timeout=10
                </small>
              </div>

              <textarea
                className="mpv-params-input"
                value={localParams}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="--hwdec=auto&#10;--cache=yes&#10;--network-timeout=10"
                rows={12}
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
                <button className="reset-btn" onClick={handleReset}>
                  Reset to Defaults
                </button>
                <button className="clear-btn" onClick={handleClear}>
                  Clear All
                </button>
              </div>

              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="timeshift-toggle-row" style={{ marginBottom: '12px' }}>
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
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>

              <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                <button
                  className="sync-btn"
                  onClick={checkMpvParams}
                  style={{ maxWidth: '220px' }}
                >
                  Check Loaded MPV Parameters
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

        {activeSubTab === 'reconnect' && (
          <div className="settings-section">
            <div className="playback-section" style={{ marginTop: 0 }}>

              {/* Event-based reconnect toggle */}
              <div className="timeshift-toggle-row" style={{ marginBottom: '12px' }}>
                <div className="timeshift-toggle-info">
                  <span className="timeshift-toggle-label">Event-Based Reconnect</span>
                  <span className="timeshift-toggle-sub">
                    React immediately to stream errors (EOF, HTTP errors, MPV crashes). Disable if you experience
                    overly aggressive reconnects on slow or unstable sources — the watchdog will still detect
                    dead streams based on playback progress.
                  </span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={localUseEventBased}
                    onChange={(e) => {
                      setLocalUseEventBased(e.target.checked);
                      onUseEventBasedReconnectChange(e.target.checked);
                    }}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* Stall detection toggle */}
              <div className="timeshift-toggle-row" style={{ marginBottom: '12px' }}>
                <div className="timeshift-toggle-info">
                  <span className="timeshift-toggle-label">Stall Detection (Watchdog)</span>
                  <span className="timeshift-toggle-sub">
                    Periodically poll MPV to detect stalled or frozen streams based on playback progress.
                    Disable if you prefer only event-based detection, or if the watchdog causes false
                    reconnects on slow streams.
                  </span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={localStallDetection}
                    onChange={(e) => {
                      setLocalStallDetection(e.target.checked);
                      onStallDetectionEnabledChange(e.target.checked);
                    }}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* Watchdog timeout */}
              <div className="retry-setting-row">
                <div className="timeshift-toggle-info">
                  <span className="timeshift-toggle-label">Stall Detection Timeout</span>
                  <span className="timeshift-toggle-sub">
                    Seconds of no position change before a stream is considered stalled. Lower values react faster but may false-trigger on slow servers.
                  </span>
                </div>
                <div className="retry-input-wrapper">
                  <input
                    id="stream-watchdog-seconds"
                    type="number"
                    min={3}
                    max={60}
                    step={1}
                    className="retry-number-input"
                    value={localWatchdog}
                    onChange={(e) => setLocalWatchdog(e.target.value)}
                    onBlur={() => {
                      const n = Math.max(3, Math.min(60, parseInt(localWatchdog, 10) || 10));
                      setLocalWatchdog(String(n));
                      onStreamWatchdogSecondsChange(n);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <span className="retry-input-unit">sec</span>
                </div>
              </div>

              {/* Warning for low values */}
              {parseInt(localWatchdog, 10) < 8 && (
                <div className="retry-warning">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>
                    Values below 8s may cause false retries on slow IPTV servers or streams that take time to buffer. If you notice unexpected reconnects on healthy streams, increase this value.
                  </span>
                </div>
              )}

              {/* Max retries */}
              <div className="retry-setting-row" style={{ marginTop: '16px' }}>
                <div className="timeshift-toggle-info">
                  <span className="timeshift-toggle-label">Max Retry Attempts</span>
                  <span className="timeshift-toggle-sub">
                    Maximum number of reconnection attempts before giving up and showing a permanent error.
                  </span>
                </div>
                <div className="retry-input-wrapper">
                  <input
                    id="stream-max-retries"
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    className="retry-number-input"
                    value={localMaxRetries}
                    onChange={(e) => setLocalMaxRetries(e.target.value)}
                    onBlur={() => {
                      const n = Math.max(1, Math.min(100, parseInt(localMaxRetries, 10) || 20));
                      setLocalMaxRetries(String(n));
                      onStreamMaxRetriesChange(n);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <span className="retry-input-unit">retries</span>
                </div>
              </div>

            </div>
          </div>
        )}

        {activeSubTab === 'cast' && (
          <div className="settings-section">
            <div className="playback-section" style={{ marginTop: 0 }}>
              <div className="timeshift-toggle-row">
                <div className="timeshift-toggle-info">
                  <span className="timeshift-toggle-label">Enable Google Cast Support</span>
                  <span className="timeshift-toggle-sub">
                    Allows scanning your local network for Chromecast devices. Enabling this will prompt the operating system for local network and firewall permissions.
                  </span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={castEnabled || false}
                    onChange={(e) => onCastEnabledChange?.(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="timeshift-toggle-row" style={{ borderBottom: 'none', marginTop: '12px' }}>
                <div className="timeshift-toggle-info">
                  <span className="timeshift-toggle-label">Rewrite TS to M3U8 for Cast</span>
                  <span className="timeshift-toggle-sub">
                    Automatically rewrite `.ts` stream URLs to HLS `.m3u8` when casting. Turn this on only if your IPTV provider supports HLS at the rewritten URL. Disabling this casts the raw stream as MPEG-TS (`video/mp2t`).
                  </span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={castRewriteTs || false}
                    onChange={(e) => onCastRewriteTsChange?.(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {castEnabled && (
                <div className="retry-warning" style={{ marginTop: '20px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>
                    Google Cast discovery is active. The application will scan the local network for compatible Chromecast devices. Ensure your device is on the same Wi-Fi/local network.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'popout' && (
          <PopoutTab
            popoutStopMain={popoutStopMain}
            onPopoutStopMainChange={onPopoutStopMainChange}
            popoutAlwaysOnTop={popoutAlwaysOnTop}
            onPopoutAlwaysOnTopChange={onPopoutAlwaysOnTopChange}
            popoutMpvParamsEnabled={popoutMpvParamsEnabled}
            onPopoutMpvParamsEnabledChange={onPopoutMpvParamsEnabledChange}
            popoutMpvParams={popoutMpvParams}
            onPopoutMpvParamsChange={onPopoutMpvParamsChange}
            externalPlayerPath={externalPlayerPath}
            onExternalPlayerPathChange={onExternalPlayerPathChange}
            externalPlayerReuse={externalPlayerReuse}
            onExternalPlayerReuseChange={onExternalPlayerReuseChange}
          />
        )}

        {activeSubTab === 'skipintro' && (
          <SkipIntroTab
            skipIntroTimerSeconds={skipIntroTimerSeconds}
            onSkipIntroTimerSecondsChange={onSkipIntroTimerSecondsChange}
            skipIntroAutoSkip={skipIntroAutoSkip}
            onSkipIntroAutoSkipChange={onSkipIntroAutoSkipChange}
          />
        )}
      </div>

      {showRestartModal && (
        <div className="modal-overlay" onClick={() => setShowRestartModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Restart Required</h3>
            </div>
            <div className="modal-body">
              <p className="modal-message">
                For playback settings to take effect, the app needs to restart.
                <br /><br />
                Would you like to restart now?
              </p>
            </div>
            <div className="modal-footer">
              <button className="modal-btn modal-btn-secondary" onClick={confirmSaveWithoutRestart}>
                No, Save Only
              </button>
              <button className="modal-btn modal-btn-primary" onClick={confirmSaveWithRestart}>
                Yes, Restart Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

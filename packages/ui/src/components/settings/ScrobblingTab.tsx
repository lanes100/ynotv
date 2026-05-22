import React, { useState, useEffect, useRef } from 'react';
import { getScrobblerCredentialStatus, scrobbler } from '../../services/scrobbler';
import './PlaybackTab.css'; // Reuse core styles
import './ScrobblingTab.css'; // Premium custom styles

export function ScrobblingTab() {
  // Settings states
  const [traktEnabled, setTraktEnabled] = useState(false);
  const [traktScrobbleEnabled, setTraktScrobbleEnabled] = useState(false);
  const [traktSyncEnabled, setTraktSyncEnabled] = useState(false);
  const [traktLinked, setTraktLinked] = useState(false);

  const [simklEnabled, setSimklEnabled] = useState(false);
  const [simklScrobbleEnabled, setSimklScrobbleEnabled] = useState(false);
  const [simklSyncEnabled, setSimklSyncEnabled] = useState(false);
  const [simklLinked, setSimklLinked] = useState(false);

  const credentialStatus = getScrobblerCredentialStatus();

  // Authentication State Machines
  const [traktAuthState, setTraktAuthState] = useState<'idle' | 'polling' | 'success' | 'error'>('idle');
  const [traktUserCode, setTraktUserCode] = useState('');
  const [traktVerificationUrl, setTraktVerificationUrl] = useState('');
  const [traktExpiresIn, setTraktExpiresIn] = useState(0);

  const [simklAuthState, setSimklAuthState] = useState<'idle' | 'polling' | 'success' | 'error'>('idle');
  const [simklUserCode, setSimklUserCode] = useState('');
  const [simklVerificationUrl, setSimklVerificationUrl] = useState('');
  const [simklExpiresIn, setSimklExpiresIn] = useState(0);

  // Manual Sync states
  // const [isSyncing, setIsSyncing] = useState(false);
  // const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Timers and Polling references
  const traktPollTimer = useRef<any>(null);
  const traktCountdownTimer = useRef<any>(null);
  const simklPollTimer = useRef<any>(null);
  const simklCountdownTimer = useRef<any>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTraktTimers();
      clearSimklTimers();
    };
  }, []);

  const clearTraktTimers = () => {
    if (traktPollTimer.current) clearInterval(traktPollTimer.current);
    if (traktCountdownTimer.current) clearInterval(traktCountdownTimer.current);
  };

  const clearSimklTimers = () => {
    if (simklPollTimer.current) clearInterval(simklPollTimer.current);
    if (simklCountdownTimer.current) clearInterval(simklCountdownTimer.current);
  };

  // Load current settings from storage
  const loadSettings = async () => {
    if (!window.storage) return;
    try {
      const res = await window.storage.getSettings();
      const s = res.data || {};
      
      setTraktEnabled(s.traktEnabled ?? false);
      setTraktScrobbleEnabled(s.traktScrobbleEnabled ?? false);
      setTraktSyncEnabled(s.traktSyncEnabled ?? false);
      setTraktLinked(!!s.traktAccessToken);

      setSimklEnabled(s.simklEnabled ?? false);
      setSimklScrobbleEnabled(s.simklScrobbleEnabled ?? false);
      setSimklSyncEnabled(s.simklSyncEnabled ?? false);
      setSimklLinked(!!s.simklAccessToken);
    } catch (e) {
      console.error('Error loading scrobbler settings:', e);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Update specific setting helper
  const handleSettingUpdate = async (update: any) => {
    if (!window.storage) return;
    try {
      await window.storage.updateSettings(update);
      await loadSettings();
    } catch (e) {
      console.error('Error updating scrobbler settings:', e);
    }
  };

  // Trakt Authorization process
  const startTraktLink = async () => {
    clearTraktTimers();
    setTraktAuthState('idle');
    try {
      const codeData = await scrobbler.generateTraktDeviceCode();
      setTraktUserCode(codeData.user_code);
      setTraktVerificationUrl(codeData.verification_url);
      setTraktExpiresIn(codeData.expires_in);
      setTraktAuthState('polling');

      // 1. Countdown timer
      let timeLeft = codeData.expires_in;
      traktCountdownTimer.current = setInterval(() => {
        timeLeft -= 1;
        setTraktExpiresIn(timeLeft);
        if (timeLeft <= 0) {
          clearTraktTimers();
          setTraktAuthState('error');
        }
      }, 1000);

      // 2. Poll interval
      const intervalSec = codeData.interval || 5;
      traktPollTimer.current = setInterval(async () => {
        try {
          const pollRes = await scrobbler.pollTraktToken(codeData.device_code);
          if (pollRes.success) {
            clearTraktTimers();
            setTraktAuthState('success');
            setTimeout(() => {
              setTraktAuthState('idle');
              loadSettings();
            }, 2000);
          } else if (pollRes.error) {
            clearTraktTimers();
            setTraktAuthState('error');
          }
        } catch (e) {
          console.error('Trakt polling failed:', e);
        }
      }, intervalSec * 1000);

    } catch (e) {
      console.error('Failed to link Trakt:', e);
      setTraktAuthState('error');
    }
  };

  const cancelTraktLink = () => {
    clearTraktTimers();
    setTraktAuthState('idle');
  };

  const handleTraktUnlink = async () => {
    if (confirm('Are you sure you want to disconnect your Trakt account?')) {
      await scrobbler.logoutTrakt();
      loadSettings();
    }
  };

  // [Commented out - Simkl Authorization process]
  /*
  const startSimklLink = async () => {
    clearSimklTimers();
    setSimklAuthState('idle');
    try {
      const codeData = await scrobbler.generateSimklDeviceCode();
      setSimklUserCode(codeData.user_code);
      setSimklVerificationUrl(codeData.verification_url);
      setSimklExpiresIn(codeData.expires_in);
      setSimklAuthState('polling');

      let timeLeft = codeData.expires_in;
      simklCountdownTimer.current = setInterval(() => {
        timeLeft -= 1;
        setSimklExpiresIn(timeLeft);
        if (timeLeft <= 0) {
          clearSimklTimers();
          setSimklAuthState('error');
        }
      }, 1000);

      const intervalSec = codeData.interval || 5;
      simklPollTimer.current = setInterval(async () => {
        try {
          const pollRes = await scrobbler.pollSimklToken(codeData.user_code);
          if (pollRes.success) {
            clearSimklTimers();
            setSimklAuthState('success');
            setTimeout(() => {
              setSimklAuthState('idle');
              loadSettings();
            }, 2000);
          } else if (pollRes.error) {
            clearSimklTimers();
            setSimklAuthState('error');
          }
        } catch (e) {
          console.error('Simkl polling failed:', e);
        }
      }, intervalSec * 1000);

    } catch (e) {
      console.error('Failed to link Simkl:', e);
      setSimklAuthState('error');
    }
  };

  const cancelSimklLink = () => {
    clearSimklTimers();
    setSimklAuthState('idle');
  };

  const handleSimklUnlink = async () => {
    if (confirm('Are you sure you want to disconnect your Simkl account?')) {
      await scrobbler.logoutSimkl();
      loadSettings();
    }
  };
  */

  // [Commented out - Manual trigger Watch Progress Sync]
  /*
  const triggerManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      await scrobbler.syncPlaybackProgress();
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (e) {
      console.error('Manual sync failed:', e);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      setIsSyncing(false);
    }
  };
  */

  // Helper to copy user PIN
  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="scrobble-tab-content">
      {/* [Commented out - Cloud Playback Sync Banner]
      <div className="sync-banner-card glass-panel">
        <div className="sync-banner-info">
          <h3>Cloud Playback Sync</h3>
          <p>
            Seamlessly synchronize your watch progress, history, and watchlist across all your devices using Trakt and Simkl.
            Watch on your phone, TV, or PC, and pick up right where you left off.
          </p>
        </div>
        <button
          className={`manual-sync-btn ${isSyncing ? 'loading' : ''} ${syncStatus === 'success' ? 'success' : ''}`}
          onClick={triggerManualSync}
          disabled={isSyncing || (!traktLinked && !simklLinked)}
        >
          {isSyncing ? (
            <>
              <span className="spinner-icon"></span>
              Syncing Progress...
            </>
          ) : syncStatus === 'success' ? (
            '🎉 Sync Completed!'
          ) : syncStatus === 'error' ? (
            '❌ Sync Failed'
          ) : (
            'Sync All Progress Now'
          )}
        </button>
      </div>
      */}

      {/* Dual Panel Grid */}
      <div className="scrobble-grid">
        {/* Trakt Panel */}
        <div className={`scrobble-card glass-panel ${traktLinked ? 'connected' : ''}`}>
          <div className="card-top">
            <div className="platform-logo trakt">
              <span className="platform-badge">Trakt.tv</span>
            </div>
            <div className={`connection-status ${traktLinked ? 'active' : ''}`}>
              {traktLinked ? 'Connected' : 'Not Connected'}
            </div>
          </div>

          <p className="card-description">
            Scrobble live playback progress, synchronize your global movies/series history, and browse custom Trakt recommendations and lists directly inside Stremio mode.
          </p>

          {!traktLinked ? (
            <div className="auth-box">
              {traktAuthState === 'idle' && (
                <button className="auth-action-btn trakt-btn" onClick={startTraktLink} disabled={!credentialStatus.traktConfigured}>
                  Connect Trakt Account
                </button>
              )}

              {traktAuthState === 'polling' && (
                <div className="pin-poll-box">
                  <div className="pin-title">Enter This Pin Code:</div>
                  <div className="pin-code-container" onClick={() => handleCopyCode(traktUserCode)}>
                    <span className="pin-code-text">{traktUserCode}</span>
                    <span className="copy-label">Click to copy</span>
                  </div>
                  <p className="pin-instructions">
                    Go to <a href={traktVerificationUrl} target="_blank" rel="noreferrer" className="pin-link">{traktVerificationUrl}</a> on any device and authenticate.
                  </p>
                  <div className="pin-expiry-bar">
                    <span className="countdown-label">Waiting for verification... ({Math.floor(traktExpiresIn / 60)}m {traktExpiresIn % 60}s)</span>
                  </div>
                  <button className="cancel-auth-btn" onClick={cancelTraktLink}>
                    Cancel Code Request
                  </button>
                </div>
              )}

              {traktAuthState === 'success' && (
                <div className="auth-state-message success">
                  <span className="status-icon">✓</span>
                  <span>Successfully authenticated!</span>
                </div>
              )}

              {traktAuthState === 'error' && (
                <div className="auth-state-message error">
                  <span className="status-icon">⚠</span>
                  <span>{credentialStatus.traktConfigured ? 'Code expired or request failed.' : 'Trakt credentials were not injected into this build.'}</span>
                  <button className="retry-auth-btn" onClick={startTraktLink}>
                    Try Again
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="settings-controls-box">
              <div className="settings-toggle-row">
                <div className="settings-toggle-info">
                  <span className="toggle-label">Enable Cloud Scrobbling</span>
                  <span className="toggle-sub">Send live updates to Trakt every 30s during playback</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={traktScrobbleEnabled}
                    onChange={(e) => handleSettingUpdate({ traktScrobbleEnabled: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="settings-toggle-row">
                <div className="settings-toggle-info">
                  <span className="toggle-label">Synchronize Pause State</span>
                  <span className="toggle-sub">Fetch active sessions from other devices on startup</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={traktSyncEnabled}
                    onChange={(e) => handleSettingUpdate({ traktSyncEnabled: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <button className="unlink-action-btn" onClick={handleTraktUnlink}>
                Disconnect Trakt Account
              </button>
            </div>
          )}
        </div>

        {/* [Commented out - Simkl Panel]
        <div className={`scrobble-card glass-panel ${simklLinked ? 'connected' : ''}`}>
          <div className="card-top">
            <div className="platform-logo simkl">
              <span className="platform-badge">Simkl.com</span>
            </div>
            <div className={`connection-status ${simklLinked ? 'active' : ''}`}>
              {simklLinked ? 'Connected' : 'Not Connected'}
            </div>
          </div>

          <p className="card-description">
            Track and synchronize your Anime, Movies, and TV Shows library. Automatically scrobble playback to Simkl, keeping your lists and personal watchlist up to date.
          </p>

          {!simklLinked ? (
            <div className="auth-box">
              {simklAuthState === 'idle' && (
                <button className="auth-action-btn simkl-btn" onClick={startSimklLink} disabled={!credentialStatus.simklConfigured}>
                  Connect Simkl Account
                </button>
              )}

              {simklAuthState === 'polling' && (
                <div className="pin-poll-box">
                  <div className="pin-title">Enter This Pin Code:</div>
                  <div className="pin-code-container" onClick={() => handleCopyCode(simklUserCode)}>
                    <span className="pin-code-text">{simklUserCode}</span>
                    <span className="copy-label">Click to copy</span>
                  </div>
                  <p className="pin-instructions">
                    Go to <a href={simklVerificationUrl} target="_blank" rel="noreferrer" className="pin-link">{simklVerificationUrl}</a> on any device and authorize.
                  </p>
                  <div className="pin-expiry-bar">
                    <span className="countdown-label">Waiting for verification... ({Math.floor(simklExpiresIn / 60)}m {simklExpiresIn % 60}s)</span>
                  </div>
                  <button className="cancel-auth-btn" onClick={cancelSimklLink}>
                    Cancel Code Request
                  </button>
                </div>
              )}

              {simklAuthState === 'success' && (
                <div className="auth-state-message success">
                  <span className="status-icon">✓</span>
                  <span>Successfully authenticated!</span>
                </div>
              )}

              {simklAuthState === 'error' && (
                <div className="auth-state-message error">
                  <span className="status-icon">⚠</span>
                  <span>{credentialStatus.simklConfigured ? 'Code expired or request failed.' : 'Simkl credentials were not injected into this build.'}</span>
                  <button className="retry-auth-btn" onClick={startSimklLink}>
                    Try Again
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="settings-controls-box">
              <div className="settings-toggle-row">
                <div className="settings-toggle-info">
                  <span className="toggle-label">Enable Cloud Scrobbling</span>
                  <span className="toggle-sub">Send live updates to Simkl every 30s during playback</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={simklScrobbleEnabled}
                    onChange={(e) => handleSettingUpdate({ simklScrobbleEnabled: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="settings-toggle-row">
                <div className="settings-toggle-info">
                  <span className="toggle-label">Synchronize Pause State</span>
                  <span className="toggle-sub">Fetch active sessions from other devices on startup</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={simklSyncEnabled}
                    onChange={(e) => handleSettingUpdate({ simklSyncEnabled: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <button className="unlink-action-btn" onClick={handleSimklUnlink}>
                Disconnect Simkl Account
              </button>
            </div>
          )}
        </div>
        */}
      </div>


    </div>
  );
}

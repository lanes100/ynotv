import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { getScrobblerCredentialStatus, scrobbler } from '../../services/scrobbler';
import './PlaybackTab.css';

export function ScrobblingTab() {
  const [traktScrobbleEnabled, setTraktScrobbleEnabled] = useState(false);
  const [traktWatchlistEnabled, setTraktWatchlistEnabled] = useState(false);
  const [traktLinked, setTraktLinked] = useState(false);

  const [simklScrobbleEnabled, setSimklScrobbleEnabled] = useState(false);
  const [simklSyncEnabled, setSimklSyncEnabled] = useState(false);
  const [simklLinked, setSimklLinked] = useState(false);

  const credentialStatus = getScrobblerCredentialStatus();

  const [traktAuthState, setTraktAuthState] = useState<'idle' | 'polling' | 'success' | 'error'>('idle');
  const [traktUserCode, setTraktUserCode] = useState('');
  const [traktVerificationUrl, setTraktVerificationUrl] = useState('');
  const [traktExpiresIn, setTraktExpiresIn] = useState(0);

  const [simklAuthState, setSimklAuthState] = useState<'idle' | 'polling' | 'success' | 'error'>('idle');
  const [simklUserCode, setSimklUserCode] = useState('');
  const [simklVerificationUrl, setSimklVerificationUrl] = useState('');
  const [simklExpiresIn, setSimklExpiresIn] = useState(0);

  const traktPollTimer = useRef<any>(null);
  const traktCountdownTimer = useRef<any>(null);
  const simklPollTimer = useRef<any>(null);
  const simklCountdownTimer = useRef<any>(null);

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

  const loadSettings = async () => {
    if (!window.storage) return;
    try {
      const res = await window.storage.getSettings();
      const s = res.data || {};

      setTraktScrobbleEnabled(s.traktScrobbleEnabled ?? false);
      setTraktWatchlistEnabled(s.traktWatchlistEnabled ?? true);
      setTraktLinked(!!s.traktAccessToken);

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

  const handleSettingUpdate = async (update: any) => {
    if (!window.storage) return;
    try {
      await window.storage.updateSettings(update);
      await loadSettings();
    } catch (e) {
      console.error('Error updating scrobbler settings:', e);
    }
  };

  const startTraktLink = async () => {
    clearTraktTimers();
    setTraktAuthState('idle');
    try {
      const codeData = await scrobbler.generateTraktDeviceCode();
      setTraktUserCode(codeData.user_code);
      setTraktVerificationUrl(codeData.verification_url);
      setTraktExpiresIn(codeData.expires_in);
      setTraktAuthState('polling');

      let timeLeft = codeData.expires_in;
      traktCountdownTimer.current = setInterval(() => {
        timeLeft -= 1;
        setTraktExpiresIn(timeLeft);
        if (timeLeft <= 0) {
          clearTraktTimers();
          setTraktAuthState('error');
        }
      }, 1000);

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

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const authContainerStyle: CSSProperties = {
    marginTop: '16px',
    padding: '16px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.06)',
  };

  const pinCodeStyle: React.CSSProperties = {
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '2.2rem',
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: '#fff',
    textAlign: 'center',
    padding: '12px 24px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px dashed rgba(255,255,255,0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '12px',
  };

  return (
    <div className="settings-tab-content">
      <div className="settings-section">
        <div className="section-header">
          <h3>Trakt</h3>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '3px 8px',
            borderRadius: '4px',
            color: traktLinked ? '#2ed573' : 'rgba(255,255,255,0.3)',
            background: traktLinked ? 'rgba(46,213,115,0.1)' : 'rgba(255,255,255,0.03)',
          }}>
            {traktLinked ? 'Connected' : 'Not Connected'}
          </span>
        </div>

        <p className="section-description">
          Scrobble live playback progress, synchronize your global movies/series history, and browse custom Trakt recommendations and lists directly inside Stremio mode.
        </p>

        {!traktLinked ? (
          <div>
            {traktAuthState === 'idle' && (
              <button
                className="sync-btn"
                onClick={startTraktLink}
                disabled={!credentialStatus.traktConfigured}
                style={{ padding: '8px 20px', fontSize: '0.9rem' }}
              >
                Connect Trakt Account
              </button>
            )}

            {traktAuthState === 'polling' && (
              <div style={authContainerStyle}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>
                    Enter This Pin Code:
                  </div>
                  <div style={pinCodeStyle} onClick={() => handleCopyCode(traktUserCode)} title="Click to copy">
                    {traktUserCode}
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', margin: '0 0 12px 0' }}>
                    Go to <a href={traktVerificationUrl} target="_blank" rel="noreferrer" style={{ color: '#00d4ff' }}>{traktVerificationUrl}</a> on any device and authenticate.
                  </p>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginBottom: '14px' }}>
                    Waiting for verification... ({Math.floor(traktExpiresIn / 60)}m {traktExpiresIn % 60}s)
                  </div>
                  <button
                    onClick={cancelTraktLink}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel Code Request
                  </button>
                </div>
              </div>
            )}

            {traktAuthState === 'success' && (
              <div style={{
                ...authContainerStyle,
                background: 'rgba(46,213,115,0.1)',
                borderColor: 'rgba(46,213,115,0.25)',
                color: '#2ed573',
                fontWeight: 600,
                textAlign: 'center',
              }}>
                ✓ Successfully authenticated!
              </div>
            )}

            {traktAuthState === 'error' && (
              <div style={{
                ...authContainerStyle,
                background: 'rgba(255,71,87,0.1)',
                borderColor: 'rgba(255,71,87,0.25)',
                color: '#ff4757',
                textAlign: 'center',
              }}>
                <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                  {credentialStatus.traktConfigured ? 'Code expired or request failed.' : 'Trakt credentials were not injected into this build.'}
                </div>
                <button className="sync-btn" onClick={startTraktLink} style={{ color: '#ff4757', borderColor: 'rgba(255,71,87,0.4)', background: 'rgba(255,71,87,0.15)' }}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="timeshift-toggle-row" style={{ marginBottom: '12px', marginTop: '12px' }}>
              <div className="timeshift-toggle-info">
                <span className="timeshift-toggle-label">Enable Cloud Scrobbling</span>
                <span className="timeshift-toggle-sub">Send live updates to Trakt every 30s during playback</span>
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

            <div className="timeshift-toggle-row" style={{ marginBottom: '16px' }}>
              <div className="timeshift-toggle-info">
                <span className="timeshift-toggle-label">Show Trakt Watchlist in Strem</span>
                <span className="timeshift-toggle-sub">Display your Trakt watchlist as a catalog row on the Stremio home page</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={traktWatchlistEnabled}
                  onChange={(e) => handleSettingUpdate({ traktWatchlistEnabled: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <button className="sync-btn danger" onClick={handleTraktUnlink}>
              Disconnect Trakt Account
            </button>
          </div>
        )}
      </div>

      <p className="settings-disclaimer">
        Scrobbling automatically syncs your watch progress to Trakt. Trakt is a third-party service and is not affiliated with this application.
      </p>
    </div>
  );
}

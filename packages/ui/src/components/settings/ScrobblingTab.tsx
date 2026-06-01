import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { getScrobblerCredentialStatus, scrobbler, TRAKT_CATALOG_DEFINITIONS } from '../../services/scrobbler';
import { useSetTraktCatalogRefreshToken } from '../../stores/uiStore';
import '../Modal.css';
import './PlaybackTab.css';

export function ScrobblingTab() {
  const [traktScrobbleEnabled, setTraktScrobbleEnabled] = useState(false);
  const [traktWatchlistEnabled, setTraktWatchlistEnabled] = useState(false);
  const [traktLinked, setTraktLinked] = useState(false);

  const [simklScrobbleEnabled, setSimklScrobbleEnabled] = useState(false);
  const [simklSyncEnabled, setSimklSyncEnabled] = useState(false);
  const [simklLinked, setSimklLinked] = useState(false);

  const bumpRefreshToken = useSetTraktCatalogRefreshToken();

  const credentialStatus = getScrobblerCredentialStatus();

  const [traktAuthState, setTraktAuthState] = useState<'idle' | 'polling' | 'success' | 'error'>('idle');
  const [traktUserCode, setTraktUserCode] = useState('');
  const [traktVerificationUrl, setTraktVerificationUrl] = useState('');
  const [traktExpiresIn, setTraktExpiresIn] = useState(0);

  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [catalogSettings, setCatalogSettings] = useState<Record<string, boolean>>({});
  const [traktLists, setTraktLists] = useState<{ id: { trakt: number; slug: string }; name: string }[]>([]);
  const [traktEnabledLists, setTraktEnabledLists] = useState<{ id: string; name: string }[]>([]);
  const [listsLoading, setListsLoading] = useState(false);

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

      // Migrate legacy traktWatchlistEnabled to new catalog settings
      if (s.traktCatalogsEnabled === undefined && s.traktWatchlistEnabled !== undefined) {
        const migrated = { watchlist: s.traktWatchlistEnabled !== false };
        setCatalogSettings(migrated);
        window.storage?.updateSettings({ traktCatalogsEnabled: migrated });
      } else {
        setCatalogSettings(s.traktCatalogsEnabled || {});
      }
      setTraktEnabledLists(s.traktEnabledLists || []);

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

  const handleCatalogToggle = async (type: string, enabled: boolean) => {
    const next = { ...catalogSettings, [type]: enabled };
    setCatalogSettings(next);
    await handleSettingUpdate({ traktCatalogsEnabled: next, traktWatchlistEnabled: next['watchlist'] !== false });
    bumpRefreshToken(Date.now());
  };

  const handleListToggle = async (listId: string, listName: string, enabled: boolean) => {
    const next = enabled
      ? [...traktEnabledLists, { id: listId, name: listName }]
      : traktEnabledLists.filter(l => l.id !== listId);
    setTraktEnabledLists(next);
    await handleSettingUpdate({ traktEnabledLists: next });
    bumpRefreshToken(Date.now());
  };

  const loadTraktLists = async () => {
    setListsLoading(true);
    try {
      const lists = await scrobbler.fetchTraktLists();
      setTraktLists(lists);
    } catch (e) {
      console.error('Failed to load Trakt lists:', e);
    }
    setListsLoading(false);
  };

  const openCatalogModal = () => {
    setCatalogModalOpen(true);
  };

  const closeCatalogModal = () => {
    setCatalogModalOpen(false);
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
                  onChange={(e) => {
                    handleSettingUpdate({ traktWatchlistEnabled: e.target.checked });
                    handleCatalogToggle('watchlist', e.target.checked);
                    bumpRefreshToken(Date.now());
                  }}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <button
                className="sync-btn"
                onClick={openCatalogModal}
                style={{ padding: '8px 20px', fontSize: '0.9rem' }}
              >
                Manage Strem Catalogs
              </button>
            </div>

            <button className="sync-btn danger" onClick={handleTraktUnlink}>
              Disconnect Trakt Account
            </button>
          </div>
        )}

        {catalogModalOpen && (
          <div className="modal-overlay" onClick={closeCatalogModal}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header">
                <h3 className="modal-title">Trakt Strem Catalogs</h3>
                <button className="modal-close-btn" onClick={closeCatalogModal}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', paddingBottom: '8px' }}>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                  Toggle which Trakt catalogs appear on your Stremio home page. Each enabled catalog shows as a separate row.
                </p>
                {TRAKT_CATALOG_DEFINITIONS.reduce<{ group: string; items: typeof TRAKT_CATALOG_DEFINITIONS }[]>((acc, def) => {
                  const existing = acc.find(g => g.group === def.group);
                  if (existing) existing.items.push(def);
                  else acc.push({ group: def.group, items: [def] });
                  return acc;
                }, []).map((section) => (
                  <div key={section.group} style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: '8px' }}>
                      {section.group}
                    </div>
                    {section.items.map((def) => {
                      const isOn = catalogSettings[def.type] !== false;
                      return (
                        <div key={def.type} className="timeshift-toggle-row" style={{ padding: '10px 0' }}>
                          <div className="timeshift-toggle-info">
                            <span className="timeshift-toggle-label" style={{ fontSize: '0.9rem' }}>{def.label}</span>
                            <span className="timeshift-toggle-sub">{def.description}</span>
                          </div>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={isOn}
                              onChange={(e) => handleCatalogToggle(def.type, e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Custom Lists Section */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: '8px' }}>
                    Custom Lists
                  </div>
                  <button
                    className="sync-btn"
                    onClick={loadTraktLists}
                    disabled={listsLoading}
                    style={{ padding: '6px 16px', fontSize: '0.85rem', marginBottom: '10px' }}
                  >
                    {listsLoading ? 'Loading...' : 'Load My Lists'}
                  </button>
                  {traktLists.length === 0 && (
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)', margin: '0', lineHeight: '1.5' }}>
                      {listsLoading ? '' : 'Click "Load My Lists" to fetch your Trakt custom lists.'}
                    </p>
                  )}
                  {traktLists.map((list) => {
                    const isOn = traktEnabledLists.some(l => l.id === list.id.slug);
                    return (
                      <div key={list.id.slug} className="timeshift-toggle-row" style={{ padding: '10px 0' }}>
                        <div className="timeshift-toggle-info">
                          <span className="timeshift-toggle-label" style={{ fontSize: '0.9rem' }}>{list.name}</span>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={isOn}
                            onChange={(e) => handleListToggle(list.id.slug, list.name, e.target.checked)}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn modal-btn-primary" onClick={closeCatalogModal}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="settings-disclaimer">
        Scrobbling automatically syncs your watch progress to Trakt. Trakt is a third-party service and is not affiliated with this application.
      </p>
    </div>
  );
}

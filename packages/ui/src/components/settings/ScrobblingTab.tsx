import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { getScrobblerCredentialStatus, scrobbler, TRAKT_CATALOG_DEFINITIONS } from '../../services/scrobbler';
import { useSetTraktCatalogRefreshToken } from '../../stores/uiStore';
import '../Modal.css';
import './PlaybackTab.css';

export function ScrobblingTab() {
  const [traktScrobbleEnabled, setTraktScrobbleEnabled] = useState(false);
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

  const [activeModalType, setActiveModalType] = useState<'strem' | 'nuvio' | null>(null);
  const [catalogSettings, setCatalogSettings] = useState<Record<string, boolean>>({});
  const [catalogOrder, setCatalogOrder] = useState<string[]>([]);
  const [catalogsBeforeAddon, setCatalogsBeforeAddon] = useState(false);
  const [traktEnabledLists, setTraktEnabledLists] = useState<{ id: string; name: string }[]>([]);

  // Nuvio settings
  const [nuvioCatalogSettings, setNuvioCatalogSettings] = useState<Record<string, boolean>>({});
  const [nuvioCatalogOrder, setNuvioCatalogOrder] = useState<string[]>([]);
  const [nuvioCatalogsBeforeAddon, setNuvioCatalogsBeforeAddon] = useState(false);
  const [nuvioTraktEnabledLists, setNuvioTraktEnabledLists] = useState<{ id: string; name: string }[]>([]);

  const [traktLists, setTraktLists] = useState<{ id: { trakt: number; slug: string }; name: string }[]>([]);
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
      setTraktLinked(!!s.traktAccessToken);

      // Migrate legacy traktWatchlistEnabled to new catalog settings
      if (s.traktCatalogsEnabled === undefined && s.traktWatchlistEnabled !== undefined) {
        const migrated = { watchlist: s.traktWatchlistEnabled !== false };
        setCatalogSettings(migrated);
        window.storage?.updateSettings({ traktCatalogsEnabled: migrated });
      } else {
        setCatalogSettings(s.traktCatalogsEnabled || {});
      }
      setCatalogOrder(s.traktCatalogOrder || []);
      setCatalogsBeforeAddon(s.traktCatalogsBeforeAddon ?? false);
      setTraktEnabledLists(s.traktEnabledLists || []);

      // Load Nuvio settings
      setNuvioCatalogSettings(s.traktNuvioCatalogsEnabled || {});
      setNuvioCatalogOrder(s.traktNuvioCatalogOrder || []);
      setNuvioCatalogsBeforeAddon(s.traktNuvioCatalogsBeforeAddon ?? false);
      setNuvioTraktEnabledLists(s.traktNuvioEnabledLists || []);

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
    const isNuvio = activeModalType === 'nuvio';
    const currentSettings = isNuvio ? nuvioCatalogSettings : catalogSettings;
    const currentOrder = isNuvio ? nuvioCatalogOrder : catalogOrder;

    const nextSettings = { ...currentSettings, [type]: enabled };
    let nextOrder = currentOrder;
    if (enabled && !nextOrder.includes(type)) {
      nextOrder = [...nextOrder, type];
    }

    if (isNuvio) {
      setNuvioCatalogSettings(nextSettings);
      setNuvioCatalogOrder(nextOrder);
      await handleSettingUpdate({
        traktNuvioCatalogsEnabled: nextSettings,
        traktNuvioCatalogOrder: nextOrder,
      });
    } else {
      setCatalogSettings(nextSettings);
      setCatalogOrder(nextOrder);
      await handleSettingUpdate({
        traktCatalogsEnabled: nextSettings,
        traktCatalogOrder: nextOrder,
      });
    }
    bumpRefreshToken(Date.now());
  };

  // Build ordered catalog list
  const allEntries: { key: string; label: string; description: string; isEnabled: boolean }[] = [];

  const isNuvio = activeModalType === 'nuvio';
  const currentSettings = isNuvio ? nuvioCatalogSettings : catalogSettings;
  const currentOrder = isNuvio ? nuvioCatalogOrder : catalogOrder;
  const currentEnabledLists = isNuvio ? nuvioTraktEnabledLists : traktEnabledLists;
  const currentBeforeAddon = isNuvio ? nuvioCatalogsBeforeAddon : catalogsBeforeAddon;

  // Built-in catalogs
  for (const def of TRAKT_CATALOG_DEFINITIONS) {
    allEntries.push({
      key: def.type,
      label: def.label,
      description: def.description,
      isEnabled: currentSettings[def.type] === true,
    });
  }

  // Custom lists
  for (const list of traktLists) {
    allEntries.push({
      key: `list-${list.id.slug}`,
      label: list.name,
      description: 'Your custom list',
      isEnabled: currentEnabledLists.some(l => l.id === list.id.slug),
    });
  }

  // Sort: enabled first (in currentOrder sequence), then disabled
  const ordered: typeof allEntries = [];
  const disabled: typeof allEntries = [];

  if (currentOrder.length > 0) {
    for (const key of currentOrder) {
      const entry = allEntries.find(e => e.key === key);
      if (entry && entry.isEnabled) ordered.push(entry);
    }
    for (const entry of allEntries) {
      if (entry.isEnabled && !ordered.find(o => o.key === entry.key)) ordered.push(entry);
      if (!entry.isEnabled) disabled.push(entry);
    }
  } else {
    for (const entry of allEntries) {
      if (entry.isEnabled) ordered.push(entry);
      else disabled.push(entry);
    }
  }

  // Drag-and-drop reordering (pointer events, same pattern as CategoryManager)
  const dragFromIdx = useRef<number | null>(null);
  const dragListRef = useRef<HTMLDivElement>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const getIndexFromClientY = useCallback((clientY: number): number => {
    if (!dragListRef.current) return 0;
    const children = Array.from(dragListRef.current.children) as HTMLElement[];
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return Math.max(0, children.length - 1);
  }, []);

  const handleDragPointerDown = useCallback((e: React.PointerEvent, index: number) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragFromIdx.current = index;
    setDragOverIdx(index);
  }, []);

  const handleDragPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragFromIdx.current === null) return;
    e.preventDefault();
    setDragOverIdx(getIndexFromClientY(e.clientY));
  }, [getIndexFromClientY]);

  const handleDragPointerUp = useCallback(async (e: React.PointerEvent) => {
    if (dragFromIdx.current === null) return;
    const from = dragFromIdx.current;
    const to = getIndexFromClientY(e.clientY);
    dragFromIdx.current = null;
    setDragOverIdx(null);
    if (from === to) return;
    const next = ordered.map(entry => entry.key);
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);

    if (isNuvio) {
      setNuvioCatalogOrder(next);
      await handleSettingUpdate({ traktNuvioCatalogOrder: next });
    } else {
      setCatalogOrder(next);
      await handleSettingUpdate({ traktCatalogOrder: next });
    }
    bumpRefreshToken(Date.now());
  }, [ordered, getIndexFromClientY, handleSettingUpdate, bumpRefreshToken, isNuvio]);

  const handleDragPointerCancel = useCallback(() => {
    dragFromIdx.current = null;
    setDragOverIdx(null);
  }, []);

  const toggleCatalogsBeforeAddon = async (before: boolean) => {
    if (isNuvio) {
      setNuvioCatalogsBeforeAddon(before);
      await handleSettingUpdate({ traktNuvioCatalogsBeforeAddon: before });
    } else {
      setCatalogsBeforeAddon(before);
      await handleSettingUpdate({ traktCatalogsBeforeAddon: before });
    }
    bumpRefreshToken(Date.now());
  };

  const handleListToggle = async (listId: string, listName: string, enabled: boolean) => {
    const key = `list-${listId}`;
    const nextEnabledLists = enabled
      ? [...currentEnabledLists, { id: listId, name: listName }]
      : currentEnabledLists.filter(l => l.id !== listId);

    let nextOrder = currentOrder;
    if (enabled && !nextOrder.includes(key)) {
      nextOrder = [...nextOrder, key];
    }

    if (isNuvio) {
      setNuvioTraktEnabledLists(nextEnabledLists);
      setNuvioCatalogOrder(nextOrder);
      await handleSettingUpdate({
        traktNuvioEnabledLists: nextEnabledLists,
        traktNuvioCatalogOrder: nextOrder,
      });
    } else {
      setTraktEnabledLists(nextEnabledLists);
      setCatalogOrder(nextOrder);
      await handleSettingUpdate({
        traktEnabledLists: nextEnabledLists,
        traktCatalogOrder: nextOrder,
      });
    }
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
    setActiveModalType('strem');
  };

  const openNuvioCatalogModal = () => {
    setActiveModalType('nuvio');
  };

  const closeCatalogModal = () => {
    setActiveModalType(null);
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

            <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="sync-btn"
                onClick={openCatalogModal}
                style={{ padding: '8px 20px', fontSize: '0.9rem' }}
              >
                Manage Strem Catalogs
              </button>
              <button
                className="sync-btn"
                onClick={openNuvioCatalogModal}
                style={{ padding: '8px 20px', fontSize: '0.9rem' }}
              >
                Manage Nuvio Catalogs
              </button>
            </div>

            <button className="sync-btn danger" onClick={handleTraktUnlink}>
              Disconnect Trakt Account
            </button>
          </div>
        )}

        {activeModalType !== null && createPortal(
          <div className="modal-overlay" onClick={closeCatalogModal}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header">
                <h3 className="modal-title">{isNuvio ? 'Trakt Nuvio Catalogs' : 'Trakt Strem Catalogs'}</h3>
                <button className="modal-close-btn" onClick={closeCatalogModal}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="modal-body strem-catalogs-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', paddingBottom: '8px' }}>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                  {isNuvio
                    ? 'Toggle which Trakt catalogs appear on your Nuvio home page. Use the arrows to reorder them.'
                    : 'Toggle which Trakt catalogs appear on your Stremio home page. Use the arrows to reorder them.'}
                </p>

                {/* Position toggle */}
                <div className="timeshift-toggle-row" style={{ padding: '10px 0', marginBottom: '12px' }}>
                  <div className="timeshift-toggle-info">
                    <span className="timeshift-toggle-label" style={{ fontSize: '0.9rem' }}>Show before addon catalogs</span>
                    <span className="timeshift-toggle-sub">Place Trakt catalog rows above addon-provided catalogs</span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={currentBeforeAddon}
                      onChange={(e) => toggleCatalogsBeforeAddon(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {/* Enabled catalogs with reorder */}
                {ordered.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: '8px' }}>
                      Enabled Catalogs
                      <span style={{ marginLeft: '8px', fontWeight: 400, fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)' }}>
                        (drag ⋮⋮ to reorder)
                      </span>
                    </div>
                    <div
                      ref={dragListRef}
                      onPointerMove={handleDragPointerMove}
                      onPointerUp={handleDragPointerUp}
                      onPointerCancel={handleDragPointerCancel}
                      style={{ touchAction: 'none' }}
                    >
                      {ordered.map((entry, idx) => {
                        const isDragging = dragFromIdx.current === idx;
                        const isDragOver = dragOverIdx === idx && dragFromIdx.current !== null && dragFromIdx.current !== idx;
                        return (
                          <div
                            key={entry.key}
                            className="timeshift-toggle-row"
                            style={{
                              padding: '10px 0',
                              opacity: isDragging ? 0.6 : 1,
                              borderTop: isDragOver ? '3px solid #00d4ff' : '1px solid rgba(255,255,255,0.07)',
                              background: isDragging ? 'rgba(0,212,255,0.08)' : 'transparent',
                              transform: isDragging ? 'scale(1.01)' : 'none',
                              transition: 'opacity 0.15s, transform 0.15s',
                            }}
                          >
                            <span
                              style={{
                                touchAction: 'none',
                                cursor: 'grab',
                                userSelect: 'none',
                                color: 'rgba(255,255,255,0.3)',
                                fontSize: '1.1rem',
                                lineHeight: 1,
                                padding: '4px 6px 4px 2px',
                              }}
                              onPointerDown={(e) => handleDragPointerDown(e, idx)}
                            >⋮⋮</span>
                            <div className="timeshift-toggle-info">
                              <span className="timeshift-toggle-label" style={{ fontSize: '0.9rem' }}>{entry.label}</span>
                              <span className="timeshift-toggle-sub">{entry.description}</span>
                            </div>
                            <label className="toggle-switch">
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={(e) => {
                                  if (!e.target.checked) {
                                    if (entry.key.startsWith('list-')) {
                                      const slug = entry.key.slice(5);
                                      handleListToggle(slug, entry.label, false);
                                    } else {
                                      handleCatalogToggle(entry.key, false);
                                    }
                                  }
                                }}
                              />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Disabled catalogs */}
                {disabled.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: '8px' }}>
                      Disabled Catalogs
                    </div>
                    {disabled.map((entry) => (
                      <div key={entry.key} className="timeshift-toggle-row" style={{ padding: '10px 0' }}>
                        <div className="timeshift-toggle-info">
                          <span className="timeshift-toggle-label" style={{ fontSize: '0.9rem' }}>{entry.label}</span>
                          <span className="timeshift-toggle-sub">{entry.description}</span>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (entry.key.startsWith('list-')) {
                                  const slug = entry.key.slice(5);
                                  handleListToggle(slug, entry.label, true);
                                } else {
                                  handleCatalogToggle(entry.key, true);
                                }
                              }
                            }}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {/* Load custom lists button (lists appear in the ordered sections above once loaded) */}
                <div style={{ marginTop: '8px' }}>
                  <button
                    className="sync-btn"
                    onClick={loadTraktLists}
                    disabled={listsLoading}
                    style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                  >
                    {listsLoading ? 'Loading...' : 'Load My Lists'}
                  </button>
                  {traktLists.length === 0 && !listsLoading && (
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)', margin: '8px 0 0 0', lineHeight: '1.5' }}>
                      Click to fetch your Trakt custom lists. Loaded lists appear in the sections above.
                    </p>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn modal-btn-primary" onClick={closeCatalogModal}>
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>

      <p className="settings-disclaimer">
        Scrobbling automatically syncs your watch progress to Trakt. Trakt is a third-party service and is not affiliated with this application.
      </p>
    </div>
  );
}

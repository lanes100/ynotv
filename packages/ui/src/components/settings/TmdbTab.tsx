import { useState, useEffect } from 'react';
import { validateAccessToken } from '../../services/tmdb';
import { validateRpdbApiKey, getRpdbTier, rpdbSupportsBackdrops } from '../../services/rpdb';
import { SERVICES, type StreamingService } from '../../constants/streamingProviders';
import './PlaybackTab.css'; // Reuse existing tab styles

export type MetadataSubTabId = 'tmdb' | 'rpdb';

interface TmdbTabProps {
  initialSubTab?: MetadataSubTabId;
  tmdbApiKey: string;
  tmdbKeyValid: boolean | null;
  onApiKeyChange: (key: string) => void;
  onApiKeyValidChange: (valid: boolean | null) => void;
  rpdbApiKey: string;
  rpdbKeyValid: boolean | null;
  onRpdbApiKeyChange: (key: string) => void;
  onRpdbKeyValidChange: (valid: boolean | null) => void;
  rpdbBackdropsEnabled: boolean;
  onRpdbBackdropsEnabledChange: (enabled: boolean) => void;
  streamingCatalogsEnabled: boolean;
  onStreamingCatalogsEnabledChange: (enabled: boolean) => void;
  streamingNuvioCatalogsEnabled: boolean;
  onStreamingNuvioCatalogsEnabledChange: (enabled: boolean) => void;
  enabledStreamingServices: string[];
  onEnabledStreamingServicesChange: (services: string[]) => void;
}

export function TmdbTab({
  initialSubTab,
  tmdbApiKey,
  tmdbKeyValid,
  onApiKeyChange,
  onApiKeyValidChange,
  rpdbApiKey,
  rpdbKeyValid,
  onRpdbApiKeyChange,
  onRpdbKeyValidChange,
  rpdbBackdropsEnabled,
  onRpdbBackdropsEnabledChange,
  streamingCatalogsEnabled,
  onStreamingCatalogsEnabledChange,
  streamingNuvioCatalogsEnabled,
  onStreamingNuvioCatalogsEnabledChange,
  enabledStreamingServices,
  onEnabledStreamingServicesChange,
}: TmdbTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<MetadataSubTabId>('tmdb');
  const [tmdbValidating, setTmdbValidating] = useState(false);
  const [rpdbValidating, setRpdbValidating] = useState(false);
  const [showTmdbKey, setShowTmdbKey] = useState(false);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const tier = getRpdbTier(rpdbApiKey);
  const supportsBackdrops = rpdbSupportsBackdrops(rpdbApiKey);

  async function saveTmdbApiKey() {
    if (!window.storage) return;
    setTmdbValidating(true);
    onApiKeyValidChange(null);

    // Validate the key first
    const isValid = tmdbApiKey ? await validateAccessToken(tmdbApiKey) : true;
    onApiKeyValidChange(isValid);

    if (isValid) {
      await window.storage.updateSettings({ tmdbApiKey });
      window.dispatchEvent(new CustomEvent('ynotv:tmdb-key-changed'));
    }

    setTmdbValidating(false);
  }

  async function saveRpdbApiKey() {
    if (!window.storage) return;
    setTmdbValidating(true);
    onRpdbKeyValidChange(null);

    // Validate the key first
    const isValid = rpdbApiKey ? await validateRpdbApiKey(rpdbApiKey) : true;
    onRpdbKeyValidChange(isValid);

    if (isValid) {
      await window.storage.updateSettings({ posterDbApiKey: rpdbApiKey });
    }

    setTmdbValidating(false);
  }

  async function handleBackdropsToggle(enabled: boolean) {
    if (!window.storage) return;
    onRpdbBackdropsEnabledChange(enabled);
    await window.storage.updateSettings({ rpdbBackdropsEnabled: enabled });
  }

  return (
    <div className="playback-tab-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="settings-tabs" style={{ padding: '0 20px', flexShrink: 0 }}>
        <button
          className={`settings-tab ${activeSubTab === 'tmdb' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('tmdb')}
        >
          TMDB
        </button>
        <button
          className={`settings-tab ${activeSubTab === 'rpdb' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('rpdb')}
        >
          RPDB
        </button>
      </div>

      <div className="settings-tab-content">
        {activeSubTab === 'tmdb' && (
          <div className="settings-section">
            {/* TMDB Section */}
            <div className="section-header">
              <h3>TMDB Integration</h3>
            </div>

            <p className="section-description">
              For the best experience with ynoTV, a free TMDB key is highly recommended, as it enables full metadata for Movies and Series for VODs, and enhances the Stremio experience. Also unlocks Streaming platform catalogs.
              Use the token labeled "API Read Access Token"{' '}
              <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="tmdb-link">
                from here
              </a>.
            </p>

            <p className="section-description" style={{ marginBottom: '16px' }}>
              Guide on getting a free TMDB API key with video:{' '}
              <a href="https://duckkota.gitlab.io/guides/tmdb/" target="_blank" rel="noopener noreferrer" className="tmdb-link">
                https://duckkota.gitlab.io/guides/tmdb/
              </a>
            </p>

            <div className="tmdb-form">
              <div className="form-group inline">
                <label>Access Token</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                  <input
                    type={showTmdbKey ? 'text' : 'password'}
                    value={tmdbApiKey}
                    onChange={(e) => {
                      onApiKeyChange(e.target.value);
                      onApiKeyValidChange(null);
                    }}
                    placeholder="API Read Access Token"
                    style={{ flex: 1, paddingRight: '36px', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowTmdbKey(!showTmdbKey)}
                    title={showTmdbKey ? 'Hide key' : 'Show key'}
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      transition: 'color 0.2s, background 0.2s',
                      minWidth: 'unset',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    {showTmdbKey ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={saveTmdbApiKey}
                  disabled={tmdbValidating}
                  className={tmdbKeyValid === true ? 'success' : tmdbKeyValid === false ? 'error' : ''}
                >
                  {tmdbValidating ? 'Validating...' : tmdbKeyValid === true ? 'Valid' : tmdbKeyValid === false ? 'Invalid' : 'Save'}
                </button>
              </div>
              <p className="form-hint">
                Get a free account at{' '}
                <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener noreferrer">
                  themoviedb.org
                </a>
              </p>
            </div>

            {/* Streaming Catalogs Section */}
            <div className={`streaming-catalogs-section ${tmdbKeyValid !== true ? 'disabled' : ''}`} style={{ marginTop: '2rem' }}>
              <div className="section-header" style={{ marginBottom: '12px' }}>
                <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
                  Streaming Catalogs
                </h4>
              </div>

              <div className="timeshift-settings" style={{ marginTop: 0 }}>
                <div className="timeshift-toggle-row" style={{ padding: '8px 0', borderBottom: 'none' }}>
                  <div className="timeshift-toggle-info">
                    <span className="timeshift-toggle-label" style={{ color: tmdbKeyValid === true ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>Enable Streaming Catalogs</span>
                    <span className="timeshift-toggle-sub">Show "Streaming Platforms" catalog row on the Stremio Home page.</span>
                  </div>
                  <label className="toggle-switch" style={{ opacity: tmdbKeyValid === true ? 1 : 0.5, cursor: tmdbKeyValid === true ? 'pointer' : 'not-allowed' }}>
                    <input
                      type="checkbox"
                      checked={streamingCatalogsEnabled}
                      disabled={tmdbKeyValid !== true}
                      onChange={(e) => onStreamingCatalogsEnabledChange(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                <div className="timeshift-toggle-row" style={{ padding: '8px 0', borderBottom: 'none', marginTop: '8px' }}>
                  <div className="timeshift-toggle-info">
                    <span className="timeshift-toggle-label" style={{ color: tmdbKeyValid === true ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>Enable Streaming Catalogs in Nuvio</span>
                    <span className="timeshift-toggle-sub">Show "Streaming Platforms" catalog row on the Nuvio Home page.</span>
                  </div>
                  <label className="toggle-switch" style={{ opacity: tmdbKeyValid === true ? 1 : 0.5, cursor: tmdbKeyValid === true ? 'pointer' : 'not-allowed' }}>
                    <input
                      type="checkbox"
                      checked={streamingNuvioCatalogsEnabled}
                      disabled={tmdbKeyValid !== true}
                      onChange={(e) => onStreamingNuvioCatalogsEnabledChange(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>

              {/* Streaming providers checkboxes grid */}
              {(() => {
                const catalogsEnabled = streamingCatalogsEnabled || streamingNuvioCatalogsEnabled;
                return (
                  <div 
                    className="streaming-providers-grid" 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                      gap: '10px', 
                      marginTop: '1.2rem',
                      opacity: (catalogsEnabled && tmdbKeyValid === true) ? 1 : 0.5,
                      pointerEvents: (catalogsEnabled && tmdbKeyValid === true) ? 'auto' : 'none',
                      transition: 'opacity 0.2s ease',
                    }}
                  >
                    {Object.keys(SERVICES).map((svcKey) => {
                      const svc = SERVICES[svcKey as StreamingService];
                      const isEnabled = enabledStreamingServices.includes(svcKey);
                      return (
                        <label 
                          key={svcKey}
                          className={`streaming-provider-card ${isEnabled ? 'checked' : ''}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            background: '#000000',
                            border: isEnabled ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '8px',
                            cursor: (catalogsEnabled && tmdbKeyValid === true) ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onEnabledStreamingServicesChange([...enabledStreamingServices, svcKey]);
                          } else {
                            onEnabledStreamingServicesChange(enabledStreamingServices.filter(k => k !== svcKey));
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      {/* Custom SVG Checkbox indicator */}
                      <div 
                        className="custom-checkbox-indicator"
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '4px',
                          border: isEnabled ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.3)',
                          background: isEnabled ? '#00d4ff' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isEnabled && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" style={{ width: '12px', height: '12px' }}>
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                      {/* Logo Image */}
                      <img 
                        src={svc.logo} 
                        alt={svc.name} 
                        style={{ 
                          height: svc.logoHeightHome ? `${svc.logoHeightHome * 0.75}px` : '18px', 
                          width: 'auto',
                          filter: 'brightness(0) invert(1)',
                          opacity: isEnabled ? 1 : 0.4,
                          transition: 'opacity 0.2s'
                        }} 
                      />
                    </label>
                  );
                })}
              </div>
            );
          })()}

              {tmdbKeyValid !== true && (
                <p className="form-hint" style={{ color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem' }}>
                  Requires a valid TMDB Access Token. Save a valid token above to configure streaming catalogs.
                </p>
              )}
            </div>

            <p className="settings-disclaimer" style={{ marginTop: '2rem' }}>
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </p>
          </div>
        )}

        {activeSubTab === 'rpdb' && (
          <div className="settings-section">
            {/* RPDB Section */}
            <div className="section-header">
              <h3>RatingPosterDB Integration</h3>
              {tier != null && rpdbKeyValid === true && (
                <span className="tier-badge">Tier {tier}</span>
              )}
            </div>

            <p className="section-description">
              RatingPosterDB overlays rating badges (IMDb, Rotten Tomatoes, etc.) on movie
              and series posters. Configure your badge preferences at{' '}
              <a
                href="https://manager.ratingposterdb.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="tmdb-link"
              >
                manager.ratingposterdb.com
              </a>
              .
            </p>

            <div className="tmdb-form">
              <div className="form-group inline">
                <label>API Key</label>
                <input
                  type="password"
                  value={rpdbApiKey}
                  onChange={(e) => {
                    onRpdbApiKeyChange(e.target.value);
                    onRpdbKeyValidChange(null);
                  }}
                  placeholder="Enter your RPDB API key"
                />
                <button
                  type="button"
                  onClick={saveRpdbApiKey}
                  disabled={rpdbValidating}
                  className={rpdbKeyValid === true ? 'success' : rpdbKeyValid === false ? 'error' : ''}
                >
                  {rpdbValidating ? 'Validating...' : rpdbKeyValid === true ? 'Valid' : rpdbKeyValid === false ? 'Invalid' : 'Save'}
                </button>
              </div>
              <p className="form-hint">
                Get an API key by subscribing at{' '}
                <a href="https://ratingposterdb.com/" target="_blank" rel="noopener noreferrer">
                  ratingposterdb.com
                </a>
              </p>
            </div>

            {/* Backdrops option - only show if key is valid */}
            {rpdbKeyValid === true && (
              <div className="tmdb-form" style={{ marginTop: '1.5rem' }}>
                <label
                  className="genre-checkbox"
                  style={{ maxWidth: '280px' }}
                >
                  <input
                    type="checkbox"
                    checked={rpdbBackdropsEnabled && supportsBackdrops}
                    onChange={(e) => handleBackdropsToggle(e.target.checked)}
                    disabled={!supportsBackdrops}
                  />
                  <span className="genre-name">Use RPDB backdrop images</span>
                </label>
                {!supportsBackdrops && (
                  <p className="form-hint" style={{ marginTop: '0.5rem' }}>
                    Backdrops require a Tier 2+ subscription
                  </p>
                )}
              </div>
            )}

            <p className="settings-disclaimer" style={{ marginTop: '2rem' }}>
              RPDB is a third-party service. Visit{' '}
              <a href="https://ratingposterdb.com/" target="_blank" rel="noopener noreferrer" className="tmdb-link">
                ratingposterdb.com
              </a>{' '}
              for pricing and features.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

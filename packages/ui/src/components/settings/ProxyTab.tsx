import { useState } from 'react';
import { relaunch } from '@tauri-apps/plugin-process';
import '../Modal.css';

interface ProxyTabProps {
  socks5ProxyEnabled: boolean;
  onSocks5ProxyEnabledChange: (val: boolean) => void;
  socks5ProxyServer: string;
  onSocks5ProxyServerChange: (val: string) => void;
  socks5ProxyUsername: string;
  onSocks5ProxyUsernameChange: (val: string) => void;
  socks5ProxyPassword: string;
  onSocks5ProxyPasswordChange: (val: string) => void;
}

export function ProxyTab({
  socks5ProxyEnabled,
  onSocks5ProxyEnabledChange,
  socks5ProxyServer,
  onSocks5ProxyServerChange,
  socks5ProxyUsername,
  onSocks5ProxyUsernameChange,
  socks5ProxyPassword,
  onSocks5ProxyPasswordChange,
}: ProxyTabProps) {
  const [enabled, setEnabled] = useState(socks5ProxyEnabled);
  const [server, setServer] = useState(socks5ProxyServer);
  const [username, setUsername] = useState(socks5ProxyUsername);
  const [password, setPassword] = useState(socks5ProxyPassword);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);

  // Diagnostics state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; ip?: string; error?: string } | null>(null);

  const hasUnsavedChanges =
    enabled !== socks5ProxyEnabled ||
    server !== socks5ProxyServer ||
    username !== socks5ProxyUsername ||
    password !== socks5ProxyPassword;

  function handleSaveClick() {
    setShowRestartModal(true);
  }

  async function handleSaveAndRestart() {
    setIsSaving(true);
    setSaveStatus('idle');
    setShowRestartModal(false);
    try {
      onSocks5ProxyEnabledChange(enabled);
      onSocks5ProxyServerChange(server);
      onSocks5ProxyUsernameChange(username);
      onSocks5ProxyPasswordChange(password);

      if (window.storage) {
        await window.storage.updateSettings({
          socks5ProxyEnabled: enabled,
          socks5ProxyServer: server,
          socks5ProxyUsername: username,
          socks5ProxyPassword: password,
        });

        // Notify backend to reload environment variables and apply changes
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('update_proxy_settings');
      }
      setSaveStatus('success');
      
      // Relaunch the application to fully apply proxy variables system-wide
      await relaunch();
    } catch (err) {
      console.error('[ProxyTab] Failed to save and restart:', err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisableAndRestart() {
    setIsSaving(true);
    setShowDisableModal(false);
    try {
      setEnabled(false);
      onSocks5ProxyEnabledChange(false);
      
      if (window.storage) {
        await window.storage.updateSettings({
          socks5ProxyEnabled: false,
        });

        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('update_proxy_settings');
      }
      setSaveStatus('success');
      
      // Relaunch the application to revert settings system-wide
      await relaunch();
    } catch (err) {
      console.error('[ProxyTab] Failed to disable and restart:', err);
      setSaveStatus('error');
      setEnabled(true); // Revert on failure
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const ip = await invoke<string>('test_proxy_connection');
      setTestResult({ success: true, ip });
    } catch (err: any) {
      console.error('[ProxyTab] Proxy test failed:', err);
      setTestResult({ success: false, error: err?.toString() || 'Unknown error occurred' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="settings-tab-content" style={{ overflowY: 'auto', maxHeight: '100%' }}>
      {/* Visual Status Indicator Card */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.25rem',
        borderRadius: '8px',
        backgroundColor: socks5ProxyEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
        border: socks5ProxyEnabled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
        marginBottom: '1.5rem',
        boxShadow: socks5ProxyEnabled ? '0 0 15px rgba(16, 185, 129, 0.1)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
            System Status
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: socks5ProxyEnabled ? '#10b981' : 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {socks5ProxyEnabled ? 'SOCKS5 Proxy is Enabled' : 'SOCKS5 Proxy is Disabled'}
          </div>
          {socks5ProxyEnabled && socks5ProxyServer && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontFamily: 'monospace', opacity: 0.8 }}>
              Server: {socks5ProxyServer}
            </div>
          )}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.85rem',
          color: socks5ProxyEnabled ? '#10b981' : 'var(--text-secondary)',
          fontWeight: 600,
        }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: socks5ProxyEnabled ? '#10b981' : '#6b7280',
            boxShadow: socks5ProxyEnabled ? '0 0 10px #10b981' : 'none',
            transition: 'all 0.3s ease',
          }} />
          {socks5ProxyEnabled ? 'Active' : 'Inactive'}
        </div>
      </div>

      <div className="settings-section">
        <div className="section-header">
          <h3>SOCKS5 Proxy Configuration</h3>
        </div>

        <p className="section-description">
          Route all outgoing application network traffic—including stream feeds, EPG guides, metadata requests, and VOD updates—through a secure SOCKS5 proxy server.
        </p>

        <div className="tmdb-form" style={{ marginTop: '1.5rem' }}>
          {/* Toggle Button */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="genre-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => {
                  const nextVal = e.target.checked;
                  if (!nextVal && socks5ProxyEnabled) {
                    setShowDisableModal(true);
                  } else {
                    setEnabled(nextVal);
                    setSaveStatus('idle');
                  }
                }}
              />
              <span className="genre-name" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                Enable Proxy Routing
              </span>
            </label>
            <p className="form-hint" style={{ marginTop: '0.5rem' }}>
              Toggle the proxy connection. When disabled, traffic flows directly via your default ISP.
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem', opacity: enabled ? 1 : 0.5, transition: 'opacity 0.2s' }}>
            <label>SOCKS5 Proxy Server</label>
            <input
              type="text"
              value={server}
              disabled={!enabled}
              onChange={(e) => {
                setServer(e.target.value);
                setSaveStatus('idle');
              }}
              placeholder="e.g. 127.0.0.1:1080 or socks5h://127.0.0.1:1080"
              style={{ width: '100%' }}
            />
            <p className="form-hint">
              Enter the host/IP and port of your proxy server. Scheme is automatically resolved (defaults to DNS-safe <code>socks5h://</code> to prevent local DNS leaks).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem', opacity: enabled ? 1 : 0.5, transition: 'opacity 0.2s' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Username (Optional)</label>
              <input
                type="text"
                value={username}
                disabled={!enabled}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setSaveStatus('idle');
                }}
                placeholder="Proxy username"
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Password (Optional)</label>
              <input
                type="password"
                value={password}
                disabled={!enabled}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setSaveStatus('idle');
                }}
                placeholder="Proxy password"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="form-group inline" style={{ marginTop: '2rem' }}>
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={isSaving}
              className={saveStatus === 'success' ? 'success' : saveStatus === 'error' ? 'error' : 'save-btn'}
              style={{ minWidth: '180px' }}
            >
              {isSaving ? 'Relaunching...' : saveStatus === 'success' ? 'Applied' : saveStatus === 'error' ? 'Failed to Apply' : 'Save & Apply Proxy'}
            </button>
          </div>
        </div>
      </div>

      {/* Diagnostics / Verification Section */}
      <div className="settings-section" style={{ marginTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
        <div className="section-header">
          <h3>Diagnostics & Connection Test</h3>
        </div>
        <p className="section-description">
          Test connectivity and verify that your public IP matches your proxy server location.
        </p>

        <div style={{ marginTop: '1.25rem' }}>
          {hasUnsavedChanges && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              color: '#f59e0b',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}>
              <span style={{ fontSize: '1.1rem' }}>⚠️</span>
              <span>
                You have unsaved changes. Please save and apply proxy settings before testing.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !socks5ProxyEnabled}
              className="sync-button"
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.85rem',
                opacity: socks5ProxyEnabled ? 1 : 0.5,
                cursor: socks5ProxyEnabled ? 'pointer' : 'not-allowed',
              }}
            >
              {testing ? 'Running test...' : 'Run Connection Test'}
            </button>
            {!socks5ProxyEnabled && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Enable and apply SOCKS5 proxy to enable testing.
              </span>
            )}
          </div>

          {testResult && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              borderRadius: '6px',
              backgroundColor: testResult.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: testResult.success ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
              color: testResult.success ? '#10b981' : '#ef4444',
              fontSize: '0.85rem',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {testResult.success ? (
                  <>
                    <span>✓</span> Connection Test Successful
                  </>
                ) : (
                  <>
                    <span>✗</span> Connection Test Failed
                  </>
                )}
              </div>
              <div style={{ marginTop: '0.5rem', fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                {testResult.success ? (
                  <>
                    Your Egress IP: <strong style={{ color: '#10b981' }}>{testResult.ip}</strong>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem', fontFamily: 'sans-serif' }}>
                      All network requests and playback streams are successfully routing through the proxy.
                    </div>
                  </>
                ) : (
                  <>
                    Error Detail: {testResult.error}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Verification / FAQ Guide */}
      <div className="settings-section" style={{ marginTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
        <div className="section-header">
          <h3>Proxy Verification FAQ</h3>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              How do I confirm the SOCKS5 proxy is routing stream playback?
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              ynoTV spawns MPV player instances with the <code>--http-proxy</code> command-line argument. We default to using the DNS-safe <code>socks5h://</code> scheme, forcing DNS resolution to occur directly at the proxy server and eliminating local DNS leaks.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Do settings apply instantly on saving?
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Yes. Upon clicking <strong>Save & Apply Proxy</strong>, the app prompts you to save settings and restart. Relaunching ensures all network operations and MPV stream playbacks run cleanly with the newly applied variables.
            </p>
          </div>
        </div>
      </div>

      <p className="settings-disclaimer">
        Note: Chromecast devices and local discovery (mDNS) bypass the proxy automatically to maintain normal local network communication.
      </p>

      {showRestartModal && (
        <div className="modal-overlay" onClick={() => setShowRestartModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Restart Required</h3>
            </div>
            <div className="modal-body">
              <p className="modal-message">
                Applying SOCKS5 proxy changes requires the application to restart. This ensures all network services and the video player load correctly with the new proxy configuration.
                <br /><br />
                Would you like to save changes and restart the application now?
              </p>
            </div>
            <div className="modal-footer">
              <button className="modal-btn modal-btn-secondary" onClick={() => setShowRestartModal(false)}>
                Cancel
              </button>
              <button className="modal-btn modal-btn-primary" onClick={handleSaveAndRestart}>
                Yes, Save & Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {showDisableModal && (
        <div className="modal-overlay" onClick={() => {
          setShowDisableModal(false);
          setEnabled(true);
        }}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Restart Required to Disable</h3>
            </div>
            <div className="modal-body">
              <p className="modal-message">
                Disabling SOCKS5 proxy routing requires the application to restart so all network components and the player revert to direct routing.
                <br /><br />
                Would you like to disable the proxy and restart the application now?
              </p>
            </div>
            <div className="modal-footer">
              <button className="modal-btn modal-btn-secondary" onClick={() => {
                setShowDisableModal(false);
                setEnabled(true);
              }}>
                Cancel
              </button>
              <button className="modal-btn modal-btn-primary" onClick={handleDisableAndRestart}>
                Yes, Disable & Restart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

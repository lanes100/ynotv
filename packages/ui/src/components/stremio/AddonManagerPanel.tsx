import { useState } from 'react';
import { useStremioAddonStore } from '../../stores/stremioAddonStore';
import type { InstalledAddon } from '../../types/stremio';
import './AddonManagerPanel.css';

interface AddonManagerPanelProps {
  onClose: () => void;
}

export function AddonManagerPanel({ onClose }: AddonManagerPanelProps) {
  const addons = useStremioAddonStore((s) => s.addons);
  const addAddon = useStremioAddonStore((s) => s.addAddon);
  const removeAddon = useStremioAddonStore((s) => s.removeAddon);
  const reorderAddons = useStremioAddonStore((s) => s.reorderAddons);

  const [manifestUrl, setManifestUrl] = useState('');
  const [error, setError] = useState('');
  const [installing, setInstalling] = useState<string | boolean>(false);

  const handleInstall = async (url: string) => {
    if (!url.trim()) return;
    setInstalling(url);
    setError('');
    try {
      await addAddon(url.trim());
      if (url === manifestUrl) setManifestUrl('');
    } catch (e: any) {
      setError(e.message || 'Failed to install addon.');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="stremio-addon-overlay" onClick={onClose}>
      <div className="stremio-addon-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stremio-addon-header">
          <h3 className="stremio-addon-title">Addon Manager ({addons.length})</h3>
          <button className="stremio-addon-close" onClick={onClose}>✕</button>
        </div>

        <div className="stremio-addon-body">
          {error && <div className="stremio-addon-error" style={{ marginBottom: '12px' }}>{error}</div>}

          <div className="stremio-addon-install-section">
            <h4 className="stremio-addon-section-title">Install Custom Addon</h4>
            <p className="stremio-addon-section-desc">
              Paste the manifest.json URL of any Stremio-compatible addon.
            </p>
            <div className="stremio-addon-input-row">
              <input
                className="stremio-addon-input"
                type="text"
                placeholder="https://example.com/manifest.json"
                value={manifestUrl}
                onChange={(e) => setManifestUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleInstall(manifestUrl); }}
              />
              <button
                className="stremio-addon-install-btn"
                onClick={() => void handleInstall(manifestUrl)}
                disabled={!!installing || !manifestUrl.trim()}
              >
                {installing === manifestUrl ? 'Installing...' : 'Install'}
              </button>
            </div>
          </div>

          <div className="stremio-addon-list-section">
            <h4 className="stremio-addon-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Installed Addons</span>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', fontWeight: 'normal' }}>
                Use arrows to prioritize catalog & stream results
              </span>
            </h4>
            {addons.length === 0 ? (
              <div className="stremio-addon-empty">No addons installed.</div>
            ) : (
              <div className="stremio-addon-list">
                {addons.map((addon: InstalledAddon, index) => {
                  return (
                    <div key={addon.id} className="stremio-addon-item">
                      <div className="stremio-addon-reorder-btns">
                        <button
                          className="stremio-addon-reorder-btn"
                          disabled={index === 0}
                          onClick={() => reorderAddons(index, 'up')}
                          title="Move Up (Increase priority)"
                        >
                          ▲
                        </button>
                        <button
                          className="stremio-addon-reorder-btn"
                          disabled={index === addons.length - 1}
                          onClick={() => reorderAddons(index, 'down')}
                          title="Move Down (Decrease priority)"
                        >
                          ▼
                        </button>
                      </div>

                      <div className="stremio-addon-item-info">
                        <div className="stremio-addon-item-name">
                          {addon.manifest.name}
                          {addon.isDefault && <span className="stremio-addon-item-badge">default</span>}
                        </div>
                        <div className="stremio-addon-item-desc" style={{ whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {addon.manifest.description}
                        </div>
                        <div className="stremio-addon-item-url">{addon.baseUrl}</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {!addon.isDefault && (
                          <a
                            href={`${addon.baseUrl.replace(/\/$/, '')}/configure`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="stremio-addon-configure-btn"
                            title="Configure Addon"
                          >
                            ⚙
                          </a>
                        )}
                        {!addon.isDefault && (
                          <button
                            className="stremio-addon-remove-btn"
                            onClick={() => removeAddon(addon.id)}
                          >
                            Uninstall
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

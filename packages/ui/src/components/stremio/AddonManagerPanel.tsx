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
  const [manifestUrl, setManifestUrl] = useState('');
  const [error, setError] = useState('');
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    if (!manifestUrl.trim()) return;
    setInstalling(true);
    setError('');
    try {
      await addAddon(manifestUrl.trim());
      setManifestUrl('');
    } catch (e: any) {
      setError(e.message || 'Failed to install addon.');
    }
    setInstalling(false);
  };

  return (
    <div className="stremio-addon-overlay" onClick={onClose}>
      <div className="stremio-addon-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stremio-addon-header">
          <h3 className="stremio-addon-title">Addon Manager</h3>
          <button className="stremio-addon-close" onClick={onClose}>✕</button>
        </div>

        <div className="stremio-addon-body">
          <div className="stremio-addon-install-section">
            <h4 className="stremio-addon-section-title">Install Addon</h4>
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
                onKeyDown={(e) => { if (e.key === 'Enter') handleInstall(); }}
              />
              <button
                className="stremio-addon-install-btn"
                onClick={handleInstall}
                disabled={installing || !manifestUrl.trim()}
              >
                {installing ? 'Installing...' : 'Install'}
              </button>
            </div>
            {error && <div className="stremio-addon-error">{error}</div>}
          </div>

          <div className="stremio-addon-list-section">
            <h4 className="stremio-addon-section-title">Installed Addons ({addons.length})</h4>
            {addons.length === 0 ? (
              <div className="stremio-addon-empty">No addons installed.</div>
            ) : (
              <div className="stremio-addon-list">
                {addons.map((addon: InstalledAddon) => (
                  <div key={addon.id} className="stremio-addon-item">
                    <div className="stremio-addon-item-info">
                      <div className="stremio-addon-item-name">
                        {addon.manifest.name}
                        {addon.isDefault && <span className="stremio-addon-item-badge">default</span>}
                      </div>
                      <div className="stremio-addon-item-desc">{addon.manifest.description}</div>
                      <div className="stremio-addon-item-url">{addon.baseUrl}</div>
                    </div>
                    {!addon.isDefault && (
                      <button
                        className="stremio-addon-remove-btn"
                        onClick={() => removeAddon(addon.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

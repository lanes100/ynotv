import { useState, useMemo } from 'react';
import { useStremioAddonStore } from '../../stores/stremioAddonStore';
import type { InstalledAddon } from '../../types/stremio';
import './AddonManagerPanel.css';

interface AddonManagerPanelProps {
  onClose: () => void;
}

const COMMUNITY_ADDONS = [
  {
    name: 'Torrentio',
    description: 'Provides torrent streams from public torrent providers. Supports resolving streams via debrid services (RealDebrid, Premiumize, AllDebrid, DebridLink, etc.).',
    manifestUrl: 'https://torrentio.strem.fun/manifest.json',
    category: 'Streams',
  },
  {
    name: 'CyberFlix Catalog',
    description: 'Adds movie and series catalogs from Netflix, Disney+, Amazon Prime, Apple TV+, HBO Max, Hulu, and more to your Discover tab.',
    manifestUrl: 'https://cyberflix.eastindia.cloud/manifest.json',
    category: 'Catalogs',
  },
  {
    name: 'Kitsu Anime',
    description: 'Kitsu Anime catalogs, search, and anime metadata. Browse popular, highest rated, and trending anime series and movies.',
    manifestUrl: 'https://15e21971.kitsu.io/manifest.json',
    category: 'Catalogs',
  },
  {
    name: 'Twitch',
    description: 'Stream live gaming channels and streams directly from Twitch.',
    manifestUrl: 'https://twitch.strem.io/manifest.json',
    category: 'Streams',
  },
  {
    name: 'YouTube',
    description: 'Browse subscriptions, recommended videos, and search channels directly within the app.',
    manifestUrl: 'https://youtube.strem.io/manifest.json',
    category: 'Other',
  },
  {
    name: 'IMDb Lists',
    description: 'Access and browse custom film lists directly from IMDb.',
    manifestUrl: 'https://imdb-list.strem.io/manifest.json',
    category: 'Catalogs',
  }
];

export function AddonManagerPanel({ onClose }: AddonManagerPanelProps) {
  const addons = useStremioAddonStore((s) => s.addons);
  const addAddon = useStremioAddonStore((s) => s.addAddon);
  const removeAddon = useStremioAddonStore((s) => s.removeAddon);
  const reorderAddons = useStremioAddonStore((s) => s.reorderAddons);

  const [activeTab, setActiveTab] = useState<'installed' | 'browse'>('installed');
  const [manifestUrl, setManifestUrl] = useState('');
  const [error, setError] = useState('');
  const [installing, setInstalling] = useState<string | boolean>(false);

  // Search & filter states for Browse Tab
  const [browseSearch, setBrowseSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

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

  const filteredCommunityAddons = useMemo(() => {
    return COMMUNITY_ADDONS.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(browseSearch.toLowerCase()) ||
        item.description.toLowerCase().includes(browseSearch.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [browseSearch, selectedCategory]);

  return (
    <div className="stremio-addon-overlay" onClick={onClose}>
      <div className="stremio-addon-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stremio-addon-header">
          <h3 className="stremio-addon-title">Addon Manager</h3>
          <button className="stremio-addon-close" onClick={onClose}>✕</button>
        </div>

        <div className="stremio-addon-tabs">
          <button
            className={`stremio-addon-tab ${activeTab === 'installed' ? 'active' : ''}`}
            onClick={() => setActiveTab('installed')}
          >
            Installed ({addons.length})
          </button>
          <button
            className={`stremio-addon-tab ${activeTab === 'browse' ? 'active' : ''}`}
            onClick={() => setActiveTab('browse')}
          >
            Browse Addons
          </button>
        </div>

        <div className="stremio-addon-body">
          {error && <div className="stremio-addon-error" style={{ marginBottom: '12px' }}>{error}</div>}

          {activeTab === 'installed' ? (
            <>
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
                    onKeyDown={(e) => { if (e.key === 'Enter') handleInstall(manifestUrl); }}
                  />
                  <button
                    className="stremio-addon-install-btn"
                    onClick={() => handleInstall(manifestUrl)}
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

                          {!addon.isDefault && (
                            <button
                              className="stremio-addon-remove-btn"
                              onClick={() => removeAddon(addon.id)}
                            >
                              Uninstall
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="stremio-addon-browse-controls">
                <input
                  className="stremio-addon-input"
                  type="text"
                  placeholder="Search community addons..."
                  value={browseSearch}
                  onChange={(e) => setBrowseSearch(e.target.value)}
                  style={{ marginBottom: '12px', width: '100%' }}
                />

                <div className="stremio-addon-browse-filters">
                  {['All', 'Streams', 'Catalogs', 'Other'].map((cat) => (
                    <button
                      key={cat}
                      className={`stremio-addon-browse-filter ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="stremio-addon-list">
                {filteredCommunityAddons.length === 0 ? (
                  <div className="stremio-addon-empty">No community addons found.</div>
                ) : (
                  filteredCommunityAddons.map((item) => {
                    const isInstalled = addons.some(
                      (a) =>
                        a.baseUrl === item.manifestUrl.replace(/\/manifest\.json$/, '') ||
                        a.id === item.name.toLowerCase().replace(/\s+/g, '-')
                    );
                    const isAdding = installing === item.manifestUrl;

                    return (
                      <div key={item.manifestUrl} className="stremio-addon-item">
                        <div className="stremio-addon-item-info">
                          <div className="stremio-addon-item-name">
                            {item.name}
                            <span className="stremio-addon-item-badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
                              {item.category}
                            </span>
                          </div>
                          <div className="stremio-addon-item-desc" style={{ whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {item.description}
                          </div>
                          <div className="stremio-addon-item-url">{item.manifestUrl}</div>
                        </div>

                        {isInstalled ? (
                          <button
                            className="stremio-addon-install-btn"
                            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'default' }}
                            disabled
                          >
                            Installed
                          </button>
                        ) : (
                          <button
                            className="stremio-addon-install-btn"
                            onClick={() => handleInstall(item.manifestUrl)}
                            disabled={!!installing}
                          >
                            {isAdding ? 'Installing...' : 'Install'}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

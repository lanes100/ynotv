import { useMemo } from 'react';
import type { InstalledAddon } from '../../types/stremio';
import {
  useStremioSelectedAddonId,
  useSetStremioSelectedAddonId,
  useStremioSelectedCatalogId,
  useSetStremioSelectedCatalogId,
  useStremioView,
  useSetStremioView,
} from '../../stores/uiStore';
import './StremioSidebar.css';

interface StremioSidebarProps {
  addons: InstalledAddon[];
  onOpenAddonManager: () => void;
}

export function StremioSidebar({ addons, onOpenAddonManager }: StremioSidebarProps) {
  const selectedAddonId = useStremioSelectedAddonId();
  const setSelectedAddonId = useSetStremioSelectedAddonId();
  const selectedCatalogId = useStremioSelectedCatalogId();
  const setSelectedCatalogId = useSetStremioSelectedCatalogId();
  const setView = useSetStremioView();
  const view = useStremioView();

  const catalogs = useMemo(() => {
    const result: { addonId: string; addonName: string; type: string; id: string; name: string }[] = [];
    for (const addon of addons) {
      for (const cat of (addon.manifest.catalogs || [])) {
        result.push({
          addonId: addon.id,
          addonName: addon.manifest.name,
          type: cat.type,
          id: cat.id,
          name: cat.name || `${addon.manifest.name} - ${cat.type}`,
        });
      }
    }
    return result;
  }, [addons]);

  const handleCatalogClick = (addonId: string, catalogId: string) => {
    setSelectedAddonId(addonId);
    setSelectedCatalogId(catalogId);
    setView('home');
  };

  return (
    <div className="stremio-sidebar">
      <div className="stremio-sidebar-header">
        <h2 className="stremio-sidebar-title">Stremio</h2>
      </div>

      <div className="stremio-sidebar-section">
        <div className="stremio-sidebar-section-title">Catalogs</div>
        {catalogs.length === 0 && (
          <div className="stremio-sidebar-empty">No addons installed. Add one to browse catalogs.</div>
        )}
        {catalogs.map((cat) => (
          <button
            key={`${cat.addonId}-${cat.type}-${cat.id}`}
            className={`stremio-sidebar-item ${selectedAddonId === cat.addonId && selectedCatalogId === cat.id ? 'active' : ''}`}
            onClick={() => handleCatalogClick(cat.addonId, cat.id)}
          >
            <span className="stremio-sidebar-item-name">{cat.name}</span>
            <span className="stremio-sidebar-item-type">{cat.type}</span>
          </button>
        ))}
      </div>

      <div className="stremio-sidebar-section">
        <div className="stremio-sidebar-section-title">Addons</div>
        {addons.map((addon) => (
          <div key={addon.id} className="stremio-sidebar-addon-row">
            <span className="stremio-sidebar-addon-name">{addon.manifest.name}</span>
            {addon.isDefault && <span className="stremio-sidebar-addon-badge">default</span>}
          </div>
        ))}
      </div>

      <div className="stremio-sidebar-footer">
        <button className="stremio-sidebar-add-btn" onClick={onOpenAddonManager}>
          + Add Addon
        </button>
        <button
          className="stremio-sidebar-add-btn"
          style={{ marginTop: '6px' }}
          onClick={() => setView(view === 'search' ? 'home' : 'search')}
        >
          {view === 'search' ? 'Cancel Search' : 'Search'}
        </button>
      </div>
    </div>
  );
}

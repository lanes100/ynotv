import { useState, useEffect, useCallback } from 'react';
import type { InstalledAddon, StremioManifestCatalog, StremioMetaPreview } from '../../types/stremio';
import { fetchCatalog } from '../../services/stremio-addon';
import { StremioCatalogRow } from './StremioCatalogRow';
import './StremioHome.css';

interface CatalogDetailViewProps {
  addon: InstalledAddon;
  catalog: StremioManifestCatalog;
  onItemClick: (item: StremioMetaPreview) => void;
}

export function CatalogDetailView({ addon, catalog, onItemClick }: CatalogDetailViewProps) {
  const [items, setItems] = useState<StremioMetaPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCatalog(addon.baseUrl, catalog.type, catalog.id, { limit: '50' })
      .then(resp => setItems(resp?.metas || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [addon.baseUrl, catalog.type, catalog.id]);

  if (loading) {
    return <div className="stremio-loading-text" style={{ padding: '40px' }}>Loading catalog...</div>;
  }

  if (items.length === 0) {
    return <div className="stremio-loading-text" style={{ padding: '40px' }}>No items in this catalog.</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <StremioCatalogRow
        title={catalog.name || `${addon.manifest.name} - ${catalog.type}`}
        items={items}
        onItemClick={onItemClick}
      />
    </div>
  );
}

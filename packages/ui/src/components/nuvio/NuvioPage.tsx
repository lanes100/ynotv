import { useState, useEffect, useRef, useMemo } from 'react';
import { useNuvioAuthStore } from '../../stores/nuvioAuthStore';
import { useNuvioCollectionStore } from '../../stores/nuvioCollectionStore';
import { useNuvioAddonStore } from '../../stores/nuvioAddonStore';
import { useNuvioPluginStore } from '../../stores/nuvioPluginStore';
import {
  fetchNuvioLibrary,
  fetchNuvioWatchProgress,
  type NuvioLibrarySyncItem,
  type NuvioWatchProgressSyncEntry,
  type NuvioCollectionFolder,
  type NuvioCollectionSource,
  type NuvioCollection
} from '../../services/nuvio-api';
import { fetchCatalog, fetchMeta } from '../../services/stremio-addon';
import { StremioHeroBanner } from '../stremio/StremioHeroBanner';
import { StremioCatalogRow } from '../stremio/StremioCatalogRow';
import { StremioHoverProvider } from '../../contexts/StremioHoverContext';
import { StremioHoverCard } from '../stremio/StremioHoverCard';
import { NuvioDetailView, type NuvioMeta } from './NuvioDetailView';
import type { StremioStream } from '../../types/stremio';
import type { StremioMetaPreview, InstalledAddon } from '../../types/stremio';
import './NuvioPage.css';

interface NuvioPageProps {
  onClose: () => void;
}

const getFolderShapeClass = (folderShape: string | undefined): string => {
  const shape = (folderShape || 'poster').toLowerCase();
  if (shape === 'wide' || shape === 'landscape') return 'landscape';
  if (shape === 'square') return 'square';
  return 'poster';
};

const isAioMetadataAddon = (addon: InstalledAddon): boolean => {
  const addonId = (addon.manifest?.id || addon.id || '').toLowerCase();
  const baseUrl = (addon.baseUrl || '').toLowerCase();
  const name = (addon.manifest?.name || '').toLowerCase();
  const description = (addon.manifest?.description || '').toLowerCase();
  
  return (
    addonId.includes('aio') ||
    addonId.includes('genres') ||
    baseUrl.includes('aio') ||
    baseUrl.includes('genres') ||
    name.includes('aio') ||
    name.includes('genres') ||
    description.includes('aio') ||
    description.includes('genres')
  );
};

const isCinemetaAddon = (addon: InstalledAddon): boolean => {
  const addonId = (addon.manifest?.id || addon.id || '').toLowerCase();
  const baseUrl = (addon.baseUrl || '').toLowerCase();
  const name = (addon.manifest?.name || '').toLowerCase();
  
  return (
    addonId.includes('cinemeta') ||
    addonId.includes('linvo') ||
    baseUrl.includes('cinemeta') ||
    baseUrl.includes('linvo') ||
    name.includes('cinemeta') ||
    name.includes('linvo')
  );
};

const matchCatalogKey = (settingsKey: string, row: { key: string; addon: InstalledAddon; catalog: any }): boolean => {
  const parts = settingsKey.split(':');
  if (parts.length < 3) return false;
  
  const catalogId = parts.pop();
  const catalogType = parts.pop();
  const addonManifestId = parts.join(':').toLowerCase();
  
  const rowAddonId = (row.addon.manifest?.id || row.addon.id || '').toLowerCase();
  const rowAddonBaseUrl = (row.addon.baseUrl || '').toLowerCase();
  
  // Fuzzy addon match
  let addonMatches = false;
  if (rowAddonId === addonManifestId || addonManifestId.includes(rowAddonId) || rowAddonId.includes(addonManifestId)) {
    addonMatches = true;
  } else if (rowAddonBaseUrl.includes(addonManifestId) || addonManifestId.includes(rowAddonBaseUrl)) {
    addonMatches = true;
  } else {
    // Special Cinemeta fuzzy match
    const settingsIsCinemeta = addonManifestId.includes('cinemeta') || addonManifestId.includes('linvo');
    if (settingsIsCinemeta && isCinemetaAddon(row.addon)) {
      addonMatches = true;
    }
    
    // Special AIO metadata fuzzy match
    const settingsIsAio = addonManifestId.includes('aio') || addonManifestId.includes('genres');
    if (settingsIsAio && isAioMetadataAddon(row.addon)) {
      addonMatches = true;
    }
  }
  
  if (!addonMatches) return false;
  
  // Match catalog type and catalog ID
  const settingsCatId = (catalogId || '').toLowerCase();
  const rowCatId = (row.catalog.id || '').toLowerCase();
  const settingsCatType = (catalogType || '').toLowerCase();
  const rowCatType = (row.catalog.type || '').toLowerCase();
  
  // Normalize types: series -> series, tv -> series
  const normSettingsType = settingsCatType === 'tv' ? 'series' : settingsCatType;
  const normRowType = rowCatType === 'tv' ? 'series' : rowCatType;
  
  return normSettingsType === normRowType && settingsCatId === rowCatId;
};

const getSourceLabel = (
  source: NuvioCollectionSource,
  index: number,
  activeAddons: InstalledAddon[]
): string => {
  if (source.provider === 'tmdb') {
    return `TMDB - ${source.title || 'Discover'}`;
  }
  if (source.provider === 'trakt') {
    return `Trakt - ${source.title || 'List'}`;
  }
  
  // Find the resolved addon to get its manifest catalog name
  const resolvedAddon = activeAddons.find(a => {
    if (a.id === source.addonId || a.manifest?.id === source.addonId) return true;
    const targetId = (source.addonId || '').toLowerCase();
    
    const isTargetAio = targetId.includes('aio') || targetId.includes('genres');
    if (isTargetAio && isAioMetadataAddon(a)) {
      return true;
    }
    
    const isTargetCinemeta = targetId.includes('cinemeta') || targetId.includes('linvo');
    if (isTargetCinemeta && isCinemetaAddon(a)) {
      return true;
    }
    
    return false;
  });

  const catalogType = source.type === 'tv' ? 'series' : (source.type || 'movie');
  const catalog = resolvedAddon?.manifest?.catalogs?.find(
    c => c.type === catalogType && c.id === source.catalogId
  );
  
  const catalogName = catalog?.name || source.catalogId || `Source ${index + 1}`;
  const typeLabel = source.type === 'tv' || source.type === 'series' ? 'Series' : 'Movie';
  const genreSuffix = source.genre ? ` · ${source.genre}` : '';
  
  return `${catalogName} (${typeLabel})${genreSuffix}`;
};

export function NuvioPage({ onClose }: NuvioPageProps) {
  const authStore = useNuvioAuthStore();
  const collectionStore = useNuvioCollectionStore();
  const addonsStore = useNuvioAddonStore();
  const pluginStore = useNuvioPluginStore();
  const addons = addonsStore.enabledAddons;

  const [library, setLibrary] = useState<NuvioLibrarySyncItem[]>([]);
  const [resolvedWatchProgress, setResolvedWatchProgress] = useState<(NuvioWatchProgressSyncEntry & { poster?: string; name?: string })[]>([]);
  const [loading, setLoading] = useState(false);

  const [nuvioView, setNuvioView] = useState<'home' | 'collections' | 'addons' | 'scrapers' | 'settings'>('home');
  // Internal Nuvio detail navigation — completely separate from StremioPage
  const [nuvioActiveMeta, setNuvioActiveMeta] = useState<NuvioMeta | null>(null);
  const [editableCollections, setEditableCollections] = useState<NuvioCollection[]>([]);

  // Refs and controls for Collection rail horizontal scrolling
  const collectionScrollRefs = useRef<Record<string, HTMLDivElement>>({});
  const scrollCollection = (key: string, direction: 'left' | 'right') => {
    const el = collectionScrollRefs.current[key];
    if (el) {
      const scrollAmount = direction === 'left' ? -el.clientWidth * 0.75 : el.clientWidth * 0.75;
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Derive home catalog layout by sorting and filtering collections & addon rows from Nuvio homeCatalogSettings
  const homeRows = useMemo(() => {
    const collections = collectionStore.collections || [];
    const catalogRows: { key: string; type: 'catalog'; title: string; addon: InstalledAddon; catalog: any }[] = [];

    addons.forEach(addon => {
      addon.manifest?.catalogs?.forEach(catalog => {
        if (catalog.extra?.some(e => e.isRequired)) return;
        const key = `${addon.manifest.id || addon.id}:${catalog.type}:${catalog.id}`;
        catalogRows.push({
          key,
          type: 'catalog',
          title: catalog.name,
          addon,
          catalog
        });
      });
    });

    console.log('[NuvioPage:homeRows] Info:', {
      collectionsCount: collections.length,
      addonsCount: addons.length,
      addonsList: addons.map(a => ({ id: a.id, name: a.manifest?.name, catalogs: a.manifest?.catalogs?.map(c => c.id) })),
      catalogRowsCount: catalogRows.length,
      catalogRowsKeys: catalogRows.map(r => r.key),
      homeCatalogSettings: authStore.homeCatalogSettings,
    });

    // Default Fallback: If settings aren't fetched/configured, display collections and Cinemeta popular/featured catalogs
    if (!authStore.homeCatalogSettings || !authStore.homeCatalogSettings.items || authStore.homeCatalogSettings.items.length === 0) {
      const defaultRows: any[] = [];
      collections.forEach(coll => {
        defaultRows.push({
          type: 'collection',
          id: coll.id,
          key: `collection_${coll.id}`,
          title: coll.title,
          collection: coll
        });
      });

      catalogRows.forEach(row => {
        const isCinemeta = (row.addon.id || '').includes('cinemeta') || (row.addon.manifest?.id || '').includes('cinemeta');
        const isDefaultCatalog = row.catalog.id === 'top' || row.catalog.id === 'imdbRating';
        if (isCinemeta && isDefaultCatalog) {
          defaultRows.push(row);
        }
      });
      return defaultRows;
    }

    const settingsItems = authStore.homeCatalogSettings.items as Array<{
      key?: string;
      addon_id?: string;
      addonId?: string;
      type?: string;
      catalog_id?: string;
      catalogId?: string;
      is_collection?: boolean;
      isCollection?: boolean;
      collection_id?: string;
      collectionId?: string;
      custom_title?: string;
      customTitle?: string;
      enabled?: boolean;
      order?: number;
    }>;

    const collectionMap = new Map(collections.map(coll => [`collection_${coll.id}`, coll]));
    const catalogMap = new Map(catalogRows.map(row => [row.key, row]));
    const orderedRows: any[] = [];
    const mappedKeys = new Set<string>();

    const sortedSettings = [...settingsItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    sortedSettings.forEach(item => {
      const itemKey = item.key || (item.is_collection || item.isCollection
        ? `collection_${item.collection_id || item.collectionId}`
        : `${item.addon_id || item.addonId}:${item.type}:${item.catalog_id || item.catalogId}`);

      if (item.is_collection || item.isCollection || itemKey.startsWith('collection_')) {
        const collectionId = item.collection_id || item.collectionId || itemKey.replace('collection_', '');
        const coll = collectionMap.get(`collection_${collectionId}`);
        if (coll) {
          mappedKeys.add(itemKey);
          if (item.enabled !== false) {
            orderedRows.push({
              type: 'collection',
              id: coll.id,
              key: itemKey,
              title: item.custom_title?.trim() || item.customTitle?.trim() || coll.title,
              collection: coll
            });
          }
        }
      } else {
        const matchedRowIndex = catalogRows.findIndex(row => matchCatalogKey(itemKey, row));
        if (matchedRowIndex !== -1) {
          const row = catalogRows[matchedRowIndex];
          mappedKeys.add(row.key);
          if (item.enabled !== false) {
            orderedRows.push({
              ...row,
              title: item.custom_title?.trim() || item.customTitle?.trim() || row.title
            });
          }
          catalogRows.splice(matchedRowIndex, 1);
        }
      }
    });

    // Append newly added/unsynced collections
    collections.forEach(coll => {
      const key = `collection_${coll.id}`;
      if (!mappedKeys.has(key)) {
        orderedRows.push({
          type: 'collection',
          id: coll.id,
          key,
          title: coll.title,
          collection: coll
        });
      }
    });

    // Append newly installed/unsynced addon catalogs
    catalogRows.forEach(row => {
      orderedRows.push(row);
    });

    return orderedRows;
  }, [collectionStore.collections, addons, authStore.homeCatalogSettings]);

  // Profile selection dropdown state
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Folder detail modal state
  const [selectedFolder, setSelectedFolder] = useState<NuvioCollectionFolder | null>(null);
  const [selectedFolderCollectionTitle, setSelectedFolderCollectionTitle] = useState('');
  const [folderItems, setFolderItems] = useState<StremioMetaPreview[]>([]);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [loadingFolderItems, setLoadingFolderItems] = useState(false);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);

  // Add addon states
  const [addonUrl, setAddonUrl] = useState('');
  const [addonError, setAddonError] = useState<string | null>(null);
  const [installingAddon, setInstallingAddon] = useState(false);

  // Scrapers states
  const [repoUrl, setRepoUrl] = useState('');
  const [repoError, setRepoError] = useState<string | null>(null);
  const [installingRepo, setInstallingRepo] = useState(false);

  // Profile creation state
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileColor, setNewProfileColor] = useState('#00d4ff');

  const token = authStore.token;
  const profile = authStore.activeProfile;

  // Sync editable collections with store
  useEffect(() => {
    if (collectionStore.collections) {
      setEditableCollections(JSON.parse(JSON.stringify(collectionStore.collections)));
    }
  }, [collectionStore.collections, nuvioView]);

  // Fetch profiles on mount/token change
  useEffect(() => {
    if (token) {
      authStore.fetchProfiles();
    }
  }, [token]);

  // Proactively refresh the session on mount to avoid stale-token 401s
  useEffect(() => {
    const rt = authStore.refreshToken;
    if (!token || !rt) return;
    import('../../services/nuvio-api').then(({ refreshNuvioSession }) => {
      refreshNuvioSession(rt)
        .then((session) => {
          useNuvioAuthStore.setState({
            token: session.access_token,
            refreshToken: session.refresh_token,
          });
          console.log('[NuvioPage] Session refreshed proactively.');
        })
        .catch((e) => console.warn('[NuvioPage] Proactive refresh failed (will retry on next 401):', e));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click outside listener for profile menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to resolve folder sources
  const getResolvedSources = (folder: NuvioCollectionFolder): NuvioCollectionSource[] => {
    if (folder.sources && folder.sources.length > 0) return folder.sources;
    if ((folder as any).catalogSources && (folder as any).catalogSources.length > 0) {
      return (folder as any).catalogSources.map((cs: any) => ({
        provider: 'addon',
        addonId: cs.addonId,
        type: cs.type,
        catalogId: cs.catalogId,
        genre: cs.genre
      }));
    }
    return [];
  };

  const loadSyncedData = async () => {
    if (!token || !profile) return;
    setLoading(true);
    try {
      const effectiveAddonProfileId =
        profile.profile_index !== 1 && profile.uses_primary_addons
          ? 1
          : profile.profile_index;

      // Fetch Library, Progress and Addons concurrently
      const [lib, progress] = await Promise.all([
        fetchNuvioLibrary(token, profile.profile_index, 100),
        fetchNuvioWatchProgress(token, profile.profile_index, null, 100),
        addonsStore.pullAddons(token, effectiveAddonProfileId)
      ]);

      setLibrary(lib || []);

      if (progress && progress.length > 0) {
        setResolvedWatchProgress(progress.map(p => ({ ...p, name: `Content ID: ${p.content_id}` })));
        resolveProgressMetadata(progress);
      } else {
        setResolvedWatchProgress([]);
      }
    } catch (e) {
      console.error('[NuvioPage] Failed to fetch synced library/progress/addons:', e);
    } finally {
      setLoading(false);
    }
  };

  const resolveProgressMetadata = async (progressItems: NuvioWatchProgressSyncEntry[]) => {
    const activeAddons = useNuvioAddonStore.getState().enabledAddons;
    const resolved = await Promise.all(
      progressItems.map(async (entry) => {
        try {
          const type = entry.content_type === 'series' || entry.content_type === 'show' ? 'series' : 'movie';
          const meta = await fetchMeta(activeAddons, type, entry.content_id);
          if (meta) {
            return {
              ...entry,
              poster: meta.poster,
              name: meta.name,
            };
          }
        } catch (e) {
          console.warn('[NuvioPage] Failed to resolve metadata for:', entry.content_id, e);
        }
        return entry;
      })
    );
    setResolvedWatchProgress(resolved);
  };

  useEffect(() => {
    loadSyncedData();
  }, [token, profile?.profile_index]);

  const handleItemClick = (item: { content_id: string; content_type: string; name: string; poster: string | null; background?: string | null }) => {
    // Navigate within Nuvio — no Stremio page involved
    setNuvioActiveMeta({
      id: item.content_id,
      type: item.content_type === 'series' || item.content_type === 'show' ? 'series' : 'movie',
      name: item.name,
      poster: item.poster,
      background: item.background ?? item.poster ?? null,
    });
  };

  const handleNuvioPlay = (stream: StremioStream, meta: NuvioMeta) => {
    // Fire the same event the player listens to, using the stream from Nuvio's own addons/scrapers
    window.dispatchEvent(new CustomEvent('ynotv:stremio-play', {
      detail: { stream, meta: { id: meta.id, type: meta.type, name: meta.name, poster: meta.poster } },
    }));
  };

  const handleOpenSettings = () => {
    window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'nuvio' } }));
  };

  // Helper to render watch progress percentage
  const getProgressPercent = (entry: NuvioWatchProgressSyncEntry) => {
    if (!entry.duration) return 0;
    return Math.min(100, Math.max(0, (entry.position / entry.duration) * 100));
  };

  const handleFolderClick = async (collectionTitle: string, folder: NuvioCollectionFolder) => {
    setSelectedFolder(folder);
    setSelectedFolderCollectionTitle(collectionTitle);
    setActiveSourceIndex(0);
    loadFolderSourceItems(folder, 0);
  };

  const loadFolderSourceItems = async (folder: NuvioCollectionFolder, sourceIndex: number) => {
    setLoadingFolderItems(true);
    setFolderItems([]);
    setFolderError(null);
    try {
      const sources = getResolvedSources(folder);
      const source = sources[sourceIndex];
      if (source && (!source.provider || source.provider === 'addon')) {
        const activeAddons = useNuvioAddonStore.getState().enabledAddons;
        const resolvedAddon = activeAddons.find(a => {
          if (a.id === source.addonId || a.manifest?.id === source.addonId) return true;
          const targetId = (source.addonId || '').toLowerCase();
          
          const isTargetAio = targetId.includes('aio') || targetId.includes('genres');
          if (isTargetAio && isAioMetadataAddon(a)) {
            return true;
          }
          
          const isTargetCinemeta = targetId.includes('cinemeta') || targetId.includes('linvo');
          if (isTargetCinemeta && isCinemetaAddon(a)) {
            return true;
          }
          
          return false;
        });
        if (resolvedAddon) {
          const catalogType = source.type === 'tv' ? 'series' : (source.type || 'movie');
          const resp = await fetchCatalog(
            resolvedAddon.baseUrl,
            catalogType,
            source.catalogId || 'top',
            source.genre ? { genre: source.genre } : undefined
          );
          setFolderItems(resp?.metas || []);
        } else {
          const missingId = source.addonId || 'unknown';
          setFolderError(`Addon "${missingId}" is not installed in your Nuvio profile. Install it from the Addons tab to see content here.`);
        }
      } else if (!source) {
        setFolderError('This folder has no catalog source configured. Edit it in the Collections tab.');
      } else if (source && (source.provider === 'tmdb' || source.provider === 'trakt')) {
        setFolderError(`Catalog source provider "${source.provider}" is currently not supported in this client. Please configure this folder to use a Stremio addon.`);
      }
    } catch (e) {
      console.error('[NuvioPage] Failed to fetch folder items:', e);
      setFolderError('Failed to load catalog items. Check your connection.');
    } finally {
      setLoadingFolderItems(false);
    }
  };

  // Collections modification actions
  const handleSaveCollections = async (updated: NuvioCollection[]) => {
    try {
      await collectionStore.saveCollections(updated);
    } catch (e: any) {
      alert(e.message || 'Failed to save collections');
    }
  };

  const handleCreateCollection = () => {
    const newColl: NuvioCollection = {
      id: Math.random().toString(36).substring(2, 9),
      title: 'New Collection',
      backdropImageUrl: null,
      pinToTop: false,
      viewMode: 'TABBED_GRID',
      showAllTab: true,
      folders: []
    };
    const updated = [...editableCollections, newColl];
    setEditableCollections(updated);
    handleSaveCollections(updated);
  };

  const handleDeleteCollection = (id: string) => {
    if (confirm('Are you sure you want to delete this entire collection?')) {
      const updated = editableCollections.filter(c => c.id !== id);
      setEditableCollections(updated);
      handleSaveCollections(updated);
    }
  };

  const handleUpdateCollectionTitle = (id: string, title: string) => {
    const updated = editableCollections.map(c => c.id === id ? { ...c, title } : c);
    setEditableCollections(updated);
  };

  const handleAddFolder = (collId: string) => {
    const newFolder: NuvioCollectionFolder = {
      id: Math.random().toString(36).substring(2, 9),
      title: 'New Folder',
      coverImageUrl: null,
      coverEmoji: '📁',
      focusGifEnabled: false,
      tileShape: 'poster',
      hideTitle: false,
      sources: []
    };
    const updated = editableCollections.map(c => {
      if (c.id === collId) {
        return { ...c, folders: [...c.folders, newFolder] };
      }
      return c;
    });
    setEditableCollections(updated);
    handleSaveCollections(updated);
  };

  const handleDeleteFolder = (collId: string, folderId: string) => {
    if (confirm('Are you sure you want to delete this folder?')) {
      const updated = editableCollections.map(c => {
        if (c.id === collId) {
          return { ...c, folders: c.folders.filter(f => f.id !== folderId) };
        }
        return c;
      });
      setEditableCollections(updated);
      handleSaveCollections(updated);
    }
  };

  const handleUpdateFolder = (collId: string, folderId: string, fields: Partial<NuvioCollectionFolder>) => {
    const updated = editableCollections.map(c => {
      if (c.id === collId) {
        return {
          ...c,
          folders: c.folders.map(f => f.id === folderId ? { ...f, ...fields } : f)
        };
      }
      return c;
    });
    setEditableCollections(updated);
  };

  const handleAddSource = (collId: string, folderId: string) => {
    const newSource: NuvioCollectionSource = {
      provider: 'addon',
      addonId: addons[0]?.id || 'community.cinemeta',
      type: 'movie',
      catalogId: 'top',
      genre: null
    };
    const updated = editableCollections.map(c => {
      if (c.id === collId) {
        return {
          ...c,
          folders: c.folders.map(f => {
            if (f.id === folderId) {
              return { ...f, sources: [...(f.sources || []), newSource] };
            }
            return f;
          })
        };
      }
      return c;
    });
    setEditableCollections(updated);
    handleSaveCollections(updated);
  };

  const handleDeleteSource = (collId: string, folderId: string, sourceIndex: number) => {
    const updated = editableCollections.map(c => {
      if (c.id === collId) {
        return {
          ...c,
          folders: c.folders.map(f => {
            if (f.id === folderId) {
              const src = [...(f.sources || [])];
              src.splice(sourceIndex, 1);
              return { ...f, sources: src };
            }
            return f;
          })
        };
      }
      return c;
    });
    setEditableCollections(updated);
    handleSaveCollections(updated);
  };

  const handleUpdateSource = (collId: string, folderId: string, sourceIndex: number, fields: Partial<NuvioCollectionSource>) => {
    const updated = editableCollections.map(c => {
      if (c.id === collId) {
        return {
          ...c,
          folders: c.folders.map(f => {
            if (f.id === folderId) {
              const src = [...(f.sources || [])];
              src[sourceIndex] = { ...src[sourceIndex], ...fields };
              return { ...f, sources: src };
            }
            return f;
          })
        };
      }
      return c;
    });
    setEditableCollections(updated);
  };

  // Addon management actions
  const handleAddAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddonError(null);
    if (!addonUrl.trim()) return;
    if (!token || !profile) {
      setAddonError('Please log in and select a profile first.');
      return;
    }
    setInstallingAddon(true);
    try {
      await addonsStore.addAddon(token, profile.profile_index, addonUrl.trim());
      setAddonUrl('');
      alert('Addon installed successfully!');
    } catch (err: any) {
      setAddonError(err.message || 'Failed to install addon');
    } finally {
      setInstallingAddon(false);
    }
  };

  const handleToggleAddon = async (addonId: string) => {
    if (!token || !profile) return;
    try {
      await addonsStore.toggleAddon(token, profile.profile_index, addonId);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle addon');
    }
  };

  const handleRemoveAddon = async (addonId: string) => {
    if (!token || !profile) return;
    if (confirm('Are you sure you want to uninstall this addon from Nuvio?')) {
      try {
        await addonsStore.removeAddon(token, profile.profile_index, addonId);
      } catch (err: any) {
        alert(err.message || 'Failed to remove addon');
      }
    }
  };

  // Scrapers management actions
  const handleAddRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    setRepoError(null);
    if (!repoUrl.trim()) return;
    setInstallingRepo(true);
    try {
      await pluginStore.addRepository(repoUrl.trim());
      setRepoUrl('');
      alert('Repository installed successfully!');
    } catch (err: any) {
      setRepoError(err.message || 'Failed to add repository');
    } finally {
      setInstallingRepo(false);
    }
  };

  const handleCreateProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    try {
      await authStore.createProfile(newProfileName, newProfileColor, null, null);
      setNewProfileName('');
      setShowCreateProfile(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create profile');
    }
  };

  const defaultColors = ['#00d4ff', '#ff007f', '#a020f0', '#00ff7f', '#ffaa00', '#ff0000', '#0088ff', '#ffffff'];

  return (
    <StremioHoverProvider addons={addons}>
      <div className="nuvio-page">
      {/* Nuvio Dedicated Topbar */}
      <div className="nuvio-topbar">
        <div className="nuvio-topbar-left">
          <div className="nuvio-brand">
            <svg className="nuvio-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="7" width="20" height="14" rx="3" />
              <path d="M17 2l-5 5-5-5" />
            </svg>
            <span className="nuvio-brand-name" style={{ background: 'linear-gradient(135deg, #00d4ff, #ff007f)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Nuvio
            </span>
          </div>
        </div>

        {/* Centered Navigation Tabs */}
        {token && (
          <div className="nuvio-topbar-center">
            <button
              className={`nuvio-topbar-item ${nuvioView === 'home' ? 'active' : ''}`}
              onClick={() => setNuvioView('home')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nuvio-topbar-icon">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Home</span>
            </button>

            <button
              className={`nuvio-topbar-item ${nuvioView === 'collections' ? 'active' : ''}`}
              onClick={() => setNuvioView('collections')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nuvio-topbar-icon">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span>Collections</span>
            </button>

            <button
              className={`nuvio-topbar-item ${nuvioView === 'addons' ? 'active' : ''}`}
              onClick={() => setNuvioView('addons')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nuvio-topbar-icon">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Addons</span>
            </button>

            <button
              className={`nuvio-topbar-item ${nuvioView === 'scrapers' ? 'active' : ''}`}
              onClick={() => setNuvioView('scrapers')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nuvio-topbar-icon">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <span>Scrapers</span>
            </button>

            <button
              className={`nuvio-topbar-item ${nuvioView === 'settings' ? 'active' : ''}`}
              onClick={() => setNuvioView('settings')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nuvio-topbar-icon">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Settings</span>
            </button>
          </div>
        )}

        <div className="nuvio-topbar-right">
          {profile && (
            <div className="nuvio-profile-badge-wrapper" ref={profileMenuRef}>
              <div className="nuvio-profile-badge" onClick={() => setShowProfileMenu(!showProfileMenu)}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: profile.avatar_color_hex || '#00d4ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.55rem',
                  color: '#000'
                }}>
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <span>{profile.name}</span>
                <span className="nuvio-profile-chevron">{showProfileMenu ? '▲' : '▼'}</span>
              </div>
              {showProfileMenu && authStore.profiles.length > 0 && (
                <div className="nuvio-profile-dropdown">
                  <div className="nuvio-profile-dropdown-header">Switch Profile</div>
                  {authStore.profiles.map((p) => {
                    const isActive = p.profile_index === profile.profile_index;
                    return (
                      <div
                        key={p.profile_index}
                        className={`nuvio-profile-dropdown-item ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          if (!isActive) {
                            authStore.selectProfile(p.profile_index);
                          }
                          setShowProfileMenu(false);
                        }}
                      >
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: p.avatar_color_hex || '#00d4ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.55rem',
                          color: '#000'
                        }}>
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{p.name}</span>
                        {isActive && <span className="nuvio-profile-dropdown-active-marker">✓</span>}
                      </div>
                    );
                  })}
                  <div className="nuvio-profile-dropdown-footer" onClick={() => { setShowProfileMenu(false); setNuvioView('settings'); }}>
                    Manage Profiles...
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '1.2rem',
              cursor: 'pointer',
              padding: '4px 10px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="nuvio-main">
        {!token ? (
          <div className="nuvio-empty-state" style={{ maxWidth: '480px', margin: '80px auto' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }}>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <h3 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 600 }}>Nuvio Sync Offline</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              Sign in to Nuvio in Settings to synchronize your custom collections, starred library items, and continue watching progress across devices.
            </p>
            <button
              onClick={handleOpenSettings}
              className="nuvio-btn nuvio-btn-primary"
              style={{ padding: '10px 24px' }}
            >
              Log In Now
            </button>
          </div>
        ) : loading && resolvedWatchProgress.length === 0 && library.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'rgba(255,255,255,0.4)', gap: '10px' }}>
            <div className="spinner" style={{ width: '28px', height: '28px', borderRadius: '50%', border: '3px solid rgba(0,212,255,0.1)', borderTopColor: '#00d4ff', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.82rem' }}>Loading synced data...</span>
          </div>
        ) : (
          <div>
            {nuvioView === 'home' && (
              <div>
                {/* Stremio Hero Banner at top */}
                {addons.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <StremioHeroBanner
                      addons={addons}
                      onItemClick={(item) => handleItemClick({ content_id: item.id, content_type: item.type, name: item.name, poster: item.poster ?? null })}
                    />
                  </div>
                )}

                {/* Continue Watching (Watch Progress) */}
                {resolvedWatchProgress.length > 0 && (
                  <div className="nuvio-row">
                    <div className="nuvio-row-header">
                      <h3 className="nuvio-row-title">Continue Watching</h3>
                    </div>
                    <div className="nuvio-scroll-rail">
                      {resolvedWatchProgress.map((entry) => (
                        <div
                          key={entry.progress_key}
                          className="nuvio-card"
                          onClick={() => handleItemClick({
                            content_id: entry.content_id,
                            content_type: entry.content_type,
                            name: entry.name || entry.progress_key,
                            poster: entry.poster || null
                          })}
                          style={{ width: '150px' }}
                        >
                          {entry.poster ? (
                            <img src={entry.poster} alt={entry.name} className="nuvio-card-img" />
                          ) : (
                            <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '12px', boxSizing: 'border-box' }}>
                              <span style={{ alignSelf: 'flex-start', fontSize: '0.55rem', background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff' }}>
                                {entry.content_type}
                              </span>
                              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                {entry.name || entry.content_id}
                              </div>
                            </div>
                          )}
                          {entry.season !== null && entry.episode !== null && (
                            <div className="nuvio-card-episode-badge">
                              S{entry.season}E{entry.episode}
                            </div>
                          )}
                          <div className="nuvio-progress-bar" style={{ width: `${getProgressPercent(entry)}%` }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sync Library */}
                <div className="nuvio-row">
                  <div className="nuvio-row-header">
                    <h3 className="nuvio-row-title">Library</h3>
                  </div>
                  {library.length > 0 ? (
                    <div className="nuvio-scroll-rail">
                      {library.map((item) => (
                        <div
                          key={item.content_id}
                          className="nuvio-card"
                          onClick={() => handleItemClick(item)}
                        >
                          {item.poster ? (
                            <img src={item.poster} alt={item.name} className="nuvio-card-img" />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.3)', padding: '12px', boxSizing: 'border-box', textAlign: 'center', fontSize: '0.75rem' }}>
                              {item.name}
                            </div>
                          )}
                          <div className="nuvio-card-info">
                            <div className="nuvio-card-title">{item.name}</div>
                            <div className="nuvio-card-sub">{item.release_info} · {item.content_type}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="nuvio-empty-state">
                      No items in library. Star movies or shows to see them here.
                    </div>
                  )}
                </div>

                {/* Unified Home Rows (Collections and Catalogs sorted/filtered) */}
                {homeRows.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {homeRows.map((row) => {
                      if (row.type === 'collection') {
                        const coll = row.collection;
                        return (
                          <div key={row.key} className="nuvio-row">
                            <div className="nuvio-row-header">
                              <h3 className="nuvio-row-title">{row.title}</h3>
                              <div className="nuvio-chevron-controls">
                                <button
                                  className="nuvio-chevron-btn"
                                  onClick={() => scrollCollection(row.key, 'left')}
                                  aria-label="Scroll left"
                                >
                                  &lsaquo;
                                </button>
                                <button
                                  className="nuvio-chevron-btn"
                                  onClick={() => scrollCollection(row.key, 'right')}
                                  aria-label="Scroll right"
                                >
                                  &rsaquo;
                                </button>
                              </div>
                            </div>
                            <div
                              className="nuvio-scroll-rail"
                              ref={(el) => {
                                if (el) {
                                  collectionScrollRefs.current[row.key] = el;
                                } else {
                                  delete collectionScrollRefs.current[row.key];
                                }
                              }}
                            >
                              {coll.folders.map((folder: any) => {
                                const tileShape = getFolderShapeClass(folder.tileShape);
                                return (
                                  <div
                                    key={folder.id}
                                    className={`nuvio-folder-card nuvio-folder-card-${tileShape}`}
                                    onClick={() => handleFolderClick(row.title, folder)}
                                  >
                                    <div className="nuvio-folder-card-inner">
                                      {folder.coverImageUrl ? (
                                        <img src={folder.coverImageUrl} alt={folder.title} className="nuvio-folder-card-img" />
                                      ) : folder.coverEmoji ? (
                                        <div className="nuvio-folder-card-emoji">{folder.coverEmoji}</div>
                                      ) : (
                                        <div className="nuvio-folder-card-abbrev">
                                          {folder.title.slice(0, 2).toUpperCase()}
                                        </div>
                                      )}
                                      {!folder.hideTitle && (
                                        <div className="nuvio-folder-card-overlay-title">
                                          {folder.title}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      } else {
                        // row.type === 'catalog'
                        return (
                          <StremioCatalogRow
                            key={row.key}
                            title={row.title}
                            addon={row.addon}
                            catalog={row.catalog}
                            onItemClick={(item) => handleItemClick({ content_id: item.id, content_type: item.type, name: item.name, poster: item.poster ?? null })}
                          />
                        );
                      }
                    })}
                  </div>
                )}
              </div>
            )}

            {nuvioView === 'collections' && (
              <div className="nuvio-editor-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>Collections Manager</h3>
                  <button className="nuvio-btn nuvio-btn-primary" onClick={handleCreateCollection}>
                    + Add Collection
                  </button>
                </div>

                {editableCollections.length === 0 ? (
                  <div className="nuvio-empty-state">No collections configured. Click "+ Add Collection" to start.</div>
                ) : (
                  editableCollections.map((coll) => (
                    <div key={coll.id} className="nuvio-editor-section">
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <input
                          type="text"
                          value={coll.title}
                          className="nuvio-input"
                          style={{ fontSize: '1.05rem', fontWeight: 700, flex: 1, height: '38px' }}
                          onChange={(e) => handleUpdateCollectionTitle(coll.id, e.target.value)}
                          onBlur={() => handleSaveCollections(editableCollections)}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="nuvio-btn" onClick={() => handleAddFolder(coll.id)}>
                            + Add Folder
                          </button>
                          <button className="nuvio-btn nuvio-btn-danger" onClick={() => handleDeleteCollection(coll.id)}>
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Folders in collection */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '16px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                        {coll.folders.map((folder) => (
                          <div key={folder.id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Folder Title</label>
                                <input
                                  type="text"
                                  value={folder.title}
                                  className="nuvio-input"
                                  style={{ width: '100%' }}
                                  onChange={(e) => handleUpdateFolder(coll.id, folder.id, { title: e.target.value })}
                                  onBlur={() => handleSaveCollections(editableCollections)}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Tile Shape</label>
                                <select
                                  value={getFolderShapeClass(folder.tileShape)}
                                  className="nuvio-input"
                                  style={{ width: '100%', padding: '9px 12px' }}
                                  onChange={(e) => handleUpdateFolder(coll.id, folder.id, { tileShape: e.target.value })}
                                  onBlur={() => handleSaveCollections(editableCollections)}
                                >
                                  <option value="poster">Poster (2:3)</option>
                                  <option value="landscape">Landscape (16:10)</option>
                                  <option value="square">Square (1:1)</option>
                                </select>
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Cover Emoji</label>
                                <input
                                  type="text"
                                  value={folder.coverEmoji || ''}
                                  placeholder="📁"
                                  className="nuvio-input"
                                  style={{ width: '100%' }}
                                  onChange={(e) => handleUpdateFolder(coll.id, folder.id, { coverEmoji: e.target.value })}
                                  onBlur={() => handleSaveCollections(editableCollections)}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Cover Image URL</label>
                                <input
                                  type="text"
                                  value={folder.coverImageUrl || ''}
                                  className="nuvio-input"
                                  style={{ width: '100%' }}
                                  onChange={(e) => handleUpdateFolder(coll.id, folder.id, { coverImageUrl: e.target.value })}
                                  onBlur={() => handleSaveCollections(editableCollections)}
                                />
                              </div>
                            </div>

                            {/* Folder sources */}
                            <div style={{ marginTop: '16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Catalog Sources</span>
                                <button className="nuvio-btn" style={{ padding: '4px 10px', fontSize: '0.7rem' }} onClick={() => handleAddSource(coll.id, folder.id)}>
                                  + Add Source
                                </button>
                              </div>

                              {(!folder.sources || folder.sources.length === 0) ? (
                                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', padding: '8px', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '4px', textAlign: 'center' }}>
                                  No sources added yet.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {folder.sources.map((source, srcIdx) => {
                                    const selectedAddon = addons.find(a => a.id === source.addonId || a.manifest.id === source.addonId);
                                    const catalogOptions = selectedAddon?.manifest?.catalogs || [];
                                    return (
                                      <div key={srcIdx} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr)) 40px', gap: '8px', alignItems: 'end', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '4px' }}>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>Addon Provider</label>
                                          <select
                                            value={source.addonId ?? ''}
                                            className="nuvio-input"
                                            style={{ width: '100%', fontSize: '0.72rem', padding: '6px' }}
                                            onChange={(e) => handleUpdateSource(coll.id, folder.id, srcIdx, { addonId: e.target.value, catalogId: 'top' })}
                                            onBlur={() => handleSaveCollections(editableCollections)}
                                          >
                                            {addons.map(a => (
                                              <option key={a.id} value={a.id}>{a.manifest.name}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>Catalog</label>
                                          <select
                                            value={source.catalogId ?? ''}
                                            className="nuvio-input"
                                            style={{ width: '100%', fontSize: '0.72rem', padding: '6px' }}
                                            onChange={(e) => handleUpdateSource(coll.id, folder.id, srcIdx, { catalogId: e.target.value })}
                                            onBlur={() => handleSaveCollections(editableCollections)}
                                          >
                                            {catalogOptions.map(c => (
                                              <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                            {catalogOptions.length === 0 && (
                                              <option value="top">Top</option>
                                            )}
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>Type</label>
                                          <select
                                            value={source.type ?? ''}
                                            className="nuvio-input"
                                            style={{ width: '100%', fontSize: '0.72rem', padding: '6px' }}
                                            onChange={(e) => handleUpdateSource(coll.id, folder.id, srcIdx, { type: e.target.value })}
                                            onBlur={() => handleSaveCollections(editableCollections)}
                                          >
                                            <option value="movie">Movie</option>
                                            <option value="series">Series</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>Genre Filter</label>
                                          <input
                                            type="text"
                                            value={source.genre || ''}
                                            placeholder="Optional"
                                            className="nuvio-input"
                                            style={{ width: '100%', fontSize: '0.72rem', padding: '5px' }}
                                            onChange={(e) => handleUpdateSource(coll.id, folder.id, srcIdx, { genre: e.target.value || null })}
                                            onBlur={() => handleSaveCollections(editableCollections)}
                                          />
                                        </div>
                                        <button className="nuvio-btn nuvio-btn-danger" style={{ padding: '6px', width: '100%', height: '28px', justifyContent: 'center' }} onClick={() => handleDeleteSource(coll.id, folder.id, srcIdx)}>
                                          ✕
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                              <button className="nuvio-btn nuvio-btn-danger" style={{ padding: '4px 10px', fontSize: '0.7rem' }} onClick={() => handleDeleteFolder(coll.id, folder.id)}>
                                Delete Folder
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {nuvioView === 'addons' && (
              <div className="nuvio-editor-container">
                <div className="nuvio-editor-section">
                  <h4 className="nuvio-editor-title">Install Custom Addon</h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
                    Paste the manifest.json URL of any Stremio-compatible addon to install it into your Nuvio profile.
                  </p>
                  <form onSubmit={handleAddAddon} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="https://example.com/manifest.json"
                      value={addonUrl}
                      onChange={(e) => setAddonUrl(e.target.value)}
                      className="nuvio-input"
                      style={{ flex: 1 }}
                    />
                    <button type="submit" className="nuvio-btn nuvio-btn-primary" disabled={installingAddon || !addonUrl.trim()}>
                      {installingAddon ? 'Installing...' : 'Install'}
                    </button>
                  </form>
                  {addonError && <div style={{ color: '#ff4f4f', fontSize: '0.75rem', marginTop: '8px' }}>{addonError}</div>}
                  {addonsStore.error && <div style={{ color: '#ff4f4f', fontSize: '0.75rem', marginTop: '8px' }}>{addonsStore.error}</div>}
                </div>

                <div className="nuvio-editor-section" style={{ marginTop: '20px' }}>
                  <h4 className="nuvio-editor-title">Installed Addons ({addonsStore.addons.length})</h4>
                  {addonsStore.addons.length === 0 ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                      No addons installed.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {addonsStore.addons.map((addon) => (
                        <div key={`${addon.id}-${addon.baseUrl}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', padding: '12px 16px' }}>
                          <div style={{ overflow: 'hidden', marginRight: '10px' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                              {addon.manifest.name} <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginLeft: '4px' }}>v{addon.manifest.version}</span>
                            </div>
                            {addon.manifest.description && (
                              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                                {addon.manifest.description}
                              </div>
                            )}
                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {addon.baseUrl}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                            <button className="nuvio-btn" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => handleToggleAddon(addon.id)}>
                              {addon.enabled === false ? 'Enable' : 'Disable'}
                            </button>
                            <button className="nuvio-btn nuvio-btn-danger" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => handleRemoveAddon(addon.id)}>
                              Uninstall
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {nuvioView === 'scrapers' && (
              <div className="nuvio-editor-container">
                <div className="nuvio-editor-section">
                  <h4 className="nuvio-editor-title">Settings</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Enable Scrapers</div>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>Use installed Nuvio scrapers when looking for media streams.</div>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={pluginStore.pluginsEnabled}
                          onChange={(e) => pluginStore.setPluginsEnabled(e.target.checked)}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Group Streams by Repository</div>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>Group streams by their originating plugin scraper repo in stream picker.</div>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={pluginStore.groupStreamsByRepository}
                          onChange={(e) => pluginStore.setGroupStreamsByRepository(e.target.checked)}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="nuvio-editor-section" style={{ marginTop: '20px' }}>
                  <h4 className="nuvio-editor-title">Install Scraper Plugin Repository</h4>
                  <form onSubmit={handleAddRepository} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="https://example.com/manifest.json"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      className="nuvio-input"
                      style={{ flex: 1 }}
                    />
                    <button type="submit" className="nuvio-btn nuvio-btn-primary" disabled={installingRepo || !repoUrl.trim()}>
                      {installingRepo ? 'Installing...' : 'Install'}
                    </button>
                  </form>
                  {repoError && <div style={{ color: '#ff4f4f', fontSize: '0.75rem', marginTop: '8px' }}>{repoError}</div>}
                  {pluginStore.error && <div style={{ color: '#ff4f4f', fontSize: '0.75rem', marginTop: '8px' }}>{pluginStore.error}</div>}
                </div>

                <div className="nuvio-editor-section" style={{ marginTop: '20px' }}>
                  <h4 className="nuvio-editor-title">Installed Repositories ({pluginStore.repositories.length})</h4>
                  {pluginStore.repositories.length === 0 ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                      No plugin repositories installed yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {pluginStore.repositories.map((repo) => {
                        const repoScrapers = pluginStore.scrapers.filter(s => s.repositoryUrl === repo.manifestUrl);
                        return (
                          <div key={repo.manifestUrl} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ overflow: 'hidden', marginRight: '10px' }}>
                                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>
                                  {repo.name} <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginLeft: '4px' }}>v{repo.version}</span>
                                </div>
                                {repo.description && (
                                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                                    {repo.description}
                                  </div>
                                )}
                                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {repo.manifestUrl}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                <button className="nuvio-btn" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => pluginStore.refreshRepository(repo.manifestUrl)} disabled={repo.isRefreshing}>
                                  {repo.isRefreshing ? 'Refreshing...' : 'Refresh'}
                                </button>
                                <button className="nuvio-btn nuvio-btn-danger" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => pluginStore.removeRepository(repo.manifestUrl)}>
                                  Remove
                                </button>
                              </div>
                            </div>

                            {/* Scrapers list */}
                            {repoScrapers.length > 0 && (
                              <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', marginBottom: '6px' }}>SCRAPERS</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {repoScrapers.map((scraper) => (
                                    <div key={scraper.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', padding: '6px 8px', borderRadius: '4px' }}>
                                      <span style={{ fontSize: '0.78rem', color: scraper.enabled ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                                        {scraper.name} <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginLeft: '4px' }}>v{scraper.version}</span>
                                      </span>
                                      <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                                        <input
                                          type="checkbox"
                                          checked={scraper.enabled}
                                          onChange={(e) => pluginStore.toggleScraper(scraper.id, e.target.checked)}
                                        />
                                        <span className="toggle-slider" />
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {nuvioView === 'settings' && (
              <div className="nuvio-editor-container">
                {/* Profiles Section */}
                <div className="nuvio-editor-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Profiles ({authStore.profiles.length}/4)</h4>
                    {authStore.profiles.length < 4 && !showCreateProfile && (
                      <button className="nuvio-btn" onClick={() => setShowCreateProfile(true)}>
                        + Add Profile
                      </button>
                    )}
                  </div>

                  {showCreateProfile && (
                    <form onSubmit={handleCreateProfileSubmit} style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Profile Name"
                          value={newProfileName}
                          onChange={(e) => setNewProfileName(e.target.value)}
                          className="nuvio-input"
                          style={{ flex: 1 }}
                        />
                        <input
                          type="color"
                          value={newProfileColor}
                          onChange={(e) => setNewProfileColor(e.target.value)}
                          style={{ background: 'none', border: 'none', width: '32px', height: '32px', cursor: 'pointer', padding: 0 }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {defaultColors.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewProfileColor(c)}
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              background: c,
                              border: newProfileColor === c ? '2px solid #fff' : '1px solid rgba(0,0,0,0.3)',
                              cursor: 'pointer'
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <button type="button" className="nuvio-btn" onClick={() => setShowCreateProfile(false)}>Cancel</button>
                        <button type="submit" className="nuvio-btn nuvio-btn-primary">Create</button>
                      </div>
                    </form>
                  )}

                  {/* Profiles List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {authStore.profiles.map((p) => {
                      const isActive = authStore.activeProfile?.profile_index === p.profile_index;
                      return (
                        <div
                          key={p.profile_index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderRadius: '6px',
                            background: isActive ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isActive ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.04)'}`,
                          }}
                        >
                          <div
                            onClick={() => !isActive && authStore.selectProfile(p.profile_index)}
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: isActive ? 'default' : 'pointer' }}
                          >
                            <div style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              backgroundColor: p.avatar_color_hex || '#00d4ff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              color: '#000'
                            }}>
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span style={{ fontSize: '0.85rem', fontWeight: isActive ? 600 : 500, color: isActive ? '#fff' : 'rgba(255,255,255,0.85)' }}>
                                {p.name}
                              </span>
                              {isActive && (
                                <span style={{ marginLeft: '8px', fontSize: '0.62rem', background: '#00d4ff', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  ACTIVE
                                </span>
                              )}
                            </div>
                          </div>
                          {authStore.profiles.length > 1 && (
                            <button
                              className="nuvio-btn nuvio-btn-danger"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete profile "${p.name}"?`)) {
                                  authStore.deleteProfile(p.profile_index);
                                }
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Advanced / Server config info */}
                <div className="nuvio-editor-section" style={{ marginTop: '20px' }}>
                  <h4 className="nuvio-editor-title">Account details</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(255,255,255,0.4)' }}>Email:</span> <span>{authStore.user?.email}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(255,255,255,0.4)' }}>Supabase Endpoint:</span> <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{localStorage.getItem('ynotv_nuvio_url') || 'Official Cloud'}</span></div>
                  </div>
                  <button className="nuvio-btn nuvio-btn-danger" style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }} onClick={() => authStore.logout()}>
                    Sign Out of Nuvio
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Folder Detail Modal / Overlay */}
      {selectedFolder && (
        <div className="nuvio-folder-detail-overlay" onClick={() => setSelectedFolder(null)}>
          <div className="nuvio-folder-detail-content" onClick={(e) => e.stopPropagation()}>
            <div className="nuvio-folder-detail-header">
              <div>
                <div className="nuvio-folder-detail-coll-title">{selectedFolderCollectionTitle}</div>
                <h2 className="nuvio-folder-detail-title">{selectedFolder.title}</h2>
              </div>
              <button className="nuvio-folder-detail-close" onClick={() => setSelectedFolder(null)}>✕</button>
            </div>
            
            {/* Sources Tabs if there are multiple sources */}
            {getResolvedSources(selectedFolder).length > 1 && (
              <div className="nuvio-folder-detail-tabs">
                {getResolvedSources(selectedFolder).map((source, idx) => (
                  <button
                    key={idx}
                    className={`nuvio-folder-detail-tab-btn ${activeSourceIndex === idx ? 'active' : ''}`}
                    onClick={() => {
                      setActiveSourceIndex(idx);
                      loadFolderSourceItems(selectedFolder, idx);
                    }}
                  >
                    {getSourceLabel(source, idx, addons)}
                  </button>
                ))}
              </div>
            )}
            
            <div className="nuvio-folder-detail-grid-container">
              {loadingFolderItems ? (
                <div className="nuvio-folder-detail-loading">
                  <div className="spinner" style={{ width: '28px', height: '28px', borderRadius: '50%', border: '3px solid rgba(0,212,255,0.1)', borderTopColor: '#00d4ff', animation: 'spin 1s linear infinite' }} />
                  <span>Loading catalog items...</span>
                </div>
              ) : folderError ? (
                <div className="nuvio-folder-detail-empty" style={{ flexDirection: 'column', gap: '12px', padding: '40px 24px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#ff9900" strokeWidth="1.5" width="36" height="36">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textAlign: 'center', maxWidth: '360px', lineHeight: 1.5 }}>{folderError}</span>
                </div>
              ) : folderItems.length > 0 ? (
                <div className="nuvio-folder-detail-grid">
                  {folderItems.map((item) => (
                    <div
                      key={item.id}
                      className="nuvio-folder-detail-item"
                      onClick={() => handleItemClick({ content_id: item.id, content_type: item.type, name: item.name, poster: item.poster ?? null })}
                    >
                      <div className="nuvio-folder-detail-poster-wrapper">
                        {item.poster ? (
                          <img src={item.poster} alt={item.name} className="nuvio-folder-detail-poster" />
                        ) : (
                          <div className="nuvio-folder-detail-poster-placeholder">{item.name}</div>
                        )}
                      </div>
                      <div className="nuvio-folder-detail-item-title">{item.name}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="nuvio-folder-detail-empty">No items found in this catalog source.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spinner animation definition */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Nuvio Detail View — fully self-contained, no Stremio page */}
      {nuvioActiveMeta && (
        <NuvioDetailView
          meta={nuvioActiveMeta}
          onBack={() => setNuvioActiveMeta(null)}
          onPlay={handleNuvioPlay}
        />
      )}

      <StremioHoverCard />
      </div>
    </StremioHoverProvider>
  );
}

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNuvioAuthStore } from '../../stores/nuvioAuthStore';
import { useNuvioPluginStore } from '../../stores/nuvioPluginStore';
import { useNuvioAddonStore } from '../../stores/nuvioAddonStore';
import { useNuvioCollectionStore } from '../../stores/nuvioCollectionStore';
import { NuvioPinModal } from '../nuvio/NuvioPinModal';
import { getEffectiveNuvioUrl, getEffectiveNuvioKey } from '../../services/nuvio-api';
import type { InstalledAddon, BadgeSource } from '../../types/stremio';
import { parseBadgePayload, isLightColor, convertArgbToRgba } from '../../utils/streamBadges';

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

const matchCatalogKey = (settingsKey: string, availableKey: string, activeAddons: InstalledAddon[]): boolean => {
  const parts = settingsKey.split(':');
  if (parts.length < 3) return false;
  
  const catalogId = parts.pop()?.toLowerCase();
  const catalogType = parts.pop()?.toLowerCase();
  const addonManifestId = parts.join(':').toLowerCase();
  
  const compareParts = availableKey.split(':');
  if (compareParts.length < 3) return false;
  
  const compareCatId = compareParts.pop()?.toLowerCase();
  const compareCatType = compareParts.pop()?.toLowerCase();
  const compareAddonId = compareParts.join(':').toLowerCase();
  
  // Fuzzy addon match
  let addonMatches = false;
  if (compareAddonId === addonManifestId || addonManifestId.includes(compareAddonId) || compareAddonId.includes(addonManifestId)) {
    addonMatches = true;
  } else {
    const matchedAddon = activeAddons.find(a => (a.manifest?.id || a.id || '').toLowerCase() === compareAddonId);
    if (matchedAddon) {
      const settingsIsCinemeta = addonManifestId.includes('cinemeta') || addonManifestId.includes('linvo');
      if (settingsIsCinemeta && isCinemetaAddon(matchedAddon)) {
        addonMatches = true;
      }
      
      const settingsIsAio = addonManifestId.includes('aio') || addonManifestId.includes('genres');
      if (settingsIsAio && isAioMetadataAddon(matchedAddon)) {
        addonMatches = true;
      }
    }
  }
  
  if (!addonMatches) return false;
  
  const normSettingsType = catalogType === 'tv' ? 'series' : catalogType;
  const normCompareType = compareCatType === 'tv' ? 'series' : compareCatType;
  
  return normSettingsType === normCompareType && catalogId === compareCatId;
};

interface NuvioTabProps {
  showNuvioStreamBadges: boolean;
  onShowNuvioStreamBadgesChange: (show: boolean) => Promise<void> | void;
  nuvioBadgeSources: BadgeSource[];
  onNuvioBadgeSourcesChange: (sources: BadgeSource[]) => Promise<void> | void;
  nuvioBadgeSize: number;
  onNuvioBadgeSizeChange: (size: number) => Promise<void> | void;
  nuvioShowFileSizeBadges: boolean;
  onNuvioShowFileSizeBadgesChange: (show: boolean) => Promise<void> | void;
  nuvioStreamBadgePlacement: 'top' | 'bottom';
  onNuvioStreamBadgePlacementChange: (placement: 'top' | 'bottom') => Promise<void> | void;
  showNuvioHoverDetails: boolean;
  onShowNuvioHoverDetailsChange: (show: boolean) => Promise<void> | void;
}

export function NuvioTab({
  showNuvioStreamBadges,
  onShowNuvioStreamBadgesChange,
  nuvioBadgeSources,
  onNuvioBadgeSourcesChange,
  nuvioBadgeSize,
  onNuvioBadgeSizeChange,
  nuvioShowFileSizeBadges,
  onNuvioShowFileSizeBadgesChange,
  nuvioStreamBadgePlacement,
  onNuvioStreamBadgePlacementChange,
  showNuvioHoverDetails,
  onShowNuvioHoverDetailsChange,
}: NuvioTabProps) {
  const authStore = useNuvioAuthStore();
  const [pinPromptProfile, setPinPromptProfile] = useState<any | null>(null);
  const pluginStore = useNuvioPluginStore();
  const addonsStore = useNuvioAddonStore();
  const collectionStore = useNuvioCollectionStore();

  const token = authStore.token;
  const profile = authStore.activeProfile;

  // Badge import states
  const [badgeUrl, setBadgeUrl] = useState('');
  const [badgePaste, setBadgePaste] = useState('');
  const [badgeImportError, setBadgeImportError] = useState('');
  const [badgeImporting, setBadgeImporting] = useState(false);
  const [expandedSourceUrl, setExpandedSourceUrl] = useState<string | null>(null);

  const handleImportBadge = useCallback(async () => {
    setBadgeImportError('');
    const url = badgeUrl.trim();
    const paste = badgePaste.trim();
    if (!url && !paste) {
      setBadgeImportError('Enter a badge JSON URL or paste the JSON content.');
      return;
    }

    setBadgeImporting(true);
    try {
      let payloadStr = paste;
      let sourceUrl = url;
      let sourceName = '';
      if (paste) {
        sourceUrl = `pasted_${Date.now()}`;
        const pastedCount = nuvioBadgeSources.filter((s) => s.url.startsWith('pasted_')).length + 1;
        sourceName = `Pasted Rule ${pastedCount}`;
      } else {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          setBadgeImportError('URL must start with http:// or https://');
          setBadgeImporting(false);
          return;
        }
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        payloadStr = await resp.text();
        sourceName = url.split('/').pop() || url;
      }

      const payload = parseBadgePayload(payloadStr);
      const newSource: BadgeSource = {
        url: sourceUrl,
        name: sourceName,
        payload,
        isActive: true,
      };

      const updated = nuvioBadgeSources.filter(
        (s) => s.url.toLowerCase() !== newSource.url.toLowerCase(),
      );
      updated.push(newSource);

      await onNuvioBadgeSourcesChange(updated);
      setBadgeUrl('');
      setBadgePaste('');
    } catch (err: any) {
      setBadgeImportError(err?.message || 'Import failed');
    } finally {
      setBadgeImporting(false);
    }
  }, [badgeUrl, badgePaste, nuvioBadgeSources, onNuvioBadgeSourcesChange]);

  const handleToggleSource = useCallback(
    async (url: string) => {
      const updated = nuvioBadgeSources.map((s) => ({
        ...s,
        isActive: s.url === url ? !s.isActive : s.isActive,
      }));
      await onNuvioBadgeSourcesChange(updated);
    },
    [nuvioBadgeSources, onNuvioBadgeSourcesChange],
  );

  const handleDeleteSource = useCallback(
    async (url: string) => {
      const updated = nuvioBadgeSources.filter((s) => s.url !== url);
      await onNuvioBadgeSourcesChange(updated);
    },
    [nuvioBadgeSources, onNuvioBadgeSourcesChange],
  );

  // Add Addon State
  const [addonUrl, setAddonUrl] = useState('');
  const [addonError, setAddonError] = useState<string | null>(null);
  const [installingAddon, setInstallingAddon] = useState(false);

  // Auth Form State
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Profile creation state
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileColor, setNewProfileColor] = useState('#00d4ff');

  // Add Repository State
  const [repoUrl, setRepoUrl] = useState('');
  const [repoError, setRepoError] = useState<string | null>(null);

  // Nuvio Profile Settings States
  const [debridEnabled, setDebridEnabled] = useState(false);
  const [cloudLibEnabled, setCloudLibEnabled] = useState(true);
  const [preferredDebrid, setPreferredDebrid] = useState('');
  const [realDebridKey, setRealDebridKey] = useState('');
  const [premiumizeKey, setPremiumizeKey] = useState('');
  const [torboxKey, setTorboxKey] = useState('');

  const [tmdbEnabled, setTmdbEnabled] = useState(false);
  const [tmdbKey, setTmdbKey] = useState('');
  const [tmdbLang, setTmdbLang] = useState('en');

  // Homepage catalog settings states
  const [localCatalogItems, setLocalCatalogItems] = useState<any[]>([]);
  const [hideUnreleased, setHideUnreleased] = useState(false);
  const [hideUnderline, setHideUnderline] = useState(false);

  useEffect(() => {
    if (authStore.token) {
      authStore.fetchProfiles();
      if (authStore.activeProfile) {
        authStore.fetchSettings();
        authStore.fetchHomeCatalogSettings();
        const effectiveAddonProfileId =
          authStore.activeProfile.profile_index !== 1 && authStore.activeProfile.uses_primary_addons
            ? 1
            : authStore.activeProfile.profile_index;
        addonsStore.pullAddons(authStore.token, effectiveAddonProfileId);
      }
    }
  }, [authStore.token, authStore.activeProfile?.profile_index]);

  useEffect(() => {
    if (authStore.homeCatalogSettings) {
      setHideUnreleased(authStore.homeCatalogSettings.hide_unreleased_content || false);
      setHideUnderline(authStore.homeCatalogSettings.hide_catalog_underline || false);
    }
  }, [authStore.homeCatalogSettings]);


  useEffect(() => {
    const features = authStore.settings?.features || {};
    const debrid = features.debrid_settings || {};
    const tmdb = features.tmdb_settings || {};

    setDebridEnabled(debrid.enabled || false);
    setCloudLibEnabled(debrid.cloudLibraryEnabled !== false);
    setPreferredDebrid(debrid.preferredResolverProviderId || '');
    
    const apiKeys = debrid.providerApiKeys || {};
    setRealDebridKey(apiKeys.realdebrid || '');
    setPremiumizeKey(apiKeys.premiumize || '');
    setTorboxKey(apiKeys.torbox || '');

    setTmdbEnabled(tmdb.enabled || false);
    setTmdbKey(tmdb.apiKey || '');
    setTmdbLang(tmdb.language || 'en');
  }, [authStore.settings]);

  // Derive catalog lists
  const collections = collectionStore.collections || [];
  const activeAddons = addonsStore.enabledAddons || [];

  const collectionsList = useMemo(() => {
    return collections.map(c => ({
      key: `collection_${c.id}`,
      title: c.title,
      subtitle: `${c.folders?.length || 0} folders`,
      isCollection: true,
      collectionId: c.id,
      addonName: 'Collection'
    }));
  }, [collections]);

  const catalogsList = useMemo(() => {
    const list: any[] = [];
    activeAddons.forEach(addon => {
      addon.manifest?.catalogs?.forEach(catalog => {
        if (catalog.extra?.some(e => e.isRequired)) return;
        list.push({
          key: `${addon.manifest.id || addon.id}:${catalog.type}:${catalog.id}`,
          title: catalog.name,
          subtitle: `${catalog.type.charAt(0).toUpperCase() + catalog.type.slice(1)} catalog`,
          isCollection: false,
          addonName: addon.manifest.name,
          addonId: addon.manifest.id || addon.id,
          type: catalog.type,
          catalogId: catalog.id
        });
      });
    });
    return list;
  }, [activeAddons]);

  const mergedItems = useMemo(() => {
    const allAvailable = [...collectionsList, ...catalogsList];
    const settingsItems = authStore.homeCatalogSettings?.items || [];
    
    const result: any[] = [];
    const usedKeys = new Set<string>();
    
    const sortedSettings = [...settingsItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    sortedSettings.forEach(sItem => {
      const key = sItem.isCollection 
        ? `collection_${sItem.collectionId}` 
        : `${sItem.addonId}:${sItem.type}:${sItem.catalogId}`;
        
      let availableItem: any = null;
      if (sItem.isCollection) {
        availableItem = collectionsList.find(c => c.key === key);
      } else {
        availableItem = catalogsList.find(c => {
          const settingsKey = `${sItem.addonId}:${sItem.type}:${sItem.catalogId}`;
          return matchCatalogKey(settingsKey, c.key, activeAddons);
        });
      }
      
      if (availableItem) {
        result.push({
          ...availableItem,
          enabled: sItem.enabled !== false,
          customTitle: sItem.customTitle || '',
          order: sItem.order ?? 999
        });
        usedKeys.add(availableItem.key);
      }
    });
    
    allAvailable.forEach(item => {
      if (!usedKeys.has(item.key)) {
        result.push({
          ...item,
          enabled: true,
          customTitle: '',
          order: result.length
        });
      }
    });
    
    return result.map((item, idx) => ({ ...item, order: idx }));
  }, [collectionsList, catalogsList, authStore.homeCatalogSettings, activeAddons]);

  useEffect(() => {
    setLocalCatalogItems(mergedItems);
  }, [mergedItems]);

  const handleToggleItem = (key: string) => {
    const updated = localCatalogItems.map(item => 
      item.key === key ? { ...item, enabled: !item.enabled } : item
    );
    setLocalCatalogItems(updated);
  };

  const handleCustomTitleChange = (key: string, title: string) => {
    const updated = localCatalogItems.map(item => 
      item.key === key ? { ...item, customTitle: title } : item
    );
    setLocalCatalogItems(updated);
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= localCatalogItems.length) return;
    
    const updated = [...localCatalogItems];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    
    const reordered = updated.map((item, idx) => ({ ...item, order: idx }));
    setLocalCatalogItems(reordered);
  };

  const handleSaveCatalogSettings = async () => {
    try {
      const itemsPayload = localCatalogItems.map(item => {
        if (item.isCollection) {
          return {
            addon_id: '',
            type: '',
            catalog_id: '',
            enabled: item.enabled,
            order: item.order,
            custom_title: item.customTitle.trim(),
            is_collection: true,
            collection_id: item.collectionId
          };
        } else {
          return {
            addon_id: item.addonId,
            type: item.type,
            catalog_id: item.catalogId,
            enabled: item.enabled,
            order: item.order,
            custom_title: item.customTitle.trim(),
            is_collection: false,
            collection_id: ''
          };
        }
      });
      
      const payload = {
        hide_unreleased_content: hideUnreleased,
        hide_catalog_underline: hideUnderline,
        items: itemsPayload
      };
      
      await authStore.updateHomeCatalogSettings(payload);
      alert('Homepage catalog settings saved and synced successfully!');
    } catch (e: any) {
      alert(e.message || 'Failed to save homepage catalog settings');
    }
  };

  const handleResetCatalogSettings = async () => {
    if (confirm('Are you sure you want to reset homepage catalog settings to defaults?')) {
      try {
        const payload = {
          hide_unreleased_content: false,
          hide_catalog_underline: false,
          items: []
        };
        await authStore.updateHomeCatalogSettings(payload);
        alert('Homepage catalog settings reset to defaults.');
      } catch (e: any) {
        alert(e.message || 'Failed to reset settings');
      }
    }
  };

  const handleSaveSettings = async () => {
    try {
      const updatedDebrid = {
        enabled: debridEnabled,
        cloudLibraryEnabled: cloudLibEnabled,
        preferredResolverProviderId: preferredDebrid,
        providerApiKeys: {
          realdebrid: realDebridKey.trim(),
          premiumize: premiumizeKey.trim(),
          torbox: torboxKey.trim()
        }
      };

      const updatedTmdb = {
        enabled: tmdbEnabled,
        apiKey: tmdbKey.trim(),
        language: tmdbLang.trim() || 'en'
      };

      await authStore.updateSettings({
        debrid_settings: updatedDebrid,
        tmdb_settings: updatedTmdb
      });
      alert('Settings saved and synced to Nuvio cloud successfully!');
    } catch (e: any) {
      alert(e.message || 'Failed to save settings');
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email || !password) {
      setAuthError('Please fill in all fields.');
      return;
    }
    try {
      if (isLoginMode) {
        await authStore.login(email, password);
      } else {
        await authStore.signup(email, password);
      }
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
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

  const handleAddAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddonError(null);
    if (!addonUrl.trim()) return;
    if (!token || !profile) {
      setAddonError('Please select an active profile first.');
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
    if (confirm('Are you sure you want to uninstall this addon?')) {
      try {
        await addonsStore.removeAddon(token, profile.profile_index, addonId);
      } catch (err: any) {
        alert(err.message || 'Failed to remove addon');
      }
    }
  };

  const handleAddRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    setRepoError(null);
    if (!repoUrl.trim()) return;
    try {
      await pluginStore.addRepository(repoUrl);
      setRepoUrl('');
    } catch (err: any) {
      setRepoError(err.message || 'Failed to add repository');
    }
  };

  const defaultColors = ['#00d4ff', '#ff007f', '#a020f0', '#00ff7f', '#ffaa00', '#ff0000', '#0088ff', '#ffffff'];

  return (
    <div className="settings-tab-content" style={{ color: '#fff' }}>
      {/* 1. Header & Dynamic Server Sync Info */}
      <div className="settings-section">
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 600 }}>Nuvio Integration</h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
          Nuvio is a media synchronization and plugin platform. Log in to sync collections, profiles, and run custom scrapers.
        </p>



        {/* 2. AUTH STATUS OR LOGIN FORM */}
        {!authStore.token ? (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', fontWeight: 600 }}>
              {isLoginMode ? 'Sign In to Nuvio' : 'Create a Nuvio Account'}
            </h4>
            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '10px',
                    fontSize: '0.85rem',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '10px',
                    fontSize: '0.85rem',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              {authError && (
                <div style={{ color: '#ff4f4f', fontSize: '0.75rem', marginTop: '2px' }}>
                  {authError}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                <button
                  type="submit"
                  disabled={authStore.isSyncing}
                  style={{
                    background: 'linear-gradient(135deg, #00d4ff, #0088ff)',
                    border: 'none',
                    color: '#000',
                    borderRadius: '6px',
                    padding: '10px 20px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: authStore.isSyncing ? 'not-allowed' : 'pointer',
                    opacity: authStore.isSyncing ? 0.7 : 1
                  }}
                >
                  {authStore.isSyncing ? 'Authenticating...' : isLoginMode ? 'Login' : 'Sign Up'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsLoginMode(!isLoginMode)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  {isLoginMode ? "Need an account? Register" : "Have an account? Login"}
                </button>
              </div>
            </form>
            <p style={{
              margin: '14px 0 0 0',
              fontSize: '0.7rem',
              color: 'rgba(255,255,255,0.35)',
              lineHeight: 1.5,
              textAlign: 'center'
            }}>
              Disclaimer: ynoTV is an independent open source desktop client and is not affiliated with or endorsed by Nuvio. Your login credentials are only used to connect to Nuvio's servers directly to sync &mdash; ynoTV never stores or transmits them.
            </p>
          </div>
        ) : (
          <div>
            {/* Logged in state */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.05em' }}>SIGNED IN AS</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>{authStore.user?.email}</div>
                {authStore.lastSyncTime && (
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
                    Synced: {new Date(authStore.lastSyncTime).toLocaleTimeString()}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => authStore.syncNow()}
                  disabled={authStore.isSyncing}
                  style={{
                    background: 'rgba(0,212,255,0.12)',
                    border: '1px solid rgba(0,212,255,0.25)',
                    color: '#00d4ff',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: authStore.isSyncing ? 'not-allowed' : 'pointer'
                  }}
                >
                  {authStore.isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <button
                  onClick={() => authStore.logout()}
                  style={{
                    background: 'rgba(255,79,79,0.12)',
                    border: '1px solid rgba(255,79,79,0.25)',
                    color: '#ff4f4f',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Sign Out
                </button>
              </div>
            </div>

            {/* Profiles Section */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Profiles ({authStore.profiles.length}/4)</h4>
                {authStore.profiles.length < 4 && !showCreateProfile && (
                  <button
                    onClick={() => setShowCreateProfile(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#00d4ff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    + Add Profile
                  </button>
                )}
              </div>

              {showCreateProfile && (
                <form onSubmit={handleCreateProfileSubmit} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  padding: '14px',
                  marginBottom: '12px',
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
                      style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '6px',
                        padding: '8px',
                        fontSize: '0.8rem',
                        color: '#fff',
                        outline: 'none'
                      }}
                    />
                    <input
                      type="color"
                      value={newProfileColor}
                      onChange={(e) => setNewProfileColor(e.target.value)}
                      style={{
                        background: 'none',
                        border: 'none',
                        width: '32px',
                        height: '32px',
                        cursor: 'pointer',
                        padding: 0
                      }}
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
                    <button
                      type="button"
                      onClick={() => setShowCreateProfile(false)}
                      style={{
                        background: 'none',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.7)',
                        borderRadius: '4px',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{
                        background: '#00d4ff',
                        border: 'none',
                        color: '#000',
                        borderRadius: '4px',
                        padding: '4px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Create
                    </button>
                  </div>
                </form>
              )}

              {/* Profiles List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {authStore.profiles.map((p) => {
                  const isActive = authStore.activeProfile?.profile_index === p.profile_index;
                  return (
                    <div
                      key={p.profile_index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        background: isActive ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isActive ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.04)'}`,
                      }}
                    >
                      <div
                        onClick={() => {
                          if (!isActive) {
                            if (p.pin_enabled) {
                              setPinPromptProfile(p);
                            } else {
                              authStore.selectProfile(p.profile_index);
                            }
                          }
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: isActive ? 'default' : 'pointer' }}
                      >
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: p.avatar_color_hex || '#00d4ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '1rem',
                          color: '#000'
                        }}>
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span style={{ fontSize: '0.85rem', fontWeight: isActive ? 600 : 500, color: isActive ? '#fff' : 'rgba(255,255,255,0.85)' }}>
                            {p.name}
                          </span>
                          {isActive && (
                            <span style={{
                              marginLeft: '8px',
                              fontSize: '0.62rem',
                              background: '#00d4ff',
                              color: '#000',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 700
                            }}>
                              ACTIVE
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {authStore.profiles.length > 1 && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete profile "${p.name}"? This deletes all synced data for this profile.`)) {
                                authStore.deleteProfile(p.profile_index);
                              }
                            }}
                            title="Delete profile data"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'rgba(255,79,79,0.5)',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Profile Cloud Settings Section */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                Profile Cloud Settings
              </h4>
              <p style={{ margin: '0 0 20px 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>
                Configure Debrid caching services and TMDB metadata enrichment synced directly with Nuvio's cloud profile.
              </p>

              {/* TMDB SECTION */}
              <div style={{ marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>TMDB Metadata Enrichment</span>
                  <label className="toggle-switch" style={{ transform: 'scale(0.85)' }}>
                    <input
                      type="checkbox"
                      checked={tmdbEnabled}
                      onChange={(e) => setTmdbEnabled(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                
                {tmdbEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>TMDB API Read Access Token</label>
                      <input
                        type="password"
                        placeholder="eyJhbGciOiJIUzI1Ni..."
                        value={tmdbKey}
                        onChange={(e) => setTmdbKey(e.target.value)}
                        className="nuvio-input"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Metadata Language</label>
                      <input
                        type="text"
                        placeholder="en"
                        value={tmdbLang}
                        onChange={(e) => setTmdbLang(e.target.value)}
                        className="nuvio-input"
                        style={{ width: '80px' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* DEBRID SECTION */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Debrid Link Resolving</span>
                  <label className="toggle-switch" style={{ transform: 'scale(0.85)' }}>
                    <input
                      type="checkbox"
                      checked={debridEnabled}
                      onChange={(e) => setDebridEnabled(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                {debridEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Enable Cloud Library Cache</span>
                      <label className="toggle-switch" style={{ transform: 'scale(0.75)' }}>
                        <input
                          type="checkbox"
                          checked={cloudLibEnabled}
                          onChange={(e) => setCloudLibEnabled(e.target.checked)}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Preferred Debrid Provider</label>
                      <select
                        value={preferredDebrid}
                        onChange={(e) => setPreferredDebrid(e.target.value)}
                        className="nuvio-input"
                        style={{ width: '100%', padding: '9px 12px' }}
                      >
                        <option value="">None (Disable resolving)</option>
                        <option value="realdebrid">Real-Debrid</option>
                        <option value="premiumize">Premiumize</option>
                        <option value="torbox">Torbox</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>PROVIDER API KEYS</span>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Real-Debrid API Key</label>
                        <input
                          type="password"
                          placeholder="Real-Debrid Token"
                          value={realDebridKey}
                          onChange={(e) => setRealDebridKey(e.target.value)}
                          className="nuvio-input"
                          style={{ width: '100%', background: 'rgba(0,0,0,0.2)' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Premiumize API Key</label>
                        <input
                          type="password"
                          placeholder="Premiumize Token/PIN"
                          value={premiumizeKey}
                          onChange={(e) => setPremiumizeKey(e.target.value)}
                          className="nuvio-input"
                          style={{ width: '100%', background: 'rgba(0,0,0,0.2)' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Torbox API Key</label>
                        <input
                          type="password"
                          placeholder="Torbox Token"
                          value={torboxKey}
                          onChange={(e) => setTorboxKey(e.target.value)}
                          className="nuvio-input"
                          style={{ width: '100%', background: 'rgba(0,0,0,0.2)' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SAVE BUTTON */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={authStore.isSyncing}
                  style={{
                    background: 'linear-gradient(135deg, #00d4ff, #0088ff)',
                    border: 'none',
                    color: '#000',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: authStore.isSyncing ? 'not-allowed' : 'pointer',
                    opacity: authStore.isSyncing ? 0.7 : 1
                  }}
                >
                  {authStore.isSyncing ? 'Saving to Cloud...' : 'Save Profile Settings'}
                </button>
              </div>
            </div>

            {/* Homepage Layout Customization */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '8px',
              padding: '20px',
              marginTop: '20px',
              marginBottom: '24px'
            }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                Homepage Layout Customization
              </h4>
              <p style={{ margin: '0 0 20px 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>
                Customize which catalog rows (from your collections or addons) appear on your homepage and rearrange their display order.
              </p>

              {/* Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Hide Unreleased Content</span>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Filter out movies/shows that haven't aired or released yet.</div>
                  </div>
                  <label className="toggle-switch" style={{ transform: 'scale(0.85)' }}>
                    <input
                      type="checkbox"
                      checked={hideUnreleased}
                      onChange={(e) => setHideUnreleased(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Hide Catalog Underline</span>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Hide the horizontal indicator line beneath catalog titles.</div>
                  </div>
                  <label className="toggle-switch" style={{ transform: 'scale(0.85)' }}>
                    <input
                      type="checkbox"
                      checked={hideUnderline}
                      onChange={(e) => setHideUnderline(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>

              {/* Continue Watching Style */}
              <div style={{ marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: '4px' }}>Continue Watching Style</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>Choose how continue watching items are displayed.</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['card', 'wide', 'poster'].map((style) => {
                    const current = localStorage.getItem('nuvio_cw_style') || 'card';
                    return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => localStorage.setItem('nuvio_cw_style', style)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: current === style ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
                          border: current === style ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.08)',
                          color: current === style ? '#00d4ff' : 'rgba(255,255,255,0.7)',
                          textTransform: 'capitalize',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {style}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hero Catalog Sources */}
              <div style={{ marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: '4px' }}>Hero Banner Sources</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>
                  Select up to 2 catalogs to feature in the hero banner at the top of the home page. Items will be randomly picked from these catalogs.
                </div>
                  {(() => {
                  // Normalize: handle old string[] format too
                  const raw: any[] = JSON.parse(localStorage.getItem('nuvio_hero_catalogs') || '[]');
                  const heroEntries: { key: string; baseUrl: string }[] = raw.map((e: any) =>
                    typeof e === 'string' ? { key: e, baseUrl: '' } : e
                  );
                  const selectedKeys = heroEntries.map(e => e.key);
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: selectedKeys.length >= 2 ? '#ff4f4f' : 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
                          {selectedKeys.length}/2 selected
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.setItem('nuvio_hero_catalogs', '[]');
                            window.dispatchEvent(new Event('nuvioHeroCatalogsChanged'));
                          }}
                          style={{
                            background: 'rgba(255,79,79,0.1)',
                            border: '1px solid rgba(255,79,79,0.2)',
                            color: '#ff4f4f',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                          }}
                        >
                          Reset Selection
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                        {catalogsList.map((cat) => {
                          const isSelected = selectedKeys.includes(cat.key);
                          const atLimit = selectedKeys.length >= 2;
                          return (
                            <label
                              key={cat.key}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                background: isSelected ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
                                border: isSelected ? '1px solid rgba(0,212,255,0.2)' : '1px solid rgba(255,255,255,0.04)',
                                cursor: atLimit && !isSelected ? 'not-allowed' : 'pointer',
                                opacity: atLimit && !isSelected ? 0.4 : 1,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={atLimit && !isSelected}
                                onChange={() => {
                                  const raw: any[] = JSON.parse(localStorage.getItem('nuvio_hero_catalogs') || '[]');
                                  const current: { key: string; baseUrl: string }[] = raw.map((e: any) =>
                                    typeof e === 'string' ? { key: e, baseUrl: '' } : e
                                  );
                                  if (isSelected) {
                                    localStorage.setItem('nuvio_hero_catalogs', JSON.stringify(current.filter((e) => e.key !== cat.key)));
                                  } else if (current.length < 2) {
                                    // Find the addon's baseUrl
                                    const addon = activeAddons.find(a => (a.manifest?.id || a.id) === cat.addonId);
                                    const baseUrl = addon?.baseUrl || cat.addonId;
                                    localStorage.setItem('nuvio_hero_catalogs', JSON.stringify([...current, { key: cat.key, baseUrl }]));
                                  }
                                  window.dispatchEvent(new Event('nuvioHeroCatalogsChanged'));
                                }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 500, color: isSelected ? '#fff' : 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {cat.title || cat.catalogId}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>
                                  {cat.addonName} · {cat.type}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                        {catalogsList.length === 0 && (
                          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', padding: '10px 0' }}>
                            No catalogs available. Install addons first.
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Catalog Rows list */}
              {localCatalogItems.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '4px', letterSpacing: '0.05em' }}>
                    CATALOG DISPLAY ORDER & VISIBILITY
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                    {localCatalogItems.map((item, index) => (
                      <div
                        key={item.key}
                        style={{
                          background: item.enabled ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.005)',
                          border: '1px solid rgba(255,255,255,0.04)',
                          borderRadius: '6px',
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          opacity: item.enabled ? 1 : 0.6
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                          {/* Reordering arrows */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <button
                              type="button"
                              onClick={() => handleMoveItem(index, 'up')}
                              disabled={index === 0}
                              style={{ background: 'none', border: 'none', color: index === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)', cursor: index === 0 ? 'default' : 'pointer', fontSize: '0.8rem', padding: '0 4px', lineHeight: 1 }}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveItem(index, 'down')}
                              disabled={index === localCatalogItems.length - 1}
                              style={{ background: 'none', border: 'none', color: index === localCatalogItems.length - 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)', cursor: index === localCatalogItems.length - 1 ? 'default' : 'pointer', fontSize: '0.8rem', padding: '0 4px', lineHeight: 1 }}
                            >
                              ▼
                            </button>
                          </div>
                          
                          {/* Item Details */}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <input
                              type="text"
                              value={item.customTitle !== undefined ? (item.customTitle || item.title) : item.title}
                              placeholder={item.title}
                              onChange={(e) => handleCustomTitleChange(item.key, e.target.value)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                borderBottom: '1px dashed rgba(255,255,255,0.15)',
                                color: '#fff',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                padding: '2px 0',
                                width: '90%',
                                outline: 'none'
                              }}
                            />
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {item.addonName} · {item.subtitle}
                            </div>
                          </div>
                        </div>

                        {/* Enabled Switch */}
                        <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={() => handleToggleItem(item.key)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '6px' }}>
                  No collections or catalogs available. Install addons or create collections first.
                </div>
              )}

              {/* SAVE / RESET ACTIONS */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={handleResetCatalogSettings}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255,79,79,0.2)',
                    color: '#ff4f4f',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Reset Layout Defaults
                </button>
                <button
                  type="button"
                  onClick={handleSaveCatalogSettings}
                  disabled={authStore.isSyncing}
                  style={{
                    background: 'linear-gradient(135deg, #00d4ff, #0088ff)',
                    border: 'none',
                    color: '#000',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: authStore.isSyncing ? 'not-allowed' : 'pointer',
                    opacity: authStore.isSyncing ? 0.7 : 1
                  }}
                >
                  {authStore.isSyncing ? 'Saving Layout...' : 'Save Homepage Layout'}
                </button>
              </div>
            </div>

            {/* Addons Section */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', marginTop: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600 }}>Nuvio Addons</h4>
              
              {/* Install Addon form */}
              <form onSubmit={handleAddAddon} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Install Addon Manifest URL (e.g. https://.../manifest.json)"
                  value={addonUrl}
                  onChange={(e) => setAddonUrl(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '0.8rem',
                    color: '#fff',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={installingAddon || !addonUrl.trim()}
                  style={{
                    background: 'rgba(0,212,255,0.15)',
                    border: '1px solid rgba(0,212,255,0.3)',
                    color: '#00d4ff',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: installingAddon ? 'not-allowed' : 'pointer'
                  }}
                >
                  {installingAddon ? 'Installing...' : 'Install'}
                </button>
              </form>
              {addonError && <div style={{ color: '#ff4f4f', fontSize: '0.75rem', marginBottom: '14px' }}>{addonError}</div>}
              {addonsStore.error && <div style={{ color: '#ff4f4f', fontSize: '0.75rem', marginBottom: '14px' }}>{addonsStore.error}</div>}

              {/* Installed Addons list */}
              {addonsStore.addons.length > 0 ? (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                    INSTALLED ADDONS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {addonsStore.addons.map((addon) => (
                      <div
                        key={`${addon.id}-${addon.baseUrl}`}
                        style={{
                          background: 'rgba(255,255,255,0.01)',
                          border: '1px solid rgba(255,255,255,0.04)',
                          borderRadius: '8px',
                          padding: '12px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
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
                          <button
                            onClick={() => handleToggleAddon(addon.id)}
                            style={{
                              background: 'none',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: 'rgba(255,255,255,0.7)',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '0.7rem',
                              cursor: 'pointer'
                            }}
                          >
                            {addon.enabled === false ? 'Enable' : 'Disable'}
                          </button>
                          <button
                            onClick={() => handleRemoveAddon(addon.id)}
                            style={{
                              background: 'none',
                              border: '1px solid rgba(255,79,79,0.25)',
                              color: '#ff4f4f',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '0.7rem',
                              cursor: 'pointer'
                            }}
                          >
                            Uninstall
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '24px 0',
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: '0.8rem',
                  border: '1px dashed rgba(255,255,255,0.06)',
                  borderRadius: '8px'
                }}>
                  No addons installed yet.
                </div>
              )}
            </div>

            {/* Plugin Scrapers Section */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', marginTop: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600 }}>Nuvio Scrapers / Plugins</h4>
              
              {/* Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <div className="retry-setting-row" style={{ borderBottom: 'none', padding: 0 }}>
                  <div className="timeshift-toggle-info">
                    <span className="timeshift-toggle-label" style={{ fontSize: '0.85rem' }}>Enable Plugin Scrapers</span>
                    <span className="timeshift-toggle-sub" style={{ fontSize: '0.75rem' }}>Use installed Nuvio scrapers when looking for media streams.</span>
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

                <div className="retry-setting-row" style={{ borderBottom: 'none', padding: 0 }}>
                  <div className="timeshift-toggle-info">
                    <span className="timeshift-toggle-label" style={{ fontSize: '0.85rem' }}>Group Streams by Repository</span>
                    <span className="timeshift-toggle-sub" style={{ fontSize: '0.75rem' }}>Group streams by their originating plugin scraper repo in the stream picker.</span>
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

              {/* Install repository form */}
              <form onSubmit={handleAddRepository} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Install Plugin Manifest URL (e.g. https://.../manifest.json)"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '0.8rem',
                    color: '#fff',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={pluginStore.isLoading}
                  style={{
                    background: 'rgba(0,212,255,0.15)',
                    border: '1px solid rgba(0,212,255,0.3)',
                    color: '#00d4ff',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: pluginStore.isLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Install
                </button>
              </form>
              {repoError && <div style={{ color: '#ff4f4f', fontSize: '0.75rem', marginBottom: '14px' }}>{repoError}</div>}
              {pluginStore.error && <div style={{ color: '#ff4f4f', fontSize: '0.75rem', marginBottom: '14px' }}>{pluginStore.error}</div>}

              {/* Installed Repositories list */}
              {pluginStore.repositories.length > 0 ? (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                    INSTALLED REPOSITORIES
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pluginStore.repositories.map((repo) => {
                      const repoScrapers = pluginStore.scrapers.filter(s => s.repositoryUrl === repo.manifestUrl);
                      return (
                        <div
                          key={repo.manifestUrl}
                          style={{
                            background: 'rgba(255,255,255,0.01)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            borderRadius: '8px',
                            padding: '12px 14px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ overflow: 'hidden', marginRight: '10px' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
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
                              <button
                                onClick={() => pluginStore.refreshRepository(repo.manifestUrl)}
                                disabled={repo.isRefreshing}
                                style={{
                                  background: 'none',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  color: 'rgba(255,255,255,0.7)',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  fontSize: '0.7rem',
                                  cursor: repo.isRefreshing ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {repo.isRefreshing ? 'Refreshing...' : 'Refresh'}
                              </button>
                              <button
                                onClick={() => pluginStore.removeRepository(repo.manifestUrl)}
                                style={{
                                  background: 'none',
                                  border: '1px solid rgba(255,79,79,0.25)',
                                  color: '#ff4f4f',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  fontSize: '0.7rem',
                                  cursor: 'pointer'
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          {repo.errorMessage && (
                            <div style={{ color: '#ff4f4f', fontSize: '0.7rem', marginTop: '6px' }}>
                              Error: {repo.errorMessage}
                            </div>
                          )}

                          {/* Scrapers in repository */}
                          {repoScrapers.length > 0 && (
                            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', marginBottom: '6px' }}>
                                SCRAPERS
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {repoScrapers.map((scraper) => (
                                  <div
                                    key={scraper.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      background: 'rgba(255,255,255,0.01)',
                                      borderRadius: '4px',
                                      padding: '6px 8px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {scraper.logo ? (
                                        <img src={scraper.logo} alt="" style={{ width: '16px', height: '16px', borderRadius: '2px', objectFit: 'contain' }} />
                                      ) : (
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00d4ff' }} />
                                      )}
                                      <div>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 500, color: scraper.enabled ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                                          {scraper.name}
                                        </span>
                                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginLeft: '6px' }}>
                                          v{scraper.version}
                                        </span>
                                      </div>
                                    </div>
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
                </div>
              ) : (
                <div style={{
                  padding: '24px 0',
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: '0.8rem',
                  border: '1px dashed rgba(255,255,255,0.06)',
                  borderRadius: '8px'
                }}>
                  No plugin repositories installed yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hover Details toggle for Nuvio */}
      <div className="retry-setting-row">
        <div className="timeshift-toggle-info">
          <span className="timeshift-toggle-label">Hover Details</span>
          <span className="timeshift-toggle-sub">Show hover cards with details when hovering over items in Nuvio catalogs.</span>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={showNuvioHoverDetails}
            onChange={(e) => onShowNuvioHoverDetailsChange(e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {/* Stream Badges section for Nuvio */}
      <div className="settings-section" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '24px', marginTop: '24px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
          Stream Badges (Nuvio)
        </h3>
        <p style={{ margin: '0 0 12px 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
          Show quality, codec, HDR, and audio badges on Nuvio stream links, or import custom rules.
        </p>

        <div className="retry-setting-row" style={{ borderBottom: 'none' }}>
          <div className="timeshift-toggle-info">
            <span className="timeshift-toggle-label">Enable Badges</span>
            <span className="timeshift-toggle-sub">Toggle stream badges on or off for Nuvio streams.</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={showNuvioStreamBadges}
              onChange={(e) => onShowNuvioStreamBadgesChange(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {showNuvioStreamBadges && (
          <>
            <div className="retry-setting-row" style={{ borderBottom: 'none', marginTop: '12px' }}>
              <div className="timeshift-toggle-info">
                <span className="timeshift-toggle-label">Show File Size Badges</span>
                <span className="timeshift-toggle-sub">Display the video file size badge if available.</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={nuvioShowFileSizeBadges}
                  onChange={(e) => onNuvioShowFileSizeBadgesChange(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="retry-setting-row" style={{ borderBottom: 'none', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="timeshift-toggle-info">
                <span className="timeshift-toggle-label">Badge Position</span>
                <span className="timeshift-toggle-sub">Render badges above or below the Nuvio stream title.</span>
              </div>
              <select
                value={nuvioStreamBadgePlacement}
                onChange={(e) => onNuvioStreamBadgePlacementChange(e.target.value as 'top' | 'bottom')}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.85)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '0.8rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="bottom" style={{ background: '#1a1a1a' }}>Bottom (Below Title)</option>
                <option value="top" style={{ background: '#1a1a1a' }}>Top (Above Title)</option>
              </select>
            </div>

            <div className="retry-setting-row" style={{ borderBottom: 'none', flexDirection: 'column', alignItems: 'stretch', gap: '10px', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span className="timeshift-toggle-label" style={{ fontSize: '0.85rem' }}>Badge Scale ({nuvioBadgeSize}%)</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                <input
                  type="range"
                  min="80"
                  max="180"
                  step="5"
                  value={nuvioBadgeSize}
                  onChange={(e) => onNuvioBadgeSizeChange(Number(e.target.value))}
                  style={{
                    flex: 1,
                    accentColor: '#00d4ff',
                    cursor: 'pointer',
                    height: '6px',
                    borderRadius: '3px',
                    background: 'rgba(255,255,255,0.1)',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.05em' }}>
                  LIVE PREVIEW (NUVIO BADGES)
                </div>
                <div className="stremio-detail-stream-badges" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', '--stremio-badge-scale': String(nuvioBadgeSize / 100) } as React.CSSProperties}>
                  <span className="stremio-stream-badge-img" style={{ backgroundColor: '#ffffff', borderColor: '#ffffff' }}>
                    <img src="https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/4k.png" alt="4K" />
                  </span>
                  <span className="stremio-stream-badge-img" style={{ backgroundColor: '#ffffff', borderColor: '#ffffff' }}>
                    <img src="https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/HDR.png" alt="HDR" />
                  </span>
                  <span className="stremio-stream-badge-img" style={{ backgroundColor: '#ffffff', borderColor: '#ffffff' }}>
                    <img src="https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images%20w:o%20logo/webdl-black.png" alt="WEB-DL" />
                  </span>
                  <span className="stremio-stream-badge-img" style={{ backgroundColor: '#ffffff', borderColor: '#ffffff' }}>
                    <img src="https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/51.png" alt="5.1" />
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Fusion Badge Rules Importer */}
        <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
            Fusion Badges / Custom Rules
          </div>

          <input
            type="text"
            placeholder="Fusion Badge JSON URL (e.g. https://pastebin.com/raw/...)"
            value={badgeUrl}
            onChange={(e) => setBadgeUrl(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.85)',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '0.8rem',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '8px',
            }}
          />

          <textarea
            placeholder="Or paste badge JSON directly..."
            value={badgePaste}
            onChange={(e) => setBadgePaste(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.85)',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'vertical',
              marginBottom: '8px',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={handleImportBadge}
              disabled={badgeImporting}
              style={{
                background: 'rgba(0, 212, 255, 0.15)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                color: '#00d4ff',
                borderRadius: '6px',
                padding: '7px 16px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: badgeImporting ? 'not-allowed' : 'pointer',
                opacity: badgeImporting ? 0.6 : 1,
              }}
            >
              {badgeImporting ? 'Importing...' : 'Import'}
            </button>
            {badgeImportError && (
              <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{badgeImportError}</span>
            )}
          </div>

          {/* Imported Sources List */}
          {nuvioBadgeSources.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                IMPORTED SOURCES
              </div>
              {nuvioBadgeSources.map((source) => {
                const isExpanded = expandedSourceUrl === source.url;
                return (
                  <div
                    key={source.url}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${source.isActive ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.04)'}`,
                      marginBottom: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div
                        onClick={() => setExpandedSourceUrl(isExpanded ? null : source.url)}
                        style={{ flex: 1, overflow: 'hidden', cursor: 'pointer' }}
                      >
                        <div style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: 'rgba(255,255,255,0.85)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                          <span>{source.name}</span>
                          <span style={{
                            fontSize: '0.55rem',
                            color: 'rgba(255,255,255,0.3)',
                            transform: isExpanded ? 'rotate(90deg)' : 'none',
                            transition: 'transform 0.15s',
                            display: 'inline-block',
                          }}>
                            ▶
                          </span>
                        </div>
                        <div style={{
                          fontSize: '0.65rem',
                          color: 'rgba(255,255,255,0.35)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {source.payload.filters.length} filters · {source.payload.groups.length} groups
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginLeft: '8px' }}>
                        <button
                          onClick={() => handleToggleSource(source.url)}
                          title={source.isActive ? 'Active' : 'Click to activate'}
                          style={{
                            background: source.isActive ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${source.isActive ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                            color: source.isActive ? '#00d4ff' : 'rgba(255,255,255,0.4)',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {source.isActive ? 'Active' : 'Inactive'}
                        </button>
                        {!source.isDefault && (
                          <button
                            onClick={() => handleDeleteSource(source.url)}
                            title="Remove"
                            style={{
                              background: 'rgba(239,68,68,0.1)',
                              border: '1px solid rgba(239,68,68,0.2)',
                              color: '#ef4444',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.03em' }}>
                          PREVIEW BADGES ({source.payload.filters.length}):
                        </div>
                        <div className="stremio-detail-stream-badges" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', '--stremio-badge-scale': 'var(--nuvio-badge-scale, 1)' } as React.CSSProperties}>
                          {source.payload.filters.map((filter, fIdx) => {
                            const bgColor = convertArgbToRgba(filter.tagColor) || '#1a1a1a';
                            const isLightBg = isLightColor(bgColor);
                            const textColor = convertArgbToRgba(filter.textColor) || (isLightBg ? '#000000' : '#ffffff');
                            const borderColor = convertArgbToRgba(filter.borderColor) || 'transparent';

                            return filter.imageURL ? (
                              <span
                                key={filter.id || fIdx}
                                className="stremio-stream-badge-img"
                                style={{
                                  backgroundColor: bgColor,
                                  borderColor: borderColor,
                                }}
                              >
                                <img src={filter.imageURL} alt={filter.name} title={filter.name} />
                              </span>
                            ) : (
                              <span
                                key={filter.id || fIdx}
                                className="stremio-stream-badge"
                                style={{
                                  backgroundColor: bgColor,
                                  color: textColor,
                                  borderColor: borderColor,
                                }}
                              >
                                {filter.name}
                              </span>
                            );
                          })}
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

      {pinPromptProfile && (
        <NuvioPinModal
          profile={pinPromptProfile}
          onClose={() => setPinPromptProfile(null)}
        />
      )}
    </div>
  );
}

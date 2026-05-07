import { useState, useEffect, useCallback } from 'react';
import type { SavedLayoutState } from './useLayoutPersistence';
import type { ShortcutsMap } from '../types/app';
import type { ThemeId } from '../types/app';

export interface AppSettings {
  // Layout persistence
  rememberLastChannels: boolean;
  reopenLastOnStartup: boolean;
  savedLayoutState: SavedLayoutState | null;
  layoutSettingsLoaded: boolean;

  // Timeshift
  timeshiftEnabled: boolean;
  timeshiftCacheBytes: number;
  liveBufferOffset: number;

  // Search
  includeSourceInSearch: boolean;
  maxSearchResults: number;
  searchResultsOrder: 'default' | 'alphabetical';

  // Category display
  categorySortOrder: 'default' | 'alphabetical';

  // Advanced Search
  advancedSearchScope: 'channels' | 'epg' | 'both';
  advancedSearchSourceIds: string[];
  advancedSearchCategoryIds: string[];
  useAdvancedSearchForRegular: boolean;

  // LiveTV
  miniMediaBarForEpgPreview: boolean;
  epgView: 'traditional' | 'alternate';
  channelInfoOverlayEnabled: boolean;
  channelInfoOverlayFontSize: number;
  channelInfoOverlayLogoSize: number;
  channelInfoOverlayBoxWidth: number;
  channelInfoOverlayOpacity: number;
  channelInfoOverlayHideDescription: boolean;

  // Theme
  theme: ThemeId;

  // Shortcuts
  shortcuts: ShortcutsMap;

  // UI visibility
  showSidebar: boolean;
  categoriesHidden: boolean;

  // Actions
  setTheme: (theme: ThemeId) => void;
  setShortcuts: (shortcuts: ShortcutsMap) => void;
  setShowSidebar: (show: boolean) => void;
  setCategoriesHidden: (hidden: boolean) => void;
  setAdvancedSearchScope: (scope: 'channels' | 'epg' | 'both') => void;
  setAdvancedSearchSourceIds: (ids: string[]) => void;
  setAdvancedSearchCategoryIds: (ids: string[]) => void;
  setUseAdvancedSearchForRegular: (use: boolean) => void;
  setCategorySortOrder: (order: 'default' | 'alphabetical') => void;
  setChannelInfoOverlayEnabled: (enabled: boolean) => void;
  setChannelInfoOverlayFontSize: (size: number) => void;
  setChannelInfoOverlayLogoSize: (size: number) => void;
    setChannelInfoOverlayBoxWidth: (width: number) => void;
    setChannelInfoOverlayOpacity: (opacity: number) => void;
    setChannelInfoOverlayHideDescription: (hide: boolean) => void;
}

/**
 * Hook to manage all application settings loaded from storage
 * Includes layout persistence, timeshift, search, theme, and shortcut settings
 */
export function useAppSettings(): AppSettings {
  // Layout persistence state
  const [rememberLastChannels, setRememberLastChannels] = useState(false);
  const [reopenLastOnStartup, setReopenLastOnStartup] = useState(false);
  const [savedLayoutState, setSavedLayoutState] = useState<SavedLayoutState | null>(null);
  const [layoutSettingsLoaded, setLayoutSettingsLoaded] = useState(false);

  // Timeshift settings (loaded from store)
  const [timeshiftEnabled, setTimeshiftEnabled] = useState(false);
  const [timeshiftCacheBytes, setTimeshiftCacheBytes] = useState(1_073_741_824); // Default 1GB
  const [liveBufferOffset, setLiveBufferOffset] = useState(0); // Default 0 seconds behind live

  // Search settings
  const [includeSourceInSearch, setIncludeSourceInSearch] = useState(false);
  const [maxSearchResults, setMaxSearchResults] = useState(200);
  const [searchResultsOrder, setSearchResultsOrder] = useState<'default' | 'alphabetical'>('default');

  // Category display settings
  const [categorySortOrder, setCategorySortOrder] = useState<'default' | 'alphabetical'>('default');

  // Advanced search settings
  const [advancedSearchScope, setAdvancedSearchScope] = useState<'channels' | 'epg' | 'both'>('both');
  const [advancedSearchSourceIds, setAdvancedSearchSourceIds] = useState<string[]>([]);
  const [advancedSearchCategoryIds, setAdvancedSearchCategoryIds] = useState<string[]>([]);
  const [useAdvancedSearchForRegular, setUseAdvancedSearchForRegular] = useState(false);

  // LiveTV settings
  const [miniMediaBarForEpgPreview, setMiniMediaBarForEpgPreview] = useState(true);
  const [epgView, setEpgView] = useState<'traditional' | 'alternate'>('traditional');
  const [channelInfoOverlayEnabled, setChannelInfoOverlayEnabledState] = useState(false);
  const [channelInfoOverlayFontSize, setChannelInfoOverlayFontSizeState] = useState(16);
  const [channelInfoOverlayLogoSize, setChannelInfoOverlayLogoSizeState] = useState(42);
  const [channelInfoOverlayBoxWidth, setChannelInfoOverlayBoxWidthState] = useState(380);
  const [channelInfoOverlayOpacity, setChannelInfoOverlayOpacityState] = useState(55);
  const [channelInfoOverlayHideDescription, setChannelInfoOverlayHideDescriptionState] = useState(false);

  // Theme state
  const [theme, setThemeState] = useState<ThemeId>('glass-neon');

  // Shortcuts state
  const [shortcuts, setShortcutsState] = useState<ShortcutsMap>({});

  // UI visibility
  const [showSidebar, setShowSidebar] = useState(false);
  const [categoriesHidden, setCategoriesHiddenState] = useState(false);

  // Apply theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load layout persistence settings on mount
  useEffect(() => {
    const loadLayoutSettings = async () => {
      if (!window.storage) {
        setLayoutSettingsLoaded(true);
        return;
      }

      try {
        // Try Tauri storage first
        const result = await window.storage.getSettings();

        // Also check localStorage for saved layout state and theme (saved on app close)
        let localStorageState: SavedLayoutState | null = null;
        let localStorageTheme: string | null = null;
        try {
          const localData = localStorage.getItem('app-settings');
          if (localData) {
            const parsed = JSON.parse(localData);
            localStorageState = parsed.savedLayoutState ?? null;
            localStorageTheme = parsed.theme ?? null;
          }
        } catch (e) {
          console.warn('[useAppSettings] Failed to read from localStorage:', e);
        }

        // Use the most recent state (prefer localStorage for layout state since it's saved on close)
        if (result.data) {
          setRememberLastChannels(result.data.rememberLastChannels ?? false);
          setReopenLastOnStartup(result.data.reopenLastOnStartup ?? false);
          setTimeshiftEnabled(result.data.timeshiftEnabled ?? false);
          setTimeshiftCacheBytes(result.data.timeshiftCacheBytes ?? 1_073_741_824);
          setLiveBufferOffset(result.data.liveBufferOffset ?? 0);
          setIncludeSourceInSearch(result.data.includeSourceInSearch ?? false);
          setMaxSearchResults(result.data.maxSearchResults ?? 200);
          setSearchResultsOrder(result.data.searchResultsOrder ?? 'default');
          setCategorySortOrder(result.data.categorySortOrder ?? 'default');
          setAdvancedSearchScope(result.data.advancedSearchScope ?? 'both');
          setAdvancedSearchSourceIds(result.data.advancedSearchSourceIds ?? []);
          setAdvancedSearchCategoryIds(result.data.advancedSearchCategoryIds ?? []);
          setUseAdvancedSearchForRegular(result.data.useAdvancedSearchForRegular ?? false);
          setMiniMediaBarForEpgPreview(result.data.miniMediaBarForEpgPreview ?? true);
          setEpgView(result.data.epgView ?? 'traditional');
          setChannelInfoOverlayEnabled(result.data.channelInfoOverlayEnabled ?? false);
          setChannelInfoOverlayFontSizeState(result.data.channelInfoOverlayFontSize ?? 16);
          setChannelInfoOverlayLogoSizeState(result.data.channelInfoOverlayLogoSize ?? 42);
          setChannelInfoOverlayBoxWidthState(result.data.channelInfoOverlayBoxWidth ?? 380);
          setChannelInfoOverlayOpacityState(result.data.channelInfoOverlayOpacity ?? 55);
          setChannelInfoOverlayHideDescriptionState(result.data.channelInfoOverlayHideDescription ?? false);
          setCategoriesHiddenState(result.data.categoriesHidden ?? false);

          // Apply EPG darken current setting on load
          if (result.data.epgDarkenCurrent) {
            document.documentElement.classList.add('epg-darken-current');
          }

          // Use localStorage state if available (more recent), otherwise use Tauri storage
          const layoutState = localStorageState || result.data.savedLayoutState || null;
          setSavedLayoutState(layoutState);
          console.log('[useAppSettings] Loaded saved layout state:', layoutState);

          // Load theme
          const savedTheme = result.data.theme || localStorageTheme || 'glass-neon';
          setThemeState(savedTheme as ThemeId);
        } else if (localStorageState) {
          // Fallback to localStorage if Tauri storage is empty
          setSavedLayoutState(localStorageState);
          console.log('[useAppSettings] Loaded saved layout state from localStorage:', localStorageState);

          // Load theme from localStorage
          if (localStorageTheme) {
            setThemeState(localStorageTheme as ThemeId);
          }
        }
      } catch (e) {
        console.error('[useAppSettings] Failed to load layout settings:', e);
      }
      setLayoutSettingsLoaded(true);
    };
    loadLayoutSettings();
  }, []);

  const setTheme = useCallback(async (newTheme: ThemeId) => {
    setThemeState(newTheme);
    // Persist to storage
    if (window.storage) {
      try {
        await window.storage.updateSettings({ theme: newTheme });
      } catch (e) {
        console.error('[useAppSettings] Failed to save theme:', e);
      }
    }
    // Also save to localStorage as backup
    try {
      const existing = localStorage.getItem('app-settings');
      const parsed = existing ? JSON.parse(existing) : {};
      localStorage.setItem('app-settings', JSON.stringify({ ...parsed, theme: newTheme }));
    } catch (e) {
      console.warn('[useAppSettings] Failed to save theme to localStorage:', e);
    }
  }, []);

  const setShortcuts = useCallback((newShortcuts: ShortcutsMap) => {
    setShortcutsState(newShortcuts);
  }, []);

  const setCategoriesHidden = useCallback(async (hidden: boolean) => {
    setCategoriesHiddenState(hidden);
    // Persist to storage
    if (window.storage) {
      try {
        await window.storage.updateSettings({ categoriesHidden: hidden });
      } catch (e) {
        console.error('[useAppSettings] Failed to save categoriesHidden:', e);
      }
    }
  }, []);

  const setChannelInfoOverlayFontSize = useCallback(async (size: number) => {
    setChannelInfoOverlayFontSizeState(size);
    document.documentElement.style.setProperty('--cio-font-size', `${size}px`);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ channelInfoOverlayFontSize: size });
      } catch (e) {
        console.error('[useAppSettings] Failed to save channelInfoOverlayFontSize:', e);
      }
    }
  }, []);

  const setChannelInfoOverlayLogoSize = useCallback(async (size: number) => {
    setChannelInfoOverlayLogoSizeState(size);
    document.documentElement.style.setProperty('--cio-logo-size', `${size}px`);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ channelInfoOverlayLogoSize: size });
      } catch (e) {
        console.error('[useAppSettings] Failed to save channelInfoOverlayLogoSize:', e);
      }
    }
  }, []);

  const setChannelInfoOverlayBoxWidth = useCallback(async (width: number) => {
    setChannelInfoOverlayBoxWidthState(width);
    document.documentElement.style.setProperty('--cio-box-width', `${width}px`);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ channelInfoOverlayBoxWidth: width });
      } catch (e) {
        console.error('[useAppSettings] Failed to save channelInfoOverlayBoxWidth:', e);
      }
    }
  }, []);

  const setChannelInfoOverlayOpacity = useCallback(async (opacity: number) => {
    setChannelInfoOverlayOpacityState(opacity);
    document.documentElement.style.setProperty('--cio-bg-opacity', `${opacity / 100}`);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ channelInfoOverlayOpacity: opacity });
      } catch (e) {
        console.error('[useAppSettings] Failed to save channelInfoOverlayOpacity:', e);
      }
    }
  }, []);

  const setChannelInfoOverlayHideDescription = useCallback(async (hide: boolean) => {
    setChannelInfoOverlayHideDescriptionState(hide);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ channelInfoOverlayHideDescription: hide });
      } catch (e) {
        console.error('[useAppSettings] Failed to save channelInfoOverlayHideDescription:', e);
      }
    }
  }, []);

  const setChannelInfoOverlayEnabled = useCallback(async (enabled: boolean) => {
    setChannelInfoOverlayEnabledState(enabled);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ channelInfoOverlayEnabled: enabled });
      } catch (e) {
        console.error('[useAppSettings] Failed to save channelInfoOverlayEnabled:', e);
      }
    }
  }, []);

  const setCategorySortOrderSetting = useCallback(async (order: 'default' | 'alphabetical') => {
    setCategorySortOrder(order);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ categorySortOrder: order });
      } catch (e) {
        console.error('[useAppSettings] Failed to save categorySortOrder:', e);
      }
    }
  }, []);

  return {
    rememberLastChannels,
    reopenLastOnStartup,
    savedLayoutState,
    layoutSettingsLoaded,
    timeshiftEnabled,
    timeshiftCacheBytes,
    liveBufferOffset,
    includeSourceInSearch,
    maxSearchResults,
    searchResultsOrder,
    categorySortOrder,
    advancedSearchScope,
    advancedSearchSourceIds,
    advancedSearchCategoryIds,
    useAdvancedSearchForRegular,
    miniMediaBarForEpgPreview,
    epgView,
    channelInfoOverlayEnabled,
    channelInfoOverlayFontSize,
    channelInfoOverlayLogoSize,
    channelInfoOverlayBoxWidth,
    channelInfoOverlayOpacity,
    channelInfoOverlayHideDescription,
    theme,
    shortcuts,
    showSidebar,
    categoriesHidden,
    setTheme,
    setShortcuts,
    setShowSidebar,
    setCategoriesHidden,
    setAdvancedSearchScope,
    setAdvancedSearchSourceIds,
    setAdvancedSearchCategoryIds,
    setUseAdvancedSearchForRegular,
    setChannelInfoOverlayEnabled,
    setChannelInfoOverlayFontSize,
    setChannelInfoOverlayLogoSize,
    setChannelInfoOverlayBoxWidth,
    setChannelInfoOverlayOpacity,
    setChannelInfoOverlayHideDescription,
    setCategorySortOrder: setCategorySortOrderSetting,
  };
}

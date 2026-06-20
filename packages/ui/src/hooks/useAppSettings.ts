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
  epgView: 'traditional' | 'alternate';
  channelInfoOverlayEnabled: boolean;
  channelInfoOverlayFontSize: number;
  channelInfoOverlayLogoSize: number;
  channelInfoOverlayBoxWidth: number;
  channelInfoOverlayOpacity: number;
  channelInfoOverlayHideDescription: boolean;
  transparentGuideOnZap: boolean;

  // Popout
  popoutStopMain: boolean;
  popoutAlwaysOnTop: boolean;
  popoutMpvParamsEnabled: boolean;
  popoutMpvParams: string;

  // Theme
  theme: ThemeId;

  // Shortcuts
  shortcuts: ShortcutsMap;

  // Navigation tab visibility
  navHiddenTabs: string[];

  // EPG button visibility
  epgHiddenButtons: string[];

  // UI visibility
  categoriesHidden: boolean;
  categoriesHiddenTransparent: boolean;
  overlayAutohideTimer: number;

  // Widget scale
  widgetScale: number;
  widgetBgOpacity: number; // 0–1

  // Sports overlay
  sportsScale: number;
  sportsBgOpacity: number; // 0–1

  // Startup view
  startupView: 'none' | 'guide' | 'movies' | 'series' | 'dvr' | 'sports' | 'calendar' | 'stremio';

  // Actions
  setNavHiddenTabs: (tabs: string[]) => void;
  setEpgHiddenButtons: (buttons: string[]) => void;
  setTheme: (theme: ThemeId) => void;
  setShortcuts: (shortcuts: ShortcutsMap) => void;
  setCategoriesHidden: (hidden: boolean) => void;
  setCategoriesHiddenTransparent: (hidden: boolean) => void;
  setOverlayAutohideTimer: (seconds: number) => void;
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
    setTransparentGuideOnZap: (enabled: boolean) => void;
    setPopoutStopMain: (stop: boolean) => void;
    setPopoutAlwaysOnTop: (onTop: boolean) => void;
    setPopoutMpvParamsEnabled: (enabled: boolean) => void;
    setPopoutMpvParams: (params: string) => void;
    setWidgetScale: (scale: number) => void;
    setWidgetBgOpacity: (opacity: number) => void;
    setSportsScale: (scale: number) => void;
    setSportsBgOpacity: (opacity: number) => void;
    setStartupView: (view: 'none' | 'guide' | 'movies' | 'series' | 'dvr' | 'sports' | 'calendar') => void;
    castEnabled: boolean;
    setCastEnabled: (enabled: boolean) => void;
    castRewriteTs: boolean;
    setCastRewriteTs: (enabled: boolean) => void;
    externalPlayerPath: string;
    setExternalPlayerPath: (path: string) => void;
    externalPlayerArgs: string;
    setExternalPlayerArgs: (args: string) => void;
    externalPlayerReuse: boolean;
    setExternalPlayerReuse: (reuse: boolean) => void;
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
  const [epgView, setEpgView] = useState<'traditional' | 'alternate'>('traditional');
  const [channelInfoOverlayEnabled, setChannelInfoOverlayEnabledState] = useState(false);
  const [channelInfoOverlayFontSize, setChannelInfoOverlayFontSizeState] = useState(16);
  const [channelInfoOverlayLogoSize, setChannelInfoOverlayLogoSizeState] = useState(42);
  const [channelInfoOverlayBoxWidth, setChannelInfoOverlayBoxWidthState] = useState(380);
  const [channelInfoOverlayOpacity, setChannelInfoOverlayOpacityState] = useState(55);
  const [channelInfoOverlayHideDescription, setChannelInfoOverlayHideDescriptionState] = useState(false);
  const [transparentGuideOnZap, setTransparentGuideOnZapState] = useState(false);

  // Popout settings
  const [popoutStopMain, setPopoutStopMainState] = useState(true);
  const [popoutAlwaysOnTop, setPopoutAlwaysOnTopState] = useState(false);
  const [popoutMpvParamsEnabled, setPopoutMpvParamsEnabledState] = useState(false);
  const [popoutMpvParams, setPopoutMpvParamsState] = useState('');

  // External player settings
  const [externalPlayerPath, setExternalPlayerPathState] = useState('');
  const [externalPlayerArgs, setExternalPlayerArgsState] = useState('');
  const [externalPlayerReuse, setExternalPlayerReuseState] = useState(false);

  // Theme state
  const [theme, setThemeState] = useState<ThemeId>('glass-neon');

  // Shortcuts state
  const [shortcuts, setShortcutsState] = useState<ShortcutsMap>({});

  // Navigation tab visibility — hidden tabs start empty (all visible)
  const [navHiddenTabs, setNavHiddenTabsState] = useState<string[]>([]);

  // EPG button visibility — hidden buttons start empty (all visible)
  const [epgHiddenButtons, setEpgHiddenButtonsState] = useState<string[]>([]);

  // UI visibility
  const [categoriesHidden, setCategoriesHiddenState] = useState(false);
  const [categoriesHiddenTransparent, setCategoriesHiddenTransparentState] = useState(false);
  const [overlayAutohideTimer, setOverlayAutohideTimerState] = useState(3);

  // Widget scale (1 = 100%)
  const [widgetScale, setWidgetScaleState] = useState(1);
  const [widgetBgOpacity, setWidgetBgOpacityState] = useState(0.55);

  // Sports overlay
  const [sportsScale, setSportsScaleState] = useState(1);
  const [sportsBgOpacity, setSportsBgOpacityState] = useState(0.7);

  // Startup view
  const [startupView, setStartupViewState] = useState<'none' | 'guide' | 'movies' | 'series' | 'dvr' | 'sports' | 'calendar' | 'stremio'>('none');

  // Google Cast setting
  const [castEnabled, setCastEnabledState] = useState(false);
  const [castRewriteTs, setCastRewriteTsState] = useState(true);

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
          setEpgView(result.data.epgView ?? 'traditional');
          setChannelInfoOverlayEnabled(result.data.channelInfoOverlayEnabled ?? false);
          setChannelInfoOverlayFontSizeState(result.data.channelInfoOverlayFontSize ?? 16);
          setChannelInfoOverlayLogoSizeState(result.data.channelInfoOverlayLogoSize ?? 42);
          setChannelInfoOverlayBoxWidthState(result.data.channelInfoOverlayBoxWidth ?? 380);
          setChannelInfoOverlayOpacityState(result.data.channelInfoOverlayOpacity ?? 55);
          setChannelInfoOverlayHideDescriptionState(result.data.channelInfoOverlayHideDescription ?? false);
          setTransparentGuideOnZapState(result.data.transparentGuideOnZap ?? false);
          setCategoriesHiddenState(result.data.categoriesHidden ?? false);
          setCategoriesHiddenTransparentState(result.data.categoriesHiddenTransparent ?? false);
          setOverlayAutohideTimerState(result.data.overlayAutohideTimer ?? 3);
          setPopoutStopMainState(result.data.popoutStopMain ?? true);
          setPopoutAlwaysOnTopState(result.data.popoutAlwaysOnTop ?? false);
          setPopoutMpvParamsEnabledState(result.data.popoutMpvParamsEnabled ?? false);
          setPopoutMpvParamsState(result.data.popoutMpvParams ?? '');
          setExternalPlayerPathState(result.data.externalPlayerPath ?? '');
          setExternalPlayerArgsState(result.data.externalPlayerArgs ?? '');
          setExternalPlayerReuseState(result.data.externalPlayerReuse ?? false);

          // Load widget scale and apply CSS variable
          const savedScale = result.data.widgetScale ?? 1;
          setWidgetScaleState(savedScale);
          document.documentElement.style.setProperty('--widget-scale', String(savedScale));

          const savedBgOpacity = result.data.widgetBgOpacity ?? 0.55;
          setWidgetBgOpacityState(savedBgOpacity);
          document.documentElement.style.setProperty('--widget-bg-opacity', String(savedBgOpacity));

          const savedSportsScale = result.data.sportsScale ?? 1;
          setSportsScaleState(savedSportsScale);
          document.documentElement.style.setProperty('--sports-scale', String(savedSportsScale));

          const savedSportsBgOpacity = result.data.sportsBgOpacity ?? 0.7;
          setSportsBgOpacityState(savedSportsBgOpacity);
          document.documentElement.style.setProperty('--sports-bg-opacity', String(savedSportsBgOpacity));

          // Load navigation hidden tabs
          setNavHiddenTabsState(result.data.navHiddenTabs ?? []);

          // Load EPG hidden buttons
          setEpgHiddenButtonsState(result.data.epgHiddenButtons ?? []);

          // Load startup view
          setStartupViewState(result.data.startupView ?? 'none');

          // Load Google Cast setting
          setCastEnabledState(result.data.castEnabled ?? false);
          setCastRewriteTsState(result.data.castRewriteTs ?? true);

          // Apply EPG darken current setting on load
          if (result.data.epgDarkenCurrent) {
            document.documentElement.classList.add('epg-darken-current');
          }

          // Apply EPG bold channel names setting on load
          if (result.data.epgBoldChannelNames) {
            document.documentElement.classList.add('epg-bold-channel-names');
          }

          // Apply EPG bold top categories setting on load
          if (result.data.epgBoldTopCategories) {
            document.documentElement.classList.add('epg-bold-top-categories');
          }

          // Apply EPG bold source categories setting on load
          if (result.data.epgBoldSourceCategories) {
            document.documentElement.classList.add('epg-bold-source-categories');
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

  const setCategoriesHiddenTransparent = useCallback(async (hidden: boolean) => {
    setCategoriesHiddenTransparentState(hidden);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ categoriesHiddenTransparent: hidden });
      } catch (e) {
        console.error('[useAppSettings] Failed to save categoriesHiddenTransparent:', e);
      }
    }
  }, []);

  const setOverlayAutohideTimer = useCallback(async (seconds: number) => {
    setOverlayAutohideTimerState(seconds);
    if (window.storage) {
      try {
        window.storage.debouncedUpdateSettings({ overlayAutohideTimer: seconds });
      } catch (e) {
        console.error('[useAppSettings] Failed to save overlayAutohideTimer:', e);
      }
    }
  }, []);

  const setChannelInfoOverlayFontSize = useCallback(async (size: number) => {
    setChannelInfoOverlayFontSizeState(size);
    document.documentElement.style.setProperty('--cio-font-size', `${size}px`);
    if (window.storage) {
      try {
        window.storage.debouncedUpdateSettings({ channelInfoOverlayFontSize: size });
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
        window.storage.debouncedUpdateSettings({ channelInfoOverlayLogoSize: size });
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
        window.storage.debouncedUpdateSettings({ channelInfoOverlayBoxWidth: width });
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
        window.storage.debouncedUpdateSettings({ channelInfoOverlayOpacity: opacity });
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

  const setTransparentGuideOnZap = useCallback(async (enabled: boolean) => {
    setTransparentGuideOnZapState(enabled);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ transparentGuideOnZap: enabled });
      } catch (e) {
        console.error('[useAppSettings] Failed to save transparentGuideOnZap:', e);
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

  const setPopoutStopMain = useCallback(async (stop: boolean) => {
    setPopoutStopMainState(stop);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ popoutStopMain: stop });
      } catch (e) {
        console.error('[useAppSettings] Failed to save popoutStopMain:', e);
      }
    }
  }, []);

  const setPopoutAlwaysOnTop = useCallback(async (onTop: boolean) => {
    setPopoutAlwaysOnTopState(onTop);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ popoutAlwaysOnTop: onTop });
      } catch (e) {
        console.error('[useAppSettings] Failed to save popoutAlwaysOnTop:', e);
      }
    }
  }, []);

  const setPopoutMpvParamsEnabled = useCallback(async (enabled: boolean) => {
    setPopoutMpvParamsEnabledState(enabled);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ popoutMpvParamsEnabled: enabled });
      } catch (e) {
        console.error('[useAppSettings] Failed to save popoutMpvParamsEnabled:', e);
      }
    }
  }, []);

  const setPopoutMpvParams = useCallback(async (params: string) => {
    setPopoutMpvParamsState(params);
    if (window.storage) {
      try {
        window.storage.debouncedUpdateSettings({ popoutMpvParams: params });
      } catch (e) {
        console.error('[useAppSettings] Failed to save popoutMpvParams:', e);
      }
    }
  }, []);

  const setWidgetScale = useCallback(async (scale: number) => {
    setWidgetScaleState(scale);
    document.documentElement.style.setProperty('--widget-scale', String(scale));
    if (window.storage) {
      try {
        window.storage.debouncedUpdateSettings({ widgetScale: scale });
      } catch (e) {
        console.error('[useAppSettings] Failed to save widgetScale:', e);
      }
    }
  }, []);

  const setWidgetBgOpacity = useCallback(async (opacity: number) => {
    setWidgetBgOpacityState(opacity);
    document.documentElement.style.setProperty('--widget-bg-opacity', String(opacity));
    if (window.storage) {
      try {
        window.storage.debouncedUpdateSettings({ widgetBgOpacity: opacity });
      } catch (e) {
        console.error('[useAppSettings] Failed to save widgetBgOpacity:', e);
      }
    }
  }, []);

  const setSportsScale = useCallback(async (scale: number) => {
    setSportsScaleState(scale);
    document.documentElement.style.setProperty('--sports-scale', String(scale));
    if (window.storage) {
      try {
        window.storage.debouncedUpdateSettings({ sportsScale: scale });
      } catch (e) {
        console.error('[useAppSettings] Failed to save sportsScale:', e);
      }
    }
  }, []);

  const setSportsBgOpacity = useCallback(async (opacity: number) => {
    setSportsBgOpacityState(opacity);
    document.documentElement.style.setProperty('--sports-bg-opacity', String(opacity));
    if (window.storage) {
      try {
        window.storage.debouncedUpdateSettings({ sportsBgOpacity: opacity });
      } catch (e) {
        console.error('[useAppSettings] Failed to save sportsBgOpacity:', e);
      }
    }
  }, []);

  const setNavHiddenTabs = useCallback(async (tabs: string[]) => {
    setNavHiddenTabsState(tabs);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ navHiddenTabs: tabs });
      } catch (e) {
        console.error('[useAppSettings] Failed to save navHiddenTabs:', e);
      }
    }
  }, []);

  const setEpgHiddenButtons = useCallback(async (buttons: string[]) => {
    setEpgHiddenButtonsState(buttons);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ epgHiddenButtons: buttons });
      } catch (e) {
        console.error('[useAppSettings] Failed to save epgHiddenButtons:', e);
      }
    }
  }, []);

  const setStartupView = useCallback(async (view: 'none' | 'guide' | 'movies' | 'series' | 'dvr' | 'sports' | 'calendar') => {
    setStartupViewState(view);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ startupView: view });
      } catch (e) {
        console.error('[useAppSettings] Failed to save startupView:', e);
      }
    }
  }, []);

  const setExternalPlayerPath = useCallback(async (path: string) => {
    setExternalPlayerPathState(path);
    if (window.storage) {
      try {
        window.storage.debouncedUpdateSettings({ externalPlayerPath: path });
      } catch (e) {
        console.error('[useAppSettings] Failed to save externalPlayerPath:', e);
      }
    }
  }, []);

  const setExternalPlayerArgs = useCallback(async (args: string) => {
    setExternalPlayerArgsState(args);
    if (window.storage) {
      try {
        window.storage.debouncedUpdateSettings({ externalPlayerArgs: args });
      } catch (e) {
        console.error('[useAppSettings] Failed to save externalPlayerArgs:', e);
      }
    }
  }, []);

  const setExternalPlayerReuse = useCallback(async (reuse: boolean) => {
    setExternalPlayerReuseState(reuse);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ externalPlayerReuse: reuse });
      } catch (e) {
        console.error('[useAppSettings] Failed to save externalPlayerReuse:', e);
      }
    }
  }, []);

  const setCastEnabled = useCallback(async (enabled: boolean) => {
    setCastEnabledState(enabled);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ castEnabled: enabled });
      } catch (e) {
        console.error('[useAppSettings] Failed to save castEnabled:', e);
      }
    }
  }, []);

  const setCastRewriteTs = useCallback(async (enabled: boolean) => {
    setCastRewriteTsState(enabled);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ castRewriteTs: enabled });
      } catch (e) {
        console.error('[useAppSettings] Failed to save castRewriteTs:', e);
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
    epgView,
    channelInfoOverlayEnabled,
    channelInfoOverlayFontSize,
    channelInfoOverlayLogoSize,
    channelInfoOverlayBoxWidth,
    channelInfoOverlayOpacity,
    channelInfoOverlayHideDescription,
    transparentGuideOnZap,
    popoutStopMain,
    popoutAlwaysOnTop,
    popoutMpvParamsEnabled,
    popoutMpvParams,
    theme,
    shortcuts,
    categoriesHidden,
    categoriesHiddenTransparent,
    navHiddenTabs,
    epgHiddenButtons,
    overlayAutohideTimer,
    widgetScale,
    widgetBgOpacity,
    sportsScale,
    sportsBgOpacity,
    setNavHiddenTabs,
    setEpgHiddenButtons,
    setTheme,
    setShortcuts,
    setCategoriesHidden,
    setCategoriesHiddenTransparent,
    setOverlayAutohideTimer,
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
    setTransparentGuideOnZap,
    setCategorySortOrder: setCategorySortOrderSetting,
    setPopoutStopMain,
    setPopoutAlwaysOnTop,
    setPopoutMpvParamsEnabled,
    setPopoutMpvParams,
    setWidgetScale,
    setWidgetBgOpacity,
    setSportsScale,
    setSportsBgOpacity,
    startupView,
    setStartupView,
    castEnabled,
    setCastEnabled,
    castRewriteTs,
    setCastRewriteTs,
    externalPlayerPath,
    setExternalPlayerPath,
    externalPlayerArgs,
    setExternalPlayerArgs,
    externalPlayerReuse,
    setExternalPlayerReuse,
  };
}

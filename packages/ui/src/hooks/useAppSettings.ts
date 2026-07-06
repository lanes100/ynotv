import { useState, useEffect, useCallback } from 'react';
import type { SavedLayoutState } from './useLayoutPersistence';
import type { ThemeId, CustomThemeConfig, ShortcutsMap } from '../types/app';
import { applyCustomTheme } from '../utils/themeHelper';

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
  includeAllChannelsToPlaylist: boolean;
  setIncludeAllChannelsToPlaylist: (enabled: boolean) => void;

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
  customThemeConfig: CustomThemeConfig;
  savedCustomThemes: CustomThemeConfig[];

  // Global Fonts
  appFontFamily: string;
  appCustomFontBase64: string;
  appCustomFontFormat: string;
  appCustomFontName: string;

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

  // Theme Optimization
  disableThemeBlobs: boolean;
  disableThemeBackdropBlur: boolean;
  epgLazyLoadingEnabled: boolean;
  disableEpgTransitions: boolean;
  epgReduceGpuLayers: boolean;
  epgDisableChannelFade: boolean;
  epgPreferEpgLogos: boolean;

  // Startup view
  startupView: 'none' | 'guide' | 'movies' | 'series' | 'dvr' | 'sports' | 'calendar' | 'stremio' | 'nuvio';

  // Actions
  setNavHiddenTabs: (tabs: string[]) => void;
  setEpgHiddenButtons: (buttons: string[]) => void;
  setTheme: (theme: ThemeId) => void;
  updateCustomThemeConfig: (config: Partial<CustomThemeConfig>) => void;
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
    setStartupView: (view: 'none' | 'guide' | 'movies' | 'series' | 'dvr' | 'sports' | 'calendar' | 'stremio' | 'nuvio') => void;
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
    updateAppFont: (family: string, base64?: string, format?: string, name?: string) => Promise<void> | void;
    setSavedCustomThemes: (themes: CustomThemeConfig[]) => void;
    setDisableThemeBlobs: (disabled: boolean) => void;
    setDisableThemeBackdropBlur: (disabled: boolean) => void;
    setEpgLazyLoadingEnabled: (enabled: boolean) => void;
    setDisableEpgTransitions: (disabled: boolean) => void;
    setEpgReduceGpuLayers: (enabled: boolean) => void;
    setEpgDisableChannelFade: (enabled: boolean) => void;
    setEpgPreferEpgLogos: (enabled: boolean) => void;
    globalLiveTvUserAgent: string;
    setGlobalLiveTvUserAgent: (ua: string) => void;
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
  const [timeshiftEnabled, setTimeshiftEnabled] = useState(true);
  const [timeshiftCacheBytes, setTimeshiftCacheBytes] = useState(268_435_456); // Default 256MB
  const [liveBufferOffset, setLiveBufferOffset] = useState(0); // Default 0 seconds behind live

  // Search settings
  const [includeSourceInSearch, setIncludeSourceInSearch] = useState(false);
  const [maxSearchResults, setMaxSearchResults] = useState(200);
  const [searchResultsOrder, setSearchResultsOrder] = useState<'default' | 'alphabetical'>('default');

  // Category display settings
  const [categorySortOrder, setCategorySortOrder] = useState<'default' | 'alphabetical'>('default');
  const [includeAllChannelsToPlaylist, setIncludeAllChannelsToPlaylist] = useState(false);

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
  const [theme, setThemeState] = useState<ThemeId>('dark-cyan');

  // Custom theme state
  const [customThemeConfig, setCustomThemeConfigState] = useState<CustomThemeConfig>({
    backgroundType: 'solid',
    backgroundColor: '#1a1a1a',
    gradientStart: '#1a0b2e',
    gradientMiddle: '#4a1a6b',
    gradientEnd: '#2d1b4e',
    gradientColor4: '#1a0b2e',
    gradientColor5: '#2d1b4e',
    accentColor: '#00d4ff',
    textColor: '#ffffff',
    textSecondaryColor: 'rgba(255,255,255,0.7)',
    surfaceColor: '#282828',
    surfaceOpacity: 0.85,
    surfaceBorderColor: '#ffffff',
    surfaceBorderOpacity: 0.1,
    glassBlur: 20,
    glassSaturation: 150,
    customBlob1: '#00bbf5',
    customBlob2: '#ff1493',
    customBlob3: '#ffd700',
    customBlob4: '#76ff03',
    customBlob1Opacity: 0.55,
    customBlob2Opacity: 0.45,
    customBlob3Opacity: 0.35,
    customBlob4Opacity: 0.3,
    showGlassBlobs: true,
    fontFamily: 'inter'
  });

  // Saved Custom Themes List
  const [savedCustomThemes, setSavedCustomThemesState] = useState<CustomThemeConfig[]>([]);

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
  const [startupView, setStartupViewState] = useState<'none' | 'guide' | 'movies' | 'series' | 'dvr' | 'sports' | 'calendar' | 'stremio' | 'nuvio'>('none');

  // Google Cast setting
  const [castEnabled, setCastEnabledState] = useState(false);
  const [castRewriteTs, setCastRewriteTsState] = useState(true);

  // Theme Optimization settings
  const [disableThemeBlobs, setDisableThemeBlobsState] = useState(false);
  const [disableThemeBackdropBlur, setDisableThemeBackdropBlurState] = useState(false);
  const [epgLazyLoadingEnabled, setEpgLazyLoadingEnabledState] = useState(false);
  const [disableEpgTransitions, setDisableEpgTransitionsState] = useState(false);
  const [epgReduceGpuLayers, setEpgReduceGpuLayersState] = useState(false);
  const [epgDisableChannelFade, setEpgDisableChannelFadeState] = useState(false);
  const [epgPreferEpgLogos, setEpgPreferEpgLogosState] = useState(false);
  const [globalLiveTvUserAgent, setGlobalLiveTvUserAgentState] = useState('');

  // Global Font selection states
  const [appFontFamily, setAppFontFamilyState] = useState<string>('inter');
  const [appCustomFontBase64, setAppCustomFontBase64State] = useState<string>('');
  const [appCustomFontFormat, setAppCustomFontFormatState] = useState<string>('');
  const [appCustomFontName, setAppCustomFontNameState] = useState<string>('');

  // Global Font apply effect
  useEffect(() => {
    const root = document.documentElement;
    if (!root) return;

    let fontValue = "'Inter', system-ui, sans-serif";
    if (appFontFamily === 'switzer') {
      fontValue = "'Switzer', sans-serif";
    } else if (appFontFamily === 'sentient') {
      fontValue = "'Sentient', serif";
    } else if (appFontFamily === 'fraunces') {
      fontValue = "'Fraunces', serif";
    } else if (appFontFamily === 'cabinet-grotesk') {
      fontValue = "'Cabinet Grotesk', sans-serif";
    } else if (appFontFamily === 'custom' && appCustomFontBase64) {
      fontValue = "'custom-uploaded-font', sans-serif";
    }
    
    root.style.setProperty('--font-family', fontValue);

    let styleEl = document.getElementById('custom-theme-font-face') as HTMLStyleElement;
    if (appFontFamily === 'custom' && appCustomFontBase64) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'custom-theme-font-face';
        document.head.appendChild(styleEl);
      }
      let format = appCustomFontFormat || 'woff2';
      styleEl.innerHTML = `
        @font-face {
          font-family: 'custom-uploaded-font';
          src: url('${appCustomFontBase64}') format('${format}');
          font-weight: 100 900;
          font-style: normal;
          font-display: swap;
        }
      `;
    } else {
      if (styleEl) {
        styleEl.remove();
      }
    }
  }, [appFontFamily, appCustomFontBase64, appCustomFontFormat]);

  // Apply theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'custom' && customThemeConfig) {
      applyCustomTheme(customThemeConfig);
    } else {
      const customKeys = [
        '--bg-primary',
        '--bg-secondary',
        '--bg-tertiary',
        '--surface-color',
        '--surface-hover',
        '--surface-active',
        '--surface-border',
        '--surface-glow',
        '--text-primary',
        '--text-secondary',
        '--text-muted',
        '--text-accent',
        '--accent-primary',
        '--accent-secondary',
        '--accent-glow',
        '--glass-blur',
        '--glass-saturation',
        '--glass-border',
        '--glass-shadow',
        '--bg-gradient-1',
        '--bg-gradient-2',
        '--bg-gradient-3',
        '--bg-gradient-4',
        '--bg-gradient-5',
        '--custom-blob-1',
        '--custom-blob-2',
        '--custom-blob-3',
        '--custom-blob-4',
        '--glass-blob-display'
      ];
      customKeys.forEach(key => {
        document.documentElement.style.removeProperty(key);
      });
    }
  }, [theme, customThemeConfig]);

  // Apply optimization settings
  useEffect(() => {
    if (disableThemeBlobs) {
      document.documentElement.classList.add('disable-theme-blobs');
    } else {
      document.documentElement.classList.remove('disable-theme-blobs');
    }
  }, [disableThemeBlobs]);

  useEffect(() => {
    if (disableThemeBackdropBlur) {
      document.documentElement.classList.add('disable-theme-backdrop-blur');
    } else {
      document.documentElement.classList.remove('disable-theme-backdrop-blur');
    }
  }, [disableThemeBackdropBlur]);

  useEffect(() => {
    if (disableEpgTransitions) {
      document.documentElement.classList.add('disable-epg-transitions');
    } else {
      document.documentElement.classList.remove('disable-epg-transitions');
    }
  }, [disableEpgTransitions]);

  useEffect(() => {
    if (epgReduceGpuLayers) {
      document.documentElement.classList.add('epg-reduce-gpu-layers');
    } else {
      document.documentElement.classList.remove('epg-reduce-gpu-layers');
    }
  }, [epgReduceGpuLayers]);

  useEffect(() => {
    if (epgDisableChannelFade) {
      document.documentElement.classList.add('epg-disable-channel-fade');
    } else {
      document.documentElement.classList.remove('epg-disable-channel-fade');
    }
  }, [epgDisableChannelFade]);

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
          setTimeshiftEnabled(result.data.timeshiftEnabled ?? true);
          setTimeshiftCacheBytes(result.data.timeshiftCacheBytes ?? 268_435_456);
          setLiveBufferOffset(result.data.liveBufferOffset ?? 0);
          setIncludeSourceInSearch(result.data.includeSourceInSearch ?? false);
          setMaxSearchResults(result.data.maxSearchResults ?? 200);
          setSearchResultsOrder(result.data.searchResultsOrder ?? 'default');
          setCategorySortOrder(result.data.categorySortOrder ?? 'default');
          setIncludeAllChannelsToPlaylist(result.data.includeAllChannelsToPlaylist ?? false);
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

          // Load Optimization settings
          setDisableThemeBlobsState(result.data.disableThemeBlobs ?? false);
          setDisableThemeBackdropBlurState(result.data.disableThemeBackdropBlur ?? false);
          setEpgLazyLoadingEnabledState(result.data.epgLazyLoadingEnabled ?? false);
          setDisableEpgTransitionsState(result.data.disableEpgTransitions ?? false);
          setEpgReduceGpuLayersState(result.data.epgReduceGpuLayers ?? false);
          setEpgDisableChannelFadeState(result.data.epgDisableChannelFade ?? false);
          setEpgPreferEpgLogosState(result.data.epgPreferEpgLogos ?? false);
          setGlobalLiveTvUserAgentState(result.data.globalLiveTvUserAgent ?? '');

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
          const savedTheme = result.data.theme || localStorageTheme || 'dark-cyan';
          setThemeState(savedTheme as ThemeId);

          // Load global font settings
          const fFamily = result.data.appFontFamily || 'inter';
          const fBase64 = result.data.appCustomFontBase64 || '';
          const fFormat = result.data.appCustomFontFormat || '';
          const fName = result.data.appCustomFontName || '';
          setAppFontFamilyState(fFamily);
          setAppCustomFontBase64State(fBase64);
          setAppCustomFontFormatState(fFormat);
          setAppCustomFontNameState(fName);

          // Load custom themes list
          const savedThemesList = result.data.savedCustomThemes || [];
          setSavedCustomThemesState(savedThemesList);

          // Load active custom theme config
          if (result.data.customThemeConfig) {
            setCustomThemeConfigState(result.data.customThemeConfig);
          } else {
            try {
              const existing = localStorage.getItem('app-settings');
              if (existing) {
                const parsed = JSON.parse(existing);
                if (parsed.customThemeConfig) {
                  setCustomThemeConfigState(parsed.customThemeConfig);
                }
              }
            } catch (e) {}
          }

          // Propagate Tauri values to localStorage
          try {
            const existing = localStorage.getItem('app-settings');
            const parsed = existing ? JSON.parse(existing) : {};
            const updated = {
              ...parsed,
              customThemeConfig: result.data.customThemeConfig || parsed.customThemeConfig,
              savedCustomThemes: savedThemesList,
              appFontFamily: fFamily,
              appCustomFontBase64: fBase64,
              appCustomFontFormat: fFormat,
              appCustomFontName: fName
            };
            localStorage.setItem('app-settings', JSON.stringify(updated));
          } catch (e) {}

          // One-time migration: check if timeshiftMigrationCheck is not set
          if (result.data.timeshiftMigrationCheck !== true) {
            const hasTimeshift = result.data.timeshiftEnabled === true;
            if (!hasTimeshift) {
              setTimeshiftEnabled(true);
              setTimeshiftCacheBytes(268_435_456); // 256MB
              window.storage.updateSettings({
                timeshiftEnabled: true,
                timeshiftCacheBytes: 268_435_456,
                timeshiftMigrationCheck: true,
              }).catch((err) => console.warn('[useAppSettings] Failed to run timeshift migration:', err));
            } else {
              window.storage.updateSettings({
                timeshiftMigrationCheck: true,
              }).catch((err) => console.warn('[useAppSettings] Failed to save timeshift migration flag:', err));
            }
          }
        } else if (localStorageState) {
          // Fallback to localStorage if Tauri storage is empty
          setSavedLayoutState(localStorageState);
          console.log('[useAppSettings] Loaded saved layout state from localStorage:', localStorageState);

          // Load theme from localStorage
          if (localStorageTheme) {
            setThemeState(localStorageTheme as ThemeId);
          }

          try {
            const existing = localStorage.getItem('app-settings');
            if (existing) {
              const parsed = JSON.parse(existing);
              if (parsed.customThemeConfig) {
                setCustomThemeConfigState(parsed.customThemeConfig);
              }
              if (parsed.savedCustomThemes) setSavedCustomThemesState(parsed.savedCustomThemes);
              if (parsed.appFontFamily) setAppFontFamilyState(parsed.appFontFamily);
              if (parsed.appCustomFontBase64) setAppCustomFontBase64State(parsed.appCustomFontBase64);
              if (parsed.appCustomFontFormat) setAppCustomFontFormatState(parsed.appCustomFontFormat);
              if (parsed.appCustomFontName) setAppCustomFontNameState(parsed.appCustomFontName);
            }
          } catch (e) {}
        }
      } catch (e) {
        console.error('[useAppSettings] Failed to load layout settings:', e);
      }
      setLayoutSettingsLoaded(true);
    };
    loadLayoutSettings();
  }, []);

  const updateCustomThemeConfig = useCallback(async (newConfig: Partial<CustomThemeConfig>) => {
    setCustomThemeConfigState((prev) => {
      const updated = { ...prev, ...newConfig };
      // Persist to storage
      if (window.storage) {
        window.storage.updateSettings({ customThemeConfig: updated }).catch((e) => {
          console.error('[useAppSettings] Failed to save custom theme:', e);
        });
      }
      try {
        const existing = localStorage.getItem('app-settings');
        const parsed = existing ? JSON.parse(existing) : {};
        localStorage.setItem('app-settings', JSON.stringify({ ...parsed, customThemeConfig: updated }));
      } catch (e) {
        console.warn('[useAppSettings] Failed to save custom theme to localStorage:', e);
      }
      return updated;
    });
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

  const setIncludeAllChannelsToPlaylistSetting = useCallback(async (enabled: boolean) => {
    setIncludeAllChannelsToPlaylist(enabled);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ includeAllChannelsToPlaylist: enabled });
      } catch (e) {
        console.error('[useAppSettings] Failed to save includeAllChannelsToPlaylist:', e);
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

  const setStartupView = useCallback(async (view: 'none' | 'guide' | 'movies' | 'series' | 'dvr' | 'sports' | 'calendar' | 'stremio' | 'nuvio') => {
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

  const updateAppFont = useCallback(async (family: string, base64 = '', format = '', name = '') => {
    setAppFontFamilyState(family);
    setAppCustomFontBase64State(base64);
    setAppCustomFontFormatState(format);
    setAppCustomFontNameState(name);

    const updateObj = {
      appFontFamily: family,
      appCustomFontBase64: base64,
      appCustomFontFormat: format,
      appCustomFontName: name
    };

    if (window.storage) {
      window.storage.updateSettings(updateObj).catch((e) => {
        console.error('[useAppSettings] Failed to save app font settings to Tauri:', e);
      });
    }

    try {
      const existing = localStorage.getItem('app-settings');
      const parsed = existing ? JSON.parse(existing) : {};
      localStorage.setItem('app-settings', JSON.stringify({ ...parsed, ...updateObj }));
    } catch (e) {
      console.warn('[useAppSettings] Failed to save app font settings to localStorage:', e);
    }
  }, []);

  const setDisableThemeBlobs = useCallback(async (disabled: boolean) => {
    setDisableThemeBlobsState(disabled);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ disableThemeBlobs: disabled });
      } catch (e) {
        console.error('[useAppSettings] Failed to save disableThemeBlobs:', e);
      }
    }
  }, []);

  const setDisableThemeBackdropBlur = useCallback(async (disabled: boolean) => {
    setDisableThemeBackdropBlurState(disabled);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ disableThemeBackdropBlur: disabled });
      } catch (e) {
        console.error('[useAppSettings] Failed to save disableThemeBackdropBlur:', e);
      }
    }
  }, []);

  const setEpgLazyLoadingEnabled = useCallback(async (enabled: boolean) => {
    setEpgLazyLoadingEnabledState(enabled);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ epgLazyLoadingEnabled: enabled });
      } catch (e) {
        console.error('[useAppSettings] Failed to save epgLazyLoadingEnabled:', e);
      }
    }
  }, []);

  const setDisableEpgTransitions = useCallback(async (disabled: boolean) => {
    setDisableEpgTransitionsState(disabled);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ disableEpgTransitions: disabled });
      } catch (e) {
        console.error('[useAppSettings] Failed to save disableEpgTransitions:', e);
      }
    }
  }, []);

  const setEpgReduceGpuLayers = useCallback(async (enabled: boolean) => {
    setEpgReduceGpuLayersState(enabled);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ epgReduceGpuLayers: enabled });
      } catch (e) {
        console.error('[useAppSettings] Failed to save epgReduceGpuLayers:', e);
      }
    }
  }, []);

  const setEpgDisableChannelFade = useCallback(async (enabled: boolean) => {
    setEpgDisableChannelFadeState(enabled);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ epgDisableChannelFade: enabled });
      } catch (e) {
        console.error('[useAppSettings] Failed to save epgDisableChannelFade:', e);
      }
    }
  }, []);

  const setEpgPreferEpgLogos = useCallback(async (enabled: boolean) => {
    setEpgPreferEpgLogosState(enabled);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ epgPreferEpgLogos: enabled });
      } catch (e) {
        console.error('[useAppSettings] Failed to save epgPreferEpgLogos:', e);
      }
    }
  }, []);

  const setGlobalLiveTvUserAgent = useCallback(async (ua: string) => {
    setGlobalLiveTvUserAgentState(ua);
    if (window.storage) {
      try {
        await window.storage.updateSettings({ globalLiveTvUserAgent: ua });
      } catch (e) {
        console.error('[useAppSettings] Failed to save globalLiveTvUserAgent:', e);
      }
    }
  }, []);

  const setSavedCustomThemes = useCallback(async (themes: CustomThemeConfig[]) => {
    setSavedCustomThemesState(themes);
    if (window.storage) {
      window.storage.updateSettings({ savedCustomThemes: themes }).catch((e) => {
        console.error('[useAppSettings] Failed to save savedCustomThemes:', e);
      });
    }
    try {
      const existing = localStorage.getItem('app-settings');
      const parsed = existing ? JSON.parse(existing) : {};
      localStorage.setItem('app-settings', JSON.stringify({ ...parsed, savedCustomThemes: themes }));
    } catch (e) {
      console.warn('[useAppSettings] Failed to save savedCustomThemes to localStorage:', e);
    }
  }, []);

  return {
    savedCustomThemes,
    setSavedCustomThemes,
    appFontFamily,
    appCustomFontBase64,
    appCustomFontFormat,
    appCustomFontName,
    updateAppFont,
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
    includeAllChannelsToPlaylist,
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
    customThemeConfig,
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
    updateCustomThemeConfig,
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
    setIncludeAllChannelsToPlaylist: setIncludeAllChannelsToPlaylistSetting,
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
    disableThemeBlobs,
    setDisableThemeBlobs,
    disableThemeBackdropBlur,
    setDisableThemeBackdropBlur,
    epgLazyLoadingEnabled,
    setEpgLazyLoadingEnabled,
    disableEpgTransitions,
    setDisableEpgTransitions,
    epgReduceGpuLayers,
    setEpgReduceGpuLayers,
    epgDisableChannelFade,
    setEpgDisableChannelFade,
    epgPreferEpgLogos,
    setEpgPreferEpgLogos,
    globalLiveTvUserAgent,
    setGlobalLiveTvUserAgent,
  };
}

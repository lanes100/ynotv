import { useState, useEffect, useCallback } from 'react';
import type { Source } from '@ynotv/core';
import { useEpgView, useSetEpgView, useUIStore } from '../stores/uiStore';
import { SettingsSidebar, type SettingsTabId } from './settings/SettingsSidebar';
import { SourcesTab } from './settings/SourcesTab';
import { SecurityTab } from './settings/SecurityTab';
import { DebugTab } from './settings/DebugTab';
import { ShortcutsTab } from './settings/ShortcutsTab';
import { ImportExportTab } from './settings/ImportExportTab';
import { UITab } from './settings/UITab';
import { ThemeTab } from './settings/ThemeTab';
import { StartupTab, type SavedLayoutState } from './settings/StartupTab';
import { NavigationTab } from './settings/NavigationTab';
import { PlaybackTab } from './settings/PlaybackTab';
import { CacheTab } from './settings/CacheTab';
import { AboutTab } from './settings/AboutTab';
import { LiveTVTab } from './settings/LiveTVTab';
import { SubtitlesTab, type SubtitleSettings } from './settings/SubtitlesTab';
import { ScrobblingTab } from './settings/ScrobblingTab';
import { StremTab } from './settings/StremTab';
import type { ShortcutsMap, ThemeId } from '../types/app';
import type { StremioStreamPickerMode, BadgeSource } from '../types/stremio';
import './Settings.css';

interface SettingsProps {
  onClose: () => void;
  onShortcutsChange?: (shortcuts: ShortcutsMap) => void;
  theme?: ThemeId;
  onThemeChange?: (theme: ThemeId) => void;
  initialTab?: SettingsTabId;
  editSourceId?: string | null;
  channelInfoOverlayEnabled?: boolean;
  onChannelInfoOverlayChange?: (enabled: boolean) => void;
  channelInfoOverlayFontSize?: number;
  onChannelInfoOverlayFontSizeChange?: (size: number) => void;
  channelInfoOverlayLogoSize?: number;
  onChannelInfoOverlayLogoSizeChange?: (size: number) => void;
  channelInfoOverlayBoxWidth?: number;
  onChannelInfoOverlayBoxWidthChange?: (width: number) => void;
  channelInfoOverlayOpacity?: number;
  onChannelInfoOverlayOpacityChange?: (opacity: number) => void;
  channelInfoOverlayHideDescription?: boolean;
  onChannelInfoOverlayHideDescriptionChange?: (hide: boolean) => void;
  overlayAutohideTimer?: number;
  onOverlayAutohideTimerChange?: (seconds: number) => void;
  castEnabled?: boolean;
  onCastEnabledChange?: (enabled: boolean) => void;
  stremioStreamPickerMode?: StremioStreamPickerMode;
  onStremioStreamPickerModeChange?: (mode: StremioStreamPickerMode) => void;
  showStremioStreamBadges?: boolean;
  onShowStremioStreamBadgesChange?: (show: boolean) => void;
  badgeSources?: BadgeSource[];
  onBadgeSourcesChange?: (sources: BadgeSource[]) => void;
}

export function Settings({
  onClose,
  onShortcutsChange,
  theme,
  onThemeChange,
  initialTab = 'sources',
  editSourceId = null,
  channelInfoOverlayEnabled: channelInfoOverlayEnabledProp,
  onChannelInfoOverlayChange,
  channelInfoOverlayFontSize: channelInfoOverlayFontSizeProp,
  onChannelInfoOverlayFontSizeChange,
  channelInfoOverlayLogoSize: channelInfoOverlayLogoSizeProp,
  onChannelInfoOverlayLogoSizeChange,
  channelInfoOverlayBoxWidth: channelInfoOverlayBoxWidthProp,
  onChannelInfoOverlayBoxWidthChange,
  channelInfoOverlayOpacity: channelInfoOverlayOpacityProp,
  onChannelInfoOverlayOpacityChange,
  channelInfoOverlayHideDescription: channelInfoOverlayHideDescriptionProp,
  onChannelInfoOverlayHideDescriptionChange,
  overlayAutohideTimer: overlayAutohideTimerProp,
  onOverlayAutohideTimerChange,
  castEnabled: castEnabledProp,
  onCastEnabledChange,
  stremioStreamPickerMode: stremioStreamPickerModeProp,
  onStremioStreamPickerModeChange,
  showStremioStreamBadges: showStremioStreamBadgesProp,
  onShowStremioStreamBadgesChange,
  badgeSources: badgeSourcesProp,
  onBadgeSourcesChange,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [sources, setSources] = useState<Source[]>([]);
  const [isEncryptionAvailable, setIsEncryptionAvailable] = useState(true);

  const [tmdbApiKey, setTmdbApiKey] = useState('');
  const [tmdbKeyValid, setTmdbKeyValid] = useState<boolean | null>(null);

  // Refresh settings state
  const [vodRefreshHours, setVodRefreshHours] = useState(24);
  const [epgRefreshHours, setEpgRefreshHours] = useState(6);
  const [epgSyncConcurrency, setEpgSyncConcurrency] = useState(0);

  // PosterDB state
  const [posterDbApiKey, setPosterDbApiKey] = useState('');
  const [posterDbKeyValid, setPosterDbKeyValid] = useState<boolean | null>(null);
  const [rpdbBackdropsEnabled, setRpdbBackdropsEnabled] = useState(false);

  // Security state
  const [allowLanSources, setAllowLanSources] = useState(false);

  // Debug state
  const [debugLoggingEnabled, setDebugLoggingEnabled] = useState(false);
  const [logRetentionDays, setLogRetentionDays] = useState(7);

  // Channel display state
  const [channelSortOrder, setChannelSortOrder] = useState<'alphabetical' | 'number' | 'provider'>('provider');
  const [categorySortOrder, setCategorySortOrder] = useState<'default' | 'alphabetical'>('default');
  const [includeSourceInSearch, setIncludeSourceInSearch] = useState(false);
  const [maxSearchResults, setMaxSearchResults] = useState(200);
  const [searchResultsOrder, setSearchResultsOrder] = useState<'default' | 'alphabetical'>('default');

  // Shortcuts state
  const [shortcuts, setShortcuts] = useState<ShortcutsMap>({});

  // UI state
  const [uiSettings, setUiSettings] = useState<{
    startupWidth?: number;
    startupHeight?: number;
    dontSaveWindowSizeOnClose?: boolean;
    modernUiEnabled?: boolean;
    collapseSourceCategoriesOnStartup?: boolean;
    overlayAutohideTimer?: number;
  }>({
    modernUiEnabled: true,
    collapseSourceCategoriesOnStartup: false,
    overlayAutohideTimer: 3,
  });

  // Font size state (moved to LiveTV tab)
  const [channelFontSize, setChannelFontSize] = useState(14);
  const [categoryFontSize, setCategoryFontSize] = useState(13);

  // Startup settings state
  const [rememberLastChannels, setRememberLastChannels] = useState(false);
  const [reopenLastOnStartup, setReopenLastOnStartup] = useState(false);
  const [savedLayoutState, setSavedLayoutState] = useState<SavedLayoutState | null>(null);
  const [startupView, setStartupView] = useState<'none' | 'guide' | 'movies' | 'series' | 'dvr' | 'sports' | 'calendar' | 'stremio'>('none');
  const navHiddenTabs = useUIStore((s) => s.navHiddenTabs);
  const navHiddenTabsStore = useUIStore((s) => s.setNavHiddenTabs);

  // Playback settings state
  const [mpvParams, setMpvParams] = useState<string>('');
  const [mpvDisableWhitelist, setMpvDisableWhitelist] = useState(false);
  const [timeshiftEnabled, setTimeshiftEnabled] = useState(false);
  const [timeshiftCacheBytes, setTimeshiftCacheBytes] = useState(1_073_741_824);
  const [liveBufferOffset, setLiveBufferOffset] = useState(0);
  // Stream retry settings
  const [streamWatchdogSeconds, setStreamWatchdogSeconds] = useState(10);
  const [streamMaxRetries, setStreamMaxRetries] = useState(20);
  const [useEventBasedReconnect, setUseEventBasedReconnect] = useState(false);
  const [stallDetectionEnabled, setStallDetectionEnabled] = useState(true);
  // Stremio settings
  const [stremioStreamPickerMode, setStremioStreamPickerMode] = useState<StremioStreamPickerMode>('modal');
  const [showStremioStreamBadges, setShowStremioStreamBadges] = useState(true);
  const [badgeSources, setBadgeSources] = useState<BadgeSource[]>([]);
  const [stremioBadgeSize, setStremioBadgeSize] = useState(100);

  useEffect(() => {
    if (stremioStreamPickerModeProp !== undefined) {
      setStremioStreamPickerMode(stremioStreamPickerModeProp);
    }
  }, [stremioStreamPickerModeProp]);

  useEffect(() => {
    if (showStremioStreamBadgesProp !== undefined) {
      setShowStremioStreamBadges(showStremioStreamBadgesProp);
    }
  }, [showStremioStreamBadgesProp]);

  useEffect(() => {
    if (badgeSourcesProp !== undefined) {
      setBadgeSources(badgeSourcesProp);
    }
  }, [badgeSourcesProp]);

  // LiveTV settings state
  const [epgDarkenCurrent, setEpgDarkenCurrent] = useState(false);
  const [epgTitleFontSize, setEpgTitleFontSize] = useState(32);
  const [epgBodyFontSize, setEpgBodyFontSize] = useState(16);
  const epgView = useEpgView();
  const setEpgView = useSetEpgView();

  // Live View settings state
  const [channelInfoOverlayEnabled, setChannelInfoOverlayEnabled] = useState(channelInfoOverlayEnabledProp ?? false);
  const [channelInfoOverlayFontSize, setChannelInfoOverlayFontSize] = useState(channelInfoOverlayFontSizeProp ?? 16);
  const [channelInfoOverlayLogoSize, setChannelInfoOverlayLogoSize] = useState(channelInfoOverlayLogoSizeProp ?? 42);
  const [channelInfoOverlayBoxWidth, setChannelInfoOverlayBoxWidth] = useState(channelInfoOverlayBoxWidthProp ?? 380);
  const [channelInfoOverlayOpacity, setChannelInfoOverlayOpacity] = useState(channelInfoOverlayOpacityProp ?? 55);
  const [channelInfoOverlayHideDescription, setChannelInfoOverlayHideDescription] = useState(channelInfoOverlayHideDescriptionProp ?? false);

  // Popout settings state
  const [popoutStopMain, setPopoutStopMain] = useState(true);
  const [popoutAlwaysOnTop, setPopoutAlwaysOnTop] = useState(false);
  const [popoutMpvParamsEnabled, setPopoutMpvParamsEnabled] = useState(false);
  const [popoutMpvParams, setPopoutMpvParams] = useState('');
  // External player settings state
  const [externalPlayerPath, setExternalPlayerPath] = useState('');
  const [externalPlayerReuse, setExternalPlayerReuse] = useState(false);
  // Skip Intro settings state
  const [skipIntroTimerSeconds, setSkipIntroTimerSeconds] = useState(10);
  const [skipIntroAutoSkip, setSkipIntroAutoSkip] = useState(false);
  const [castEnabled, setCastEnabled] = useState(false);

  // Widget scale state
  const [widgetScale, setWidgetScaleState] = useState(1);
  const [widgetBgOpacity, setWidgetBgOpacityState] = useState(0.55);

  // Sports overlay state
  const [sportsScale, setSportsScaleState] = useState(1);
  const [sportsBgOpacity, setSportsBgOpacityState] = useState(0.7);

  // Sync prop values to internal state so changes from App.tsx take effect immediately
  useEffect(() => { setChannelInfoOverlayEnabled(channelInfoOverlayEnabledProp ?? false); }, [channelInfoOverlayEnabledProp]);
  useEffect(() => { setChannelInfoOverlayFontSize(channelInfoOverlayFontSizeProp ?? 16); }, [channelInfoOverlayFontSizeProp]);
  useEffect(() => { setChannelInfoOverlayLogoSize(channelInfoOverlayLogoSizeProp ?? 42); }, [channelInfoOverlayLogoSizeProp]);
  useEffect(() => { setChannelInfoOverlayBoxWidth(channelInfoOverlayBoxWidthProp ?? 380); }, [channelInfoOverlayBoxWidthProp]);
  useEffect(() => { setChannelInfoOverlayOpacity(channelInfoOverlayOpacityProp ?? 55); }, [channelInfoOverlayOpacityProp]);
  useEffect(() => { setChannelInfoOverlayHideDescription(channelInfoOverlayHideDescriptionProp ?? false); }, [channelInfoOverlayHideDescriptionProp]);
  useEffect(() => { setCastEnabled(castEnabledProp ?? false); }, [castEnabledProp]);
  
  // Sync overlay autohide timer prop to uiSettings if needed, though uiSettings has it
  useEffect(() => { 
    if (overlayAutohideTimerProp !== undefined && overlayAutohideTimerProp !== uiSettings.overlayAutohideTimer) {
      setUiSettings(prev => ({ ...prev, overlayAutohideTimer: overlayAutohideTimerProp }));
    }
  }, [overlayAutohideTimerProp]);

  // Subtitle settings state
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>({
    subsourceApiKey: '',
    defaultLanguage: 'en',
    defaultAudioLanguage: 'en',
    defaultSize: 35,
    subColor: '#FFFFFF',
    subBackgroundColor: '#000000',
    subBackgroundEnabled: false,
    subBackgroundOpacity: 80,
    subOutlineColor: '#000000',
    subDelay: 0,
    subVerticalOffset: 0,
  });

  // Loading state for settings
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load sources and check encryption on mount
  useEffect(() => {
    loadSources();
    checkEncryption();
    loadSettings();
  }, []);

  async function loadSources() {
    // window.storage is the Tauri storage bridge - if missing, app is broken
    if (!window.storage) {
      console.error('[Settings] window.storage unavailable - Tauri storage bridge missing');
      return;
    }
    const result = await window.storage.getSources();
    if (result.data) {
      // Debug: Check for duplicated EPG URLs
      result.data.forEach((source: Source) => {
        if (source.epg_url && source.epg_url.length > 100) {
          console.log(`[Settings] Source ${source.name} has long epg_url (${source.epg_url.length} chars):`, source.epg_url.substring(0, 100) + '...');
        }
      });
      setSources(result.data);
    }
  }

  async function checkEncryption() {
    if (!window.storage) {
      console.error('[Settings] window.storage unavailable - Tauri storage bridge missing');
      return;
    }
    const result = await window.storage.isEncryptionAvailable();
    if (result.data !== undefined) {
      setIsEncryptionAvailable(result.data);
    }
  }

  async function loadSettings() {
    if (!window.storage) {
      console.error('[Settings] window.storage unavailable - Tauri storage bridge missing');
      return;
    }
    const result = await window.storage.getSettings();
    if (result.data) {
      const settings = result.data as {
        tmdbApiKey?: string;
        vodRefreshHours?: number;
        epgRefreshHours?: number;
        epgSyncConcurrency?: number;
        posterDbApiKey?: string;
        rpdbBackdropsEnabled?: boolean;
        allowLanSources?: boolean;
        debugLoggingEnabled?: boolean;
        logRetentionDays?: number;
        channelSortOrder?: 'alphabetical' | 'number' | 'provider';
        categorySortOrder?: 'default' | 'alphabetical';
        includeSourceInSearch?: boolean;
        maxSearchResults?: number;
        searchResultsOrder?: 'default' | 'alphabetical';
        shortcuts?: ShortcutsMap;
        channelFontSize?: number;
        categoryFontSize?: number;
        startupWidth?: number;
        startupHeight?: number;
        dontSaveWindowSizeOnClose?: boolean;
        rememberLastChannels?: boolean;
        reopenLastOnStartup?: boolean;
        savedLayoutState?: SavedLayoutState;
        startupView?: 'none' | 'guide' | 'movies' | 'series' | 'dvr' | 'sports' | 'calendar';
        mpvParams?: string;
        mpvDisableWhitelist?: boolean;
        timeshiftEnabled?: boolean;
        timeshiftCacheBytes?: number;
        liveBufferOffset?: number;
        streamWatchdogSeconds?: number;
        streamMaxRetries?: number;
        useEventBasedReconnect?: boolean;
        stallDetectionEnabled?: boolean;
        epgDarkenCurrent?: boolean;
        epgView?: 'traditional' | 'alternate';
        collapseSourceCategoriesOnStartup?: boolean;
        modernUiEnabled?: boolean;
        overlayAutohideTimer?: number;
        epgTitleFontSize?: number;
        epgBodyFontSize?: number;
        channelInfoOverlayEnabled?: boolean;
        channelInfoOverlayFontSize?: number;
        channelInfoOverlayLogoSize?: number;
        channelInfoOverlayBoxWidth?: number;
        channelInfoOverlayOpacity?: number;
        channelInfoOverlayHideDescription?: boolean;
        popoutStopMain?: boolean;
        popoutAlwaysOnTop?: boolean;
        popoutMpvParamsEnabled?: boolean;
        popoutMpvParams?: string;
        externalPlayerPath?: string;
        externalPlayerReuse?: boolean;
        skipIntroTimerSeconds?: number;
        skipIntroAutoSkip?: boolean;
        subtitleSettings?: SubtitleSettings;
        widgetScale?: number;
        widgetBgOpacity?: number;
        sportsScale?: number;
        sportsBgOpacity?: number;
        stremioStreamPickerMode?: 'modal' | 'autoplay';
        showStremioStreamBadges?: boolean;
        badgeSources?: BadgeSource[];
        stremioBadgeSize?: number;
        navHiddenTabs?: string[];
        castEnabled?: boolean;
      };

      if (settings.castEnabled !== undefined) {
        setCastEnabled(settings.castEnabled);
      }

      // Load TMDB API key
      const key = settings.tmdbApiKey || '';
      setTmdbApiKey(key);
      if (key) {
        setTmdbKeyValid(true); // Assume valid if previously saved
      }

      // Load refresh settings
      if (settings.vodRefreshHours !== undefined) {
        setVodRefreshHours(settings.vodRefreshHours);
      }
      if (settings.epgRefreshHours !== undefined) {
        setEpgRefreshHours(settings.epgRefreshHours);
      }
      if (settings.epgSyncConcurrency !== undefined) {
        setEpgSyncConcurrency(settings.epgSyncConcurrency);
      }

      // Load PosterDB key
      const rpdbKey = settings.posterDbApiKey || '';
      setPosterDbApiKey(rpdbKey);
      if (rpdbKey) {
        setPosterDbKeyValid(true); // Assume valid if previously saved
      }
      setRpdbBackdropsEnabled(settings.rpdbBackdropsEnabled ?? false);

      // Load security settings
      setAllowLanSources(settings.allowLanSources ?? false);

      // Load debug settings
      setDebugLoggingEnabled(settings.debugLoggingEnabled ?? false);
      setLogRetentionDays(settings.logRetentionDays ?? 7);

      // Load channel display settings
      setChannelSortOrder(settings.channelSortOrder ?? 'provider');
      setCategorySortOrder(settings.categorySortOrder ?? 'default');
      setIncludeSourceInSearch(settings.includeSourceInSearch ?? false);
      setMaxSearchResults(settings.maxSearchResults ?? 200);
      setSearchResultsOrder(settings.searchResultsOrder ?? 'default');

      // Load shortcuts
      if (settings.shortcuts) {
        setShortcuts(settings.shortcuts);
      }

      // Load UI settings
      const loadedModernUi = settings.modernUiEnabled ?? true;
      const loadedUiSettings = {
        startupWidth: settings.startupWidth,
        startupHeight: settings.startupHeight,
        dontSaveWindowSizeOnClose: settings.dontSaveWindowSizeOnClose ?? false,
        modernUiEnabled: loadedModernUi,
        collapseSourceCategoriesOnStartup: settings.collapseSourceCategoriesOnStartup ?? false,
        overlayAutohideTimer: settings.overlayAutohideTimer ?? 3,
      };
      setUiSettings(loadedUiSettings);

      // Load font size settings (moved to LiveTV tab)
      const loadedChannelFontSize = settings.channelFontSize ?? 14;
      const loadedCategoryFontSize = settings.categoryFontSize ?? 13;
      setChannelFontSize(loadedChannelFontSize);
      setCategoryFontSize(loadedCategoryFontSize);
      document.documentElement.style.setProperty('--channel-font-size', `${loadedChannelFontSize}px`);
      document.documentElement.style.setProperty('--category-font-size', `${loadedCategoryFontSize}px`);

      // Apply modern UI class on load
      if (loadedModernUi) {
        document.documentElement.classList.add('modern-ui');
      } else {
        document.documentElement.classList.remove('modern-ui');
      }
      // Persist default if not already saved
      if (settings.modernUiEnabled === undefined) {
        await window.storage.updateSettings({ modernUiEnabled: true });
      }

      // Load startup settings
      setRememberLastChannels(settings.rememberLastChannels ?? false);
      setReopenLastOnStartup(settings.reopenLastOnStartup ?? false);
      setSavedLayoutState(settings.savedLayoutState ?? null);
      setStartupView(settings.startupView ?? 'none');
      navHiddenTabsStore(settings.navHiddenTabs ?? []);

      // Load playback settings
      setMpvParams(settings.mpvParams ?? '');
      setMpvDisableWhitelist(settings.mpvDisableWhitelist ?? false);
      setTimeshiftEnabled(settings.timeshiftEnabled ?? false);
      setTimeshiftCacheBytes(settings.timeshiftCacheBytes ?? 1_073_741_824);
      setLiveBufferOffset(settings.liveBufferOffset ?? 0);
      setStreamWatchdogSeconds(settings.streamWatchdogSeconds ?? 10);
      setStreamMaxRetries(settings.streamMaxRetries ?? 20);
      setUseEventBasedReconnect(settings.useEventBasedReconnect ?? false);
      setStallDetectionEnabled(settings.stallDetectionEnabled ?? true);
      setStremioStreamPickerMode(settings.stremioStreamPickerMode ?? 'modal');
      setShowStremioStreamBadges(settings.showStremioStreamBadges ?? true);
      if (Array.isArray(settings.badgeSources)) {
        setBadgeSources(settings.badgeSources as BadgeSource[]);
      }
      const loadedBadgeSize = settings.stremioBadgeSize ?? 100;
      setStremioBadgeSize(loadedBadgeSize);
      document.documentElement.style.setProperty('--stremio-badge-scale', String(loadedBadgeSize / 100));

      // Load LiveTV settings
      const darkenCurrent = settings.epgDarkenCurrent ?? false;
      setEpgDarkenCurrent(darkenCurrent);
      // Apply CSS class on load
      if (darkenCurrent) {
        document.documentElement.classList.add('epg-darken-current');
      }

      // Load EPG view layout setting
      setEpgView(settings.epgView ?? 'traditional');

      // Load EPG font size settings
      const loadedEpgTitleFontSize = settings.epgTitleFontSize ?? 32;
      const loadedEpgBodyFontSize = settings.epgBodyFontSize ?? 16;
      setEpgTitleFontSize(loadedEpgTitleFontSize);
      setEpgBodyFontSize(loadedEpgBodyFontSize);
      document.documentElement.style.setProperty('--epg-title-font-size', `${loadedEpgTitleFontSize}px`);
      document.documentElement.style.setProperty('--epg-body-font-size', `${loadedEpgBodyFontSize}px`);

      // Load Live View settings
      setChannelInfoOverlayEnabled(settings.channelInfoOverlayEnabled ?? false);
      setChannelInfoOverlayFontSize(settings.channelInfoOverlayFontSize ?? 16);
      setChannelInfoOverlayLogoSize(settings.channelInfoOverlayLogoSize ?? 42);
      setChannelInfoOverlayBoxWidth(settings.channelInfoOverlayBoxWidth ?? 380);
      setChannelInfoOverlayOpacity(settings.channelInfoOverlayOpacity ?? 55);
      setChannelInfoOverlayHideDescription(settings.channelInfoOverlayHideDescription ?? false);

      // Load Popout settings
      setPopoutStopMain(settings.popoutStopMain ?? true);
      setPopoutAlwaysOnTop(settings.popoutAlwaysOnTop ?? false);
      setPopoutMpvParamsEnabled(settings.popoutMpvParamsEnabled ?? false);
      setPopoutMpvParams(settings.popoutMpvParams ?? '');

      // Load External Player settings
      setExternalPlayerPath(settings.externalPlayerPath ?? '');
      setExternalPlayerReuse(settings.externalPlayerReuse ?? false);

      // Load Skip Intro settings
      setSkipIntroTimerSeconds(settings.skipIntroTimerSeconds ?? 10);
      setSkipIntroAutoSkip(settings.skipIntroAutoSkip ?? false);

      // Load subtitle settings
      if (settings.subtitleSettings) {
        setSubtitleSettings(prev => ({
          ...prev,
          ...settings.subtitleSettings
        }));
      }

      // Load widget scale and apply CSS variable immediately
      const loadedScale = settings.widgetScale ?? 1;
      setWidgetScaleState(loadedScale);
      document.documentElement.style.setProperty('--widget-scale', String(loadedScale));

      const loadedBgOpacity = settings.widgetBgOpacity ?? 0.55;
      setWidgetBgOpacityState(loadedBgOpacity);
      document.documentElement.style.setProperty('--widget-bg-opacity', String(loadedBgOpacity));

      const loadedSportsScale = settings.sportsScale ?? 1;
      setSportsScaleState(loadedSportsScale);
      document.documentElement.style.setProperty('--sports-scale', String(loadedSportsScale));

      const loadedSportsBgOpacity = settings.sportsBgOpacity ?? 0.7;
      setSportsBgOpacityState(loadedSportsBgOpacity);
      document.documentElement.style.setProperty('--sports-bg-opacity', String(loadedSportsBgOpacity));
    }
    setSettingsLoaded(true);
  }

  // Check if any VOD source exists (Xtream or Stalker) for showing tabs
  const hasVodSource = sources.some(s => s.type === 'xtream' || s.type === 'stalker');

  const handleMpvParamsChange = async (params: string) => {
    setMpvParams(params);
    if (window.storage) {
      await window.storage.updateSettings({ mpvParams: params });
    }
  };

  const handleMpvDisableWhitelistChange = async (disabled: boolean) => {
    setMpvDisableWhitelist(disabled);
    if (window.storage) {
      await window.storage.updateSettings({ mpvDisableWhitelist: disabled });
    }
  };

  const handleCastEnabledChange = async (enabled: boolean) => {
    setCastEnabled(enabled);
    if (onCastEnabledChange) {
      onCastEnabledChange(enabled);
    }
    if (window.storage) {
      await window.storage.updateSettings({ castEnabled: enabled });
    }
  };

  const handleStreamWatchdogSecondsChange = async (seconds: number) => {
    setStreamWatchdogSeconds(seconds);
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ streamWatchdogSeconds: seconds });
    }
    window.dispatchEvent(new CustomEvent('ynotv:retry-settings-changed', {
      detail: { streamWatchdogSeconds: seconds }
    }));
  };

  const handleStreamMaxRetriesChange = async (retries: number) => {
    setStreamMaxRetries(retries);
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ streamMaxRetries: retries });
    }
    window.dispatchEvent(new CustomEvent('ynotv:retry-settings-changed', {
      detail: { streamMaxRetries: retries }
    }));
  };

  const handleUseEventBasedReconnectChange = async (enabled: boolean) => {
    setUseEventBasedReconnect(enabled);
    if (window.storage) {
      await window.storage.updateSettings({ useEventBasedReconnect: enabled });
    }
    window.dispatchEvent(new CustomEvent('ynotv:retry-settings-changed', {
      detail: { useEventBasedReconnect: enabled }
    }));
  };

  const handleStallDetectionEnabledChange = async (enabled: boolean) => {
    setStallDetectionEnabled(enabled);
    if (window.storage) {
      await window.storage.updateSettings({ stallDetectionEnabled: enabled });
    }
    window.dispatchEvent(new CustomEvent('ynotv:retry-settings-changed', {
      detail: { stallDetectionEnabled: enabled }
    }));
  };

  const handleStremioStreamPickerModeChange = async (mode: StremioStreamPickerMode) => {
    setStremioStreamPickerMode(mode);
    if (onStremioStreamPickerModeChange) {
      onStremioStreamPickerModeChange(mode);
    }
    if (window.storage) {
      await window.storage.updateSettings({ stremioStreamPickerMode: mode });
    }
  };

  const handleShowStremioStreamBadgesChange = async (show: boolean) => {
    setShowStremioStreamBadges(show);
    if (onShowStremioStreamBadgesChange) {
      onShowStremioStreamBadgesChange(show);
    }
    if (window.storage) {
      await window.storage.updateSettings({ showStremioStreamBadges: show });
    }
  };

  const handleBadgeSourcesChange = async (sources: BadgeSource[]) => {
    setBadgeSources(sources);
    if (onBadgeSourcesChange) {
      onBadgeSourcesChange(sources);
    }
    if (window.storage) {
      await window.storage.updateSettings({ badgeSources: sources });
    }
  };

  const handleStremioBadgeSizeChange = async (size: number) => {
    setStremioBadgeSize(size);
    document.documentElement.style.setProperty('--stremio-badge-scale', String(size / 100));
    if (window.storage) {
      await window.storage.updateSettings({ stremioBadgeSize: size });
    }
  };

  const handleTimeshiftChange = async (enabled: boolean, cacheBytes: number, bufferOffset?: number) => {
    setTimeshiftEnabled(enabled);
    setTimeshiftCacheBytes(cacheBytes);
    if (bufferOffset !== undefined) {
      setLiveBufferOffset(bufferOffset);
    }
    if (window.storage) {
      const settings: { timeshiftEnabled: boolean; timeshiftCacheBytes: number; liveBufferOffset?: number } = {
        timeshiftEnabled: enabled,
        timeshiftCacheBytes: cacheBytes,
      };
      if (bufferOffset !== undefined) {
        settings.liveBufferOffset = bufferOffset;
      }
      await window.storage.updateSettings(settings);
    }
  };

  const handleEpgDarkenCurrentChange = async (enabled: boolean) => {
    setEpgDarkenCurrent(enabled);
    // Apply CSS class to document for ProgramBlock to use
    if (enabled) {
      document.documentElement.classList.add('epg-darken-current');
    } else {
      document.documentElement.classList.remove('epg-darken-current');
    }
    if (window.storage) {
      await window.storage.updateSettings({ epgDarkenCurrent: enabled });
    }
  };

  const handleEpgViewChange = async (view: 'traditional' | 'alternate') => {
    setEpgView(view);
    if (window.storage) {
      await window.storage.updateSettings({ epgView: view });
    }
  };

  const handleEpgTitleFontSizeChange = (size: number) => {
    setEpgTitleFontSize(size);
    document.documentElement.style.setProperty('--epg-title-font-size', `${size}px`);
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ epgTitleFontSize: size });
    }
  };

  const handleEpgBodyFontSizeChange = (size: number) => {
    setEpgBodyFontSize(size);
    document.documentElement.style.setProperty('--epg-body-font-size', `${size}px`);
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ epgBodyFontSize: size });
    }
  };

  const handleChannelInfoOverlayChange = async (enabled: boolean) => {
    setChannelInfoOverlayEnabled(enabled);
    if (onChannelInfoOverlayChange) {
      onChannelInfoOverlayChange(enabled);
    }
    if (window.storage) {
      await window.storage.updateSettings({ channelInfoOverlayEnabled: enabled });
    }
  };

  const handleChannelInfoOverlayFontSizeChange = (size: number) => {
    setChannelInfoOverlayFontSize(size);
    if (onChannelInfoOverlayFontSizeChange) {
      onChannelInfoOverlayFontSizeChange(size);
    }
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ channelInfoOverlayFontSize: size });
    }
  };

  const handleChannelInfoOverlayLogoSizeChange = (size: number) => {
    setChannelInfoOverlayLogoSize(size);
    if (onChannelInfoOverlayLogoSizeChange) {
      onChannelInfoOverlayLogoSizeChange(size);
    }
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ channelInfoOverlayLogoSize: size });
    }
  };

  const handleChannelInfoOverlayBoxWidthChange = (width: number) => {
    setChannelInfoOverlayBoxWidth(width);
    if (onChannelInfoOverlayBoxWidthChange) {
      onChannelInfoOverlayBoxWidthChange(width);
    }
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ channelInfoOverlayBoxWidth: width });
    }
  };

  const handleChannelInfoOverlayOpacityChange = (opacity: number) => {
    setChannelInfoOverlayOpacity(opacity);
    if (onChannelInfoOverlayOpacityChange) {
      onChannelInfoOverlayOpacityChange(opacity);
    }
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ channelInfoOverlayOpacity: opacity });
    }
  };

  const handleChannelInfoOverlayHideDescriptionChange = async (hide: boolean) => {
    setChannelInfoOverlayHideDescription(hide);
    if (onChannelInfoOverlayHideDescriptionChange) {
      onChannelInfoOverlayHideDescriptionChange(hide);
    }
    if (window.storage) {
      await window.storage.updateSettings({ channelInfoOverlayHideDescription: hide });
    }
  };

  const handlePopoutStopMainChange = async (stop: boolean) => {
    setPopoutStopMain(stop);
    if (window.storage) {
      await window.storage.updateSettings({ popoutStopMain: stop });
    }
  };

  const handlePopoutAlwaysOnTopChange = async (onTop: boolean) => {
    setPopoutAlwaysOnTop(onTop);
    if (window.storage) {
      await window.storage.updateSettings({ popoutAlwaysOnTop: onTop });
    }
    // Apply immediately if a popout is currently open
    try {
      const { Bridge } = await import('../services/tauri-bridge');
      const isRunning = await Bridge.popoutIsRunning();
      if (isRunning) {
        await Bridge.popoutSetAlwaysOnTop(onTop);
      }
    } catch {
      // Ignore if bridge isn't ready or popout isn't running
    }
  };

  const handlePopoutMpvParamsEnabledChange = async (enabled: boolean) => {
    setPopoutMpvParamsEnabled(enabled);
    if (window.storage) {
      await window.storage.updateSettings({ popoutMpvParamsEnabled: enabled });
    }
  };

  const handlePopoutMpvParamsChange = (params: string) => {
    setPopoutMpvParams(params);
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ popoutMpvParams: params });
    }
  };

  const handleExternalPlayerPathChange = (path: string) => {
    setExternalPlayerPath(path);
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ externalPlayerPath: path });
    }
  };

  const handleExternalPlayerReuseChange = async (reuse: boolean) => {
    setExternalPlayerReuse(reuse);
    if (window.storage) {
      await window.storage.updateSettings({ externalPlayerReuse: reuse });
    }
  };

  const handleSkipIntroTimerSecondsChange = (seconds: number) => {
    setSkipIntroTimerSeconds(seconds);
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ skipIntroTimerSeconds: seconds });
    }
    window.dispatchEvent(new CustomEvent('ynotv:skip-intro-settings-changed', {
      detail: { skipIntroTimerSeconds: seconds }
    }));
  };

  const handleSkipIntroAutoSkipChange = async (auto: boolean) => {
    setSkipIntroAutoSkip(auto);
    if (window.storage) {
      await window.storage.updateSettings({ skipIntroAutoSkip: auto });
    }
    window.dispatchEvent(new CustomEvent('ynotv:skip-intro-settings-changed', {
      detail: { skipIntroAutoSkip: auto }
    }));
  };

  const handleSubtitleSettingsChange = (partial: Partial<SubtitleSettings>) => {
    const updated = { ...subtitleSettings, ...partial };
    setSubtitleSettings(updated);
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ subtitleSettings: updated });
    }
  };

  const handleWidgetScaleChange = (scale: number) => {
    setWidgetScaleState(scale);
    document.documentElement.style.setProperty('--widget-scale', String(scale));
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ widgetScale: scale });
    }
  };

  const handleWidgetBgOpacityChange = (opacity: number) => {
    setWidgetBgOpacityState(opacity);
    document.documentElement.style.setProperty('--widget-bg-opacity', String(opacity));
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ widgetBgOpacity: opacity });
    }
  };

  const handleSportsScaleChange = (scale: number) => {
    setSportsScaleState(scale);
    document.documentElement.style.setProperty('--sports-scale', String(scale));
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ sportsScale: scale });
    }
  };

  const handleSportsBgOpacityChange = (opacity: number) => {
    setSportsBgOpacityState(opacity);
    document.documentElement.style.setProperty('--sports-bg-opacity', String(opacity));
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ sportsBgOpacity: opacity });
    }
  };

  const handleShortcutsChange = async (newShortcuts: ShortcutsMap) => {
    setShortcuts(newShortcuts);
    if (onShortcutsChange) {
      onShortcutsChange(newShortcuts);
    }
    if (window.storage) {
      await window.storage.updateSettings({ shortcuts: newShortcuts });
    }
  };

  const handleUiSettingsChange = async (newSettings: {
    startupWidth?: number;
    startupHeight?: number;
    dontSaveWindowSizeOnClose?: boolean;
    modernUiEnabled?: boolean;
    collapseSourceCategoriesOnStartup?: boolean;
    overlayAutohideTimer?: number;
  }) => {
    const updated = { ...uiSettings, ...newSettings };
    setUiSettings(updated);

    // Apply/remove the modern-ui class when modernUiEnabled changes
    if (newSettings.modernUiEnabled !== undefined) {
      if (newSettings.modernUiEnabled) {
        document.documentElement.classList.add('modern-ui');
      } else {
        document.documentElement.classList.remove('modern-ui');
      }
    }

    if (newSettings.overlayAutohideTimer !== undefined && onOverlayAutohideTimerChange) {
      onOverlayAutohideTimerChange(newSettings.overlayAutohideTimer);
    }

    if (window.storage) {
      await window.storage.updateSettings(newSettings);

      // Also save to localStorage for App.tsx startup logic
      // We retrieve current settings from localStorage to merge, or just create new
      try {
        const existing = localStorage.getItem('app-settings');
        const parsed = existing ? JSON.parse(existing) : {};
        localStorage.setItem('app-settings', JSON.stringify({ ...parsed, ...newSettings }));
      } catch (e) {
        console.error('Failed to save settings to localStorage', e);
      }
    }
  };

  const handleChannelFontSizeChange = (size: number) => {
    setChannelFontSize(size);
    document.documentElement.style.setProperty('--channel-font-size', `${size}px`);
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ channelFontSize: size });
    }
  };

  const handleCategoryFontSizeChange = (size: number) => {
    setCategoryFontSize(size);
    document.documentElement.style.setProperty('--category-font-size', `${size}px`);
    if (window.storage) {
      window.storage.debouncedUpdateSettings({ categoryFontSize: size });
    }
  };

  const handleRememberLastChannelsChange = async (value: boolean) => {
    setRememberLastChannels(value);

    // Automatically turn off Reopen when Remember is turned off
    let updatePayload: any = { rememberLastChannels: value };
    if (!value) {
      setReopenLastOnStartup(false);
      updatePayload.reopenLastOnStartup = false;
    }

    if (window.storage) {
      await window.storage.updateSettings(updatePayload);
    }
  };

  const handleReopenLastOnStartupChange = async (value: boolean) => {
    setReopenLastOnStartup(value);
    if (window.storage) {
      await window.storage.updateSettings({ reopenLastOnStartup: value });
    }
  };

  const handleNavHiddenTabsChange = async (tabs: string[]) => {
    navHiddenTabsStore(tabs);
    if (window.storage) {
      await window.storage.updateSettings({ navHiddenTabs: tabs });
    }
  };

  const handleStartupViewChange = async (value: 'none' | 'guide' | 'movies' | 'series' | 'dvr' | 'sports' | 'calendar' | 'stremio') => {
    setStartupView(value);
    if (window.storage) {
      await window.storage.updateSettings({ startupView: value });
    }
  };

  const handleIncludeSourceInSearchChange = async (value: boolean) => {
    setIncludeSourceInSearch(value);
    if (window.storage) {
      await window.storage.updateSettings({ includeSourceInSearch: value });
    }
  };

  const handleMaxSearchResultsChange = async (value: number) => {
    setMaxSearchResults(value);
    if (window.storage) {
      await window.storage.updateSettings({ maxSearchResults: value });
    }
  };

  const handleSearchResultsOrderChange = async (order: 'default' | 'alphabetical') => {
    setSearchResultsOrder(order);
    if (window.storage) {
      await window.storage.updateSettings({ searchResultsOrder: order });
    }
  };

  const handleCategorySortOrderChange = async (order: 'default' | 'alphabetical') => {
    setCategorySortOrder(order);
    if (window.storage) {
      await window.storage.updateSettings({ categorySortOrder: order });
    }
  };

  function renderTabContent() {
    switch (activeTab) {
      case 'sources':
        return (
          <SourcesTab
            sources={sources}
            isEncryptionAvailable={isEncryptionAvailable}
            onSourcesChange={loadSources}
            editSourceId={editSourceId}
            epgSyncConcurrency={epgSyncConcurrency}
            vodRefreshHours={vodRefreshHours}
            epgRefreshHours={epgRefreshHours}
            onVodRefreshChange={setVodRefreshHours}
            onEpgRefreshChange={setEpgRefreshHours}
            onEpgSyncConcurrencyChange={setEpgSyncConcurrency}
            tmdbApiKey={tmdbApiKey}
            tmdbKeyValid={tmdbKeyValid}
            onApiKeyChange={setTmdbApiKey}
            onApiKeyValidChange={setTmdbKeyValid}
            rpdbApiKey={posterDbApiKey}
            rpdbKeyValid={posterDbKeyValid}
            onRpdbApiKeyChange={setPosterDbApiKey}
            onRpdbKeyValidChange={setPosterDbKeyValid}
            rpdbBackdropsEnabled={rpdbBackdropsEnabled}
            onRpdbBackdropsEnabledChange={setRpdbBackdropsEnabled}
          />
        );
      case 'subtitles':
        return (
          <SubtitlesTab
            settings={subtitleSettings}
            onSettingsChange={handleSubtitleSettingsChange}
          />
        );
      case 'strem':
        return (
          <StremTab
            stremioStreamPickerMode={stremioStreamPickerMode}
            onStremioStreamPickerModeChange={handleStremioStreamPickerModeChange}
            showStremioStreamBadges={showStremioStreamBadges}
            onShowStremioStreamBadgesChange={handleShowStremioStreamBadgesChange}
            badgeSources={badgeSources}
            onBadgeSourcesChange={handleBadgeSourcesChange}
            stremioBadgeSize={stremioBadgeSize}
            onStremioBadgeSizeChange={handleStremioBadgeSizeChange}
          />
        );
      case 'security':
        return (
          <SecurityTab
            allowLanSources={allowLanSources}
            onAllowLanSourcesChange={setAllowLanSources}
          />
        );
      case 'debug':
        return (
          <DebugTab
            debugLoggingEnabled={debugLoggingEnabled}
            onDebugLoggingChange={setDebugLoggingEnabled}
            logRetentionDays={logRetentionDays}
            onLogRetentionChange={(val) => {
              setLogRetentionDays(val);
              if (window.storage) window.storage.updateSettings({ logRetentionDays: val });
            }}
          />
        );
      case 'shortcuts':
        return (
          <ShortcutsTab
            shortcuts={shortcuts}
            onShortcutsChange={handleShortcutsChange}
          />
        );
      case 'export-import':
        return <ImportExportTab />;
      case 'ui':
        return (
          <UITab
            settings={uiSettings}
            onSettingsChange={handleUiSettingsChange}
          />
        );
      case 'navigation':
        return (
          <NavigationTab
            navHiddenTabs={navHiddenTabs}
            onNavHiddenTabsChange={handleNavHiddenTabsChange}
          />
        );
      case 'theme':
        return (
          <ThemeTab
            theme={theme || 'glass-neon'}
            onThemeChange={onThemeChange || (() => { })}
          />
        );
      case 'startup':
        return (
          <StartupTab
            rememberLastChannels={rememberLastChannels}
            reopenLastOnStartup={reopenLastOnStartup}
            savedLayoutState={savedLayoutState}
            startupView={startupView}
            onRememberLastChannelsChange={handleRememberLastChannelsChange}
            onReopenLastOnStartupChange={handleReopenLastOnStartupChange}
            onStartupViewChange={handleStartupViewChange}
          />
        );
      case 'playback':
        return (
          <PlaybackTab
            mpvParams={mpvParams}
            mpvDisableWhitelist={mpvDisableWhitelist}
            onMpvParamsChange={handleMpvParamsChange}
            onMpvDisableWhitelistChange={handleMpvDisableWhitelistChange}
            streamWatchdogSeconds={streamWatchdogSeconds}
            streamMaxRetries={streamMaxRetries}
            onStreamWatchdogSecondsChange={handleStreamWatchdogSecondsChange}
            onStreamMaxRetriesChange={handleStreamMaxRetriesChange}
            castEnabled={castEnabled}
            onCastEnabledChange={handleCastEnabledChange}
            useEventBasedReconnect={useEventBasedReconnect}
            onUseEventBasedReconnectChange={handleUseEventBasedReconnectChange}
            stallDetectionEnabled={stallDetectionEnabled}
            onStallDetectionEnabledChange={handleStallDetectionEnabledChange}
            popoutStopMain={popoutStopMain}
            onPopoutStopMainChange={handlePopoutStopMainChange}
            popoutAlwaysOnTop={popoutAlwaysOnTop}
            onPopoutAlwaysOnTopChange={handlePopoutAlwaysOnTopChange}
            popoutMpvParamsEnabled={popoutMpvParamsEnabled}
            onPopoutMpvParamsEnabledChange={handlePopoutMpvParamsEnabledChange}
            popoutMpvParams={popoutMpvParams}
            onPopoutMpvParamsChange={handlePopoutMpvParamsChange}
            externalPlayerPath={externalPlayerPath}
            onExternalPlayerPathChange={handleExternalPlayerPathChange}
            externalPlayerReuse={externalPlayerReuse}
            onExternalPlayerReuseChange={handleExternalPlayerReuseChange}
            skipIntroTimerSeconds={skipIntroTimerSeconds}
            onSkipIntroTimerSecondsChange={handleSkipIntroTimerSecondsChange}
            skipIntroAutoSkip={skipIntroAutoSkip}
            onSkipIntroAutoSkipChange={handleSkipIntroAutoSkipChange}
          />
        );
      case 'cache':
        return (
          <CacheTab
            timeshiftEnabled={timeshiftEnabled}
            timeshiftCacheBytes={timeshiftCacheBytes}
            liveBufferOffset={liveBufferOffset}
            onTimeshiftChange={handleTimeshiftChange}
          />
        );
      case 'livetv':
        return (
          <LiveTVTab
            epgDarkenCurrent={epgDarkenCurrent}
            onEpgDarkenCurrentChange={handleEpgDarkenCurrentChange}
            epgView={epgView}
            onEpgViewChange={handleEpgViewChange}
            epgTitleFontSize={epgTitleFontSize}
            onEpgTitleFontSizeChange={handleEpgTitleFontSizeChange}
            epgBodyFontSize={epgBodyFontSize}
            onEpgBodyFontSizeChange={handleEpgBodyFontSizeChange}
            channelFontSize={channelFontSize}
            onChannelFontSizeChange={handleChannelFontSizeChange}
            categoryFontSize={categoryFontSize}
            onCategoryFontSizeChange={handleCategoryFontSizeChange}
            channelSortOrder={channelSortOrder}
            onChannelSortOrderChange={setChannelSortOrder}
            categorySortOrder={categorySortOrder}
            onCategorySortOrderChange={handleCategorySortOrderChange}
            includeSourceInSearch={includeSourceInSearch}
            onIncludeSourceInSearchChange={handleIncludeSourceInSearchChange}
            maxSearchResults={maxSearchResults}
            onMaxSearchResultsChange={handleMaxSearchResultsChange}
            searchResultsOrder={searchResultsOrder}
            onSearchResultsOrderChange={handleSearchResultsOrderChange}
            channelInfoOverlayEnabled={channelInfoOverlayEnabled}
            onChannelInfoOverlayChange={handleChannelInfoOverlayChange}
            channelInfoOverlayFontSize={channelInfoOverlayFontSize}
            onChannelInfoOverlayFontSizeChange={handleChannelInfoOverlayFontSizeChange}
            channelInfoOverlayLogoSize={channelInfoOverlayLogoSize}
            onChannelInfoOverlayLogoSizeChange={handleChannelInfoOverlayLogoSizeChange}
            channelInfoOverlayBoxWidth={channelInfoOverlayBoxWidth}
            onChannelInfoOverlayBoxWidthChange={handleChannelInfoOverlayBoxWidthChange}
            channelInfoOverlayOpacity={channelInfoOverlayOpacity}
            onChannelInfoOverlayOpacityChange={handleChannelInfoOverlayOpacityChange}
            channelInfoOverlayHideDescription={channelInfoOverlayHideDescription}
            onChannelInfoOverlayHideDescriptionChange={handleChannelInfoOverlayHideDescriptionChange}
            widgetScale={widgetScale}
            onWidgetScaleChange={handleWidgetScaleChange}
            widgetBgOpacity={widgetBgOpacity}
            onWidgetBgOpacityChange={handleWidgetBgOpacityChange}
            sportsScale={sportsScale}
            onSportsScaleChange={handleSportsScaleChange}
            sportsBgOpacity={sportsBgOpacity}
            onSportsBgOpacityChange={handleSportsBgOpacityChange}
          />
        );
      case 'about':
        return <AboutTab />;
      case 'scrobbling':
        return <ScrobblingTab />;
      default:
        return null;
    }
  }

  return (
    <div className="settings-overlay">
      <div className="settings-panel settings-panel--sidebar">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Encryption Warning */}
        {!isEncryptionAvailable && (
          <div className="encryption-warning">
            <span className="warning-icon">Warning:</span>
            <span>
              Secure storage unavailable. Credentials will be stored without encryption.
              <br />
              <small>Install a keyring (gnome-keyring, kwallet) for secure storage.</small>
            </span>
          </div>
        )}

        <div className="settings-body">
          {/* Sidebar Navigation */}
          <SettingsSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            hasVodSource={hasVodSource}
          />

          {/* Tab Content */}
          <div className="settings-content">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

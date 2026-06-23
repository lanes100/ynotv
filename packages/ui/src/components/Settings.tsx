import { useState, useEffect, useRef } from 'react';
import type { Source } from '@ynotv/core';
import { useEpgView, useSetEpgView, useSetEpgVisibleHours, useUIStore } from '../stores/uiStore';
import { SettingsSidebar, type SettingsTabId } from './settings/SettingsSidebar';
import { searchSettings, type SettingsSearchResult } from './settings/SettingsSearchIndex';
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
import { NuvioTab } from './settings/NuvioTab';
import { ProxyTab } from './settings/ProxyTab';
import { useModal } from './Modal';
import { TmdbTab } from './settings/TmdbTab';
import type { ShortcutsMap, ThemeId } from '../types/app';
import type { StremioStreamPickerMode, BadgeSource, StreamAutoPlayMode, StreamAutoPlaySourceScope } from '../types/stremio';
import { DEFAULT_BADGE_SOURCES, mergeDefaultBadgeSources } from '../utils/streamBadges';
import './Settings.css';

interface SettingsProps {
  onClose: () => void;
  onShortcutsChange?: (shortcuts: ShortcutsMap) => void;
  theme?: ThemeId;
  onThemeChange?: (theme: ThemeId) => void;
  initialTab?: SettingsTabId;
  editSourceId?: string | null;
  pendingSubTabFromParent?: string | null;
  onConsumePendingSubTab?: () => void;
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
  transparentGuideOnZap?: boolean;
  onTransparentGuideOnZapChange?: (enabled: boolean) => void;
  castEnabled?: boolean;
  onCastEnabledChange?: (enabled: boolean) => void;
  castRewriteTs?: boolean;
  onCastRewriteTsChange?: (enabled: boolean) => void;
  stremioStreamPickerMode?: StremioStreamPickerMode;
  onStremioStreamPickerModeChange?: (mode: StremioStreamPickerMode) => void;
  showStremioStreamBadges?: boolean;
  onShowStremioStreamBadgesChange?: (show: boolean) => void;
  badgeSources?: BadgeSource[];
  onBadgeSourcesChange?: (sources: BadgeSource[]) => void;
  stremioBadgeSize?: number;
  onStremioBadgeSizeChange?: (size: number) => void;
  showHoverDetails?: boolean;
  onShowHoverDetailsChange?: (show: boolean) => void;
  showFileSizeBadges?: boolean;
  onShowFileSizeBadgesChange?: (enabled: boolean) => void;
  streamBadgePlacement?: 'top' | 'bottom';
  onStreamBadgePlacementChange?: (placement: 'top' | 'bottom') => void;
  stremioCacheFetchResults?: boolean;
  onStremioCacheFetchResultsChange?: (enabled: boolean) => void;
  stremioCacheFetchTimeout?: number;
  onStremioCacheFetchTimeoutChange?: (timeout: number) => void;
  showNuvioStreamBadges?: boolean;
  onShowNuvioStreamBadgesChange?: (enabled: boolean) => void;
  nuvioBadgeSources?: BadgeSource[];
  onNuvioBadgeSourcesChange?: (sources: BadgeSource[]) => void;
  nuvioBadgeSize?: number;
  onNuvioBadgeSizeChange?: (size: number) => void;
  nuvioShowFileSizeBadges?: boolean;
  onNuvioShowFileSizeBadgesChange?: (enabled: boolean) => void;
  nuvioStreamBadgePlacement?: 'top' | 'bottom';
  onNuvioStreamBadgePlacementChange?: (placement: 'top' | 'bottom') => void;
  showNuvioHoverDetails?: boolean;
  onShowNuvioHoverDetailsChange?: (show: boolean) => void;
  nuvioCacheFetchResults?: boolean;
  onNuvioCacheFetchResultsChange?: (enabled: boolean) => void;
  nuvioCacheFetchTimeout?: number;
  onNuvioCacheFetchTimeoutChange?: (timeout: number) => void;
  liveTvDesign?: 'v1' | 'v2' | 'v3';
  onLiveTvDesignChange?: (design: 'v1' | 'v2' | 'v3') => void;
}

export function Settings({
  onClose,
  onShortcutsChange,
  theme,
  onThemeChange,
  initialTab = 'sources',
  editSourceId = null,
  pendingSubTabFromParent,
  onConsumePendingSubTab,
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
  transparentGuideOnZap: transparentGuideOnZapProp,
  onTransparentGuideOnZapChange,
  castEnabled: castEnabledProp,
  onCastEnabledChange,
  castRewriteTs: castRewriteTsProp,
  onCastRewriteTsChange,
  stremioStreamPickerMode: stremioStreamPickerModeProp,
  onStremioStreamPickerModeChange,
  showStremioStreamBadges: showStremioStreamBadgesProp,
  onShowStremioStreamBadgesChange,
  badgeSources: badgeSourcesProp,
  onBadgeSourcesChange,
  stremioBadgeSize: stremioBadgeSizeProp,
  onStremioBadgeSizeChange,
  showHoverDetails: showHoverDetailsProp,
  onShowHoverDetailsChange,
  showFileSizeBadges: showFileSizeBadgesProp,
  onShowFileSizeBadgesChange,
  streamBadgePlacement: streamBadgePlacementProp,
  onStreamBadgePlacementChange,
  stremioCacheFetchResults: stremioCacheFetchResultsProp,
  onStremioCacheFetchResultsChange,
  stremioCacheFetchTimeout: stremioCacheFetchTimeoutProp,
  onStremioCacheFetchTimeoutChange,
  showNuvioStreamBadges: showNuvioStreamBadgesProp,
  onShowNuvioStreamBadgesChange,
  nuvioBadgeSources: nuvioBadgeSourcesProp,
  onNuvioBadgeSourcesChange,
  nuvioBadgeSize: nuvioBadgeSizeProp,
  onNuvioBadgeSizeChange,
  nuvioShowFileSizeBadges: nuvioShowFileSizeBadgesProp,
  onNuvioShowFileSizeBadgesChange,
  nuvioStreamBadgePlacement: nuvioStreamBadgePlacementProp,
  onNuvioStreamBadgePlacementChange,
  showNuvioHoverDetails: showNuvioHoverDetailsProp,
  onShowNuvioHoverDetailsChange,
  nuvioCacheFetchResults: nuvioCacheFetchResultsProp,
  onNuvioCacheFetchResultsChange,
  nuvioCacheFetchTimeout: nuvioCacheFetchTimeoutProp,
  onNuvioCacheFetchTimeoutChange,
  liveTvDesign,
  onLiveTvDesignChange,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const { showConfirm, ModalComponent } = useModal();
  const nuvioHasUnsavedHomeLayout = useUIStore((s) => s.nuvioHasUnsavedHomeLayout);
  const nuvioTabSaveFn = useUIStore((s) => s.nuvioTabSaveFn);

  const handleTabChange = (newTab: SettingsTabId) => {
    if (activeTab === 'nuvio' && nuvioHasUnsavedHomeLayout) {
      showConfirm(
        'Unsaved Changes',
        "Changes aren't saved, would you like to save homepage layout?",
        async () => {
          try {
            await nuvioTabSaveFn?.();
            useUIStore.setState({ nuvioHasUnsavedHomeLayout: false });
            setActiveTab(newTab);
          } catch (err) {
            // Error was already alerted inside child component
          }
        },
        () => {
          useUIStore.setState({ nuvioHasUnsavedHomeLayout: false });
          setActiveTab(newTab);
        },
        'Save',
        'Discard Changes'
      );
    } else {
      setActiveTab(newTab);
    }
  };

  const handleClose = () => {
    if (activeTab === 'nuvio' && nuvioHasUnsavedHomeLayout) {
      showConfirm(
        'Unsaved Changes',
        "Changes aren't saved, would you like to save homepage layout?",
        async () => {
          try {
            await nuvioTabSaveFn?.();
            useUIStore.setState({ nuvioHasUnsavedHomeLayout: false });
            onClose();
          } catch (err) {
            // Error was already alerted inside child component
          }
        },
        () => {
          useUIStore.setState({ nuvioHasUnsavedHomeLayout: false });
          onClose();
        },
        'Save',
        'Discard Changes'
      );
    } else {
      onClose();
    }
  };
  const [isFullScreen, setIsFullScreen] = useState<boolean>(() => {
    return localStorage.getItem('settings_fullscreen') === 'true';
  });

  const toggleFullScreen = () => {
    const nextVal = !isFullScreen;
    setIsFullScreen(nextVal);
    localStorage.setItem('settings_fullscreen', String(nextVal));
  };

  const [pendingSubTab, setPendingSubTab] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync pending sub-tab from parent (e.g., navigating from Cast button)
  useEffect(() => {
    if (pendingSubTabFromParent) {
      setPendingSubTab(pendingSubTabFromParent);
      onConsumePendingSubTab?.();
    }
  }, [pendingSubTabFromParent, onConsumePendingSubTab]);
  const [searchResults, setSearchResults] = useState<SettingsSearchResult[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [isEncryptionAvailable, setIsEncryptionAvailable] = useState(true);

  const [tmdbApiKey, setTmdbApiKey] = useState('');
  const [tmdbKeyValid, setTmdbKeyValid] = useState<boolean | null>(null);

  // Streaming Catalogs state
  const [streamingCatalogsEnabled, setStreamingCatalogsEnabled] = useState(true);
  const [streamingNuvioCatalogsEnabled, setStreamingNuvioCatalogsEnabled] = useState(true);
  const [enabledStreamingServices, setEnabledStreamingServices] = useState<string[]>(['netflix', 'disney', 'hulu', 'prime', 'apple', 'max', 'paramount', 'peacock']);

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

  // Proxy state
  const [socks5ProxyEnabled, setSocks5ProxyEnabled] = useState(false);
  const [socks5ProxyServer, setSocks5ProxyServer] = useState('');
  const [socks5ProxyUsername, setSocks5ProxyUsername] = useState('');
  const [socks5ProxyPassword, setSocks5ProxyPassword] = useState('');

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
    modernUiEnabled?: boolean | string;
    collapseSourceCategoriesOnStartup?: boolean;
    overlayAutohideTimer?: number;
    uiScale?: number;
  }>({
    modernUiEnabled: 'v3',
    collapseSourceCategoriesOnStartup: false,
    overlayAutohideTimer: 3,
    uiScale: 100,
  });

  // Font size state (moved to LiveTV tab)
  const [channelFontSize, setChannelFontSize] = useState(14);
  const [categoryFontSize, setCategoryFontSize] = useState(13);

  // Startup settings state
  const [rememberLastChannels, setRememberLastChannels] = useState(false);
  const [reopenLastOnStartup, setReopenLastOnStartup] = useState(false);
  const [savedLayoutState, setSavedLayoutState] = useState<SavedLayoutState | null>(null);
  const [startupView, setStartupView] = useState<'none' | 'guide' | 'movies' | 'series' | 'dvr' | 'sports' | 'calendar' | 'stremio' | 'nuvio'>('none');
  const navHiddenTabs = useUIStore((s) => s.navHiddenTabs);
  const navHiddenTabsStore = useUIStore((s) => s.setNavHiddenTabs);
  const epgHiddenButtons = useUIStore((s) => s.epgHiddenButtons);
  const epgHiddenButtonsStore = useUIStore((s) => s.setEpgHiddenButtons);

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
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  // Stremio settings
  const [stremioStreamPickerMode, setStremioStreamPickerMode] = useState<StremioStreamPickerMode>('modal');
  const [showStremioStreamBadges, setShowStremioStreamBadges] = useState(true);
  const [badgeSources, setBadgeSources] = useState<BadgeSource[]>(DEFAULT_BADGE_SOURCES);
  const [stremioBadgeSize, setStremioBadgeSize] = useState(100);
  const [showHoverDetails, setShowHoverDetails] = useState(true);
  const [showFileSizeBadges, setShowFileSizeBadges] = useState(true);
  const [streamBadgePlacement, setStreamBadgePlacement] = useState<'top' | 'bottom'>('bottom');
  const [stremioCacheFetchResults, setStremioCacheFetchResults] = useState(false);
  const [stremioCacheFetchTimeout, setStremioCacheFetchTimeout] = useState(5);
  const [showNuvioStreamBadges, setShowNuvioStreamBadges] = useState(true);
  const [nuvioBadgeSources, setNuvioBadgeSources] = useState<BadgeSource[]>(DEFAULT_BADGE_SOURCES);
  const [nuvioBadgeSize, setNuvioBadgeSize] = useState(100);
  const [nuvioShowFileSizeBadges, setNuvioShowFileSizeBadges] = useState(true);
  const [nuvioStreamBadgePlacement, setNuvioStreamBadgePlacement] = useState<'top' | 'bottom'>('bottom');
  const [showNuvioHoverDetails, setShowNuvioHoverDetails] = useState(true);
  const [nuvioCacheFetchResults, setNuvioCacheFetchResults] = useState(false);
  const [nuvioCacheFetchTimeout, setNuvioCacheFetchTimeout] = useState(5);
  const [nuvioAutoPlayMode, setNuvioAutoPlayMode] = useState<StreamAutoPlayMode>('manual');
  const [nuvioAutoPlayTimeout, setNuvioAutoPlayTimeout] = useState(0);
  const [nuvioAutoPlaySourceScope, setNuvioAutoPlaySourceScope] = useState<StreamAutoPlaySourceScope>('all');
  const [nuvioAutoPlayAllowedAddons, setNuvioAutoPlayAllowedAddons] = useState<string[]>([]);
  const [nuvioAutoPlayAllowedPlugins, setNuvioAutoPlayAllowedPlugins] = useState<string[]>([]);
  const [nuvioAutoPlayRegex, setNuvioAutoPlayRegex] = useState<string>('');

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
      setBadgeSources(mergeDefaultBadgeSources(badgeSourcesProp));
    }
  }, [badgeSourcesProp]);

  useEffect(() => {
    if (stremioBadgeSizeProp !== undefined) {
      setStremioBadgeSize(stremioBadgeSizeProp);
    }
  }, [stremioBadgeSizeProp]);

  useEffect(() => {
    if (showHoverDetailsProp !== undefined) {
      setShowHoverDetails(showHoverDetailsProp);
    }
  }, [showHoverDetailsProp]);

  useEffect(() => {
    if (showFileSizeBadgesProp !== undefined) {
      setShowFileSizeBadges(showFileSizeBadgesProp);
    }
  }, [showFileSizeBadgesProp]);

  useEffect(() => {
    if (streamBadgePlacementProp !== undefined) {
      setStreamBadgePlacement(streamBadgePlacementProp);
    }
  }, [streamBadgePlacementProp]);

  useEffect(() => {
    if (stremioCacheFetchResultsProp !== undefined) {
      setStremioCacheFetchResults(stremioCacheFetchResultsProp);
    }
  }, [stremioCacheFetchResultsProp]);

  useEffect(() => {
    if (stremioCacheFetchTimeoutProp !== undefined) {
      setStremioCacheFetchTimeout(stremioCacheFetchTimeoutProp);
    }
  }, [stremioCacheFetchTimeoutProp]);

  useEffect(() => {
    if (showNuvioStreamBadgesProp !== undefined) {
      setShowNuvioStreamBadges(showNuvioStreamBadgesProp);
    }
  }, [showNuvioStreamBadgesProp]);

  useEffect(() => {
    if (nuvioBadgeSourcesProp !== undefined) {
      setNuvioBadgeSources(mergeDefaultBadgeSources(nuvioBadgeSourcesProp));
    }
  }, [nuvioBadgeSourcesProp]);

  useEffect(() => {
    if (nuvioBadgeSizeProp !== undefined) {
      setNuvioBadgeSize(nuvioBadgeSizeProp);
    }
  }, [nuvioBadgeSizeProp]);

  useEffect(() => {
    if (nuvioShowFileSizeBadgesProp !== undefined) {
      setNuvioShowFileSizeBadges(nuvioShowFileSizeBadgesProp);
    }
  }, [nuvioShowFileSizeBadgesProp]);

  useEffect(() => {
    if (nuvioStreamBadgePlacementProp !== undefined) {
      setNuvioStreamBadgePlacement(nuvioStreamBadgePlacementProp);
    }
  }, [nuvioStreamBadgePlacementProp]);

  useEffect(() => {
    if (showNuvioHoverDetailsProp !== undefined) {
      setShowNuvioHoverDetails(showNuvioHoverDetailsProp);
    }
  }, [showNuvioHoverDetailsProp]);

  useEffect(() => {
    if (nuvioCacheFetchResultsProp !== undefined) {
      setNuvioCacheFetchResults(nuvioCacheFetchResultsProp);
    }
  }, [nuvioCacheFetchResultsProp]);

  useEffect(() => {
    if (nuvioCacheFetchTimeoutProp !== undefined) {
      setNuvioCacheFetchTimeout(nuvioCacheFetchTimeoutProp);
    }
  }, [nuvioCacheFetchTimeoutProp]);

  // Category settings state
  const [showAllChannels, setShowAllChannels] = useState(true);
  const [showFavorites, setShowFavorites] = useState(true);
  const [showWatchlist, setShowWatchlist] = useState(true);
  const [showRecentlyViewed, setShowRecentlyViewed] = useState(true);

  // LiveTV settings state
  const [epgDarkenCurrent, setEpgDarkenCurrent] = useState(false);
  const [epgBoldChannelNames, setEpgBoldChannelNames] = useState(false);
  const [epgBoldTopCategories, setEpgBoldTopCategories] = useState(false);
  const [epgBoldSourceCategories, setEpgBoldSourceCategories] = useState(false);
  const [epgTitleFontSize, setEpgTitleFontSize] = useState(32);
  const [epgBodyFontSize, setEpgBodyFontSize] = useState(16);
  const epgView = useEpgView();
  const setEpgView = useSetEpgView();
  const setEpgVisibleHours = useSetEpgVisibleHours();
  const [epgVisibleHours, setEpgVisibleHoursState] = useState<'auto' | number>('auto');
  const [transparentGuideHeight, setTransparentGuideHeight] = useState(40);
  const [transparentGuideHideHeader, setTransparentGuideHideHeader] = useState(false);
  const [transparentGuideOverlayOpacity, setTransparentGuideOverlayOpacity] = useState(55);
  const [transparentGuideSidebarOpacity, setTransparentGuideSidebarOpacity] = useState(55);

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
  const [castRewriteTs, setCastRewriteTs] = useState(true);

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
  useEffect(() => { setCastRewriteTs(castRewriteTsProp ?? true); }, [castRewriteTsProp]);
  
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
    defaultAudioLanguage: 'default',
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

  // Listen for category settings changes from context menu hide actions
  useEffect(() => {
    const handleCategorySettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        if (customEvent.detail.showAllChannels !== undefined) {
          setShowAllChannels(customEvent.detail.showAllChannels);
        }
        if (customEvent.detail.showFavorites !== undefined) {
          setShowFavorites(customEvent.detail.showFavorites);
        }
        if (customEvent.detail.showWatchlist !== undefined) {
          setShowWatchlist(customEvent.detail.showWatchlist);
        }
        if (customEvent.detail.showRecentlyViewed !== undefined) {
          setShowRecentlyViewed(customEvent.detail.showRecentlyViewed);
        }
      }
    };
    window.addEventListener('ynotv:category-settings-changed', handleCategorySettingsChange);
    return () => {
      window.removeEventListener('ynotv:category-settings-changed', handleCategorySettingsChange);
    };
  }, []);

  // Listen for transparent guide height changes from dragging the EPG overlay
  useEffect(() => {
    const handleTransparentGuideHeightChangeCustom = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.height === 'number') {
        setTransparentGuideHeight(customEvent.detail.height);
      }
    };
    window.addEventListener('ynotv:transparent-guide-height-changed', handleTransparentGuideHeightChangeCustom);
    return () => {
      window.removeEventListener('ynotv:transparent-guide-height-changed', handleTransparentGuideHeightChangeCustom);
    };
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
        streamingCatalogsEnabled?: boolean;
        streamingNuvioCatalogsEnabled?: boolean;
        enabledStreamingServices?: string[];
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
        startupView?: 'none' | 'guide' | 'movies' | 'series' | 'dvr' | 'sports' | 'calendar' | 'stremio' | 'nuvio';
        mpvParams?: string;
        mpvDisableWhitelist?: boolean;
        timeshiftEnabled?: boolean;
        timeshiftCacheBytes?: number;
        liveBufferOffset?: number;
        streamWatchdogSeconds?: number;
        streamMaxRetries?: number;
        useEventBasedReconnect?: boolean;
        stallDetectionEnabled?: boolean;
        showLoadingScreen?: boolean;
        epgDarkenCurrent?: boolean;
        epgBoldChannelNames?: boolean;
        epgBoldTopCategories?: boolean;
        epgBoldSourceCategories?: boolean;
        epgView?: 'traditional' | 'alternate';
        collapseSourceCategoriesOnStartup?: boolean;
        modernUiEnabled?: boolean | string;
        v3DefaultMigrated?: boolean;
        overlayAutohideTimer?: number;
        uiScale?: number;
        epgVisibleHours?: 'auto' | number;
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
        stremioCacheFetchResults?: boolean;
        stremioCacheFetchTimeout?: number;
        badgeSources?: BadgeSource[];
        stremioBadgeSize?: number;
        showFileSizeBadges?: boolean;
        streamBadgePlacement?: 'top' | 'bottom';
        showNuvioStreamBadges?: boolean;
        nuvioBadgeSources?: BadgeSource[];
        nuvioBadgeSize?: number;
        nuvioShowFileSizeBadges?: boolean;
        nuvioStreamBadgePlacement?: 'top' | 'bottom';
        navHiddenTabs?: string[];
        epgHiddenButtons?: string[];
        castEnabled?: boolean;
        castRewriteTs?: boolean;
        transparentGuideHeight?: number;
        transparentGuideHideHeader?: boolean;
        transparentGuideOnZap?: boolean;
        transparentGuideOverlayOpacity?: number;
        transparentGuideSidebarOpacity?: number;
        socks5ProxyEnabled?: boolean;
        socks5ProxyServer?: string;
        socks5ProxyUsername?: string;
        socks5ProxyPassword?: string;
        showAllChannels?: boolean;
        showFavorites?: boolean;
        showWatchlist?: boolean;
        showRecentlyViewed?: boolean;
        showNuvioHoverDetails?: boolean;
        nuvioAutoPlayMode?: StreamAutoPlayMode;
        nuvioAutoPlayTimeout?: number;
        nuvioAutoPlaySourceScope?: StreamAutoPlaySourceScope;
        nuvioAutoPlayAllowedAddons?: string[];
        nuvioAutoPlayAllowedPlugins?: string[];
        nuvioAutoPlayRegex?: string;
        nuvioCacheFetchResults?: boolean;
        nuvioCacheFetchTimeout?: number;
      };

      setShowAllChannels(settings.showAllChannels ?? true);
      setShowFavorites(settings.showFavorites ?? true);
      setShowWatchlist(settings.showWatchlist ?? true);
      setShowRecentlyViewed(settings.showRecentlyViewed ?? true);

      if (settings.castEnabled !== undefined) {
        setCastEnabled(settings.castEnabled);
      }
      if (settings.castRewriteTs !== undefined) {
        setCastRewriteTs(settings.castRewriteTs);
      }

      // Load TMDB API key
      const key = settings.tmdbApiKey || '';
      setTmdbApiKey(key);
      if (key) {
        setTmdbKeyValid(true); // Assume valid if previously saved
      }

      setStreamingCatalogsEnabled(settings.streamingCatalogsEnabled ?? true);
      setStreamingNuvioCatalogsEnabled(settings.streamingNuvioCatalogsEnabled ?? true);
      setEnabledStreamingServices(settings.enabledStreamingServices ?? ['netflix', 'disney', 'hulu', 'prime', 'apple', 'max', 'paramount', 'peacock']);

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

      // Load proxy settings
      setSocks5ProxyEnabled(settings.socks5ProxyEnabled ?? false);
      setSocks5ProxyServer(settings.socks5ProxyServer ?? '');
      setSocks5ProxyUsername(settings.socks5ProxyUsername ?? '');
      setSocks5ProxyPassword(settings.socks5ProxyPassword ?? '');

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
      let loadedModernUi = settings.modernUiEnabled;
      if (!settings.v3DefaultMigrated) {
        loadedModernUi = 'v3';
        window.storage.updateSettings({
          modernUiEnabled: 'v3',
          v3DefaultMigrated: true
        });
      }
      const loadedUiSettings = {
        startupWidth: settings.startupWidth,
        startupHeight: settings.startupHeight,
        dontSaveWindowSizeOnClose: settings.dontSaveWindowSizeOnClose ?? false,
        modernUiEnabled: loadedModernUi,
        collapseSourceCategoriesOnStartup: settings.collapseSourceCategoriesOnStartup ?? false,
        overlayAutohideTimer: settings.overlayAutohideTimer ?? 3,
        uiScale: settings.uiScale ?? 100,
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
      const design = loadedModernUi === 'v3' ? 'v3' : (loadedModernUi === false || loadedModernUi === 'v1' ? 'v1' : 'v2');
      document.documentElement.classList.remove('modern-ui', 'modern-ui-v3');
      if (design === 'v3') {
        document.documentElement.classList.add('modern-ui', 'modern-ui-v3');
      } else if (design === 'v2') {
        document.documentElement.classList.add('modern-ui');
      }
      if (onLiveTvDesignChange) {
        onLiveTvDesignChange(design);
      }

      // Load startup settings
      setRememberLastChannels(settings.rememberLastChannels ?? false);
      setReopenLastOnStartup(settings.reopenLastOnStartup ?? false);
      setSavedLayoutState(settings.savedLayoutState ?? null);
      setStartupView(settings.startupView ?? 'none');
      navHiddenTabsStore(settings.navHiddenTabs ?? []);
      epgHiddenButtonsStore(settings.epgHiddenButtons ?? []);

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
      setShowLoadingScreen(settings.showLoadingScreen ?? false);
      setStremioStreamPickerMode(settings.stremioStreamPickerMode ?? 'modal');
      setShowStremioStreamBadges(settings.showStremioStreamBadges ?? true);
      setBadgeSources(mergeDefaultBadgeSources(settings.badgeSources as BadgeSource[] | undefined));
      const loadedBadgeSize = settings.stremioBadgeSize ?? 100;
      setStremioBadgeSize(loadedBadgeSize);
      document.documentElement.style.setProperty('--stremio-badge-scale', String(loadedBadgeSize / 100));
      if (settings.showFileSizeBadges !== undefined) {
        setShowFileSizeBadges(settings.showFileSizeBadges);
      }
      if (settings.stremioCacheFetchResults !== undefined) {
        setStremioCacheFetchResults(settings.stremioCacheFetchResults as boolean);
      }
      if (settings.stremioCacheFetchTimeout !== undefined) {
        setStremioCacheFetchTimeout(settings.stremioCacheFetchTimeout as number);
      }
      if (settings.streamBadgePlacement !== undefined) {
        setStreamBadgePlacement(settings.streamBadgePlacement as 'top' | 'bottom');
      }
      setShowNuvioStreamBadges(settings.showNuvioStreamBadges ?? true);
      setNuvioBadgeSources(mergeDefaultBadgeSources(settings.nuvioBadgeSources as BadgeSource[] | undefined));
      const loadedNuvioBadgeSize = settings.nuvioBadgeSize ?? 100;
      setNuvioBadgeSize(loadedNuvioBadgeSize);
      document.documentElement.style.setProperty('--nuvio-badge-scale', String(loadedNuvioBadgeSize / 100));
      if (settings.nuvioShowFileSizeBadges !== undefined) {
        setNuvioShowFileSizeBadges(settings.nuvioShowFileSizeBadges);
      }
      if (settings.nuvioStreamBadgePlacement !== undefined) {
        setNuvioStreamBadgePlacement(settings.nuvioStreamBadgePlacement as 'top' | 'bottom');
      }
      if (settings.showNuvioHoverDetails !== undefined) {
        setShowNuvioHoverDetails(settings.showNuvioHoverDetails);
      }
      if (settings.nuvioAutoPlayMode !== undefined) {
        setNuvioAutoPlayMode(settings.nuvioAutoPlayMode as StreamAutoPlayMode);
      }
      if (settings.nuvioAutoPlayTimeout !== undefined) {
        setNuvioAutoPlayTimeout(settings.nuvioAutoPlayTimeout as number);
      }
      if (settings.nuvioAutoPlaySourceScope !== undefined) {
        setNuvioAutoPlaySourceScope(settings.nuvioAutoPlaySourceScope as StreamAutoPlaySourceScope);
      }
      if (settings.nuvioAutoPlayAllowedAddons !== undefined) {
        setNuvioAutoPlayAllowedAddons(settings.nuvioAutoPlayAllowedAddons as string[]);
      }
      if (settings.nuvioAutoPlayAllowedPlugins !== undefined) {
        setNuvioAutoPlayAllowedPlugins(settings.nuvioAutoPlayAllowedPlugins as string[]);
      }
      if (settings.nuvioAutoPlayRegex !== undefined) {
        setNuvioAutoPlayRegex(settings.nuvioAutoPlayRegex as string);
      }
      if (settings.nuvioCacheFetchResults !== undefined) {
        setNuvioCacheFetchResults(settings.nuvioCacheFetchResults as boolean);
      }
      if (settings.nuvioCacheFetchTimeout !== undefined) {
        setNuvioCacheFetchTimeout(settings.nuvioCacheFetchTimeout as number);
      }

      // Load LiveTV settings
      const darkenCurrent = settings.epgDarkenCurrent ?? false;
      setEpgDarkenCurrent(darkenCurrent);
      // Apply CSS class on load
      if (darkenCurrent) {
        document.documentElement.classList.add('epg-darken-current');
      }

      const boldChannels = settings.epgBoldChannelNames ?? false;
      setEpgBoldChannelNames(boldChannels);
      if (boldChannels) {
        document.documentElement.classList.add('epg-bold-channel-names');
      }

      const boldTopCategories = settings.epgBoldTopCategories ?? false;
      setEpgBoldTopCategories(boldTopCategories);
      if (boldTopCategories) {
        document.documentElement.classList.add('epg-bold-top-categories');
      }

      const boldSourceCategories = settings.epgBoldSourceCategories ?? false;
      setEpgBoldSourceCategories(boldSourceCategories);
      if (boldSourceCategories) {
        document.documentElement.classList.add('epg-bold-source-categories');
      }

      // Load EPG view layout setting
      setEpgView(settings.epgView ?? 'traditional');

      // Load EPG visible hours setting
      const rawEpgVisibleHours = settings.epgVisibleHours ?? 'auto';
      const loadedEpgVisibleHours = rawEpgVisibleHours === 'auto' ? 'auto' : Number(rawEpgVisibleHours);
      setEpgVisibleHoursState(loadedEpgVisibleHours);
      setEpgVisibleHours(loadedEpgVisibleHours);

      // Load transparent guide overlay settings
      const loadedGuideHeight = settings.transparentGuideHeight ?? 40;
      setTransparentGuideHeight(loadedGuideHeight);
      document.documentElement.style.setProperty('--transparent-guide-height', `${loadedGuideHeight}%`);
      const loadedHideHeader = settings.transparentGuideHideHeader ?? false;
      setTransparentGuideHideHeader(loadedHideHeader);
      document.documentElement.classList.toggle('transparent-guide-hide-header', loadedHideHeader);
      const loadedOverlayOpacity = settings.transparentGuideOverlayOpacity ?? 55;
      setTransparentGuideOverlayOpacity(loadedOverlayOpacity);
      document.documentElement.style.setProperty('--transparent-guide-overlay-opacity', String(loadedOverlayOpacity / 100));
      const loadedSidebarOpacity = settings.transparentGuideSidebarOpacity ?? 55;
      setTransparentGuideSidebarOpacity(loadedSidebarOpacity);
      document.documentElement.style.setProperty('--transparent-guide-sidebar-opacity', String(loadedSidebarOpacity / 100));


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

  // Search functionality
  useEffect(() => {
    setSearchResults(searchSettings(searchQuery));
  }, [searchQuery]);

  useEffect(() => {
    setPendingSubTab(null);
  }, [activeTab]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults([]);
        setSearchQuery('');
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && searchQuery) {
        setSearchResults([]);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [searchQuery]);

  function handleSearchResultClick(result: SettingsSearchResult) {
    handleTabChange(result.tabId);
    if (result.subTabId) {
      setPendingSubTab(result.subTabId);
    }
    setSearchQuery('');
    setSearchResults([]);
  }

  function groupByTab(results: SettingsSearchResult[]) {
    const map = new Map<string, { tabId: string; tabLabel: string; items: SettingsSearchResult[] }>();
    for (const r of results) {
      if (!map.has(r.tabId)) {
        map.set(r.tabId, { tabId: r.tabId, tabLabel: r.tabLabel, items: [] });
      }
      map.get(r.tabId)!.items.push(r);
    }
    return Array.from(map.values());
  }

  function highlightMatch(text: string, query: string) {
    if (!query.trim()) return text;
    const q = query.toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="settings-search-highlight">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  // Check if any VOD source exists (Xtream or Stalker) for showing tabs
  const hasVodSource = sources.some(s => s.type === 'xtream' || s.type === 'stalker');

  const handleSocks5ProxyEnabledChange = (enabled: boolean) => {
    setSocks5ProxyEnabled(enabled);
  };

  const handleSocks5ProxyServerChange = (server: string) => {
    setSocks5ProxyServer(server);
  };

  const handleSocks5ProxyUsernameChange = (user: string) => {
    setSocks5ProxyUsername(user);
  };

  const handleSocks5ProxyPasswordChange = (pass: string) => {
    setSocks5ProxyPassword(pass);
  };

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

  const handleCastRewriteTsChange = async (enabled: boolean) => {
    setCastRewriteTs(enabled);
    if (onCastRewriteTsChange) {
      onCastRewriteTsChange(enabled);
    }
    if (window.storage) {
      await window.storage.updateSettings({ castRewriteTs: enabled });
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

  const handleShowLoadingScreenChange = async (enabled: boolean) => {
    setShowLoadingScreen(enabled);
    if (window.storage) {
      await window.storage.updateSettings({ showLoadingScreen: enabled });
    }
    window.dispatchEvent(new CustomEvent('ynotv:retry-settings-changed', {
      detail: { showLoadingScreen: enabled }
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
    if (onStremioBadgeSizeChange) {
      onStremioBadgeSizeChange(size);
    }
    if (window.storage) {
      await window.storage.updateSettings({ stremioBadgeSize: size });
    }
  };

  const handleShowHoverDetailsChange = async (show: boolean) => {
    setShowHoverDetails(show);
    document.documentElement.toggleAttribute('data-hover-details-disabled', !show);
    if (onShowHoverDetailsChange) {
      onShowHoverDetailsChange(show);
    }
    if (window.storage) {
      await window.storage.updateSettings({ showHoverDetails: show });
    }
  };

  const handleShowFileSizeBadgesChange = async (show: boolean) => {
    setShowFileSizeBadges(show);
    if (onShowFileSizeBadgesChange) {
      onShowFileSizeBadgesChange(show);
    }
    if (window.storage) {
      await window.storage.updateSettings({ showFileSizeBadges: show });
    }
  };

  const handleStreamBadgePlacementChange = async (placement: 'top' | 'bottom') => {
    setStreamBadgePlacement(placement);
    if (onStreamBadgePlacementChange) {
      onStreamBadgePlacementChange(placement);
    }
    if (window.storage) {
      await window.storage.updateSettings({ streamBadgePlacement: placement });
    }
  };

  const handleStremioCacheFetchResultsChange = async (enabled: boolean) => {
    setStremioCacheFetchResults(enabled);
    if (onStremioCacheFetchResultsChange) {
      onStremioCacheFetchResultsChange(enabled);
    }
    if (window.storage) {
      await window.storage.updateSettings({ stremioCacheFetchResults: enabled });
    }
  };

  const handleStremioCacheFetchTimeoutChange = async (timeout: number) => {
    setStremioCacheFetchTimeout(timeout);
    if (onStremioCacheFetchTimeoutChange) {
      onStremioCacheFetchTimeoutChange(timeout);
    }
    if (window.storage) {
      await window.storage.updateSettings({ stremioCacheFetchTimeout: timeout });
    }
  };

  const handleShowNuvioStreamBadgesChange = async (show: boolean) => {
    setShowNuvioStreamBadges(show);
    if (onShowNuvioStreamBadgesChange) {
      onShowNuvioStreamBadgesChange(show);
    }
    if (window.storage) {
      await window.storage.updateSettings({ showNuvioStreamBadges: show });
    }
  };

  const handleNuvioBadgeSourcesChange = async (sources: BadgeSource[]) => {
    setNuvioBadgeSources(sources);
    if (onNuvioBadgeSourcesChange) {
      onNuvioBadgeSourcesChange(sources);
    }
    if (window.storage) {
      await window.storage.updateSettings({ nuvioBadgeSources: sources });
    }
  };

  const handleNuvioBadgeSizeChange = async (size: number) => {
    setNuvioBadgeSize(size);
    document.documentElement.style.setProperty('--nuvio-badge-scale', String(size / 100));
    if (onNuvioBadgeSizeChange) {
      onNuvioBadgeSizeChange(size);
    }
    if (window.storage) {
      await window.storage.updateSettings({ nuvioBadgeSize: size });
    }
  };

  const handleNuvioShowFileSizeBadgesChange = async (show: boolean) => {
    setNuvioShowFileSizeBadges(show);
    if (onNuvioShowFileSizeBadgesChange) {
      onNuvioShowFileSizeBadgesChange(show);
    }
    if (window.storage) {
      await window.storage.updateSettings({ nuvioShowFileSizeBadges: show });
    }
  };

  const handleNuvioStreamBadgePlacementChange = async (placement: 'top' | 'bottom') => {
    setNuvioStreamBadgePlacement(placement);
    if (onNuvioStreamBadgePlacementChange) {
      onNuvioStreamBadgePlacementChange(placement);
    }
    if (window.storage) {
      await window.storage.updateSettings({ nuvioStreamBadgePlacement: placement });
    }
  };

  const handleShowNuvioHoverDetailsChange = async (show: boolean) => {
    setShowNuvioHoverDetails(show);
    if (onShowNuvioHoverDetailsChange) {
      onShowNuvioHoverDetailsChange(show);
    }
    if (window.storage) {
      await window.storage.updateSettings({ showNuvioHoverDetails: show });
    }
  };

  const handleNuvioAutoPlayModeChange = async (mode: StreamAutoPlayMode) => {
    setNuvioAutoPlayMode(mode);
    if (window.storage) {
      await window.storage.updateSettings({ nuvioAutoPlayMode: mode });
    }
  };

  const handleNuvioAutoPlayTimeoutChange = async (timeout: number) => {
    setNuvioAutoPlayTimeout(timeout);
    if (window.storage) {
      await window.storage.updateSettings({ nuvioAutoPlayTimeout: timeout });
    }
  };

  const handleNuvioAutoPlaySourceScopeChange = async (scope: StreamAutoPlaySourceScope) => {
    setNuvioAutoPlaySourceScope(scope);
    if (window.storage) {
      await window.storage.updateSettings({ nuvioAutoPlaySourceScope: scope });
    }
  };

  const handleNuvioAutoPlayAllowedAddonsChange = async (addonIds: string[]) => {
    setNuvioAutoPlayAllowedAddons(addonIds);
    if (window.storage) {
      await window.storage.updateSettings({ nuvioAutoPlayAllowedAddons: addonIds });
    }
  };

  const handleNuvioAutoPlayAllowedPluginsChange = async (pluginIds: string[]) => {
    setNuvioAutoPlayAllowedPlugins(pluginIds);
    if (window.storage) {
      await window.storage.updateSettings({ nuvioAutoPlayAllowedPlugins: pluginIds });
    }
  };

  const handleNuvioAutoPlayRegexChange = async (regex: string) => {
    setNuvioAutoPlayRegex(regex);
    if (window.storage) {
      await window.storage.updateSettings({ nuvioAutoPlayRegex: regex });
    }
  };

  const handleNuvioCacheFetchResultsChange = async (enabled: boolean) => {
    setNuvioCacheFetchResults(enabled);
    if (onNuvioCacheFetchResultsChange) {
      onNuvioCacheFetchResultsChange(enabled);
    }
    if (window.storage) {
      await window.storage.updateSettings({ nuvioCacheFetchResults: enabled });
    }
  };

  const handleNuvioCacheFetchTimeoutChange = async (timeout: number) => {
    setNuvioCacheFetchTimeout(timeout);
    if (onNuvioCacheFetchTimeoutChange) {
      onNuvioCacheFetchTimeoutChange(timeout);
    }
    if (window.storage) {
      await window.storage.updateSettings({ nuvioCacheFetchTimeout: timeout });
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

  const handleShowAllChannelsChange = async (enabled: boolean) => {
    setShowAllChannels(enabled);
    if (window.storage) {
      await window.storage.updateSettings({ showAllChannels: enabled });
    }
    window.dispatchEvent(new CustomEvent('ynotv:category-settings-changed', {
      detail: { showAllChannels: enabled }
    }));
  };

  const handleShowFavoritesChange = async (enabled: boolean) => {
    setShowFavorites(enabled);
    if (window.storage) {
      await window.storage.updateSettings({ showFavorites: enabled });
    }
    window.dispatchEvent(new CustomEvent('ynotv:category-settings-changed', {
      detail: { showFavorites: enabled }
    }));
  };

  const handleShowWatchlistChange = async (enabled: boolean) => {
    setShowWatchlist(enabled);
    if (window.storage) {
      await window.storage.updateSettings({ showWatchlist: enabled });
    }
    window.dispatchEvent(new CustomEvent('ynotv:category-settings-changed', {
      detail: { showWatchlist: enabled }
    }));
  };

  const handleShowRecentlyViewedChange = async (enabled: boolean) => {
    setShowRecentlyViewed(enabled);
    if (window.storage) {
      await window.storage.updateSettings({ showRecentlyViewed: enabled });
    }
    window.dispatchEvent(new CustomEvent('ynotv:category-settings-changed', {
      detail: { showRecentlyViewed: enabled }
    }));
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

  const handleEpgBoldChannelNamesChange = async (enabled: boolean) => {
    setEpgBoldChannelNames(enabled);
    if (enabled) {
      document.documentElement.classList.add('epg-bold-channel-names');
    } else {
      document.documentElement.classList.remove('epg-bold-channel-names');
    }
    if (window.storage) {
      await window.storage.updateSettings({ epgBoldChannelNames: enabled });
    }
  };

  const handleEpgBoldTopCategoriesChange = async (enabled: boolean) => {
    setEpgBoldTopCategories(enabled);
    if (enabled) {
      document.documentElement.classList.add('epg-bold-top-categories');
    } else {
      document.documentElement.classList.remove('epg-bold-top-categories');
    }
    if (window.storage) {
      await window.storage.updateSettings({ epgBoldTopCategories: enabled });
    }
  };

  const handleEpgBoldSourceCategoriesChange = async (enabled: boolean) => {
    setEpgBoldSourceCategories(enabled);
    if (enabled) {
      document.documentElement.classList.add('epg-bold-source-categories');
    } else {
      document.documentElement.classList.remove('epg-bold-source-categories');
    }
    if (window.storage) {
      await window.storage.updateSettings({ epgBoldSourceCategories: enabled });
    }
  };

  const handleEpgViewChange = async (view: 'traditional' | 'alternate') => {
    setEpgView(view);
    if (window.storage) {
      await window.storage.updateSettings({ epgView: view });
    }
  };

  const handleEpgVisibleHoursChange = async (hours: 'auto' | number) => {
    setEpgVisibleHoursState(hours);
    setEpgVisibleHours(hours);
    if (window.storage) {
      await window.storage.updateSettings({ epgVisibleHours: hours });
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

  const handleTransparentGuideHeightChange = async (height: number) => {
    const clamped = Math.max(25, Math.min(100, height));
    setTransparentGuideHeight(clamped);
    document.documentElement.style.setProperty('--transparent-guide-height', `${clamped}%`);
    if (window.storage) {
      await window.storage.updateSettings({ transparentGuideHeight: clamped });
    }
  };

  const handleTransparentGuideHideHeaderChange = async (hide: boolean) => {
    setTransparentGuideHideHeader(hide);
    document.documentElement.classList.toggle('transparent-guide-hide-header', hide);
    if (window.storage) {
      await window.storage.updateSettings({ transparentGuideHideHeader: hide });
    }
  };

  const handleTransparentGuideOverlayOpacityChange = async (opacity: number) => {
    const clamped = Math.max(0, Math.min(100, opacity));
    setTransparentGuideOverlayOpacity(clamped);
    document.documentElement.style.setProperty('--transparent-guide-overlay-opacity', String(clamped / 100));
    if (window.storage) {
      await window.storage.updateSettings({ transparentGuideOverlayOpacity: clamped });
    }
  };

  const handleTransparentGuideSidebarOpacityChange = async (opacity: number) => {
    const clamped = Math.max(0, Math.min(100, opacity));
    setTransparentGuideSidebarOpacity(clamped);
    document.documentElement.style.setProperty('--transparent-guide-sidebar-opacity', String(clamped / 100));
    if (window.storage) {
      await window.storage.updateSettings({ transparentGuideSidebarOpacity: clamped });
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
    modernUiEnabled?: boolean | string;
    collapseSourceCategoriesOnStartup?: boolean;
    overlayAutohideTimer?: number;
    uiScale?: number;
  }) => {
    const updated = { ...uiSettings, ...newSettings };
    setUiSettings(updated);

    // Apply/remove the modern-ui class when modernUiEnabled changes
    if (newSettings.modernUiEnabled !== undefined) {
      const design = newSettings.modernUiEnabled === 'v3' ? 'v3' : (newSettings.modernUiEnabled === false || newSettings.modernUiEnabled === 'v1' ? 'v1' : 'v2');
      document.documentElement.classList.remove('modern-ui', 'modern-ui-v3');
      if (design === 'v3') {
        document.documentElement.classList.add('modern-ui', 'modern-ui-v3');
      } else if (design === 'v2') {
        document.documentElement.classList.add('modern-ui');
      }
      if (onLiveTvDesignChange) {
        onLiveTvDesignChange(design);
      }
    }

    if (newSettings.uiScale !== undefined) {
      document.documentElement.style.setProperty('--app-zoom', String(newSettings.uiScale / 100));
      // Dispatch a resize event so the EPG grid re-measures availableWidth using
      // the updated zoom factor (getBoundingClientRect results change with zoom).
      window.dispatchEvent(new Event('resize'));
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

  const handleEpgHiddenButtonsChange = async (buttons: string[]) => {
    epgHiddenButtonsStore(buttons);
    if (window.storage) {
      await window.storage.updateSettings({ epgHiddenButtons: buttons });
    }
  };

  const handleStartupViewChange = async (value: 'none' | 'guide' | 'movies' | 'series' | 'dvr' | 'sports' | 'calendar' | 'stremio' | 'nuvio') => {
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

  const handleStreamingCatalogsEnabledChange = async (enabled: boolean) => {
    setStreamingCatalogsEnabled(enabled);
    if (window.storage) {
      await window.storage.updateSettings({ streamingCatalogsEnabled: enabled });
      window.dispatchEvent(new CustomEvent('ynotv:streaming-catalogs-changed'));
    }
  };

  const handleStreamingNuvioCatalogsEnabledChange = async (enabled: boolean) => {
    setStreamingNuvioCatalogsEnabled(enabled);
    if (window.storage) {
      await window.storage.updateSettings({ streamingNuvioCatalogsEnabled: enabled });
      window.dispatchEvent(new CustomEvent('ynotv:streaming-catalogs-changed'));
    }
  };

  const handleEnabledStreamingServicesChange = async (services: string[]) => {
    setEnabledStreamingServices(services);
    if (window.storage) {
      await window.storage.updateSettings({ enabledStreamingServices: services });
      window.dispatchEvent(new CustomEvent('ynotv:streaming-catalogs-changed'));
    }
  };

  function renderTabContent() {
    switch (activeTab) {
      case 'sources':
        return (
          <SourcesTab
            initialSubTab={pendingSubTab as 'source' | 'epg' | 'refresh' | undefined}
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
          />
        );
      case 'subtitles':
        return (
          <SubtitlesTab
            initialSubTab={pendingSubTab as 'subtitles' | 'audio' | undefined}
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
            showHoverDetails={showHoverDetails}
            onShowHoverDetailsChange={handleShowHoverDetailsChange}
            showFileSizeBadges={showFileSizeBadges}
            onShowFileSizeBadgesChange={handleShowFileSizeBadgesChange}
            streamBadgePlacement={streamBadgePlacement}
            onStreamBadgePlacementChange={handleStreamBadgePlacementChange}
            stremioCacheFetchResults={stremioCacheFetchResults}
            onStremioCacheFetchResultsChange={handleStremioCacheFetchResultsChange}
            stremioCacheFetchTimeout={stremioCacheFetchTimeout}
            onStremioCacheFetchTimeoutChange={handleStremioCacheFetchTimeoutChange}
          />
        );
      case 'nuvio':
        return (
          <NuvioTab
            showNuvioStreamBadges={showNuvioStreamBadges}
            onShowNuvioStreamBadgesChange={handleShowNuvioStreamBadgesChange}
            nuvioBadgeSources={nuvioBadgeSources}
            onNuvioBadgeSourcesChange={handleNuvioBadgeSourcesChange}
            nuvioBadgeSize={nuvioBadgeSize}
            onNuvioBadgeSizeChange={handleNuvioBadgeSizeChange}
            nuvioShowFileSizeBadges={nuvioShowFileSizeBadges}
            onNuvioShowFileSizeBadgesChange={handleNuvioShowFileSizeBadgesChange}
            nuvioStreamBadgePlacement={nuvioStreamBadgePlacement}
            onNuvioStreamBadgePlacementChange={handleNuvioStreamBadgePlacementChange}
            showNuvioHoverDetails={showNuvioHoverDetails}
            onShowNuvioHoverDetailsChange={handleShowNuvioHoverDetailsChange}
            nuvioAutoPlayMode={nuvioAutoPlayMode}
            onNuvioAutoPlayModeChange={handleNuvioAutoPlayModeChange}
            nuvioAutoPlayTimeout={nuvioAutoPlayTimeout}
            onNuvioAutoPlayTimeoutChange={handleNuvioAutoPlayTimeoutChange}
            nuvioAutoPlaySourceScope={nuvioAutoPlaySourceScope}
            onNuvioAutoPlaySourceScopeChange={handleNuvioAutoPlaySourceScopeChange}
            nuvioAutoPlayAllowedAddons={nuvioAutoPlayAllowedAddons}
            onNuvioAutoPlayAllowedAddonsChange={handleNuvioAutoPlayAllowedAddonsChange}
            nuvioAutoPlayAllowedPlugins={nuvioAutoPlayAllowedPlugins}
            onNuvioAutoPlayAllowedPluginsChange={handleNuvioAutoPlayAllowedPluginsChange}
            nuvioAutoPlayRegex={nuvioAutoPlayRegex}
            onNuvioAutoPlayRegexChange={handleNuvioAutoPlayRegexChange}
            nuvioCacheFetchResults={nuvioCacheFetchResults}
            onNuvioCacheFetchResultsChange={handleNuvioCacheFetchResultsChange}
            nuvioCacheFetchTimeout={nuvioCacheFetchTimeout}
            onNuvioCacheFetchTimeoutChange={handleNuvioCacheFetchTimeoutChange}
          />
        );
      case 'security':
        return (
          <SecurityTab
            allowLanSources={allowLanSources}
            onAllowLanSourcesChange={setAllowLanSources}
          />
        );
      case 'proxy':
        return (
          <ProxyTab
            socks5ProxyEnabled={socks5ProxyEnabled}
            onSocks5ProxyEnabledChange={handleSocks5ProxyEnabledChange}
            socks5ProxyServer={socks5ProxyServer}
            onSocks5ProxyServerChange={handleSocks5ProxyServerChange}
            socks5ProxyUsername={socks5ProxyUsername}
            onSocks5ProxyUsernameChange={handleSocks5ProxyUsernameChange}
            socks5ProxyPassword={socks5ProxyPassword}
            onSocks5ProxyPasswordChange={handleSocks5ProxyPasswordChange}
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
            epgHiddenButtons={epgHiddenButtons}
            onEpgHiddenButtonsChange={handleEpgHiddenButtonsChange}
            showAllChannels={showAllChannels}
            onShowAllChannelsChange={handleShowAllChannelsChange}
            showFavorites={showFavorites}
            onShowFavoritesChange={handleShowFavoritesChange}
            showWatchlist={showWatchlist}
            onShowWatchlistChange={handleShowWatchlistChange}
            showRecentlyViewed={showRecentlyViewed}
            onShowRecentlyViewedChange={handleShowRecentlyViewedChange}
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
            initialSubTab={(pendingSubTabFromParent || pendingSubTab) as 'mpv' | 'reconnect' | 'cast' | 'popout' | 'skipintro' | undefined}
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
            castRewriteTs={castRewriteTs}
            onCastRewriteTsChange={handleCastRewriteTsChange}
            useEventBasedReconnect={useEventBasedReconnect}
            onUseEventBasedReconnectChange={handleUseEventBasedReconnectChange}
            stallDetectionEnabled={stallDetectionEnabled}
            onStallDetectionEnabledChange={handleStallDetectionEnabledChange}
            showLoadingScreen={showLoadingScreen}
            onShowLoadingScreenChange={handleShowLoadingScreenChange}
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
      case 'metadata':
        return (
          <TmdbTab
            initialSubTab={pendingSubTab as 'tmdb' | 'rpdb' | undefined}
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
            streamingCatalogsEnabled={streamingCatalogsEnabled}
            onStreamingCatalogsEnabledChange={handleStreamingCatalogsEnabledChange}
            streamingNuvioCatalogsEnabled={streamingNuvioCatalogsEnabled}
            onStreamingNuvioCatalogsEnabledChange={handleStreamingNuvioCatalogsEnabledChange}
            enabledStreamingServices={enabledStreamingServices}
            onEnabledStreamingServicesChange={handleEnabledStreamingServicesChange}
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
            initialSubTab={pendingSubTab as 'epg' | 'font-size' | 'sort-order' | 'search' | 'live-view' | 'widgets' | undefined}
            epgDarkenCurrent={epgDarkenCurrent}
            onEpgDarkenCurrentChange={handleEpgDarkenCurrentChange}
            epgVisibleHours={epgVisibleHours}
            onEpgVisibleHoursChange={handleEpgVisibleHoursChange}
            epgBoldChannelNames={epgBoldChannelNames}
            onEpgBoldChannelNamesChange={handleEpgBoldChannelNamesChange}
            epgBoldTopCategories={epgBoldTopCategories}
            onEpgBoldTopCategoriesChange={handleEpgBoldTopCategoriesChange}
            epgBoldSourceCategories={epgBoldSourceCategories}
            onEpgBoldSourceCategoriesChange={handleEpgBoldSourceCategoriesChange}
            epgView={epgView}
            onEpgViewChange={handleEpgViewChange}
            epgTitleFontSize={epgTitleFontSize}
            onEpgTitleFontSizeChange={handleEpgTitleFontSizeChange}
            epgBodyFontSize={epgBodyFontSize}
            onEpgBodyFontSizeChange={handleEpgBodyFontSizeChange}
            transparentGuideHeight={transparentGuideHeight}
            onTransparentGuideHeightChange={handleTransparentGuideHeightChange}
            transparentGuideHideHeader={transparentGuideHideHeader}
            onTransparentGuideHideHeaderChange={handleTransparentGuideHideHeaderChange}
            transparentGuideOnZap={transparentGuideOnZapProp ?? false}
            onTransparentGuideOnZapChange={onTransparentGuideOnZapChange || (() => {})}
            transparentGuideOverlayOpacity={transparentGuideOverlayOpacity}
            onTransparentGuideOverlayOpacityChange={handleTransparentGuideOverlayOpacityChange}
            transparentGuideSidebarOpacity={transparentGuideSidebarOpacity}
            onTransparentGuideSidebarOpacityChange={handleTransparentGuideSidebarOpacityChange}
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
    <div className={`settings-overlay${isFullScreen ? ' settings-overlay--fullscreen' : ''}`}>
      <div className={`settings-panel settings-panel--sidebar${isFullScreen ? ' settings-panel--fullscreen' : ''}`}>
        <div className="settings-header">
          <h2>Settings</h2>
          <div className="settings-search" ref={searchRef}>
            <div className="settings-search-input-wrapper">
            <svg className="settings-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="settings-search-input"
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="settings-search-clear" onClick={() => { setSearchQuery(''); setSearchResults([]); }}>
                ✕
              </button>
            )}
          </div>
          {searchResults.length > 0 && (
            <div className="settings-search-results">
              {groupByTab(searchResults).map((group) => (
                <div key={group.tabId} className="settings-search-group">
                  <div className="settings-search-group-label">{group.tabLabel}</div>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      className="settings-search-item"
                      onClick={() => handleSearchResultClick(item)}
                    >
                      <div className="settings-search-item-label">{highlightMatch(item.label, searchQuery)}</div>
                      {item.section && (
                        <div className="settings-search-item-section">{item.section}</div>
                      )}
                      {item.description && (
                        <div className="settings-search-item-desc">{item.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          </div>
          <div className="settings-header-actions">
            <button
              className="settings-fullscreen-btn"
              type="button"
              onClick={toggleFullScreen}
              title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullScreen ? (
                <svg className="settings-fullscreen-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="10" y1="14" x2="3" y2="21" />
                </svg>
              ) : (
                <svg className="settings-fullscreen-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>
            <button className="close-btn" onClick={handleClose}>✕</button>
          </div>
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
            onTabChange={handleTabChange}
            hasVodSource={hasVodSource}
          />

          {/* Tab Content */}
          <div className="settings-content">
            {renderTabContent()}
          </div>
        </div>
      </div>
      <ModalComponent />
    </div>
  );
}

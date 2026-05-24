import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// Auto-sync check interval: 10 minutes
const AUTO_SYNC_CHECK_INTERVAL_MS = 10 * 60 * 1000;
let hasStartupAutoSyncTriggered = false;
import { invoke } from '@tauri-apps/api/core';
import type { StremioStreamPickerMode, StremioMeta } from './types/stremio';
import './services/tauri-bridge'; // Initialize Tauri bridge and polyfills
import { checkForUpdates, checkForUpdatesSilent } from './services/updater';
import { Settings } from './components/Settings';
import type { SettingsTabId } from './components/settings/SettingsSidebar';

import { NowPlayingBar } from './components/NowPlayingBar';
import { ChannelInfoOverlay } from './components/ChannelInfoOverlay';
import { FailoverGroupOverlay } from './components/FailoverGroupOverlay';
import { TrackSelectionModal } from './components/TrackSelectionModal';
import { SubtitleControlModal } from './components/SubtitleControlModal';
import { CategoryStrip } from './components/CategoryStrip';
import { ChannelPanel } from './components/ChannelPanel';
import { MoviesPage } from './components/MoviesPage';
import { SeriesPage } from './components/SeriesPage';
import { DvrDashboard } from './components/DvrDashboard';
import { SportsHub } from './components/sports/SportsHub';
import { TVCalendarPage } from './components/TVCalendarPage';
import { LiveSportsOverlay } from './components/LiveSportsOverlay';
import { RecentChannelsWidget } from './components/RecentChannelsWidget';
import { FavoritesWidget } from './components/FavoritesWidget';
import { WidgetBar } from './components/WidgetBar';
import { BackgroundContextMenu } from './components/BackgroundContextMenu';
import { CustomGroupWidget } from './components/CustomGroupWidget';
import { WhatsNextWidget } from './components/WhatsNextWidget';
import { GroupPickerModal } from './components/GroupPickerModal';
import { useActiveRecordings } from './hooks/useActiveRecordings';
import { RecordingIndicator } from './components/RecordingIndicator';
import { Logo } from './components/Logo';
import { useSelectedCategory, useChannelSearch, useProgramSearch, useChannels } from './hooks/useChannels';
import { clearLiveQueryCache } from './hooks/useSqliteLiveQuery';
import {
  useChannelSyncing,
  useVodSyncing,
  useTmdbMatching,
  useSyncStatusMessage,
  useChannelSortOrder,
  useCategorySortOrder,
  useSetChannelSyncing,
  useSetVodSyncing,
  useSetSyncStatusMessage,
  useSetChannelSortOrder,
  useSetChannelSortOrderMigrated,
  useChannelSortOrderMigrated,
  useSetCategorySortOrder,
  useEpgView,
  useSetEpgView
} from './stores/uiStore';
import { getAdjacentEpisode, recordVodWatch, recordEpisodeWatch, getEpisodeProgress } from './db';
import type { StoredChannel } from './db';
import { db } from './db';
import { VideoErrorOverlay } from './components/VideoErrorOverlay';
import { StreamRetryOverlay } from './components/StreamRetryOverlay';
import { FailoverOverlay } from './components/FailoverOverlay';
import { CastButton } from './components/CastButton';
import { CastOverlay } from './components/CastOverlay';
import { syncSource, syncVodForSource, isEpgStale, isVodStale, syncAllStaleGlobalEpgLinks } from './db/sync';
import { bulkOps } from './services/bulk-ops';
import { Bridge, type AspectRatioMode, applyAspectRatio, rewriteTsToM3u8 } from './services/tauri-bridge';
import { resolvePlayUrl } from './services/stream-resolver';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { addToRecentChannels } from './utils/recentChannels';
import { WatchlistNotificationContainer } from './components/WatchlistNotification';
import { MultiviewLayout } from './components/MultiviewLayout/MultiviewLayout';
import { LayoutPicker } from './components/LayoutPicker/LayoutPicker';
import './themes.css';
import './components/ModernTheme.css'; // Modern UI enhancements
import { useTimeshift } from './hooks/useTimeshift';
import { useDvrEvents } from './hooks/useDvrEvents';
import { useDvrUrlResolver } from './hooks/useDvrUrlResolver';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { UpdateModal } from './components/UpdateModal';
import { registerUpdateModal } from './services/updater';
import { useLayoutPersistence, type LayoutMode } from './hooks/useLayoutPersistence';
import { useMpvListeners } from './hooks/useMpvListeners';
import { AdvancedSearchModal, type AdvancedSearchConfig } from './components/AdvancedSearchModal';
import { StremioPage } from './components/stremio/StremioPage';
import { useStremioAddonStore } from './stores/stremioAddonStore';
import { useStremioWatchStore } from './stores/stremioWatchStore';
import { useUIStore } from './stores/uiStore';
import { fetchSubtitles } from './services/stremio-addon';
import { scrobbler } from './services/scrobbler';
import { SkipIntroButton } from './components/SkipIntroButton';
import { useSkipIntro } from './hooks/useSkipIntro';

// NEW: Extracted hooks
import { useAppSettings } from './hooks/useAppSettings';
import { usePlayback } from './hooks/usePlayback';
import { useNavigation } from './hooks/useNavigation';
import { useWatchlist } from './hooks/useWatchlist';
import { useWindowManager } from './hooks/useWindowManager';
import { usePopoutPlayer } from './hooks/usePopoutPlayer';

// ============================================================================
// App Component
// ============================================================================

function App() {
  // ==========================================================================
  // Settings & Configuration (from useAppSettings)
  // ==========================================================================
  const {
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
    advancedSearchScope,
    advancedSearchSourceIds,
    advancedSearchCategoryIds,
    useAdvancedSearchForRegular,
    channelInfoOverlayEnabled,
    channelInfoOverlayFontSize,
    channelInfoOverlayLogoSize,
    channelInfoOverlayBoxWidth,
    channelInfoOverlayOpacity,
    theme,
    shortcuts,
    categoriesHidden,
    setTheme,
    setShortcuts,
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
    channelInfoOverlayHideDescription,
    setChannelInfoOverlayHideDescription,
    overlayAutohideTimer,
    setOverlayAutohideTimer,
    popoutStopMain,
    popoutAlwaysOnTop,
    navHiddenTabs: settingsNavHiddenTabs,
    startupView,
    castEnabled,
    setCastEnabled,
  } = useAppSettings();
  const navHiddenTabs = useUIStore((s) => s.navHiddenTabs);
  const setNavHiddenStore = useUIStore((s) => s.setNavHiddenTabs);

  // Stremio stream picker mode
  const [stremioStreamPickerMode, setStremioStreamPickerMode] = useState<StremioStreamPickerMode>('modal');
  const handleStremioStreamPickerModeChange = useCallback(async (mode: StremioStreamPickerMode) => {
    setStremioStreamPickerMode(mode);
    if (window.storage) {
      await window.storage.updateSettings({ stremioStreamPickerMode: mode });
    }
  }, []);

  // Load stremioStreamPickerMode from storage
  useEffect(() => {
    if (!layoutSettingsLoaded) return;
    const loadStremioMode = async () => {
      try {
        const res = await window.storage.getSettings();
        if (res.data?.stremioStreamPickerMode) {
          setStremioStreamPickerMode(res.data.stremioStreamPickerMode as StremioStreamPickerMode);
        }
      } catch {}
    };
    loadStremioMode();
  }, [layoutSettingsLoaded]);

  // ==========================================================================
  // Clear Live Query Cache on App Start
  // ==========================================================================
  useEffect(() => {
    // Clear any stale cached data from previous sessions
    clearLiveQueryCache();
    console.log('[App] Live query cache cleared on startup');
  }, []);

  // Apply channel info overlay CSS variables on mount
  useEffect(() => {
    document.documentElement.style.setProperty('--cio-font-size', `${channelInfoOverlayFontSize}px`);
    document.documentElement.style.setProperty('--cio-logo-size', `${channelInfoOverlayLogoSize}px`);
    document.documentElement.style.setProperty('--cio-box-width', `${channelInfoOverlayBoxWidth}px`);
    document.documentElement.style.setProperty('--cio-bg-opacity', `${channelInfoOverlayOpacity / 100}`);
  }, [channelInfoOverlayFontSize, channelInfoOverlayLogoSize, channelInfoOverlayBoxWidth, channelInfoOverlayOpacity]);

  // ==========================================================================
  // MPV Listeners (must be before useLayoutPersistence for mpvReady)
  // ==========================================================================
  const mpv = useMpvListeners({
    timeshiftEnabled,
    timeshiftCacheBytes,
    settingsLoaded: layoutSettingsLoaded,
  });

  const {
    mpvReady,
    playing,
    volume,
    muted,
    position,
    duration,
    error,
    volumeDraggingRef,
    seekingRef,
    setError,
    setPlaying,
    setPosition,
    setVolume,
    setDuration,
  } = mpv;

  // ==========================================================================
  // Multiview / Layout Persistence (needs mpvReady from useMpvListeners)
  // ==========================================================================
  const multiview = useLayoutPersistence({
    enabled: rememberLastChannels,
    reopenLastOnStartup,
    initialSavedState: savedLayoutState,
    settingsLoaded: layoutSettingsLoaded,
    mpvReady: mpvReady,
    onLoadMainChannel: (channelName, channelUrl, sourceName) => {
      // Update currentChannel when swap or restore happens - need to find the channel in db
      // This is async so we can't block, but we should update the UI
      if (channelUrl) {
        db.channels.where('direct_url').equals(channelUrl).first().then(channel => {
          if (channel) {
            setCurrentChannel(channel);
            // Also load the stream in MPV (for restore and swap scenarios)
            // Use the ref to avoid stale closure issues
            handlePlayChannelRef.current?.(channel, true); // true = autoSwitched (don't add to recent)
          } else {
            // Channel not found in db, create a minimal channel object
            const minimalChannel: StoredChannel = {
              stream_id: `swap_${Date.now()}`,
              name: channelName || 'Unknown',
              stream_icon: '',
              epg_channel_id: '',
              category_ids: [],
              direct_url: channelUrl,
              source_id: sourceName || 'unknown',
            };
            setCurrentChannel(minimalChannel);
            handlePlayChannelRef.current?.(minimalChannel, true);
          }
        });
      }
    },
  });

  const {
    layout: multiviewLayout,
    slots: multiviewSlots,
    switchLayout,
    sendToSlot,
    swapWithMain,
    stopSlot,
    setSlotProperty,
    repositionSecondarySlots,
    enterTabMode,
    exitTabMode,
    notifyMainLoaded,
    syncMpvGeometry,
    isRestoring,
    engineMode: multiviewEngineMode,
    setEngineMode: setMultiviewEngineMode,
  } = multiview;

  // Refs for multiview (used by keyboard shortcuts)
  const multiviewLayoutRef = useRef<LayoutMode>('main');
  const switchLayoutRef = useRef(switchLayout);
  const handlePlayChannelRef = useRef<((channel: StoredChannel, autoSwitched?: boolean) => void) | null>(null);
  const lastPlayedChannelRef = useRef<StoredChannel | null>(null);
  useEffect(() => { multiviewLayoutRef.current = multiviewLayout; }, [multiviewLayout]);
  useEffect(() => { switchLayoutRef.current = switchLayout; }, [switchLayout]);

  // ==========================================================================
  // Playback (needs callbacks from useLayoutPersistence)
  // ==========================================================================
  const playback = usePlayback({
    rememberLastChannels,
    reopenLastOnStartup,
    savedLayoutState,
    mpvReadyState: mpvReady,
    syncMpvGeometry,
    notifyMainLoaded,
    mpvListeners: mpv, // Pass shared MPV listeners to avoid duplicate state
  });

  const {
    currentChannel,
    vodInfo,
    catchupInfo,
    isCatchup,
    retryState,
    failoverState,
    setCurrentChannel,
    handlePlayChannel,
    handlePlayCatchup,
    handleCatchupSeek,
    handlePlayVod,
    handlePlayRecording,
    handleStop,
    handleSeek,
    handleTogglePlay,
    handleVolumeChange,
    handleToggleMute,
    handleCycleSubtitle,
    handleCycleAudio,
    handleToggleStats,
    handleToggleFullscreen,
    autoSelectSubtitle,
  } = playback;

  // Keep handlePlayChannel ref updated for onLoadMainChannel callback
  useEffect(() => {
    handlePlayChannelRef.current = handlePlayChannel;
  }, [handlePlayChannel]);

  // Track last played channel for replay shortcut
  useEffect(() => {
    if (currentChannel) {
      lastPlayedChannelRef.current = currentChannel;
    }
  }, [currentChannel]);

  // ==========================================================================
  // Popout Player
  // ==========================================================================
  const popout = usePopoutPlayer();
  const {
    isOpen: popoutIsOpen,
    swapChannel: popoutSwapChannel,
    swapVod: popoutSwapVod,
    closePopout,
    togglePause: popoutTogglePause,
    stopPlayback: popoutStopPlayback,
    toggleFullscreen: popoutToggleFullscreen,
    setPopoutVolume,
    setPopoutMuted,
    seekPopout,
  } = popout;

  // Popout mode state: 'off' | 'popout' | 'external'
  const [popoutMode, setPopoutMode] = useState<'off' | 'popout' | 'external'>('off');
  const cyclePopoutMode = useCallback(() => {
    setPopoutMode(prev => {
      if (prev === 'off') return 'popout';
      if (prev === 'popout') return 'external';
      return 'off';
    });
  }, []);

  // ==========================================================================
  // Google Cast (Chromecast) Integration
  // ==========================================================================
  const [isCasting, setIsCasting] = useState(false);
  const [castDeviceName, setCastDeviceName] = useState('');
  const [castMetadataState, setCastMetadataState] = useState({ title: '', subtitle: '' });

  const castCurrentMedia = useCallback(async () => {
    if (!currentChannel) return;
    const isRecording = currentChannel.stream_id?.startsWith('recording_');
    const isLocalFile = currentChannel.direct_url?.startsWith('file://') || (!currentChannel.direct_url?.startsWith('http://') && !currentChannel.direct_url?.startsWith('https://'));
    
    if (isRecording || isLocalFile) {
      alert('Local files and DVR recordings cannot be cast to Chromecast. Only remote streams are supported.');
      return;
    }

    let url = currentChannel.direct_url || '';
    url = rewriteTsToM3u8(url);

    const title = currentChannel.stream_id === 'vod' && vodInfo ? vodInfo.title : currentChannel.name;
    const subtitle = currentChannel.stream_id === 'vod' && vodInfo ? 'VOD' : 'Live TV';

    try {
      console.log('[Cast] Casting URL:', url, 'Title:', title);
      const isHls = url.toLowerCase().includes('.m3u8') || url.toLowerCase().includes('/m3u8') || url.toLowerCase().includes('/hls');
      const mimeType = isHls ? 'application/x-mpegURL' : 'video/mp4';

      await invoke('cast_load_media', { url, title, subtitle, mimeType });
      Bridge.stop().catch(() => {}); // Stop local video to release network connection
    } catch (e: any) {
      alert('Failed to cast media: ' + (e?.message || e));
    }
  }, [currentChannel, vodInfo]);

  // Dynamically start/stop discovery based on setting
  useEffect(() => {
    if (castEnabled) {
      invoke('cast_start_discovery').catch((e) => {
        console.error('[Cast] Failed to start discovery:', e);
      });
    } else {
      invoke('cast_stop_discovery').catch((e) => {
        console.error('[Cast] Failed to stop discovery:', e);
      });
      if (Bridge.getIsCasting?.()) {
        Bridge.setIsCasting(false);
        setIsCasting(false);
        invoke('cast_disconnect').catch((e) => {
          console.error('[Cast] Failed to disconnect on disable:', e);
        });
      }
    }
    return () => {
      invoke('cast_stop_discovery').catch(() => {});
    };
  }, [castEnabled]);

  // Listen for cast status changes
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<any>('cast-status', (event) => {
        const status = event.payload;
        console.log('[Cast] Status event:', status);
        
        const previouslyCasting = Bridge.getIsCasting ? Bridge.getIsCasting() : false;
        
        setIsCasting(status.connected);
        setCastDeviceName(status.deviceName);
        if (Bridge.setIsCasting) {
          Bridge.setIsCasting(status.connected);
        }

        if (status.connected && !previouslyCasting) {
          console.log('[Cast] Casting started, loading media on Chromecast');
          if (playing && currentChannel) {
            castCurrentMedia();
            Bridge.stop().catch(() => {}); // Stop local video to release network connection
          }
        }
        
        // Update local metadata states
        if (Bridge.getCastMetadata) {
          setCastMetadataState(Bridge.getCastMetadata());
        }
      }).then((unsub) => {
        unlisten = unsub;
      });
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [playing, currentChannel, castCurrentMedia]);

  const handleDisconnectCast = useCallback(async () => {
    try {
      await invoke('cast_disconnect');
    } catch (e) {
      console.error('[Cast] Failed to disconnect:', e);
    }
  }, []);

  // ==========================================================================
  // Navigation State (from useNavigation)
  // ==========================================================================
  const {
    categoryId,
    setCategoryId,
    loading: categoryLoading
  } = useSelectedCategory();

  const nav = useNavigation({
    playing,
    multiviewLayout,
    multiviewExitTabMode: exitTabMode,
    setCategoryId,
    overlayAutohideTimer,
  });

  const {
    activeView,
    settingsTab,
    editSourceId,
    showSettingsPopup,
    categoriesOpen,
    searchQuery,
    debouncedSearchQuery,
    isSearchMode,
    isWatchlistMode,
    showControls,
    controlsHoveredRef,
    titleBarSearchRef,
    activeViewRef,
    categoriesOpenRef,
    setActiveView,
    setSettingsTab,
    setEditSourceId,
    setShowSettingsPopup,
    setCategoriesOpen,
    setSearchQuery,
    setIsWatchlistMode,
    setShowControls,
    handleSelectCategory,
    handleMouseMove,
  } = nav;

  // ==========================================================================
  // Aspect Ratio — tracked separately for the hero screen
  // ==========================================================================
  const [heroAspectRatio, setHeroAspectRatio] = useState<AspectRatioMode>('fit');

  const handleSetAspectRatio = useCallback(async (mode: AspectRatioMode) => {
    setHeroAspectRatio(mode);
    if (mpvReady && activeView === 'none') {
      await applyAspectRatio(mode).catch(() => {});
    }
  }, [mpvReady, activeView]);

  // Re-apply aspect ratio when a new video is loaded while on hero screen
  useEffect(() => {
    if (mpvReady && currentChannel && activeView === 'none') {
      applyAspectRatio(heroAspectRatio).catch(() => {});
    }
  }, [currentChannel, mpvReady, heroAspectRatio, activeView]);

  // Switch to fit when leaving hero screen, restore hero ratio when returning
  useEffect(() => {
    if (!mpvReady) return;
    if (activeView === 'none') {
      applyAspectRatio(heroAspectRatio).catch(() => {});
    } else {
      applyAspectRatio('fit').catch(() => {});
    }
  }, [activeView, mpvReady, heroAspectRatio]);

  // ==========================================================================
  // Apply Startup View
  // ==========================================================================
  const startupAppliedRef = useRef(false);

  useEffect(() => {
    if (!layoutSettingsLoaded || startupAppliedRef.current) return;
    startupAppliedRef.current = true;

    if (startupView && startupView !== 'none') {
      setActiveView(startupView);
      if (startupView === 'guide') {
        setCategoriesOpen(!categoriesHidden);
      }
    }
  }, [layoutSettingsLoaded, startupView, setActiveView, setCategoriesOpen, categoriesHidden]);

  // Initialize navHiddenTabs in the shared store once settings are loaded
  const navStoreInitRef = useRef(false);
  useEffect(() => {
    if (!layoutSettingsLoaded || navStoreInitRef.current) return;
    navStoreInitRef.current = true;
    setNavHiddenStore(settingsNavHiddenTabs);
  }, [layoutSettingsLoaded, settingsNavHiddenTabs, setNavHiddenStore]);

  // ==========================================================================
  // Initialize Stremio addons
  // ==========================================================================
  const initializeStremioAddons = useStremioAddonStore((s) => s.initializeDefaults);

  useEffect(() => {
    if (layoutSettingsLoaded) {
      initializeStremioAddons();
    }
  }, [layoutSettingsLoaded, initializeStremioAddons]);

  // ==========================================================================
  // Channel Info Overlay
  // ==========================================================================
  // The overlay follows the titlebar/nowplaying bar visibility (showControls).
  // Exception: it flashes briefly on keyboard channel up/down outside guide/sports.
  const [channelChangeFlash, setChannelChangeFlash] = useState(false);
  const channelChangeFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerChannelChangeFlash = useCallback(() => {
    if (!channelInfoOverlayEnabled) return;
    setChannelChangeFlash(true);
    if (channelChangeFlashTimerRef.current) {
      clearTimeout(channelChangeFlashTimerRef.current);
    }
    channelChangeFlashTimerRef.current = setTimeout(() => {
      setChannelChangeFlash(false);
    }, 4000);
  }, [channelInfoOverlayEnabled]);

  const isChannelInfoOverlayVisible = useMemo(() => {
    if (!channelInfoOverlayEnabled || !currentChannel) return false;
    const isVod = currentChannel.stream_id === 'vod' || currentChannel.stream_id?.startsWith('recording_');
    if (isVod) return false;
    // Don't show when in LiveTV guide or Sports views
    if (activeView === 'guide' || activeView === 'sports') return false;
    return showControls || channelChangeFlash;
  }, [channelInfoOverlayEnabled, currentChannel, showControls, channelChangeFlash, activeView]);

  // Failover group overlay visibility: same conditions as NowPlayingBar
  const isFailoverGroupOverlayVisible = useMemo(() => {
    if (!currentChannel) return false;
    const isVod = currentChannel.stream_id === 'vod' || currentChannel.stream_id?.startsWith('recording_');
    if (isVod) return false;
    // Don't show when in LiveTV guide or Sports views
    if (activeView === 'guide' || activeView === 'sports') return false;
    return showControls;
  }, [currentChannel, showControls, activeView]);

  // ==========================================================================
  // Watchlist State (from useWatchlist)
  // ==========================================================================
  const {
    watchlistItems,
    watchlistRefreshTrigger,
    watchlistNotifications,
    setWatchlistNotifications,
    refreshWatchlist,
    handleWatchlistSwitch,
    handleWatchlistDismiss,
  } = useWatchlist({
    onAutoswitch: (channel) => {
      addToRecentChannels(channel);
      handlePlayChannel(channel, true); // true = autoSwitched
    },
  });

  // ==========================================================================
  // Window Manager (from useWindowManager)
  // ==========================================================================
  const { handleMinimize, handleMaximize, handleClose } = useWindowManager();

  // ==========================================================================
  // Update Modal State
  // ==========================================================================
  const [updateModalOpen, setUpdateModalOpen] = useState(false);

  useEffect(() => {
    registerUpdateModal(setUpdateModalOpen);
  }, []);

  // ==========================================================================
  // Sports Preview State
  // ==========================================================================
  const [sportsPreviewEnabled, setSportsPreviewEnabled] = useState(true);

  // ==========================================================================
  // Live Sports Overlay Widget State
  // ==========================================================================
  const [sportsOverlayWidget, setSportsOverlayWidget] = useState<'autohide' | 'persistent' | null>(() => {
    const saved = localStorage.getItem('sportsOverlayWidget');
    return saved === 'autohide' || saved === 'persistent' ? saved : null;
  });

  // ==========================================================================
  // Recent Channels Overlay Widget State
  // ==========================================================================
  const [recentOverlayWidget, setRecentOverlayWidget] = useState<'5' | '10' | null>(() => {
    const saved = localStorage.getItem('recentOverlayWidget');
    if (saved === 'true') return '5';
    return (saved === '5' || saved === '10') ? saved : null;
  });

  const [bgContextMenu, setBgContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleAddSportsOverlay = useCallback((mode: 'autohide' | 'persistent') => {
    setSportsOverlayWidget(mode);
    localStorage.setItem('sportsOverlayWidget', mode);
  }, []);

  const handleRemoveSportsOverlay = useCallback(() => {
    setSportsOverlayWidget(null);
    localStorage.removeItem('sportsOverlayWidget');
  }, []);

  const handleAddRecent5Overlay = useCallback(() => {
    setRecentOverlayWidget('5');
    localStorage.setItem('recentOverlayWidget', '5');
  }, []);

  const handleAddRecent10Overlay = useCallback(() => {
    setRecentOverlayWidget('10');
    localStorage.setItem('recentOverlayWidget', '10');
  }, []);

  const handleRemoveRecentOverlay = useCallback(() => {
    setRecentOverlayWidget(null);
    localStorage.removeItem('recentOverlayWidget');
  }, []);

  // ==========================================================================
  // Favorites Overlay Widget State
  // ==========================================================================
  const [favoritesOverlayWidget, setFavoritesOverlayWidget] = useState<boolean>(() => {
    const saved = localStorage.getItem('favoritesOverlayWidget');
    return saved === 'true';
  });

  const handleAddFavoritesOverlay = useCallback(() => {
    setFavoritesOverlayWidget(true);
    localStorage.setItem('favoritesOverlayWidget', 'true');
  }, []);

  const handleRemoveFavoritesOverlay = useCallback(() => {
    setFavoritesOverlayWidget(false);
    localStorage.removeItem('favoritesOverlayWidget');
  }, []);

  // ==========================================================================
  // What's Next Overlay Widget State
  // ==========================================================================
  const [whatsNextOverlayWidget, setWhatsNextOverlayWidget] = useState<boolean>(() => {
    const saved = localStorage.getItem('whatsNextOverlayWidget');
    return saved === 'true';
  });

  const handleAddWhatsNextOverlay = useCallback(() => {
    setWhatsNextOverlayWidget(true);
    localStorage.setItem('whatsNextOverlayWidget', 'true');
  }, []);

  const handleRemoveWhatsNextOverlay = useCallback(() => {
    setWhatsNextOverlayWidget(false);
    localStorage.removeItem('whatsNextOverlayWidget');
  }, []);

  // ==========================================================================
  // Custom Group Overlay Widgets State
  // Stored as a JSON array of group_id strings in localStorage.
  // Multiple groups can be active simultaneously — each renders its own widget.
  // ==========================================================================
  const [customGroupWidgetIds, setCustomGroupWidgetIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('customGroupWidgetIds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

  const handleAddCustomGroupWidget = useCallback((group: { group_id: string; name: string }) => {
    setCustomGroupWidgetIds((prev) => {
      if (prev.includes(group.group_id)) return prev;
      const next = [...prev, group.group_id];
      localStorage.setItem('customGroupWidgetIds', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleRemoveCustomGroupWidget = useCallback((groupId: string) => {
    setCustomGroupWidgetIds((prev) => {
      const next = prev.filter((id) => id !== groupId);
      if (next.length === 0) {
        localStorage.removeItem('customGroupWidgetIds');
      } else {
        localStorage.setItem('customGroupWidgetIds', JSON.stringify(next));
      }
      return next;
    });
  }, []);

  // ==========================================================================
  // Widget Sorting State
  // ==========================================================================
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('widgetOrder');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleMoveWidget = useCallback((widgetId: string, direction: -1 | 1) => {
    setWidgetOrder((prev) => {
      const activeWidgets: string[] = [];
      if (recentOverlayWidget) activeWidgets.push('recent');
      if (favoritesOverlayWidget) activeWidgets.push('favorites');
      if (whatsNextOverlayWidget) activeWidgets.push('whats-next');
      customGroupWidgetIds.forEach((id) => activeWidgets.push(`custom-${id}`));

      const sortedActive = [...activeWidgets].sort((a, b) => {
        let idxA = prev.indexOf(a);
        let idxB = prev.indexOf(b);
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
      });

      const currentIndex = sortedActive.indexOf(widgetId);
      if (currentIndex === -1) return prev;

      const newIndex = currentIndex + direction;
      if (newIndex < 0 || newIndex >= sortedActive.length) return prev;

      const temp = sortedActive[currentIndex];
      sortedActive[currentIndex] = sortedActive[newIndex];
      sortedActive[newIndex] = temp;

      localStorage.setItem('widgetOrder', JSON.stringify(sortedActive));
      return sortedActive;
    });
  }, [recentOverlayWidget, favoritesOverlayWidget, whatsNextOverlayWidget, customGroupWidgetIds]);

  // ==========================================================================
  // Sync State from Store
  // ==========================================================================
  const channelSyncing = useChannelSyncing();
  const vodSyncing = useVodSyncing();
  const tmdbMatching = useTmdbMatching();
  const syncStatusMessage = useSyncStatusMessage();
  const channelSortOrder = useChannelSortOrder();

  // Setter functions for auto-sync
  const setChannelSyncing = useSetChannelSyncing();
  const setVodSyncing = useSetVodSyncing();
  const setSyncStatusMessage = useSetSyncStatusMessage();
  const setChannelSortOrder = useSetChannelSortOrder();
  const setChannelSortOrderMigrated = useSetChannelSortOrderMigrated();
  const channelSortOrderMigrated = useChannelSortOrderMigrated();
  const setCategorySortOrder = useSetCategorySortOrder();
  const setEpgView = useSetEpgView();
  const epgView = useEpgView();

  const handleToggleEpgView = useCallback(() => {
    const nextView = epgView === 'traditional' ? 'alternate' : 'traditional';
    setEpgView(nextView);
    if (window.storage) {
      window.storage.updateSettings({ epgView: nextView }).catch((err: any) => {
        console.error('Failed to save epg view shortcut preference:', err);
      });
    }
  }, [epgView, setEpgView]);

  // ==========================================================================
  // TimeShift State
  // ==========================================================================
  const timeshiftState = useTimeshift(timeshiftEnabled);

  // ==========================================================================
  // DVR Events & URL Resolver
  // ==========================================================================
  useDvrEvents();
  useDvrUrlResolver();

  // ==========================================================================
  // Category & Channel State
  // ==========================================================================
  const currentChannels = useChannels(categoryId, channelSortOrder);
  const currentChannelsRef = useRef(currentChannels);
  useEffect(() => { currentChannelsRef.current = currentChannels; }, [currentChannels]);

  // ==========================================================================
  // Active Recordings
  // ==========================================================================
  const { recordings: activeRecordings, isRecording: hasActiveRecording } = useActiveRecordings(5000);

  // ==========================================================================
  // Advanced Search State
  // ==========================================================================
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advancedSearchConfig, setAdvancedSearchConfig] = useState<AdvancedSearchConfig>({
    query: '',
    scope: advancedSearchScope,
    sourceIds: advancedSearchSourceIds,
    categoryIds: advancedSearchCategoryIds,
    useForRegular: useAdvancedSearchForRegular,
  });

  // Force advanced filters for the current search when triggered from the modal,
  // even if "use for regular" is disabled. Cleared when user manually edits the title bar query.
  const [forceAdvancedFilters, setForceAdvancedFilters] = useState(false);

  // Determine active filters for search
  const activeSearchSourceIds = useMemo(() => {
    if (!useAdvancedSearchForRegular && !forceAdvancedFilters) return undefined;
    return advancedSearchConfig.sourceIds.length > 0 ? advancedSearchConfig.sourceIds : undefined;
  }, [useAdvancedSearchForRegular, forceAdvancedFilters, advancedSearchConfig.sourceIds]);

  const activeSearchCategoryIds = useMemo(() => {
    if (!useAdvancedSearchForRegular && !forceAdvancedFilters) return undefined;
    return advancedSearchConfig.categoryIds.length > 0 ? advancedSearchConfig.categoryIds : undefined;
  }, [useAdvancedSearchForRegular, forceAdvancedFilters, advancedSearchConfig.categoryIds]);

  // ==========================================================================
  // Search Results
  // ==========================================================================
  const searchChannels = useChannelSearch(
    debouncedSearchQuery,
    maxSearchResults,
    includeSourceInSearch,
    searchResultsOrder,
    activeSearchSourceIds,
    activeSearchCategoryIds
  );
  const searchPrograms = useProgramSearch(
    debouncedSearchQuery,
    maxSearchResults,
    searchResultsOrder,
    activeSearchSourceIds,
    activeSearchCategoryIds
  );

  // ==========================================================================
  // Track Selection Modal State
  // ==========================================================================
  const [showSubtitleModal, setShowSubtitleModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);

  const handleShowSubtitleModal = useCallback(() => {
    controlsHoveredRef.current = false;
    setShowSubtitleModal(true);
  }, [controlsHoveredRef]);
  const handleShowAudioModal = useCallback(() => {
    controlsHoveredRef.current = false;
    setShowAudioModal(true);
  }, [controlsHoveredRef]);



  // ==========================================================================
  // Tab Mode: enter when EPG, Sports, DVR, Settings, Movies, or Series opens
  // ==========================================================================
  useEffect(() => {
    if (activeView === 'guide' || activeView === 'sports' || activeView === 'dvr' ||
        activeView === 'settings' || activeView === 'movies' || activeView === 'series' ||
        activeView === 'calendar' || activeView === 'stremio') {
      enterTabMode(activeView);
    } else {
      exitTabMode();
    }
  }, [activeView, enterTabMode, exitTabMode]);

  // ==========================================================================
  // Popout-aware channel/VOD play wrappers
  // ==========================================================================
  const handlePlayInExternal = useCallback(async (channel: StoredChannel) => {
    try {
      const resolved = await resolvePlayUrl(channel.source_id, channel.direct_url);
      const result = await window.storage?.getSettings();
      let playerPath = result?.data?.externalPlayerPath || '';
      const playerArgs = result?.data?.externalPlayerArgs || '';
      if (!playerPath) {
        console.warn('[App] External player path not configured');
        return;
      }
      // Strip quotes from path if present
      playerPath = playerPath.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      const url = resolved.url;
      if (playerArgs.includes('{url}')) {
        const argsStr = playerArgs.replace(/\{url\}/g, url);
        const args = argsStr.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(a => a.replace(/^"(.*)"$/, '$1')) || [];
        await invoke('spawn_external_player_with_args', { playerPath, args });
      } else if (playerArgs.trim()) {
        const baseArgs = playerArgs.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(a => a.replace(/^"(.*)"$/, '$1')) || [];
        const args = [...baseArgs, url];
        await invoke('spawn_external_player_with_args', { playerPath, args });
      } else {
        await invoke('spawn_external_player', { playerPath, url });
      }
      addToRecentChannels(channel);
    } catch (e) {
      console.error('[App] Failed to launch external player:', e);
    }
  }, []);

  const handlePlayChannelWrapper = useCallback(async (channel: StoredChannel, autoSwitched?: boolean) => {
    if (popoutMode === 'external') {
      await handlePlayInExternal(channel);
    } else if (popoutMode === 'popout') {
      popoutSwapChannel(channel);
    } else {
      handlePlayChannel(channel, autoSwitched);
    }
  }, [popoutMode, handlePlayChannel, popoutSwapChannel, handlePlayInExternal]);

  const handlePlayVodWrapper = useCallback((info: import('./types/media').VodPlayInfo, onCloseView?: () => void) => {
    if (popoutMode) {
      popoutSwapVod(info);
    } else {
      handlePlayVod(info, onCloseView);
    }
  }, [popoutMode, handlePlayVod, popoutSwapVod]);

  // ==========================================================================
  // Handle Watchlist Switch (needs access to handlePlayChannel)
  // ==========================================================================
  const handleWatchlistSwitchWrapper = useCallback(async (notification: import('./components/WatchlistNotification').WatchlistNotificationItem) => {
    const channel = await db.channels.get(notification.channelId);
    if (channel) {
      addToRecentChannels(channel);
      handlePlayChannelWrapper(channel);
    }
  }, [handlePlayChannelWrapper]);

  // ==========================================================================
  // Stremio Playback Handler (listens for ynotv:stremio-play events)
  // ==========================================================================
  const handlePlayVodRef = useRef(handlePlayVod);
  useEffect(() => { handlePlayVodRef.current = handlePlayVod; }, [handlePlayVod]);
  const setActiveViewRef = useRef(setActiveView);
  useEffect(() => { setActiveViewRef.current = setActiveView; }, [setActiveView]);
  const setDurationRef = useRef(setDuration);
  useEffect(() => { setDurationRef.current = setDuration; }, [setDuration]);
  const setPositionRef = useRef(setPosition);
  useEffect(() => { setPositionRef.current = setPosition; }, [setPosition]);
  const autoSelectSubtitleRef = useRef(autoSelectSubtitle);
  useEffect(() => { autoSelectSubtitleRef.current = autoSelectSubtitle; }, [autoSelectSubtitle]);

  // Ref to hold current stremio episode info for the progress updater
  const stremioEpisodeRef = useRef<{
    metaId: string;
    name: string;
    poster?: string;
    videoId: string;
    season: number;
    episode: number;
    nextVideoId?: string;
    nextSeason?: number;
    nextEpisode?: number;
  } | null>(null);
  const stremioMovieRef = useRef<{ metaId: string; name: string; poster?: string } | null>(null);
  const stremioMetaRef = useRef<StremioMeta | null>(null);

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.stream || !detail?.meta) return;

      const { stream, meta, episodeVideo } = detail;
      const url = stream.url || (stream.infoHash ? `infoHash:${stream.infoHash}${stream.fileIdx !== undefined ? `:${stream.fileIdx}` : ''}` : null);
      if (!url) return;

      // Reset duration and position state/ref to avoid stale values during calculations
      if (setDurationRef.current) setDurationRef.current(0);
      if (setPositionRef.current) setPositionRef.current(0);
      durationRef.current = 0;
      positionRef.current = 0;

      // Record watch in stremio watch store
      const watchStore = useStremioWatchStore.getState();

      // Capture saved fraction before recording new start
      const savedFraction = meta.type === 'series' && episodeVideo
        ? watchStore.getEpisodeProgressFraction(episodeVideo.id)
        : (watchStore.history.find((h) => h.metaId === meta.id)?.progressFraction ?? 0);

      if (meta.type === 'series' && episodeVideo) {
        // Compute next episode: iterate videos sorted by season/episode
        let nextVideoId: string | undefined;
        let nextSeason: number | undefined;
        let nextEpisode: number | undefined;
        if (meta.videos && Array.isArray(meta.videos)) {
          const sorted = [...meta.videos].sort((a: any, b: any) => {
            if ((a.season ?? 0) !== (b.season ?? 0)) return (a.season ?? 0) - (b.season ?? 0);
            return (a.episode ?? 0) - (b.episode ?? 0);
          });
          const idx = sorted.findIndex((v: any) => v.id === episodeVideo.id);
          if (idx >= 0 && idx < sorted.length - 1) {
            const nxt = sorted[idx + 1];
            nextVideoId = nxt.id;
            nextSeason = nxt.season;
            nextEpisode = nxt.episode;
          }
        }
        watchStore.recordEpisodeStart(
          meta.id, meta.name, meta.poster,
          episodeVideo.id, episodeVideo.season ?? 0, episodeVideo.episode ?? 0,
          nextVideoId, nextSeason, nextEpisode,
          stream
        );
        stremioEpisodeRef.current = {
          metaId: meta.id,
          name: meta.name,
          poster: meta.poster,
          videoId: episodeVideo.id,
          season: episodeVideo.season ?? 0,
          episode: episodeVideo.episode ?? 0,
          nextVideoId,
          nextSeason,
          nextEpisode,
        };
        stremioMovieRef.current = null;
      } else {
        watchStore.recordMovieWatch(meta.id, meta.name, meta.poster, stream);
        stremioMovieRef.current = { metaId: meta.id, name: meta.name, poster: meta.poster };
        stremioEpisodeRef.current = null;
      }

      stremioMetaRef.current = meta;
      setActiveViewRef.current('none');
      const isSeries = meta.type === 'series' && episodeVideo;
      await handlePlayVodRef.current({
        url,
        title: meta.name,
        year: meta.year ? String(meta.year) : undefined,
        plot: isSeries
          ? (episodeVideo.description || episodeVideo.overview || meta.description)
          : meta.description,
        type: isSeries ? 'series' : 'movie',
        episodeInfo: isSeries
          ? `S${episodeVideo.season} E${episodeVideo.episode}${episodeVideo.title ? ` · ${episodeVideo.title}` : ''}`
          : undefined,
        source_id: 'stremio',
        mediaId: isSeries ? `${meta.id}_ep_${episodeVideo.id}` : meta.id,
        seriesId: isSeries ? meta.id : undefined,
        seasonNum: episodeVideo?.season,
        episodeNum: episodeVideo?.episode,
        episodeId: episodeVideo?.id,
      });

      // Resume from saved stremio progress if available
      if (savedFraction > 0.02 && savedFraction < 0.95) {
        const retrySeek = (attempt = 0) => {
          const dur = durationRef.current;
          if (dur > 0) {
            const seekTo = Math.floor(savedFraction * dur);
            if (seekTo > 0) {
              Bridge.seek(seekTo).catch(() => {
                setTimeout(() => Bridge.seek(seekTo).catch(() => {}), 2000);
              });
            }
          } else if (attempt < 10) {
            setTimeout(() => retrySeek(attempt + 1), 1000);
          }
        };
        setTimeout(() => retrySeek(), 1500);
      }

      if (stream.infoHash) {
        console.log('[Stremio] Playing torrent stream:', stream.infoHash);
      }

      try {
        const addons = useStremioAddonStore.getState().enabledAddons;
        const subs = await fetchSubtitles(addons, meta.type, meta.id);
        if (subs.length > 0 && window.mpv?.addSubtitleFile) {
          const { writeTextFile, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs');
          const { appLocalDataDir, join } = await import('@tauri-apps/api/path');
          const appDir = await appLocalDataDir();

          await mkdir('subtitles', { baseDir: BaseDirectory.AppLocalData, recursive: true }).catch(() => {});

          for (let i = 0; i < subs.length; i++) {
            const sub = subs[i];
            try {
              const res = await window.fetchProxy.fetch(sub.url);
              if (res.data?.ok) {
                const text = res.data.text;
                const isVtt = sub.url.toLowerCase().includes('.vtt') || text.includes('WEBVTT');
                const ext = isVtt ? 'vtt' : 'srt';
                const sanitizePart = (val?: string) => {
                  if (!val) return 'unknown';
                  return val.replace(/__/g, '_').replace(/ /g, '_').replace(/[^a-zA-Z0-9_]/g, '');
                };
                const cleanAddon = sanitizePart(sub.addonName || 'Addon');
                const cleanLabel = sanitizePart(sub.label || sub.lang.toUpperCase());
                const cleanMetaId = sanitizePart(meta.id);
                const cleanLang = sanitizePart(sub.lang);
                const relPath = `subtitles/stremio__${cleanAddon}__${cleanLabel}__${cleanMetaId}__${cleanLang}__${i}.${ext}`;
                const filePath = await join(appDir, relPath);

                await writeTextFile(relPath, text, { baseDir: BaseDirectory.AppLocalData });
                window.mpv.addSubtitleFile(filePath).catch(() => {});
              }
            } catch (err) {
              console.error('[Stremio] Failed to load or save subtitle:', sub.url, err);
            }
          }
        }
      } catch (err) {
        console.error('[Stremio] Error processing subtitles:', err);
      }
    };
    window.addEventListener('ynotv:stremio-play', handler);
    return () => window.removeEventListener('ynotv:stremio-play', handler);
  }, []);

  // ==========================================================================
  // Direct URL Playback Handler (used by Trailer button etc.)
  // ==========================================================================
  useEffect(() => {
    const handler = async (e: Event) => {
      const { url, title } = (e as CustomEvent).detail;
      if (!url) return;
      setActiveViewRef.current?.('none');
      await handlePlayVodRef.current({
        url,
        title: title || '',
        type: 'movie',
        source_id: 'trailer',
      });
    };
    window.addEventListener('ynotv:play-url', handler);
    return () => window.removeEventListener('ynotv:play-url', handler);
  }, []);

  // ==========================================================================
  // Stremio Progress Updater — saves watch progress every 10 seconds
  // ==========================================================================
  const positionRef = useRef(position);
  const durationRef = useRef(duration);
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  useEffect(() => {
    if (vodInfo?.source_id !== 'stremio' || !playing || duration <= 0) return;

    const saveStremioProgress = () => {
      const pos = positionRef.current;
      const dur = durationRef.current;
      if (dur <= 0 || pos <= 0) return;
      const fraction = Math.min(1, pos / dur);
      const watchStore = useStremioWatchStore.getState();

      const epInfo = stremioEpisodeRef.current;
      const movieInfo = stremioMovieRef.current;

      if (epInfo) {
        watchStore.updateEpisodeProgress(
          epInfo.metaId,
          epInfo.videoId,
          fraction,
          epInfo.season,
          epInfo.episode,
          epInfo.nextVideoId,
          epInfo.nextSeason,
          epInfo.nextEpisode
        );
        recordEpisodeWatch(
          epInfo.videoId,
          epInfo.metaId,
          'stremio',
          epInfo.season,
          epInfo.episode,
          '',
          Math.floor(pos),
          Math.floor(dur)
        ).catch(() => {});
      } else if (movieInfo) {
        watchStore.updateMovieProgress(movieInfo.metaId, fraction);
      }
    };

    // Save immediately and then every 10 seconds
    saveStremioProgress();
    const interval = setInterval(saveStremioProgress, 10_000);
    return () => clearInterval(interval);
  }, [vodInfo, playing, duration]);

  // ==========================================================================
  // Trakt & Simkl Unified Playback Scrobbler
  // ==========================================================================
  const lastKnownProgressPercentRef = useRef(0);
  const scrobblingMediaRef = useRef<any>(null);
  const scrobbleTimerRef = useRef<any>(null);

  // Refresh Trakt tokens on mount. Playback progress sync is manual from Settings.
  useEffect(() => {
    scrobbler.refreshTraktToken().catch(console.error);
  }, []);

  // Update last known progress percent continuously
  useEffect(() => {
    if (duration > 0) {
      lastKnownProgressPercentRef.current = (position / duration) * 100;
    }
  }, [position, duration]);

  useEffect(() => {
    if (!vodInfo) {
      // Playback stopped/closed
      if (scrobblingMediaRef.current) {
        const finalPercent = lastKnownProgressPercentRef.current;
        console.log('[Scrobbler] Playback ended, stopping scrobble at percent:', finalPercent);
        scrobbler.stopScrobble(finalPercent).catch(console.error);
        scrobblingMediaRef.current = null;
      }
      if (scrobbleTimerRef.current) {
        clearInterval(scrobbleTimerRef.current);
        scrobbleTimerRef.current = null;
      }
      return;
    }

    if (playing && duration > 0) {
      // Playback active (either starting or resuming)
      const currentPercent = (position / duration) * 100;
      
      // Determine media details
      let title = vodInfo.title || 'Unknown Video';
      let year = vodInfo.year;
      let imdbId: string | undefined = undefined;
      let type: 'movie' | 'series' = vodInfo.type === 'series' ? 'series' : 'movie';
      let season: number | undefined = undefined;
      let episode: number | undefined = undefined;

      // Extract IMDb and episode metadata
      if (vodInfo.source_id === 'stremio') {
        const epInfo = stremioEpisodeRef.current;
        const movieInfo = stremioMovieRef.current;
        if (epInfo) {
          imdbId = epInfo.metaId;
          title = epInfo.name;
          season = epInfo.season;
          episode = epInfo.episode;
          type = 'series';
        } else if (movieInfo) {
          imdbId = movieInfo.metaId;
          title = movieInfo.name;
          type = 'movie';
        }
      } else {
        // Native VOD
        imdbId = vodInfo.mediaId && vodInfo.mediaId.startsWith('tt') ? vodInfo.mediaId : undefined;
        if (vodInfo.type === 'series') {
          type = 'series';
          season = vodInfo.seasonNum;
          episode = vodInfo.episodeNum;
          
          // If mediaId is structured like "imdb_ep_id", extract the first part if it's an imdb id
          if (vodInfo.mediaId && vodInfo.mediaId.includes('_ep_')) {
            const parts = vodInfo.mediaId.split('_ep_');
            if (parts[0] && parts[0].startsWith('tt')) {
              imdbId = parts[0];
            }
          }
        }
      }

      const mediaInfo = {
        title,
        year,
        imdbId,
        type,
        season,
        episode,
        progressPercent: currentPercent
      };

      scrobblingMediaRef.current = mediaInfo;
      console.log('[Scrobbler] Starting/Resuming scrobble session:', mediaInfo);
      scrobbler.startScrobble(mediaInfo).catch(console.error);

      // Clear any existing timer
      if (scrobbleTimerRef.current) {
        clearInterval(scrobbleTimerRef.current);
      }

      // Set up periodic 30-second progress updater
      scrobbleTimerRef.current = setInterval(() => {
        const progress = lastKnownProgressPercentRef.current;
        console.log('[Scrobbler] 30s scrobble update interval firing at progress:', progress);
        scrobbler.updateScrobble(progress).catch(console.error);
      }, 30000);

    } else if (!playing && scrobblingMediaRef.current) {
      // Playback paused
      console.log('[Scrobbler] Playback paused, pausing scrobble...');
      scrobbler.pauseScrobble().catch(console.error);
      if (scrobbleTimerRef.current) {
        clearInterval(scrobbleTimerRef.current);
        scrobbleTimerRef.current = null;
      }
    }

    return () => {
      // Clean up timer on change of playback states
      if (scrobbleTimerRef.current) {
        clearInterval(scrobbleTimerRef.current);
        scrobbleTimerRef.current = null;
      }
    };
  }, [vodInfo, playing, duration]);

  // ==========================================================================
  // Skip Intro (IntroDB integration)
  // ==========================================================================
  const skipIntro = useSkipIntro({
    vodInfo,
    playing,
    position,
    duration,
    stremioEpisodeRef,
  });

  // ==========================================================================
  // Handle Channel Navigation (Up/Down) - with Series Episode Support
  // ==========================================================================
  const handleChannelUp = useCallback(async () => {
    // Check if we're watching a series with episode info
    if (vodInfo?.type === 'series' && vodInfo.seriesId && vodInfo.seasonNum && vodInfo.episodeNum) {
      // Stremio series: navigate through videos stored in meta
      if (vodInfo.source_id === 'stremio') {
        const meta = stremioMetaRef.current;
        if (meta?.videos) {
          const sorted = [...meta.videos].sort((a: any, b: any) => {
            if ((a.season ?? 0) !== (b.season ?? 0)) return (a.season ?? 0) - (b.season ?? 0);
            return (a.episode ?? 0) - (b.episode ?? 0);
          });
          const currentIdx = sorted.findIndex((v: any) => v.id === vodInfo.episodeId);
          if (currentIdx > 0) {
            const prevVideo = sorted[currentIdx - 1];
            const store = useUIStore.getState();
            store.setStremioActiveMeta(meta);
            store.setStremioSelectedSeason(prevVideo.season);
            store.setStremioPreselectVideoId(prevVideo.id);
            setActiveViewRef.current('stremio');
            return;
          }
        }
        // Fall through to channel nav if no prev episode found
      } else {
        // VOD series: navigate via DB episodes
        const prevEpisode = await getAdjacentEpisode(
          vodInfo.seriesId,
          vodInfo.seasonNum,
          vodInfo.episodeNum,
          'prev'
        );
        
        if (prevEpisode) {
          // Get progress for resume
          const progress = await getEpisodeProgress(prevEpisode.id);
          const resumePosition = progress?.progress_seconds && progress.progress_seconds > 10 ? progress.progress_seconds : 0;
          
          // Record watch history
          void recordVodWatch(
            vodInfo.seriesId,
            'series',
            vodInfo.source_id || '',
            vodInfo.title,
            undefined,
            prevEpisode.season_num,
            prevEpisode.episode_num,
            prevEpisode.title || `Episode ${prevEpisode.episode_num}`
          );
          
          void recordEpisodeWatch(
            prevEpisode.id,
            vodInfo.seriesId,
            vodInfo.source_id || '',
            prevEpisode.season_num,
            prevEpisode.episode_num,
            prevEpisode.title || `Episode ${prevEpisode.episode_num}`,
            resumePosition,
            prevEpisode.duration ?? Number(prevEpisode.info?.duration) ?? 0
          );
          
          // Play the previous episode
          await handlePlayVod({
            url: prevEpisode.direct_url,
            title: vodInfo.title,
            year: vodInfo.year,
            plot: prevEpisode.plot || vodInfo.plot,
            type: 'series',
            episodeInfo: `S${prevEpisode.season_num} E${prevEpisode.episode_num}${prevEpisode.title ? ` · ${prevEpisode.title}` : ''}`,
            source_id: vodInfo.source_id,
            mediaId: `${vodInfo.seriesId}_ep_${prevEpisode.id}`,
            seriesId: vodInfo.seriesId,
            seasonNum: prevEpisode.season_num,
            episodeNum: prevEpisode.episode_num,
            episodeId: prevEpisode.id,
          });
          return;
        }
      }
    }
    
    // Default: navigate channels
    if (currentChannels.length > 0 && currentChannel) {
      const currentIndex = currentChannels.findIndex((ch) => ch.stream_id === currentChannel.stream_id);
      if (currentIndex > 0) {
        handlePlayChannel(currentChannels[currentIndex - 1]);
      } else if (currentIndex === 0) {
        // Wrap to last channel
        handlePlayChannel(currentChannels[currentChannels.length - 1]);
      }
    }
  }, [currentChannels, currentChannel, handlePlayChannel, vodInfo, handlePlayVod]);

  const handleChannelDown = useCallback(async () => {
    // Check if we're watching a series with episode info
    if (vodInfo?.type === 'series' && vodInfo.seriesId && vodInfo.seasonNum && vodInfo.episodeNum) {
      // Stremio series: navigate through videos stored in meta
      if (vodInfo.source_id === 'stremio') {
        const meta = stremioMetaRef.current;
        if (meta?.videos) {
          const sorted = [...meta.videos].sort((a: any, b: any) => {
            if ((a.season ?? 0) !== (b.season ?? 0)) return (a.season ?? 0) - (b.season ?? 0);
            return (a.episode ?? 0) - (b.episode ?? 0);
          });
          const currentIdx = sorted.findIndex((v: any) => v.id === vodInfo.episodeId);
          if (currentIdx >= 0 && currentIdx < sorted.length - 1) {
            const nextVideo = sorted[currentIdx + 1];
            const store = useUIStore.getState();
            store.setStremioActiveMeta(meta);
            store.setStremioSelectedSeason(nextVideo.season);
            store.setStremioPreselectVideoId(nextVideo.id);
            setActiveViewRef.current('stremio');
            return;
          }
        }
        // Fall through to channel nav if no next episode found
      } else {
        // VOD series: navigate via DB episodes
        const nextEpisode = await getAdjacentEpisode(
          vodInfo.seriesId,
          vodInfo.seasonNum,
          vodInfo.episodeNum,
          'next'
        );
        
        if (nextEpisode) {
          // Get progress for resume
          const progress = await getEpisodeProgress(nextEpisode.id);
          const resumePosition = progress?.progress_seconds && progress.progress_seconds > 10 ? progress.progress_seconds : 0;
          
          // Record watch history
          void recordVodWatch(
            vodInfo.seriesId,
            'series',
            vodInfo.source_id || '',
            vodInfo.title,
            undefined,
            nextEpisode.season_num,
            nextEpisode.episode_num,
            nextEpisode.title || `Episode ${nextEpisode.episode_num}`
          );
          
          void recordEpisodeWatch(
            nextEpisode.id,
            vodInfo.seriesId,
            vodInfo.source_id || '',
            nextEpisode.season_num,
            nextEpisode.episode_num,
            nextEpisode.title || `Episode ${nextEpisode.episode_num}`,
            resumePosition,
            nextEpisode.duration ?? Number(nextEpisode.info?.duration) ?? 0
          );
          
          // Play the next episode
          await handlePlayVod({
            url: nextEpisode.direct_url,
            title: vodInfo.title,
            year: vodInfo.year,
            plot: nextEpisode.plot || vodInfo.plot,
            type: 'series',
            episodeInfo: `S${nextEpisode.season_num} E${nextEpisode.episode_num}${nextEpisode.title ? ` · ${nextEpisode.title}` : ''}`,
            source_id: vodInfo.source_id,
            mediaId: `${vodInfo.seriesId}_ep_${nextEpisode.id}`,
            seriesId: vodInfo.seriesId,
            seasonNum: nextEpisode.season_num,
            episodeNum: nextEpisode.episode_num,
            episodeId: nextEpisode.id,
          });
          return;
        }
      }
    }
    
    // Default: navigate channels
    if (currentChannels.length > 0 && currentChannel) {
      const currentIndex = currentChannels.findIndex((ch) => ch.stream_id === currentChannel.stream_id);
      if (currentIndex >= 0 && currentIndex < currentChannels.length - 1) {
        handlePlayChannel(currentChannels[currentIndex + 1]);
      } else if (currentIndex === currentChannels.length - 1) {
        // Wrap to first channel
        handlePlayChannel(currentChannels[0]);
      }
    }
  }, [currentChannels, currentChannel, handlePlayChannel, vodInfo, handlePlayVod]);

  // ==========================================================================
  // Keyboard Shortcuts (using latest ref pattern)
  // ==========================================================================
  useKeyboardShortcuts({
    shortcuts,
    activeView,
    showSettingsPopup,
    categoriesOpen,
    categoriesHidden,
    position,
    currentChannels,
    currentChannel,
    switchLayout,
    titleBarSearchRef,
    handlePlayChannel,
    lastPlayedChannel: lastPlayedChannelRef.current,
    handleTogglePlay,
    handleToggleMute,
    handleToggleStats,
    handleToggleFullscreen,
    handleShowSubtitleModal,
    handleShowAudioModal,
    handleSeek,
    handleToggleEpgView,
    setActiveView,
    setShowSettingsPopup,
    setCategoriesOpen,
    setShowControls,
    onChannelChangeFlash: triggerChannelChangeFlash,
  });

  // ==========================================================================
  // Auto-Sync on Startup & Periodic Checking
  // ==========================================================================
  const isAutoSyncingRef = useRef(false);

  useEffect(() => {
    // Helper to perform sync check and sync stale sources
    const performSyncCheck = async (isPeriodic = false) => {
      if (!window.storage) return;

      if (!isPeriodic) {
        if (hasStartupAutoSyncTriggered) {
          console.log('[AutoSync] Startup sync already triggered, skipping duplicate execution');
          return;
        }
        hasStartupAutoSyncTriggered = true;
      }

      // Skip if already syncing (for periodic checks)
      if (isPeriodic && isAutoSyncingRef.current) {
        console.log('[AutoSync] Periodic check skipped - sync already in progress');
        return;
      }

      // Health check — ensure backend bulk-ops plugin is ready
      const healthy = await bulkOps.healthCheck();
      if (!healthy) {
        console.error('[AutoSync] Backend health check failed — sync may not work');
      }

      try {
        // Load settings and sources in parallel
        const [settingsResult, sourcesResult] = await Promise.all([
          window.storage.getSettings(),
          window.storage.getSources()
        ]);
        
        if (!isPeriodic && settingsResult.data) {
          // Apply font sizes (only on initial sync)
          if (settingsResult.data.channelFontSize) {
            document.documentElement.style.setProperty('--channel-font-size', `${settingsResult.data.channelFontSize}px`);
          }
          if (settingsResult.data.categoryFontSize) {
            document.documentElement.style.setProperty('--category-font-size', `${settingsResult.data.categoryFontSize}px`);
          }
          if (settingsResult.data.epgTitleFontSize) {
            document.documentElement.style.setProperty('--epg-title-font-size', `${settingsResult.data.epgTitleFontSize}px`);
          }
          if (settingsResult.data.epgBodyFontSize) {
            document.documentElement.style.setProperty('--epg-body-font-size', `${settingsResult.data.epgBodyFontSize}px`);
          }
          // Apply other settings
          if (settingsResult.data.channelSortOrder) {
            setChannelSortOrder(settingsResult.data.channelSortOrder as 'alphabetical' | 'number' | 'provider');
          } else if (!channelSortOrderMigrated) {
            // Migrate users who never explicitly chose a sort order to the new default
            setChannelSortOrder('provider');
            await window.storage.updateSettings({ channelSortOrder: 'provider' });
            setChannelSortOrderMigrated(true);
          }
          if (settingsResult.data.categorySortOrder) {
            setCategorySortOrder(settingsResult.data.categorySortOrder as 'default' | 'alphabetical');
          }
          if (settingsResult.data.epgView) {
            setEpgView(settingsResult.data.epgView as 'traditional' | 'alternate');
          }
          // Apply modern UI setting (default to true if never set)
          const shouldEnableModernUi = settingsResult.data.modernUiEnabled ?? true;
          if (shouldEnableModernUi) {
            document.documentElement.classList.add('modern-ui');
          } else {
            document.documentElement.classList.remove('modern-ui');
          }
          // Persist the default value on first run so future reads are explicit
          if (settingsResult.data.modernUiEnabled === undefined) {
            await window.storage.updateSettings({ modernUiEnabled: true });
          }
        }

        const epgRefreshHours = settingsResult.data?.epgRefreshHours ?? 6;
        const vodRefreshHours = settingsResult.data?.vodRefreshHours ?? 24;
        // 0 = all at once (default), positive int = max parallel syncs
        const epgSyncConcurrency: number = settingsResult.data?.epgSyncConcurrency ?? 0;

        // Skip periodic check if both are manual-only (0 = manual only)
        if (isPeriodic && epgRefreshHours === 0 && vodRefreshHours === 0) {
          return;
        }

        // Use sources from parallel load
        if (!sourcesResult.data || sourcesResult.data.length === 0) return;

        let didSync = false;
        const syncedSourceIds: string[] = [];

        // ── Channel / EPG sync ──────────────────────────────────────────────
        if (epgRefreshHours > 0) {
          // Filter out VOD-only sources from channel sync
          const enabledSources = sourcesResult.data.filter((s: any) => s.enabled && !s.vod_only);
          const staleSources: any[] = [];
          for (const source of enabledSources) {
            if (await isEpgStale(source.id, epgRefreshHours)) staleSources.push(source);
          }

          if (staleSources.length > 0) {
            didSync = true;
            isAutoSyncingRef.current = true;
            setChannelSyncing(true);
            // 0 = run all at once; positive = batch size
            const CONCURRENCY = epgSyncConcurrency > 0 ? epgSyncConcurrency : staleSources.length || 1;
            const total = staleSources.length;
            const statusPrefix = isPeriodic ? 'Auto-syncing' : 'Syncing';
            for (let i = 0; i < total; i += CONCURRENCY) {
              const batch = staleSources.slice(i, i + CONCURRENCY);
              const batchNum = Math.floor(i / CONCURRENCY) + 1;
              const totalBatches = Math.ceil(total / CONCURRENCY);
              setSyncStatusMessage(`${statusPrefix} batch ${batchNum}/${totalBatches}: ${batch.map((s: any) => s.name).join(', ')}`);
              await Promise.all(
                batch.map(async (source: any, idx: number) => {
                  const prefix = `[${i + idx + 1}/${total}] ${source.name}`;
                  const result = await syncSource(source, (msg) => setSyncStatusMessage(`${prefix}: ${msg}`));
                  if (result.success) {
                    syncedSourceIds.push(source.id);
                  }
                })
              );
            }
            if (syncedSourceIds.length > 0) {
              setSyncStatusMessage('Updating global EPG links...');
              await syncAllStaleGlobalEpgLinks((msg) => setSyncStatusMessage(msg), syncedSourceIds);
            }
            setSyncStatusMessage(null);
          }
        }

        // ── VOD sync (Xtream only) ──────────────────────────────────────────
        if (vodRefreshHours > 0) {
          const xtreamSources = sourcesResult.data.filter((s: any) => s.type === 'xtream' && s.enabled && !s.live_tv_only);
          if (xtreamSources.length > 0) {
            const staleVod: any[] = [];
            for (const source of xtreamSources) {
              if (await isVodStale(source.id, vodRefreshHours)) staleVod.push(source);
            }
            if (staleVod.length > 0) {
              didSync = true;
              isAutoSyncingRef.current = true;
              setVodSyncing(true);
              // VOD sync also uses epgSyncConcurrency (0 = all at once)
              const CONCURRENCY = epgSyncConcurrency > 0 ? epgSyncConcurrency : staleVod.length || 1;
              const total = staleVod.length;
              const statusPrefix = isPeriodic ? 'Auto-syncing' : 'Syncing';
              for (let i = 0; i < total; i += CONCURRENCY) {
                const batch = staleVod.slice(i, i + CONCURRENCY);
                const batchNum = Math.floor(i / CONCURRENCY) + 1;
                const totalBatches = Math.ceil(total / CONCURRENCY);
                setSyncStatusMessage(`${statusPrefix} VOD batch ${batchNum}/${totalBatches}: ${batch.map((s: any) => s.name).join(', ')}`);
                await Promise.all(batch.map((source: any) => syncVodForSource(source)));
              }
              setSyncStatusMessage(null);
            }
          }
        }

        if (isPeriodic && didSync) {
          console.log('[AutoSync] Periodic sync completed');
        }
      } catch (err) {
        console.error('[AutoSync] Sync failed:', err);
      } finally {
        isAutoSyncingRef.current = false;
        setChannelSyncing(false);
        setVodSyncing(false);
      }
    };

    // Run initial sync
    performSyncCheck(false);

    // Set up periodic checking every 10 minutes
    const intervalId = setInterval(() => {
      performSyncCheck(true);
    }, AUTO_SYNC_CHECK_INTERVAL_MS);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [setChannelSortOrder, setChannelSyncing, setVodSyncing, setSyncStatusMessage]);

  // ==========================================================================
  // Window Size Initialization
  // ==========================================================================
  useEffect(() => {
    const initWindowSize = async () => {
      try {
        if (!window.storage) return;
        const result = await window.storage.getSettings();
        const settings = result.data || {};
        const width = settings.startupWidth || 1920;
        const height = settings.startupHeight || 1080;

        const appWindow = getCurrentWindow();
        const isMaximized = await appWindow.isMaximized();
        if (isMaximized) {
          await appWindow.unmaximize();
        }
        await appWindow.setSize(new LogicalSize(width, height));
      } catch (err) {
        console.error('[App] Failed to resize window on startup:', err);
      }
    };
    initWindowSize();
  }, []);

  // ==========================================================================
  // DVR Initialization
  // ==========================================================================
  useEffect(() => {
    const initDvr = async () => {
      try {
        await invoke('init_dvr');
      } catch (error) {
        console.error('[App] Failed to initialize DVR:', error);
      }
    };
    initDvr();
  }, []);

  // ==========================================================================
  // Check for Updates
  // ==========================================================================
  useEffect(() => {
    const checkUpdates = async () => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      await checkForUpdatesSilent();
    };
    checkUpdates();
  }, []);

  // ==========================================================================
  // Render
  // ==========================================================================
  return (
    <div className={`app${showControls ? '' : ' controls-hidden'}${sportsOverlayWidget === 'autohide' ? ' has-live-sports-autohide' : ''}${sportsOverlayWidget === 'persistent' ? ' has-live-sports-persistent' : ''}${recentOverlayWidget !== null ? ' has-recent-widget' : ''}${favoritesOverlayWidget ? ' has-favorites-widget' : ''}`} onMouseMove={handleMouseMove}>
      {/* Custom title bar for frameless window */}
      <div className={`title-bar${showControls ? ' visible' : ''}`} data-tauri-drag-region>
        <div className="title-bar-left-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Logo className="title-bar-logo" />
          <LayoutPicker
            currentLayout={multiviewLayout}
            onSelect={switchLayout}
            engineMode={multiviewEngineMode}
            onEngineChange={setMultiviewEngineMode}
          />
        </div>

        <div className="title-bar-spacer"></div>

        {/* Center Section: Unified Navigation Bar */}
        <div className="title-bar-content">
          <div className="title-bar-unified">
            {/* Segmented Control for View Switching */}
            <div className="title-bar-segmented">
              <button
                className={`segmented-btn ${activeView === 'guide' || (activeView === 'none' && categoriesOpen) ? 'active' : ''}`}
                onClick={() => {
                  if (activeView === 'guide') {
                    // LiveTV is open, close it entirely
                    setActiveView('none');
                    setCategoriesOpen(false);
                  } else {
                    // Open LiveTV, respect user's category hidden preference
                    setActiveView('guide');
                    setCategoriesOpen(!categoriesHidden);
                  }
                }}
                title="Live TV"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                  <polyline points="17 2 12 7 7 2"></polyline>
                </svg>
                <span>Live TV</span>
              </button>

              {!navHiddenTabs.includes('movies') && (
                <button
                  className={`segmented-btn ${activeView === 'movies' ? 'active' : ''}`}
                  onClick={() => {
                    setCategoriesOpen(false);
                    setActiveView(activeView === 'movies' ? 'none' : 'movies');
                  }}
                  title="Movies"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12"></path>
                    <path d="M8 4l0 16"></path>
                    <path d="M16 4l0 16"></path>
                    <path d="M4 8l4 0"></path>
                    <path d="M4 16l4 0"></path>
                    <path d="M4 12l16 0"></path>
                    <path d="M16 8l4 0"></path>
                    <path d="M16 16l4 0"></path>
                  </svg>
                  <span>Movies</span>
                </button>
              )}

              {!navHiddenTabs.includes('series') && (
                <button
                  className={`segmented-btn ${activeView === 'series' ? 'active' : ''}`}
                  onClick={() => {
                    setCategoriesOpen(false);
                    setActiveView(activeView === 'series' ? 'none' : 'series');
                  }}
                  title="Series"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9"></path>
                    <path d="M16 3l-4 4l-4 -4"></path>
                  </svg>
                  <span>Series</span>
                </button>
              )}

              {!navHiddenTabs.includes('dvr') && (
                <button
                  className={`segmented-btn ${activeView === 'dvr' ? 'active' : ''}`}
                  onClick={() => {
                    setCategoriesOpen(false);
                    setActiveView(activeView === 'dvr' ? 'none' : 'dvr');
                  }}
                  title="DVR"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"></path>
                  </svg>
                  <span>DVR</span>
                </button>
              )}

              {!navHiddenTabs.includes('sports') && (
                <button
                  className={`segmented-btn ${activeView === 'sports' ? 'active' : ''}`}
                  onClick={() => {
                    setCategoriesOpen(false);
                    setActiveView(activeView === 'sports' ? 'none' : 'sports');
                  }}
                  title="Sports Hub"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 21h8"></path>
                    <path d="M12 17v4"></path>
                    <path d="M7 4h10"></path>
                    <path d="M17 4v8a5 5 0 0 1-10 0V4"></path>
                    <path d="M5 9c-1.5 0-3 .6-3 2 0 1.4 1.5 2 3 2"></path>
                    <path d="M19 9c1.5 0 3 .6 3 2 0 1.4-1.5 2-3 2"></path>
                  </svg>
                  <span>Sports</span>
                </button>
              )}

              {!navHiddenTabs.includes('stremio') && (
                <button
                  className={`segmented-btn ${activeView === 'stremio' ? 'active' : ''}`}
                  onClick={() => {
                    setCategoriesOpen(false);
                    setActiveView(activeView === 'stremio' ? 'none' : 'stremio');
                  }}
                  title="Stremio Addons"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16v16H4z" />
                    <path d="M8 8h8v8H8z" />
                    <path d="M8 12h8" />
                    <path d="M12 8v8" />
                  </svg>
                  <span>Strem</span>
                </button>
              )}
            </div>

            <div className="unified-divider"></div>

            {/* Integrated Search */}
            <div className="title-bar-search-integrated">
              <svg className="title-bar-search-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.3-4.3"></path>
              </svg>
              <input
                ref={titleBarSearchRef}
                type="text"
                className="title-bar-search-input"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchQuery(value);
                  // If user manually changes the query (not from the modal), clear forced filters
                  if (value !== advancedSearchConfig.query) {
                    setForceAdvancedFilters(false);
                  }
                  if (value.length >= 1) {
                    setCategoriesOpen(true);
                    if (activeView !== 'guide') {
                      setActiveView('guide');
                    }
                  }
                }}
                onFocus={() => {
                  if (!isSearchMode && activeView !== 'guide') {
                    setCategoriesOpen(true);
                    setActiveView('guide');
                  }
                }}
              />
              {searchQuery && (
                <button
                  className="title-bar-search-clear"
                  onClick={() => {
                    setSearchQuery('');
                    setForceAdvancedFilters(false);
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
              <button
                className="title-bar-advanced-search-btn"
                onClick={() => setShowAdvancedSearch(true)}
                title="Advanced Search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.3-4.3"></path>
                  <line x1="21" y1="3" x2="21" y2="7"></line>
                  <line x1="19" y1="5" x2="23" y2="5"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="title-bar-spacer" style={{ position: 'relative' }}>
          {hasActiveRecording && (
            <div className="title-bar-recording-indicator">
              <RecordingIndicator size="small" variant="recording" />
            </div>
          )}
        </div>

        {/* Calendar Button */}
        <button
          className={`title-bar-calendar-btn ${activeView === 'calendar' ? 'active' : ''}`}
          onClick={() => {
            setCategoriesOpen(false);
            setActiveView(activeView === 'calendar' ? 'none' : 'calendar');
          }}
          title="TV Calendar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z" />
            <path d="M16 3v4" />
            <path d="M8 3v4" />
            <path d="M4 11h16" />
          </svg>
        </button>

        {/* Google Cast Button */}
        <CastButton castEnabled={castEnabled} onCastCurrentStream={castCurrentMedia} />

        {/* Settings Button */}
        <button
          className={`title-bar-settings-btn ${(showSettingsPopup || activeView === 'settings') ? 'active' : ''}`}
          onClick={() => {
            // In multiview (not main), use full view mode; otherwise use popup
            if (multiviewLayout !== 'main') {
              setCategoriesOpen(false);
              setActiveView(activeView === 'settings' ? 'none' : 'settings');
            } else {
              // In main layout, settings is a popup - don't close categories
              setShowSettingsPopup(!showSettingsPopup);
            }
            setSettingsTab('sources');
            setEditSourceId(null);
          }}
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>

        <div className="window-controls">
          <button onClick={handleMinimize} title="Minimize">─</button>
          <button onClick={handleMaximize} title="Maximize">□</button>
          <button onClick={handleClose} className="close" title="Close">✕</button>
        </div>
      </div>

      {/* Background - transparent over mpv */}
      <div className="video-background">
        {!currentChannel && !error && !isRestoring && (
          <div className="placeholder">
            <Logo className="placeholder__logo" />
            {(channelSyncing || vodSyncing || tmdbMatching) ? (
              <div className="sync-status">
                <div className="sync-status__spinner" />
                <span className="sync-status__text">
                  {syncStatusMessage || (channelSyncing && vodSyncing
                    ? 'Syncing channels & VOD...'
                    : channelSyncing
                      ? 'Syncing channels...'
                      : vodSyncing
                        ? 'Syncing VOD...'
                        : 'Matching with TMDB...')}
                </span>
              </div>
            ) : (
              <div className="placeholder__spacer" />
            )}
          </div>
        )}

        {error && activeView !== 'guide' && (
          <VideoErrorOverlay
            error={error}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Stream retry overlay — shown in fullscreen/main view (not when LiveTV guide is open) */}
        {retryState?.isRetrying && activeView !== 'guide' && (
          <StreamRetryOverlay retryState={retryState} />
        )}

        {/* Failover overlay — shown when switching to backup stream */}
        {failoverState?.isFailingOver && activeView !== 'guide' && (
          <FailoverOverlay state={failoverState} />
        )}

        {/* Commented out so it is not shown, per user request. Kept here to add back later if needed.
        isCasting && (
          <CastOverlay
            deviceName={castDeviceName}
            mediaTitle={castMetadataState.title}
            mediaSubtitle={castMetadataState.subtitle}
            onDisconnect={handleDisconnectCast}
          />
        )
        */}
      </div>

      {/* Video double-click overlay - captures double-clicks on video area to toggle fullscreen */}
      {activeView === 'none' && multiviewLayout === 'main' && (
        <div
          className="video-doubleclick-overlay"
          onDoubleClick={() => {
            handleToggleFullscreen();
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setBgContextMenu({ x: e.clientX, y: e.clientY });
          }}
        />
      )}

      {/* Live Sports Overlay Widget */}
      {sportsOverlayWidget && !(currentChannel?.stream_id === 'vod' || currentChannel?.stream_id?.startsWith('recording_')) && (
        <LiveSportsOverlay
          mode={sportsOverlayWidget}
          showControls={showControls}
          activeView={activeView}
        />
      )}

      {/* Overlay Widgets — all sit inside a shared WidgetBar flex container.
           The bar owns positioning and scale; widgets are just flex children.
           Adding more widgets here is trivial — they automatically line up. */}
      {(recentOverlayWidget || favoritesOverlayWidget || whatsNextOverlayWidget || customGroupWidgetIds.length > 0) &&
        !(currentChannel?.stream_id === 'vod' || currentChannel?.stream_id?.startsWith('recording_')) && (
        <WidgetBar cioEnabled={channelInfoOverlayEnabled}>
          {(() => {
            const activeWidgets: string[] = [];
            if (recentOverlayWidget) activeWidgets.push('recent');
            if (favoritesOverlayWidget) activeWidgets.push('favorites');
            if (whatsNextOverlayWidget) activeWidgets.push('whats-next');
            customGroupWidgetIds.forEach((id) => activeWidgets.push(`custom-${id}`));

            const sortedActive = [...activeWidgets].sort((a, b) => {
              let idxA = widgetOrder.indexOf(a);
              let idxB = widgetOrder.indexOf(b);
              if (idxA === -1) idxA = 999;
              if (idxB === -1) idxB = 999;
              return idxA - idxB;
            });

            return sortedActive.map((widgetId, index) => {
              const isFirst = index === 0;
              const isLast = index === sortedActive.length - 1;
              const moveLeft = !isFirst ? () => handleMoveWidget(widgetId, -1) : undefined;
              const moveRight = !isLast ? () => handleMoveWidget(widgetId, 1) : undefined;

              if (widgetId === 'recent') {
                return (
                  <RecentChannelsWidget
                    key={widgetId}
                    showControls={showControls}
                    activeView={activeView}
                    onChannelClick={handlePlayChannelWrapper}
                    limit={recentOverlayWidget === '10' ? 10 : 5}
                    isVod={Boolean(currentChannel?.stream_id === 'vod' || currentChannel?.stream_id?.startsWith('recording_'))}
                    onMoveLeft={moveLeft}
                    onMoveRight={moveRight}
                  />
                );
              }
              if (widgetId === 'favorites') {
                return (
                  <FavoritesWidget
                    key={widgetId}
                    showControls={showControls}
                    activeView={activeView}
                    onChannelClick={handlePlayChannelWrapper}
                    isVod={Boolean(currentChannel?.stream_id === 'vod' || currentChannel?.stream_id?.startsWith('recording_'))}
                    onMoveLeft={moveLeft}
                    onMoveRight={moveRight}
                  />
                );
              }
              if (widgetId === 'whats-next') {
                return (
                  <WhatsNextWidget
                    key={widgetId}
                    channel={currentChannel}
                    showControls={showControls}
                    activeView={activeView}
                    isVod={Boolean(currentChannel?.stream_id === 'vod' || currentChannel?.stream_id?.startsWith('recording_'))}
                    onMoveLeft={moveLeft}
                    onMoveRight={moveRight}
                  />
                );
              }
              if (widgetId.startsWith('custom-')) {
                const groupId = widgetId.replace('custom-', '');
                return (
                  <CustomGroupWidget
                    key={widgetId}
                    groupId={groupId}
                    showControls={showControls}
                    activeView={activeView}
                    onChannelClick={handlePlayChannelWrapper}
                    isVod={Boolean(currentChannel?.stream_id === 'vod' || currentChannel?.stream_id?.startsWith('recording_'))}
                    onMoveLeft={moveLeft}
                    onMoveRight={moveRight}
                  />
                );
              }
              return null;
            });
          })()}
        </WidgetBar>
      )}

      {/* Background Context Menu */}
      {bgContextMenu && (
        <BackgroundContextMenu
          position={bgContextMenu}
          sportsWidget={sportsOverlayWidget}
          recentWidget={recentOverlayWidget}
          favoritesWidget={favoritesOverlayWidget}
          whatsNextWidget={whatsNextOverlayWidget}
          customGroupIds={customGroupWidgetIds}
          onAddSportsAutohide={() => handleAddSportsOverlay('autohide')}
          onAddSportsPersistent={() => handleAddSportsOverlay('persistent')}
          onRemoveSports={handleRemoveSportsOverlay}
          onAddRecent5={handleAddRecent5Overlay}
          onAddRecent10={handleAddRecent10Overlay}
          onRemoveRecent={handleRemoveRecentOverlay}
          onAddFavorites={handleAddFavoritesOverlay}
          onRemoveFavorites={handleRemoveFavoritesOverlay}
          onAddWhatsNext={handleAddWhatsNextOverlay}
          onRemoveWhatsNext={handleRemoveWhatsNextOverlay}
          onAddCustomGroup={() => setGroupPickerOpen(true)}
          onClose={() => setBgContextMenu(null)}
        />
      )}

      {/* Custom Group Picker Modal */}
      {groupPickerOpen && (
        <GroupPickerModal
          activeGroupIds={customGroupWidgetIds}
          onAdd={handleAddCustomGroupWidget}
          onRemove={handleRemoveCustomGroupWidget}
          onClose={() => setGroupPickerOpen(false)}
        />
      )}

      {/* Skip Intro Button */}
      <SkipIntroButton
        visible={skipIntro.showButton}
        countdown={skipIntro.countdown}
        onSkip={skipIntro.handleSkip}
      />

      {/* Now Playing Bar */}
      <NowPlayingBar
        visible={
          showControls &&
          activeView !== 'guide' &&
          !categoriesOpen &&
          multiviewLayout !== '2x2' &&
          multiviewLayout !== 'bigbottom'
        }
        channel={currentChannel}
        playing={playing}
        muted={muted}
        volume={volume}
        mpvReady={mpvReady}
        position={position}
        duration={duration}
        isVod={currentChannel?.stream_id === 'vod' || currentChannel?.stream_id?.startsWith('recording_')}
        vodInfo={vodInfo}
        isCatchup={isCatchup}
        catchupInfo={catchupInfo}
        channelInfoOverlayEnabled={channelInfoOverlayEnabled}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        onToggleMute={handleToggleMute}
        onVolumeChange={handleVolumeChange}
        onSeek={handleSeek}
        onVolumeDragStart={() => { volumeDraggingRef.current = true; }}
        onVolumeDragEnd={() => { volumeDraggingRef.current = false; }}
        onMouseEnter={() => { controlsHoveredRef.current = true; }}
        onMouseLeave={() => { controlsHoveredRef.current = false; }}
        onCycleSubtitle={handleCycleSubtitle}
        onCycleAudio={handleCycleAudio}
        onToggleStats={handleToggleStats}
        onToggleFullscreen={handleToggleFullscreen}
        onShowSubtitleModal={handleShowSubtitleModal}
        onShowAudioModal={handleShowAudioModal}
        onGoToLive={() => currentChannel && handlePlayChannelWrapper(currentChannel)}
        onCatchupSeek={handleCatchupSeek}
        timeshiftEnabled={timeshiftEnabled}
        timeshiftState={timeshiftState}
        onTimeshiftCatchUp={() => {
          if (timeshiftState) {
            handleSeek(Math.max(0, timeshiftState.cacheEnd - liveBufferOffset));
          }
        }}
        onChannelUp={handleChannelUp}
        onChannelDown={handleChannelDown}
        aspectRatio={heroAspectRatio}
        onSetAspectRatio={handleSetAspectRatio}
        overlay={
          <FailoverGroupOverlay
            currentChannel={currentChannel}
            visible={isFailoverGroupOverlayVisible}
            onChannelClick={handlePlayChannelWrapper}
          />
        }
      />

      {/* Channel Info Overlay */}
      <ChannelInfoOverlay
        channel={currentChannel}
        visible={isChannelInfoOverlayVisible}
        hideDescription={channelInfoOverlayHideDescription}
      />

      {/* Multiview Layout */}
      {multiviewLayout !== 'main' && (
        <MultiviewLayout
          hidden={activeView !== 'none'}
          layout={multiviewLayout}
          slots={multiviewSlots}
          engineMode={multiviewEngineMode}
          mainChannelName={currentChannel?.name || null}
          mainPlaying={playing}
          mainMuted={muted}
          mainVolume={volume}
          onMainTogglePlayPause={handleTogglePlay}
          onMainToggleMute={handleToggleMute}
          onMainSetVolume={(vol) => handleVolumeChange({ target: { value: vol.toString() } } as any)}
          onSwapWithMain={(slotId) => swapWithMain(slotId, multiviewSlots)}
          onMainStop={handleStop}
          onStop={stopSlot}
          onSetProperty={setSlotProperty}
          onReposition={repositionSecondarySlots}
          onSwitchLayout={switchLayout}
        />
      )}

      {/* Track Selection Modals */}
      <SubtitleControlModal
        isOpen={showSubtitleModal}
        onClose={() => {
          controlsHoveredRef.current = false;
          setShowSubtitleModal(false);
          handleMouseMove();
        }}
        vodTitle={vodInfo?.title}
        vodYear={vodInfo?.year}
        seasonNum={vodInfo?.seasonNum}
        episodeNum={vodInfo?.episodeNum}
      />
      <TrackSelectionModal
        isOpen={showAudioModal}
        type="audio"
        onClose={() => {
          controlsHoveredRef.current = false;
          setShowAudioModal(false);
          handleMouseMove();
        }}
      />

      {/* Advanced Search Modal */}
      <AdvancedSearchModal
        isOpen={showAdvancedSearch}
        initialConfig={advancedSearchConfig}
        onSearch={(config) => {
          setAdvancedSearchConfig(config);
          // Persist settings
          if (window.storage) {
            window.storage.updateSettings({
              advancedSearchScope: config.scope,
              advancedSearchSourceIds: config.sourceIds,
              advancedSearchCategoryIds: config.categoryIds,
              useAdvancedSearchForRegular: config.useForRegular,
            }).catch((err: any) => console.error('Failed to save advanced search settings:', err));
          }
          // Update local state setters
          setAdvancedSearchScope(config.scope);
          setAdvancedSearchSourceIds(config.sourceIds);
          setAdvancedSearchCategoryIds(config.categoryIds);
          setUseAdvancedSearchForRegular(config.useForRegular);
          // Force advanced filters for this search (even if useForRegular is off)
          setForceAdvancedFilters(true);
          // Set the search query and activate search
          setSearchQuery(config.query);
          setCategoriesOpen(true);
          if (activeView !== 'guide') {
            setActiveView('guide');
          }
          setShowAdvancedSearch(false);
          // Focus the search input
          setTimeout(() => {
            if (titleBarSearchRef.current) {
              titleBarSearchRef.current.focus();
            }
          }, 50);
        }}
        onClose={() => setShowAdvancedSearch(false)}
      />

      {/* Category Strip */}
      <CategoryStrip
        selectedCategoryId={categoryId}
        onSelectCategory={(catId) => {
          if (isSearchMode) {
            setSearchQuery('');
          }
          if (catId !== '__watchlist__') {
            setIsWatchlistMode(false);
          }
          handleSelectCategory(catId);
        }}
        visible={categoriesOpen}
        onEditSource={(sourceId) => {
          setSettingsTab('sources');
          setEditSourceId(sourceId);
          setActiveView('settings');
          setCategoriesOpen(false);
        }}
        onClose={() => {
          setCategoriesOpen(false);
          setCategoriesHidden(true);
        }}
        onShow={() => {
          setCategoriesOpen(true);
          setCategoriesHidden(false);
        }}
        isLiveTV={activeView === 'guide'}
      />

      {/* Channel Panel */}
      <ChannelPanel
        categoryId={isSearchMode || isWatchlistMode ? null : categoryId}
        visible={activeView === 'guide'}
        categoryStripOpen={categoriesOpen}
        onPlayChannel={handlePlayChannelWrapper}
        popoutMode={popoutMode}
        onTogglePopoutMode={cyclePopoutMode}
        onPlayInPopout={popoutSwapChannel}
        onPlayInExternal={handlePlayInExternal}
        popoutIsOpen={popoutIsOpen}
        onPlayCatchup={handlePlayCatchup}
        onClose={() => {
          setActiveView('none');
          setCategoriesOpen(false);
          Bridge.syncWindow();
        }}
        error={error}
        isSearchMode={isSearchMode}
        searchQuery={debouncedSearchQuery}
        searchChannels={searchChannels}
        searchPrograms={searchPrograms}
        searchScope={advancedSearchConfig.scope}
        isWatchlistMode={isWatchlistMode}
        watchlistItems={watchlistItems}
        onWatchlistRefresh={refreshWatchlist}
        currentLayout={multiviewLayout}
        multiviewEngineMode={multiviewEngineMode}
        onSendToSlot={sendToSlot}
        includeSourceInSearch={includeSourceInSearch}
        searchResultsOrder={searchResultsOrder}
        currentChannel={currentChannel}
        onTogglePlay={handleTogglePlay}
        isPlaying={playing}
        onChannelUp={handleChannelUp}
        onChannelDown={handleChannelDown}

        // Playback state & controls for Alternate View NowPlayingBar overlay
        mpvReady={mpvReady}
        duration={duration}
        position={position}
        muted={muted}
        volume={volume}
        isVod={currentChannel?.stream_id === 'vod' || currentChannel?.stream_id?.startsWith('recording_')}
        vodInfo={vodInfo}
        isCatchup={isCatchup}
        catchupInfo={catchupInfo}
        onStop={handleStop}
        onToggleMute={handleToggleMute}
        onVolumeChange={handleVolumeChange}
        onSeek={handleSeek}
        onCycleSubtitle={handleCycleSubtitle}
        onCycleAudio={handleCycleAudio}
        onToggleStats={handleToggleStats}
        onToggleFullscreen={handleToggleFullscreen}
        onShowSubtitleModal={handleShowSubtitleModal}
        onShowAudioModal={handleShowAudioModal}
        retryState={retryState}
        failoverState={failoverState}
        onCatchupSeek={handleCatchupSeek}
        timeshiftEnabled={timeshiftEnabled}
        timeshiftState={timeshiftState}
        onTimeshiftCatchUp={timeshiftState ? () => handleSeek(timeshiftState.cacheEnd - 1) : undefined}
      />

      {/* Settings Panel - as popup overlay in main layout, or full view in multiview */}
      {(showSettingsPopup || activeView === 'settings') && (
        <Settings
          castEnabled={castEnabled}
          onCastEnabledChange={setCastEnabled}
          initialTab={settingsTab}
          editSourceId={editSourceId}
          onClose={() => {
            if (showSettingsPopup) {
              setShowSettingsPopup(false);
            } else {
              setActiveView('none');
            }
            setEditSourceId(null);
          }}
          onShortcutsChange={setShortcuts}
          theme={theme}
          onThemeChange={setTheme}
          channelInfoOverlayEnabled={channelInfoOverlayEnabled}
          onChannelInfoOverlayChange={setChannelInfoOverlayEnabled}
          channelInfoOverlayFontSize={channelInfoOverlayFontSize}
          onChannelInfoOverlayFontSizeChange={setChannelInfoOverlayFontSize}
          channelInfoOverlayLogoSize={channelInfoOverlayLogoSize}
          onChannelInfoOverlayLogoSizeChange={setChannelInfoOverlayLogoSize}
          channelInfoOverlayBoxWidth={channelInfoOverlayBoxWidth}
          onChannelInfoOverlayBoxWidthChange={setChannelInfoOverlayBoxWidth}
          channelInfoOverlayOpacity={channelInfoOverlayOpacity}
          onChannelInfoOverlayOpacityChange={setChannelInfoOverlayOpacity}
          channelInfoOverlayHideDescription={channelInfoOverlayHideDescription}
          onChannelInfoOverlayHideDescriptionChange={setChannelInfoOverlayHideDescription}
          overlayAutohideTimer={overlayAutohideTimer}
          onOverlayAutohideTimerChange={setOverlayAutohideTimer}
        />
      )}

      {/* Movies Page */}
      {activeView === 'movies' && (
        <MoviesPage
          onPlay={(info) => handlePlayVodWrapper(info, () => setActiveView('none'))}
          onClose={() => setActiveView('none')}
        />
      )}

      {/* Series Page */}
      {activeView === 'series' && (
        <SeriesPage
          onPlay={(info) => handlePlayVodWrapper(info, () => setActiveView('none'))}
          onClose={() => setActiveView('none')}
        />
      )}

      {/* DVR Dashboard */}
      {activeView === 'dvr' && (
        <DvrDashboard
          onPlay={(recording) => handlePlayRecording(recording, () => setActiveView('none'))}
          onClose={() => setActiveView('none')}
        />
      )}

      {/* Sports Hub */}
      {activeView === 'sports' && (
        <SportsHub
          onClose={() => setActiveView('none')}
          onSearchChannels={(query) => {
            setSearchQuery(query);
            setActiveView('guide');
            setCategoriesOpen(true);
            setTimeout(() => {
              if (titleBarSearchRef.current) {
                titleBarSearchRef.current.focus();
              }
            }, 50);
          }}
          previewEnabled={sportsPreviewEnabled}
          onTogglePreview={() => setSportsPreviewEnabled(v => !v)}
          onPlayChannel={handlePlayChannelWrapper}
          onTogglePlay={handleTogglePlay}
          isPlaying={playing}
          onStop={handleStop}
          onChannelUp={handleChannelUp}
          onChannelDown={handleChannelDown}
        />
      )}

      {/* Stremio Page */}
      {activeView === 'stremio' && (
        <StremioPage
          onClose={() => setActiveView('none')}
          stremioStreamPickerMode={stremioStreamPickerMode}
          onStreamPickerModeChange={handleStremioStreamPickerModeChange}
        />
      )}

      {/* TV Calendar */}
      {activeView === 'calendar' && (
        <TVCalendarPage
          onClose={() => setActiveView('none')}
          onPlayChannel={async (channelName) => {
            let channel = currentChannels.find(c => c.name === channelName);
            if (!channel) {
              const channels = await db.channels.whereRaw('name = ?', [channelName]).toArray();
              if (channels.length > 0) {
                channel = channels[0];
              }
            }
            if (channel) {
              handlePlayChannelWrapper(channel);
            }
          }}
        />
      )}

      {/* Watchlist Notifications */}
      <WatchlistNotificationContainer
        notifications={watchlistNotifications}
        onSwitch={handleWatchlistSwitchWrapper}
        onDismiss={handleWatchlistDismiss}
      />

      {/* Popout Player Control Bar */}
      {popoutIsOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            background: 'rgba(0,0,0,0.9)',
            backdropFilter: 'blur(12px)',
            borderRadius: '14px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            fontSize: '13px',
            color: '#fff',
            cursor: 'default',
            userSelect: 'none',
            minWidth: '240px',
          }}
        >
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
            <span style={{ color: 'var(--accent, #00d4ff)', fontSize: '15px' }}>🖥️</span>
            <span style={{ opacity: 0.95, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
              {popout.content?.type === 'channel'
                ? popout.content.channel.name
                : popout.content?.type === 'vod'
                  ? popout.content.info.title
                  : 'Popout Active'}
            </span>
          </div>

          {/* Controls row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            <button
              onClick={() => popoutTogglePause()}
              title="Play / Pause"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
            </button>
            <button
              onClick={() => popoutStopPlayback()}
              title="Stop"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            </button>
            <button
              onClick={() => popoutToggleFullscreen()}
              title="Fullscreen"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            </button>
            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
            <button
              onClick={() => closePopout()}
              title="Close popout"
              style={{
                background: 'rgba(255,80,80,0.2)',
                border: 'none',
                borderRadius: '8px',
                color: '#ff8080',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Volume row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setPopoutMuted(true)}
              title="Mute"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            </button>
            <input
              type="range"
              min="0"
              max="100"
              defaultValue="100"
              onChange={(e) => setPopoutVolume(parseInt(e.target.value, 10))}
              style={{
                flex: 1,
                accentColor: 'var(--accent, #00d4ff)',
                height: '4px',
              }}
            />
          </div>
        </div>
      )}

      {/* Update Modal */}
      <UpdateModal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
      />
    </div>
  );
}

export default App;

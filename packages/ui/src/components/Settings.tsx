import { useState, useEffect, useCallback } from 'react';
import type { Source } from '@ynotv/core';
import { useEpgView, useSetEpgView } from '../stores/uiStore';
import { SettingsSidebar, type SettingsTabId } from './settings/SettingsSidebar';
import { SourcesTab } from './settings/SourcesTab';
import { TmdbTab } from './settings/TmdbTab';
import { DataRefreshTab } from './settings/DataRefreshTab';
import { ChannelsTab } from './settings/ChannelsTab';

import { SecurityTab } from './settings/SecurityTab';
import { DebugTab } from './settings/DebugTab';
import { ShortcutsTab } from './settings/ShortcutsTab';
import { ImportExportTab } from './settings/ImportExportTab';
import { UITab } from './settings/UITab';
import { ThemeTab } from './settings/ThemeTab';
import { StartupTab, type SavedLayoutState } from './settings/StartupTab';
import { PlaybackTab } from './settings/PlaybackTab';
import { CacheTab } from './settings/CacheTab';
import { AboutTab } from './settings/AboutTab';
import { LiveTVTab } from './settings/LiveTVTab';
import { LiveViewTab } from './settings/LiveViewTab';
import { SubtitlesTab, type SubtitleSettings } from './settings/SubtitlesTab';
import type { ShortcutsMap, ThemeId } from '../types/app';
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
  const [channelSortOrder, setChannelSortOrder] = useState<'alphabetical' | 'number'>('alphabetical');
  const [categorySortOrder, setCategorySortOrder] = useState<'default' | 'alphabetical'>('default');
  const [includeSourceInSearch, setIncludeSourceInSearch] = useState(false);
  const [maxSearchResults, setMaxSearchResults] = useState(200);
  const [searchResultsOrder, setSearchResultsOrder] = useState<'default' | 'alphabetical'>('default');

  // Shortcuts state
  const [shortcuts, setShortcuts] = useState<ShortcutsMap>({});

  // UI state
  const [uiSettings, setUiSettings] = useState<{
    channelFontSize: number;
    categoryFontSize: number;
    startupWidth?: number;
    startupHeight?: number;
    dontSaveWindowSizeOnClose?: boolean;
  }>({
    channelFontSize: 14,
    categoryFontSize: 13,
  });

  // Startup settings state
  const [rememberLastChannels, setRememberLastChannels] = useState(false);
  const [reopenLastOnStartup, setReopenLastOnStartup] = useState(false);
  const [savedLayoutState, setSavedLayoutState] = useState<SavedLayoutState | null>(null);

  // Playback settings state
  const [mpvParams, setMpvParams] = useState<string>('');
  const [mpvDisableWhitelist, setMpvDisableWhitelist] = useState(false);
  const [timeshiftEnabled, setTimeshiftEnabled] = useState(false);
  const [timeshiftCacheBytes, setTimeshiftCacheBytes] = useState(1_073_741_824);
  const [liveBufferOffset, setLiveBufferOffset] = useState(0);
  // Stream retry settings
  const [streamWatchdogSeconds, setStreamWatchdogSeconds] = useState(10);
  const [streamMaxRetries, setStreamMaxRetries] = useState(20);

  // LiveTV settings state
  const [epgDarkenCurrent, setEpgDarkenCurrent] = useState(false);
  const [miniMediaBarForEpgPreview, setMiniMediaBarForEpgPreview] = useState(false);
  const [collapseSourceCategoriesOnStartup, setCollapseSourceCategoriesOnStartup] = useState(false);
  const [modernUiEnabled, setModernUiEnabled] = useState(true);
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

  // Sync prop values to internal state so changes from App.tsx take effect immediately
  useEffect(() => { setChannelInfoOverlayEnabled(channelInfoOverlayEnabledProp ?? false); }, [channelInfoOverlayEnabledProp]);
  useEffect(() => { setChannelInfoOverlayFontSize(channelInfoOverlayFontSizeProp ?? 16); }, [channelInfoOverlayFontSizeProp]);
  useEffect(() => { setChannelInfoOverlayLogoSize(channelInfoOverlayLogoSizeProp ?? 42); }, [channelInfoOverlayLogoSizeProp]);
  useEffect(() => { setChannelInfoOverlayBoxWidth(channelInfoOverlayBoxWidthProp ?? 380); }, [channelInfoOverlayBoxWidthProp]);
  useEffect(() => { setChannelInfoOverlayOpacity(channelInfoOverlayOpacityProp ?? 55); }, [channelInfoOverlayOpacityProp]);
  useEffect(() => { setChannelInfoOverlayHideDescription(channelInfoOverlayHideDescriptionProp ?? false); }, [channelInfoOverlayHideDescriptionProp]);

  // Subtitle settings state
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>({
    subsourceApiKey: '',
    defaultLanguage: 'en',
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
        channelSortOrder?: 'alphabetical' | 'number';
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
        mpvParams?: string;
        mpvDisableWhitelist?: boolean;
        timeshiftEnabled?: boolean;
        timeshiftCacheBytes?: number;
        liveBufferOffset?: number;
        streamWatchdogSeconds?: number;
        streamMaxRetries?: number;
        epgDarkenCurrent?: boolean;
        miniMediaBarForEpgPreview?: boolean;
        epgView?: 'traditional' | 'alternate';
        collapseSourceCategoriesOnStartup?: boolean;
        modernUiEnabled?: boolean;
        epgTitleFontSize?: number;
        epgBodyFontSize?: number;
        channelInfoOverlayEnabled?: boolean;
        channelInfoOverlayFontSize?: number;
        channelInfoOverlayLogoSize?: number;
        channelInfoOverlayBoxWidth?: number;
        channelInfoOverlayOpacity?: number;
        channelInfoOverlayHideDescription?: boolean;
        subtitleSettings?: SubtitleSettings;
      };

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
      setChannelSortOrder(settings.channelSortOrder ?? 'alphabetical');
      setCategorySortOrder(settings.categorySortOrder ?? 'default');
      setIncludeSourceInSearch(settings.includeSourceInSearch ?? false);
      setMaxSearchResults(settings.maxSearchResults ?? 200);
      setSearchResultsOrder(settings.searchResultsOrder ?? 'default');

      // Load shortcuts
      if (settings.shortcuts) {
        setShortcuts(settings.shortcuts);
      }

      // Load UI settings
      const loadedUiSettings = {
        channelFontSize: settings.channelFontSize ?? 14,
        categoryFontSize: settings.categoryFontSize ?? 13,
        startupWidth: settings.startupWidth,
        startupHeight: settings.startupHeight,
        dontSaveWindowSizeOnClose: settings.dontSaveWindowSizeOnClose ?? false,
      };
      setUiSettings(loadedUiSettings);

      // Apply UI settings immediately
      document.documentElement.style.setProperty('--channel-font-size', `${loadedUiSettings.channelFontSize}px`);
      document.documentElement.style.setProperty('--category-font-size', `${loadedUiSettings.categoryFontSize}px`);

      // Load startup settings
      setRememberLastChannels(settings.rememberLastChannels ?? false);
      setReopenLastOnStartup(settings.reopenLastOnStartup ?? false);
      setSavedLayoutState(settings.savedLayoutState ?? null);

      // Load playback settings
      setMpvParams(settings.mpvParams ?? '');
      setMpvDisableWhitelist(settings.mpvDisableWhitelist ?? false);
      setTimeshiftEnabled(settings.timeshiftEnabled ?? false);
      setTimeshiftCacheBytes(settings.timeshiftCacheBytes ?? 1_073_741_824);
      setLiveBufferOffset(settings.liveBufferOffset ?? 0);
      setStreamWatchdogSeconds(settings.streamWatchdogSeconds ?? 10);
      setStreamMaxRetries(settings.streamMaxRetries ?? 20);

      // Load LiveTV settings
      const darkenCurrent = settings.epgDarkenCurrent ?? false;
      setEpgDarkenCurrent(darkenCurrent);
      // Apply CSS class on load
      if (darkenCurrent) {
        document.documentElement.classList.add('epg-darken-current');
      }

      // Load mini media bar setting
      setMiniMediaBarForEpgPreview(settings.miniMediaBarForEpgPreview ?? false);
      
      // Load EPG view layout setting
      setEpgView(settings.epgView ?? 'traditional');
      
      // Load collapse source categories setting
      setCollapseSourceCategoriesOnStartup(settings.collapseSourceCategoriesOnStartup ?? false);
      
      // Load modern UI setting (default true)
      const loadedModernUi = settings.modernUiEnabled ?? true;
      setModernUiEnabled(loadedModernUi);
      // Apply CSS class on load
      if (loadedModernUi) {
        document.documentElement.classList.add('modern-ui');
      } else {
        document.documentElement.classList.remove('modern-ui');
      }
      // Persist default if not already saved
      if (settings.modernUiEnabled === undefined) {
        await window.storage.updateSettings({ modernUiEnabled: true });
      }

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

      // Load subtitle settings
      if (settings.subtitleSettings) {
        setSubtitleSettings(settings.subtitleSettings);
      }
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

  const handleStreamWatchdogSecondsChange = async (seconds: number) => {
    setStreamWatchdogSeconds(seconds);
    if (window.storage) {
      await window.storage.updateSettings({ streamWatchdogSeconds: seconds });
    }
    window.dispatchEvent(new CustomEvent('ynotv:retry-settings-changed', {
      detail: { streamWatchdogSeconds: seconds }
    }));
  };

  const handleStreamMaxRetriesChange = async (retries: number) => {
    setStreamMaxRetries(retries);
    if (window.storage) {
      await window.storage.updateSettings({ streamMaxRetries: retries });
    }
    window.dispatchEvent(new CustomEvent('ynotv:retry-settings-changed', {
      detail: { streamMaxRetries: retries }
    }));
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

  const handleMiniMediaBarForEpgPreviewChange = async (enabled: boolean) => {
    setMiniMediaBarForEpgPreview(enabled);
    if (window.storage) {
      await window.storage.updateSettings({ miniMediaBarForEpgPreview: enabled });
    }
  };

  const handleEpgViewChange = async (view: 'traditional' | 'alternate') => {
    setEpgView(view);
    if (window.storage) {
      await window.storage.updateSettings({ epgView: view });
    }
  };

  const handleCollapseSourceCategoriesOnStartupChange = async (enabled: boolean) => {
    setCollapseSourceCategoriesOnStartup(enabled);
    if (window.storage) {
      await window.storage.updateSettings({ collapseSourceCategoriesOnStartup: enabled });
    }
  };

  const handleModernUiEnabledChange = async (enabled: boolean) => {
    setModernUiEnabled(enabled);
    // Apply/remove the modern-ui class to the document
    if (enabled) {
      document.documentElement.classList.add('modern-ui');
    } else {
      document.documentElement.classList.remove('modern-ui');
    }
    if (window.storage) {
      await window.storage.updateSettings({ modernUiEnabled: enabled });
    }
  };

  const handleEpgTitleFontSizeChange = async (size: number) => {
    setEpgTitleFontSize(size);
    document.documentElement.style.setProperty('--epg-title-font-size', `${size}px`);
    if (window.storage) {
      await window.storage.updateSettings({ epgTitleFontSize: size });
    }
  };

  const handleEpgBodyFontSizeChange = async (size: number) => {
    setEpgBodyFontSize(size);
    document.documentElement.style.setProperty('--epg-body-font-size', `${size}px`);
    if (window.storage) {
      await window.storage.updateSettings({ epgBodyFontSize: size });
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

  const handleChannelInfoOverlayFontSizeChange = async (size: number) => {
    setChannelInfoOverlayFontSize(size);
    if (onChannelInfoOverlayFontSizeChange) {
      onChannelInfoOverlayFontSizeChange(size);
    }
    if (window.storage) {
      await window.storage.updateSettings({ channelInfoOverlayFontSize: size });
    }
  };

  const handleChannelInfoOverlayLogoSizeChange = async (size: number) => {
    setChannelInfoOverlayLogoSize(size);
    if (onChannelInfoOverlayLogoSizeChange) {
      onChannelInfoOverlayLogoSizeChange(size);
    }
    if (window.storage) {
      await window.storage.updateSettings({ channelInfoOverlayLogoSize: size });
    }
  };

  const handleChannelInfoOverlayBoxWidthChange = async (width: number) => {
    setChannelInfoOverlayBoxWidth(width);
    if (onChannelInfoOverlayBoxWidthChange) {
      onChannelInfoOverlayBoxWidthChange(width);
    }
    if (window.storage) {
      await window.storage.updateSettings({ channelInfoOverlayBoxWidth: width });
    }
  };

  const handleChannelInfoOverlayOpacityChange = async (opacity: number) => {
    setChannelInfoOverlayOpacity(opacity);
    if (onChannelInfoOverlayOpacityChange) {
      onChannelInfoOverlayOpacityChange(opacity);
    }
    if (window.storage) {
      await window.storage.updateSettings({ channelInfoOverlayOpacity: opacity });
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

  const handleSubtitleSettingsChange = async (partial: Partial<SubtitleSettings>) => {
    const updated = { ...subtitleSettings, ...partial };
    setSubtitleSettings(updated);
    if (window.storage) {
      await window.storage.updateSettings({ subtitleSettings: updated });
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
    channelFontSize?: number;
    categoryFontSize?: number;
    startupWidth?: number;
    startupHeight?: number;
    dontSaveWindowSizeOnClose?: boolean;
  }) => {
    const updated = { ...uiSettings, ...newSettings };
    setUiSettings(updated);
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
          />
        );
      case 'tmdb':
        return (
          <TmdbTab
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
      case 'refresh':
        return (
          <DataRefreshTab
            vodRefreshHours={vodRefreshHours}
            epgRefreshHours={epgRefreshHours}
            epgSyncConcurrency={epgSyncConcurrency}
            onVodRefreshChange={setVodRefreshHours}
            onEpgRefreshChange={setEpgRefreshHours}
            onEpgSyncConcurrencyChange={setEpgSyncConcurrency}
          />
        );
      case 'subtitles':
        return (
          <SubtitlesTab
            settings={subtitleSettings}
            onSettingsChange={handleSubtitleSettingsChange}
          />
        );
      case 'channels':
        return (
          <ChannelsTab
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
            onRememberLastChannelsChange={handleRememberLastChannelsChange}
            onReopenLastOnStartupChange={handleReopenLastOnStartupChange}
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
            miniMediaBarForEpgPreview={miniMediaBarForEpgPreview}
            onMiniMediaBarForEpgPreviewChange={handleMiniMediaBarForEpgPreviewChange}
            epgView={epgView}
            onEpgViewChange={handleEpgViewChange}
            collapseSourceCategoriesOnStartup={collapseSourceCategoriesOnStartup}
            onCollapseSourceCategoriesOnStartupChange={handleCollapseSourceCategoriesOnStartupChange}
            modernUiEnabled={modernUiEnabled}
            onModernUiEnabledChange={handleModernUiEnabledChange}
            epgTitleFontSize={epgTitleFontSize}
            onEpgTitleFontSizeChange={handleEpgTitleFontSizeChange}
            epgBodyFontSize={epgBodyFontSize}
            onEpgBodyFontSizeChange={handleEpgBodyFontSizeChange}
          />
        );
      case 'live-view':
        return (
          <LiveViewTab
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
          />
        );
      case 'about':
        return <AboutTab />;
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

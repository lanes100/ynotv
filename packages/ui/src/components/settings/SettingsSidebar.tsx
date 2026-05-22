import './SettingsSidebar.css';

export type SettingsTabId =
  | 'sources'
  | 'tmdb'
  | 'refresh'
  | 'subtitles'
  | 'security'
  | 'debug'
  | 'shortcuts'
  | 'export-import'
  | 'ui'
  | 'navigation'
  | 'theme'
  | 'startup'
  | 'playback'
  | 'scrobbling'
  | 'cache'
  | 'livetv'
  | 'live-view'
  | 'widgets'
  | 'popout'
  | 'about';

interface SettingsTab {
  id: SettingsTabId;
  label: string;
  icon?: string;
  hidden?: boolean;
}

const SETTINGS_TABS: SettingsTab[] = [
  { id: 'sources', label: 'Sources' },
  { id: 'refresh', label: 'Data Refresh' },
  { id: 'tmdb', label: 'TMDB/RPDB' },
  { id: 'subtitles', label: 'Subtitles' },
  { id: 'livetv', label: 'LiveTV' },
  { id: 'live-view', label: 'Channel Overlay' },
  { id: 'widgets', label: 'Widgets' },
  { id: 'popout', label: 'Popout Player' },
  { id: 'theme', label: 'Theme' },
  { id: 'ui', label: 'UI' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'startup', label: 'Startup' },
  { id: 'playback', label: 'Playback' },
  { id: 'scrobbling', label: 'Trakt' },
  { id: 'cache', label: 'Cache' },
  { id: 'security', label: 'Security' },
  { id: 'debug', label: 'Debug' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'export-import', label: 'Export / Import' },
  { id: 'about', label: 'About' },
];

interface SettingsSidebarProps {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
  hasVodSource: boolean;
}

export function SettingsSidebar({
  activeTab,
  onTabChange,
  hasVodSource,
}: SettingsSidebarProps) {
  return (
    <nav className="settings-sidebar">
      {SETTINGS_TABS.map((tab) => (
        <button
          key={tab.id}
          className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.icon && <span className="icon">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

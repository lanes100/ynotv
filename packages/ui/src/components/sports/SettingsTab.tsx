import React, { useEffect } from 'react';
import { useSportsSettingsStore, getLeaguesByCategory } from '../../stores/sportsSettingsStore';

interface SettingsTabProps {}

export function SettingsTab({}: SettingsTabProps) {
  const { enabledLeagues, toggleLeagueAll, setCategoryAll, resetToDefaults, loaded, loadSettings } = useSportsSettingsStore();
  const leaguesByCategory = getLeaguesByCategory();

  useEffect(() => {
    if (!loaded) {
      loadSettings();
    }
  }, [loaded, loadSettings]);

  const categoryOrder = ['football', 'basketball', 'baseball', 'hockey', 'soccer', 'mma', 'golf', 'tennis', 'racing', 'rugby', 'rugby-league'];
  const categoryLabels: Record<string, string> = {
    football: 'Football',
    basketball: 'Basketball',
    baseball: 'Baseball',
    hockey: 'Hockey',
    soccer: 'Soccer',
    mma: 'MMA',
    golf: 'Golf',
    tennis: 'Tennis',
    racing: 'Racing',
    rugby: 'Rugby Union',
    'rugby-league': 'Rugby League',
  };

  const isAllInCategory = (category: string) => {
    const leagues = leaguesByCategory[category];
    if (!leagues || leagues.length === 0) return false;
    return leagues.every(l => enabledLeagues.includes(l.id));
  };

  return (
    <div className="sports-tab-content">
      <div className="sports-settings-header">
        <div>
          <h2 className="sports-settings-title" style={{ fontSize: '1.4rem', fontWeight: 750, color: 'var(--text-primary, #ffffff)' }}>
            Configure Active Leagues
          </h2>
          <p className="sports-settings-subtitle">Enabled leagues will appear across scores, upcoming games, news, and the leagues tab.</p>
        </div>
        <button className="sports-settings-reset" onClick={resetToDefaults}>
          Reset to Defaults
        </button>
      </div>

      <div className="sports-settings-grid">
        {categoryOrder.map(category => {
          const leagues = leaguesByCategory[category];
          if (!leagues || leagues.length === 0) return null;

          const isAllEnabled = isAllInCategory(category);

          return (
            <div key={category} className="sports-settings-card">
              <div className="sports-settings-card-header">
                <span className="sports-settings-category-title">{categoryLabels[category]}</span>
                <label className="sports-settings-toggle">
                  <input
                    type="checkbox"
                    checked={isAllEnabled}
                    onChange={(e) => setCategoryAll(category, e.target.checked)}
                  />
                  <span className="sports-settings-toggle-slider"></span>
                  <span className="sports-settings-toggle-label">All</span>
                </label>
              </div>

              <div className="sports-settings-leagues-list">
                {leagues.map(league => {
                  const isEnabled = enabledLeagues.includes(league.id);
                  return (
                    <div key={league.id} className="sports-settings-league-item">
                      <span className="sports-settings-league-name">{league.name}</span>
                      <label className="sports-settings-toggle">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => toggleLeagueAll(league.id)}
                        />
                        <span className="sports-settings-toggle-slider"></span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SettingsTab;

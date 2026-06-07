import React, { useEffect } from 'react';
import { useSportsSettingsStore, getLeaguesByCategory, type LeagueConfig } from '../../stores/sportsSettingsStore';

interface SettingsTabProps {}

export function SettingsTab({}: SettingsTabProps) {
  const { liveLeagues, upcomingLeagues, newsLeagues, toggleLeague, toggleLeagueAll, setCategorySection, setCategoryAll, resetToDefaults, loaded, loadSettings } = useSportsSettingsStore();
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

  const isLeagueInAll = (leagueId: string) =>
    liveLeagues.includes(leagueId) && upcomingLeagues.includes(leagueId) && newsLeagues.includes(leagueId);

  const isAllInCategory = (category: string, section: 'live' | 'upcoming' | 'news') => {
    const leagues = leaguesByCategory[category];
    if (!leagues || leagues.length === 0) return false;
    const selected = section === 'live' ? liveLeagues : section === 'upcoming' ? upcomingLeagues : newsLeagues;
    return leagues.every(l => selected.includes(l.id));
  };

  const isAllInCategoryAll = (category: string) => {
    const leagues = leaguesByCategory[category];
    if (!leagues || leagues.length === 0) return false;
    return leagues.every(l => liveLeagues.includes(l.id) && upcomingLeagues.includes(l.id) && newsLeagues.includes(l.id));
  };

  const rows: React.JSX.Element[] = [];

  categoryOrder.forEach(category => {
    const leagues = leaguesByCategory[category];
    if (!leagues || leagues.length === 0) return;

    rows.push(
      <tr key={`cat-${category}`} className="category-row">
        <td colSpan={5} className="category-cell">
          <div className="category-header">
            <span className="category-label">{categoryLabels[category]}</span>
            <div className="category-actions">
              <label className="cat-checkbox" title="All sections">
                <input
                  type="checkbox"
                  checked={isAllInCategoryAll(category)}
                  onChange={(e) => setCategoryAll(category, e.target.checked)}
                />
                <span>All</span>
              </label>
              <label className="cat-checkbox live" title="Live Now">
                <input
                  type="checkbox"
                  checked={isAllInCategory(category, 'live')}
                  onChange={(e) => setCategorySection('live', category, e.target.checked)}
                />
                <span>Live</span>
              </label>
              <label className="cat-checkbox upcoming" title="Upcoming">
                <input
                  type="checkbox"
                  checked={isAllInCategory(category, 'upcoming')}
                  onChange={(e) => setCategorySection('upcoming', category, e.target.checked)}
                />
                <span>Upcoming</span>
              </label>
              <label className="cat-checkbox news" title="News">
                <input
                  type="checkbox"
                  checked={isAllInCategory(category, 'news')}
                  onChange={(e) => setCategorySection('news', category, e.target.checked)}
                />
                <span>News</span>
              </label>
            </div>
          </div>
        </td>
      </tr>
    );

    leagues.forEach(league => {
      rows.push(
        <tr key={league.id} className="league-row">
          <td className="col-league">
            <span className="league-name">{league.name}</span>
          </td>
          <td className="col-select-all">
            <input
              type="checkbox"
              checked={isLeagueInAll(league.id)}
              onChange={() => toggleLeagueAll(league.id)}
              className="settings-checkbox"
            />
          </td>
          <td className="col-live">
            <input
              type="checkbox"
              checked={liveLeagues.includes(league.id)}
              onChange={() => toggleLeague('live', league.id)}
              className="settings-checkbox"
            />
          </td>
          <td className="col-upcoming">
            <input
              type="checkbox"
              checked={upcomingLeagues.includes(league.id)}
              onChange={() => toggleLeague('upcoming', league.id)}
              className="settings-checkbox"
            />
          </td>
          <td className="col-news">
            <input
              type="checkbox"
              checked={newsLeagues.includes(league.id)}
              onChange={() => toggleLeague('news', league.id)}
              className="settings-checkbox"
            />
          </td>
        </tr>
      );
    });
  });

  return (
    <div className="sports-tab-content">
      <div className="sports-settings-header">
        <h2 className="sports-settings-title">Configure which leagues appear in each section</h2>
        <button className="sports-settings-reset" onClick={resetToDefaults}>
          Reset to Defaults
        </button>
      </div>

      <div className="sports-settings-table-wrapper">
        <table className="sports-settings-table">
          <thead>
            <tr>
              <th className="col-league">League</th>
              <th className="col-select-all">Select All</th>
              <th className="col-live">Live Now</th>
              <th className="col-upcoming">Upcoming</th>
              <th className="col-news">News</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}

export default SettingsTab;

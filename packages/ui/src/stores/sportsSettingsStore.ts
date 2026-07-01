import { create } from 'zustand';
import { db } from '../db';

export interface LeagueConfig {
  id: string;
  name: string;
  sport: string;
  category: string;
}

export const ALL_LEAGUES: LeagueConfig[] = [
  { id: 'nfl', name: 'NFL', sport: 'football', category: 'football' },
  { id: 'college-football', name: 'NCAAF', sport: 'football', category: 'football' },
  
  { id: 'nba', name: 'NBA', sport: 'basketball', category: 'basketball' },
  { id: 'mens-college-basketball', name: 'NCAAM', sport: 'basketball', category: 'basketball' },
  { id: 'womens-college-basketball', name: 'NCAAW', sport: 'basketball', category: 'basketball' },
  { id: 'wnba', name: 'WNBA', sport: 'basketball', category: 'basketball' },
  
  { id: 'mlb', name: 'MLB', sport: 'baseball', category: 'baseball' },
  
  { id: 'nhl', name: 'NHL', sport: 'hockey', category: 'hockey' },
  
  { id: 'soccer-fifa.world', name: 'FIFA World Cup', sport: 'soccer', category: 'soccer' },
  { id: 'soccer-eng.1', name: 'Premier League', sport: 'soccer', category: 'soccer' },
  { id: 'soccer-eng.2', name: 'Championship', sport: 'soccer', category: 'soccer' },
  { id: 'soccer-esp.1', name: 'La Liga', sport: 'soccer', category: 'soccer' },
  { id: 'soccer-ger.1', name: 'Bundesliga', sport: 'soccer', category: 'soccer' },
  { id: 'soccer-ita.1', name: 'Serie A', sport: 'soccer', category: 'soccer' },
  { id: 'soccer-fra.1', name: 'Ligue 1', sport: 'soccer', category: 'soccer' },
  { id: 'soccer-usa.1', name: 'MLS', sport: 'soccer', category: 'soccer' },
  { id: 'soccer-usa.nwsl', name: 'NWSL', sport: 'soccer', category: 'soccer' },
  { id: 'soccer-usa.nwsl.cup', name: 'NWSL Challenge Cup', sport: 'soccer', category: 'soccer' },
  { id: 'soccer-uefa.champions', name: 'Champions League', sport: 'soccer', category: 'soccer' },
  { id: 'soccer-uefa.europa', name: 'Europa League', sport: 'soccer', category: 'soccer' },
  { id: 'soccer-mex.1', name: 'Liga MX', sport: 'soccer', category: 'soccer' },
  { id: 'soccer-ned.1', name: 'Eredivisie', sport: 'soccer', category: 'soccer' },
  { id: 'soccer-por.1', name: 'Primeira Liga', sport: 'soccer', category: 'soccer' },
  
  { id: 'ufc', name: 'UFC', sport: 'mma', category: 'mma' },
  
  { id: 'pga', name: 'PGA Tour', sport: 'golf', category: 'golf' },
  { id: 'lpga', name: 'LPGA', sport: 'golf', category: 'golf' },
  
  { id: 'atp', name: 'ATP Tour', sport: 'tennis', category: 'tennis' },
  { id: 'wta', name: 'WTA Tour', sport: 'tennis', category: 'tennis' },
  
  { id: 'f1', name: 'Formula 1', sport: 'racing', category: 'racing' },
  { id: 'nascar', name: 'NASCAR Cup', sport: 'racing', category: 'racing' },
  { id: 'indycar', name: 'IndyCar', sport: 'racing', category: 'racing' },

  { id: 'rugby-180659', name: 'Six Nations', sport: 'rugby', category: 'rugby' },
  { id: 'rugby-164205', name: 'Rugby World Cup', sport: 'rugby', category: 'rugby' },
  { id: 'rugby-267979', name: 'Premiership', sport: 'rugby', category: 'rugby' },
  { id: 'rugby-242041', name: 'Super Rugby', sport: 'rugby', category: 'rugby' },
  { id: 'rugby-270559', name: 'Top 14', sport: 'rugby', category: 'rugby' },

  { id: 'rugby-league-3', name: 'NRL', sport: 'rugby-league', category: 'rugby-league' },
];

export const DEFAULT_ENABLED_LEAGUES = [
  'nfl',
  'nba',
  'mlb',
  'nhl',
  'soccer-fifa.world',
  'ufc',
];

interface SportsSettingsState {
  liveLeagues: string[];
  upcomingLeagues: string[];
  newsLeagues: string[];
  enabledLeagues: string[];
  loaded: boolean;
  loadSettings: () => Promise<void>;
  setLiveLeagues: (leagues: string[]) => Promise<void>;
  setUpcomingLeagues: (leagues: string[]) => Promise<void>;
  setNewsLeagues: (leagues: string[]) => Promise<void>;
  toggleLeague: (section: 'live' | 'upcoming' | 'news', leagueId: string) => Promise<void>;
  toggleLeagueAll: (leagueId: string) => Promise<void>;
  setCategorySection: (section: 'live' | 'upcoming' | 'news', category: string, checked: boolean) => Promise<void>;
  setCategoryAll: (category: string, checked: boolean) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export const useSportsSettingsStore = create<SportsSettingsState>()((set, get) => ({
  liveLeagues: DEFAULT_ENABLED_LEAGUES,
  upcomingLeagues: DEFAULT_ENABLED_LEAGUES,
  newsLeagues: DEFAULT_ENABLED_LEAGUES,
  enabledLeagues: DEFAULT_ENABLED_LEAGUES,
  loaded: false,

  loadSettings: async () => {
    try {
      let enabledList: string[] = [];
      const enabledPref = await db.prefs.get('sports_enabled_leagues');

      if (enabledPref?.value) {
        enabledList = JSON.parse(enabledPref.value);
      } else {
        // Migration path from legacy preferences
        const [livePref, upcomingPref, newsPref] = await Promise.all([
          db.prefs.get('sports_live_leagues'),
          db.prefs.get('sports_upcoming_leagues'),
          db.prefs.get('sports_news_leagues'),
        ]);

        if (livePref?.value || upcomingPref?.value || newsPref?.value) {
          const live = livePref?.value ? JSON.parse(livePref.value) : [];
          const upcoming = upcomingPref?.value ? JSON.parse(upcomingPref.value) : [];
          const news = newsPref?.value ? JSON.parse(newsPref.value) : [];
          enabledList = [...new Set([...live, ...upcoming, ...news])];
        } else {
          enabledList = DEFAULT_ENABLED_LEAGUES;
        }

        await db.prefs.put({ key: 'sports_enabled_leagues', value: JSON.stringify(enabledList) });
      }

      set({
        enabledLeagues: enabledList,
        liveLeagues: enabledList,
        upcomingLeagues: enabledList,
        newsLeagues: enabledList,
        loaded: true,
      });
    } catch (err) {
      console.error('[SportsSettings] Failed to load settings:', err);
      set({ loaded: true });
    }
  },

  setLiveLeagues: async (leagues: string[]) => {
    set({ enabledLeagues: leagues, liveLeagues: leagues, upcomingLeagues: leagues, newsLeagues: leagues });
    await db.prefs.put({ key: 'sports_enabled_leagues', value: JSON.stringify(leagues) });
  },

  setUpcomingLeagues: async (leagues: string[]) => {
    set({ enabledLeagues: leagues, liveLeagues: leagues, upcomingLeagues: leagues, newsLeagues: leagues });
    await db.prefs.put({ key: 'sports_enabled_leagues', value: JSON.stringify(leagues) });
  },

  setNewsLeagues: async (leagues: string[]) => {
    set({ enabledLeagues: leagues, liveLeagues: leagues, upcomingLeagues: leagues, newsLeagues: leagues });
    await db.prefs.put({ key: 'sports_enabled_leagues', value: JSON.stringify(leagues) });
  },

  toggleLeague: async (section: 'live' | 'upcoming' | 'news', leagueId: string) => {
    const { toggleLeagueAll } = get();
    await toggleLeagueAll(leagueId);
  },

  toggleLeagueAll: async (leagueId: string) => {
    const state = get();
    const updated = state.enabledLeagues.includes(leagueId)
      ? state.enabledLeagues.filter(id => id !== leagueId)
      : [...state.enabledLeagues, leagueId];

    set({
      enabledLeagues: updated,
      liveLeagues: updated,
      upcomingLeagues: updated,
      newsLeagues: updated,
    });

    await db.prefs.put({ key: 'sports_enabled_leagues', value: JSON.stringify(updated) });
  },

  setCategorySection: async (section: 'live' | 'upcoming' | 'news', category: string, checked: boolean) => {
    const { setCategoryAll } = get();
    await setCategoryAll(category, checked);
  },

  setCategoryAll: async (category: string, checked: boolean) => {
    const state = get();
    const leagues = getLeaguesByCategory()[category] || [];
    const leagueIds = leagues.map(l => l.id);

    const current = state.enabledLeagues;
    const updated = checked
      ? [...new Set([...current, ...leagueIds])]
      : current.filter(id => !leagueIds.includes(id));

    set({
      enabledLeagues: updated,
      liveLeagues: updated,
      upcomingLeagues: updated,
      newsLeagues: updated,
    });

    await db.prefs.put({ key: 'sports_enabled_leagues', value: JSON.stringify(updated) });
  },

  resetToDefaults: async () => {
    set({
      enabledLeagues: DEFAULT_ENABLED_LEAGUES,
      liveLeagues: DEFAULT_ENABLED_LEAGUES,
      upcomingLeagues: DEFAULT_ENABLED_LEAGUES,
      newsLeagues: DEFAULT_ENABLED_LEAGUES,
    });

    await db.prefs.put({ key: 'sports_enabled_leagues', value: JSON.stringify(DEFAULT_ENABLED_LEAGUES) });
  },
}));

export function getAllLeagues(): LeagueConfig[] {
  return ALL_LEAGUES;
}

export function getLeaguesByCategory(): Record<string, LeagueConfig[]> {
  return ALL_LEAGUES.reduce((acc, league) => {
    if (!acc[league.category]) acc[league.category] = [];
    acc[league.category].push(league);
    return acc;
  }, {} as Record<string, LeagueConfig[]>);
}

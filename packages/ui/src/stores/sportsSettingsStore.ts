import { create } from 'zustand';
import { db } from '../db';
// Import from sports config to ensure consistency across the app
import { DEFAULT_LIVE_LEAGUES } from '../services/sports/config';

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

// Note: DEFAULT_LIVE_LEAGUES is imported from '../services/sports/config'
// These are local defaults for other sections:
export const DEFAULT_UPCOMING_LEAGUES = ['soccer-fifa.world', 'nfl', 'college-football', 'nba', 'mens-college-basketball', 'mlb', 'nhl', 'soccer-eng.1', 'soccer-esp.1', 'soccer-ger.1', 'soccer-ita.1', 'soccer-uefa.champions', 'soccer-usa.1', 'ufc', 'f1', 'rugby-180659', 'rugby-164205', 'rugby-267979', 'rugby-242041', 'rugby-270559', 'rugby-league-3'];
export const DEFAULT_NEWS_LEAGUES = ['soccer-fifa.world', 'nfl', 'nba', 'mlb', 'nhl', 'soccer-eng.1'];

interface SportsSettingsState {
  liveLeagues: string[];
  upcomingLeagues: string[];
  newsLeagues: string[];
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
  liveLeagues: DEFAULT_LIVE_LEAGUES,
  upcomingLeagues: DEFAULT_UPCOMING_LEAGUES,
  newsLeagues: DEFAULT_NEWS_LEAGUES,
  loaded: false,

  loadSettings: async () => {
    try {
      const [livePref, upcomingPref, newsPref] = await Promise.all([
        db.prefs.get('sports_live_leagues'),
        db.prefs.get('sports_upcoming_leagues'),
        db.prefs.get('sports_news_leagues'),
      ]);

      set({
        liveLeagues: livePref?.value ? JSON.parse(livePref.value) : DEFAULT_LIVE_LEAGUES,
        upcomingLeagues: upcomingPref?.value ? JSON.parse(upcomingPref.value) : DEFAULT_UPCOMING_LEAGUES,
        newsLeagues: newsPref?.value ? JSON.parse(newsPref.value) : DEFAULT_NEWS_LEAGUES,
        loaded: true,
      });
    } catch (err) {
      console.error('[SportsSettings] Failed to load:', err);
      set({ loaded: true });
    }
  },

  setLiveLeagues: async (leagues: string[]) => {
    set({ liveLeagues: leagues });
    await db.prefs.put({ key: 'sports_live_leagues', value: JSON.stringify(leagues) });
  },

  setUpcomingLeagues: async (leagues: string[]) => {
    set({ upcomingLeagues: leagues });
    await db.prefs.put({ key: 'sports_upcoming_leagues', value: JSON.stringify(leagues) });
  },

  setNewsLeagues: async (leagues: string[]) => {
    set({ newsLeagues: leagues });
    await db.prefs.put({ key: 'sports_news_leagues', value: JSON.stringify(leagues) });
  },

  toggleLeague: async (section: 'live' | 'upcoming' | 'news', leagueId: string) => {
    const state = get();
    const key = section === 'live' ? 'liveLeagues' : section === 'upcoming' ? 'upcomingLeagues' : 'newsLeagues';
    const current = state[key];
    const prefKey = section === 'live' ? 'sports_live_leagues' : section === 'upcoming' ? 'sports_upcoming_leagues' : 'sports_news_leagues';
    
    const updated = current.includes(leagueId)
      ? current.filter(id => id !== leagueId)
      : [...current, leagueId];
    
    set({ [key]: updated });
    await db.prefs.put({ key: prefKey, value: JSON.stringify(updated) });
  },

  toggleLeagueAll: async (leagueId: string) => {
    const state = get();
    const inAll = state.liveLeagues.includes(leagueId) &&
                  state.upcomingLeagues.includes(leagueId) &&
                  state.newsLeagues.includes(leagueId);

    if (inAll) {
      const newLive = state.liveLeagues.filter(id => id !== leagueId);
      const newUpcoming = state.upcomingLeagues.filter(id => id !== leagueId);
      const newNews = state.newsLeagues.filter(id => id !== leagueId);
      set({ liveLeagues: newLive, upcomingLeagues: newUpcoming, newsLeagues: newNews });
      await Promise.all([
        db.prefs.put({ key: 'sports_live_leagues', value: JSON.stringify(newLive) }),
        db.prefs.put({ key: 'sports_upcoming_leagues', value: JSON.stringify(newUpcoming) }),
        db.prefs.put({ key: 'sports_news_leagues', value: JSON.stringify(newNews) }),
      ]);
    } else {
      const newLive = state.liveLeagues.includes(leagueId) ? state.liveLeagues : [...state.liveLeagues, leagueId];
      const newUpcoming = state.upcomingLeagues.includes(leagueId) ? state.upcomingLeagues : [...state.upcomingLeagues, leagueId];
      const newNews = state.newsLeagues.includes(leagueId) ? state.newsLeagues : [...state.newsLeagues, leagueId];
      set({ liveLeagues: newLive, upcomingLeagues: newUpcoming, newsLeagues: newNews });
      await Promise.all([
        db.prefs.put({ key: 'sports_live_leagues', value: JSON.stringify(newLive) }),
        db.prefs.put({ key: 'sports_upcoming_leagues', value: JSON.stringify(newUpcoming) }),
        db.prefs.put({ key: 'sports_news_leagues', value: JSON.stringify(newNews) }),
      ]);
    }
  },

  setCategorySection: async (section: 'live' | 'upcoming' | 'news', category: string, checked: boolean) => {
    const state = get();
    const leagues = getLeaguesByCategory()[category] || [];
    const leagueIds = leagues.map(l => l.id);
    const key = section === 'live' ? 'liveLeagues' : section === 'upcoming' ? 'upcomingLeagues' : 'newsLeagues';
    const prefKey = section === 'live' ? 'sports_live_leagues' : section === 'upcoming' ? 'sports_upcoming_leagues' : 'sports_news_leagues';

    const current = state[key];
    const updated = checked
      ? [...new Set([...current, ...leagueIds])]
      : current.filter(id => !leagueIds.includes(id));

    set({ [key]: updated });
    await db.prefs.put({ key: prefKey, value: JSON.stringify(updated) });
  },

  setCategoryAll: async (category: string, checked: boolean) => {
    const { setCategorySection } = get();
    await Promise.all([
      setCategorySection('live', category, checked),
      setCategorySection('upcoming', category, checked),
      setCategorySection('news', category, checked),
    ]);
  },

  resetToDefaults: async () => {
    set({
      liveLeagues: DEFAULT_LIVE_LEAGUES,
      upcomingLeagues: DEFAULT_UPCOMING_LEAGUES,
      newsLeagues: DEFAULT_NEWS_LEAGUES,
    });
    
    await Promise.all([
      db.prefs.put({ key: 'sports_live_leagues', value: JSON.stringify(DEFAULT_LIVE_LEAGUES) }),
      db.prefs.put({ key: 'sports_upcoming_leagues', value: JSON.stringify(DEFAULT_UPCOMING_LEAGUES) }),
      db.prefs.put({ key: 'sports_news_leagues', value: JSON.stringify(DEFAULT_NEWS_LEAGUES) }),
    ]);
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

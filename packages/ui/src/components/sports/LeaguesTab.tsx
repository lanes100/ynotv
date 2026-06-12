import { useState, useEffect, useCallback } from 'react';
import type { SportsEvent, SportsLeague, SportsTeam } from '@ynotv/core';
import {
  getAvailableLeagues,
  getLeagueEvents,
  getLeagueTeams,
  getLeagueStandings,
  getLeagueStandingsGrouped,
  getGolfRankings,
  getTennisRankings,
  getRacingStandings,
  type StandingTeam,
  type StandingGroup,
  type GolfRanking,
  type TennisRanking,
  type RacingStanding,
  formatEventTime,
} from '../../services/sports';
import { TeamDetail } from './TeamDetail';
import { GameDetail } from './GameDetail';
import { useSportsSettingsStore } from '../../stores/sportsSettingsStore';

interface LeaguesTabProps {
  onSearchChannels?: (channelName: string) => void;
  onPlayChannel?: (channel: import('../../db').StoredChannel) => void;
}

type LeagueView = 'teams' | 'schedule' | 'standings';

// Sports that are individual (no teams)
const INDIVIDUAL_SPORTS = ['ufc', 'pga', 'lpga', 'atp', 'wta', 'f1', 'nascar', 'indycar'];

const SPORT_DISPLAY_NAMES: Record<string, string> = {
  football: 'Football',
  basketball: 'Basketball',
  baseball: 'Baseball',
  hockey: 'Hockey',
  soccer: 'Soccer',
  mma: 'MMA & Combat',
  golf: 'Golf',
  tennis: 'Tennis',
  racing: 'Racing',
  rugby: 'Rugby Union',
  'rugby-league': 'Rugby League',
};

const SPORT_GRADIENTS: Record<string, string> = {
  football: 'linear-gradient(135deg, #1b4d3e, #0f2a20)',
  basketball: 'linear-gradient(135deg, #ff8c00, #d35400)',
  baseball: 'linear-gradient(135deg, #f43f5e, #be123c)',
  hockey: 'linear-gradient(135deg, #38bdf8, #0369a1)',
  soccer: 'linear-gradient(135deg, #4ade80, #15803d)',
  mma: 'linear-gradient(135deg, #ef4444, #991b1b)',
  golf: 'linear-gradient(135deg, #10b981, #065f46)',
  tennis: 'linear-gradient(135deg, #a3e635, #4d7c0f)',
  racing: 'linear-gradient(135deg, #4b5563, #111827)',
  rugby: 'linear-gradient(135deg, #ea580c, #7c2d12)',
  'rugby-league': 'linear-gradient(135deg, #f97316, #9a3412)',
};

const getSportDisplayName = (sport: string) => {
  return SPORT_DISPLAY_NAMES[sport] || (sport.charAt(0).toUpperCase() + sport.slice(1));
};

const getSportGradient = (sport: string) => {
  return SPORT_GRADIENTS[sport] || 'linear-gradient(135deg, #818cf8, #3730a3)';
};

function SportIcon({ sport, size = 20 }: { sport: string; size?: number }) {
  switch (sport.toLowerCase()) {
    case 'football':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22V14" />
          <path d="M5 14h14" />
          <path d="M5 14V4" />
          <path d="M19 14V4" />
        </svg>
      );
    case 'basketball':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2v20" />
          <path d="M5 5c3.5 3.5 3.5 10.5 0 14M19 5c-3.5 3.5-3.5 10.5 0 14" />
        </svg>
      );
    case 'baseball':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M6 18c2-3 2-9 0-12M18 18c-2-3-2-9 0-12" />
        </svg>
      );
    case 'hockey':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 4L6.5 17.5L4 16.5M6 4l11.5 13.5L20 16.5" />
          <ellipse cx="12" cy="18.5" rx="3" ry="1.5" fill="currentColor" />
        </svg>
      );
    case 'soccer':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="12,8 15.5,10.5 14,14.5 10,14.5 8.5,10.5" fill="currentColor" />
          <line x1="12" y1="8" x2="12" y2="2" />
          <line x1="15.5" y1="10.5" x2="21.5" y2="8.5" />
          <line x1="14" y1="14.5" x2="18" y2="20" />
          <line x1="10" y1="14.5" x2="6" y2="20" />
          <line x1="8.5" y1="10.5" x2="2.5" y2="8.5" />
        </svg>
      );
    case 'mma':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="8,3 16,3 21,8 21,16 16,21 8,21 3,16 3,8" />
          <path d="M3 8l18 8M3 16l18-8M8 3l8 18M16 3L8 21" strokeOpacity="0.3" />
          <circle cx="12" cy="12" r="3.5" fill="currentColor" />
        </svg>
      );
    case 'golf':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="3" x2="8" y2="19" />
          <path d="M8 19c-1 0-2 .5-2 1.5s1.5 1.5 2.5 1.5 1.5-1 1.5-2-.5-1-2-1z" fill="currentColor" />
          <circle cx="15" cy="19" r="1.5" fill="currentColor" />
          <path d="M5 3v10M5 3l5 2.5L5 8" fill="none" />
        </svg>
      );
    case 'tennis':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="7" r="2.5" fill="currentColor" />
          <path d="M6 18l5-5M6 18a3 3 0 1 1-4.24-4.24A3 3 0 0 1 6 18z" />
          <path d="M18 18l-5-5M18 18a3 3 0 1 0 4.24-4.24A3 3 0 0 0 18 18z" />
          <path d="M9 15l6-6" />
        </svg>
      );
    case 'racing':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 22V3" />
          <path d="M4 5c3-1.5 5 1.5 8 0s5-1.5 8 0v8c-3-1.5-5 1.5-8 0s-5-1.5-8 0z" />
          <rect x="4" y="5" width="4" height="4" fill="currentColor" stroke="none" />
          <rect x="12" y="5" width="4" height="4" fill="currentColor" stroke="none" />
          <rect x="8" y="9" width="4" height="4" fill="currentColor" stroke="none" />
          <rect x="16" y="9" width="4" height="4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'rugby':
    case 'rugby-league':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="12" rx="10" ry="7" transform="rotate(-30 12 12)" />
          <path d="M3.5 17c5-3 12-3 17 0" transform="rotate(-30 12 12)" />
          <path d="M3.5 7c5 3 12 3 17 0" transform="rotate(-30 12 12)" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M6 4h12v8c0 3-2.5 5.5-6 5.5S6 15 6 12V4z" />
          <path d="M12 17.5v3M8 20.5h8" />
        </svg>
      );
  }
}

export function LeaguesTab({ onSearchChannels, onPlayChannel }: LeaguesTabProps) {
  const [leagues, setLeagues] = useState<SportsLeague[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<SportsLeague | null>(null);
  const [leagueEvents, setLeagueEvents] = useState<SportsEvent[]>([]);
  const [leagueTeams, setLeagueTeams] = useState<SportsTeam[]>([]);
  const [leagueStandings, setLeagueStandings] = useState<StandingTeam[]>([]);
  const [leagueStandingsGroups, setLeagueStandingsGroups] = useState<StandingGroup[]>([]);
  const [golfRankings, setGolfRankings] = useState<GolfRanking[]>([]);
  const [tennisRankings, setTennisRankings] = useState<TennisRanking[]>([]);
  const [racingStandings, setRacingStandings] = useState<RacingStanding[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<LeagueView>('teams');
  const [selectedTeam, setSelectedTeam] = useState<SportsTeam | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SportsEvent | null>(null);
  const [activeSport, setActiveSport] = useState<string>('');

  const isUFC = selectedLeague?.id === 'ufc';
  const isGolf = selectedLeague?.id === 'pga' || selectedLeague?.id === 'lpga';
  const isTennis = selectedLeague?.id === 'atp' || selectedLeague?.id === 'wta';
  const isRacing = selectedLeague?.id === 'f1' || selectedLeague?.id === 'nascar' || selectedLeague?.id === 'indycar';
  const isIndividualSport = selectedLeague ? INDIVIDUAL_SPORTS.includes(selectedLeague.id) : false;

  const { enabledLeagues, loaded, loadSettings } = useSportsSettingsStore();

  useEffect(() => {
    if (!loaded) {
      loadSettings();
    }
  }, [loaded, loadSettings]);

  useEffect(() => {
    const allLeagues = getAvailableLeagues();
    if (loaded) {
      setLeagues(allLeagues.filter(l => enabledLeagues.includes(l.id)));
    } else {
      setLeagues(allLeagues);
    }
  }, [loaded, enabledLeagues]);

  useEffect(() => {
    if (leagues.length > 0) {
      const grouped = leagues.reduce((acc, league) => {
        const sport = league.sport || 'Other';
        if (!acc[sport]) acc[sport] = [];
        acc[sport].push(league);
        return acc;
      }, {} as Record<string, SportsLeague[]>);

      const sportOrder = ['football', 'basketball', 'baseball', 'hockey', 'soccer'];
      const sortedSports = Object.keys(grouped).sort((a, b) => {
        const aIdx = sportOrder.indexOf(a);
        const bIdx = sportOrder.indexOf(b);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });

      if (sortedSports.length > 0 && (!activeSport || !sortedSports.includes(activeSport))) {
        setActiveSport(sortedSports[0]);
      }
    } else {
      setActiveSport('');
    }
  }, [leagues, activeSport]);

  useEffect(() => {
    if (selectedLeague) {
      setLoading(true);
      // For individual sports, default to schedule (events)
      setActiveView(isIndividualSport ? 'schedule' : 'teams');
      
      if (isIndividualSport) {
        // Load events for individual sports
        getLeagueEvents(selectedLeague.id)
          .then(setLeagueEvents)
          .finally(() => setLoading(false));
      } else {
        getLeagueTeams(selectedLeague.id)
          .then(setLeagueTeams)
          .finally(() => setLoading(false));
      }
    }
  }, [selectedLeague, isIndividualSport]);

  const handleViewChange = useCallback(async (view: LeagueView) => {
    if (!selectedLeague) return;
    
    setActiveView(view);
    setLoading(true);

    try {
        if (view === 'schedule') {
        const events = await getLeagueEvents(selectedLeague.id);
        setLeagueEvents(events);
      } else if (view === 'standings') {
        if (isGolf) {
          // Golf Rankings - World Golf Rankings
          const rankings = await getGolfRankings(selectedLeague.id as 'pga' | 'lpga');
          setGolfRankings(rankings);
        } else if (isTennis) {
          // Tennis Rankings - ATP/WTA
          const rankings = await getTennisRankings(selectedLeague.id as 'atp' | 'wta');
          setTennisRankings(rankings);
        } else if (isRacing) {
          // Racing Standings - Driver standings
          const standings = await getRacingStandings(selectedLeague.id as 'f1' | 'nascar' | 'indycar');
          setRacingStandings(standings);
        } else {
          // Team sports standings
          const groups = await getLeagueStandingsGrouped(selectedLeague.id);
          setLeagueStandingsGroups(groups);
          setLeagueStandings(groups.flatMap(g => g.teams));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedLeague, isIndividualSport, isUFC, isGolf, isTennis, isRacing]);

  const handleChannelClick = (channelName: string) => {
    if (onSearchChannels) {
      onSearchChannels(channelName);
    }
  };

  const handleClose = () => {
    setSelectedLeague(null);
    setLeagueTeams([]);
    setLeagueEvents([]);
    setLeagueStandings([]);
    setLeagueStandingsGroups([]);
    setGolfRankings([]);
    setTennisRankings([]);
    setRacingStandings([]);
  };

  if (selectedTeam) {
    return (
      <TeamDetail
        team={selectedTeam}
        onClose={() => setSelectedTeam(null)}
        onChannelClick={handleChannelClick}
      />
    );
  }

  if (selectedEvent) {
    return (
      <>
        <LeagueDetail
          league={selectedLeague!}
          teams={leagueTeams}
          events={leagueEvents}
          standings={leagueStandings}
          standingsGroups={leagueStandingsGroups}
          golfRankings={golfRankings}
          tennisRankings={tennisRankings}
          racingStandings={racingStandings}
          loading={loading}
          activeView={activeView}
          onViewChange={handleViewChange}
          onClose={handleClose}
          onTeamSelect={setSelectedTeam}
          onChannelClick={handleChannelClick}
          onEventSelect={setSelectedEvent}
          onPlayChannel={onPlayChannel}
        />
        <GameDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onChannelClick={handleChannelClick}
          onPlayChannel={onPlayChannel}
        />
      </>
    );
  }

  if (selectedLeague) {
    return (
      <LeagueDetail
        league={selectedLeague}
        teams={leagueTeams}
        events={leagueEvents}
        standings={leagueStandings}
        standingsGroups={leagueStandingsGroups}
        golfRankings={golfRankings}
        tennisRankings={tennisRankings}
        racingStandings={racingStandings}
        loading={loading}
        activeView={activeView}
        onViewChange={handleViewChange}
        onClose={handleClose}
        onTeamSelect={setSelectedTeam}
        onChannelClick={handleChannelClick}
        onEventSelect={setSelectedEvent}
      />
    );
  }

  const groupedLeagues = leagues.reduce((acc, league) => {
    const sport = league.sport || 'Other';
    if (!acc[sport]) acc[sport] = [];
    acc[sport].push(league);
    return acc;
  }, {} as Record<string, SportsLeague[]>);

  const sportOrder = ['football', 'basketball', 'baseball', 'hockey', 'soccer'];

  return (
    <div className="sports-leagues-layout">
      {/* Left Sidebar: Sport selection list */}
      <aside className="sports-leagues-sidebar">
        {Object.entries(groupedLeagues)
          .sort(([a], [b]) => {
            const aIdx = sportOrder.indexOf(a);
            const bIdx = sportOrder.indexOf(b);
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
          })
          .map(([sport, sportLeagues]) => {
            const isActive = activeSport === sport;
            return (
              <button
                key={sport}
                className={`sports-leagues-sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveSport(sport)}
              >
                <div 
                  className="sports-leagues-sidebar-icon"
                  style={{ background: getSportGradient(sport) }}
                >
                  <SportIcon sport={sport} size={18} />
                </div>
                <span className="sports-leagues-sidebar-name">
                  {getSportDisplayName(sport)}
                </span>
                <span className="sports-leagues-sidebar-badge">
                  {sportLeagues.length}
                </span>
              </button>
            );
          })}
      </aside>

      {/* Right Content Pane: Leagues listing for selected sport */}
      <main className="sports-leagues-content">
        <div className="sports-leagues-content-header">
          <div 
            className="sports-leagues-content-icon"
            style={{ background: getSportGradient(activeSport) }}
          >
            <SportIcon sport={activeSport} size={24} />
          </div>
          <div>
            <h2 className="sports-leagues-content-title">
              {getSportDisplayName(activeSport)} Leagues
            </h2>
            <p className="sports-leagues-content-subtitle">
              Select a league to view teams, schedule, and standings
            </p>
          </div>
        </div>

        <div className="sports-leagues-grid-layout">
          {(groupedLeagues[activeSport] || []).map((league) => (
            <button
              key={league.id}
              className="sports-leagues-item-btn"
              onClick={() => setSelectedLeague(league)}
            >
              <div className="sports-leagues-item-info">
                <span className="sports-leagues-name">{league.name}</span>
                <span className="sports-leagues-sub">{league.sport.toUpperCase()}</span>
              </div>
              <svg className="sports-leagues-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

interface LeagueDetailProps {
  league: SportsLeague;
  teams: SportsTeam[];
  events: SportsEvent[];
  standings: StandingTeam[];
  standingsGroups: StandingGroup[];
  golfRankings: GolfRanking[];
  tennisRankings: TennisRanking[];
  racingStandings: RacingStanding[];
  loading: boolean;
  activeView: LeagueView;
  onViewChange: (view: LeagueView) => void;
  onClose: () => void;
  onTeamSelect: (team: SportsTeam) => void;
  onChannelClick?: (channelName: string) => void;
  onEventSelect?: (event: SportsEvent) => void;
  onPlayChannel?: (channel: import('../../db').StoredChannel) => void;
}

function LeagueDetail({
  league,
  teams,
  events,
  standings,
  standingsGroups,
  golfRankings,
  tennisRankings,
  racingStandings,
  loading,
  activeView,
  onViewChange,
  onClose,
  onTeamSelect,
  onChannelClick,
  onEventSelect,
  onPlayChannel,
}: LeagueDetailProps) {
  const isUFC = league.id === 'ufc';
  const isGolf = league.id === 'pga' || league.id === 'lpga';
  const isTennis = league.id === 'atp' || league.id === 'wta';
  const isRacing = league.id === 'f1' || league.id === 'nascar' || league.id === 'indycar';
  const isIndividualSport = INDIVIDUAL_SPORTS.includes(league.id);

  return (
    <div className="sports-tab-content">
      <div className="sports-league-header">
        <button className="sports-back-link" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Leagues
        </button>
        <div className="sports-league-info">
          <div>
            <h2 className="sports-league-detail-name">{league.name}</h2>
            <span className="sports-league-detail-sport">{league.sport}</span>
          </div>
        </div>
      </div>

      <div className="sports-league-nav">
        {!isIndividualSport && (
          <button
            className={`sports-league-nav-btn ${activeView === 'teams' ? 'active' : ''}`}
            onClick={() => onViewChange('teams')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Teams
          </button>
        )}
        <button
          className={`sports-league-nav-btn ${activeView === 'schedule' ? 'active' : ''}`}
          onClick={() => onViewChange('schedule')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {isIndividualSport ? 'Events' : 'Schedule'}
        </button>
        {!isUFC && (
          <button
            className={`sports-league-nav-btn ${activeView === 'standings' ? 'active' : ''}`}
            onClick={() => onViewChange('standings')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            {isIndividualSport ? 'Rankings' : 'Standings'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="sports-loading">
          <div className="sports-spinner" />
          <span>Loading...</span>
        </div>
      ) : (
        <>
          {activeView === 'teams' && (
            <section className="sports-section">
              <h3 className="sports-section-title">All Teams ({teams.length})</h3>
              <div className="sports-teams-grid">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    className="sports-team-card"
                    onClick={() => onTeamSelect(team)}
                  >
                    {team.logo && (
                      <img src={team.logo} alt={team.name} className="sports-team-card-logo" />
                    )}
                    <div className="sports-team-card-info">
                      <span className="sports-team-card-name">{team.name}</span>
                      {team.shortName && (
                        <span className="sports-team-card-country">{team.shortName}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeView === 'schedule' && (
            <section className="sports-section">
              <h3 className="sports-section-title">
                {isIndividualSport ? 'Tournaments & Events' : 'Games'}
              </h3>
              {events.length > 0 ? (
                <div className="sports-events-list">
                  {events.slice(0, 20).map(event => (
                    <LeagueEventRow
                      key={event.id}
                      event={event}
                      isIndividualSport={isIndividualSport}
                      onChannelClick={onChannelClick}
                      onClick={() => onEventSelect?.(event)}
                    />
                  ))}
                </div>
              ) : (
                <div className="sports-empty">
                  <p>No events scheduled</p>
                </div>
              )}
            </section>
          )}

          {activeView === 'standings' && !isIndividualSport && (
            <section className="sports-section">
              <h3 className="sports-section-title">Standings</h3>
              {standingsGroups.length > 0 ? (
                <div className="sports-standings-groups">
                  {standingsGroups.map((group) => (
                    <div key={group.name} className="sports-standings-group">
                      {group.isConference && (
                        <h4 className="sports-standings-conference">{group.name}</h4>
                      )}
                      <div className="sports-standings-table">
                        <div className="sports-standings-header">
                          <span>#</span>
                          <span>Team</span>
                          <span>W</span>
                          <span>L</span>
                          <span>PCT</span>
                        </div>
                        {group.teams.map((team) => (
                          <div key={team.id} className="sports-standings-row">
                            <span>{team.rank}</span>
                            <span className="sports-standings-team">
                              {team.logo && (
                                <img src={team.logo} alt="" className="sports-standings-logo" />
                              )}
                              {team.name}
                            </span>
                            <span>{team.wins}</span>
                            <span>{team.losses}</span>
                            <span>{team.winPercent}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : standings.length > 0 ? (
                <div className="sports-standings-table">
                  <div className="sports-standings-header">
                    <span>#</span>
                    <span>Team</span>
                    <span>W</span>
                    <span>L</span>
                    <span>PCT</span>
                  </div>
                  {standings.map((team, idx) => (
                    <div key={team.id} className="sports-standings-row">
                      <span>{idx + 1}</span>
                      <span className="sports-standings-team">
                        {team.logo && (
                          <img src={team.logo} alt="" className="sports-standings-logo" />
                        )}
                        {team.name}
                      </span>
                      <span>{team.wins}</span>
                      <span>{team.losses}</span>
                      <span>{team.winPercent}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sports-empty">
                  <p>Standings not available</p>
                </div>
              )}
            </section>
          )}

          {activeView === 'standings' && isGolf && (
            <section className="sports-section">
              <h3 className="sports-section-title">World Golf Rankings</h3>
              {golfRankings.length > 0 ? (
                <div className="sports-rankings-table">
                  <div className="sports-rankings-header">
                    <span>Rank</span>
                    <span>Player</span>
                    <span>Points</span>
                    <span>Avg</span>
                    <span>Events</span>
                  </div>
                  {golfRankings.slice(0, 50).map((ranking) => (
                    <div key={ranking.athlete.id} className="sports-rankings-row">
                      <span className="sports-rankings-rank">{ranking.rank}</span>
                      <span className="sports-rankings-athlete">
                        {ranking.athlete.flag && (
                          <img src={ranking.athlete.flag} alt="" className="sports-rankings-flag" />
                        )}
                        {ranking.athlete.name}
                      </span>
                      <span>{ranking.totalPoints.toLocaleString()}</span>
                      <span>{ranking.avgPoints.toFixed(2)}</span>
                      <span>{ranking.numEvents}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sports-empty">
                  <p>Rankings not available</p>
                </div>
              )}
            </section>
          )}

          {activeView === 'standings' && isTennis && (
            <section className="sports-section">
              <h3 className="sports-section-title">{league.name} Rankings</h3>
              {tennisRankings.length > 0 ? (
                <div className="sports-rankings-table">
                  <div className="sports-rankings-header">
                    <span>Rank</span>
                    <span>Player</span>
                    <span>Points</span>
                    <span>Trend</span>
                  </div>
                  {tennisRankings.slice(0, 50).map((ranking) => (
                    <div key={ranking.athlete.id} className="sports-rankings-row">
                      <span className="sports-rankings-rank">{ranking.rank}</span>
                      <span className="sports-rankings-athlete">
                        {ranking.athlete.flag && (
                          <img src={ranking.athlete.flag} alt="" className="sports-rankings-flag" />
                        )}
                        {ranking.athlete.name}
                      </span>
                      <span>{ranking.points.toLocaleString()}</span>
                      <span className={`sports-rankings-trend ${ranking.previousRank && ranking.rank < ranking.previousRank ? 'up' : ranking.previousRank && ranking.rank > ranking.previousRank ? 'down' : 'same'}`}>
                        {ranking.previousRank ? (ranking.rank < ranking.previousRank ? '▲' : ranking.rank > ranking.previousRank ? '▼' : '-') : 'NEW'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sports-empty">
                  <p>Rankings not available</p>
                </div>
              )}
            </section>
          )}

          {activeView === 'standings' && isRacing && (
            <section className="sports-section">
              <h3 className="sports-section-title">Driver Standings</h3>
              {racingStandings.length > 0 ? (
                <div className="sports-rankings-table">
                  <div className="sports-rankings-header">
                    <span>Rank</span>
                    <span>Driver</span>
                    <span>Team</span>
                    <span>Wins</span>
                    <span>Points</span>
                  </div>
                  {racingStandings.map((standing) => (
                    <div key={standing.driver.id} className="sports-rankings-row">
                      <span className="sports-rankings-rank">{standing.rank}</span>
                      <span className="sports-rankings-driver">
                        {standing.driver.headshot && (
                          <img src={standing.driver.headshot} alt="" className="sports-rankings-headshot" />
                        )}
                        {standing.driver.name}
                      </span>
                      <span className="sports-rankings-team">{standing.driver.team}</span>
                      <span>{standing.wins}</span>
                      <span className="sports-rankings-points">{standing.points}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sports-empty">
                  <p>Standings not available</p>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

interface LeagueEventRowProps {
  event: SportsEvent;
  isIndividualSport: boolean;
  onChannelClick?: (channelName: string) => void;
  onClick?: () => void;
}

function LeagueEventRow({ event, isIndividualSport, onChannelClick, onClick }: LeagueEventRowProps) {
  const isLive = event.status === 'live';
  const isFinished = event.status === 'finished';
  
  // For individual sports, show event differently
  if (isIndividualSport) {
    return (
      <div className="sports-event-row" onClick={onClick}>
        <div className="sports-event-row-time">
          <span className="sports-event-date">
            {event.startTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <span className="sports-event-time">
            {event.startTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="sports-event-row-match individual-sport">
          <span className="sports-event-name">{event.title}</span>
          {event.venue && (
            <span className="sports-event-venue">{event.venue}</span>
          )}
        </div>

        <div className="sports-event-row-status">
          {isLive && (
            <span className="sports-event-status-live">Live</span>
          )}
          {isFinished && (
            <span className="sports-event-status-final">Final</span>
          )}
        </div>

        <div className="sports-event-row-channels">
          {event.channels.length > 0 ? (
            <button
              className="sports-channel-btn-small"
              onClick={(e) => {
                e.stopPropagation();
                onChannelClick?.(event.channels[0].name);
              }}
            >
              {event.channels[0].name}
            </button>
          ) : (
            <span className="sports-no-channel">-</span>
          )}
        </div>
      </div>
    );
  }

  // Team sports display
  const homeWinning = (event.homeScore ?? 0) > (event.awayScore ?? 0);
  const awayWinning = (event.awayScore ?? 0) > (event.homeScore ?? 0);

  return (
    <div className="sports-event-row" onClick={onClick}>
      <div className="sports-event-row-time">
        <span className="sports-event-date">
          {event.startTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
        <span className="sports-event-time">
          {event.startTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="sports-event-row-match">
        <div className={`sports-event-team away ${isFinished && awayWinning ? 'winner' : ''}`}>
          {event.awayTeam.logo && (
            <img src={event.awayTeam.logo} alt="" className="sports-team-logo-small" />
          )}
          <span className="sports-event-team-name">{event.awayTeam.shortName || event.awayTeam.name}</span>
          {event.awayScore !== undefined && (
            <span className="sports-score-inline">{event.awayScore}</span>
          )}
        </div>
        <div className="sports-event-row-divider">
          {isLive ? (
            <span className="sports-event-live-badge">
              <span className="sports-event-live-dot" />
              {event.period || event.timeElapsed || 'LIVE'}
            </span>
          ) : (
            <span className="sports-event-vs">vs</span>
          )}
        </div>
        <div className={`sports-event-team home ${isFinished && homeWinning ? 'winner' : ''}`}>
          {event.homeTeam.logo && (
            <img src={event.homeTeam.logo} alt="" className="sports-team-logo-small" />
          )}
          <span className="sports-event-team-name">{event.homeTeam.shortName || event.homeTeam.name}</span>
          {event.homeScore !== undefined && (
            <span className="sports-score-inline">{event.homeScore}</span>
          )}
        </div>
      </div>

      <div className="sports-event-row-status">
        {isLive && (
          <span className="sports-event-status-live">Live</span>
        )}
        {isFinished && (
          <span className="sports-event-status-final">Final</span>
        )}
      </div>

      <div className="sports-event-row-channels">
        {event.channels.length > 0 ? (
          <button
            className="sports-channel-btn-small"
            onClick={(e) => {
              e.stopPropagation();
              onChannelClick?.(event.channels[0].name);
            }}
          >
            {event.channels[0].name}
          </button>
        ) : (
          <span className="sports-no-channel">-</span>
        )}
      </div>
    </div>
  );
}

export default LeaguesTab;

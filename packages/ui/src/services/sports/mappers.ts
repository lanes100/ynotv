/**
 * ESPN Data Mappers
 *
 * Transform ESPN API responses to domain models
 */

import type {
  ESPNEvent,
  ESPTeam,
  SportsEvent,
  SportsTeam,
  SportsLeague,
  SportConfig,
  SportsBroadcastChannel,
} from './types';
import { SPORT_CONFIG } from './config';

/**
 * Build a reliable ESPN CDN logo URL from a team ID and sport key.
 * The scoreboard API often omits logos, but the CDN serves them predictably.
 */
function buildESPNLogoUrl(teamId: string, sportKey: string): string | undefined {
  if (!teamId || teamId === 'TBD' || teamId === 'field' || teamId === 'session' || teamId === 'session2') {
    return undefined;
  }

  // Soccer leagues all share the same logo path
  if (sportKey.startsWith('soccer-')) {
    return `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png`;
  }

  const sportPathMap: Record<string, string> = {
    'nfl': 'nfl',
    'college-football': 'ncaa',
    'nba': 'nba',
    'mens-college-basketball': 'ncaa',
    'womens-college-basketball': 'ncaa',
    'wnba': 'wnba',
    'mlb': 'mlb',
    'nhl': 'nhl',
    'ufc': 'mma',
    'pga': 'golf',
    'lpga': 'golf',
    'atp': 'tennis',
    'wta': 'tennis',
    'f1': 'racing',
    'nascar': 'racing',
    'indycar': 'racing',
  };

  const sportPath = sportPathMap[sportKey];
  if (!sportPath) return undefined;

  return `https://a.espncdn.com/i/teamlogos/${sportPath}/500/${teamId}.png`;
}

function getAthleteInfo(competitor: ESPNEvent['competitions'][0]['competitors'][0] | undefined): SportsTeam {
  if (competitor?.athlete) {
    return {
      id: competitor.athlete.id,
      name: competitor.athlete.displayName || competitor.athlete.fullName || 'Unknown',
      shortName: competitor.athlete.shortName,
      logo: competitor.athlete.headshot?.href,
    };
  }
  return { id: competitor?.id || '', name: 'TBD', shortName: undefined, logo: undefined };
}

function getTeamInfo(competitor: ESPNEvent['competitions'][0]['competitors'][0] | undefined, sportKey: string): SportsTeam {
  if (!competitor) {
    return { id: '', name: 'TBD', shortName: undefined, logo: undefined };
  }

  if (competitor.athlete) {
    return getAthleteInfo(competitor);
  }

  if (competitor.team) {
    const apiLogo = competitor.team.logos?.[0]?.href;
    const fallbackLogo = buildESPNLogoUrl(competitor.team.id, sportKey);
    return {
      id: competitor.team.id,
      name: competitor.team.displayName || 'Unknown',
      shortName: competitor.team.abbreviation,
      logo: apiLogo || fallbackLogo,
    };
  }

  return { id: competitor.id, name: 'Unknown', shortName: undefined, logo: undefined };
}

function getScore(competitor: ESPNEvent['competitions'][0]['competitors'][0] | undefined): number | undefined {
  const score = competitor?.score;
  if (typeof score === 'object' && score?.value !== undefined) {
    return Math.round(score.value);
  }
  if (typeof score === 'string' && score !== '') {
    return parseInt(score, 10) || undefined;
  }
  return undefined;
}

function extractChannels(event: ESPNEvent, competition?: ESPNEvent['competitions'][0]): SportsBroadcastChannel[] {
  const channels: SportsBroadcastChannel[] = [];
  if (competition?.broadcasts) {
    for (const broadcast of competition.broadcasts) {
      for (const name of broadcast.names || []) {
        channels.push({ name, country: broadcast.market });
      }
    }
  }
  if ((event as any).broadcasts) {
    for (const broadcast of (event as any).broadcasts) {
      for (const name of broadcast.names || []) {
        if (!channels.find(c => c.name === name)) {
          channels.push({ name, country: broadcast.market });
        }
      }
    }
  }
  return channels;
}

function mapUFCEvent(event: ESPNEvent, config: SportConfig): SportsEvent {
  const competitions = event.competitions || [];

  // Sort competitions by order ascending (first = early prelims, last = main event)
  const sortedComps = [...competitions].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Main event is the last competition
  const mainEvent = sortedComps[sortedComps.length - 1];
  const mainCompetitors = mainEvent?.competitors || [];
  const mainSorted = [...mainCompetitors].sort((a, b) => (a.order || 0) - (b.order || 0));
  const mainAway = mainSorted[0];
  const mainHome = mainSorted[1];

  // Build matches list for all fights on the card
  const matches: NonNullable<SportsEvent['matches']> = sortedComps.map(comp => {
    const fighters = [...comp.competitors].sort((a, b) => (a.order || 0) - (b.order || 0));
    const away = getAthleteInfo(fighters[0]);
    const home = getAthleteInfo(fighters[1]);
    const compStatus = comp.status?.type?.state;
    let matchStatus: 'scheduled' | 'live' | 'finished' = 'scheduled';
    if (compStatus === 'in') matchStatus = 'live';
    else if (compStatus === 'post') matchStatus = 'finished';

    return {
      id: comp.id,
      awayName: away.name,
      homeName: home.name,
      awayLogo: away.logo,
      homeLogo: home.logo,
      awayRecord: fighters[0]?.records?.[0]?.summary,
      homeRecord: fighters[1]?.records?.[0]?.summary,
      subtitle: (comp as any).type?.abbreviation,
      status: matchStatus,
    };
  });

  // Event-level status
  const state = event.status?.type?.state || 'pre';
  let status: SportsEvent['status'] = 'scheduled';
  if (state === 'in') status = 'live';
  else if (state === 'post') status = 'finished';

  const homeTeam = getAthleteInfo(mainHome);
  const awayTeam = getAthleteInfo(mainAway);

  return {
    id: event.id,
    title: event.name,
    homeTeam,
    awayTeam,
    league: { id: 'ufc', name: config.name, sport: config.sport },
    startTime: new Date(event.date),
    status,
    homeScore: getScore(mainHome),
    awayScore: getScore(mainAway),
    period: event.status?.period?.toString(),
    timeElapsed: event.status?.displayClock,
    channels: extractChannels(event, mainEvent),
    venue: mainEvent?.venue?.fullName || (event as any).venues?.[0]?.fullName,
    matches,
  };
}

function mapStandardEvent(event: ESPNEvent, sportKey: string, config: SportConfig): SportsEvent {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors || [];

  const isGolf = sportKey === 'pga' || sportKey === 'lpga';
  const isTennis = sportKey.startsWith('atp') || sportKey.startsWith('wta') || sportKey.includes('tennis');
  const isRacing = sportKey === 'f1' || sportKey === 'nascar' || sportKey === 'indycar';
  const isIndividualSport = sportKey === 'ufc' || isGolf || isTennis || isRacing;

  let homeCompetitor = competitors.find(c => c.homeAway === 'home');
  let awayCompetitor = competitors.find(c => c.homeAway === 'away');

  // Tennis: Handle match pairings if available
  if (isTennis && competitors.length >= 2) {
    const sortedCompetitors = [...competitors].sort((a, b) => (a.order || 0) - (b.order || 0));
    awayCompetitor = sortedCompetitors[0];
    homeCompetitor = sortedCompetitors[1];
  }

  // Golf: Show tournament leaderboard (top player as "leader")
  if (isGolf && competitors.length > 0) {
    const sortedCompetitors = [...competitors].sort((a, b) => (a.order || 999) - (b.order || 999));
    const leader = sortedCompetitors[0];

    if (leader?.athlete) {
      awayCompetitor = {
        id: leader.athlete.id,
        athlete: leader.athlete,
      } as any;
      homeCompetitor = {
        id: 'field',
        athlete: { displayName: `${competitors.length} Players` },
      } as any;
    }
  }

  // F1/Racing: Show race session type
  if (isRacing && competition) {
    const sessionType = (competition as any).type?.abbreviation || 'Race';
    awayCompetitor = {
      id: 'session',
      athlete: { displayName: sessionType },
    } as any;
    homeCompetitor = {
      id: 'session2',
      athlete: { displayName: event.name },
    } as any;
  }

  const state = event.status?.type?.state || 'pre';
  let status: SportsEvent['status'] = 'scheduled';
  if (state === 'in') status = 'live';
  else if (state === 'post') status = 'finished';

  const homeTeam = getTeamInfo(homeCompetitor, sportKey);
  const awayTeam = getTeamInfo(awayCompetitor, sportKey);

  // For Golf, get the leader's score
  let golfLeaderScore: number | undefined;
  if (isGolf && competitors.length > 0) {
    const sortedCompetitors = [...competitors].sort((a, b) => (a.order || 999) - (b.order || 999));
    const leader = sortedCompetitors[0];
    if (leader?.score) {
      const scoreVal = typeof leader.score === 'object' ? leader.score.value : parseInt(leader.score, 10);
      if (!isNaN(scoreVal)) golfLeaderScore = scoreVal;
    }
  }

  return {
    id: event.id,
    title: event.name,
    homeTeam,
    awayTeam,
    league: { id: sportKey, name: config.name, sport: config.sport },
    startTime: new Date(event.date),
    status,
    homeScore: isGolf ? golfLeaderScore : getScore(homeCompetitor),
    awayScore: getScore(awayCompetitor),
    period: event.status?.period?.toString(),
    timeElapsed: event.status?.displayClock,
    channels: extractChannels(event, competition),
    venue: competition?.venue?.fullName || (event as any).venues?.[0]?.fullName,
  };
}

export function mapESPNEvent(event: ESPNEvent, sportKey: string): SportsEvent {
  const config = SPORT_CONFIG[sportKey] || { name: sportKey.toUpperCase() };

  if (sportKey === 'ufc') {
    return mapUFCEvent(event, config);
  }

  return mapStandardEvent(event, sportKey, config);
}

export function mapESPNTeam(team: ESPTeam, leagueId: string): SportsTeam {
  return {
    id: team.id,
    name: team.displayName,
    shortName: team.abbreviation,
    logo: team.logos?.[0]?.href,
    leagueId,
  };
}

export function getSportConfig(sportKey: string): SportConfig | undefined {
  return SPORT_CONFIG[sportKey];
}

export function getCategoryDisplayName(categoryId: string): string {
  const categoryNames: Record<string, string> = {
    football: 'Football',
    basketball: 'Basketball',
    baseball: 'Baseball',
    hockey: 'Hockey',
    soccer: 'Soccer',
    mma: 'MMA & Combat',
    golf: 'Golf',
    tennis: 'Tennis',
    racing: 'Racing',
  };
  return categoryNames[categoryId] || categoryId;
}

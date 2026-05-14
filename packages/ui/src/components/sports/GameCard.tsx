import { useState, useCallback } from 'react';
import type { SportsEvent } from '@ynotv/core';
import { formatEventTime } from '../../services/sports';
import { db } from '../../db';
import type { StoredChannel } from '../../db';
import { useSportsSelectedChannels, useSetSportsSelectedChannel } from '../../stores/uiStore';
import './styles/GameCard.css';

/**
 * Known city/location prefixes used in major sports team names.
 * Multi-word prefixes must be listed before single-word ones so they match greedily.
 */
const TEAM_CITY_PREFIXES: string[] = [
  'St. Louis', 'St Louis', 'New York', 'Los Angeles', 'San Francisco', 'San Diego',
  'San Jose', 'Kansas City', 'Oklahoma City', 'Salt Lake', 'New Orleans',
  'Las Vegas', 'Green Bay', 'Tampa Bay', 'Bay Area', 'Golden State',
  'New England', 'Carolina', 'Rhode Island',
  'Fort Worth', 'Fort Lauderdale', 'El Paso', 'San Antonio', 'Little Rock',
  'Baton Rouge', 'West Ham', 'Crystal Palace', 'Brighton', 'Sheffield',
  'Nottingham', 'Wolverhampton', 'Aston', 'Porto Alegre',
  'Porto', 'Real Madrid', 'Real Sociedad', 'Real Betis', 'Real Valladolid',
  'Atletico', 'Athletic',
  'Atlanta', 'Baltimore', 'Boston', 'Buffalo', 'Charlotte', 'Chicago',
  'Cincinnati', 'Cleveland', 'Colorado', 'Columbus', 'Dallas', 'Denver',
  'Detroit', 'Edmonton', 'Florida', 'Houston', 'Indiana', 'Jacksonville',
  'Louisville', 'Memphis', 'Miami', 'Milwaukee', 'Minnesota', 'Montreal',
  'Nashville', 'Newark', 'Oakland', 'Orlando', 'Ottawa', 'Philadelphia',
  'Phoenix', 'Pittsburgh', 'Portland', 'Sacramento', 'Seattle', 'Toronto',
  'Utah', 'Vancouver', 'Washington', 'Winnipeg', 'Arizona', 'Cincinnati',
  'Jacksonville', 'Tennessee', 'Mississippi', 'Alabama', 'Georgia', 'Oregon',
  'Arsenal', 'Chelsea', 'Everton', 'Leicester', 'Liverpool', 'Fulham',
  'Brentford', 'Bournemouth', 'Burnley', 'Watford', 'Sunderland', 'Middlesbrough',
  'Bayern', 'Dortmund', 'Leverkusen', 'Leipzig', 'Frankfurt', 'Stuttgart',
  'Bremen', 'Hamburg', 'Freiburg', 'Augsburg', 'Wolfsburg', 'Mainz', 'Bochum',
  'Barcelona', 'Sevilla', 'Valencia', 'Villarreal', 'Bilbao', 'Getafe',
  'Girona', 'Alaves', 'Mallorca', 'Celta', 'Rayo', 'Osasuna', 'Cadiz',
  'Juventus', 'Napoli', 'Milan', 'Roma', 'Lazio', 'Atalanta', 'Fiorentina',
  'Torino', 'Udine', 'Monza', 'Bologna', 'Genoa', 'Lecce', 'Frosinone',
  'Paris', 'Lyon', 'Marseille', 'Lens', 'Lille', 'Monaco', 'Montpellier',
  'Toulouse', 'Nantes', 'Strasbourg', 'Reims', 'Rennes', 'Brest', 'Clermont',
  'Ajax', 'Feyenoord', 'Eindhoven', 'Bruges', 'Anderlecht', 'Lisbon', 'Benfica',
  'Sporting', 'Porto', 'Amsterdam', 'Galatasaray', 'Fenerbahce', 'Besiktas',
  'Flamengo', 'Palmeiras', 'Santos', 'Corinthians', 'Botafogo', 'Fluminense',
  'Gremio', 'Internacional',
  'Inter', 'Internazionale', 'Manchester', 'Tottenham', 'Blackburn', 'Blackpool',
  'Newcastle', 'Swindon', 'Coventry', 'Luton', 'Cambridge',
  'Rangers', 'Celtic', 'Aberdeen', 'Hibernian', 'Hearts',
];

TEAM_CITY_PREFIXES.sort((a, b) => b.length - a.length);

function stripCityPrefix(name: string): string {
  const trimmed = name.trim();
  for (const city of TEAM_CITY_PREFIXES) {
    if (trimmed.toLowerCase().startsWith(city.toLowerCase() + ' ')) {
      const nickname = trimmed.slice(city.length).trim();
      if (nickname.length > 0) return nickname;
    }
  }
  return trimmed;
}

function splitTeamName(name: string): { city: string; nickname: string } {
  const trimmed = name.trim();
  // 1. Try known city prefixes first
  for (const city of TEAM_CITY_PREFIXES) {
    if (trimmed.toLowerCase().startsWith(city.toLowerCase() + ' ')) {
      const nickname = trimmed.slice(city.length).trim();
      if (nickname.length > 0) return { city, nickname };
    }
  }
  // 2. Fall back: split on last space
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace > 0) {
    return {
      city: trimmed.slice(0, lastSpace),
      nickname: trimmed.slice(lastSpace + 1),
    };
  }
  // 3. Single word — treat as nickname with no city
  return { city: '', nickname: trimmed };
}

const NCAA_LEAGUE_IDS = new Set([
  'mens-college-basketball',
  'womens-college-basketball',
  'college-football',
  'college-baseball',
  'college-softball',
]);

function stripMascotForCollege(name: string): string {
  let cleaned = name.replace(/\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  const words = cleaned.split(/\s+/);
  if (words.length <= 1) return cleaned;
  return words.slice(0, -1).join(' ');
}

function buildTeamSearchQuery(homeTeam: string, awayTeam: string, leagueId?: string): string {
  if (leagueId && NCAA_LEAGUE_IDS.has(leagueId)) {
    return `${stripMascotForCollege(homeTeam)} ${stripMascotForCollege(awayTeam)}`;
  }
  return `${stripCityPrefix(homeTeam)} ${stripCityPrefix(awayTeam)}`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h} 60% 45%)`;
}

function TeamNameLabel({ name }: { name: string }) {
  const { city, nickname } = splitTeamName(name);
  return (
    <div className="gc-team-name-wrap">
      {city && <span className="gc-team-city">{city}</span>}
      <span className="gc-team-nickname">{nickname}</span>
    </div>
  );
}

function TeamLogo({ name, logo, size = 'md' }: { name: string; logo?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === 'lg' ? 'gc-logo-lg' : size === 'sm' ? 'gc-logo-sm' : 'gc-logo-md';

  if (logo && !failed) {
    return (
      <img
        src={logo}
        alt={name}
        className={`gc-logo-img ${sizeClass}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={`gc-logo-fallback ${sizeClass}`} style={{ background: stringToColor(name) }}>
      {getInitials(name)}
    </div>
  );
}

interface GameCardProps {
  event: SportsEvent;
  onClick?: () => void;
  onChannelClick?: (channelName: string) => void;
  onSearchTeams?: (query: string) => void;
  onPlayChannel?: (channel: StoredChannel) => void;
  compact?: boolean;
}

const inlineSearchCache = new Map<string, StoredChannel[]>();

export function GameCard({ event, onClick, onChannelClick, onSearchTeams, onPlayChannel, compact = false }: GameCardProps) {
  const isLive = event.status === 'live';
  const isFinished = event.status === 'finished';
  const isScheduled = event.status === 'scheduled';
  const sport = event.league.sport.toLowerCase();

  const [isSearching, setIsSearching] = useState(false);
  const [localSearchChannels, setLocalSearchChannels] = useState<StoredChannel[] | null>(() => inlineSearchCache.get(event.id) || null);

  const sportsSelectedChannels = useSportsSelectedChannels();
  const setSportsSelectedChannel = useSetSportsSelectedChannel();
  const selectedChannelKey = sportsSelectedChannels[event.id] || null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  const homeWinning = isLive || isFinished ? (event.homeScore ?? 0) > (event.awayScore ?? 0) : false;
  const awayWinning = isLive || isFinished ? (event.awayScore ?? 0) > (event.homeScore ?? 0) : false;

  const toggleLocalSearch = useCallback(async () => {
    if (localSearchChannels && localSearchChannels.length > 0) {
      setLocalSearchChannels(null);
      inlineSearchCache.delete(event.id);
      return;
    }

    setIsSearching(true);
    try {
      const query = buildTeamSearchQuery(event.homeTeam.name, event.awayTeam.name, event.league.id);
      const queryWords = query.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 0);
      if (queryWords.length === 0) {
        setLocalSearchChannels([]);
        return;
      }

      const dbInstance = await (db as any).dbPromise;
      const sourcesResult = window.storage ? await window.storage.getSources() : { data: [] };
      const enabledSources = sourcesResult.data?.filter((s: any) => s.enabled !== false).map((s: any) => s.id) || [];

      if (enabledSources.length === 0) {
        setLocalSearchChannels([]);
        return;
      }

      const sourcePlaceholders = enabledSources.map(() => '?').join(',');
      const enabledCategoryRows = await dbInstance.select(
        `SELECT category_id FROM categories WHERE source_id IN (${sourcePlaceholders}) AND (enabled IS NULL OR enabled != 0)`,
        enabledSources
      );
      const enabledCategoryIds = enabledCategoryRows.map((r: any) => r.category_id);

      if (enabledCategoryIds.length === 0) {
        setLocalSearchChannels([]);
        return;
      }

      const categoryPlaceholders = enabledCategoryIds.map(() => '?').join(',');
      const wordLikeClauses = queryWords.map(() => `c.name LIKE ?`).join(' AND ');
      const progLikeClauses = queryWords.map(() => `p.title LIKE ?`).join(' AND ');
      const wordParams = queryWords.map((w) => `%${w}%`);
      const nowIso = new Date().toISOString();

      const channelMatches = await dbInstance.select(
        `SELECT DISTINCT c.* FROM channels c CROSS JOIN json_each(c.category_ids) AS cat WHERE (${wordLikeClauses}) AND c.source_id IN (${sourcePlaceholders}) AND (c.enabled IS NULL OR c.enabled != 0) AND cat.value IN (${categoryPlaceholders}) LIMIT 15`,
        [...wordParams, ...enabledSources, ...enabledCategoryIds]
      );

      const programMatches = await dbInstance.select(
        `SELECT DISTINCT c.* FROM channels c INNER JOIN programs p ON p.stream_id = c.stream_id CROSS JOIN json_each(c.category_ids) AS cat WHERE (${progLikeClauses}) AND p.end > ? AND c.source_id IN (${sourcePlaceholders}) AND (c.enabled IS NULL OR c.enabled != 0) AND cat.value IN (${categoryPlaceholders}) LIMIT 15`,
        [...wordParams, nowIso, ...enabledSources, ...enabledCategoryIds]
      );

      const mergedMap = new Map<string, StoredChannel>();
      for (const ch of channelMatches) mergedMap.set(ch.stream_id, ch as StoredChannel);
      for (const ch of programMatches) mergedMap.set(ch.stream_id, ch as StoredChannel);

      const results = Array.from(mergedMap.values()).slice(0, 15);
      inlineSearchCache.set(event.id, results);
      setLocalSearchChannels(results);
    } catch (err) {
      console.error('Inline local search failed:', err);
      setLocalSearchChannels([]);
      inlineSearchCache.set(event.id, []);
    } finally {
      setIsSearching(false);
    }
  }, [event, localSearchChannels]);

  const getStatusBelow = (): string => {
    if (isScheduled) return '';
    const period = event.period ? parseInt(event.period, 10) : 0;
    switch (sport) {
      case 'football':
        return `Q${event.period || '-'}${event.timeElapsed ? ' · ' + event.timeElapsed : ''}`;
      case 'basketball':
        return `Q${event.period || '-'}${event.timeElapsed ? ' · ' + event.timeElapsed : ''}`;
      case 'baseball': {
        const inningLabel = period > 9 ? `${period}th` :
          period === 1 ? '1st' :
            period === 2 ? '2nd' :
              period === 3 ? '3rd' :
                period ? `${period}th` : '';
        return `${inningLabel || '-'}${event.timeElapsed ? ' · ' + event.timeElapsed : ''}`;
      }
      case 'hockey': {
        const periodLabel = period <= 3 ? `${period}${period === 1 ? 'st' : period === 2 ? 'nd' : period === 3 ? 'rd' : 'th'}` :
          period === 4 ? 'OT' :
            period === 5 ? 'SO' : `${period - 3}OT`;
        return `${periodLabel || '-'}${event.timeElapsed ? ' · ' + event.timeElapsed : ''}`;
      }
      case 'soccer':
        return event.timeElapsed || '';
      default:
        return event.timeElapsed || (isLive ? 'LIVE' : 'FINAL');
    }
  };

  const statusBelow = getStatusBelow();

  const compactView = (
    <div
      className={`game-card compact ${event.status}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${event.awayTeam.name} vs ${event.homeTeam.name}`}
    >
      <div className="gc-compact-grid">
        <div className="gc-compact-team away">
          <TeamLogo name={event.awayTeam.name} logo={event.awayTeam.logo} size="sm" />
          <TeamNameLabel name={event.awayTeam.name} />
        </div>
        <div className="gc-compact-center">
          {isScheduled ? (
            <>
              <span className="gc-compact-vs">VS</span>
              <span className="gc-compact-time">{formatEventTime(event.startTime)}</span>
            </>
          ) : (
            <>
              <div className="gc-compact-score-pair">
                <span className={`gc-compact-score ${awayWinning ? 'winning' : ''}`}>{event.awayScore ?? '-'}</span>
                <span className="gc-compact-divider">:</span>
                <span className={`gc-compact-score ${homeWinning ? 'winning' : ''}`}>{event.homeScore ?? '-'}</span>
              </div>
              {statusBelow && <span className="gc-compact-status">{statusBelow}</span>}
            </>
          )}
        </div>
        <div className="gc-compact-team home">
          <TeamLogo name={event.homeTeam.name} logo={event.homeTeam.logo} size="sm" />
          <TeamNameLabel name={event.homeTeam.name} />
        </div>
      </div>
      {isLive && <span className="gc-live-pulse" />}
    </div>
  );

  const isUFC = event.league.id === 'ufc' && !!event.matches;

  const fullView = (
    <div
      className={`game-card ${event.status} ${isUFC ? 'ufc-card' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${event.awayTeam.name} vs ${event.homeTeam.name}, ${isLive ? 'Live' : isFinished ? 'Final' : 'Scheduled'}`}
    >
      {/* Top Bar */}
      <div className="gc-top-bar">
        <span className="gc-league-pill">{event.league.name}</span>
        <div className="gc-status-group">
          {isLive && (
            <span className="gc-status-live">
              <span className="gc-live-dot" />
              LIVE
            </span>
          )}
          {isFinished && <span className="gc-status-final">FINAL</span>}
          {isScheduled && <span className="gc-status-scheduled">{formatEventTime(event.startTime)}</span>}
        </div>
      </div>

      {isUFC ? (
        /* ─── UFC Event Card Layout ─── */
        <>
          {/* Event Title */}
          <div className="gc-ufc-title">{event.title}</div>

          {/* Main Event Fighters */}
          <div className="gc-ufc-main">
            <div className="gc-ufc-fighter">
              <TeamLogo name={event.awayTeam.name} logo={event.awayTeam.logo} size="lg" />
              <span className="gc-ufc-fighter-name">{event.awayTeam.name}</span>
            </div>
            <div className="gc-ufc-vs">VS</div>
            <div className="gc-ufc-fighter">
              <TeamLogo name={event.homeTeam.name} logo={event.homeTeam.logo} size="lg" />
              <span className="gc-ufc-fighter-name">{event.homeTeam.name}</span>
            </div>
          </div>

          {/* Fight Card List */}
          {event.matches && event.matches.length > 0 && (
            <div className="gc-ufc-card">
              <div className="gc-ufc-card-header">Fight Card</div>
              <div className="gc-ufc-card-list">
                {event.matches.map((match) => (
                  <div key={match.id} className={`gc-ufc-match ${match.status === 'live' ? 'live' : ''}`}>
                    <div className="gc-ufc-match-names">
                      <span className="gc-ufc-match-away">{match.awayName}</span>
                      <span className="gc-ufc-match-vs">vs</span>
                      <span className="gc-ufc-match-home">{match.homeName}</span>
                    </div>
                    {match.subtitle && (
                      <span className="gc-ufc-match-weight">{match.subtitle}</span>
                    )}
                    {match.status === 'live' && (
                      <span className="gc-ufc-match-live-dot" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ─── Standard Sport Card Layout ─── */
        <>
          {/* Main Content */}
          <div className="gc-body">
            {/* Away Team */}
            <div className="gc-team-col away">
              <TeamLogo name={event.awayTeam.name} logo={event.awayTeam.logo} size="lg" />
              <TeamNameLabel name={event.awayTeam.name} />
            </div>

            {/* Center Scores */}
            <div className="gc-score-col">
              {isScheduled ? (
                <>
                  <span className="gc-vs-big">VS</span>
                  <span className="gc-start-time">{formatEventTime(event.startTime)}</span>
                </>
              ) : (
                <>
                  <div className="gc-score-pair">
                    <span className={`gc-score-big ${awayWinning ? 'winning' : ''}`}>{event.awayScore ?? '-'}</span>
                    <span className="gc-score-sep">:</span>
                    <span className={`gc-score-big ${homeWinning ? 'winning' : ''}`}>{event.homeScore ?? '-'}</span>
                  </div>
                  {statusBelow && <span className="gc-status-below">{statusBelow}</span>}
                </>
              )}
            </div>

            {/* Home Team */}
            <div className="gc-team-col home">
              <TeamLogo name={event.homeTeam.name} logo={event.homeTeam.logo} size="lg" />
              <TeamNameLabel name={event.homeTeam.name} />
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      {/* Channels */}
      {event.channels.length > 0 && (
        <div className="gc-footer">
          <div className="gc-channels">
            {event.channels.slice(0, 3).map((channel, idx) => (
              <button
                key={`api-ch-${idx}`}
                className={`gc-channel-pill ${selectedChannelKey === `api:${channel.name}` ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSportsSelectedChannel(event.id, `api:${channel.name}`);
                  onChannelClick?.(channel.name);
                }}
                title={channel.name}
              >
                {channel.name}
              </button>
            ))}
            {event.channels.length > 3 && (
              <span className="gc-channel-more">+{event.channels.length - 3}</span>
            )}
          </div>
        </div>
      )}

      {/* Action buttons row */}
      {onSearchTeams && (
        <div className="gc-action-row">
          <button
            className="gc-action-text-btn"
            title={`Search EPG for ${event.homeTeam.name} vs ${event.awayTeam.name}`}
            onClick={(e) => {
              e.stopPropagation();
              const query = buildTeamSearchQuery(event.homeTeam.name, event.awayTeam.name, event.league.id);
              onSearchTeams(query);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            Search
          </button>
          {onChannelClick && (
            <button
              className={`gc-action-text-btn ${localSearchChannels && localSearchChannels.length > 0 ? 'active' : ''}`}
              title={localSearchChannels && localSearchChannels.length > 0 ? 'Hide search results' : 'Find streams'}
              onClick={(e) => {
                e.stopPropagation();
                toggleLocalSearch();
              }}
            >
              {isSearching ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="gc-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4" />
                  <path d="m5 5 2.8 2.8" />
                  <path d="m19 5-2.8 2.8" />
                  <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
                </svg>
              )}
              List Streams Here
            </button>
          )}
        </div>
      )}

      {/* Inline search results */}
      {localSearchChannels && localSearchChannels.length > 0 && (
        <div className="gc-inline-results">
          {localSearchChannels.map((channel, idx) => (
            <button
              key={`local-ch-${idx}`}
              className={`gc-channel-pill ${selectedChannelKey === `local:${channel.stream_id}` ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setSportsSelectedChannel(event.id, `local:${channel.stream_id}`);
                if (onPlayChannel && channel) {
                  onPlayChannel(channel);
                } else {
                  onChannelClick?.(channel.name);
                }
              }}
            >
              {channel.name}
            </button>
          ))}
        </div>
      )}
      {localSearchChannels && localSearchChannels.length === 0 && !isSearching && (
        <div className="gc-no-results">No streams found</div>
      )}
    </div>
  );

  return compact ? compactView : fullView;
}

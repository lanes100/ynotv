import { useState, useEffect, useMemo, useRef } from 'react';
import type { SportsEvent, SportsTeam } from '@ynotv/core';
import type { StoredChannel } from '../../db';
import {
  fetchJson,
  mapESPNEvent,
  formatEventTime,
  formatEventDate,
} from '../../services/sports';
import { GameCard } from './GameCard';
import { GameDetail } from './GameDetail';
import { TeamDetail } from './TeamDetail';
import './styles/WorldCupTab.css';

interface WorldCupTabProps {
  onSearchChannels?: (channelName: string) => void;
  onPlayChannel?: (channel: StoredChannel) => void;
}

type SubTabId = 'overview' | 'bracket' | 'standings' | 'matches' | 'teams';

interface GroupStandingEntry {
  rank: number;
  teamId: string;
  name: string;
  logo?: string;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

interface GroupStanding {
  name: string;
  teams: GroupStandingEntry[];
}

export function WorldCupTab({ onSearchChannels, onPlayChannel }: WorldCupTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('overview');
  
  // Data States
  const [matches, setMatches] = useState<SportsEvent[]>([]);
  const [standings, setStandings] = useState<GroupStanding[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  
  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selected Detail States
  const [selectedEvent, setSelectedEvent] = useState<SportsEvent | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<SportsTeam | null>(null);

  // Filters for Matches Tab
  const [matchStageFilter, setMatchStageFilter] = useState<string>('all');
  const [selectedDateStr, setSelectedDateStr] = useState<string>('all');

  // Fetch all World Cup 2026 Data
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const loadAllData = async () => {
      try {
        const scoreboardUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260720&limit=200';
        const standingsUrl = 'https://site.web.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';
        const teamsUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams?limit=100';

        const [scoreboardData, standingsData, teamsData] = await Promise.all([
          fetchJson<any>(scoreboardUrl),
          fetchJson<any>(standingsUrl),
          fetchJson<any>(teamsUrl),
        ]);

        if (!active) return;

        // Parse matches
        let parsedMatches: SportsEvent[] = [];
        if (scoreboardData?.events) {
          parsedMatches = scoreboardData.events.map((e: any) => {
            const mapped = mapESPNEvent(e, 'soccer-fifa.world');
            // Attach ESPN API season slug to SportsEvent for stage tracking
            if (e.season?.slug) {
              (mapped as any).seasonSlug = e.season.slug;
            }
            return mapped;
          });
        }

        // Parse standings
        let parsedStandings: GroupStanding[] = [];
        if (standingsData?.children) {
          parsedStandings = standingsData.children.map((group: any) => {
            const entries = group.standings?.entries || [];
            const teamsList = entries.map((entry: any) => {
              const stats = entry.stats || [];
              const getStat = (name: string) => stats.find((s: any) => s.name === name)?.value ?? 0;
              return {
                rank: getStat('rank'),
                teamId: entry.team?.id,
                name: entry.team?.displayName,
                logo: entry.team?.logos?.[0]?.href || entry.team?.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${entry.team?.id}.png`,
                gp: getStat('gamesPlayed'),
                w: getStat('wins'),
                d: getStat('ties'),
                l: getStat('losses'),
                gf: getStat('pointsFor'),
                ga: getStat('pointsAgainst'),
                gd: getStat('pointDifferential'),
                pts: getStat('points')
              };
            });
            teamsList.sort((a: any, b: any) => a.rank - b.rank);
            return {
              name: group.name,
              teams: teamsList
            };
          });
        }

        // Parse teams
        let parsedTeams: any[] = [];
        if (teamsData?.sports?.[0]?.leagues?.[0]?.teams) {
          parsedTeams = teamsData.sports[0].leagues[0].teams.map((tWrapper: any) => tWrapper.team);
        }

        setMatches(parsedMatches);
        setStandings(parsedStandings);
        setTeams(parsedTeams);
      } catch (err) {
        console.error('[WorldCupTab] Error fetching data:', err);
        setError('Failed to load World Cup data. Please check your connection.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAllData();
    return () => { active = false; };
  }, []);

  // Map team ID to group name
  const teamGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    standings.forEach(g => {
      g.teams.forEach(t => {
        map.set(t.teamId, g.name);
      });
    });
    return map;
  }, [standings]);

  // Group teams by group A-L
  const teamsByGroup = useMemo(() => {
    const groups: Record<string, any[]> = {};
    teams.forEach(team => {
      const grp = teamGroupMap.get(team.id) || 'Unassigned';
      if (!groups[grp]) groups[grp] = [];
      groups[grp].push(team);
    });
    // Sort keys alphabetically so Group A is first
    return Object.keys(groups).sort().reduce((acc, key) => {
      acc[key] = groups[key];
      return acc;
    }, {} as Record<string, any[]>);
  }, [teams, teamGroupMap]);

  // Split matches by stage
  const knockoutMatches = useMemo(() => {
    const r32: SportsEvent[] = [];
    const r16: SportsEvent[] = [];
    const qf: SportsEvent[] = [];
    const sf: SportsEvent[] = [];
    const finals: SportsEvent[] = []; // Final and 3rd place match

    matches.forEach(m => {
      const slug = (m as any).seasonSlug || '';
      if (slug === 'round-of-32') r32.push(m);
      else if (slug === 'round-of-16') r16.push(m);
      else if (slug === 'quarterfinals') qf.push(m);
      else if (slug === 'semifinals') sf.push(m);
      else if (slug === 'final' || slug === '3rd-place-match') finals.push(m);
    });

    // Sort stages chronologically/by start time
    const sortByTime = (arr: SportsEvent[]) => arr.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    return {
      r32: sortByTime(r32),
      r16: sortByTime(r16),
      qf: sortByTime(qf),
      sf: sortByTime(sf),
      finals: sortByTime(finals)
    };
  }, [matches]);

  // Matches filtered for the Matches list tab
  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const stage = (m as any).seasonSlug || 'group-stage';
      
      // Stage filter
      if (matchStageFilter !== 'all') {
        if (matchStageFilter === 'group' && stage !== 'group-stage') return false;
        if (matchStageFilter === 'knockout' && stage === 'group-stage') return false;
        if (matchStageFilter !== 'group' && matchStageFilter !== 'knockout' && stage !== matchStageFilter) return false;
      }

      // Date filter
      if (selectedDateStr !== 'all') {
        const dateStr = m.startTime.toISOString().split('T')[0];
        if (dateStr !== selectedDateStr) return false;
      }

      return true;
    });
  }, [matches, matchStageFilter, selectedDateStr]);

  // Unique match dates for filter dropdown
  const matchDates = useMemo(() => {
    const dates = new Set<string>();
    matches.forEach(m => {
      dates.add(m.startTime.toISOString().split('T')[0]);
    });
    return Array.from(dates).sort();
  }, [matches]);

  // Overview stats and countdown
  const overviewData = useMemo(() => {
    const now = new Date();
    const live = matches.filter(m => m.status === 'live');
    const upcoming = matches.filter(m => m.status === 'scheduled').sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const finished = matches.filter(m => m.status === 'finished');
    
    // Find next match
    const nextMatch = upcoming[0] || null;

    // Countdown details
    let countdownStr = '';
    if (nextMatch) {
      const diffMs = nextMatch.startTime.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      if (diffDays > 0) {
        countdownStr = `${diffDays}d ${diffHrs}h`;
      } else {
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        countdownStr = `${diffHrs}h ${diffMins}m`;
      }
    }

    return {
      live,
      upcoming: upcoming.slice(0, 5),
      finished: finished.slice(0, 5),
      totalMatches: matches.length,
      finishedCount: finished.length,
      nextMatch,
      countdownStr,
      liveCount: live.length
    };
  }, [matches]);

  // Render Loader
  if (loading) {
    return (
      <div className="sports-loading wc-loading">
        <div className="sports-spinner" />
        <span className="wc-loading-text">Fetching FIFA World Cup 2026 Hub...</span>
      </div>
    );
  }

  // Render Error
  if (error) {
    return (
      <div className="sports-empty wc-error">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p>{error}</p>
        <button className="wc-retry-btn" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  // Detail View: Team Details Page
  if (selectedTeam) {
    return (
      <TeamDetail
        team={selectedTeam}
        onClose={() => setSelectedTeam(null)}
        onChannelClick={onSearchChannels}
        onPlayChannel={onPlayChannel}
      />
    );
  }

  // Detail View: Match Summary Modal Overlay
  const renderGameDetailModal = () => {
    if (!selectedEvent) return null;
    return (
      <GameDetail
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onChannelClick={onSearchChannels}
        onPlayChannel={onPlayChannel}
        variant="glass"
      />
    );
  };

  const getStageLabel = (slug?: string) => {
    if (!slug) return 'Group Stage';
    switch (slug) {
      case 'group-stage': return 'Group Stage';
      case 'round-of-32': return 'Round of 32';
      case 'round-of-16': return 'Round of 16';
      case 'quarterfinals': return 'Quarterfinals';
      case 'semifinals': return 'Semifinals';
      case '3rd-place-match': return '3rd Place Play-off';
      case 'final': return 'Final';
      default: return slug.replace(/-/g, ' ');
    }
  };

  // 1. Sub-Tab: Overview
  const renderOverview = () => {
    const { live, upcoming, finished, totalMatches, finishedCount, nextMatch, countdownStr } = overviewData;

    return (
      <div className="wc-overview-grid">
        {/* Banner with Countdown / Live status */}
        <div className="wc-banner-card">
          <div className="wc-banner-bg" />
          <div className="wc-banner-content">
            <div className="wc-banner-top">
              <span className="wc-banner-badge">FIFA World Cup 2026</span>
              <span className="wc-banner-loc">United States • Canada • Mexico</span>
            </div>
            <h2 className="wc-banner-title">The World's Game</h2>
            
            {live.length > 0 ? (
              <div className="wc-banner-status live">
                <span className="wc-live-dot pulse" />
                <span className="wc-status-lbl">{live.length} Games Currently Live!</span>
              </div>
            ) : nextMatch ? (
              <div className="wc-banner-status upcoming">
                <span className="wc-status-lbl">Next Match Countdown:</span>
                <span className="wc-countdown-timer">{countdownStr}</span>
                <span className="wc-next-teams">
                  {nextMatch.awayTeam.name} vs {nextMatch.homeTeam.name}
                </span>
              </div>
            ) : (
              <div className="wc-banner-status finished">
                <span className="wc-status-lbl">Tournament Completed</span>
              </div>
            )}

            {/* Quick stats grid */}
            <div className="wc-mini-stats">
              <div className="wc-mini-stat">
                <span className="val">{totalMatches}</span>
                <span className="lbl">Total Matches</span>
              </div>
              <div className="wc-mini-stat">
                <span className="val">{finishedCount}</span>
                <span className="lbl">Completed</span>
              </div>
              <div className="wc-mini-stat">
                <span className="val">{totalMatches - finishedCount}</span>
                <span className="lbl">Remaining</span>
              </div>
              <div className="wc-mini-stat animate-width">
                <span className="val">{Math.round((finishedCount / totalMatches) * 100)}%</span>
                <span className="lbl">Progress</span>
                <div className="wc-progress-bar-wrap">
                  <div className="wc-progress-bar" style={{ width: `${(finishedCount / totalMatches) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Matches Column */}
        {live.length > 0 && (
          <div className="wc-section wc-live-section">
            <h3 className="wc-section-header">
              <span className="wc-live-dot pulse" /> Live Scores
            </h3>
            <div className="wc-card-grid-1">
              {live.map(m => (
                <GameCard
                  key={m.id}
                  event={m}
                  onClick={() => setSelectedEvent(m)}
                  onChannelClick={onSearchChannels}
                  onSearchTeams={onSearchChannels}
                  onPlayChannel={onPlayChannel}
                />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming / Recent Matches Row */}
        <div className="wc-overview-row">
          <div className="wc-overview-col">
            <h3 className="wc-section-header">Upcoming Highlights</h3>
            {upcoming.length > 0 ? (
              <div className="wc-list-stack">
                {upcoming.map(m => (
                  <div key={m.id} className="wc-match-row-item" onClick={() => setSelectedEvent(m)}>
                    <span className="time">{m.startTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {formatEventTime(m.startTime)}</span>
                    <div className="teams">
                      <div className="team away">
                        <img src={m.awayTeam.logo} alt="" className="flag" onError={e => e.currentTarget.style.display = 'none'} />
                        <span className="name">{m.awayTeam.shortName || m.awayTeam.name}</span>
                      </div>
                      <span className="vs">vs</span>
                      <div className="team home">
                        <img src={m.homeTeam.logo} alt="" className="flag" onError={e => e.currentTarget.style.display = 'none'} />
                        <span className="name">{m.homeTeam.shortName || m.homeTeam.name}</span>
                      </div>
                    </div>
                    {m.channels.length > 0 && <span className="channel-pill">{m.channels[0].name}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="wc-empty-box">No upcoming matches scheduled.</div>
            )}
          </div>

          <div className="wc-overview-col">
            <h3 className="wc-section-header">Recent Results</h3>
            {finished.length > 0 ? (
              <div className="wc-list-stack">
                {finished.map(m => (
                  <div key={m.id} className="wc-match-row-item" onClick={() => setSelectedEvent(m)}>
                    <span className="stage-lbl">{getStageLabel((m as any).seasonSlug)}</span>
                    <div className="teams">
                      <div className="team away">
                        <img src={m.awayTeam.logo} alt="" className="flag" onError={e => e.currentTarget.style.display = 'none'} />
                        <span className="name">{m.awayTeam.shortName || m.awayTeam.name}</span>
                      </div>
                      <div className="scores">
                        <span className="score">{m.awayScore}</span>
                        <span className="sep">:</span>
                        <span className="score">{m.homeScore}</span>
                      </div>
                      <div className="team home">
                        <img src={m.homeTeam.logo} alt="" className="flag" onError={e => e.currentTarget.style.display = 'none'} />
                        <span className="name">{m.homeTeam.shortName || m.homeTeam.name}</span>
                      </div>
                    </div>
                    <span className="final-lbl">FT</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="wc-empty-box">No matches completed yet.</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 2. Sub-Tab: Bracket
  const renderBracket = () => {
    const { r32, r16, qf, sf, finals } = knockoutMatches;
    
    if (r32.length === 0 && r16.length === 0 && qf.length === 0 && sf.length === 0 && finals.length === 0) {
      return (
        <div className="wc-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
            <path d="M18 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
            <path d="M8 7h8" />
            <path d="M8 11h8" />
            <path d="M8 15h8" />
          </svg>
          <p>Knockout matches have not been generated yet. They will appear here once the group stage concludes.</p>
        </div>
      );
    }

    const renderBracketNode = (match: SportsEvent) => {
      const isAwayWinner = match.status === 'finished' && (match.awayScore ?? 0) > (match.homeScore ?? 0);
      const isHomeWinner = match.status === 'finished' && (match.homeScore ?? 0) > (match.awayScore ?? 0);

      return (
        <div key={match.id} className={`wc-bracket-node ${match.status}`} onClick={() => setSelectedEvent(match)}>
          <div className="wc-bracket-node-header">
            <span className="node-stage">{getStageLabel((match as any).seasonSlug)}</span>
            {match.status === 'live' && <span className="node-live">LIVE</span>}
          </div>
          <div className="wc-bracket-node-teams">
            <div className={`wc-bracket-node-team ${isAwayWinner ? 'winner' : ''}`}>
              <img src={match.awayTeam.logo} alt="" className="node-flag" onError={e => e.currentTarget.style.display = 'none'} />
              <span className="node-name">{match.awayTeam.shortName || match.awayTeam.name}</span>
              {match.status !== 'scheduled' && <span className="node-score">{match.awayScore}</span>}
            </div>
            <div className={`wc-bracket-node-team ${isHomeWinner ? 'winner' : ''}`}>
              <img src={match.homeTeam.logo} alt="" className="node-flag" onError={e => e.currentTarget.style.display = 'none'} />
              <span className="node-name">{match.homeTeam.shortName || match.homeTeam.name}</span>
              {match.status !== 'scheduled' && <span className="node-score">{match.homeScore}</span>}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="wc-bracket-scroll-container">
        <div className="wc-bracket-canvas">
          {/* Column 1: Round of 32 */}
          {r32.length > 0 && (
            <div className="wc-bracket-col round-32">
              <h4 className="wc-bracket-col-title">Round of 32</h4>
              <div className="wc-bracket-nodes-list">
                {r32.map(renderBracketNode)}
              </div>
            </div>
          )}

          {/* Column 2: Round of 16 */}
          {r16.length > 0 && (
            <div className="wc-bracket-col round-16">
              <h4 className="wc-bracket-col-title">Round of 16</h4>
              <div className="wc-bracket-nodes-list">
                {r16.map(renderBracketNode)}
              </div>
            </div>
          )}

          {/* Column 3: Quarterfinals */}
          {qf.length > 0 && (
            <div className="wc-bracket-col quarterfinals">
              <h4 className="wc-bracket-col-title">Quarterfinals</h4>
              <div className="wc-bracket-nodes-list">
                {qf.map(renderBracketNode)}
              </div>
            </div>
          )}

          {/* Column 4: Semifinals */}
          {sf.length > 0 && (
            <div className="wc-bracket-col semifinals">
              <h4 className="wc-bracket-col-title">Semifinals</h4>
              <div className="wc-bracket-nodes-list">
                {sf.map(renderBracketNode)}
              </div>
            </div>
          )}

          {/* Column 5: Finals */}
          {finals.length > 0 && (
            <div className="wc-bracket-col finals">
              <h4 className="wc-bracket-col-title">Finals</h4>
              <div className="wc-bracket-nodes-list">
                {finals.map(renderBracketNode)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 3. Sub-Tab: Standings
  const renderStandings = () => {
    if (standings.length === 0) {
      return <div className="wc-empty-box">Standings are not available.</div>;
    }

    return (
      <div className="wc-standings-grid">
        {standings.map(group => (
          <div key={group.name} className="wc-standings-card">
            <h4 className="wc-group-title">{group.name}</h4>
            <div className="wc-group-table-wrap">
              <table className="wc-group-table">
                <thead>
                  <tr>
                    <th className="pos">#</th>
                    <th className="team-header">Team</th>
                    <th className="stat">GP</th>
                    <th className="stat">W</th>
                    <th className="stat">D</th>
                    <th className="stat">L</th>
                    <th className="stat">GD</th>
                    <th className="stat pts-col">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {group.teams.map(team => {
                    const isAdvancing = team.rank <= 2;
                    return (
                      <tr key={team.teamId} className={isAdvancing ? 'advancing-row' : ''}>
                        <td className="pos">
                          <span className={`rank-num ${isAdvancing ? 'advancing' : ''}`}>{team.rank}</span>
                        </td>
                        <td className="team-cell" onClick={() => setSelectedTeam({ id: team.teamId, name: team.name, logo: team.logo, leagueId: 'soccer-fifa.world' })}>
                          <img src={team.logo} alt="" className="flag" onError={e => e.currentTarget.style.display = 'none'} />
                          <span className="team-name" title={team.name}>{team.name}</span>
                        </td>
                        <td className="stat">{team.gp}</td>
                        <td className="stat">{team.w}</td>
                        <td className="stat">{team.d}</td>
                        <td className="stat">{team.l}</td>
                        <td className="stat gd-stat">{team.gd > 0 ? `+${team.gd}` : team.gd}</td>
                        <td className="stat pts-cell">{team.pts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 4. Sub-Tab: Matches
  const renderMatches = () => {
    return (
      <div className="wc-matches-tab">
        {/* Filters Bar */}
        <div className="wc-filters-bar">
          <div className="wc-filter-group">
            <label>Stage:</label>
            <select value={matchStageFilter} onChange={e => setMatchStageFilter(e.target.value)} className="wc-select">
              <option value="all">All Stages</option>
              <option value="group">Group Stage</option>
              <option value="knockout">Knockout Stage</option>
              <option value="round-of-32">Round of 32</option>
              <option value="round-of-16">Round of 16</option>
              <option value="quarterfinals">Quarterfinals</option>
              <option value="semifinals">Semifinals</option>
              <option value="final">Finals</option>
            </select>
          </div>
          
          <div className="wc-filter-group">
            <label>Date:</label>
            <select value={selectedDateStr} onChange={e => setSelectedDateStr(e.target.value)} className="wc-select">
              <option value="all">All Dates</option>
              {matchDates.map(date => {
                const dateObj = new Date(date + 'T12:00:00'); // prevent timezone shift
                const label = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                return <option key={date} value={date}>{label}</option>;
              })}
            </select>
          </div>
        </div>

        {/* Matches Grid */}
        {filteredMatches.length > 0 ? (
          <div className="wc-card-grid">
            {filteredMatches.map(event => (
              <GameCard
                key={event.id}
                event={event}
                onClick={() => setSelectedEvent(event)}
                onChannelClick={onSearchChannels}
                onSearchTeams={onSearchChannels}
                onPlayChannel={onPlayChannel}
              />
            ))}
          </div>
        ) : (
          <div className="wc-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            <p>No matches match the selected filters.</p>
          </div>
        )}
      </div>
    );
  };

  // 5. Sub-Tab: Teams
  const renderTeams = () => {
    if (Object.keys(teamsByGroup).length === 0) {
      return <div className="wc-empty-box">No teams data found.</div>;
    }

    return (
      <div className="wc-teams-tab">
        {Object.entries(teamsByGroup).map(([groupName, groupTeams]) => (
          <section key={groupName} className="wc-teams-group-section">
            <h4 className="wc-teams-group-header">{groupName}</h4>
            <div className="wc-teams-grid">
              {groupTeams.map(team => {
                const flagUrl = team.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/soccer/500/${team.id}.png`;
                return (
                  <button
                    key={team.id}
                    className="wc-team-button"
                    onClick={() => setSelectedTeam({ id: team.id, name: team.displayName, logo: flagUrl, leagueId: 'soccer-fifa.world' })}
                  >
                    <img src={flagUrl} alt="" className="wc-team-flag" onError={e => e.currentTarget.style.display = 'none'} />
                    <div className="wc-team-info">
                      <span className="wc-team-name">{team.displayName}</span>
                      <span className="wc-team-abbrev">{team.abbreviation}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  };

  return (
    <div className="wc-hub-container">
      {/* Visual Sub-tabs Navigator */}
      <div className="wc-subtabs-nav">
        <button className={`wc-subtab-btn ${activeSubTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveSubTab('overview')}>
          Overview
        </button>
        <button className={`wc-subtab-btn ${activeSubTab === 'bracket' ? 'active' : ''}`} onClick={() => setActiveSubTab('bracket')}>
          Bracket
        </button>
        <button className={`wc-subtab-btn ${activeSubTab === 'standings' ? 'active' : ''}`} onClick={() => setActiveSubTab('standings')}>
          Standings
        </button>
        <button className={`wc-subtab-btn ${activeSubTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveSubTab('matches')}>
          Matches
        </button>
        <button className={`wc-subtab-btn ${activeSubTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveSubTab('teams')}>
          Teams
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="wc-subtab-content">
        {activeSubTab === 'overview' && renderOverview()}
        {activeSubTab === 'bracket' && renderBracket()}
        {activeSubTab === 'standings' && renderStandings()}
        {activeSubTab === 'matches' && renderMatches()}
        {activeSubTab === 'teams' && renderTeams()}
      </div>

      {/* Game detail overlay modal */}
      {renderGameDetailModal()}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import type { SportsEvent } from '@ynotv/core';
import { GameDetail } from './GameDetail';

interface SportsCache {
  events: SportsEvent[];
  lastUpdated: Date | null;
  leagues: string[] | undefined;
}

function getSportsCache(): SportsCache {
  const w = window as unknown as { __sportsCache?: SportsCache };
  return w.__sportsCache ?? { events: [], lastUpdated: null, leagues: undefined };
}

function getStatusDisplay(event: SportsEvent): string {
  if (event.status !== 'live') return '';
  const sport = event.league.sport.toLowerCase();
  const period = event.period ? parseInt(event.period, 10) : 0;

  switch (sport) {
    case 'football':
      return `Q${event.period || '-'}${event.timeElapsed ? ' ' + event.timeElapsed : ''}`;
    case 'basketball':
      return `Q${event.period || '-'}${event.timeElapsed ? ' ' + event.timeElapsed : ''}`;
    case 'baseball': {
      const inningLabel = period > 9 ? `${period}th` :
        period === 1 ? '1st' :
          period === 2 ? '2nd' :
            period === 3 ? '3rd' :
              period ? `${period}th` : '';
      return `${inningLabel || '-'}${event.timeElapsed ? ' ' + event.timeElapsed : ''}`;
    }
    case 'hockey': {
      const periodLabel = period <= 3 ? `${period}${period === 1 ? 'st' : period === 2 ? 'nd' : period === 3 ? 'rd' : 'th'}` :
        period === 4 ? 'OT' :
          period === 5 ? 'SO' : `${period - 3}OT`;
      return `${periodLabel || '-'}${event.timeElapsed ? ' ' + event.timeElapsed : ''}`;
    }
    case 'soccer':
      return event.timeElapsed || 'LIVE';
    default:
      return event.timeElapsed || 'LIVE';
  }
}

export function SportsScoresOverlay() {
  const [liveEvents, setLiveEvents] = useState<SportsEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SportsEvent | null>(null);

  const updateFromCache = useCallback(() => {
    const cache = getSportsCache();
    const live = cache.events.filter(e => e.status === 'live');
    setLiveEvents(live);
  }, []);

  useEffect(() => {
    // Initial read
    updateFromCache();

    // Poll cache every 5 seconds to catch updates from LiveScoresTab
    const interval = setInterval(updateFromCache, 5000);

    // Also listen for visibility changes to refresh immediately when tab becomes visible
    const handleVisibility = () => {
      if (!document.hidden) updateFromCache();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [updateFromCache]);

  if (liveEvents.length === 0) return null;

  return (
    <>
      <div className="sports-scores-overlay">
        <div className="sports-scores-track">
          {liveEvents.map(event => {
            const awayWinning = (event.awayScore ?? 0) > (event.homeScore ?? 0);
            const homeWinning = (event.homeScore ?? 0) > (event.awayScore ?? 0);
            const statusText = getStatusDisplay(event);

            return (
              <div
                key={event.id}
                className="sports-score-item"
                onClick={() => setSelectedEvent(event)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedEvent(event);
                  }
                }}
              >
                <span className="sports-score-league">{event.league.name}</span>
                <div className="sports-score-matchup">
                  <span className="sports-score-block">
                    <span className={`sports-score-team ${awayWinning ? 'winning' : ''}`}>
                      {event.awayTeam.shortName || event.awayTeam.name}
                    </span>
                    <span className={`sports-score-value ${awayWinning ? 'winning' : ''}`}>
                      {event.awayScore ?? 0}
                    </span>
                  </span>
                  <span className="sports-score-vs">vs</span>
                  <span className="sports-score-block">
                    <span className={`sports-score-value ${homeWinning ? 'winning' : ''}`}>
                      {event.homeScore ?? 0}
                    </span>
                    <span className={`sports-score-team ${homeWinning ? 'winning' : ''}`}>
                      {event.homeTeam.shortName || event.homeTeam.name}
                    </span>
                  </span>
                </div>
                {statusText && (
                  <span className="sports-score-status">{statusText}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedEvent && (
        <GameDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          variant="glass"
        />
      )}
    </>
  );
}

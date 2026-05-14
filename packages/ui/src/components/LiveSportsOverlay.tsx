import { useState, useEffect, useCallback } from 'react';
import type { SportsEvent } from '@ynotv/core';
import { useSportsPolling } from '../hooks/useSportsPolling';
import { useSportsSettingsStore } from '../stores/sportsSettingsStore';
import { GameDetail } from './sports/GameDetail';

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

interface LiveSportsOverlayProps {
  mode: 'autohide' | 'persistent';
  showControls: boolean;
  activeView: string;
}

export function LiveSportsOverlay({ mode, showControls, activeView }: LiveSportsOverlayProps) {
  const [liveEvents, setLiveEvents] = useState<SportsEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SportsEvent | null>(null);

  // Load custom leagues from settings so we match the Sports page exactly
  const { liveLeagues, loaded, loadSettings } = useSportsSettingsStore();

  useEffect(() => {
    if (!loaded) {
      loadSettings();
    }
  }, [loaded, loadSettings]);

  // Start polling for live scores — this triggers fetching even if the user
  // never visited the Sports page, because the hook runs its own interval.
  const { events } = useSportsPolling({
    pollingInterval: 30000,
    enabled: true,
    leagues: loaded ? liveLeagues : undefined,
  });

  // Keep our local liveEvents in sync with the polled events
  useEffect(() => {
    const live = events.filter(e => e.status === 'live');
    setLiveEvents(live);
  }, [events]);

  // Visibility logic
  const isMainScreen = activeView === 'none';
  const isVisible = isMainScreen && (mode === 'persistent' || showControls);

  if (!isVisible || liveEvents.length === 0) {
    return null;
  }

  return (
    <>
      <div className={`live-sports-overlay${showControls ? '' : ' controls-hidden'}`}>
        <div className="live-sports-track">
          {liveEvents.map(event => {
            const awayWinning = (event.awayScore ?? 0) > (event.homeScore ?? 0);
            const homeWinning = (event.homeScore ?? 0) > (event.awayScore ?? 0);
            const statusText = getStatusDisplay(event);

            return (
              <div
                key={event.id}
                className="live-sports-score-item"
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
                <span className="live-sports-score-league">{event.league.name}</span>
                <div className="live-sports-score-matchup">
                  <span className="live-sports-score-block">
                    <span className={`live-sports-score-team ${awayWinning ? 'winning' : ''}`}>
                      {event.awayTeam.shortName || event.awayTeam.name}
                    </span>
                    <span className={`live-sports-score-value ${awayWinning ? 'winning' : ''}`}>
                      {event.awayScore ?? 0}
                    </span>
                  </span>
                  <span className="live-sports-score-vs">vs</span>
                  <span className="live-sports-score-block">
                    <span className={`live-sports-score-value ${homeWinning ? 'winning' : ''}`}>
                      {event.homeScore ?? 0}
                    </span>
                    <span className={`live-sports-score-team ${homeWinning ? 'winning' : ''}`}>
                      {event.homeTeam.shortName || event.homeTeam.name}
                    </span>
                  </span>
                </div>
                {statusText && (
                  <span className="live-sports-score-status">{statusText}</span>
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

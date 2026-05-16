import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import type { SportsEvent } from '@ynotv/core';
import { useSportsPolling } from '../hooks/useSportsPolling';
import { useSportsSettingsStore } from '../stores/sportsSettingsStore';
import { GameDetail } from './sports/GameDetail';
import { getHiddenEventIds, hideEvent, clearHiddenEvents } from '../utils/hiddenSportsEvents';

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
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => getHiddenEventIds());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; eventId: string } | null>(null);
  const [showRestore, setShowRestore] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

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

  // Track mouse position to show restore button when near right edge
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const rightZoneWidth = 200;
    if (mouseX >= rect.width - rightZoneWidth) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setShowRestore(true);
    } else {
      if (!hideTimerRef.current) {
        hideTimerRef.current = setTimeout(() => setShowRestore(false), 200);
      }
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => setShowRestore(false), 300);
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setContextMenu(null);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  const handleHideMatch = useCallback((eventId: string) => {
    hideEvent(eventId);
    setHiddenIds(getHiddenEventIds());
    setContextMenu(null);
  }, []);

  const handleClearHidden = useCallback(() => {
    clearHiddenEvents();
    setHiddenIds([]);
    setContextMenu(null);
    setShowRestore(false);
  }, []);

  // Filter out hidden events
  const visibleEvents = useMemo(() => liveEvents.filter(e => !hiddenIds.includes(e.id)), [liveEvents, hiddenIds]);

  // Check for overflow to enable ticker mode
  useLayoutEffect(() => {
    const checkOverflow = () => {
      if (trackRef.current && overlayRef.current) {
        // Calculate original content width exactly, ignoring duplicates or max-content
        let contentWidth = 0;
        const children = trackRef.current.children;
        for (let i = 0; i < visibleEvents.length; i++) {
          if (children[i]) {
            contentWidth += (children[i] as HTMLElement).offsetWidth + 16;
          }
        }
        if (contentWidth > 0) contentWidth -= 16;

        setIsOverflowing(contentWidth > overlayRef.current.clientWidth);
      }
    };

    // Need a tiny delay to allow DOM to layout flex items accurately if they just mounted
    const timer = setTimeout(checkOverflow, 50);
    window.addEventListener('resize', checkOverflow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [visibleEvents]);

  // Visibility logic
  const isMainScreen = activeView === 'none';
  const isVisible = isMainScreen && (mode === 'persistent' || showControls);

  if (!isVisible || visibleEvents.length === 0) {
    return null;
  }

  const hasHiddenMatches = hiddenIds.length > 0;

  return (
    <>
      <div
        ref={overlayRef}
        className={`live-sports-overlay${showControls ? '' : ' controls-hidden'}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div 
          ref={trackRef} 
          className={`live-sports-track ${isOverflowing ? 'is-ticker' : ''}`}
          style={isOverflowing ? { '--marquee-duration': `${visibleEvents.length * 4}s` } as React.CSSProperties : undefined}
        >
          {[...visibleEvents, ...(isOverflowing ? visibleEvents : [])].map((event, index) => {
            const awayWinning = (event.awayScore ?? 0) > (event.homeScore ?? 0);
            const homeWinning = (event.homeScore ?? 0) > (event.awayScore ?? 0);
            const statusText = getStatusDisplay(event);

            return (
              <div
                key={`${event.id}-${index}`}
                className="live-sports-score-item"
                onClick={() => setSelectedEvent(event)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY, eventId: event.id });
                }}
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

        {hasHiddenMatches && (
          <div
            ref={restoreRef}
            className={`live-sports-restore-area ${showRestore ? 'visible' : ''}`}
            onMouseEnter={() => {
              if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
              }
              setShowRestore(true);
            }}
            onMouseLeave={() => {
              hideTimerRef.current = setTimeout(() => setShowRestore(false), 300);
            }}
          >
            <button
              className="live-sports-restore-btn"
              onClick={handleClearHidden}
              title="Restore hidden matches"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span>Restore ({hiddenIds.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="live-sports-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="live-sports-context-menu-item" onClick={() => handleHideMatch(contextMenu.eventId)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
            Hide Match
          </div>
          {hasHiddenMatches && (
            <>
              <div className="live-sports-context-menu-separator" />
              <div className="live-sports-context-menu-item" onClick={handleClearHidden}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Restore All Hidden
              </div>
            </>
          )}
        </div>
      )}

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

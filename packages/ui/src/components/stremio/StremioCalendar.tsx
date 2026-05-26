import { useMemo, useState } from 'react';
import { useStremioLibraryStore, type LibraryItem } from '../../stores/stremioLibraryStore';
import { useStremioWatchStore } from '../../stores/stremioWatchStore';
import type { StremioMeta, StremioVideo } from '../../types/stremio';
import { useStremioAddonStore } from '../../stores/stremioAddonStore';
import { fetchMeta } from '../../services/stremio-addon';
import './StremioCalendar.css';

interface StremioCalendarProps {
  onItemClick: (meta: StremioMeta) => void;
}

interface CalendarEpisode {
  series: LibraryItem;
  video: StremioVideo;
  date: Date;
  watched: boolean;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function isThisWeek(date: Date): boolean {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  return date >= weekStart && date < weekEnd;
}

function getDaysInMonth(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];

  const startPad = firstDay.getDay();
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push(d);
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ViewMode = 'calendar' | 'list';

export function StremioCalendar({ onItemClick }: StremioCalendarProps) {
  const library = useStremioLibraryStore((s) => s.library);
  const addons = useStremioAddonStore((s) => s.enabledAddons);
  const episodeProgress = useStremioWatchStore((s) => s.episodeProgress || {});

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());

  const seriesItems = useMemo(() => library.filter((item) => item.type === 'series' && item.videos), [library]);

  const allEpisodes = useMemo(() => {
    const result: CalendarEpisode[] = [];
    for (const series of seriesItems) {
      for (const video of series.videos || []) {
        if (!video.released) continue;
        const d = new Date(video.released);
        if (isNaN(d.getTime())) continue;
        const watched = episodeProgress[video.id]?.finished ?? false;
        result.push({ series, video, date: d, watched });
      }
    }
    return result;
  }, [seriesItems, episodeProgress]);

  const episodesByDate = useMemo(() => {
    const map: Record<string, CalendarEpisode[]> = {};
    for (const ep of allEpisodes) {
      const key = ep.date.toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(ep);
    }
    return map;
  }, [allEpisodes]);

  const calendarDays = useMemo(
    () => getDaysInMonth(calendarYear, calendarMonth),
    [calendarYear, calendarMonth]
  );

  const handlePrevMonth = () => {
    setCalendarMonth((m) => {
      if (m === 0) { setCalendarYear((y) => y - 1); return 11; }
      return m - 1;
    });
  };

  const handleNextMonth = () => {
    setCalendarMonth((m) => {
      if (m === 11) { setCalendarYear((y) => y + 1); return 0; }
      return m + 1;
    });
  };

  const todayEpisodes = useMemo(
    () => allEpisodes.filter((e) => isToday(e.date)).sort((a, b) => a.date.getTime() - b.date.getTime()),
    [allEpisodes]
  );

  const thisWeekEpisodes = useMemo(
    () => allEpisodes.filter((e) => isThisWeek(e.date) && !isToday(e.date)).sort((a, b) => a.date.getTime() - b.date.getTime()),
    [allEpisodes]
  );

  const upcomingEpisodes = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return allEpisodes
      .filter((e) => e.date >= now && !isThisWeek(e.date))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 50);
  }, [allEpisodes]);

  const recentEpisodes = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(now.getDate() - 14);
    return allEpisodes
      .filter((e) => e.date >= twoWeeksAgo && e.date < now)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [allEpisodes]);

  const handleEpisodeClick = async (episode: CalendarEpisode) => {
    const addon = addons.find((a) => a.manifest.catalogs?.some((c) => c.type === 'series'));
    if (addon) {
      const meta = await fetchMeta([addon], 'series', episode.series.id);
      if (meta) onItemClick(meta);
    }
  };

  const monthLabel = new Date(calendarYear, calendarMonth).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const renderEpisodeCard = (ep: CalendarEpisode) => (
    <div
      key={`${ep.series.id}:${ep.video.id}`}
      className={`stremio-cal-ep-card${ep.watched ? ' stremio-cal-ep-watched' : ''}`}
      onClick={() => handleEpisodeClick(ep)}
    >
      {ep.series.poster && (
        <img
          className="stremio-cal-ep-poster"
          src={ep.series.poster}
          alt={ep.series.name}
          loading="lazy"
        />
      )}
      <div className="stremio-cal-ep-info">
        <div className="stremio-cal-ep-series">{ep.series.name}</div>
        <div className="stremio-cal-ep-title">
          {ep.video.season !== undefined && ep.video.episode !== undefined
            ? `S${ep.video.season} E${ep.video.episode}`
            : ''}
          {ep.video.title ? ` - ${ep.video.title}` : ''}
        </div>
        {ep.watched && <div className="stremio-cal-ep-watched-label">Watched</div>}
      </div>
      <div className="stremio-cal-ep-date">{formatDate(ep.date)}</div>
    </div>
  );

  return (
    <div className="stremio-calendar">
      <div className="stremio-calendar-header">
        <h2 className="stremio-calendar-title">Calendar</h2>
        <div className="stremio-cal-view-toggle">
          <button
            className={`stremio-cal-view-btn${viewMode === 'calendar' ? ' active' : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            Calendar
          </button>
          <button
            className={`stremio-cal-view-btn${viewMode === 'list' ? ' active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            List
          </button>
        </div>
      </div>

      {allEpisodes.length === 0 ? (
        <div className="stremio-calendar-empty">
          Add series to your library to see upcoming episode air dates.
        </div>
      ) : (
        <div className="stremio-calendar-content">
          {viewMode === 'calendar' && (
            <div className="stremio-calendar-grid-section">
              <div className="stremio-cal-grid-header">
                <button className="stremio-cal-grid-nav" onClick={handlePrevMonth}>‹</button>
                <span className="stremio-cal-grid-month">{monthLabel}</span>
                <button className="stremio-cal-grid-nav" onClick={handleNextMonth}>›</button>
              </div>

              <div className="stremio-cal-weekdays">
                {WEEKDAY_LABELS.map((d) => (
                  <div key={d} className="stremio-cal-weekday">{d}</div>
                ))}
              </div>

              <div className="stremio-cal-grid">
                {calendarDays.map((date) => {
                  const dateKey = date.toISOString().slice(0, 10);
                  const eps = episodesByDate[dateKey] ?? [];
                  const isCurrentMonth = date.getMonth() === calendarMonth;
                  const isTodayDate = isToday(date);

                  return (
                    <div
                      key={dateKey}
                      className={`stremio-cal-day${!isCurrentMonth ? ' other-month' : ''}${isTodayDate ? ' today' : ''}`}
                    >
                      <div className="stremio-cal-daynum">{date.getDate()}</div>
                      <div className="stremio-cal-daycontent">
                        {eps.slice(0, 3).map((ep, i) => (
                          <div
                            key={i}
                            className={`stremio-cal-grid-ep${ep.watched ? ' watched' : ''}`}
                            onClick={() => handleEpisodeClick(ep)}
                            title={`${ep.series.name} S${ep.video.season ?? '?'}E${ep.video.episode ?? '?'}`}
                          >
                        <span className="stremio-cal-grid-ep-se">
                            S{ep.video.season ?? '?'}E{ep.video.episode ?? '?'}
                          </span>
                          <span className="stremio-cal-grid-ep-name">{ep.series.name}</span>
                          </div>
                        ))}
                        {eps.length > 3 && (
                          <div className="stremio-cal-grid-more">+{eps.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === 'list' && (
            <>
              {todayEpisodes.length > 0 && (
                <section className="stremio-cal-section">
                  <h3 className="stremio-cal-section-title">
                    Today
                    <span className="stremio-cal-section-count">{todayEpisodes.length}</span>
                  </h3>
                  <div className="stremio-cal-ep-list">
                    {todayEpisodes.map(renderEpisodeCard)}
                  </div>
                </section>
              )}

              {thisWeekEpisodes.length > 0 && (
                <section className="stremio-cal-section">
                  <h3 className="stremio-cal-section-title">
                    This Week
                    <span className="stremio-cal-section-count">{thisWeekEpisodes.length}</span>
                  </h3>
                  <div className="stremio-cal-ep-list">
                    {thisWeekEpisodes.map(renderEpisodeCard)}
                  </div>
                </section>
              )}

              {upcomingEpisodes.length > 0 && (
                <section className="stremio-cal-section">
                  <h3 className="stremio-cal-section-title">
                    Upcoming
                    <span className="stremio-cal-section-count">{upcomingEpisodes.length}</span>
                  </h3>
                  <div className="stremio-cal-ep-list">
                    {upcomingEpisodes.map(renderEpisodeCard)}
                  </div>
                </section>
              )}

              {recentEpisodes.length > 0 && (
                <section className="stremio-cal-section">
                  <h3 className="stremio-cal-section-title">
                    Recently Aired
                    <span className="stremio-cal-section-count">{recentEpisodes.length}</span>
                  </h3>
                  <div className="stremio-cal-ep-list">
                    {recentEpisodes.map(renderEpisodeCard)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

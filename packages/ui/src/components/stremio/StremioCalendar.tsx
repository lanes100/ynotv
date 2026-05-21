import { useMemo } from 'react';
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

export function StremioCalendar({ onItemClick }: StremioCalendarProps) {
  const library = useStremioLibraryStore((s) => s.library);
  const addons = useStremioAddonStore((s) => s.enabledAddons);
  const episodeProgress = useStremioWatchStore((s) => s.episodeProgress);

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
      </div>

      {allEpisodes.length === 0 ? (
        <div className="stremio-calendar-empty">
          Add series to your library to see upcoming episode air dates.
        </div>
      ) : (
        <div className="stremio-calendar-content">
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
        </div>
      )}
    </div>
  );
}
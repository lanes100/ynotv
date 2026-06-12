import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { StremioMeta } from '../../types/stremio';
import { useTmdbAccessToken } from '../../hooks/useTmdbLists';
import { getPersonDetails, getTmdbImageUrl } from '../../services/tmdb';
import { useStremioNavigate } from '../../stores/uiStore';
import './StremioPersonDetail.css';

// Helper sets for creative roles
const WRITER_JOBS = new Set([
  'Writer',
  'Screenplay',
  'Story',
  'Teleplay',
  'Author',
  'Novel',
  'Original Story',
]);
const PRODUCER_JOBS = new Set(['Producer', 'Executive Producer']);
const DIRECTOR_JOBS = new Set(['Director']);

export interface PersonCredit {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  character?: string;
  job?: string;
  department?: string;
  popularity: number;
}

export interface PersonDetail {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  known_for_department: string;
  profile_path: string | null;
  imdb_id: string | null;
  homepage: string | null;
  combined_credits?: {
    cast: PersonCredit[];
    crew: PersonCredit[];
  };
}

interface StremioPersonDetailProps {
  personId: number;
  onBack: () => void;
  onItemClick: (meta: StremioMeta) => void;
}

// Helper functions for scoring and sorting
function notableScore(c: PersonCredit): number {
  const votes = c.vote_count ?? 0;
  if (c.media_type === 'tv') {
    const epBoost = 2.0; // TMDB credits usually don't have episode count in simple responses, use constant boost
    return votes * epBoost;
  }
  return votes;
}

function dedupe(credits: PersonCredit[]): PersonCredit[] {
  const map = new Map<string, PersonCredit>();
  for (const c of credits) {
    const k = `${c.media_type}:${c.id}:${c.job ?? ''}`;
    const existing = map.get(k);
    if (!existing || existing.popularity < c.popularity) map.set(k, c);
  }
  return [...map.values()];
}

function dedupeByMedia(credits: PersonCredit[]): PersonCredit[] {
  const map = new Map<string, PersonCredit>();
  for (const c of credits) {
    const k = `${c.media_type}:${c.id}`;
    const existing = map.get(k);
    if (!existing || existing.popularity < c.popularity) map.set(k, c);
  }
  return [...map.values()];
}

function calcAge(birth: string, death: string | null): number | null {
  const b = parseFlexibleDate(birth);
  if (!b) return null;
  const end = death ? (parseFlexibleDate(death) ?? new Date()) : new Date();
  let age = end.getFullYear() - b.getFullYear();
  const m = end.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < b.getDate())) age--;
  return age;
}

function fmtDate(s: string): string {
  const d = parseFlexibleDate(s);
  if (!d) return s;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function parseFlexibleDate(s: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    const y = Number(dateOnly[1]);
    const m = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const d = new Date(y, m - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function creditToStremioMeta(c: PersonCredit): StremioMeta {
  const isTV = c.media_type === 'tv';
  const dateStr = c.release_date || c.first_air_date;
  return {
    id: `tmdb:${c.id}`,
    type: isTV ? 'series' : 'movie',
    name: c.title || c.name || '',
    poster: c.poster_path ? `https://image.tmdb.org/t/p/w342${c.poster_path}` : undefined,
    background: c.backdrop_path ? `https://image.tmdb.org/t/p/original${c.backdrop_path}` : undefined,
    description: '',
    year: dateStr ? parseInt(dateStr.slice(0, 4), 10) : undefined,
    imdbRating: c.vote_average > 0 ? String(c.vote_average.toFixed(1)) : undefined,
  };
}

export function StremioPersonDetail({ personId, onBack, onItemClick }: StremioPersonDetailProps) {
  const tmdbToken = useTmdbAccessToken();
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tmdbToken || !personId) return;
    let cancelled = false;
    setLoading(true);

    getPersonDetails(tmdbToken, personId)
      .then((data) => {
        if (cancelled) return;
        setPerson(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[StremioPersonDetail] Failed to load person details:', err);
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [personId, tmdbToken]);

  // Sort and filter credits
  const castCredits = useMemo(() => person?.combined_credits?.cast || [], [person]);
  const crewCredits = useMemo(() => person?.combined_credits?.crew || [], [person]);

  const sortedCast = useMemo(
    () => dedupe(castCredits).sort((a, b) => b.popularity - a.popularity),
    [castCredits]
  );
  const sortedCrew = useMemo(
    () => crewCredits.slice().sort((a, b) => b.popularity - a.popularity),
    [crewCredits]
  );

  const knownFor = useMemo(() => {
    if (!person) return [];
    const dept = person.known_for_department;
    const pool =
      dept === 'Acting' || !dept
        ? sortedCast.filter((c) => {
            const ch = (c.character ?? '').toLowerCase();
            return !ch.includes('(uncredited)') && !ch.includes('archive footage');
          })
        : dedupeByMedia(sortedCrew.filter((c) => c.department === dept));
    return pool
      .slice()
      .sort((a, b) => notableScore(b) - notableScore(a))
      .slice(0, 12);
  }, [sortedCast, sortedCrew, person]);

  const movies = useMemo(() => sortedCast.filter((c) => c.media_type === 'movie'), [sortedCast]);
  const shows = useMemo(() => sortedCast.filter((c) => c.media_type === 'tv'), [sortedCast]);
  
  const directing = useMemo(() => dedupe(sortedCrew.filter((c) => DIRECTOR_JOBS.has(c.job ?? ''))), [sortedCrew]);
  const writing = useMemo(() => dedupe(sortedCrew.filter((c) => WRITER_JOBS.has(c.job ?? ''))), [sortedCrew]);
  const producing = useMemo(() => dedupe(sortedCrew.filter((c) => PRODUCER_JOBS.has(c.job ?? ''))), [sortedCrew]);
  const otherCrew = useMemo(() => dedupe(
    sortedCrew.filter(
      (c) =>
        !DIRECTOR_JOBS.has(c.job ?? '') &&
        !WRITER_JOBS.has(c.job ?? '') &&
        !PRODUCER_JOBS.has(c.job ?? '')
    )
  ), [sortedCrew]);

  const photo = person?.profile_path ? getTmdbImageUrl(person.profile_path, 'h632') : undefined;
  const backdrop = useMemo(() => {
    const withBackdrop = knownFor.find((c) => c.backdrop_path);
    return withBackdrop ? `https://image.tmdb.org/t/p/original${withBackdrop.backdrop_path}` : undefined;
  }, [knownFor]);

  const age = person?.birthday ? calcAge(person.birthday, person.deathday) : null;

  if (loading) {
    return (
      <div className="stremio-person-detail loading">
        <div className="stremio-spinner" />
        <span>Loading profile...</span>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="stremio-person-detail error">
        <button className="stremio-person-back-btn" onClick={onBack}>← Back</button>
        <div className="error-message">Profile not found.</div>
      </div>
    );
  }

  return (
    <div className="stremio-person-detail" ref={scrollRef}>
      {/* Dynamic blurred backdrop bleed */}
      {backdrop && (
        <div className="stremio-person-backdrop-bleed">
          <div
            className="backdrop-image"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
          <div className="backdrop-overlay" />
        </div>
      )}

      {/* Main Container */}
      <div className="stremio-person-content">
        {/* Navigation */}
        <button className="stremio-person-back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Profile Header */}
        <div className="stremio-person-header">
          <div className="stremio-person-avatar-wrap">
            <Poster src={photo || undefined} seed={person.name} />
          </div>

          <div className="stremio-person-info">
            {person.known_for_department && (
              <span className="info-dept">{person.known_for_department}</span>
            )}
            <h1 className="info-name">{person.name}</h1>

            <div className="info-meta">
              {person.birthday && (
                <BirthdayLink birthday={person.birthday} age={age} />
              )}
              {person.deathday && <span className="meta-died">Died {fmtDate(person.deathday)}</span>}
              {person.place_of_birth && <PlaceLink place={person.place_of_birth} />}
            </div>

            {person.biography && (
              <Bio
                text={person.biography}
                credits={[...castCredits, ...crewCredits]}
                onOpenCredit={onItemClick}
              />
            )}
          </div>
        </div>

        {/* Filmography Rows */}
        <div className="stremio-person-filmography">
          {knownFor.length > 0 && (
            <FilmRow title="Known For" credits={knownFor} showRole={false} onItemClick={onItemClick} />
          )}
          {movies.length > 0 && (
            <FilmRow title={`Movies · ${movies.length}`} credits={movies} showRole onItemClick={onItemClick} />
          )}
          {shows.length > 0 && (
            <FilmRow title={`TV Shows · ${shows.length}`} credits={shows} showRole onItemClick={onItemClick} />
          )}
          {directing.length > 0 && (
            <FilmRow title="Directing" credits={directing} showRole onItemClick={onItemClick} />
          )}
          {writing.length > 0 && (
            <FilmRow title="Writing" credits={writing} showRole onItemClick={onItemClick} />
          )}
          {producing.length > 0 && (
            <FilmRow title="Producing" credits={producing} showRole onItemClick={onItemClick} />
          )}
          {otherCrew.length > 0 && otherCrew.length > 3 && (
            <FilmRow title="Other Work" credits={otherCrew.slice(0, 24)} showRole onItemClick={onItemClick} />
          )}

          {sortedCast.length === 0 && sortedCrew.length === 0 && (
            <div className="no-credits">No filmography on record.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Subcomponents: Poster with hashing background gradient
function Poster({ src, seed }: { src?: string; seed: string }) {
  const [failed, setFailed] = useState(false);
  const showGradient = !src || failed;

  const hash = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
    return Math.abs(h);
  };

  const gradient = (hue: number) => {
    const a = hue;
    const b = (hue + 140) % 360;
    const c = (hue + 60) % 360;
    return `radial-gradient(ellipse at 25% 30%, hsl(${a}, 60%, 25%) 0%, transparent 55%),
            radial-gradient(ellipse at 75% 75%, hsl(${b}, 50%, 15%) 0%, transparent 55%),
            linear-gradient(135deg, hsl(${c}, 30%, 12%), hsl(${b}, 30%, 8%))`;
  };

  const hue = hash(seed) % 360;

  return (
    <div
      className="person-poster"
      style={showGradient ? { background: gradient(hue) } : undefined}
    >
      {!showGradient && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="poster-img"
        />
      )}
    </div>
  );
}

// Subcomponent: Biography with linked films
function Bio({
  text,
  credits,
  onOpenCredit,
}: {
  text: string;
  credits: PersonCredit[];
  onOpenCredit: (meta: StremioMeta) => void;
}) {
  const content = useMemo(() => {
    if (!credits || credits.length === 0) return null;
    
    // Group credits by title to find matches
    const byTitle = new Map<string, PersonCredit>();
    for (const c of credits) {
      const t = (c.title || c.name || '').trim();
      if (!t || t.length < 4) continue;
      const existing = byTitle.get(t);
      if (!existing || c.popularity > existing.popularity) {
        byTitle.set(t, c);
      }
    }
    if (byTitle.size === 0) return null;

    // Create sorted patterns
    const titles = [...byTitle.keys()].sort((a, b) => b.length - a.length);
    const pattern = titles.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const rx = new RegExp(`(?<![a-zA-Z0-9])(${pattern})(?![a-zA-Z0-9])`, 'g');
    const parts = text.split(rx);

    return parts.map((part, i) => {
      const credit = byTitle.get(part);
      if (!credit) return <span key={i}>{part}</span>;
      return (
        <button
          key={i}
          type="button"
          onClick={() => onOpenCredit(creditToStremioMeta(credit))}
          className="bio-film-link"
        >
          {part}
        </button>
      );
    });
  }, [text, credits, onOpenCredit]);

  return (
    <div className="person-bio-container">
      <div className="person-bio-scroll">
        <p className="bio-text">{content ?? text}</p>
      </div>
    </div>
  );
}

// Subcomponents: Birthday & Place links (IMDb)
function BirthdayLink({ birthday, age }: { birthday: string; age: number | null }) {
  const date = new Date(birthday);
  const fmt = fmtDate(birthday);

  if (Number.isNaN(date.getTime())) {
    return (
      <span className="meta-birth">
        Born {fmt}
        {age != null && ` · Age ${age}`}
      </span>
    );
  }

  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  
  const handleOpen = () => {
    window.open(`https://www.imdb.com/search/name/?birth_monthday=${m}-${d}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleOpen}
      className="meta-birth-link"
      title="See others born this day"
    >
      Born {fmt}
      {age != null && ` · Age ${age}`}
    </button>
  );
}

function PlaceLink({ place }: { place: string }) {
  const handleOpen = () => {
    const q = encodeURIComponent(place);
    window.open(`https://www.imdb.com/search/name/?birth_place=${q}`, '_blank', 'noopener,noreferrer');
  };
  return (
    <button
      onClick={handleOpen}
      className="meta-place-link"
      title="See others from this place"
    >
      {place}
    </button>
  );
}

// Subcomponents: Film Row & Card
function FilmRow({
  title,
  credits,
  showRole,
  onItemClick,
}: {
  title: string;
  credits: PersonCredit[];
  showRole: boolean;
  onItemClick: (meta: StremioMeta) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScroll();
    window.addEventListener('resize', updateScroll);
    return () => window.removeEventListener('resize', updateScroll);
  }, [updateScroll, credits.length]);

  const handleScroll = () => {
    updateScroll();
  };

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollTo({ left: el.scrollLeft + (dir === 'left' ? -amount : amount), behavior: 'smooth' });
  };

  return (
    <section className="person-row">
      <div className="person-row-header">
        <h3 className="person-row-title">{title}</h3>
        <div className="person-row-nav">
          <button className="person-row-nav-btn" onClick={() => scroll('left')} disabled={!canScrollLeft}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button className="person-row-nav-btn" onClick={() => scroll('right')} disabled={!canScrollRight}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      <div className="person-row-scroll-wrap">
        <div className="person-row-scroll" ref={scrollRef} onScroll={handleScroll}>
          <div className="person-row-track">
            {credits.map((c, i) => (
              <FilmCard key={`${c.media_type}-${c.id}-${i}`} credit={c} showRole={showRole} onClick={onItemClick} />
            ))}
          </div>
        </div>
        {canScrollLeft && <div className="person-row-fade person-row-fade-left" />}
        {canScrollRight && <div className="person-row-fade person-row-fade-right" />}
      </div>
    </section>
  );
}

function FilmCard({
  credit,
  showRole,
  onClick,
}: {
  credit: PersonCredit;
  showRole: boolean;
  onClick: (meta: StremioMeta) => void;
}) {
  const role = credit.character?.trim() || credit.job?.trim() || '';
  const releaseYear = (credit.release_date || credit.first_air_date)?.slice(0, 4) || '';
  const meta = useMemo(() => creditToStremioMeta(credit), [credit]);

  return (
    <button
      onClick={() => onClick(meta)}
      className="person-film-card"
    >
      <div className="film-poster-wrap">
        <Poster
          src={meta.poster}
          seed={`${credit.media_type}-${credit.id}`}
        />
        {credit.vote_average > 0 && (
          <div className="film-rating-badge">
            ★ {credit.vote_average.toFixed(1)}
          </div>
        )}
      </div>
      <div className="film-card-info">
        <p className="film-title">{meta.name}</p>
        {showRole && (role || releaseYear) && (
          <p className="film-role">
            {[role, releaseYear].filter(Boolean).join(' · ')}
          </p>
        )}
        {!showRole && releaseYear && (
          <p className="film-role">{releaseYear}</p>
        )}
      </div>
    </button>
  );
}

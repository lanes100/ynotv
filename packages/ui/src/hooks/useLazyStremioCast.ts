import { useState, useEffect, useRef } from 'react';
import type { StremioMeta } from '../types/stremio';
import { getTmdb, getTmdbImageUrl } from '../services/tmdb';
import { searchMovies, searchTvShows, getMovieCredits, getTvShowCredits } from '../services/tmdb';

export interface StremioCastMember {
  name: string;
  character: string;
  photo: string | null;
}

interface StremioCastResult {
  cast: StremioCastMember[];
  loading: boolean;
}

export function useLazyStremioCast(
  meta: StremioMeta | null,
  accessToken: string | null
): StremioCastResult {
  const [cast, setCast] = useState<StremioCastMember[]>([]);
  const [loading, setLoading] = useState(false);
  const lastMetaIdRef = useRef<string | null>(null);
  const fetchingRef = useRef(false);
  const metaId = meta?.id ?? null;

  if (metaId !== lastMetaIdRef.current) {
    lastMetaIdRef.current = metaId;
    setCast([]);
  }

  useEffect(() => {
    if (!meta || !accessToken) return;
    if (fetchingRef.current) return;

    let cancelled = false;

    const fetchCast = async () => {
      fetchingRef.current = true;
      setLoading(true);

      try {
        const isSeries = meta.type === 'series';
        const title = meta.name;
        const year = meta.year;

        let tmdbId: number | null = null;

        if (isSeries) {
          const results = await searchTvShows(accessToken, title, year ? parseInt(String(year)) : undefined);
          if (!cancelled && results.length > 0) {
            tmdbId = results[0].id;
          }
        } else {
          const results = await searchMovies(accessToken, title, year ? parseInt(String(year)) : undefined);
          if (!cancelled && results.length > 0) {
            tmdbId = results[0].id;
          }
        }

        if (!tmdbId || cancelled) {
          fetchingRef.current = false;
          setLoading(false);
          return;
        }

        if (isSeries) {
          const credits = await getTvShowCredits(accessToken, tmdbId);
          if (!cancelled && credits.cast) {
            setCast(
              credits.cast.slice(0, 12).map((c: any) => ({
                name: c.name,
                character: c.character,
                photo: c.profile_path ? getTmdbImageUrl(c.profile_path, 'w185') : null,
              }))
            );
          }
        } else {
          const credits = await getMovieCredits(accessToken, tmdbId);
          if (!cancelled && credits.cast) {
            setCast(
              credits.cast.slice(0, 12).map((c: any) => ({
                name: c.name,
                character: c.character,
                photo: c.profile_path ? getTmdbImageUrl(c.profile_path, 'w185') : null,
              }))
            );
          }
        }
      } catch {
        // Silently fail
      } finally {
        fetchingRef.current = false;
        if (!cancelled) setLoading(false);
      }
    };

    fetchCast();

    return () => {
      cancelled = true;
      fetchingRef.current = false;
    };
  }, [meta?.id, meta?.name, meta?.year, meta?.type, accessToken]);

  return { cast, loading };
}
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

        // 1. Try to get TMDB ID directly from meta ID if it starts with tmdb:
        if (meta.id.startsWith('tmdb:')) {
          tmdbId = parseInt(meta.id.replace('tmdb:', ''), 10);
        }

        // 2. Try to get it from moviedb_id
        if (!tmdbId && (meta as any).moviedb_id) {
          tmdbId = parseInt(String((meta as any).moviedb_id), 10);
        }

        // 3. Try finding it by IMDb ID via TMDB find API
        if (!tmdbId && meta.id.startsWith('tt')) {
          try {
            const tmdb = getTmdb(accessToken);
            const findResult = await tmdb.find.byExternalId(meta.id, { external_source: 'imdb_id' });
            if (isSeries) {
              tmdbId = findResult.tv_results?.[0]?.id || null;
            } else {
              tmdbId = findResult.movie_results?.[0]?.id || null;
            }
          } catch (err) {
            console.error('[TMDB] Find by IMDb ID failed in cast hook:', err);
          }
        }

        // 4. Fallback to title/year search
        if (!tmdbId) {
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
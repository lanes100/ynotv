import { useState, useEffect, useRef } from 'react';
import type { StremioMeta } from '../types/stremio';
import { searchMovies, searchTvShows, getMovieVideos, getTvShowVideos, findTrailerUrl } from '../services/tmdb';

interface StremioTrailerResult {
  trailerUrl: string | null;
  loading: boolean;
}

export function useLazyStremioTrailer(
  meta: StremioMeta | null,
  accessToken: string | null
): StremioTrailerResult {
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastMetaIdRef = useRef<string | null>(null);
  const fetchingRef = useRef(false);
  const metaId = meta?.id ?? null;

  if (metaId !== lastMetaIdRef.current) {
    lastMetaIdRef.current = metaId;
    setTrailerUrl(null);
  }

  useEffect(() => {
    if (!meta || !accessToken) return;
    if (fetchingRef.current) return;

    let cancelled = false;

    const fetchTrailer = async () => {
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

        const videos = isSeries
          ? await getTvShowVideos(accessToken, tmdbId)
          : await getMovieVideos(accessToken, tmdbId);

        if (!cancelled) {
          const url = findTrailerUrl(videos);
          setTrailerUrl(url);
        }
      } catch {
        // Silently fail
      } finally {
        fetchingRef.current = false;
        if (!cancelled) setLoading(false);
      }
    };

    fetchTrailer();

    return () => {
      cancelled = true;
      fetchingRef.current = false;
    };
  }, [meta?.id, meta?.name, meta?.year, meta?.type, accessToken]);

  return { trailerUrl, loading };
}

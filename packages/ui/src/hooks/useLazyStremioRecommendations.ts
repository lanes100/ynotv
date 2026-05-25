import { useState, useEffect, useRef } from 'react';
import type { StremioMeta } from '../types/stremio';
import { getTmdbImageUrl, TMDB_POSTER_SIZES } from '../services/tmdb';
import {
  searchMovies,
  searchTvShows,
  getMovieRecommendations,
  getTvShowRecommendations,
} from '../services/tmdb';

export interface RecommendationItem {
  id: number;
  title: string;
  year: string;
  posterUrl: string | null;
  rating: number;
}

interface RecommendationsResult {
  items: RecommendationItem[];
  loading: boolean;
}

export function useLazyStremioRecommendations(
  meta: StremioMeta | null,
  accessToken: string | null
): RecommendationsResult {
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const lastMetaIdRef = useRef<string | null>(null);
  const fetchingRef = useRef(false);
  const metaId = meta?.id ?? null;

  if (metaId !== lastMetaIdRef.current) {
    lastMetaIdRef.current = metaId;
    setItems([]);
  }

  useEffect(() => {
    if (!meta || !accessToken) return;
    if (fetchingRef.current) return;

    let cancelled = false;

    const fetchRecommendations = async () => {
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

        const recs = isSeries
          ? await getTvShowRecommendations(accessToken, tmdbId)
          : await getMovieRecommendations(accessToken, tmdbId);

        if (!cancelled) {
          setItems(
            recs.slice(0, 20).map((r: any) => ({
              id: r.id,
              title: r.title || r.name || '',
              year: (r.release_date || r.first_air_date || '').slice(0, 4),
              posterUrl: r.poster_path ? getTmdbImageUrl(r.poster_path, TMDB_POSTER_SIZES.medium) : null,
              rating: r.vote_average || 0,
            }))
          );
        }
      } catch {
      } finally {
        fetchingRef.current = false;
        if (!cancelled) setLoading(false);
      }
    };

    fetchRecommendations();

    return () => {
      cancelled = true;
      fetchingRef.current = false;
    };
  }, [meta?.id, meta?.name, meta?.year, meta?.type, accessToken]);

  return { items, loading };
}

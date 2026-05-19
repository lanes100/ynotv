/**
 * useLazySeriesExtras - Lazy-load episode images, summaries, air dates, ratings,
 * and series logo from TMDB or TVMaze on demand.
 *
 * Fetches per-episode metadata and series logo:
 * - TMDB API (if API key configured) - primary source
 * - TVMaze API (free, no key required) - fallback for TV series
 *
 * Caches result to DB so we don't refetch.
 */

import { useState, useEffect, useRef } from 'react';
import { db, type StoredSeries } from '../db';
import { getTmdb, getTmdbImageUrl, searchTvShows } from '../services/tmdb';
import { getShowEpisodes, getTvShowMetadata } from '../services/tvmaze';
import { cleanTitleForSearch } from '../utils/cleanTitle';

export interface EpisodeExtra {
  image: string | null;
  summary: string | null;
  airDate: string | null;
  rating: number | null;
}

export interface SeriesExtras {
  logoUrl: string | null;
  episodeExtras: Map<string, EpisodeExtra>;
  loading: boolean;
}

/**
 * Lazy-load episode extras and series logo
 */
export function useLazySeriesExtras(
  series: StoredSeries | null | undefined,
  apiKey: string | null | undefined
): SeriesExtras {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [episodeExtras, setEpisodeExtras] = useState<Map<string, EpisodeExtra>>(new Map());
  const [loading, setLoading] = useState(false);
  const lastSeriesIdRef = useRef<string | null>(null);
  const fetchingRef = useRef(false);

  const seriesId = series?.series_id ?? null;

  // Reset when series changes
  if (seriesId !== lastSeriesIdRef.current) {
    lastSeriesIdRef.current = seriesId;
    setLogoUrl(null);
    setEpisodeExtras(new Map());
  }

  useEffect(() => {
    if (!series) return;

    // Don't double-fetch
    if (fetchingRef.current) return;

    let cancelled = false;

    const fetchExtras = async () => {
      fetchingRef.current = true;
      setLoading(true);

      try {
        const searchQuery = cleanTitleForSearch(series.title || series.name);
        if (!searchQuery) {
          fetchingRef.current = false;
          setLoading(false);
          return;
        }

        let foundTmdbId: number | null = series.tmdb_id || null;
        let newLogo: string | null = null;
        const newExtras = new Map<string, EpisodeExtra>();

        // ── TMDB path ────────────────────────────────────────────────
        if (apiKey) {
          const tmdb = getTmdb(apiKey);

          // Resolve TMDB ID if missing
          if (!foundTmdbId) {
            try {
              const results = await searchTvShows(apiKey, searchQuery, series.year ? parseInt(series.year) : undefined);
              if (!cancelled && results.length > 0) {
                foundTmdbId = results[0].id;
              }
            } catch (e) {
              console.warn('[useLazySeriesExtras] TMDB search failed:', e);
            }
          }

          if (foundTmdbId) {
            // Fetch series images for logo
            try {
              const images = await tmdb.tvShows.images(foundTmdbId);
              if (!cancelled && images.logos && images.logos.length > 0) {
                // Prefer English logo, fallback to first
                const logo = images.logos.find(l => l.iso_639_1 === 'en') || images.logos[0];
                newLogo = getTmdbImageUrl(logo.file_path, 'original');
              }
            } catch (e) {
              console.warn('[useLazySeriesExtras] TMDB images fetch failed:', e);
            }

            // Fetch season details for each season to get episode metadata
            if (!cancelled) {
              try {
                const showDetails = await tmdb.tvShows.details(foundTmdbId);
                if (!cancelled && showDetails.seasons) {
                  for (const season of showDetails.seasons) {
                    if (cancelled) break;
                    try {
                      const seasonDetails = await tmdb.tvShows.season(foundTmdbId, season.season_number);
                      if (!cancelled && seasonDetails.episodes) {
                        for (const ep of seasonDetails.episodes) {
                          const key = `${season.season_number}_${ep.episode_number}`;
                          newExtras.set(key, {
                            image: ep.still_path ? getTmdbImageUrl(ep.still_path, 'w300') : null,
                            summary: ep.overview || null,
                            airDate: ep.air_date || null,
                            rating: ep.vote_average || null,
                          });
                        }
                      }
                    } catch (e) {
                      console.warn(`[useLazySeriesExtras] TMDB season ${season.season_number} failed:`, e);
                    }
                  }
                }
              } catch (e) {
                console.warn('[useLazySeriesExtras] TMDB show details failed:', e);
              }
            }

            // Cache tmdb_id to DB if found during search
            if (!cancelled && foundTmdbId && !series.tmdb_id) {
              await db.vodSeries.update(series.series_id, { tmdb_id: foundTmdbId });
            }
          }
        }

        // ── TVMaze fallback ──────────────────────────────────────────
        if (!apiKey || !foundTmdbId) {
          try {
            const metadata = await getTvShowMetadata(searchQuery);
            if (!cancelled && metadata.found && metadata.showId) {
              // Try to get logo from TVMaze poster as fallback
              if (!newLogo && metadata.posterUrl) {
                newLogo = metadata.posterUrl;
              }

              const episodes = await getShowEpisodes(metadata.showId);
              if (!cancelled && episodes) {
                for (const ep of episodes) {
                  const key = `${ep.season}_${ep.number}`;
                  newExtras.set(key, {
                    image: ep.image?.medium || ep.image?.original || null,
                    summary: ep.summary ? stripHtmlTags(ep.summary) : null,
                    airDate: ep.airdate || null,
                    rating: ep.rating?.average || null,
                  });
                }
              }

              // Cache imdb_id to DB if available
              if (metadata.imdbId && !series.imdb_id) {
                await db.vodSeries.update(series.series_id, { imdb_id: metadata.imdbId });
              }
            }
          } catch (e) {
            console.warn('[useLazySeriesExtras] TVMaze fallback failed:', e);
          }
        }

        if (!cancelled) {
          setLogoUrl(newLogo);
          setEpisodeExtras(newExtras);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[useLazySeriesExtras] Failed to fetch extras:', err);
        }
      } finally {
        fetchingRef.current = false;
        if (!cancelled) setLoading(false);
      }
    };

    fetchExtras();

    return () => {
      cancelled = true;
      fetchingRef.current = false;
    };
  }, [series?.series_id, series?.title, series?.name, series?.tmdb_id, series?.imdb_id, apiKey]);

  return { logoUrl, episodeExtras, loading };
}

function stripHtmlTags(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

export default useLazySeriesExtras;

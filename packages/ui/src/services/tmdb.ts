/**
 * TMDB Service
 *
 * Wrapper around tmdb-ts for fetching movie/series metadata,
 * trending lists, and search functionality.
 *
 * Uses "accessToken" (TMDB API Read Access Token) for authentication.
 */

import { TMDB, type Video, type Recommendation, type TvRecommendation } from 'tmdb-ts';

// TMDB image base URLs
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
export const TMDB_POSTER_SIZES = {
  small: 'w185',
  medium: 'w342',
  large: 'w500',
  original: 'original',
} as const;
export const TMDB_BACKDROP_SIZES = {
  small: 'w300',
  medium: 'w780',
  large: 'w1280',
  original: 'original',
} as const;

// Helper to build full image URL
export function getTmdbImageUrl(
  path: string | null | undefined,
  size: string = TMDB_POSTER_SIZES.medium
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

// Singleton instance
let tmdbInstance: TMDB | null = null;
let currentAccessToken: string | null = null;

/**
 * Initialize or get TMDB client
 */
export function getTmdb(accessToken: string): TMDB {
  if (!tmdbInstance || currentAccessToken !== accessToken) {
    tmdbInstance = new TMDB(accessToken);
    currentAccessToken = accessToken;
  }
  return tmdbInstance;
}

/**
 * Check if TMDB is configured
 */
export function isTmdbConfigured(): boolean {
  return tmdbInstance !== null && currentAccessToken !== null;
}

/**
 * Clear TMDB instance (for logout/key change)
 */
export function clearTmdb(): void {
  tmdbInstance = null;
  currentAccessToken = null;
}

// ===========================================================================
// Type definitions
// ===========================================================================

export interface TmdbMovieResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  adult: boolean;
}

export interface TmdbMovieDetails extends TmdbMovieResult {
  imdb_id: string | null;
  runtime: number;
  genres: Array<{ id: number; name: string }>;
  tagline: string;
  status: string;
  budget: number;
  revenue: number;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TmdbCredits {
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
}

export interface TmdbTvResult {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
}

export interface TmdbTvDetails extends TmdbTvResult {
  number_of_seasons: number;
  number_of_episodes: number;
  genres: Array<{ id: number; name: string }>;
  status: string;
  tagline: string;
  episode_run_time: number[];
  external_ids?: {
    imdb_id: string | null;
  };
}

export interface TmdbGenre {
  id: number;
  name: string;
}

// ===========================================================================
// Memory cache for direct API responses
// ===========================================================================

const apiCache = new Map<string, { data: any, timestamp: number }>();
const API_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function withApiCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < API_CACHE_TTL) {
    return cached.data as T;
  }
  const data = await fetcher();
  apiCache.set(key, { data, timestamp: Date.now() });
  return data;
}

// ===========================================================================
// Movie endpoints (direct API)
// ===========================================================================

export async function getTrendingMovies(
  accessToken: string,
  timeWindow: 'day' | 'week' = 'week'
): Promise<TmdbMovieResult[]> {
  return withApiCache(`movies_trending_${timeWindow}`, async () => {
    const tmdb = getTmdb(accessToken);
    const response = await tmdb.trending.trending('movie', timeWindow);
    return response.results as unknown as TmdbMovieResult[];
  });
}

export async function getPopularMovies(
  accessToken: string,
  page = 1
): Promise<TmdbMovieResult[]> {
  return withApiCache(`movies_popular_${page}`, async () => {
    const tmdb = getTmdb(accessToken);
    const response = await tmdb.movies.popular({ page });
    return response.results as TmdbMovieResult[];
  });
}

export async function getTopRatedMovies(
  accessToken: string,
  page = 1
): Promise<TmdbMovieResult[]> {
  return withApiCache(`movies_toprated_${page}`, async () => {
    const tmdb = getTmdb(accessToken);
    const response = await tmdb.movies.topRated({ page });
    return response.results as TmdbMovieResult[];
  });
}

export async function getNowPlayingMovies(
  accessToken: string,
  page = 1
): Promise<TmdbMovieResult[]> {
  return withApiCache(`movies_nowplaying_${page}`, async () => {
    const tmdb = getTmdb(accessToken);
    const response = await tmdb.movies.nowPlaying({ page });
    return response.results as TmdbMovieResult[];
  });
}

export async function getUpcomingMovies(
  accessToken: string,
  page = 1
): Promise<TmdbMovieResult[]> {
  const tmdb = getTmdb(accessToken);
  const response = await tmdb.movies.upcoming({ page });
  return response.results as TmdbMovieResult[];
}

export async function searchMovies(
  accessToken: string,
  query: string,
  year?: number
): Promise<TmdbMovieResult[]> {
  const tmdb = getTmdb(accessToken);
  const response = await tmdb.search.movies({ query, year });
  return response.results as TmdbMovieResult[];
}

export async function getMovieDetails(
  accessToken: string,
  movieId: number
): Promise<TmdbMovieDetails> {
  const tmdb = getTmdb(accessToken);
  const details = await tmdb.movies.details(movieId);
  return details as unknown as TmdbMovieDetails;
}

export async function getMovieCredits(
  accessToken: string,
  movieId: number
): Promise<TmdbCredits> {
  const tmdb = getTmdb(accessToken);
  const credits = await tmdb.movies.credits(movieId);
  return credits as unknown as TmdbCredits;
}

// ===========================================================================
// TV Show endpoints (direct API)
// ===========================================================================

export async function getTrendingTvShows(
  accessToken: string,
  timeWindow: 'day' | 'week' = 'week'
): Promise<TmdbTvResult[]> {
  return withApiCache(`tv_trending_${timeWindow}`, async () => {
    const tmdb = getTmdb(accessToken);
    const response = await tmdb.trending.trending('tv', timeWindow);
    return response.results as unknown as TmdbTvResult[];
  });
}

export async function getPopularTvShows(
  accessToken: string,
  page = 1
): Promise<TmdbTvResult[]> {
  return withApiCache(`tv_popular_${page}`, async () => {
    const tmdb = getTmdb(accessToken);
    const response = await tmdb.tvShows.popular({ page });
    return response.results as TmdbTvResult[];
  });
}

export async function getTopRatedTvShows(
  accessToken: string,
  page = 1
): Promise<TmdbTvResult[]> {
  return withApiCache(`tv_toprated_${page}`, async () => {
    const tmdb = getTmdb(accessToken);
    const response = await tmdb.tvShows.topRated({ page });
    return response.results as TmdbTvResult[];
  });
}

export async function getOnTheAirTvShows(
  accessToken: string,
  page = 1
): Promise<TmdbTvResult[]> {
  return withApiCache(`tv_ontheair_${page}`, async () => {
    const tmdb = getTmdb(accessToken);
    const response = await tmdb.tvShows.onTheAir({ page });
    return response.results as TmdbTvResult[];
  });
}

export async function getAiringTodayTvShows(
  accessToken: string,
  page = 1
): Promise<TmdbTvResult[]> {
  const tmdb = getTmdb(accessToken);
  const response = await tmdb.tvShows.airingToday({ page });
  return response.results as TmdbTvResult[];
}

export async function searchTvShows(
  accessToken: string,
  query: string,
  firstAirDateYear?: number
): Promise<TmdbTvResult[]> {
  const tmdb = getTmdb(accessToken);
  const response = await tmdb.search.tvShows({ query, first_air_date_year: firstAirDateYear });
  return response.results as TmdbTvResult[];
}

export async function getTvShowDetails(
  accessToken: string,
  tvId: number
): Promise<TmdbTvDetails> {
  const tmdb = getTmdb(accessToken);
  const details = await tmdb.tvShows.details(tvId, ['external_ids']);
  return details as unknown as TmdbTvDetails;
}

export async function getTvShowCredits(
  accessToken: string,
  tvId: number
): Promise<TmdbCredits> {
  const tmdb = getTmdb(accessToken);
  const credits = await tmdb.tvShows.credits(tvId);
  return credits as unknown as TmdbCredits;
}

// ===========================================================================
// Genre endpoints (direct API)
// ===========================================================================

export async function getMovieGenres(accessToken: string): Promise<TmdbGenre[]> {
  const tmdb = getTmdb(accessToken);
  const response = await tmdb.genres.movies();
  return response.genres;
}

export async function getTvGenres(accessToken: string): Promise<TmdbGenre[]> {
  const tmdb = getTmdb(accessToken);
  const response = await tmdb.genres.tvShows();
  return response.genres;
}

// ===========================================================================
// Discovery endpoints (direct API)
// ===========================================================================

export async function discoverMoviesByGenre(
  accessToken: string,
  genreId: number,
  page = 1
): Promise<TmdbMovieResult[]> {
  const tmdb = getTmdb(accessToken);
  const response = await tmdb.discover.movie({
    with_genres: String(genreId),
    sort_by: 'popularity.desc',
    page,
  });
  return response.results as TmdbMovieResult[];
}

export async function discoverTvShowsByGenre(
  accessToken: string,
  genreId: number,
  page = 1
): Promise<TmdbTvResult[]> {
  const tmdb = getTmdb(accessToken);
  const response = await tmdb.discover.tvShow({
    with_genres: String(genreId),
    sort_by: 'popularity.desc',
    page,
  });
  return response.results as TmdbTvResult[];
}

// ===========================================================================
// API key validation
// ===========================================================================

export async function validateAccessToken(accessToken: string): Promise<boolean> {
  try {
    const tmdb = new TMDB(accessToken);
    await tmdb.configuration.getApiConfiguration();
    return true;
  } catch {
    return false;
  }
}

// ===========================================================================
// Cache-enabled endpoints (direct API wrappers)
// ===========================================================================

// Movies
export const getTrendingMoviesWithCache = (accessToken?: string | null, timeWindow: 'day' | 'week' = 'week'): Promise<TmdbMovieResult[]> => {
  if (!accessToken) return Promise.resolve([]);
  return getTrendingMovies(accessToken, timeWindow);
};

export const getPopularMoviesWithCache = (accessToken?: string | null): Promise<TmdbMovieResult[]> => {
  if (!accessToken) return Promise.resolve([]);
  return getPopularMovies(accessToken);
};

export const getTopRatedMoviesWithCache = (accessToken?: string | null): Promise<TmdbMovieResult[]> => {
  if (!accessToken) return Promise.resolve([]);
  return getTopRatedMovies(accessToken);
};

export const getNowPlayingMoviesWithCache = (accessToken?: string | null): Promise<TmdbMovieResult[]> => {
  if (!accessToken) return Promise.resolve([]);
  return getNowPlayingMovies(accessToken);
};

export const getUpcomingMoviesWithCache = (accessToken?: string | null): Promise<TmdbMovieResult[]> => {
  if (!accessToken) return Promise.resolve([]);
  return getUpcomingMovies(accessToken);
};

export const getMovieGenresWithCache = (accessToken?: string | null): Promise<TmdbGenre[]> => {
  if (!accessToken) return Promise.resolve([]);
  return getMovieGenres(accessToken);
};

// TV Shows
export const getTrendingTvShowsWithCache = (accessToken?: string | null, timeWindow: 'day' | 'week' = 'week'): Promise<TmdbTvResult[]> => {
  if (!accessToken) return Promise.resolve([]);
  return getTrendingTvShows(accessToken, timeWindow);
};

export const getPopularTvShowsWithCache = (accessToken?: string | null): Promise<TmdbTvResult[]> => {
  if (!accessToken) return Promise.resolve([]);
  return getPopularTvShows(accessToken);
};

export const getTopRatedTvShowsWithCache = (accessToken?: string | null): Promise<TmdbTvResult[]> => {
  if (!accessToken) return Promise.resolve([]);
  return getTopRatedTvShows(accessToken);
};

export const getOnTheAirTvShowsWithCache = (accessToken?: string | null): Promise<TmdbTvResult[]> => {
  if (!accessToken) return Promise.resolve([]);
  return getOnTheAirTvShows(accessToken);
};

export const getAiringTodayTvShowsWithCache = (accessToken?: string | null): Promise<TmdbTvResult[]> => {
  if (!accessToken) return Promise.resolve([]);
  return getAiringTodayTvShows(accessToken);
};

export const getTvGenresWithCache = (accessToken?: string | null): Promise<TmdbGenre[]> => {
  if (!accessToken) return Promise.resolve([]);
  return getTvGenres(accessToken);
};

export const discoverMoviesByGenreWithCache = (accessToken?: string | null, genreId?: number): Promise<TmdbMovieResult[]> => {
  if (!accessToken || !genreId) return Promise.resolve([]);
  return discoverMoviesByGenre(accessToken, genreId);
};

export const discoverTvShowsByGenreWithCache = (accessToken?: string | null, genreId?: number): Promise<TmdbTvResult[]> => {
  if (!accessToken || !genreId) return Promise.resolve([]);
  return discoverTvShowsByGenre(accessToken, genreId);
};

// ===========================================================================
// Recommendations endpoints
// ===========================================================================

export async function getMovieRecommendations(
  accessToken: string,
  movieId: number,
  page = 1
): Promise<Recommendation[]> {
  return withApiCache(`movies_recommendations_${movieId}_${page}`, async () => {
    const tmdb = getTmdb(accessToken);
    const response = await tmdb.movies.recommendations(movieId, { page });
    return response.results;
  });
}

export async function getTvShowRecommendations(
  accessToken: string,
  tvId: number,
  page = 1
): Promise<TvRecommendation[]> {
  return withApiCache(`tv_recommendations_${tvId}_${page}`, async () => {
    const tmdb = getTmdb(accessToken);
    const response = await tmdb.tvShows.recommendations(tvId, { page });
    return response.results;
  });
}

// ===========================================================================
// Videos endpoints
// ===========================================================================

/**
 * Fetch videos for a movie from TMDB
 */
export async function getMovieVideos(accessToken: string, movieId: number): Promise<Video[]> {
  const tmdb = getTmdb(accessToken);
  const response = await tmdb.movies.videos(movieId);
  return response.results;
}

/**
 * Fetch videos for a TV show from TMDB
 */
export async function getTvShowVideos(accessToken: string, tvId: number): Promise<Video[]> {
  const tmdb = getTmdb(accessToken);
  const response = await tmdb.tvShows.videos(tvId);
  return response.results;
}

/**
 * Find the best trailer video URL from a list of TMDB videos.
 * Prefers "Trailer" type from YouTube, falls back to "Teaser", then any YouTube video.
 */
export function findTrailerUrl(videos: Video[]): string | null {
  const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer')
    ?? videos.find(v => v.site === 'YouTube' && v.type === 'Teaser')
    ?? videos.find(v => v.site === 'YouTube');
  return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
}

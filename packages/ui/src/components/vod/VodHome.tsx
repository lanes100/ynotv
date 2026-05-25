/**
 * VodHome - Netflix-style home view with hero and carousels
 *
 * Shows Cinemeta-curated content rows for discovery.
 */

import { useCallback, useEffect } from 'react';
import { HeroSection } from './HeroSection';
import { HorizontalCarousel } from './HorizontalCarousel';
import type { StoredMovie, StoredSeries } from '../../db';
import {
  useCinemetaPopular,
  useCinemetaNew,
  useCinemetaFeatured,
  useCinemetaHero,
} from '../../hooks/useCinemetaCatalogs';
import { useRecentlyWatchedMovies, useRecentlyWatchedSeries } from '../../hooks/useVod';
import './VodHome.css';

export interface VodHomeProps {
  type: 'movies' | 'series';
  onItemClick: (item: StoredMovie | StoredSeries) => void;
  onPlay: (item: StoredMovie | StoredSeries) => void;
}

export function VodHome({ type, onItemClick, onPlay }: VodHomeProps) {
  const movieType = type === 'movies' ? 'movie' : 'series';

  // Cinemeta catalogs
  const { items: featuredItems, loading: heroLoading } = useCinemetaHero(movieType);
  const { items: popularItems, loading: popularLoading } = useCinemetaPopular(movieType);
  const { items: newItems, loading: newLoading } = useCinemetaNew(movieType);
  const { items: featuredCatalogItems, loading: featuredLoading } = useCinemetaFeatured(movieType);

  // Recently watched (user viewing history) - shown at top
  const { movies: recentlyWatchedMoviesData, loading: recentlyWatchedMoviesLoading } = useRecentlyWatchedMovies(20);
  const { series: recentlyWatchedSeriesData, loading: recentlyWatchedSeriesLoading } = useRecentlyWatchedSeries(20);
  
  // Extract items and create progress maps
  const recentlyWatchedMovies = recentlyWatchedMoviesData.map(m => m.item);
  const recentlyWatchedSeries = recentlyWatchedSeriesData.map(s => s.item);
  
  // Debug logging for Recently Watched
  useEffect(() => {
    console.log('[VodHome] Movies data:', recentlyWatchedMoviesData.length, 'items, loading:', recentlyWatchedMoviesLoading);
    console.log('[VodHome] Series data:', recentlyWatchedSeriesData.length, 'items, loading:', recentlyWatchedSeriesLoading);
    console.log('[VodHome] Movies extracted:', recentlyWatchedMovies.length);
    console.log('[VodHome] Series extracted:', recentlyWatchedSeries.length);
  }, [recentlyWatchedMoviesData, recentlyWatchedSeriesData, recentlyWatchedMoviesLoading, recentlyWatchedSeriesLoading, recentlyWatchedMovies.length, recentlyWatchedSeries.length]);
  
  // Create progress maps for Recently Watched carousels
  const movieProgressMap = new Map(recentlyWatchedMoviesData.map(m => [m.item.stream_id, m.progress_percent]));
  const seriesProgressMap = new Map(recentlyWatchedSeriesData.map(s => [s.item.series_id, s.progress_percent]));

  const handleHeroPlay = useCallback((item: StoredMovie | StoredSeries) => {
    onPlay(item);
  }, [onPlay]);

  const handleHeroMoreInfo = useCallback((item: StoredMovie | StoredSeries) => {
    if ((item as any).source_id === 'cinemeta') {
      const title = item.title || item.name || '';
      if (title) {
        onItemClick({
          ...item,
          source_id: 'cinemeta_search',
        } as any);
      }
      return;
    }
    onItemClick(item);
  }, [onItemClick]);

  if (type === 'movies') {
    return (
      <div className="vod-home">
        <HeroSection
          items={featuredItems as StoredMovie[]}
          type="movie"
          onPlay={handleHeroPlay}
          onMoreInfo={handleHeroMoreInfo}
          autoRotate
          rotateInterval={8000}
          loading={heroLoading}
        />

        <div className="vod-home__carousels">
          {recentlyWatchedMovies.length > 0 && (
            <HorizontalCarousel
              title="Recently Watched"
              items={recentlyWatchedMovies}
              type="movie"
              onItemClick={onItemClick}
              loading={recentlyWatchedMoviesLoading}
              maxItems={20}
              progressData={movieProgressMap}
            />
          )}

          <HorizontalCarousel
            title="Popular"
            items={popularItems as StoredMovie[]}
            type="movie"
            onItemClick={onItemClick}
            loading={popularLoading}
            maxItems={20}
          />

          <HorizontalCarousel
            title="New Releases"
            items={newItems as StoredMovie[]}
            type="movie"
            onItemClick={onItemClick}
            loading={newLoading}
            maxItems={20}
          />

          <HorizontalCarousel
            title="Featured"
            items={featuredCatalogItems as StoredMovie[]}
            type="movie"
            onItemClick={onItemClick}
            loading={featuredLoading}
            maxItems={20}
          />
        </div>
      </div>
    );
  }

  // Series view
  return (
    <div className="vod-home">
      <HeroSection
        items={featuredItems as StoredSeries[]}
        type="series"
        onPlay={handleHeroPlay}
        onMoreInfo={handleHeroMoreInfo}
        autoRotate
        rotateInterval={8000}
        loading={heroLoading}
      />

      <div className="vod-home__carousels">
        {recentlyWatchedSeries.length > 0 && (
          <HorizontalCarousel
            title="Recently Watched"
            items={recentlyWatchedSeries}
            type="series"
            onItemClick={onItemClick}
            loading={recentlyWatchedSeriesLoading}
            maxItems={20}
            progressData={seriesProgressMap}
          />
        )}

        <HorizontalCarousel
          title="Popular"
          items={popularItems as StoredSeries[]}
          type="series"
          onItemClick={onItemClick}
          loading={popularLoading}
          maxItems={20}
        />

        <HorizontalCarousel
          title="New Releases"
          items={newItems as StoredSeries[]}
          type="series"
          onItemClick={onItemClick}
          loading={newLoading}
          maxItems={20}
        />

        <HorizontalCarousel
          title="Featured"
          items={featuredCatalogItems as StoredSeries[]}
          type="series"
          onItemClick={onItemClick}
          loading={featuredLoading}
          maxItems={20}
        />
      </div>
    </div>
  );
}

export default VodHome;

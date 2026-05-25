import { useState, useEffect, useMemo } from 'react';
import type { StoredMovie, StoredSeries } from '../db';
import type { StremioMetaPreview } from '../types/stremio';
import { fetchCatalog } from '../services/stremio-addon';
import { useStremioAddonStore } from '../stores/stremioAddonStore';
import { type MediaItem } from '../types/media';

const CINEMETA_ID = 'com.linvo.cinemeta';

function findCinemetaAddon(addons: { id: string; baseUrl: string; enabled?: boolean }[]) {
  return addons.find(
    (a) => a.id === CINEMETA_ID || a.baseUrl.includes('cinemeta')
  );
}

function mapToStoredMovie(meta: StremioMetaPreview, useBackground = false): StoredMovie {
  const item = {
    stream_id: `cinemeta-movie-${meta.id}`,
    name: meta.name,
    title: meta.name,
    stream_icon: useBackground
      ? (meta.background || meta.poster || '')
      : (meta.poster || ''),
    cover: meta.background || meta.poster || '',
    plot: meta.description || '',
    genre: meta.genres?.join(', ') || '',
    year: meta.year?.toString() || meta.releaseInfo || '',
    rating: meta.imdbRating || '',
    rating_5based: meta.imdbRating ? parseFloat(meta.imdbRating) / 2 : 0,
    category_ids: '',
    category_id: '',
    added: '',
    container_extension: '',
    custom_sid: '',
    direct_source: '',
    source_id: 'cinemeta',
    movie_id: `cinemeta-movie-${meta.id}`,
    _cinemetaLogo: meta.logo || '',
    _cinemetaRuntime: meta.runtime || '',
    _cinemetaReleaseInfo: meta.releaseInfo || '',
  } as unknown as StoredMovie;
  return item;
}

function mapToStoredSeries(meta: StremioMetaPreview, useBackground = false): StoredSeries {
  const item = {
    series_id: `cinemeta-series-${meta.id}`,
    name: meta.name,
    title: meta.name,
    cover: useBackground
      ? (meta.background || meta.poster || '')
      : (meta.poster || ''),
    plot: meta.description || '',
    genre: meta.genres?.join(', ') || '',
    year: meta.year?.toString() || meta.releaseInfo || '',
    rating: meta.imdbRating || '',
    rating_5based: meta.imdbRating ? parseFloat(meta.imdbRating) / 2 : 0,
    category_ids: '',
    category_id: '',
    source_id: 'cinemeta',
    _cinemetaLogo: meta.logo || '',
    _cinemetaRuntime: meta.runtime || '',
    _cinemetaReleaseInfo: meta.releaseInfo || '',
  } as unknown as StoredSeries;
  return item;
}

function useCinemetaCatalog(
  catalogId: string,
  itemType: 'movie' | 'series',
  limit = 20,
  useBackground = false,
  extra?: Record<string, string>
): { items: MediaItem[]; loading: boolean } {
  const addons = useStremioAddonStore((s) => s.addons);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const addon = useMemo(() => findCinemetaAddon(addons), [addons]);

  useEffect(() => {
    if (!addon) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const fetchData = async () => {
      try {
        const resp = await fetchCatalog(addon.baseUrl, itemType, catalogId, {
          limit: limit.toString(),
          ...extra,
        });
        if (!active) return;

        const mapped: MediaItem[] = (resp?.metas || []).map((meta: StremioMetaPreview) =>
          itemType === 'movie'
            ? mapToStoredMovie(meta, useBackground)
            : mapToStoredSeries(meta, useBackground)
        );

        setItems(mapped.slice(0, limit));
      } catch (err) {
        console.error(`[useCinemetaCatalog] Failed ${catalogId}/${itemType}:`, err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => { active = false; };
  }, [addon?.baseUrl, catalogId, itemType, limit, useBackground, extra?.genre]);

  return { items, loading };
}

export function useCinemetaPopularMovies() {
  return useCinemetaCatalog('top', 'movie');
}

export function useCinemetaPopularSeries() {
  return useCinemetaCatalog('top', 'series');
}

export function useCinemetaNewMovies() {
  const currentYear = new Date().getFullYear().toString();
  return useCinemetaCatalog('year', 'movie', 20, false, { genre: currentYear });
}

export function useCinemetaNewSeries() {
  const currentYear = new Date().getFullYear().toString();
  return useCinemetaCatalog('year', 'series', 20, false, { genre: currentYear });
}

export function useCinemetaFeaturedMovies() {
  return useCinemetaCatalog('imdbRating', 'movie');
}

export function useCinemetaFeaturedSeries() {
  return useCinemetaCatalog('imdbRating', 'series');
}

export function useCinemetaPopular(type: 'movie' | 'series'): { items: MediaItem[]; loading: boolean } {
  return useCinemetaCatalog('top', type, 20, false);
}

export function useCinemetaNew(type: 'movie' | 'series'): { items: MediaItem[]; loading: boolean } {
  const currentYear = new Date().getFullYear().toString();
  return useCinemetaCatalog('year', type, 20, false, { genre: currentYear });
}

export function useCinemetaFeatured(type: 'movie' | 'series'): { items: MediaItem[]; loading: boolean } {
  return useCinemetaCatalog('imdbRating', type, 20, false);
}

export function useCinemetaHero(type: 'movie' | 'series'): { items: MediaItem[]; loading: boolean } {
  const addons = useStremioAddonStore((s) => s.addons);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const addon = useMemo(() => findCinemetaAddon(addons), [addons]);

  useEffect(() => {
    if (!addon) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const fetchData = async () => {
      try {
        const resp = await fetchCatalog(addon.baseUrl, type, 'imdbRating', { limit: '15' });
        if (!active) return;

        const metas = (resp?.metas || [])
          .filter((m: StremioMetaPreview) => m.background)
          .slice(0, 5);

        const mapped: MediaItem[] = metas.map((meta: StremioMetaPreview) =>
          type === 'movie'
            ? mapToStoredMovie(meta, true)
            : mapToStoredSeries(meta, true)
        );

        setItems(mapped);
      } catch (err) {
        console.error('[useCinemetaHero] Failed:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => { active = false; };
  }, [addon?.baseUrl, type]);

  return { items, loading };
}

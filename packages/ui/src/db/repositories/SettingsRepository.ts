import { ISettingsService, UserSettings, WatchPosition, Source } from '@ynotv/core';
import { db } from '../index';
import { dbEvents } from '../sqlite-adapter';

export class SettingsRepository implements ISettingsService {
  async getSettings(): Promise<UserSettings> {
    let storageSettings: any = {};
    if (window.storage) {
      const result = await window.storage.getSettings();
      storageSettings = result.data || {};
    }

    const favoriteChannels = await db.channels
      .whereRaw("(is_favorite = 1 OR is_favorite = 'true')")
      .toArray();
    const channelIds = favoriteChannels.map((c) => c.stream_id);

    const allPrefs = await db.prefs.toArray();
    const favMoviesIds: string[] = [];
    const favSeriesIds: string[] = [];

    for (const p of allPrefs) {
      if (p.key.startsWith('fav:movies:') && p.value === 'true') {
        favMoviesIds.push(p.key.replace('fav:movies:', ''));
      } else if (p.key.startsWith('fav:series:') && p.value === 'true') {
        favSeriesIds.push(p.key.replace('fav:series:', ''));
      }
    }

    const watchPositions: Record<string, WatchPosition> = {};
    for (const p of allPrefs) {
      if (p.key.startsWith('watch_pos:')) {
        const url = p.key.replace('watch_pos:', '');
        try {
          watchPositions[url] = JSON.parse(p.value);
        } catch {
          // Ignore
        }
      }
    }

    const sourcesResult = window.storage ? await window.storage.getSources() : { data: [] };
    const sources = sourcesResult.data || [];

    return {
      sources: sources as Source[],
      selected_categories: storageSettings.selected_categories || [],
      volume: storageSettings.volume !== undefined ? storageSettings.volume : 100,
      muted: !!storageSettings.muted,
      preferred_stream_type: storageSettings.preferred_stream_type || 'auto',
      hardware_decoding: !!storageSettings.hardware_decoding,
      guide_hours_visible: storageSettings.guide_hours_visible || 3,
      theme: storageSettings.theme || 'dark',
      watch_positions: watchPositions,
      favorites: {
        channels: channelIds,
        movies: favMoviesIds,
        series: favSeriesIds,
      },
    };
  }

  async saveSettings(settings: Partial<UserSettings>): Promise<void> {
    if (window.storage) {
      await window.storage.updateSettings(settings as any);
    }
  }

  async getWatchPosition(url: string): Promise<WatchPosition | null> {
    const key = `watch_pos:${url}`;
    const row = await db.prefs.get(key);
    if (!row) return null;
    try {
      return JSON.parse(row.value) as WatchPosition;
    } catch {
      return null;
    }
  }

  async saveWatchPosition(url: string, position: number, duration: number): Promise<void> {
    const key = `watch_pos:${url}`;
    const value = JSON.stringify({
      position,
      duration,
      updated_at: new Date(),
    });
    await db.prefs.put({ key, value });
  }

  async addFavorite(type: 'channels' | 'movies' | 'series', id: string): Promise<void> {
    if (type === 'channels') {
      await db.channels.update(id, { is_favorite: true });
      dbEvents.notify('channels', 'update');
    } else {
      await db.prefs.put({ key: `fav:${type}:${id}`, value: 'true' });
      dbEvents.notify('prefs', 'update');
    }
  }

  async removeFavorite(type: 'channels' | 'movies' | 'series', id: string): Promise<void> {
    if (type === 'channels') {
      await db.channels.update(id, { is_favorite: false });
      dbEvents.notify('channels', 'update');
    } else {
      await db.prefs.delete(`fav:${type}:${id}`);
      dbEvents.notify('prefs', 'update');
    }
  }

  async isFavorite(type: 'channels' | 'movies' | 'series', id: string): Promise<boolean> {
    if (type === 'channels') {
      const channel = await db.channels.get(id);
      return !!channel?.is_favorite;
    } else {
      const row = await db.prefs.get(`fav:${type}:${id}`);
      return !!row && row.value === 'true';
    }
  }

  onSettingsChanged(callback: (settings: UserSettings) => void): () => void {
    const handler = async () => {
      const settings = await this.getSettings();
      callback(settings);
    };
    return dbEvents.subscribe('prefs', handler);
  }
}

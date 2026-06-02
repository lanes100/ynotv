import { AppSettings } from '../types/app';
import type { StremioMetaPreview } from '../types/stremio';
import { db, updateVodWatchProgress, recordEpisodeWatch } from '../db';

// Unified logger helpers
const logInfo = (...args: any[]) => console.log('[Scrobbler]', ...args);
const logWarn = (...args: any[]) => console.warn('[Scrobbler]', ...args);
const logError = (...args: any[]) => console.error('[Scrobbler]', ...args);

// API Endpoints
const TRAKT_API_URL = 'https://api.trakt.tv';
const SIMKL_API_URL = 'https://api.simkl.com';

// ---------------------------------------------------------------------------
// Trakt Catalog Definitions
// ---------------------------------------------------------------------------
export type TraktCatalogType =
  | 'watchlist'
  | 'history'
  | 'recommendations-movies'
  | 'recommendations-shows'
  | 'collection-movies'
  | 'collection-shows'
  | 'trending-movies'
  | 'trending-shows'
  | 'popular-movies'
  | 'popular-shows'
  | 'watched-movies'
  | 'watched-shows'
  | 'collected-movies'
  | 'collected-shows'
  | 'anticipated-movies'
  | 'anticipated-shows';

const TRAKT_PAGE_LIMIT = 30;

const TRAKT_CATALOG_URLS: Record<TraktCatalogType, string> = {
  'watchlist': `${TRAKT_API_URL}/users/me/watchlist?limit=${TRAKT_PAGE_LIMIT}`,
  'history': `${TRAKT_API_URL}/users/me/history?limit=${TRAKT_PAGE_LIMIT}`,
  'recommendations-movies': `${TRAKT_API_URL}/recommendations/movies?limit=${TRAKT_PAGE_LIMIT}`,
  'recommendations-shows': `${TRAKT_API_URL}/recommendations/shows?limit=${TRAKT_PAGE_LIMIT}`,
  'collection-movies': `${TRAKT_API_URL}/users/me/collection/movies?limit=${TRAKT_PAGE_LIMIT}`,
  'collection-shows': `${TRAKT_API_URL}/users/me/collection/shows?limit=${TRAKT_PAGE_LIMIT}`,
  'trending-movies': `${TRAKT_API_URL}/movies/trending?limit=${TRAKT_PAGE_LIMIT}`,
  'trending-shows': `${TRAKT_API_URL}/shows/trending?limit=${TRAKT_PAGE_LIMIT}`,
  'popular-movies': `${TRAKT_API_URL}/movies/popular?limit=${TRAKT_PAGE_LIMIT}`,
  'popular-shows': `${TRAKT_API_URL}/shows/popular?limit=${TRAKT_PAGE_LIMIT}`,
  'watched-movies': `${TRAKT_API_URL}/movies/watched?limit=${TRAKT_PAGE_LIMIT}`,
  'watched-shows': `${TRAKT_API_URL}/shows/watched?limit=${TRAKT_PAGE_LIMIT}`,
  'collected-movies': `${TRAKT_API_URL}/movies/collected?limit=${TRAKT_PAGE_LIMIT}`,
  'collected-shows': `${TRAKT_API_URL}/shows/collected?limit=${TRAKT_PAGE_LIMIT}`,
  'anticipated-movies': `${TRAKT_API_URL}/movies/anticipated?limit=${TRAKT_PAGE_LIMIT}`,
  'anticipated-shows': `${TRAKT_API_URL}/shows/anticipated?limit=${TRAKT_PAGE_LIMIT}`,
};

// Which catalog types use a wrapped response (item.movie / item.show) vs flat
const WRAPPED_CATALOGS = new Set<TraktCatalogType>([
  'watchlist', 'history',
  'collection-movies', 'collection-shows',
  'trending-movies', 'trending-shows',
  'watched-movies', 'watched-shows',
  'collected-movies', 'collected-shows',
  'anticipated-movies', 'anticipated-shows',
]);

export interface TraktCatalogDefinition {
  type: TraktCatalogType;
  label: string;
  description: string;
  group: string;
}

export const TRAKT_CATALOG_DEFINITIONS: TraktCatalogDefinition[] = [
  { type: 'watchlist', label: 'Watchlist', description: 'Items you have saved to watch later', group: 'Your Library' },
  { type: 'history', label: 'History', description: 'Items you have watched', group: 'Your Library' },
  { type: 'collection-movies', label: 'Movie Collection', description: 'Movies in your collection', group: 'Your Library' },
  { type: 'collection-shows', label: 'Show Collection', description: 'Shows in your collection', group: 'Your Library' },
  { type: 'recommendations-movies', label: 'Movie Recommendations', description: 'Personalized movie recommendations from Trakt', group: 'Recommendations' },
  { type: 'recommendations-shows', label: 'Show Recommendations', description: 'Personalized show recommendations from Trakt', group: 'Recommendations' },
  { type: 'trending-movies', label: 'Trending Movies', description: 'Movies trending right now on Trakt', group: 'Trending & Popular' },
  { type: 'trending-shows', label: 'Trending Shows', description: 'Shows trending right now on Trakt', group: 'Trending & Popular' },
  { type: 'popular-movies', label: 'Popular Movies', description: 'All-time popular movies on Trakt', group: 'Trending & Popular' },
  { type: 'popular-shows', label: 'Popular Shows', description: 'All-time popular shows on Trakt', group: 'Trending & Popular' },
  { type: 'watched-movies', label: 'Most Watched Movies', description: 'Most watched movies this week on Trakt', group: 'Trending & Popular' },
  { type: 'watched-shows', label: 'Most Watched Shows', description: 'Most watched shows this week on Trakt', group: 'Trending & Popular' },
  { type: 'collected-movies', label: 'Most Collected Movies', description: 'Most collected movies on Trakt', group: 'Trending & Popular' },
  { type: 'collected-shows', label: 'Most Collected Shows', description: 'Most collected shows on Trakt', group: 'Trending & Popular' },
  { type: 'anticipated-movies', label: 'Most Anticipated Movies', description: 'Most anticipated upcoming movies on Trakt', group: 'Trending & Popular' },
  { type: 'anticipated-shows', label: 'Most Anticipated Shows', description: 'Most anticipated upcoming shows on Trakt', group: 'Trending & Popular' },
];

type ScrobblerProvider = 'Trakt' | 'Simkl';

const buildCredentials = {
  traktClientId: import.meta.env.VITE_TRAKT_CLIENT_ID?.trim() || '',
  traktClientSecret: import.meta.env.VITE_TRAKT_CLIENT_SECRET?.trim() || '',
  simklClientId: import.meta.env.VITE_SIMKL_CLIENT_ID?.trim() || '',
  simklClientSecret: import.meta.env.VITE_SIMKL_CLIENT_SECRET?.trim() || '',
};

export function getScrobblerCredentialStatus() {
  return {
    traktConfigured: Boolean(buildCredentials.traktClientId && buildCredentials.traktClientSecret),
    simklConfigured: Boolean(buildCredentials.simklClientId && buildCredentials.simklClientSecret),
  };
}

function requireBuildCredential(value: string, provider: ScrobblerProvider, name: string): string {
  if (value) return value;
  throw new Error(`${provider} ${name} is not configured. Set the VITE_${provider.toUpperCase()}_${name.toUpperCase()} environment variable before building.`);
}

function getTraktCredentials() {
  return {
    clientId: requireBuildCredential(buildCredentials.traktClientId, 'Trakt', 'client_id'),
    clientSecret: requireBuildCredential(buildCredentials.traktClientSecret, 'Trakt', 'client_secret'),
  };
}

function getSimklCredentials() {
  return {
    clientId: requireBuildCredential(buildCredentials.simklClientId, 'Simkl', 'client_id'),
    clientSecret: requireBuildCredential(buildCredentials.simklClientSecret, 'Simkl', 'client_secret'),
  };
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

export interface PlaybackMediaInfo {
  title: string;
  year?: string;
  imdbId?: string; // e.g. "tt1234567"
  type: 'movie' | 'series';
  season?: number;
  episode?: number;
  progressPercent: number; // 0 to 100
}

// Helper to handle cross-origin Tauri/Browser requests
async function makeRequest(url: string, options: any = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const bodyStr = options.body ? (typeof options.body === 'object' ? JSON.stringify(options.body) : options.body) : undefined;
  const fetchOptions = {
    ...options,
    headers,
    body: bodyStr,
  };

  if (window.fetchProxy) {
    const res = await window.fetchProxy.fetch(url, fetchOptions);
    if (res.error || !res.data) {
      throw new Error(res.error || `HTTP request failed to ${url}`);
    }
    const text = res.data.text;
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Not JSON
    }
      return {
        ok: res.data.ok,
        status: res.data.status,
        text: () => Promise.resolve(text),
        json: () => Promise.resolve(json || {}),
      };
  } else {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: bodyStr,
    });
    return res;
  }
}

class ScrobblerService {
  private lastActiveMedia: PlaybackMediaInfo | null = null;
  private isScrobblingActive = false;

  // Retrieve app settings securely
  private async getSettings(): Promise<AppSettings> {
    if (!window.storage) return {};
    const res = await window.storage.getSettings();
    return res.data || {};
  }

  // Update app settings safely
  private async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    if (!window.storage) return;
    await window.storage.updateSettings(settings);
  }

  // --------------------------------------------------------------------------
  // Trakt Authentication / OAuth Flow
  // --------------------------------------------------------------------------
  async generateTraktDeviceCode(): Promise<DeviceCodeResponse> {
    const { clientId } = getTraktCredentials();

    logInfo('Generating Trakt Device Code...');
    const response = await makeRequest(`${TRAKT_API_URL}/oauth/device/code`, {
      method: 'POST',
      headers: {
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
        'User-Agent': 'ynotv/1.0',
      },
      body: { client_id: clientId },
    });

    if (!response.ok) {
      throw new Error('Failed to generate Trakt device code');
    }

    return await response.json();
  }

  async pollTraktToken(deviceCode: string): Promise<{ success: boolean; error?: string }> {
    const { clientId, clientSecret } = getTraktCredentials();

    logInfo('Polling Trakt access token...');
    const response = await makeRequest(`${TRAKT_API_URL}/oauth/device/token`, {
      method: 'POST',
      headers: {
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
        'User-Agent': 'ynotv/1.0',
      },
      body: {
        code: deviceCode,
        client_id: clientId,
        client_secret: clientSecret,
      },
    });

    if (response.status === 400) {
      // Still pending user approval
      return { success: false };
    }

    if (response.status === 404 || response.status === 410) {
      return { success: false, error: 'Device code expired' };
    }

    if (response.ok) {
      const data = await response.json();
      await this.updateSettings({
        traktEnabled: true,
        traktAccessToken: data.access_token,
        traktRefreshToken: data.refresh_token,
        traktTokenExpiresAt: Date.now() + (data.expires_in * 1000),
        traktScrobbleEnabled: true,
        traktSyncEnabled: false,
        traktWatchlistEnabled: true,
        traktCatalogsEnabled: {},
      });
      logInfo('Trakt linked successfully.');
      return { success: true };
    }

    return { success: false, error: 'Authorization failed' };
  }

  async refreshTraktToken(): Promise<void> {
    const settings = await this.getSettings();
    const refreshToken = settings.traktRefreshToken;
    const expiresAt = settings.traktTokenExpiresAt;

    if (!refreshToken || !expiresAt) return;

    // Refresh if expiring within 48 hours
    if (expiresAt - Date.now() > 2 * 24 * 60 * 60 * 1000) return;

    const { clientId, clientSecret } = getTraktCredentials();

    logInfo('Refreshing Trakt Access Token...');
    try {
      const response = await makeRequest(`${TRAKT_API_URL}/oauth/token`, {
        method: 'POST',
        headers: {
          'trakt-api-version': '2',
          'trakt-api-key': clientId,
          'User-Agent': 'ynotv/1.0',
        },
        body: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        },
      });

      if (response.ok) {
        const data = await response.json();
        await this.updateSettings({
          traktAccessToken: data.access_token,
          traktRefreshToken: data.refresh_token,
          traktTokenExpiresAt: Date.now() + (data.expires_in * 1000),
        });
        logInfo('Trakt token refreshed successfully.');
      } else {
        logWarn('Trakt refresh request failed with status:', response.status);
      }
    } catch (e) {
      logError('Failed to refresh Trakt token:', e);
    }
  }

  async logoutTrakt(): Promise<void> {
    await this.updateSettings({
      traktEnabled: false,
      traktAccessToken: null,
      traktRefreshToken: null,
      traktTokenExpiresAt: null,
      traktScrobbleEnabled: false,
      traktSyncEnabled: false,
      traktWatchlistEnabled: false,
      traktCatalogsEnabled: undefined,
    });
    logInfo('Trakt unlinked successfully.');
  }

  // --------------------------------------------------------------------------
  // Simkl Authentication / OAuth Flow
  // --------------------------------------------------------------------------
  async generateSimklDeviceCode(): Promise<DeviceCodeResponse> {
    const { clientId } = getSimklCredentials();

    logInfo('Generating Simkl PIN Code...');
    // Simkl PIN flow uses GET /oauth/pin?client_id=...
    const response = await makeRequest(`${SIMKL_API_URL}/oauth/pin?client_id=${clientId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to generate Simkl PIN code');
    }

    const data = await response.json();
    if (!data.user_code) {
      throw new Error('Failed to generate Simkl PIN code: invalid response');
    }
    return data;
  }

  // NOTE: Simkl uses the user_code (not device_code) as the identifier for polling
  async pollSimklToken(userCode: string): Promise<{ success: boolean; error?: string }> {
    const { clientId } = getSimklCredentials();

    logInfo('Polling Simkl access token...');
    // Simkl PIN polling is a GET to /oauth/pin/{user_code}?client_id=...
    const response = await makeRequest(`${SIMKL_API_URL}/oauth/pin/${userCode}?client_id=${clientId}`, {
      method: 'GET',
    });

    if (response.ok) {
      const data = await response.json();
      if (data.access_token) {
        await this.updateSettings({
          simklEnabled: true,
          simklAccessToken: data.access_token,
          simklScrobbleEnabled: true,
          simklSyncEnabled: false,
        });
        logInfo('Simkl linked successfully.');
        return { success: true };
      }

      // If result is OK but no access_token yet, still pending
      if (data.result === 'OK' && !data.access_token) {
        return { success: false };
      }
    }

    // Non-OK response means still pending (the API returns 200 with just {result: 'OK'}
    // until the user approves, at which point it includes access_token)
    return { success: false };
  }

  async logoutSimkl(): Promise<void> {
    await this.updateSettings({
      simklEnabled: false,
      simklAccessToken: null,
      simklScrobbleEnabled: false,
      simklSyncEnabled: false,
    });
    logInfo('Simkl unlinked successfully.');
  }

  // --------------------------------------------------------------------------
  // Unified Real-Time Scrobbling APIs (Trakt & Simkl)
  // --------------------------------------------------------------------------
  async startScrobble(media: PlaybackMediaInfo): Promise<void> {
    this.lastActiveMedia = media;
    this.isScrobblingActive = true;
    logInfo('Start scrobbling media:', media.title, media.type === 'series' ? `S${media.season}E${media.episode}` : '', `(${Math.round(media.progressPercent)}%)`);

    await Promise.all([
      this.sendTraktScrobble('start', media),
      this.sendSimklScrobble('start', media),
    ]);
  }

  async updateScrobble(progressPercent: number): Promise<void> {
    if (!this.isScrobblingActive || !this.lastActiveMedia) return;
    
    this.lastActiveMedia.progressPercent = progressPercent;
    
    logInfo('Updating scrobble progress:', this.lastActiveMedia.title, `(${Math.round(progressPercent)}%)`);

    await this.sendSimklScrobble('start', this.lastActiveMedia);
  }

  async pauseScrobble(): Promise<void> {
    if (!this.isScrobblingActive || !this.lastActiveMedia) return;
    logInfo('Pausing scrobble:', this.lastActiveMedia.title);

    await Promise.all([
      this.sendTraktScrobble('pause', this.lastActiveMedia),
      this.sendSimklScrobble('pause', this.lastActiveMedia),
    ]);
  }

  async stopScrobble(progressPercent: number): Promise<void> {
    if (!this.isScrobblingActive || !this.lastActiveMedia) return;
    
    this.lastActiveMedia.progressPercent = progressPercent;
    this.isScrobblingActive = false;
    
    logInfo('Stopping scrobble:', this.lastActiveMedia.title, `(${Math.round(progressPercent)}%)`);

    const simklAction: 'stop' | 'pause' = progressPercent >= 90 ? 'stop' : 'pause';
    if (progressPercent >= 90) {
      logInfo('Media completed (>=90%)! Marking as fully watched.');
    }

    await Promise.all([
      this.sendTraktScrobble('stop', this.lastActiveMedia), // Trakt handles >=80% as scrobble, <80% as pause
      this.sendSimklScrobble(simklAction, this.lastActiveMedia),
    ]);

    this.lastActiveMedia = null;
  }

  // --------------------------------------------------------------------------
  // Trakt Internal Scrobbler Request
  // --------------------------------------------------------------------------
  private async sendTraktScrobble(action: 'start' | 'pause' | 'stop', media: PlaybackMediaInfo): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.traktEnabled || !settings.traktScrobbleEnabled || !settings.traktAccessToken) return;

    try {
      const { clientId } = getTraktCredentials();
      const headers = {
        'Authorization': `Bearer ${settings.traktAccessToken}`,
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
      };

      const payload: any = {
        progress: Math.min(100, Math.max(0, media.progressPercent)),
      };

      const imdbClean = media.imdbId && media.imdbId.startsWith('tt') ? media.imdbId : undefined;

      if (media.type === 'movie') {
        payload.movie = {
          title: media.title,
          year: media.year ? parseInt(media.year) : undefined,
          ids: imdbClean ? { imdb: imdbClean } : undefined,
        };
      } else {
        payload.show = {
          title: media.title,
          ids: imdbClean ? { imdb: imdbClean } : undefined,
        };
        payload.episode = {
          season: media.season ?? 1,
          number: media.episode ?? 1,
        };
      }

      const url = `${TRAKT_API_URL}/scrobble/${action}`;
      logInfo(`Sending Trakt Scrobble (${action}) request...`);
      const response = await makeRequest(url, {
        method: 'POST',
        headers,
        body: payload,
      });

      const responseText = await response.text().catch(() => '');
      let responseBody: any = null;
      if (responseText) {
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          responseBody = responseText;
        }
      }

      if (!response.ok) {
        logWarn('Trakt scrobble failed with status:', response.status, responseBody);
      } else {
        logInfo(`Trakt Scrobble (${action}) accepted:`, responseBody);
        if (action === 'stop') {
          await this.logTraktPlaybackProgress(settings.traktAccessToken, clientId, media);
        }
      }
    } catch (e) {
      logError('Trakt scrobble connection error:', e);
    }
  }

  private async logTraktPlaybackProgress(token: string, clientId: string, media: PlaybackMediaInfo): Promise<void> {
    try {
      const response = await makeRequest(`${TRAKT_API_URL}/sync/playback`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'trakt-api-version': '2',
          'trakt-api-key': clientId,
        },
      });

      if (!response.ok) {
        logWarn('Trakt playback verification failed with status:', response.status);
        return;
      }

      const items = await response.json();
      if (!Array.isArray(items)) return;

      const matching = items.find((item: any) => {
        const imdbId = item.movie?.ids?.imdb || item.show?.ids?.imdb;
        if (imdbId !== media.imdbId) return false;
        if (media.type === 'movie') return item.type === 'movie';
        return item.type === 'episode'
          && item.episode?.season === media.season
          && item.episode?.number === media.episode;
      });

      if (matching) {
        logInfo('Trakt playback progress verified:', {
          progress: matching.progress,
          pausedAt: matching.paused_at,
          type: matching.type,
          title: matching.movie?.title || matching.show?.title,
          season: matching.episode?.season,
          episode: matching.episode?.number,
        });
      } else {
        logWarn('Trakt playback progress was not found after stop for:', {
          imdbId: media.imdbId,
          type: media.type,
          season: media.season,
          episode: media.episode,
        });
      }
    } catch (e) {
      logWarn('Trakt playback verification error:', e);
    }
  }

  // --------------------------------------------------------------------------
  // Simkl Internal Scrobbler Request
  // --------------------------------------------------------------------------
  private async sendSimklScrobble(action: 'start' | 'pause' | 'stop', media: PlaybackMediaInfo): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.simklEnabled || !settings.simklScrobbleEnabled || !settings.simklAccessToken) return;

    try {
      const { clientId } = getSimklCredentials();
      const headers = {
        'Authorization': `Bearer ${settings.simklAccessToken}`,
        'simkl-api-key': clientId,
      };

      // Simkl uses a standard POST to /scrobble
      // Action is handled by fields: "paused": true/false and percentage/duration
      const payload: any = {
        progress: Math.min(100, Math.max(0, media.progressPercent)),
      };

      const imdbClean = media.imdbId && media.imdbId.startsWith('tt') ? media.imdbId : undefined;

      if (media.type === 'movie') {
        payload.movie = {
          title: media.title,
          ids: imdbClean ? { imdb: imdbClean } : undefined,
        };
      } else {
        payload.show = {
          title: media.title,
          ids: imdbClean ? { imdb: imdbClean } : undefined,
        };
        payload.episode = {
          season: media.season ?? 1,
          number: media.episode ?? 1,
        };
      }

      // Simkl states mapping:
      // start -> active session (paused: false)
      // pause -> paused session (paused: true)
      // stop -> mark watched (completed if progress >= 90%)
      if (action === 'pause') {
        payload.paused = true;
      } else if (action === 'stop' && media.progressPercent >= 90) {
        payload.watched = true;
      } else {
        payload.paused = false;
      }

      // Endpoint: Simkl uses /scrobble/start, /scrobble/pause, /scrobble/stop
      const url = `${SIMKL_API_URL}/scrobble/${action}`;
      logInfo(`Sending Simkl Scrobble (${action}) request...`);
      const response = await makeRequest(url, {
        method: 'POST',
        headers,
        body: payload,
      });

      if (!response.ok) {
        logWarn('Simkl scrobble failed with status:', response.status);
      }
    } catch (e) {
      logError('Simkl scrobble connection error:', e);
    }
  }

  // --------------------------------------------------------------------------
  // Progress Sync Engine (Unifies Trakt/Simkl continue watches)
  // --------------------------------------------------------------------------
  async syncPlaybackProgress(): Promise<void> {
    logInfo('Running bi-directional watch progress sync...');
    const settings = await this.getSettings();

    if (settings.traktEnabled && settings.traktSyncEnabled && settings.traktAccessToken) {
      const { clientId } = getTraktCredentials();
      await this.syncTraktPlaybackProgress(settings.traktAccessToken, clientId);
    }

    if (settings.simklEnabled && settings.simklSyncEnabled && settings.simklAccessToken) {
      const { clientId } = getSimklCredentials();
      await this.syncSimklPlaybackProgress(settings.simklAccessToken, clientId);
    }
  }

  private async syncTraktPlaybackProgress(token: string, clientId: string): Promise<void> {
    try {
      logInfo('Syncing active continue-watching sessions from Trakt...');
      const response = await makeRequest(`${TRAKT_API_URL}/sync/playback`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'trakt-api-version': '2',
          'trakt-api-key': clientId,
        },
      });

      if (response.ok) {
        const items = await response.json();
        if (Array.isArray(items)) {
          for (const item of items) {
            const fraction = item.progress ? item.progress / 100 : 0;
            if (fraction <= 0.02 || fraction >= 0.95) continue;

            const imdbId = item.movie?.ids?.imdb || item.show?.ids?.imdb;
            if (!imdbId) continue;

            if (item.type === 'movie' && item.movie) {
              const title = item.movie.title;
              const year = item.movie.year ? String(item.movie.year) : undefined;
              
              // Sync to local sqlite DB
              await updateVodWatchProgress(imdbId, 'movie', Math.floor(fraction * 7200), 7200).catch(() => {});
              
              logInfo(`Synced Trakt Movie resume progress: ${title} (${Math.round(item.progress)}%)`);
            } else if (item.type === 'episode' && item.show && item.episode) {
              const showTitle = item.show.title;
              const season = item.episode.season;
              const epNum = item.episode.number;
              const videoId = `imdbId:${imdbId}:${season}:${epNum}`; // standard stremio video ID string format
              
              // Sync to local sqlite DB
              const mediaId = `${imdbId}_ep_${videoId}`;
              await updateVodWatchProgress(imdbId, 'series', Math.floor(fraction * 2700), 2700).catch(() => {});
              await recordEpisodeWatch(videoId, imdbId, 'stremio', season, epNum, `Episode ${epNum}`, Math.floor(fraction * 2700), 2700).catch(() => {});

              logInfo(`Synced Trakt Series resume progress: ${showTitle} S${season}E${epNum} (${Math.round(item.progress)}%)`);
            }
          }
        }
      }
    } catch (e) {
      logWarn('Trakt playback progress sync error:', e);
    }
  }

  private async syncSimklPlaybackProgress(token: string, clientId: string): Promise<void> {
    try {
      logInfo('Syncing active continue-watching sessions from Simkl...');
      
      // Simkl splits playback status into movies and episodes
      const types = ['movies', 'episodes'];
      for (const type of types) {
        const response = await makeRequest(`${SIMKL_API_URL}/sync/playback/${type}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'simkl-api-key': clientId,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const items = data[type] || data.shows || data.movies || data;
          if (Array.isArray(items)) {
            for (const item of items) {
              const fraction = item.progress ? item.progress / 100 : 0;
              if (fraction <= 0.02 || fraction >= 0.95) continue;

              const imdbId = item.movie?.ids?.imdb || item.show?.ids?.imdb;
              if (!imdbId) continue;

              if (type === 'movies' && item.movie) {
                const title = item.movie.title;
                
                // Sync to local sqlite DB
                await updateVodWatchProgress(imdbId, 'movie', Math.floor(fraction * 7200), 7200).catch(() => {});

                logInfo(`Synced Simkl Movie resume progress: ${title} (${Math.round(item.progress)}%)`);
              } else if (type === 'episodes' && item.show && item.episode) {
                const showTitle = item.show.title;
                const season = item.episode.season;
                const epNum = item.episode.number;
                const videoId = `imdbId:${imdbId}:${season}:${epNum}`;
                
                // Sync to local sqlite DB
                await updateVodWatchProgress(imdbId, 'series', Math.floor(fraction * 2700), 2700).catch(() => {});
                await recordEpisodeWatch(videoId, imdbId, 'stremio', season, epNum, `Episode ${epNum}`, Math.floor(fraction * 2700), 2700).catch(() => {});

                logInfo(`Synced Simkl Series resume progress: ${showTitle} S${season}E${epNum} (${Math.round(item.progress)}%)`);
              }
            }
          }
        }
      }
    } catch (e) {
      logWarn('Simkl playback progress sync error:', e);
    }
  }

  // --------------------------------------------------------------------------
  // Catalog Fetching (Transforms Trakt/Simkl APIs into Stremio-friendly items)
  // --------------------------------------------------------------------------
  async fetchTraktCatalog(type: TraktCatalogType, page: number = 1): Promise<{ items: StremioMetaPreview[]; hasMore: boolean }> {
    const settings = await this.getSettings();
    if (!settings.traktEnabled || !settings.traktAccessToken) return { items: [], hasMore: false };

    try {
      const { clientId } = getTraktCredentials();
      const headers = {
        'Authorization': `Bearer ${settings.traktAccessToken}`,
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
      };

      const baseUrl = TRAKT_CATALOG_URLS[type];
      if (!baseUrl) return { items: [], hasMore: false };
      const url = `${baseUrl}&page=${page}`;

      logInfo(`Fetching Trakt ${type} catalog page ${page}...`);
      const response = await makeRequest(url, { method: 'GET', headers });

      if (response.ok) {
        let rawItems = await response.json();
        if (Array.isArray(rawItems)) {
          // For history, deduplicate shows keeping only the latest watched episode
          if (type === 'history') {
            const seen = new Map<string, { item: any; epoch: number }>();
            for (const item of rawItems) {
              const media = item.movie || item.show || item;
              const imdbId = media?.ids?.imdb;
              if (!imdbId) continue;
              if (item.type === 'episode' || item.show) {
                const epoch = new Date(item.watched_at || 0).getTime();
                const existing = seen.get(imdbId);
                if (!existing || epoch > existing.epoch) {
                  seen.set(imdbId, { item, epoch });
                }
              } else {
                if (!seen.has(imdbId)) {
                  seen.set(imdbId, { item, epoch: 0 });
                }
              }
            }
            rawItems = Array.from(seen.values()).map(e => e.item);
          }

          const isWrapped = WRAPPED_CATALOGS.has(type);
          const items = rawItems.map((item: any) => {
            let media: any;
            let itemType: 'movie' | 'series';

            if (isWrapped) {
              media = item.movie || item.show || item;
              if (item.type === 'movie') itemType = 'movie';
              else if (item.type === 'show' || item.type === 'episode') itemType = 'series';
              else if (item.movie) itemType = 'movie';
              else if (item.show) itemType = 'series';
              else itemType = type.includes('movie') ? 'movie' : 'series';
            } else {
              media = item;
              if (item.type === 'movie') itemType = 'movie';
              else if (item.type === 'show' || item.type === 'series') itemType = 'series';
              else itemType = type.includes('movie') ? 'movie' : 'series';
            }

            const imdbId = media?.ids?.imdb;
            if (!imdbId) return null;

            let name = media.title;
            let releaseInfo: string | undefined;

            // Tag history items with the latest season/episode
            if (type === 'history' && !item.movie && item.episode) {
              const ep = item.episode;
              name = `${media.title} \u2014 S${ep.season}:E${ep.number}`;
              releaseInfo = `S${ep.season}:E${ep.number}`;
            }

            const result: Record<string, any> = {
              id: imdbId,
              type: itemType,
              name,
              poster: `https://images.metahub.space/poster/medium/${imdbId}/img`,
              imdbRating: media.rating ? String(typeof media.rating === 'number' ? media.rating.toFixed(1) : media.rating) : undefined,
              year: media.year,
              releaseInfo,
            };

            // Carry season/episode for deep-link navigation
            if (type === 'history' && !item.movie && item.episode) {
              result.traktSeason = item.episode.season;
              result.traktEpisode = item.episode.number;
            }

            return result;
          }).filter(Boolean) as StremioMetaPreview[];

          const hasMore = items.length >= TRAKT_PAGE_LIMIT;
          return { items, hasMore };
        }
      }
    } catch (e) {
      logError(`Failed to fetch Trakt catalog ${type}:`, e);
    }
    return { items: [], hasMore: false };
  }

  // --------------------------------------------------------------------------
  // Trakt Custom Lists
  // --------------------------------------------------------------------------
  async fetchTraktLists(): Promise<{ id: { trakt: number; slug: string }; name: string }[]> {
    const settings = await this.getSettings();
    if (!settings.traktEnabled || !settings.traktAccessToken) return [];

    try {
      const { clientId } = getTraktCredentials();
      const headers = {
        'Authorization': `Bearer ${settings.traktAccessToken}`,
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
      };

      const url = `${TRAKT_API_URL}/users/me/lists`;
      logInfo('Fetching Trakt user lists...');
      const response = await makeRequest(url, { method: 'GET', headers });

      if (response.ok) {
        const lists = await response.json();
        if (Array.isArray(lists)) {
          return lists.map((list: any) => ({
            id: { trakt: list.ids?.trakt, slug: list.ids?.slug },
            name: list.name,
          }));
        }
      }
    } catch (e) {
      logError('Failed to fetch Trakt lists:', e);
    }
    return [];
  }

  async fetchTraktListCatalog(listId: string, page: number = 1): Promise<{ items: StremioMetaPreview[]; hasMore: boolean }> {
    const settings = await this.getSettings();
    if (!settings.traktEnabled || !settings.traktAccessToken) return { items: [], hasMore: false };

    try {
      const { clientId } = getTraktCredentials();
      const headers = {
        'Authorization': `Bearer ${settings.traktAccessToken}`,
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
      };

      const url = `${TRAKT_API_URL}/users/me/lists/${listId}/items?limit=${TRAKT_PAGE_LIMIT}&page=${page}`;
      logInfo(`Fetching Trakt list catalog ${listId} page ${page}...`);
      const response = await makeRequest(url, { method: 'GET', headers });

      if (response.ok) {
        const rawItems = await response.json();
        if (Array.isArray(rawItems)) {
          const items = rawItems.map((item: any) => {
            const media = item.movie || item.show || item;
            let itemType: 'movie' | 'series' = 'series';
            if (item.type === 'movie' || item.movie) {
              itemType = 'movie';
            } else if (item.type === 'show' || item.type === 'series' || item.type === 'episode' || item.show) {
              itemType = 'series';
            } else {
              itemType = item.type === 'movie' ? 'movie' : 'series';
            }
            const imdbId = media?.ids?.imdb;
            if (!imdbId) return null;

            return {
              id: imdbId,
              type: itemType,
              name: media.title,
              poster: `https://images.metahub.space/poster/medium/${imdbId}/img`,
              imdbRating: media.rating ? String(typeof media.rating === 'number' ? media.rating.toFixed(1) : media.rating) : undefined,
              year: media.year,
            };
          }).filter(Boolean) as StremioMetaPreview[];

          const hasMore = items.length >= TRAKT_PAGE_LIMIT;
          return { items, hasMore };
        }
      }
    } catch (e) {
      logError(`Failed to fetch Trakt list catalog ${listId}:`, e);
    }
    return { items: [], hasMore: false };
  }

  async fetchSimklCatalog(type: 'watchlist' | 'history'): Promise<any[]> {
    const settings = await this.getSettings();
    if (!settings.simklEnabled || !settings.simklAccessToken) return [];

    try {
      const { clientId } = getSimklCredentials();
      const headers = {
        'Authorization': `Bearer ${settings.simklAccessToken}`,
        'simkl-api-key': clientId,
      };

      let url = '';
      if (type === 'watchlist') {
        // Fetch items from library marked as "plantowatch" or "watching"
        url = `${SIMKL_API_URL}/sync/all-items`;
      } else {
        url = `${SIMKL_API_URL}/sync/history?limit=30`;
      }

      logInfo(`Fetching Simkl ${type} catalog...`);
      const response = await makeRequest(url, { method: 'GET', headers });

      if (response.ok) {
        const data = await response.json();
        
        if (type === 'watchlist') {
          // Parse Simkl library
          const list: any[] = [];
          const movies = data.movies || [];
          const shows = data.shows || [];

          [...movies, ...shows].forEach((item: any) => {
            // Include items in watchlists
            if (item.status === 'plantowatch' || item.status === 'watching') {
              const media = item.movie || item.show;
              const imdbId = media?.ids?.imdb;
              if (imdbId) {
                list.push({
                  id: imdbId,
                  type: item.movie ? 'movie' : 'series',
                  name: media.title,
                  poster: `https://images.metahub.space/poster/medium/${imdbId}/img`,
                  year: media.year,
                });
              }
            }
          });
          return list;
        } else {
          // Parse Simkl history items
          if (Array.isArray(data)) {
            return data.map((item: any) => {
              const media = item.movie || item.show;
              const imdbId = media?.ids?.imdb;
              if (!imdbId) return null;

              return {
                id: imdbId,
                type: item.movie ? 'movie' : 'series',
                name: media.title,
                poster: `https://images.metahub.space/poster/medium/${imdbId}/img`,
                year: media.year,
              };
            }).filter(Boolean);
          }
        }
      }
    } catch (e) {
      logError(`Failed to fetch Simkl catalog ${type}:`, e);
    }
    return [];
  }
}

export const scrobbler = new ScrobblerService();

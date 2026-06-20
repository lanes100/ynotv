import type { InstalledAddon, StremioManifest, StremioCatalogResponse, StremioMeta, StremioStream, StremioSubtitle } from '../types/stremio';

const MANIFEST_CACHE = new Map<string, { manifest: StremioManifest; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

const CATALOG_CACHE = new Map<string, Promise<StremioCatalogResponse>>();
const CATALOG_RESPONSE_CACHE = new Map<string, StremioCatalogResponse>();
const META_CACHE = new Map<string, Promise<StremioMeta | null>>();
const META_RESPONSE_CACHE = new Map<string, StremioMeta>();

export function clearCatalogCache() {
  CATALOG_CACHE.clear();
  CATALOG_RESPONSE_CACHE.clear();
  META_CACHE.clear();
  META_RESPONSE_CACHE.clear();
}

async function fetchJson(url: string): Promise<any> {
  const proxy = window.fetchProxy;
  if (proxy?.fetch) {
    const res = await proxy.fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (res.error) throw new Error(res.error);
    if (!res.data) throw new Error(`Failed to fetch ${url}`);
    if (!res.data.ok) throw new Error(`HTTP ${res.data.status} for ${url}`);
    return await res.data.json();
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/manifest\.json$/, '').replace(/\/+$/, '');
}

function addonHasResource(addon: InstalledAddon, resource: string): boolean {
  return addon.manifest.resources.some(r => {
    if (typeof r === 'string') return r === resource;
    return r.name === resource;
  });
}

export async function fetchManifest(url: string): Promise<StremioManifest> {
  const cached = MANIFEST_CACHE.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.manifest;
  }
  const manifest = await fetchJson(url) as StremioManifest;
  MANIFEST_CACHE.set(url, { manifest, ts: Date.now() });
  return manifest;
}

export function getCachedCatalog(
  baseUrl: string,
  type: string,
  id: string,
  extra?: Record<string, string>
): StremioCatalogResponse | undefined {
  let url = `${normalizeBaseUrl(baseUrl)}/catalog/${type}/${id}`;
  const extraArgs = extra
    ? Object.entries(extra)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    : '';
  if (extraArgs) {
    url += `/${extraArgs}`;
  }
  url += '.json';
  return CATALOG_RESPONSE_CACHE.get(url);
}

export async function fetchCatalog(
  baseUrl: string,
  type: string,
  id: string,
  extra?: Record<string, string>
): Promise<StremioCatalogResponse> {
  let url = `${normalizeBaseUrl(baseUrl)}/catalog/${type}/${id}`;
  const extraArgs = extra
    ? Object.entries(extra)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    : '';
  if (extraArgs) {
    url += `/${extraArgs}`;
  }
  url += '.json';

  const cachedResponse = CATALOG_RESPONSE_CACHE.get(url);
  if (cachedResponse) {
    return cachedResponse;
  }

  const cachedPromise = CATALOG_CACHE.get(url);
  if (cachedPromise) {
    return cachedPromise;
  }

  const promise = fetchJson(url) as Promise<StremioCatalogResponse>;
  CATALOG_CACHE.set(url, promise);

  promise
    .then((resp) => {
      CATALOG_RESPONSE_CACHE.set(url, resp);
    })
    .catch(() => {
      CATALOG_CACHE.delete(url);
    });

  return promise;
}

export async function fetchMeta(
  addons: InstalledAddon[],
  type: string,
  id: string
): Promise<StremioMeta | null> {
  const cacheKey = `${type}:${id}`;
  const cachedResponse = META_RESPONSE_CACHE.get(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }
  const cachedPromise = META_CACHE.get(cacheKey);
  if (cachedPromise) {
    return cachedPromise;
  }

  const promise = (async () => {
    for (const addon of addons) {
      if (!addonHasResource(addon, 'meta')) continue;
      try {
        const url = `${normalizeBaseUrl(addon.baseUrl)}/meta/${type}/${id}.json`;
        const data = await fetchJson(url) as { meta: StremioMeta };
        if (data?.meta) {
          META_RESPONSE_CACHE.set(cacheKey, data.meta);
          return data.meta;
        }
      } catch {
        // Try next addon
      }
    }
    META_CACHE.delete(cacheKey);
    return null;
  })();

  META_CACHE.set(cacheKey, promise);

  promise.catch(() => {
    META_CACHE.delete(cacheKey);
  });

  return promise;
}

export async function fetchStreams(
  addons: InstalledAddon[],
  type: string,
  id: string,
  onStreams?: (streams: StremioStream[]) => void
): Promise<StremioStream[]> {
  const results: StremioStream[] = [];
  
  const promises = addons.map(async (addon) => {
    if (!addonHasResource(addon, 'stream')) return;
    try {
      const url = `${normalizeBaseUrl(addon.baseUrl)}/stream/${type}/${id}.json`;
      const data = await fetchJson(url) as { streams: StremioStream[] };
      if (data?.streams) {
        const addonStreams = data.streams.map(s => ({
          ...s,
          addonName: addon.manifest.name
        }));
        results.push(...addonStreams);
        if (onStreams) {
          onStreams(addonStreams);
        }
      }
    } catch {
      // Ignore errors for individual addon
    }
  });

  await Promise.all(promises);
  return results;
}

export async function fetchSubtitles(
  addons: InstalledAddon[],
  type: string,
  id: string,
  extra?: Record<string, string>
): Promise<StremioSubtitle[]> {
  const results: StremioSubtitle[] = [];
  
  const promises = addons.map(async (addon) => {
    if (!addonHasResource(addon, 'subtitles')) return;
    try {
      let url = `${normalizeBaseUrl(addon.baseUrl)}/subtitles/${type}/${id}`;
      const extraArgs = extra
        ? Object.entries(extra)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
          .join('&')
        : '';
      if (extraArgs) {
        url += `/${extraArgs}`;
      }
      url += '.json';
      const data = await fetchJson(url) as { subtitles: StremioSubtitle[] };
      if (data?.subtitles) {
        const addonSubtitles = data.subtitles.map(sub => ({
          ...sub,
          addonName: addon.manifest.name
        }));
        results.push(...addonSubtitles);
      }
    } catch {
      // Ignore errors for individual addon
    }
  });

  await Promise.all(promises);
  return results;
}

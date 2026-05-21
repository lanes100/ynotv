import type { InstalledAddon, StremioManifest, StremioCatalogResponse, StremioMeta, StremioStream, StremioSubtitle } from '../types/stremio';

const MANIFEST_CACHE = new Map<string, { manifest: StremioManifest; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

const CATALOG_CACHE = new Map<string, Promise<StremioCatalogResponse>>();

export function clearCatalogCache() {
  CATALOG_CACHE.clear();
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

  const cachedPromise = CATALOG_CACHE.get(url);
  if (cachedPromise) {
    return cachedPromise;
  }

  const promise = fetchJson(url) as Promise<StremioCatalogResponse>;
  CATALOG_CACHE.set(url, promise);

  promise.catch(() => {
    CATALOG_CACHE.delete(url);
  });

  return promise;
}

export async function fetchMeta(
  addons: InstalledAddon[],
  type: string,
  id: string
): Promise<StremioMeta | null> {
  for (const addon of addons) {
    if (!addonHasResource(addon, 'meta')) continue;
    try {
      const url = `${normalizeBaseUrl(addon.baseUrl)}/meta/${type}/${id}.json`;
      const data = await fetchJson(url) as { meta: StremioMeta };
      if (data?.meta) return data.meta;
    } catch {
      // Try next addon
    }
  }
  return null;
}

export async function fetchStreams(
  addons: InstalledAddon[],
  type: string,
  id: string
): Promise<StremioStream[]> {
  const results: StremioStream[] = [];
  for (const addon of addons) {
    if (!addonHasResource(addon, 'stream')) continue;
    try {
      const url = `${normalizeBaseUrl(addon.baseUrl)}/stream/${type}/${id}.json`;
      const data = await fetchJson(url) as { streams: StremioStream[] };
      if (data?.streams) {
        for (const s of data.streams) {
          s.addonName = addon.manifest.name;
        }
        results.push(...data.streams);
      }
    } catch {
      // Try next addon
    }
  }
  return results;
}

export async function fetchSubtitles(
  addons: InstalledAddon[],
  type: string,
  id: string
): Promise<StremioSubtitle[]> {
  const results: StremioSubtitle[] = [];
  for (const addon of addons) {
    if (!addonHasResource(addon, 'subtitles')) continue;
    try {
      const url = `${normalizeBaseUrl(addon.baseUrl)}/subtitles/${type}/${id}.json`;
      const data = await fetchJson(url) as { subtitles: StremioSubtitle[] };
      if (data?.subtitles) results.push(...data.subtitles);
    } catch {
      // Try next addon
    }
  }
  return results;
}

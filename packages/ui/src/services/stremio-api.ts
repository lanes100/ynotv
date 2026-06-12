const STREMIO_API_URL = 'https://api.strem.io/api';

export interface StremioUser {
  _id: string;
  email: string;
  fullname?: string;
  avatar?: string;
}

export interface StremioLibraryItemState {
  lastWatched?: string;
  timeWatched?: number;
  timeOffset?: number;
  overallTimeWatched?: number;
  timesWatched?: number;
  flaggedWatched?: number;
  duration?: number;
  video_id?: string;
  watched?: string | null;
  lastVidReleased?: string;
  noNotif?: boolean;
  season?: number;
  episode?: number;
}

export interface StremioLibraryItem {
  _id: string;
  name: string;
  type: 'movie' | 'series' | string;
  poster?: string;
  posterShape?: 'square' | 'poster' | 'landscape';
  removed: boolean;
  temp: boolean;
  _ctime?: string;
  _mtime: string;
  state: StremioLibraryItemState;
  behaviorHints?: {
    defaultVideoId?: string | null;
    featuredVideoId?: string | null;
    hasScheduledVideos?: boolean;
  };
}

export interface StremioAddon {
  transportUrl: string;
  manifest: any;
  flags?: {
    official?: boolean;
    protected?: boolean;
  };
}

async function callStremioApi<T>(path: string, body: object): Promise<T> {
  const url = `${STREMIO_API_URL}/${path}`;
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  };

  const proxy = window.fetchProxy;
  if (proxy?.fetch) {
    const res = await proxy.fetch(url, options);
    if (res.error) throw new Error(res.error);
    if (!res.data) throw new Error(`No response data from API: ${path}`);
    if (!res.data.ok) throw new Error(`API HTTP ${res.data.status} for ${path}`);
    const json = await res.data.json();
    if (json.error) throw new Error(json.error.message ?? `Request failed for ${path}`);
    return json.result as T;
  }

  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? `Request failed for ${path}`);
  return json.result as T;
}

export function loginStremio(email: string, password: string) {
  return callStremioApi<{ authKey: string; user: StremioUser }>('login', {
    email,
    password,
    facebook: false,
  });
}

export function logoutStremio(authKey: string) {
  return callStremioApi<unknown>('logout', { authKey });
}

export async function fetchStremioLibrary(authKey: string): Promise<StremioLibraryItem[]> {
  const ids = await callStremioApi<Array<[string, string]>>('datastoreMeta', {
    authKey,
    collection: 'libraryItem',
  });
  if (!ids || ids.length === 0) return [];

  return callStremioApi<StremioLibraryItem[]>('datastoreGet', {
    authKey,
    collection: 'libraryItem',
    ids: ids.map(([id]) => id),
    all: true,
  });
}

export async function putStremioLibraryItem(authKey: string, item: StremioLibraryItem): Promise<void> {
  await callStremioApi<unknown>('datastorePut', {
    authKey,
    collection: 'libraryItem',
    changes: [item],
  });
}

export async function fetchStremioAddons(authKey: string): Promise<StremioAddon[]> {
  const res = await callStremioApi<{ addons: StremioAddon[] }>('addonCollectionGet', {
    authKey,
    type: 'user',
    update: false,
  });
  return res?.addons ?? [];
}

export async function setStremioAddons(authKey: string, addons: StremioAddon[]): Promise<boolean> {
  const res = await callStremioApi<{ success?: boolean }>('addonCollectionSet', {
    authKey,
    type: 'user',
    addons: addons.map((a) => ({
      transportUrl: a.transportUrl,
      transportName: a.manifest?.name ?? '',
      manifest: a.manifest,
      flags: a.flags ?? { official: false, protected: false },
    })),
  });
  return res != null;
}

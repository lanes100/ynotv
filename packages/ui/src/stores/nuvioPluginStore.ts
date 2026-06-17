import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type NuvioPluginRow, fetchNuvioPlugins, pushNuvioPlugins } from '../services/nuvio-api';

export interface PluginRepositoryItem {
  manifestUrl: string;
  name: string;
  description?: string | null;
  version?: string | null;
  scraperCount: number;
  lastUpdated: number;
  isRefreshing: boolean;
  errorMessage?: string | null;
}

export interface PluginScraper {
  id: string; // manifestUrl:scraperId
  repositoryUrl: string;
  name: string;
  description: string;
  version: string;
  filename: string;
  supportedTypes: string[];
  enabled: boolean;
  manifestEnabled: boolean;
  logo?: string | null;
  contentLanguage: string[];
  formats?: string[] | null;
  code: string;
}

interface NuvioPluginState {
  pluginsEnabled: boolean;
  groupStreamsByRepository: boolean;
  repositories: PluginRepositoryItem[];
  scrapers: PluginScraper[];
  isLoading: boolean;
  error: string | null;

  setPluginsEnabled: (enabled: boolean) => void;
  setGroupStreamsByRepository: (enabled: boolean) => void;
  setPlugins: (plugins: NuvioPluginRow[]) => Promise<void>;
  addRepository: (url: string) => Promise<void>;
  removeRepository: (manifestUrl: string) => Promise<void>;
  toggleScraper: (scraperId: string, enabled: boolean) => void;
  refreshRepository: (manifestUrl: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  getEnabledScrapersForType: (type: string) => PluginScraper[];
}

async function fetchText(url: string): Promise<string> {
  const proxy = (window as any).fetchProxy;
  if (proxy?.fetch) {
    const res = await proxy.fetch(url);
    if (res.error) throw new Error(res.error);
    if (!res.data) throw new Error(`No data returned for ${url}`);
    return res.data.text;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

async function fetchRepositoryData(
  manifestUrl: string,
  previousScrapers: Record<string, PluginScraper>
): Promise<{ repo: PluginRepositoryItem; scrapers: PluginScraper[] }> {
  const payload = await fetchText(manifestUrl);
  let manifest: any;
  try {
    manifest = JSON.parse(payload);
  } catch (e) {
    throw new Error('Failed to parse plugin manifest JSON');
  }

  if (!manifest.name || !manifest.version) {
    throw new Error('Invalid manifest: missing name or version');
  }

  const cleanUrl = manifestUrl.split('?')[0];
  const baseUrl = cleanUrl.endsWith('/manifest.json')
    ? cleanUrl.slice(0, -'/manifest.json'.length)
    : cleanUrl.substring(0, cleanUrl.lastIndexOf('/'));

  const scrapers: PluginScraper[] = [];
  const scraperPromises = (manifest.scrapers || []).map(async (info: any) => {
    try {
      const filename = info.filename || '';
      const codeUrl = (filename.startsWith('http://') || filename.startsWith('https://'))
        ? filename
        : `${baseUrl}/${filename.replace(/^\/+/, '')}`;
      
      const code = await fetchText(codeUrl);
      const scraperId = `${manifestUrl.toLowerCase()}:${info.id}`;
      const previous = previousScrapers[scraperId];
      const enabled = !info.hasOwnProperty('enabled') || info.enabled;

      scrapers.push({
        id: scraperId,
        repositoryUrl: manifestUrl,
        name: info.name || info.id,
        description: info.description || '',
        version: info.version || '1.0.0',
        filename: info.filename || '',
        supportedTypes: info.supportedTypes || ['movie', 'tv'],
        enabled: previous ? previous.enabled : enabled,
        manifestEnabled: enabled,
        logo: info.logo || null,
        contentLanguage: info.contentLanguage || [],
        formats: info.formats || info.supportedFormats || null,
        code,
      });
    } catch (err) {
      console.warn(`[NuvioPluginStore] Failed to load scraper ${info.id}:`, err);
    }
  });

  await Promise.all(scraperPromises);

  const repo: PluginRepositoryItem = {
    manifestUrl,
    name: manifest.name,
    description: manifest.description || null,
    version: manifest.version || null,
    scraperCount: scrapers.length,
    lastUpdated: Date.now(),
    isRefreshing: false,
    errorMessage: null,
  };

  return { repo, scrapers };
}

async function pushToServer(repositories: PluginRepositoryItem[]) {
  const { useNuvioAuthStore } = await import('./nuvioAuthStore');
  const { token, activeProfile } = useNuvioAuthStore.getState();
  if (!token || !activeProfile) return;

  const pushItems: NuvioPluginRow[] = repositories.map((repo, index) => ({
    url: repo.manifestUrl,
    name: repo.name,
    enabled: true,
    sort_order: index,
  }));

  try {
    await pushNuvioPlugins(token, activeProfile.profile_index, pushItems);
  } catch (e) {
    console.error('[NuvioPluginStore] Failed to push plugins to server:', e);
  }
}

export const useNuvioPluginStore = create<NuvioPluginState>()(
  persist(
    (set, get) => ({
      pluginsEnabled: true,
      groupStreamsByRepository: false,
      repositories: [],
      scrapers: [],
      isLoading: false,
      error: null,

      setPluginsEnabled: (enabled) => {
        set({ pluginsEnabled: enabled });
      },

      setGroupStreamsByRepository: (enabled) => {
        set({ groupStreamsByRepository: enabled });
      },

      setPlugins: async (pulledPlugins) => {
        const currentRepos = get().repositories;
        const currentScrapers = get().scrapers;

        const pulledUrls = pulledPlugins.map(p => p.url);

        // Remove repos that are not in pulled list
        let nextRepos = currentRepos.filter(r => pulledUrls.includes(r.manifestUrl));
        let nextScrapers = currentScrapers.filter(s => pulledUrls.includes(s.repositoryUrl));

        // Find new repos to fetch
        const newUrls = pulledUrls.filter(url => !nextRepos.some(r => r.manifestUrl === url));

        for (const url of newUrls) {
          const name = url.split('?')[0].split('/').pop() || url;
          nextRepos.push({
            manifestUrl: url,
            name,
            scraperCount: 0,
            lastUpdated: Date.now(),
            isRefreshing: true,
          });
          set({ repositories: [...nextRepos] });

          try {
            const previousById = currentScrapers.reduce((acc, s) => ({ ...acc, [s.id]: s }), {} as Record<string, PluginScraper>);
            const { repo, scrapers } = await fetchRepositoryData(url, previousById);
            nextRepos = nextRepos.map(r => r.manifestUrl === url ? repo : r);
            nextScrapers = [...nextScrapers, ...scrapers];
            set({ repositories: [...nextRepos], scrapers: [...nextScrapers] });
          } catch (e: any) {
            console.error(`[NuvioPluginStore] Failed to load synced repository ${url}:`, e);
            nextRepos = nextRepos.map(r => r.manifestUrl === url ? {
              ...r,
              isRefreshing: false,
              errorMessage: e.message || 'Failed to load repository',
            } : r);
            set({ repositories: [...nextRepos] });
          }
        }

        // Sort nextRepos based on the pulled list order
        const orderMap = new Map(pulledUrls.map((url, idx) => [url, idx]));
        nextRepos.sort((a, b) => (orderMap.get(a.manifestUrl) ?? 0) - (orderMap.get(b.manifestUrl) ?? 0));

        set({ repositories: nextRepos, scrapers: nextScrapers });
      },

      addRepository: async (url) => {
        // Normalize URL - remove duplicate trailing slashes or manifest.json if present
        let manifestUrl = url.trim();
        if (!manifestUrl.startsWith('http://') && !manifestUrl.startsWith('https://')) {
          throw new Error('URL must start with http:// or https://');
        }

        if (get().repositories.some(r => r.manifestUrl.toLowerCase() === manifestUrl.toLowerCase())) {
          throw new Error('Repository is already installed');
        }

        set({ isLoading: true, error: null });

        try {
          const previousById = get().scrapers.reduce((acc, s) => ({ ...acc, [s.id]: s }), {} as Record<string, PluginScraper>);
          const { repo, scrapers } = await fetchRepositoryData(manifestUrl, previousById);
          
          const nextRepos = [...get().repositories, repo];
          const nextScrapers = [...get().scrapers.filter(s => s.repositoryUrl !== manifestUrl), ...scrapers];

          set({ repositories: nextRepos, scrapers: nextScrapers });
          await pushToServer(nextRepos);
        } catch (e: any) {
          set({ error: e.message || 'Failed to add repository' });
          throw e;
        } finally {
          set({ isLoading: false });
        }
      },

      removeRepository: async (manifestUrl) => {
        const nextRepos = get().repositories.filter(r => r.manifestUrl !== manifestUrl);
        const nextScrapers = get().scrapers.filter(s => s.repositoryUrl !== manifestUrl);
        
        set({ repositories: nextRepos, scrapers: nextScrapers });
        await pushToServer(nextRepos);
      },

      toggleScraper: (scraperId, enabled) => {
        const nextScrapers = get().scrapers.map(s => 
          s.id === scraperId ? { ...s, enabled: s.manifestEnabled ? enabled : false } : s
        );
        set({ scrapers: nextScrapers });
      },

      refreshRepository: async (manifestUrl) => {
        set({
          repositories: get().repositories.map(r => 
            r.manifestUrl === manifestUrl ? { ...r, isRefreshing: true, errorMessage: null } : r
          )
        });

        try {
          const previousById = get().scrapers.reduce((acc, s) => ({ ...acc, [s.id]: s }), {} as Record<string, PluginScraper>);
          const { repo, scrapers } = await fetchRepositoryData(manifestUrl, previousById);

          const nextRepos = get().repositories.map(r => r.manifestUrl === manifestUrl ? repo : r);
          const nextScrapers = [...get().scrapers.filter(s => s.repositoryUrl !== manifestUrl), ...scrapers];

          set({ repositories: nextRepos, scrapers: nextScrapers });
        } catch (e: any) {
          set({
            repositories: get().repositories.map(r => 
              r.manifestUrl === manifestUrl ? {
                ...r,
                isRefreshing: false,
                errorMessage: e.message || 'Refresh failed',
              } : r
            )
          });
          throw e;
        }
      },

      refreshAll: async () => {
        const repos = get().repositories;
        const promises = repos.map(r => get().refreshRepository(r.manifestUrl).catch(() => {}));
        await Promise.all(promises);
      },

      getEnabledScrapersForType: (type) => {
        if (!get().pluginsEnabled) return [];
        const normalizedType = type.toLowerCase() === 'series' || type.toLowerCase() === 'show' ? 'tv' : type.toLowerCase();
        return get().scrapers.filter(s => s.enabled && s.supportedTypes.includes(normalizedType));
      },
    }),
    {
      name: 'ynotv-nuvio-plugins',
    }
  )
);

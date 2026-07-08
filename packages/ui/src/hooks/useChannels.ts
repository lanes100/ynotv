import { useLiveQuery } from './useSqliteLiveQuery';
import { db, getLastCategory, setLastCategory } from '../db';
import type { StoredChannel, StoredCategory, SourceMeta, StoredProgram } from '../db';
import { decompressEpgDescription } from '../utils/compression';
import { getRecentChannels, onRecentChannelsUpdate } from '../utils/recentChannels';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSourceVersion } from '../contexts/SourceVersionContext';
import { applyFilterWords } from './useFilterWords';
import { useCategorySortOrder } from '../stores/uiStore';
import { useAppSettings } from './useAppSettings';
import type { Source } from '@ynotv/core';

// Hook to get enabled source IDs (for filtering data from disabled sources)
// Returns null during loading to avoid hiding all data
export function useEnabledSources(): Set<string> | null {
  const { version } = useSourceVersion(); // Track source changes

  const sources = useLiveQuery(async () => {
    if (!window.storage) return null;
    const result = await window.storage.getSources();
    if (!result.data) return null;
    return result.data.filter(s => s.enabled !== false);
  }, [version]); // Re-run when version changes

  // Return null if still loading sources
  if (sources === undefined || sources === null) return null;

  return new Set(sources.map(s => s.id));
}

// Cached source names map to avoid repeated Tauri calls
let cachedSourceNameMap: Map<string, string> | null = null;
let cachedSourceVersion = -1;

// Hook to get source name map - cached to avoid repeated Tauri calls
export function useSourceNameMap(): Map<string, string> | null {
  const { version } = useSourceVersion();
  const [sourceMap, setSourceMap] = useState<Map<string, string> | null>(cachedSourceNameMap);

  useEffect(() => {
    // Return cached version if still valid
    if (cachedSourceNameMap && cachedSourceVersion === version) {
      setSourceMap(cachedSourceNameMap);
      return;
    }

    async function fetchSources() {
      if (!window.storage) return;
      const result = await window.storage.getSources();
      if (result.data) {
        const map = new Map<string, string>();
        for (const source of result.data) {
          map.set(source.id, source.name);
        }
        cachedSourceNameMap = map;
        cachedSourceVersion = version;
        setSourceMap(map);
      }
    }

    fetchSources();
  }, [version]);

  return sourceMap;
}

// Cached category names map to avoid repeated DB calls
let cachedCategoryNameMap: Map<string, string> | null = null;
let cachedCategoryVersion = -1;

// Hook to get category name map - cached to avoid repeated DB calls
function useCategoryNameMap(): Map<string, string> | null {
  const { version } = useSourceVersion();
  const [categoryMap, setCategoryMap] = useState<Map<string, string> | null>(cachedCategoryNameMap);

  useEffect(() => {
    // Return cached version if still valid
    if (cachedCategoryNameMap && cachedCategoryVersion === version) {
      setCategoryMap(cachedCategoryNameMap);
      return;
    }

    async function fetchCategories() {
      const allCategories = await db.categories.toArray();
      const map = new Map<string, string>();
      for (const cat of allCategories) {
        map.set(cat.category_id, cat.category_name);
      }
      cachedCategoryNameMap = map;
      cachedCategoryVersion = version;
      setCategoryMap(map);
    }

    fetchCategories();
  }, [version]);

  return categoryMap;
}

// Hook to get all categories across all sources (filtered by enabled sources and categories)
// Includes virtual "Favorites" category if any channels are favorited
export function useCategories() {
  const enabledSourceIds = useEnabledSources();
  const [recentVersion, setRecentVersion] = useState(0);

  // Listen for recent channels updates
  useEffect(() => {
    const unsubscribe = onRecentChannelsUpdate(() => {
      setRecentVersion(v => v + 1);
    });
    return unsubscribe;
  }, []);

  const enabledSourceKey = useMemo(
    () => (enabledSourceIds ? Array.from(enabledSourceIds).sort().join(',') : 'loading'),
    [enabledSourceIds]
  );

  const categories = useLiveQuery(
    async () => {
      // Don't filter if sources haven't loaded yet
      if (!enabledSourceIds) return db.categories.orderBy('category_name').toArray();

      // Parallel loading: categories, custom groups, and favorite count all at once
      const [allCategoriesResult, customGroupsResult, favoriteCountResult, recentChannelsResult] = await Promise.all([
        // Load categories and filter by enabled sources
        db.categories.filter(cat => enabledSourceIds.has(cat.source_id)).sortBy('category_name').catch(err => {
          console.error('[useCategories] Failed to load categories:', err);
          return [];
        }),
        // Load custom groups
        db.customGroups.orderBy('display_order').toArray().catch(err => {
          console.error('[useCategories] Failed to load custom groups:', err);
          return [];
        }),
        // Count favorites
        db.channels.countWhere('(is_favorite = 1 OR is_favorite = true)').catch(err => {
          console.error('[useCategories] Failed to count favorites:', err);
          return 0;
        }),
        // Get recent channels (sync, just reads from array)
        Promise.resolve(getRecentChannels())
      ]);

      const allCategories = allCategoriesResult;
      const customGroups = customGroupsResult;
      const favoriteCount = favoriteCountResult;
      const recentChannels = recentChannelsResult;

      // Filter out disabled categories (enabled defaults to true if not set)
      const enabledCategories = allCategories.filter(cat => cat.enabled !== false);

      const virtualCategories: StoredCategory[] = [];

      // Always show Recently Viewed category
      const recentCategory: StoredCategory = {
        category_id: '__recent__',
        category_name: '🕐 Recently Viewed',
        source_id: '__virtual__',
        channel_count: recentChannels.length,
        enabled: true,
      };
      virtualCategories.push(recentCategory);

      // Batch count custom group channels with single SQL query
      if (customGroups.length > 0) {
        try {
          const dbInstance = await (db as any).dbPromise;
          const groupIds = customGroups.map(g => g.group_id);
          const placeholders = groupIds.map(() => '?').join(',');
          
          // Single query to get all counts
          const countRows = await dbInstance.select(
            `SELECT group_id, COUNT(*) as cnt FROM custom_group_channels 
             WHERE group_id IN (${placeholders}) 
             GROUP BY group_id`,
            groupIds
          );
          
          // Build count map
          const countMap = new Map<string, number>();
          for (const row of countRows) {
            countMap.set(row.group_id, row.cnt);
          }
          
          // Build virtual categories with counts
          const customGroupCategories = customGroups.map(g => ({
            category_id: g.group_id,
            category_name: `📂 ${g.name}`,
            source_id: '__custom_group__',
            channel_count: countMap.get(g.group_id) || 0,
            enabled: true
          } as StoredCategory));
          
          virtualCategories.push(...customGroupCategories);
        } catch (err) {
          console.error('[useCategories] Failed to count custom group channels:', err);
          // Still show custom groups but with 0 count
          const customGroupCategories = customGroups.map(g => ({
            category_id: g.group_id,
            category_name: `📂 ${g.name}`,
            source_id: '__custom_group__',
            channel_count: 0,
            enabled: true
          } as StoredCategory));
          virtualCategories.push(...customGroupCategories);
        }
      }

      // Add Favorites category if there are favorites
      if (favoriteCount > 0) {
        const favoritesCategory: StoredCategory = {
          category_id: '__favorites__',
          category_name: '⭐ Favorites',
          source_id: '__virtual__',
          channel_count: favoriteCount,
          enabled: true,
        };
        virtualCategories.push(favoritesCategory);
      }

      return [...virtualCategories, ...enabledCategories];
    },
    [enabledSourceKey, recentVersion],
    undefined, // defaultResult
    30000, // staleTime: 30 seconds - categories rarely change during session
    undefined // Watch all tables - custom groups are in customGroups table, not categories table
  );
  return categories ?? [];
}


// Hook to get categories for a specific source
export function useCategoriesForSource(sourceId: string | null) {
  const categories = useLiveQuery<StoredCategory[]>(
    async () => {
      if (sourceId) {
        // Use toArray() after sortBy since sortBy returns a Collection
        return await db.categories.where('source_id').equals(sourceId).sortBy('category_name');
      }
      return await db.categories.orderBy('category_name').toArray();
    },
    [sourceId]
  );
  return categories ?? [];
}

// Hook to get channels for a category (or all if categoryId is null)
// sortOrder: 'alphabetical' (default), 'number' (by channel_num from provider), or 'provider' (M3U file order)
// Filters out channels from disabled sources
export function useChannels(categoryId: string | null, sortOrder: 'alphabetical' | 'number' | 'provider' = 'alphabetical', options?: { skip?: boolean }) {
  const enabledSourceIds = useEnabledSources();
  const { epgPreferEpgLogos } = useAppSettings();
  const enabledSourceKey = useMemo(
    () => (enabledSourceIds ? Array.from(enabledSourceIds).sort().join(',') : 'loading'),
    [enabledSourceIds]
  );
  
  // Determine which table to watch based on category type
  // Custom groups need to watch customGroupChannels table for updates
  const tableName = useMemo(() => {
    if (!categoryId) return 'channels';
    if (categoryId === '__recent__' || categoryId === '__favorites__') return 'channels';
    // For custom groups (UUID format), watch both channels and customGroupChannels
    // We'll use a special indicator and handle it in the effect
    return 'channels'; // Default, we'll add custom subscription
  }, [categoryId]);
  
  const channels = useLiveQuery(
    async () => {
      if (options?.skip) return [];
      let results: StoredChannel[];
      // Set to true in branches that manage their own ordering so the final sort is skipped
      let orderingIsFixed = false;

      // Handle virtual categories
      if (categoryId === '__recent__') {
        // Fetch recently viewed channels in order
        const recentEntries = getRecentChannels();
        const recentIds = recentEntries.map(e => e.streamId);

        if (recentIds.length === 0) {
          results = [];
        } else {
          // Optimized: Fetch only the channels we need using anyOf
          const channels = await db.channels.where('stream_id').anyOf(recentIds).toArray();
          const channelMap = new Map(channels.map(ch => [ch.stream_id, ch]));

          // Maintain order from recent list
          results = recentEntries
            .map(entry => channelMap.get(entry.streamId))
            .filter((ch): ch is StoredChannel => ch !== undefined);
          orderingIsFixed = true;
        }
      } else if (categoryId === '__favorites__') {
        // Use SQL WHERE for better performance
        results = await db.channels.whereRaw('(is_favorite = 1 OR is_favorite = true)').toArray();
        // Sort by fav_order (nulls last, then by name for items without order)
        results.sort((a, b) => {
          if (a.fav_order != null && b.fav_order != null) return a.fav_order - b.fav_order;
          if (a.fav_order != null) return -1;
          if (b.fav_order != null) return 1;
          return (a.alias || a.name).localeCompare(b.alias || b.name);
        });
        orderingIsFixed = true;
      } else if (categoryId && categoryId.startsWith('__plcat_')) {
        const linkId = parseInt(categoryId.replace('__plcat_', ''), 10);
        if (isNaN(linkId)) {
          results = [];
        } else {
          const link = await db.playlistCategoryLinks.get(linkId);
          if (!link) {
            results = [];
          } else {
            results = await db.channels.whereRaw(
              `source_id = ? AND EXISTS (SELECT 1 FROM json_each(category_ids) WHERE value = ?) AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))`,
              [link.source_id, link.category_id]
            ).toArray();

            // Fetch manually added individual channels for this category link
            let manualMappings = await db.playlistIndividualChannels
              .whereRaw('playlist_id = ? AND parent_category_id = ?', [link.playlist_id, `link:${link.id}`])
              .toArray();
            if (manualMappings.length === 0) {
              // Fallback inheritance: load mappings from target category
              manualMappings = await db.playlistIndividualChannels
                .whereRaw('playlist_id = ? AND parent_category_id = ?', [link.source_id, link.category_id])
                .toArray();
            }
            if (manualMappings.length > 0) {
              const streamIds = manualMappings.map(m => m.stream_id);
              const manualChannels = await db.channels.where('stream_id').anyOf(streamIds).toArray();
              const manualMap = new Map(manualChannels.map(ch => [ch.stream_id, ch]));
              const orderedManual = manualMappings
                .sort((a, b) => a.display_order - b.display_order)
                .map(m => manualMap.get(m.stream_id))
                .filter((ch): ch is StoredChannel => ch !== undefined);

              const manualStreamIds = new Set(manualMappings.map(m => m.stream_id));
              const remainingDynamic = results.filter(ch => !manualStreamIds.has(ch.stream_id));
              results = [...orderedManual, ...remainingDynamic];
              orderingIsFixed = true;
            }
          }
        }
      } else if (categoryId && categoryId.startsWith('__plindiv_')) {
        const playlistId = categoryId.replace('__plindiv_', '');
        const mappings = await db.playlistIndividualChannels
          .where('playlist_id').equals(playlistId)
          .sortBy('display_order');

        const streamIds = mappings.map(m => m.stream_id);
        if (streamIds.length === 0) {
          results = [];
        } else {
          const channels = await db.channels.where('stream_id').anyOf(streamIds).toArray();
          const channelMap = new Map(channels.map(ch => [ch.stream_id, ch]));
          results = mappings
            .map(m => channelMap.get(m.stream_id))
            .filter((ch): ch is StoredChannel => ch !== undefined);
        }
        orderingIsFixed = true;
      } else if (categoryId && categoryId.startsWith('__allsrc_pl_')) {
        // All Channels for a custom playlist
        const playlistId = categoryId.replace('__allsrc_pl_', '');
        const links = await db.playlistCategoryLinks.where('playlist_id').equals(playlistId).toArray();
        if (links.length === 0) {
          results = [];
        } else {
          // Collect all source_id + category_id pairs
          const allResults: StoredChannel[] = [];
          const seenStreamIds = new Set<string>();
          for (const link of links) {
            const linkChannels = await db.channels.whereRaw(
              `source_id = ? AND EXISTS (SELECT 1 FROM json_each(category_ids) WHERE value = ?) AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))`,
              [link.source_id, link.category_id]
            ).toArray();
            for (const ch of linkChannels) {
              if (!seenStreamIds.has(ch.stream_id)) {
                seenStreamIds.add(ch.stream_id);
                allResults.push(ch);
              }
            }
          }
          // Also include individual channels for this playlist
          const individualMappings = await db.playlistIndividualChannels
            .where('playlist_id').equals(playlistId)
            .sortBy('display_order');
          if (individualMappings.length > 0) {
            const streamIds = individualMappings.map(m => m.stream_id);
            const indivChannels = await db.channels.where('stream_id').anyOf(streamIds).toArray();
            const indivMap = new Map(indivChannels.map(ch => [ch.stream_id, ch]));
            for (const m of individualMappings) {
              const ch = indivMap.get(m.stream_id);
              if (ch && !seenStreamIds.has(ch.stream_id)) {
                seenStreamIds.add(ch.stream_id);
                allResults.push(ch);
              }
            }
          }
          results = allResults;
        }
      } else if (categoryId && categoryId.startsWith('__allsrc_')) {
        // All Channels for a single source
        const sourceId = categoryId.replace('__allsrc_', '');
        results = await db.channels.whereRaw(
          `source_id = ? AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))`,
          [sourceId]
        ).toArray();
      } else if (!categoryId) {
        // All Channels view
        if (enabledSourceIds) {
          // Optimized: Filter source IDs in SQL IN clause
          const idsList = Array.from(enabledSourceIds);
          if (idsList.length === 0) return [];
          // Chunk the IN clause if too many sources (unlikely < 100, but safe)
          const placeholders = idsList.map(() => '?').join(',');
          results = await db.channels.whereRaw(`source_id IN (${placeholders})`, idsList).toArray();
        } else {
          // Sources loading or explicit all - might be slow if 40k+ channels, but unavoidable for "All"
          // We could consider LIMIT 1000? But user expects all.
          results = await db.channels.toArray();
        }
      } else {
        // Check if it is a Custom Group
        const customGroup = await db.customGroups.get(categoryId);
        if (customGroup) {
          const mappings = await db.customGroupChannels
            .where('group_id').equals(categoryId)
            .sortBy('display_order');

          const streamIds = mappings.map(m => m.stream_id);
          if (streamIds.length === 0) {
            results = [];
          } else {
            const channels = await db.channels.where('stream_id').anyOf(streamIds).toArray();
            const channelMap = new Map(channels.map(ch => [ch.stream_id, ch]));
            results = mappings
              .map(m => channelMap.get(m.stream_id))
              .filter((ch): ch is StoredChannel => ch !== undefined);
          }
          orderingIsFixed = true; // order comes from customGroupChannels.display_order
        } else {
          // Channels in this category - uses index
          const category = await db.categories.get(categoryId);
          if (category) {
            results = await db.channels.where('category_ids').equals(categoryId).toArray();
            if (enabledSourceIds) {
              results = results.filter(ch => enabledSourceIds.has(ch.source_id));
            }

            // Fetch manually added individual channels for this native category
            const manualMappings = await db.playlistIndividualChannels
              .whereRaw('playlist_id = ? AND parent_category_id = ?', [category.source_id, categoryId])
              .toArray();
            if (manualMappings.length > 0) {
              const streamIds = manualMappings.map(m => m.stream_id);
              const manualChannels = await db.channels.where('stream_id').anyOf(streamIds).toArray();
              const manualMap = new Map(manualChannels.map(ch => [ch.stream_id, ch]));
              const orderedManual = manualMappings
                .sort((a, b) => a.display_order - b.display_order)
                .map(m => manualMap.get(m.stream_id))
                .filter((ch): ch is StoredChannel => ch !== undefined);

              const manualStreamIds = new Set(manualMappings.map(m => m.stream_id));
              const remainingDynamic = results.filter(ch => !manualStreamIds.has(ch.stream_id));
              results = [...orderedManual, ...remainingDynamic];
              orderingIsFixed = true;
            }
          } else {
            results = [];
          }
        }
      }

      // Filter out disabled channels (enabled === false)
      results = results.filter(ch => ch.enabled !== false);

      // Get filter words for this category and apply to channel names
      // This ensures filtered names are applied at the data level, preventing UI flicker
      // This ensures filtered names are applied at the data level, preventing UI flicker
      let filterWords: string[] = [];
      // Apply filter words only for standard categories (not virtual or custom groups)
      if (categoryId && !categoryId.startsWith('__')) {
        // Optimize: avoid DB call if we know it's a custom group (UUID like) or just accept the miss
        // Custom groups don't have filter words yet, so we can check db.categories
        const category = await db.categories.get(categoryId);
        if (category) {
          filterWords = category.filter_words || [];
        }
      }

      // Apply filter words to channel names
      if (filterWords.length > 0) {
        results = results.map(ch => ({
          ...ch,
          name: applyFilterWords(ch.name, filterWords)
        }));
      }

      // Apply logo overrides from epg_channel_overrides so the guide shows
      // the user-set channel icon without needing a full sync.
      try {
        const overrides = await db.epgChannelOverrides.toArray();
        const logoMap = new Map<string, string>();
        const epgIdMap = new Map<string, string>();
        
        for (const o of overrides) {
          if (o.stream_icon) logoMap.set(o.stream_id, o.stream_icon);
          if (o.epg_channel_id) epgIdMap.set(o.stream_id, o.epg_channel_id);
        }

        let epgIconMap = new Map<string, string>();
        if (epgPreferEpgLogos) {
          try {
            const epgChannels = await db.epgChannels.toArray();
            for (const ec of epgChannels) {
              if (ec.icon_url) epgIconMap.set(ec.id, ec.icon_url);
            }
          } catch { /* ignore */ }

          // Query cached global EPG logos
          const epgIdsToQuery = new Set<string>();
          for (const ch of results) {
            const epgId = epgIdMap.get(ch.stream_id) || ch.epg_channel_id;
            if (epgId) epgIdsToQuery.add(epgId);
          }

          if (window.storage && epgIdsToQuery.size > 0) {
            try {
              const settings = await window.storage.getSettings();
              const globalEpgLinks = settings.data?.globalEpgLinks || [];
              const cacheLinks = globalEpgLinks.filter(link => link.saveEntireEpg);
              
              if (cacheLinks.length > 0) {
                const Database = (await import('@tauri-apps/plugin-sql')).default;
                const idsArray = Array.from(epgIdsToQuery);
                
                for (const link of cacheLinks) {
                  try {
                    const cacheDbName = `epg_cache_${link.id}`;
                    const cacheDb = await Database.load(`sqlite:${cacheDbName}.db`);
                    
                    const CHUNK_SIZE = 500;
                    for (let idx = 0; idx < idsArray.length; idx += CHUNK_SIZE) {
                      const chunk = idsArray.slice(idx, idx + CHUNK_SIZE);
                      const placeholders = chunk.map((_, i) => `$${i + 1}`).join(',');
                      
                      const rows = await cacheDb.select(
                        `SELECT id, icon_url FROM epg_channels WHERE id IN (${placeholders})`,
                        chunk
                      ) as { id: string; icon_url: string | null }[];
                      
                      for (const r of rows) {
                        if (r.icon_url) epgIconMap.set(r.id, r.icon_url);
                      }
                    }
                  } catch { /* ignore */ }
                }
              }
            } catch { /* ignore */ }
          }
        }

        results = results.map(ch => {
          // 1. Manual override
          if (logoMap.has(ch.stream_id)) {
            return { ...ch, stream_icon: logoMap.get(ch.stream_id) };
          }
          // 2. EPG Logo preference
          if (epgPreferEpgLogos) {
            const epgId = epgIdMap.get(ch.stream_id) || ch.epg_channel_id;
            if (epgId && epgIconMap.has(epgId)) {
              const epgIcon = epgIconMap.get(epgId);
              if (epgIcon) {
                return { ...ch, stream_icon: epgIcon };
              }
            }
          }
          return ch;
        });
      } catch { /* ignore if overrides table not yet created */ }

      // Virtual categories and custom groups self-order; skip the sort below for them.
      if (orderingIsFixed) {
        return results;
      }

      // Standard category: respect display_order if any channels have been manually ordered.
      const hasAnyManualOrder = results.some(ch => ch.display_order != null);

      if (hasAnyManualOrder) {
        return results.sort((a, b) => {
          const aHas = a.display_order != null;
          const bHas = b.display_order != null;
          if (aHas && bHas) return a.display_order! - b.display_order!;
          if (aHas) return -1; // manually ordered items first
          if (bHas) return 1;
          // Both unordered — fall back to sortOrder
          if (sortOrder === 'provider') {
            const aOrder = a.provider_order;
            const bOrder = b.provider_order;
            if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
            if (aOrder !== undefined) return -1;
            if (bOrder !== undefined) return 1;
            return 0;
          }
          if (sortOrder === 'number') {
            const aNum = a.channel_num;
            const bNum = b.channel_num;
            if (aNum !== undefined && bNum !== undefined) return aNum - bNum;
            if (aNum !== undefined) return -1;
            if (bNum !== undefined) return 1;
          }
          return (a.alias || a.name).localeCompare(b.alias || b.name);
        });
      }

      // No manual ordering — use sortOrder preference
      if (sortOrder === 'provider') {
        return results.sort((a, b) => {
          const aOrder = a.provider_order;
          const bOrder = b.provider_order;
          if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
          if (aOrder !== undefined) return -1;
          if (bOrder !== undefined) return 1;
          return 0;
        });
      }
      if (sortOrder === 'number') {
        return results.sort((a, b) => {
          const aNum = a.channel_num;
          const bNum = b.channel_num;
          if (aNum !== undefined && bNum !== undefined) return aNum - bNum;
          if (aNum !== undefined) return -1;
          if (bNum !== undefined) return 1;
          return (a.alias || a.name).localeCompare(b.alias || b.name);
        });
      }
      // Default: alphabetical
      results = results.sort((a, b) => (a.alias || a.name).localeCompare(b.alias || b.name));

      return results;
    },
    [categoryId, sortOrder, enabledSourceKey, options?.skip, epgPreferEpgLogos],
    undefined, // defaultResult  
    15000, // staleTime: 15 seconds - instant switching between recently viewed categories
    // Watch all tables to capture updates to links, manual additions, and ordering when viewing a category
    categoryId ? undefined : 'channels'
  );
  return channels ?? [];
}

// Hook to get total channel count
export function useChannelCount() {
  const count = useLiveQuery(() => db.channels.count());
  return count ?? 0;
}

// Hook to get channel count for a category
export function useCategoryChannelCount(categoryId: string) {
  const count = useLiveQuery(() => db.channels.where('category_ids').equals(categoryId).count(), [categoryId]);
  return count ?? 0;
}

// Hook to get sync metadata for all sources
export function useSyncStatus() {
  const status = useLiveQuery(() => db.sourcesMeta.toArray());
  return status ?? [];
}

// Hook to manage selected category with persistence
export function useSelectedCategory() {
  const [categoryId, setCategoryIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load last category on mount
  useEffect(() => {
    getLastCategory().then((lastCat) => {
      setCategoryIdState(lastCat);
      setLoading(false);
    });
  }, []);

  // Wrapper that also persists
  const setCategoryId = useCallback((id: string | null) => {
    setCategoryIdState(id);
    if (id) {
      setLastCategory(id);
    }
  }, []);

  return { categoryId, setCategoryId, loading };
}

// Helper to parse category IDs from JSON string or array
export function parseCategoryIds(categoryIdsJson: string | string[] | number[] | undefined): string[] {
  if (!categoryIdsJson) return [];
  if (Array.isArray(categoryIdsJson)) {
    return categoryIdsJson.map(String);
  }
  try {
    const parsed = JSON.parse(categoryIdsJson);
    if (Array.isArray(parsed)) {
      // Map all to strings to support numeric category IDs from Xtream/Stalker
      return parsed.map(String);
    }
  } catch {
    // Invalid JSON
  }
  return [];
}

// Hook to search channels by name - only searches enabled categories
// Optionally filter by specific sourceIds and categoryIds
export function useChannelSearch(
  query: string,
  limit = 50,
  includeSourceInSearch = false,
  order: 'default' | 'alphabetical' = 'default',
  filterSourceIds?: string[],
  filterCategoryIds?: string[]
) {
  const enabledSourceIds = useEnabledSources();
  const { epgPreferEpgLogos } = useAppSettings();
  const sourceNameMap = useSourceNameMap();
  const categoryNameMap = useCategoryNameMap();

  const enabledSourceKey = useMemo(
    () => (enabledSourceIds ? Array.from(enabledSourceIds).sort().join(',') : 'loading'),
    [enabledSourceIds]
  );

  const filterKey = useMemo(
    () => `${filterSourceIds?.sort().join(',') || 'all'}_${filterCategoryIds?.sort().join(',') || 'all'}`,
    [filterSourceIds, filterCategoryIds]
  );

  const channels = useLiveQuery(
    async () => {
      if (!query || query.length < 2) {
        return [];
      }

      // Debug logging
      console.log('[useChannelSearch] order parameter:', order);

      // If no enabled sources, return empty results
      if (!enabledSourceIds || enabledSourceIds.size === 0) {
        return [];
      }

      const dbInstance = await (db as any).dbPromise;

      // Determine which source IDs to use: intersection of enabled and filtered
      const effectiveSourceIds = filterSourceIds && filterSourceIds.length > 0
        ? filterSourceIds.filter(id => enabledSourceIds.has(id))
        : Array.from(enabledSourceIds);

      if (effectiveSourceIds.length === 0) return [];

      const sourcePlaceholders = effectiveSourceIds.map(() => '?').join(',');

      // Determine which category IDs to use
      let effectiveCategoryIds: string[];
      if (filterCategoryIds && filterCategoryIds.length > 0) {
        // Verify categories belong to enabled sources
        const categoryRows = await dbInstance.select(
          `SELECT category_id FROM categories
           WHERE category_id IN (${filterCategoryIds.map(() => '?').join(',')})
           AND source_id IN (${sourcePlaceholders})
           AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))`,
          [...filterCategoryIds, ...effectiveSourceIds]
        );
        effectiveCategoryIds = categoryRows.map((r: any) => r.category_id);
      } else {
        // Get enabled category IDs via SQL (avoids full table scan to JS)
        const enabledCategoryRows = await dbInstance.select(
          `SELECT category_id FROM categories
           WHERE source_id IN (${sourcePlaceholders})
           AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))`,
          effectiveSourceIds
        );
        effectiveCategoryIds = enabledCategoryRows.map((r: any) => r.category_id);
      }

      if (effectiveCategoryIds.length === 0) return [];

      // Get source name matches for search (using cached map)
      let sourceNameMatches: string[] = [];
      if (includeSourceInSearch && sourceNameMap) {
        for (const [sourceId, sourceName] of sourceNameMap.entries()) {
          if (sourceName.toLowerCase().includes(query.toLowerCase())) {
            sourceNameMatches.push(sourceId);
          }
        }
      }

      // Split query into individual words for AND matching
      // e.g. "Manchester Bournemouth" → must contain BOTH words anywhere in the name
      const queryWords = query.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
      const wordLikeClauses = queryWords.map(() => `c.name LIKE ?`).join(' AND ');
      const wordLikeParams = queryWords.map(w => `%${w}%`);
      const categoryPlaceholders = effectiveCategoryIds.map(() => '?').join(',');

      let filteredChannels: any[];

      if (includeSourceInSearch && sourceNameMatches.length > 0) {
        // Include channels where name matches all words OR source_id matches the source name search
        const sourceMatchPlaceholders = sourceNameMatches.map(() => '?').join(',');
        const orderByClause = order === 'alphabetical' ? 'ORDER BY c.name COLLATE NOCASE ASC' : '';
        console.log('[useChannelSearch] Building query with orderByClause:', orderByClause);
        const queryStr = `SELECT DISTINCT c.*
           FROM channels c
           CROSS JOIN json_each(c.category_ids) AS cat
           WHERE ((${wordLikeClauses}) OR c.source_id IN (${sourceMatchPlaceholders}))
           AND c.source_id IN (${sourcePlaceholders})
           AND (c.enabled IS NULL OR c.enabled NOT IN (0, '0', 'false'))
           AND cat.value IN (${categoryPlaceholders})
           ${orderByClause}
           LIMIT ?`;
        console.log('[useChannelSearch] Full query:', queryStr);
        filteredChannels = await dbInstance.select(
          queryStr,
          [...wordLikeParams, ...sourceNameMatches, ...effectiveSourceIds, ...effectiveCategoryIds, limit]
        );
      } else {
        // Multi-word AND search — each word must appear somewhere in the channel name
        const orderByClause = order === 'alphabetical' ? 'ORDER BY c.name COLLATE NOCASE ASC' : '';
        console.log('[useChannelSearch] Building query with orderByClause:', orderByClause);
        const queryStr = `SELECT DISTINCT c.*
           FROM channels c
           CROSS JOIN json_each(c.category_ids) AS cat
           WHERE (${wordLikeClauses})
           AND c.source_id IN (${sourcePlaceholders})
           AND (c.enabled IS NULL OR c.enabled NOT IN (0, '0', 'false'))
           AND cat.value IN (${categoryPlaceholders})
           ${orderByClause}
           LIMIT ?`;
        console.log('[useChannelSearch] Full query:', queryStr);
        filteredChannels = await dbInstance.select(
          queryStr,
          [...wordLikeParams, ...effectiveSourceIds, ...effectiveCategoryIds, limit]
        );
      }

      // Add source_name and source_category_display to channels if includeSourceInSearch is enabled
      if (includeSourceInSearch && sourceNameMap) {
        filteredChannels = filteredChannels.map(ch => {
          const sourceName = sourceNameMap.get(ch.source_id);
          let sourceCategoryDisplay: string | undefined;
          if (sourceName && categoryNameMap) {
            const catIds = parseCategoryIds(ch.category_ids);
            const catName = catIds.length > 0 ? (categoryNameMap.get(catIds[0]) || catIds[0]) : '—';
            sourceCategoryDisplay = `${sourceName} → ${catName}`;
          }
          return {
            ...ch,
            source_name: sourceName || undefined,
            source_category_display: sourceCategoryDisplay
          };
        });
      }

      // Apply logo overrides from epg_channel_overrides and epgPreferEpgLogos setting
      try {
        const overrides = await db.epgChannelOverrides.toArray();
        const logoMap = new Map<string, string>();
        const epgIdMap = new Map<string, string>();
        
        for (const o of overrides) {
          if (o.stream_icon) logoMap.set(o.stream_id, o.stream_icon);
          if (o.epg_channel_id) epgIdMap.set(o.stream_id, o.epg_channel_id);
        }

        let epgIconMap = new Map<string, string>();
        if (epgPreferEpgLogos) {
          try {
            const epgChannels = await db.epgChannels.toArray();
            for (const ec of epgChannels) {
              if (ec.icon_url) epgIconMap.set(ec.id, ec.icon_url);
            }
          } catch { /* ignore */ }

          // Query cached global EPG logos
          const epgIdsToQuery = new Set<string>();
          for (const ch of filteredChannels) {
            const epgId = epgIdMap.get(ch.stream_id) || ch.epg_channel_id;
            if (epgId) epgIdsToQuery.add(epgId);
          }

          if (window.storage && epgIdsToQuery.size > 0) {
            try {
              const settings = await window.storage.getSettings();
              const globalEpgLinks = settings.data?.globalEpgLinks || [];
              const cacheLinks = globalEpgLinks.filter(link => link.saveEntireEpg);
              
              if (cacheLinks.length > 0) {
                const Database = (await import('@tauri-apps/plugin-sql')).default;
                const idsArray = Array.from(epgIdsToQuery);
                
                for (const link of cacheLinks) {
                  try {
                    const cacheDbName = `epg_cache_${link.id}`;
                    const cacheDb = await Database.load(`sqlite:${cacheDbName}.db`);
                    
                    const CHUNK_SIZE = 500;
                    for (let idx = 0; idx < idsArray.length; idx += CHUNK_SIZE) {
                      const chunk = idsArray.slice(idx, idx + CHUNK_SIZE);
                      const placeholders = chunk.map((_, i) => `$${i + 1}`).join(',');
                      
                      const rows = await cacheDb.select(
                        `SELECT id, icon_url FROM epg_channels WHERE id IN (${placeholders})`,
                        chunk
                      ) as { id: string; icon_url: string | null }[];
                      
                      for (const r of rows) {
                        if (r.icon_url) epgIconMap.set(r.id, r.icon_url);
                      }
                    }
                  } catch { /* ignore */ }
                }
              }
            } catch { /* ignore */ }
          }
        }

        filteredChannels = filteredChannels.map(ch => {
          // 1. Manual override
          if (logoMap.has(ch.stream_id)) {
            return { ...ch, stream_icon: logoMap.get(ch.stream_id) };
          }
          // 2. EPG Logo preference
          if (epgPreferEpgLogos) {
            const epgId = epgIdMap.get(ch.stream_id) || ch.epg_channel_id;
            if (epgId && epgIconMap.has(epgId)) {
              const epgIcon = epgIconMap.get(epgId);
              if (epgIcon) {
                return { ...ch, stream_icon: epgIcon };
              }
            }
          }
          return ch;
        });
      } catch { /* ignore */ }

      console.log('[useChannelSearch] Returning', filteredChannels.length, 'channels, first few:', filteredChannels.slice(0, 3).map((c: any) => c.name));

      return filteredChannels as StoredChannel[];
    },
    [query, limit, includeSourceInSearch, order, sourceNameMap, categoryNameMap, enabledSourceKey, filterKey, epgPreferEpgLogos]
  );
  return channels ?? [];
}


// Hook to search programs (EPG) by title - only searches enabled categories
// Optionally filter by specific sourceIds and categoryIds
export function useProgramSearch(
  query: string,
  limit = 50,
  order: 'default' | 'alphabetical' = 'default',
  filterSourceIds?: string[],
  filterCategoryIds?: string[]
) {
  const enabledSourceIds = useEnabledSources();

  const enabledSourceKey = useMemo(
    () => (enabledSourceIds ? Array.from(enabledSourceIds).sort().join(',') : 'loading'),
    [enabledSourceIds]
  );

  const filterKey = useMemo(
    () => `${filterSourceIds?.sort().join(',') || 'all'}_${filterCategoryIds?.sort().join(',') || 'all'}`,
    [filterSourceIds, filterCategoryIds]
  );

  const programs = useLiveQuery(
    async () => {
      if (!query || query.length < 2) {
        return [];
      }

      console.log('[useProgramSearch] order parameter:', order);

      if (!enabledSourceIds || enabledSourceIds.size === 0) {
        return [];
      }

      const dbInstance = await (db as any).dbPromise;

      // Determine which source IDs to use: intersection of enabled and filtered
      const effectiveSourceIds = filterSourceIds && filterSourceIds.length > 0
        ? filterSourceIds.filter(id => enabledSourceIds.has(id))
        : Array.from(enabledSourceIds);

      if (effectiveSourceIds.length === 0) return [];

      const sourcePlaceholders = effectiveSourceIds.map(() => '?').join(',');

      // Step 1: Get enabled category IDs (single query)
      let effectiveCategoryIds: string[];
      if (filterCategoryIds && filterCategoryIds.length > 0) {
        // Verify categories belong to enabled sources
        const categoryRows = await dbInstance.select(
          `SELECT category_id FROM categories
           WHERE category_id IN (${filterCategoryIds.map(() => '?').join(',')})
           AND source_id IN (${sourcePlaceholders})
           AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))`,
          [...filterCategoryIds, ...effectiveSourceIds]
        );
        effectiveCategoryIds = categoryRows.map((r: any) => r.category_id);
      } else {
        const enabledCategoriesQuery = `
          SELECT category_id FROM categories 
          WHERE source_id IN (${sourcePlaceholders})
          AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))
        `;
        const enabledCategoryRows = await dbInstance.select(enabledCategoriesQuery, effectiveSourceIds);
        effectiveCategoryIds = enabledCategoryRows.map((row: any) => row.category_id);
      }

      if (effectiveCategoryIds.length === 0) {
        return [];
      }

      // Step 2: Get enabled channel IDs using json_each for efficient category matching
      // This filters channels that belong to at least one enabled category
      const categoryPlaceholders = effectiveCategoryIds.map(() => '?').join(',');
      const enabledChannelsQuery = `
        SELECT DISTINCT c.stream_id 
        FROM channels c, json_each(c.category_ids) AS cat
        WHERE c.source_id IN (${sourcePlaceholders})
        AND (c.enabled IS NULL OR c.enabled NOT IN (0, '0', 'false'))
        AND cat.value IN (${categoryPlaceholders})
      `;
      const enabledChannelRows = await dbInstance.select(
        enabledChannelsQuery,
        [...effectiveSourceIds, ...effectiveCategoryIds]
      );
      const enabledChannelIds = new Set(enabledChannelRows.map((row: any) => row.stream_id));

      if (enabledChannelIds.size === 0) {
        return [];
      }

      // Split query into individual words for AND matching across all words
      // Match against both title and subtitle
      const queryWords = query.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
      const wordLikeClauses = queryWords.map(() => `(p.title LIKE ? OR p.subtitle LIKE ?)`).join(' AND ');
      const wordLikeParams = queryWords.flatMap(w => [`%${w}%`, `%${w}%`]);

      const nowIso = new Date().toISOString();
      // For alphabetical order, join with channels to sort by channel name
      const orderByClause = order === 'alphabetical' 
        ? 'ORDER BY c.name COLLATE NOCASE ASC, p.start ASC' 
        : '';
      console.log('[useProgramSearch] Building query with orderByClause:', orderByClause);
      
      // When ordering alphabetically, we need to join with channels table to get channel names
      const programResults = order === 'alphabetical'
        ? await dbInstance.select(
            `SELECT p.*, c.name as channel_name
             FROM programs_effective p
             INNER JOIN (
               SELECT DISTINCT c.stream_id, c.name
               FROM channels c, json_each(c.category_ids) AS cat
               WHERE c.source_id IN (${sourcePlaceholders})
               AND (c.enabled IS NULL OR c.enabled NOT IN (0, '0', 'false'))
               AND cat.value IN (${categoryPlaceholders})
             ) c ON p.stream_id = c.stream_id
             WHERE (${wordLikeClauses}) AND p.end > ?
             ${orderByClause}
             LIMIT ?`,
            [...effectiveSourceIds, ...effectiveCategoryIds, ...wordLikeParams, nowIso, limit * 2]
          )
        : await dbInstance.select(
            `SELECT p.* 
             FROM programs_effective p
             INNER JOIN (
               SELECT DISTINCT c.stream_id 
               FROM channels c, json_each(c.category_ids) AS cat
               WHERE c.source_id IN (${sourcePlaceholders})
               AND (c.enabled IS NULL OR c.enabled NOT IN (0, '0', 'false'))
               AND cat.value IN (${categoryPlaceholders})
             ) ec ON p.stream_id = ec.stream_id
             WHERE (${wordLikeClauses}) AND p.end > ?
             LIMIT ?`,
            [...effectiveSourceIds, ...effectiveCategoryIds, ...wordLikeParams, nowIso, limit * 2]
          );
      console.log('[useProgramSearch] Query returned', programResults.length, 'results');

      // Step 4: Decompress descriptions for exactly the valid programs
      const filteredPrograms: StoredProgram[] = [];
      for (const prog of programResults) {
        filteredPrograms.push({
          ...prog,
          description: decompressEpgDescription(prog.description) ?? prog.description,
        });
        if (filteredPrograms.length >= limit) break;
      }

      console.log('[useProgramSearch] Returning', filteredPrograms.length, 'programs, first few channel names:', filteredPrograms.slice(0, 3).map((p: any) => p.channel_name || 'N/A'));

      return filteredPrograms;
    },
    [query, limit, order, enabledSourceKey, filterKey],
    undefined, // defaultResult
    0, // staleTime: 0 - always refresh on search
    'programs' // tableName: only re-run when programs table changes
  );
  return programs ?? [];
}

// Combined search result type
export interface SearchResult {
  type: 'channel' | 'program';
  channel?: StoredChannel;
  program?: StoredProgram & { channel?: StoredChannel };
}

// Categories with channel counts
export interface CategoryWithCount extends StoredCategory {
  channelCount: number;
}

// Grouped categories by source
export interface SourceWithCategories {
  sourceId: string;
  categories: CategoryWithCount[];
}

// Hook to get categories grouped by source (filtered by enabled sources)
export function useCategoriesBySource(): SourceWithCategories[] {
  const enabledSourceIds = useEnabledSources();
  const { version } = useSourceVersion(); // Track reorders and edits
  const categorySortOrder = useCategorySortOrder();

  const enabledSourceKey = useMemo(
    () => (enabledSourceIds ? Array.from(enabledSourceIds).sort().join(',') : 'loading'),
    [enabledSourceIds]
  );

  const data = useLiveQuery(
    async () => {
      // 1. Fetch raw Source ordering from JSON layer
      const sourcesResult = window.storage ? await window.storage.getSources() : { data: [] };
      const sourceOrderMap: Record<string, number> = {};

      if (sourcesResult.data) {
        // Map source ID to its true display position in settings
        sourcesResult.data
          // Ensure they are strictly sorted by display_order physically first
          .sort((a, b) => {
            const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER;
            const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name);
          })
          .forEach((source, index) => {
            sourceOrderMap[source.id] = index;
          });
      }

      // 2. Get all categories
      const allCategories = await db.categories.orderBy('category_name').toArray();
      const categories = enabledSourceIds
        ? allCategories.filter(cat => enabledSourceIds.has(cat.source_id) && cat.enabled !== false)
        : allCategories.filter(cat => cat.enabled !== false);

      // Get all channel counts - chunk queries to avoid SQLite UNION ALL limit (~500 terms)
      const dbInstance = await (db as any).dbPromise;
      const categoryIds = categories.map(c => c.category_id);

      let channelCounts: Record<string, number> = {};

      if (categoryIds.length > 0) {
        // Count channels per category, filtered to only enabled sources
        const sourceIdsList = enabledSourceIds ? Array.from(enabledSourceIds) : [];
        let countQuery: string;
        let countParams: any[];

        if (sourceIdsList.length > 0) {
          const sourcePlaceholders = sourceIdsList.map(() => '?').join(',');
          countQuery = `
            SELECT cat.value as cat_id, COUNT(*) as cnt
            FROM channels c, json_each(c.category_ids) AS cat
            WHERE c.source_id IN (${sourcePlaceholders})
            AND (c.enabled IS NULL OR c.enabled != 0)
            GROUP BY cat.value
          `;
          countParams = sourceIdsList;
        } else {
          countQuery = `
            SELECT cat.value as cat_id, COUNT(*) as cnt
            FROM channels c, json_each(c.category_ids) AS cat
            WHERE (c.enabled IS NULL OR c.enabled != 0)
            GROUP BY cat.value
          `;
          countParams = [];
        }


        try {
          const countResults = await dbInstance.select(countQuery, countParams);
          countResults.forEach((row: any) => {
            channelCounts[row.cat_id] = row.cnt;
          });
        } catch (e) {
          console.warn("Failed to fetch categorized channel counts with JSON approach:", e);
        }
      }


      const withCounts: CategoryWithCount[] = categories.map(cat => ({
        ...cat,
        channelCount: channelCounts[cat.category_id] || 0
      }));

      // Group by source_id
      const grouped = withCounts.reduce((acc, cat) => {
        const sourceId = cat.source_id;
        if (!acc[sourceId]) {
          acc[sourceId] = [];
        }
        acc[sourceId].push(cat);
        return acc;
      }, {} as Record<string, CategoryWithCount[]>);

      // Sort INDIVIDUAL categories inside each source based on user preference
      Object.values(grouped).forEach(cats => {
        if (categorySortOrder === 'alphabetical') {
          cats.sort((a, b) => (a.alias || a.category_name).localeCompare(b.alias || b.category_name));
        } else {
          // Default: use display_order if available, otherwise alphabetical
          cats.sort((a, b) => {
            if (a.display_order !== undefined && b.display_order !== undefined) {
              return a.display_order - b.display_order;
            }
            if (a.display_order !== undefined) return -1;
            if (b.display_order !== undefined) return 1;
            return (a.alias || a.category_name).localeCompare(b.alias || b.category_name);
          });
        }
      });

      // 3. Convert Object map into final Array, and SORT it by the Parent Source display order we mapped
      const finalArray = Object.entries(grouped).map(([sourceId, categories]) => ({
        sourceId,
        categories,
      }));

      finalArray.sort((a, b) => {
        const orderA = sourceOrderMap[a.sourceId] ?? Number.MAX_SAFE_INTEGER;
        const orderB = sourceOrderMap[b.sourceId] ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });

      return finalArray;
    },
    [enabledSourceKey, version, categorySortOrder]
  );

  return data ?? [];
}

// Hook to get categories with their channel counts (filtered by enabled sources)
export function useCategoriesWithCounts(): CategoryWithCount[] {
  const enabledSourceIds = useEnabledSources();
  const enabledSourceKey = useMemo(
    () => (enabledSourceIds ? Array.from(enabledSourceIds).sort().join(',') : 'loading'),
    [enabledSourceIds]
  );
  const data = useLiveQuery(
    async () => {
      // Get all categories first
      const allCategories = await db.categories.orderBy('category_name').toArray();
      const categories = enabledSourceIds
        ? allCategories.filter(cat => enabledSourceIds.has(cat.source_id))
        : allCategories;

      // Get all channel counts - chunk queries to avoid SQLite UNION ALL limit (~500 terms)
      const dbInstance = await (db as any).dbPromise;
      const categoryIds = categories.map(c => c.category_id);

      let channelCounts: Record<string, number> = {};

      if (categoryIds.length > 0) {
        const countQuery = `
          SELECT cat.value as cat_id, COUNT(*) as cnt
          FROM channels c, json_each(c.category_ids) AS cat
          GROUP BY cat.value
        `;

        try {
          const countResults = await dbInstance.select(countQuery);
          countResults.forEach((row: any) => {
            channelCounts[row.cat_id] = row.cnt;
          });
        } catch (e) {
          console.warn("Failed to fetch categorized channel counts with JSON approach:", e);
        }
      }

      const withCounts: CategoryWithCount[] = categories.map(cat => ({
        ...cat,
        channelCount: channelCounts[cat.category_id] || 0
      }));

      return withCounts;
    },
    [enabledSourceKey]
  );
  return data ?? [];
}

// Hook to get current program for a channel
export function useCurrentProgram(streamId: string | null): StoredProgram | null {
  const program = useLiveQuery(
    async () => {
      if (!streamId) return null;
      const now = new Date().toISOString();

      // Query programs_effective so overrides + custom programs are reflected
      const dbInstance = await (db as any).dbPromise;
      const rows = await dbInstance.select(
        `SELECT * FROM programs_effective
         WHERE stream_id = ? AND start <= ? AND end > ?
         ORDER BY start DESC LIMIT 1`,
        [streamId, now, now]
      ) as StoredProgram[];

      const prog = rows[0] ?? null;
      if (prog) {
        return {
          ...prog,
          description: decompressEpgDescription(prog.description) ?? prog.description,
        };
      }
      return null;
    },
    [streamId]
  );
  return program ?? null;
}

// Hook to get the program airing after the current one on a channel
export function useNextProgram(streamId: string | null): StoredProgram | null {
  const program = useLiveQuery(
    async () => {
      if (!streamId) return null;
      const now = new Date().toISOString();
      const dbInstance = await (db as any).dbPromise;

      const currentRows = await dbInstance.select(
        `SELECT * FROM programs_effective
         WHERE stream_id = ? AND start <= ? AND end > ?
         ORDER BY start DESC LIMIT 1`,
        [streamId, now, now]
      ) as StoredProgram[];

      const afterTime = currentRows[0]?.end ?? now;

      const rows = await dbInstance.select(
        `SELECT * FROM programs_effective
         WHERE stream_id = ? AND start >= ?
         ORDER BY start ASC LIMIT 1`,
        [streamId, afterTime]
      ) as StoredProgram[];

      const prog = rows[0] ?? null;
      if (prog) {
        return {
          ...prog,
          description: decompressEpgDescription(prog.description) ?? prog.description,
        };
      }
      return null;
    },
    [streamId]
  );
  return program ?? null;
}

// Chunk size for SQLite IN clause limit (SQLite default max is 999, use 500 for safety)
const SQL_CHUNK_SIZE = 500;

// Hook to get all programs for channels within a time range (for EPG grid)
export function useProgramsInRange(
  streamIds: string[],
  windowStart: Date,
  windowEnd: Date,
  options?: { skip?: boolean }
): Map<string, StoredProgram[]> {
  const skip = options?.skip ?? false;
  const programs = useLiveQuery(
    async () => {
      if (skip || streamIds.length === 0) return new Map<string, StoredProgram[]>();

      const result = new Map<string, StoredProgram[]>();
      for (const id of streamIds) result.set(id, []);

      const startIso = windowStart.toISOString();
      const endIso = windowEnd.toISOString();

      // Query programs_effective in chunks to respect SQLite variable limit
      const dbInstance = await (db as any).dbPromise;
      const allPrograms: StoredProgram[] = [];
      for (let i = 0; i < streamIds.length; i += SQL_CHUNK_SIZE) {
        const chunk = streamIds.slice(i, i + SQL_CHUNK_SIZE);
        const placeholders = chunk.map(() => '?').join(',');
        const rows = await dbInstance.select(
          `SELECT * FROM programs_effective
           WHERE stream_id IN (${placeholders})
             AND start < ? AND end > ?
           ORDER BY start ASC`,
          [...chunk, endIso, startIso]
        ) as StoredProgram[];
        allPrograms.push(...rows);
      }

      for (const prog of allPrograms) {
        const existing = result.get(prog.stream_id) ?? [];
        existing.push({
          ...prog,
          description: decompressEpgDescription(prog.description) ?? prog.description,
        });
        result.set(prog.stream_id, existing);
      }

      for (const [, progs] of result) {
        progs.sort((a, b) => {
          const aStart = a.start instanceof Date ? a.start.getTime() : new Date(a.start).getTime();
          const bStart = b.start instanceof Date ? b.start.getTime() : new Date(b.start).getTime();
          return aStart - bStart;
        });
      }

      return result;
    },
    [streamIds.join(','), windowStart.getTime(), windowEnd.getTime(), skip]
  );

  return programs ?? new Map();
}

// Hook to get programs for a list of channel IDs (queries local DB - EPG is synced upfront)
export function usePrograms(streamIds: string[]): Map<string, StoredProgram | null> {
  const programs = useLiveQuery(
    async () => {
      if (streamIds.length === 0) return new Map();
      const now = new Date().toISOString();
      const result = new Map<string, StoredProgram | null>();
      for (const id of streamIds) result.set(id, null);

      const dbInstance = await (db as any).dbPromise;
      const allPrograms: StoredProgram[] = [];
      for (let i = 0; i < streamIds.length; i += SQL_CHUNK_SIZE) {
        const chunk = streamIds.slice(i, i + SQL_CHUNK_SIZE);
        const placeholders = chunk.map(() => '?').join(',');
        const rows = await dbInstance.select(
          `SELECT * FROM programs_effective
           WHERE stream_id IN (${placeholders})
             AND start <= ? AND end > ?
           ORDER BY start DESC`,
          [...chunk, now, now]
        ) as StoredProgram[];
        allPrograms.push(...rows);
      }

      for (const prog of allPrograms) {
        if (!result.get(prog.stream_id)) {
          result.set(prog.stream_id, prog);
        }
      }

      return result;
    },
    [streamIds.join(',')],
    undefined, // defaultResult
    0, // staleTime: 0 - time window changes need fresh data
    'programs' // tableName: only re-run when programs table changes
  );
  return programs ?? new Map();
}

// Hook to get ALL programs for channels (loads everything at once, no lazy loading by time window)
// Use this instead of useProgramsInRange when you want to load all EPG data upfront
export function useAllPrograms(
  streamIds: string[],
  options?: { skip?: boolean }
): Map<string, StoredProgram[]> {
  const skip = options?.skip ?? false;
  const programs = useLiveQuery(
    async () => {
      if (skip || streamIds.length === 0) return new Map<string, StoredProgram[]>();

      const result = new Map<string, StoredProgram[]>();
      for (const id of streamIds) result.set(id, []);

      const dbInstance = await (db as any).dbPromise;
      const allPrograms: StoredProgram[] = [];
      for (let i = 0; i < streamIds.length; i += SQL_CHUNK_SIZE) {
        const chunk = streamIds.slice(i, i + SQL_CHUNK_SIZE);
        const placeholders = chunk.map(() => '?').join(',');
        const rows = await dbInstance.select(
          `SELECT * FROM programs_effective
           WHERE stream_id IN (${placeholders})
           ORDER BY start ASC`,
          chunk
        ) as StoredProgram[];
        allPrograms.push(...rows);
      }

      for (const prog of allPrograms) {
        const existing = result.get(prog.stream_id) ?? [];
        existing.push({
          ...prog,
          description: decompressEpgDescription(prog.description) ?? prog.description,
        });
        result.set(prog.stream_id, existing);
      }

      // Already sorted by ORDER BY above, but keep sort for safety on merge
      for (const [, progs] of result) {
        progs.sort((a, b) => {
          const aStart = a.start instanceof Date ? a.start.getTime() : new Date(a.start).getTime();
          const bStart = b.start instanceof Date ? b.start.getTime() : new Date(b.start).getTime();
          return aStart - bStart;
        });
      }

      return result;
    },
    [streamIds.join(','), skip],
    undefined, // defaultResult
    0, // staleTime: 0 - streamIds changes need fresh data
    'programs' // tableName: only re-run when programs table changes
  );
  return programs ?? new Map();
}

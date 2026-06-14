import { db, StoredChannel } from '../db';

// Helper to parse category IDs from JSON string or array
function parseCategoryIds(categoryIdsJson: string | string[] | number[] | undefined): string[] {
  if (!categoryIdsJson) return [];
  if (Array.isArray(categoryIdsJson)) {
    return categoryIdsJson.map(String);
  }
  try {
    const parsed = JSON.parse(categoryIdsJson);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    // Invalid JSON
  }
  return [];
}

/**
 * Generate a standard .m3u playlist string for a custom playlist or real source.
 *
 * Structure:
 *   1. All channels from categories / category links (in display_order)
 *   2. All individually-added channels (in their display_order)
 *   3. For real sources, any remaining uncategorized channels (in provider_order)
 *
 * The group-title in the M3U is the category name (or custom_name if renamed).
 * Deduplication: if the same stream_id appears multiple times, the first occurrence wins.
 */
export async function generateM3uForPlaylist(playlistId: string): Promise<string> {
  // 1. Try to find the playlist in custom playlists
  const customPlaylist = await db.customPlaylists.get(playlistId);
  
  let playlistName = '';
  let isCustom = true;
  let epgUrl: string | undefined;
  
  if (customPlaylist) {
    playlistName = customPlaylist.name;
  } else {
    // Check if it's a real source from store
    let sourceObj: any = null;
    if (typeof window !== 'undefined' && window.storage) {
      const res = await window.storage.getSources();
      if (res.success && res.data) {
        sourceObj = res.data.find(s => s.id === playlistId);
        if (sourceObj) {
          playlistName = sourceObj.name;
          isCustom = false;
          epgUrl = sourceObj.epg_url;
        }
      }
    }
    
    // Always fetch from db.sourcesMeta as the primary source of truth for synced EPG url
    const sourceMeta = await db.sourcesMeta.get(playlistId);
    if (sourceMeta) {
      isCustom = false;
      if (!playlistName) {
        playlistName = `Source ${playlistId}`;
      }
      if (!epgUrl) {
        epgUrl = sourceMeta.epg_url;
      }
    }
    
    // Dynamic fallback for Xtream Codes if epgUrl is still not found
    if (!epgUrl && sourceObj && sourceObj.type === 'xtream' && sourceObj.username && sourceObj.password) {
      const baseUrl = sourceObj.url.replace(/\/$/, '');
      epgUrl = `${baseUrl}/xmltv.php?username=${encodeURIComponent(sourceObj.username)}&password=${encodeURIComponent(sourceObj.password)}`;
    }
    
    if (!playlistName && !sourceMeta) {
      throw new Error(`Playlist ${playlistId} not found`);
    }
  }

  const lines: string[] = [];
  if (epgUrl) {
    lines.push(`#EXTM3U x-tvg-url="${epgUrl}" url-tvg="${epgUrl}"`);
  } else {
    lines.push('#EXTM3U');
  }
  
  const seenStreamIds = new Set<string>();

  // Helper: emit a channel as M3U lines
  function emitChannel(ch: any, groupTitle: string) {
    if (seenStreamIds.has(ch.stream_id)) return;
    seenStreamIds.add(ch.stream_id);

    const tvgId = ch.epg_channel_id || '';
    const tvgName = (ch.alias || ch.name).replace(/,/g, ''); // commas break M3U format
    const logo = ch.stream_icon || '';
    const name = ch.alias || ch.name;

    lines.push(
      `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-logo="${logo}" group-title="${groupTitle}",${name}`
    );
    lines.push(ch.direct_url);
  }

  // 2. Gather blocks (categories and category links)
  interface ExportBlock {
    type: 'native' | 'link';
    id: string;
    name: string;
    displayOrder: number;
    categoryId: string; // original category_id
    sourceId: string;   // source of the channels
    linkId?: number;    // for links
  }

  const blocks: ExportBlock[] = [];

  if (isCustom) {
    // Get all category links in order
    const categoryLinks = await db.playlistCategoryLinks
      .where('playlist_id').equals(playlistId)
      .sortBy('display_order');
      
    for (const link of categoryLinks) {
      if (link.id === undefined) continue;
      const category = await db.categories.get(link.category_id);
      const groupTitle = link.custom_name || category?.alias || category?.category_name || link.category_id;
      blocks.push({
        type: 'link',
        id: `link:${link.id}`,
        name: groupTitle,
        displayOrder: link.display_order ?? 0,
        categoryId: link.category_id,
        sourceId: link.source_id,
        linkId: link.id
      });
    }
  } else {
    // Real source: Native categories + Custom category links
    const nativeCategories = await db.categories
      .where('source_id')
      .equals(playlistId)
      .toArray();
      
    for (const cat of nativeCategories) {
      if (cat.enabled === false) continue;
      blocks.push({
        type: 'native',
        id: cat.category_id,
        name: cat.alias || cat.category_name,
        displayOrder: cat.display_order ?? 0,
        categoryId: cat.category_id,
        sourceId: playlistId
      });
    }

    // Category links added to this real source
    const categoryLinks = await db.playlistCategoryLinks
      .where('playlist_id').equals(playlistId)
      .sortBy('display_order');
      
    for (const link of categoryLinks) {
      if (link.id === undefined) continue;
      const category = await db.categories.get(link.category_id);
      const groupTitle = link.custom_name || category?.alias || category?.category_name || link.category_id;
      blocks.push({
        type: 'link',
        id: `link:${link.id}`,
        name: groupTitle,
        displayOrder: link.display_order ?? 0,
        categoryId: link.category_id,
        sourceId: link.source_id,
        linkId: link.id
      });
    }
    
    // Sort blocks by displayOrder, then alphabetically by name
    blocks.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return a.name.localeCompare(b.name);
    });
  }

  // Helper to sort channels within a category block
  async function sortChannelsForBlock(block: ExportBlock, channels: StoredChannel[]): Promise<StoredChannel[]> {
    const targetPlaylistId = playlistId; // Active workspace ID (raw custom playlist ID or source ID)
    const targetParentId = block.id;     // E.g. native category_id or `link:${linkId}`

    let manualMappings = await db.playlistIndividualChannels
      .whereRaw('playlist_id = ? AND parent_category_id = ?', [targetPlaylistId, targetParentId])
      .toArray();

    // Fallback inheritance for linked category if no custom mappings exist
    if (manualMappings.length === 0 && block.type === 'link' && block.linkId !== undefined) {
      const categoryLink = await db.playlistCategoryLinks.get(block.linkId);
      if (categoryLink) {
        const targetPlaylist = categoryLink.source_id;
        const targetParent = categoryLink.category_id;
        manualMappings = await db.playlistIndividualChannels
          .whereRaw('playlist_id = ? AND parent_category_id = ?', [targetPlaylist, targetParent])
          .toArray();
      }
    }

    const resolvedChannels = [...channels];

    if (manualMappings.length > 0) {
      const manualStreamIds = new Set(manualMappings.map(m => m.stream_id));
      const existingStreamIds = new Set(channels.map(c => c.stream_id));

      const missingIds = Array.from(manualStreamIds).filter(id => !existingStreamIds.has(id));
      if (missingIds.length > 0) {
        const missingChans = await db.channels.where('stream_id').anyOf(missingIds).toArray();
        resolvedChannels.push(...missingChans);
      }

      const manualMap = new Map(manualMappings.map(m => [m.stream_id, m.display_order]));
      const orderedManual = resolvedChannels
        .filter(ch => manualStreamIds.has(ch.stream_id))
        .sort((a, b) => (manualMap.get(a.stream_id) ?? 0) - (manualMap.get(b.stream_id) ?? 0));
      
      const remaining = resolvedChannels.filter(ch => !manualStreamIds.has(ch.stream_id));
      remaining.sort((a, b) => {
        if (a.display_order != null && b.display_order != null) return a.display_order - b.display_order;
        if (a.display_order != null) return -1;
        if (b.display_order != null) return 1;
        if (a.provider_order != null && b.provider_order != null) return a.provider_order - b.provider_order;
        if (a.provider_order != null) return -1;
        if (b.provider_order != null) return 1;
        return a.name.localeCompare(b.name);
      });
      return [...orderedManual, ...remaining];
    }

    const sorted = [...resolvedChannels];
    sorted.sort((a, b) => {
      if (a.display_order != null && b.display_order != null) return a.display_order - b.display_order;
      if (a.display_order != null) return -1;
      if (b.display_order != null) return 1;
      if (a.provider_order != null && b.provider_order != null) return a.provider_order - b.provider_order;
      if (a.provider_order != null) return -1;
      if (b.provider_order != null) return 1;
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }

  // 3. Emit channels for each block
  for (const block of blocks) {
    const channels = await db.channels.whereRaw(
      `source_id = ? AND EXISTS (SELECT 1 FROM json_each(category_ids) WHERE value = ?) AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))`,
      [block.sourceId, block.categoryId]
    ).toArray();

    const sortedChannels = await sortChannelsForBlock(block, channels);
    for (const ch of sortedChannels) {
      emitChannel(ch, block.name);
    }
  }

  // 4. Emit individual channels (flat mappings without a parent category)
  const individualMappings = await db.playlistIndividualChannels
    .where('playlist_id').equals(playlistId)
    .sortBy('display_order');

  const flatIndividualMappings = individualMappings.filter(m => !m.parent_category_id);

  if (flatIndividualMappings.length > 0) {
    const streamIds = flatIndividualMappings.map(m => m.stream_id);
    const channels = await db.channels.where('stream_id').anyOf(streamIds).toArray();
    const channelMap = new Map(channels.map(ch => [ch.stream_id, ch]));

    for (const mapping of flatIndividualMappings) {
      const ch = channelMap.get(mapping.stream_id);
      if (ch) emitChannel(ch, playlistName);
    }
  }

  // 5. Emit remaining uncategorized channels for real sources
  if (!isCustom) {
    const allChannels = await db.channels.where('source_id').equals(playlistId).toArray();
    const uncategorized = allChannels.filter(ch => {
      if (seenStreamIds.has(ch.stream_id)) return false;
      if (ch.enabled === false) return false;
      const catIds = parseCategoryIds(ch.category_ids);
      return catIds.length === 0;
    });
    if (uncategorized.length > 0) {
      uncategorized.sort((a, b) => (a.provider_order ?? 0) - (b.provider_order ?? 0));
      for (const ch of uncategorized) {
        emitChannel(ch, 'Uncategorized');
      }
    }
  }

  return lines.join('\n');
}

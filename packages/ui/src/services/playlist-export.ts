import { db } from '../db';

/**
 * Generate a standard .m3u playlist string for a custom playlist.
 *
 * Structure:
 *   1. All channels from category links (in category display_order)
 *   2. All individually-added channels (in their display_order)
 * 
 * The group-title in the M3U is the category name (or custom_name if renamed).
 * Deduplication: if the same stream_id appears in multiple category blocks AND
 * in individual channels, it only appears ONCE (first occurrence wins).
 */
export async function generateM3uForPlaylist(playlistId: string): Promise<string> {
  const playlist = await db.customPlaylists.get(playlistId);
  if (!playlist) throw new Error(`Playlist ${playlistId} not found`);

  // Get all category links in order
  const categoryLinks = await db.playlistCategoryLinks
    .where('playlist_id').equals(playlistId)
    .sortBy('display_order');

  // Get all individual channels in order
  const individualMappings = await db.playlistIndividualChannels
    .where('playlist_id').equals(playlistId)
    .sortBy('display_order');

  const lines: string[] = ['#EXTM3U'];
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

  // 1. Emit channels from category links
  for (const link of categoryLinks) {
    // Get category name for group-title
    const category = await db.categories.get(link.category_id);
    const groupTitle = link.custom_name || category?.alias || category?.category_name || link.category_id;

    // Query channels in this source category
    // NOTE: category_ids is stored as a JSON array string in SQLite.
    // Use json_each join for accurate matching.
    const channels = await db.channels.whereRaw(
      `source_id = ? AND EXISTS (SELECT 1 FROM json_each(category_ids) WHERE value = ?) AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))`,
      [link.source_id, link.category_id]
    ).toArray();

    // Sort by provider_order (preserves source channel order)
    channels.sort((a, b) => (a.provider_order ?? 0) - (b.provider_order ?? 0));

    for (const ch of channels) {
      emitChannel(ch, groupTitle);
    }
  }

  // 2. Emit individual channels (use playlist name as group-title)
  if (individualMappings.length > 0) {
    const streamIds = individualMappings.map(m => m.stream_id);
    const channels = await db.channels.where('stream_id').anyOf(streamIds).toArray();
    const channelMap = new Map(channels.map(ch => [ch.stream_id, ch]));

    for (const mapping of individualMappings) {
      const ch = channelMap.get(mapping.stream_id);
      if (ch) emitChannel(ch, playlist.name);
    }
  }

  return lines.join('\n');
}

import { db, type CustomPlaylist, type PlaylistCategoryLink, type PlaylistIndividualChannel } from '../db';

// ── Create ────────────────────────────────────────────────────────────────────

export async function createPlaylist(name: string): Promise<string> {
  const playlistId = crypto.randomUUID();
  const count = await db.customPlaylists.count();
  await db.customPlaylists.add({
    playlist_id: playlistId,
    name,
    display_order: count,
    created_at: Date.now()
  });
  return playlistId;
}

// ── Rename ────────────────────────────────────────────────────────────────────

export async function renamePlaylist(playlistId: string, newName: string): Promise<void> {
  await db.customPlaylists.update(playlistId, { name: newName });
}

// ── Delete ─────────────────────────────────────────────────────────────────────
// IMPORTANT: Manually delete children first since CASCADE may not fire.

export async function deletePlaylist(playlistId: string): Promise<void> {
  // Delete all category links for this playlist
  const catLinks = await db.playlistCategoryLinks.where('playlist_id').equals(playlistId).toArray();
  const catLinkIds = catLinks.map(l => l.id as number);
  if (catLinkIds.length > 0) await db.playlistCategoryLinks.bulkDelete(catLinkIds);

  // Delete all individual channels for this playlist
  const indivChannels = await db.playlistIndividualChannels.where('playlist_id').equals(playlistId).toArray();
  const indivIds = indivChannels.map(c => c.id as number);
  if (indivIds.length > 0) await db.playlistIndividualChannels.bulkDelete(indivIds);

  // Now delete the playlist itself
  await db.customPlaylists.delete(playlistId);
}

// ── Category Link CRUD ────────────────────────────────────────────────────────

export async function addCategoryToPlaylist(
  playlistId: string,
  sourceId: string,
  categoryId: string
): Promise<number> {
  // Check for duplicate
  const existing = await db.playlistCategoryLinks
    .whereRaw('playlist_id = ? AND category_id = ?', [playlistId, categoryId])
    .toArray();
  if (existing.length > 0) return existing[0].id as number; // Already added

  const existing_links = await db.playlistCategoryLinks
    .where('playlist_id').equals(playlistId)
    .toArray();
  const maxOrder = existing_links.length > 0
    ? Math.max(...existing_links.map(l => l.display_order))
    : -1;

  const id = await db.playlistCategoryLinks.add({
    playlist_id: playlistId,
    source_id: sourceId,
    category_id: categoryId,
    display_order: maxOrder + 1,
    added_at: Date.now()
  });
  return id as number;
}

export async function removeCategoryFromPlaylist(linkId: number): Promise<void> {
  await db.playlistCategoryLinks.delete(linkId);
}

export async function renameCategoryLink(linkId: number, customName: string | null): Promise<void> {
  await db.playlistCategoryLinks.update(linkId, { custom_name: customName ?? undefined });
}

export async function reorderPlaylistCategories(
  playlistId: string,
  orderedLinkIds: number[]
): Promise<void> {
  const links = await db.playlistCategoryLinks.where('playlist_id').equals(playlistId).toArray();
  const linkMap = new Map(links.map(l => [l.id as number, l]));

  const updates = orderedLinkIds
    .map((id, i) => {
      const link = linkMap.get(id);
      return link ? { id, displayOrder: i } : null;
    })
    .filter(Boolean) as Array<{ id: number; displayOrder: number }>;

  for (const u of updates) {
    await db.playlistCategoryLinks.update(u.id, { display_order: u.displayOrder });
  }
}

// ── Individual Channel CRUD ───────────────────────────────────────────────────

export async function addIndividualChannelToPlaylist(
  playlistId: string,
  streamId: string
): Promise<void> {
  // Check for duplicate
  const existing = await db.playlistIndividualChannels
    .whereRaw('playlist_id = ? AND stream_id = ?', [playlistId, streamId])
    .toArray();
  if (existing.length > 0) return; // Already added

  const all = await db.playlistIndividualChannels
    .where('playlist_id').equals(playlistId)
    .toArray();
  const maxOrder = all.length > 0 ? Math.max(...all.map(c => c.display_order)) : -1;

  await db.playlistIndividualChannels.add({
    playlist_id: playlistId,
    stream_id: streamId,
    display_order: maxOrder + 1,
    added_at: Date.now()
  });
}

export async function addMultipleIndividualChannelsToPlaylist(
  playlistId: string,
  streamIds: string[]
): Promise<void> {
  const existing = await db.playlistIndividualChannels
    .where('playlist_id').equals(playlistId)
    .toArray();
  const existingIds = new Set(existing.map(c => c.stream_id));
  const newIds = streamIds.filter(id => !existingIds.has(id));
  if (newIds.length === 0) return;

  const maxOrder = existing.length > 0 ? Math.max(...existing.map(c => c.display_order)) : -1;
  const now = Date.now();
  const items: PlaylistIndividualChannel[] = newIds.map((streamId, i) => ({
    playlist_id: playlistId,
    stream_id: streamId,
    display_order: maxOrder + 1 + i,
    added_at: now
  }));
  await db.playlistIndividualChannels.bulkAdd(items);
}

export async function removeIndividualChannelFromPlaylist(
  playlistId: string,
  streamId: string
): Promise<void> {
  const all = await db.playlistIndividualChannels
    .where('playlist_id').equals(playlistId)
    .toArray();
  const toDelete = all.filter(c => c.stream_id === streamId).map(c => c.id as number);
  if (toDelete.length > 0) await db.playlistIndividualChannels.bulkDelete(toDelete);
}

export async function reorderPlaylistIndividualChannels(
  playlistId: string,
  orderedStreamIds: string[]
): Promise<void> {
  const items = await db.playlistIndividualChannels
    .where('playlist_id').equals(playlistId)
    .toArray();
  const itemMap = new Map(items.map(i => [i.stream_id, i]));

  for (let i = 0; i < orderedStreamIds.length; i++) {
    const item = itemMap.get(orderedStreamIds[i]);
    if (item && item.id !== undefined) {
      await db.playlistIndividualChannels.update(item.id, { display_order: i });
    }
  }
}

// ── Reorder Playlists in Sidebar ──────────────────────────────────────────────

export async function reorderPlaylists(orderedPlaylistIds: string[]): Promise<void> {
  for (let i = 0; i < orderedPlaylistIds.length; i++) {
    await db.customPlaylists.update(orderedPlaylistIds[i], { display_order: i });
  }
}

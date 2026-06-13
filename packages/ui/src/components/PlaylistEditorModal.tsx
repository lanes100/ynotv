import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from '../hooks/useSqliteLiveQuery';
import { db, type PlaylistCategoryLink, type PlaylistIndividualChannel, type StoredChannel, type StoredCategory } from '../db';
import {
  addCategoryToPlaylist,
  removeCategoryFromPlaylist,
  renameCategoryLink,
  addIndividualChannelToPlaylist,
  removeIndividualChannelFromPlaylist,
  reorderPlaylistIndividualChannels,
  renamePlaylist,
  addMultipleIndividualChannelsToPlaylist,
  addChannelToCategory,
  removeChannelFromCategory,
  reorderCategoryChannels,
  addCustomCategoryToPlaylist,
} from '../services/playlist-editor';
import './PlaylistEditorModal.css';

interface PlaylistEditorModalProps {
  playlistId: string;
  playlistName: string;
  onClose: () => void;
}

function parseCategoryIds(raw: string | string[] | number[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* not JSON */ }
  if (typeof raw === 'string') return raw.split(',').map(s => s.trim()).filter(Boolean);
  return [String(raw)];
}

interface BrowseSource {
  id: string;
  name: string;
  isCustomPlaylist?: boolean;
}

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ display: 'block' }}>
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
  </svg>
);

const EyeSlashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ display: 'block' }}>
    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.82l2.92 2.92c1.51-1.39 2.7-3.13 3.44-5.04-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.47-2.3c-.22 0-.44.03-.65.08l1.65 1.65c.05-.21.08-.43.08-.65 0-1.66-1.34-3-3-3z"/>
  </svg>
);

interface CategoryBlockCardProps {
  playlistId: string;
  block: any;
  sources: BrowseSource[];
  index: number;
  isDragging: boolean;
  isDragOver: boolean;
  isMarked: boolean;
  onMark: () => void;
  onPointerDown: (e: React.PointerEvent, index: number) => void;
  onRemove?: () => void;
  showHidden: boolean;
}

function CategoryBlockCard({
  playlistId,
  block,
  sources,
  index,
  isDragging,
  isDragOver,
  isMarked,
  onMark,
  onPointerDown,
  onRemove,
  showHidden,
}: CategoryBlockCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamingName, setRenamingName] = useState(block.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Filter words local state
  const [filterWordsText, setFilterWordsText] = useState<string>(
    block.type === 'native' ? (block.category.filter_words || []).join(', ') : ''
  );

  useEffect(() => {
    if (block.type === 'native') {
      setFilterWordsText((block.category.filter_words || []).join(', '));
    }
  }, [block.category?.filter_words, block.type]);

  const handleSaveFilterWords = async () => {
    if (block.type !== 'native') return;
    const words = filterWordsText
      .split(',')
      .map((w: string) => w.trim())
      .filter(Boolean);
    await db.categories.update(block.category.category_id, { filter_words: words });
  };

  // Toggle category enabled state in right panel
  const toggleCategoryEnabled = async () => {
    if (block.type !== 'native') return;
    const newEnabled = block.category.enabled === false;
    await db.categories.update(block.category.category_id, { enabled: newEnabled });
  };

  // Load dynamic channels reactively (without enabled query filter)
  const sourceId = block.type === 'native' ? block.category.source_id : block.link.source_id;
  const categoryId = block.type === 'native' ? block.category.category_id : block.link.category_id;

  const dynamicChannels = useLiveQuery(
    async () => {
      if (sourceId === 'custom') {
        return [];
      }
      const chans = await db.channels.whereRaw(
        `source_id = ? AND EXISTS (SELECT 1 FROM json_each(category_ids) WHERE value = ?)`,
        [sourceId, categoryId]
      ).toArray();

      // Legacy Sort Order fallback:
      chans.sort((a, b) => {
        if (a.display_order != null && b.display_order != null) return a.display_order - b.display_order;
        if (a.display_order != null) return -1;
        if (b.display_order != null) return 1;
        if (a.provider_order != null && b.provider_order != null) return a.provider_order - b.provider_order;
        if (a.provider_order != null) return -1;
        if (b.provider_order != null) return 1;
        return a.name.localeCompare(b.name);
      });
      return chans;
    },
    [sourceId, categoryId],
    []
  );

  // Load manual channels reactively
  const parentCategoryId = block.type === 'native' ? block.id : `link:${block.linkId}`;
  const manualMappings = useLiveQuery(
    () => db.playlistIndividualChannels
      .whereRaw('playlist_id = ? AND parent_category_id = ?', [playlistId, parentCategoryId])
      .sortBy('display_order'),
    [playlistId, parentCategoryId],
    []
  );

  const manualChannels = useLiveQuery(
    async () => {
      if (!manualMappings || manualMappings.length === 0) {
        return [];
      }
      const ids = manualMappings.map(m => m.stream_id);
      const channels = await db.channels.where('stream_id').anyOf(ids).toArray();
      const channelMap = new Map(channels.map(ch => [ch.stream_id, ch]));
      return manualMappings
        .map(m => channelMap.get(m.stream_id))
        .filter((ch): ch is StoredChannel => ch !== undefined);
    },
    [manualMappings],
    []
  );

  // Merge dynamic and manual channels into a single integrated list
  const combinedChannels = React.useMemo(() => {
    const manualStreamIds = new Set((manualMappings || []).map(m => m.stream_id));
    const resolvedManual = (manualMappings || [])
      .sort((a, b) => a.display_order - b.display_order)
      .map(m => {
        const ch = (manualChannels || []).find(c => c.stream_id === m.stream_id);
        return ch ? { ...ch, isManualAddition: true } : null;
      })
      .filter(Boolean) as Array<StoredChannel & { isManualAddition: boolean }>;

    const remainingDynamic = (dynamicChannels || [])
      .filter(ch => !manualStreamIds.has(ch.stream_id))
      .map(ch => ({ ...ch, isManualAddition: false }));

    return [...resolvedManual, ...remainingDynamic];
  }, [dynamicChannels, manualMappings, manualChannels]);

  const startRename = () => {
    if (block.type !== 'link') return;
    setRenamingName(block.link.custom_name || block.name);
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const handleSaveRename = async () => {
    const trimmed = renamingName.trim();
    await renameCategoryLink(block.linkId, trimmed || null);
    setIsRenaming(false);
  };

  // Drag and drop within integrated channel list
  const manualListRef = useRef<HTMLDivElement>(null);
  const dragFromIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const getManualIndexFromClientY = (clientY: number): number => {
    if (!manualListRef.current) return 0;
    const children = Array.from(manualListRef.current.children) as HTMLElement[];
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return parseInt(children[i].getAttribute('data-index') || '0', 10);
      }
    }
    if (children.length > 0) {
      const lastIdx = parseInt(children[children.length - 1].getAttribute('data-index') || '0', 10);
      return lastIdx + 1;
    }
    return 0;
  };

  const handleManualPointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragFromIdx.current = idx;
    setDragOverIdx(idx);
  }, []);

  const handleManualPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragFromIdx.current === null) return;
    e.preventDefault();
    setDragOverIdx(getManualIndexFromClientY(e.clientY));
  }, []);

  const handleManualPointerUp = useCallback(async (e: React.PointerEvent) => {
    if (dragFromIdx.current === null) return;
    const from = dragFromIdx.current;
    const to = getManualIndexFromClientY(e.clientY);
    dragFromIdx.current = null;
    setDragOverIdx(null);
    if (from === to || !combinedChannels) return;

    const next = [...combinedChannels];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    try {
      // Clear existing order records for this category
      await db.playlistIndividualChannels
        .whereRaw('playlist_id = ? AND parent_category_id = ?', [playlistId, parentCategoryId])
        .delete();

      // Write records for all channels sequentially to define the custom order
      const now = Date.now();
      for (let i = 0; i < next.length; i++) {
        const ch = next[i];
        await db.playlistIndividualChannels.put({
          playlist_id: playlistId,
          stream_id: ch.stream_id,
          parent_category_id: parentCategoryId,
          display_order: i,
          added_at: now
        });
      }
    } catch (err) {
      console.error('Failed to reorder category channels:', err);
    }
  }, [combinedChannels, playlistId, parentCategoryId]);

  const handleManualPointerCancel = useCallback(() => {
    dragFromIdx.current = null;
    setDragOverIdx(null);
  }, []);

  // Hide if not showing hidden and category is native + disabled
  if (block.type === 'native' && block.category.enabled === false && !showHidden) {
    return null;
  }

  const srcName = block.type === 'link' 
    ? (block.link.source_id === 'custom' ? 'Custom Category' : (sources.find(s => s.id === block.link.source_id)?.name || 'Source')) 
    : '';

  const visibleChannelsCount = combinedChannels.filter(c => showHidden || c.enabled !== false).length;

  return (
    <div 
      className={`ple-block-card-wrapper${isDragging ? ' dragging' : ''}${isDragOver ? ' drag-over' : ''}${isMarked ? ' marked' : ''}${block.type === 'native' && block.category.enabled === false ? ' ple-hidden-item' : ''}`}
      data-index={index}
    >
      <div className="ple-block-card">
        <button className="ple-block-expand-btn" onClick={() => setIsExpanded(!isExpanded)}>
          <span className="ple-chevron-small">{isExpanded ? '▼' : '▶'}</span>
        </button>

        <span
          className="ple-block-drag-handle"
          style={{ touchAction: 'none' }}
          onPointerDown={e => onPointerDown(e, index)}
        >⋮⋮</span>

        <div className="ple-block-info">
          {isRenaming ? (
            <div className="ple-inline-rename">
              <input
                ref={renameInputRef}
                className="ple-rename-input"
                value={renamingName}
                onChange={e => setRenamingName(e.target.value)}
                onBlur={handleSaveRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') setIsRenaming(false);
                }}
              />
            </div>
          ) : (
            <div className="ple-block-title-row">
              <span
                className={`ple-block-title${block.type === 'link' ? ' link' : ''}`}
                onClick={startRename}
                title={block.type === 'link' ? "Click to rename category block" : undefined}
              >
                📂 {block.name} {block.type === 'link' && block.link.source_id !== 'custom' && '✏️'}
              </span>
              {block.type === 'link' && block.link.custom_name && block.link.source_id !== 'custom' && (
                <span className="ple-original-title-hint">(orig: {block.link.category_id})</span>
              )}
            </div>
          )}
          <span className="ple-block-sub">
            {block.type === 'link' ? `${srcName} · ` : ''}
            {visibleChannelsCount} channels
          </span>
        </div>

        {block.type === 'native' && (
          <button
            className={`ple-visibility-btn${block.category.enabled === false ? ' hidden-item' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleCategoryEnabled();
            }}
            title={block.category.enabled === false ? "Show category" : "Hide category"}
          >
            {block.category.enabled === false ? <EyeSlashIcon /> : <EyeIcon />}
          </button>
        )}

        <button
          className={`ple-block-target-btn${isMarked ? ' marked' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onMark();
          }}
          title={isMarked ? "Active target category for channel additions (Click to unmark)" : "Mark as target category for channel additions"}
        >
          {isMarked ? '🎯 Target Active' : '🎯 Target'}
        </button>

        {block.type === 'link' && onRemove && (
          <button className="ple-remove-btn" onClick={onRemove} title="Remove category link">✕</button>
        )}
      </div>

      {isExpanded && (
        <div className="ple-block-expanded-content">
          {block.type === 'native' && (
            <div className="ple-filter-words-section">
              <span className="ple-filter-words-label">Filter Words:</span>
              <input
                type="text"
                className="ple-filter-words-input"
                placeholder="e.g. 4k, fhd, 50fps (comma-separated)"
                value={filterWordsText}
                onChange={e => setFilterWordsText(e.target.value)}
                onBlur={handleSaveFilterWords}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSaveFilterWords();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
            </div>
          )}

          <div className="ple-nested-section">
            {combinedChannels.length === 0 ? (
              <div className="ple-empty-hint">Category is empty. Mark it as the target and click ＋ Channel in the left panel to insert.</div>
            ) : (
              <div
                className="ple-nested-channels-list reorderable"
                ref={manualListRef}
                onPointerMove={handleManualPointerMove}
                onPointerUp={handleManualPointerUp}
                onPointerCancel={handleManualPointerCancel}
              >
                {combinedChannels.map((ch, idx) => {
                  const isChDragging = dragFromIdx.current === idx;
                  const isChDragOver = dragOverIdx === idx && dragFromIdx.current !== null && dragFromIdx.current !== idx;
                  
                  if (ch.enabled === false && !showHidden) {
                    return null;
                  }

                  const toggleChannelEnabled = async () => {
                    const newEnabled = ch.enabled === false;
                    await db.channels.update(ch.stream_id, { enabled: newEnabled });
                  };

                  return (
                    <div
                      key={ch.stream_id}
                      className={`ple-nested-channel-row reorderable${isChDragging ? ' dragging' : ''}${isChDragOver ? ' drag-over' : ''}${ch.enabled === false ? ' ple-hidden-item' : ''}`}
                      data-index={idx}
                    >
                      <span
                        className="ple-block-drag-handle"
                        style={{ touchAction: 'none' }}
                        onPointerDown={e => handleManualPointerDown(e, idx)}
                      >⋮⋮</span>
                      {ch.stream_icon ? (
                        <img src={ch.stream_icon} className="ple-nested-ch-logo" alt="" />
                      ) : (
                        <span className="ple-nested-ch-logo-placeholder">📺</span>
                      )}
                      <span className="ple-nested-ch-name">
                        {ch.name} {!ch.isManualAddition && <span className="ple-dynamic-badge">dynamic</span>}
                      </span>
                      
                      <button
                        className={`ple-visibility-btn${ch.enabled === false ? ' hidden-item' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleChannelEnabled();
                        }}
                        title={ch.enabled === false ? "Show channel" : "Hide channel"}
                      >
                        {ch.enabled === false ? <EyeSlashIcon /> : <EyeIcon />}
                      </button>

                      {ch.isManualAddition ? (
                        <button
                          className="ple-remove-btn"
                          onClick={() => removeChannelFromCategory(playlistId, parentCategoryId, ch.stream_id)}
                          title="Remove custom channel"
                        >✕</button>
                      ) : (
                        <span className="ple-read-only-badge" title="Dynamic channel (read-only)">🔒</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

async function sortChannelsLikeLiveTV(sourceId: string, categoryId: string, channels: StoredChannel[]): Promise<StoredChannel[]> {
  let targetPlaylistId = sourceId;
  let targetParentId = categoryId;
  
  if (sourceId.startsWith('playlist:')) {
    targetPlaylistId = sourceId.replace('playlist:', '');
    if (categoryId.startsWith('link:')) {
      const linkId = parseInt(categoryId.replace('link:', ''), 10);
      targetParentId = `link:${linkId}`;
    }
  }

  const manualMappings = await db.playlistIndividualChannels
    .whereRaw('playlist_id = ? AND parent_category_id = ?', [targetPlaylistId, targetParentId])
    .toArray();

  if (manualMappings.length > 0) {
    const manualMap = new Map(manualMappings.map(m => [m.stream_id, m.display_order]));
    const manualStreamIds = new Set(manualMappings.map(m => m.stream_id));
    const orderedManual = channels
      .filter(ch => manualStreamIds.has(ch.stream_id))
      .sort((a, b) => (manualMap.get(a.stream_id) ?? 0) - (manualMap.get(b.stream_id) ?? 0));
    
    const remaining = channels.filter(ch => !manualStreamIds.has(ch.stream_id));
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

  // No manual mappings - sort by display_order, then provider_order, then name
  const sorted = [...channels];
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

export function PlaylistEditorModal({ playlistId, playlistName, onClose }: PlaylistEditorModalProps) {
  const [sources, setSources] = useState<BrowseSource[]>([]);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [sourceCategories, setSourceCategories] = useState<Record<string, StoredCategory[]>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [categoryChannels, setCategoryChannels] = useState<Record<string, StoredChannel[]>>({});

  // Target marking state
  const [markedCategoryId, setMarkedCategoryId] = useState<string | null>(null);

  // Global show hidden state
  const [showHidden, setShowHidden] = useState(false);

  // Live query all categories to construct names map for tree-view search
  const allCategories = useLiveQuery(
    () => db.categories.toArray(),
    [],
    []
  );

  const categoryNamesMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of allCategories || []) {
      map.set(`${cat.source_id}:${cat.category_id}`, cat.alias || cat.category_name);
    }
    return map;
  }, [allCategories]);

  // Global channel visibility toggle
  const toggleChannelEnabledGlobal = async (streamId: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    await db.channels.update(streamId, { enabled: newEnabled });
    // Update searchResults inline
    setSearchResults(prev => prev.map(ch => ch.stream_id === streamId ? { ...ch, enabled: newEnabled } : ch));
    // Update categoryChannels inline
    setCategoryChannels(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key].some(ch => ch.stream_id === streamId)) {
          next[key] = next[key].map(ch => ch.stream_id === streamId ? { ...ch, enabled: newEnabled } : ch);
        }
      }
      return next;
    });
  };

  // Global category visibility toggle
  const toggleCategoryEnabledGlobal = async (sourceId: string, categoryId: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    await db.categories.update(categoryId, { enabled: newEnabled });
    // Update sourceCategories inline
    setSourceCategories(prev => {
      const cats = prev[sourceId];
      if (!cats) return prev;
      return {
        ...prev,
        [sourceId]: cats.map(c => c.category_id === categoryId ? { ...c, enabled: newEnabled } : c)
      };
    });
  };

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StoredChannel[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Playlist name editing
  const [currentName, setCurrentName] = useState(playlistName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isCustomPlaylist, setIsCustomPlaylist] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop lists pointer refs
  const categoryListRef = useRef<HTMLDivElement>(null);
  const dragFromCatIdx = useRef<number | null>(null);
  const [dragOverCatIdx, setDragOverCatIdx] = useState<number | null>(null);

  const indivListRef = useRef<HTMLDivElement>(null);
  const dragFromIndivIdx = useRef<number | null>(null);
  const [dragOverIndivIdx, setDragOverIndivIdx] = useState<number | null>(null);

  // Live query native categories (for real sources)
  const nativeCategories = useLiveQuery(
    () => {
      if (!isCustomPlaylist) {
        return db.categories.where('source_id').equals(playlistId).toArray();
      }
      return Promise.resolve([] as StoredCategory[]);
    },
    [playlistId, isCustomPlaylist],
    []
  );

  // Live query playlist category links
  const categoryLinks = useLiveQuery(
    () => db.playlistCategoryLinks.where('playlist_id').equals(playlistId).sortBy('display_order'),
    [playlistId],
    []
  );

  // Live query playlist individual channels
  const individualMappings = useLiveQuery(
    () => db.playlistIndividualChannels.where('playlist_id').equals(playlistId).sortBy('display_order'),
    [playlistId],
    []
  );

  // Filter individual mappings to only those that are not in a category
  const flatIndividualMappings = React.useMemo(() => {
    return (individualMappings || []).filter(m => !m.parent_category_id);
  }, [individualMappings]);

  // Resolve flat individual channel metadata
  const [individualChannels, setIndividualChannels] = useState<StoredChannel[]>([]);
  useEffect(() => {
    if (!flatIndividualMappings || flatIndividualMappings.length === 0) {
      setIndividualChannels([]);
      return;
    }
    const ids = flatIndividualMappings.map(m => m.stream_id);
    db.channels.where('stream_id').anyOf(ids).toArray().then(channels => {
      const channelMap = new Map(channels.map(ch => [ch.stream_id, ch]));
      const resolved = flatIndividualMappings
        .map(m => channelMap.get(m.stream_id))
        .filter((ch): ch is StoredChannel => ch !== undefined);
      setIndividualChannels(resolved);
    });
  }, [flatIndividualMappings]);

  // Load enabled sources on mount
  useEffect(() => {
    const loadSources = async () => {
      let realSources: BrowseSource[] = [];
      if (window.storage) {
        const res = await window.storage.getSources();
        if (res.success && res.data) {
          realSources = res.data
            .filter(s => s.enabled !== false)
            .map(s => ({ id: s.id, name: s.name }));
        }
      }

      // Fetch all custom playlists except the current one
      const playlists = await db.customPlaylists.toArray();
      const isCustom = playlists.some(p => p.playlist_id === playlistId);
      setIsCustomPlaylist(isCustom);

      const virtualSources: BrowseSource[] = playlists
        .filter(p => p.playlist_id !== playlistId)
        .map(p => ({
          id: `playlist:${p.playlist_id}`,
          name: `📋 Playlist: ${p.name}`,
          isCustomPlaylist: true
        }));

      setSources([...realSources, ...virtualSources]);
    };

    loadSources();
  }, [playlistId]);

  // Handle category name resolves (for right panel blocks)
  const [dbCategories, setDbCategories] = useState<Record<string, StoredCategory>>({});
  useEffect(() => {
    if (!categoryLinks || categoryLinks.length === 0) return;
    const ids = categoryLinks.map(l => l.category_id);
    db.categories.where('category_id').anyOf(ids).toArray().then(cats => {
      const map = cats.reduce((acc: Record<string, StoredCategory>, cat) => {
        acc[cat.category_id] = cat;
        return acc;
      }, {});
      setDbCategories(prev => ({ ...prev, ...map }));
    });
  }, [categoryLinks]);

  // Compute unified list of blocks (native categories + custom links)
  const combinedBlocks = React.useMemo(() => {
    const list: Array<
      | { type: 'native'; id: string; name: string; displayOrder: number; category: StoredCategory }
      | { type: 'link'; id: string; linkId: number; name: string; displayOrder: number; link: PlaylistCategoryLink }
    > = [];

    // Add native categories
    for (const cat of nativeCategories || []) {
      list.push({
        type: 'native',
        id: cat.category_id,
        name: cat.alias || cat.category_name,
        displayOrder: cat.display_order ?? 0,
        category: cat,
      });
    }

    // Add category links
    for (const link of categoryLinks || []) {
      if (link.id === undefined) continue;
      const cat = dbCategories[link.category_id];
      const resolvedName = cat?.alias || cat?.category_name || link.category_id;
      list.push({
        type: 'link',
        id: `link:${link.id}`,
        linkId: link.id,
        name: link.custom_name || resolvedName,
        displayOrder: link.display_order ?? 0,
        link,
      });
    }

    // Sort by displayOrder, then alphabetically by name
    list.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [nativeCategories, categoryLinks, dbCategories]);

  // Expand source -> load categories
  const handleToggleSource = async (sourceId: string) => {
    const isExpanded = !expandedSources[sourceId];
    setExpandedSources(prev => ({ ...prev, [sourceId]: isExpanded }));

    if (isExpanded && !sourceCategories[sourceId]) {
      if (sourceId.startsWith('playlist:')) {
        const plId = sourceId.replace('playlist:', '');

        const links = await db.playlistCategoryLinks
          .where('playlist_id')
          .equals(plId)
          .sortBy('display_order');

        const linkCategories = links.map(link => ({
          category_id: `link:${link.id}`,
          source_id: sourceId,
          category_name: link.custom_name || `Category: ${link.category_id}`,
          alias: undefined,
          enabled: true
        }));

        const indivCount = await db.playlistIndividualChannels
          .where('playlist_id')
          .equals(plId)
          .count();

        if (indivCount > 0) {
          linkCategories.push({
            category_id: `indiv:${plId}`,
            source_id: sourceId,
            category_name: 'Individual Channels',
            alias: undefined,
            enabled: true
          });
        }

        setSourceCategories(prev => ({ ...prev, [sourceId]: linkCategories }));
      } else {
        const cats = await db.categories
          .where('source_id')
          .equals(sourceId)
          .toArray();
        cats.sort((a, b) => {
          if (a.display_order != null && b.display_order != null) return a.display_order - b.display_order;
          if (a.display_order != null) return -1;
          if (b.display_order != null) return 1;
          return a.category_name.localeCompare(b.category_name);
        });
        setSourceCategories(prev => ({ ...prev, [sourceId]: cats }));
      }
    }
  };

  // Expand category -> load channels
  const handleToggleCategory = async (sourceId: string, categoryId: string) => {
    const key = `${sourceId}:${categoryId}`;
    const isExpanded = !expandedCategories[key];
    setExpandedCategories(prev => ({ ...prev, [key]: isExpanded }));

    if (isExpanded && !categoryChannels[key]) {
      if (sourceId.startsWith('playlist:')) {
        const plId = sourceId.replace('playlist:', '');
        let channels: StoredChannel[] = [];

        if (categoryId.startsWith('link:')) {
          const linkId = parseInt(categoryId.replace('link:', ''), 10);
          const link = await db.playlistCategoryLinks.get(linkId);
          if (link) {
            channels = await db.channels.whereRaw(
              `source_id = ? AND EXISTS (SELECT 1 FROM json_each(category_ids) WHERE value = ?)`,
              [link.source_id, link.category_id]
            ).toArray();
          }
        } else if (categoryId.startsWith('indiv:')) {
          const mappings = await db.playlistIndividualChannels
            .where('playlist_id')
            .equals(plId)
            .sortBy('display_order');
          const streamIds = mappings.map(m => m.stream_id);
          if (streamIds.length > 0) {
            channels = await db.channels.where('stream_id').anyOf(streamIds).toArray();
            const chMap = new Map(channels.map(ch => [ch.stream_id, ch]));
            channels = streamIds
              .map(id => chMap.get(id))
              .filter((ch): ch is StoredChannel => ch !== undefined);
          }
        }

        const sorted = await sortChannelsLikeLiveTV(sourceId, categoryId, channels);
        setCategoryChannels(prev => ({ ...prev, [key]: sorted }));
      } else {
        const channels = await db.channels.whereRaw(
          `source_id = ? AND EXISTS (SELECT 1 FROM json_each(category_ids) WHERE value = ?)`,
          [sourceId, categoryId]
        ).toArray();
        const sorted = await sortChannelsLikeLiveTV(sourceId, categoryId, channels);
        setCategoryChannels(prev => ({ ...prev, [key]: sorted }));
      }
    }
  };

  // Debounced search channel by name
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const tid = setTimeout(async () => {
      const results = showHidden
        ? await db.channels.whereRaw(`LOWER(name) LIKE ?`, [`%${searchQuery.toLowerCase()}%`]).toArray()
        : await db.channels.whereRaw(`LOWER(name) LIKE ? AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))`, [`%${searchQuery.toLowerCase()}%`]).toArray();
      
      const activeSourceIds = new Set(sources.filter(s => !s.isCustomPlaylist).map(s => s.id));
      const filtered = results.filter(ch => activeSourceIds.has(ch.source_id));
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      setSearchResults(filtered.slice(0, 100));
      setSearchLoading(false);
    }, 400);

    return () => clearTimeout(tid);
  }, [searchQuery, sources, showHidden]);

  // Playlist name editing
  const handleSaveName = async () => {
    const trimmed = currentName.trim();
    if (trimmed && trimmed !== playlistName) {
      await renamePlaylist(playlistId, trimmed);
    }
    setIsEditingName(false);
  };

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
    }
  }, [isEditingName]);

  // Left panel actions
  const handleAddCategory = async (sourceId: string, categoryId: string) => {
    if (sourceId.startsWith('playlist:')) {
      if (categoryId.startsWith('link:')) {
        const linkId = parseInt(categoryId.replace('link:', ''), 10);
        const link = await db.playlistCategoryLinks.get(linkId);
        if (link) {
          await addCategoryToPlaylist(playlistId, link.source_id, link.category_id);
        }
      } else if (categoryId.startsWith('indiv:')) {
        const plId = sourceId.replace('playlist:', '');
        const mappings = await db.playlistIndividualChannels
          .where('playlist_id')
          .equals(plId)
          .sortBy('display_order');
        const streamIds = mappings.map(m => m.stream_id);
        if (streamIds.length > 0) {
          await addMultipleIndividualChannelsToPlaylist(playlistId, streamIds);
        }
      }
    } else {
      await addCategoryToPlaylist(playlistId, sourceId, categoryId);
    }
  };

  const handleAddChannel = async (streamId: string) => {
    if (markedCategoryId) {
      await addChannelToCategory(playlistId, markedCategoryId, streamId);
    } else {
      await addIndividualChannelToPlaylist(playlistId, streamId);
    }
  };

  // Right panel drag-reorder categories
  const getCatIndexFromClientY = (clientY: number): number => {
    if (!categoryListRef.current) return 0;
    const children = Array.from(categoryListRef.current.children) as HTMLElement[];
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return parseInt(children[i].getAttribute('data-index') || '0', 10);
      }
    }
    if (children.length > 0) {
      const lastIdx = parseInt(children[children.length - 1].getAttribute('data-index') || '0', 10);
      return lastIdx + 1;
    }
    return 0;
  };

  const handleCatPointerDown = useCallback((e: React.PointerEvent, index: number) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragFromCatIdx.current = index;
    setDragOverCatIdx(index);
  }, []);

  const handleCatPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragFromCatIdx.current === null) return;
    e.preventDefault();
    setDragOverCatIdx(getCatIndexFromClientY(e.clientY));
  }, []);

  const handleCatPointerUp = useCallback(async (e: React.PointerEvent) => {
    if (dragFromCatIdx.current === null) return;
    const from = dragFromCatIdx.current;
    const to = getCatIndexFromClientY(e.clientY);
    dragFromCatIdx.current = null;
    setDragOverCatIdx(null);
    if (from === to || !combinedBlocks) return;

    const next = [...combinedBlocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    try {
      for (let i = 0; i < next.length; i++) {
        const block = next[i];
        if (block.type === 'native') {
          await db.categories.update(block.id, { display_order: i });
        } else if (block.type === 'link') {
          await db.playlistCategoryLinks.update(block.linkId, { display_order: i });
        }
      }
    } catch (err) {
      console.error('Failed to reorder playlist categories:', err);
    }
  }, [combinedBlocks]);

  const handleCatPointerCancel = useCallback(() => {
    dragFromCatIdx.current = null;
    setDragOverCatIdx(null);
  }, []);

  // Right panel drag-reorder individual channels
  const getIndivIndexFromClientY = (clientY: number): number => {
    if (!indivListRef.current) return 0;
    const children = Array.from(indivListRef.current.children) as HTMLElement[];
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return parseInt(children[i].getAttribute('data-index') || '0', 10);
      }
    }
    if (children.length > 0) {
      const lastIdx = parseInt(children[children.length - 1].getAttribute('data-index') || '0', 10);
      return lastIdx + 1;
    }
    return 0;
  };

  const handleIndivPointerDown = useCallback((e: React.PointerEvent, index: number) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragFromIndivIdx.current = index;
    setDragOverIndivIdx(index);
  }, []);

  const handleIndivPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragFromIndivIdx.current === null) return;
    e.preventDefault();
    setDragOverIndivIdx(getIndivIndexFromClientY(e.clientY));
  }, []);

  const handleIndivPointerUp = useCallback(async (e: React.PointerEvent) => {
    if (dragFromIndivIdx.current === null) return;
    const from = dragFromIndivIdx.current;
    const to = getIndivIndexFromClientY(e.clientY);
    dragFromIndivIdx.current = null;
    setDragOverIndivIdx(null);
    if (from === to || !flatIndividualMappings) return;

    const next = [...flatIndividualMappings];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    try {
      await reorderPlaylistIndividualChannels(playlistId, next.map(m => m.stream_id));
    } catch (err) {
      console.error('Failed to reorder individual channels:', err);
    }
  }, [flatIndividualMappings, playlistId]);

  const handleIndivPointerCancel = useCallback(() => {
    dragFromIndivIdx.current = null;
    setDragOverIndivIdx(null);
  }, []);

  const handleExport = async () => {
    try {
      const { generateM3uForPlaylist } = await import('../services/playlist-export');
      const content = await generateM3uForPlaylist(playlistId);
      const result = await window.storage.saveM3UFile(content, currentName);
      if (result.success) {
        alert('Playlist exported successfully!');
      }
    } catch (e) {
      console.error('Failed to export playlist:', e);
      alert('Export failed: ' + String(e));
    }
  };

  const visibleIndivCount = individualChannels.filter(c => showHidden || c.enabled !== false).length;

  return (
    <div className="playlist-editor-backdrop" onClick={onClose}>
      <div className="playlist-editor-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="playlist-editor-header">
          <div className="ple-header-left">
            <span className="ple-header-icon">📋</span>
            {isEditingName && isCustomPlaylist ? (
              <input
                ref={nameInputRef}
                className="ple-name-input"
                value={currentName}
                onChange={e => setCurrentName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') {
                    setCurrentName(playlistName);
                    setIsEditingName(false);
                  }
                }}
              />
            ) : (
              <h2
                className={`ple-name-title${!isCustomPlaylist ? ' readonly' : ''}`}
                onClick={() => isCustomPlaylist && setIsEditingName(true)}
                title={isCustomPlaylist ? "Click to rename" : undefined}
              >
                {currentName} {isCustomPlaylist && '✏️'}
              </h2>
            )}
          </div>
          <div className="ple-header-right">
            <label className="ple-show-hidden-label">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={e => setShowHidden(e.target.checked)}
              />
              Show Hidden
            </label>
            <button className="ple-export-btn" onClick={handleExport}>📤 Export .m3u</button>
            <button className="ple-close-btn" onClick={onClose}>✕ Close</button>
          </div>
        </div>

        {/* Workspace Panels */}
        <div className="playlist-editor-workspace">
          {/* Left Panel: Source Browser */}
          <div className="playlist-editor-left">
            <div className="ple-panel-header">
              <h3>Search & Browse Sources</h3>
              <div className="ple-search-wrapper">
                <input
                  type="text"
                  placeholder="Search channels across sources…"
                  className="ple-search-input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="ple-search-clear" onClick={() => setSearchQuery('')}>✕</button>
                )}
              </div>
            </div>

            <div className="ple-panel-content">
              {searchQuery.trim() ? (
                // Search View
                <div className="ple-search-results">
                  {searchLoading ? (
                    <div className="ple-loading-hint">Searching…</div>
                  ) : searchResults.length === 0 ? (
                    <div className="ple-empty-hint">No matching channels found.</div>
                  ) : (() => {
                    // Group searchResults by source, then by category
                    const sourceMap = new Map<string, Map<string, StoredChannel[]>>();
                    for (const ch of searchResults) {
                      const sourceId = ch.source_id;
                      if (!sourceMap.has(sourceId)) {
                        sourceMap.set(sourceId, new Map<string, StoredChannel[]>());
                      }
                      const catMap = sourceMap.get(sourceId)!;

                      const catIds = parseCategoryIds(ch.category_ids);
                      if (catIds.length === 0) {
                        const uncategorizedKey = 'uncategorized';
                        if (!catMap.has(uncategorizedKey)) {
                          catMap.set(uncategorizedKey, []);
                        }
                        catMap.get(uncategorizedKey)!.push(ch);
                      } else {
                        for (const catId of catIds) {
                          if (!catMap.has(catId)) {
                            catMap.set(catId, []);
                          }
                          catMap.get(catId)!.push(ch);
                        }
                      }
                    }

                    return (
                      <div className="ple-tree-root">
                        {Array.from(sourceMap.entries()).map(([sourceId, categoriesMap]) => {
                          const sourceObj = sources.find(s => s.id === sourceId);
                          const sourceName = sourceObj ? sourceObj.name : 'Unknown Source';

                          return (
                            <div key={sourceId} className="ple-tree-source-node">
                              <div className="ple-tree-source-header">
                                <span className="ple-tree-chevron">▼</span>
                                <span className="ple-tree-source-name">{sourceName}</span>
                              </div>
                              <div className="ple-tree-source-children">
                                {Array.from(categoriesMap.entries()).map(([catId, channels]) => {
                                  const categoryName = catId === 'uncategorized'
                                    ? 'Uncategorized'
                                    : (categoryNamesMap.get(`${sourceId}:${catId}`) || catId);

                                  const visibleChans = channels.filter(ch => showHidden || ch.enabled !== false);
                                  if (visibleChans.length === 0) return null;

                                  return (
                                    <div key={catId} className="ple-tree-cat-node">
                                      <div className="ple-tree-cat-header">
                                        <span className="ple-tree-chevron-small">▼</span>
                                        <span className="ple-tree-cat-name">{categoryName}</span>
                                        <span className="ple-tree-cat-count">{visibleChans.length}</span>
                                      </div>
                                      <div className="ple-tree-cat-children">
                                        {visibleChans.map(ch => (
                                          <div key={`${catId}:${ch.stream_id}`} className={`ple-tree-channel-row${ch.enabled === false ? ' ple-hidden-item' : ''}`}>
                                            <div className="ple-tree-ch-info">
                                              {ch.stream_icon ? (
                                                <img src={ch.stream_icon} className="ple-tree-ch-logo" alt="" />
                                              ) : (
                                                <span className="ple-tree-ch-logo-placeholder">📺</span>
                                              )}
                                              <span className="ple-tree-ch-name">{ch.name}</span>
                                            </div>
                                            <div className="ple-tree-ch-actions">
                                              <button
                                                className={`ple-visibility-btn${ch.enabled === false ? ' hidden-item' : ''}`}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleChannelEnabledGlobal(ch.stream_id, ch.enabled !== false);
                                                }}
                                                title={ch.enabled === false ? "Show channel" : "Hide channel"}
                                              >
                                                {ch.enabled === false ? <EyeSlashIcon /> : <EyeIcon />}
                                              </button>
                                              <button
                                                className="ple-tree-add-btn"
                                                onClick={() => handleAddChannel(ch.stream_id)}
                                                title={markedCategoryId ? "Add channel to target category" : "Add channel to playlist"}
                                              >
                                                ＋
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                // Browse View
                <div className="ple-sources-list">
                  {sources.map(source => {
                    const isExpanded = !!expandedSources[source.id];
                    const cats = sourceCategories[source.id] || [];

                    return (
                      <div key={source.id} className={`ple-source-block${isExpanded ? ' expanded' : ''}`}>
                        <button className="ple-source-header" onClick={() => handleToggleSource(source.id)}>
                          <span className="ple-chevron">{isExpanded ? '▼' : '▶'}</span>
                          <span className="ple-source-name">{source.name}</span>
                        </button>

                        {isExpanded && (
                          <div className="ple-source-categories">
                            {cats.length === 0 ? (
                              <div className="ple-empty-hint">No categories.</div>
                            ) : (
                              cats.map(cat => {
                                const catKey = `${source.id}:${cat.category_id}`;
                                const isCatExpanded = !!expandedCategories[catKey];
                                const channels = categoryChannels[catKey] || [];
                                const displayName = cat.alias || cat.category_name;

                                if (cat.enabled === false && !showHidden) {
                                  return null;
                                }

                                return (
                                  <div key={cat.category_id} className={`ple-cat-block${cat.enabled === false ? ' ple-hidden-item' : ''}`}>
                                    <div className="ple-cat-header">
                                      <button
                                        className="ple-cat-toggle"
                                        onClick={() => handleToggleCategory(source.id, cat.category_id)}
                                      >
                                        <span className="ple-chevron-small">{isCatExpanded ? '▼' : '▶'}</span>
                                        <span className="ple-cat-name">{displayName}</span>
                                      </button>
                                      <div className="ple-cat-ch-actions">
                                        {source.id !== 'custom' && !source.id.startsWith('playlist:') && (
                                          <button
                                            className={`ple-visibility-btn${cat.enabled === false ? ' hidden-item' : ''}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleCategoryEnabledGlobal(source.id, cat.category_id, cat.enabled !== false);
                                            }}
                                            title={cat.enabled === false ? "Show category" : "Hide category"}
                                          >
                                            {cat.enabled === false ? <EyeSlashIcon /> : <EyeIcon />}
                                          </button>
                                        )}
                                        <button
                                          className="ple-add-btn"
                                          onClick={() => handleAddCategory(source.id, cat.category_id)}
                                          title="Add category link to playlist"
                                        >
                                          ＋ Category
                                        </button>
                                      </div>
                                    </div>

                                    {isCatExpanded && (
                                      <div className="ple-cat-channels">
                                        {channels.length === 0 ? (
                                          <div className="ple-empty-hint">No channels.</div>
                                        ) : (
                                          channels.map(ch => {
                                            if (ch.enabled === false && !showHidden) {
                                              return null;
                                            }

                                            return (
                                              <div key={ch.stream_id} className={`ple-cat-channel-row${ch.enabled === false ? ' ple-hidden-item' : ''}`}>
                                                <span className="ple-cat-ch-name">{ch.name}</span>
                                                <div className="ple-cat-ch-actions">
                                                  <button
                                                    className={`ple-visibility-btn${ch.enabled === false ? ' hidden-item' : ''}`}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleChannelEnabledGlobal(ch.stream_id, ch.enabled !== false);
                                                    }}
                                                    title={ch.enabled === false ? "Show channel" : "Hide channel"}
                                                  >
                                                    {ch.enabled === false ? <EyeSlashIcon /> : <EyeIcon />}
                                                  </button>
                                                  <button
                                                    className="ple-add-indiv-btn"
                                                    onClick={() => handleAddChannel(ch.stream_id)}
                                                    title={markedCategoryId ? "Add channel to target category" : "Add channel"}
                                                  >
                                                    ＋
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Playlist Contents */}
          <div className="playlist-editor-right">
            <div className="ple-panel-header ple-right-panel-header">
              <div className="ple-right-header-title-row">
                <h3>Playlist Contents</h3>
                <button
                  className="ple-add-custom-cat-btn"
                  onClick={async () => {
                    const name = window.prompt("Enter custom category name:");
                    if (name && name.trim()) {
                      await addCustomCategoryToPlaylist(playlistId, name.trim());
                    }
                  }}
                >
                  ＋ Custom Category
                </button>
              </div>
              <span className="ple-meta-hint">Drag handle ⋮⋮ to reorder. Click 🎯 Target to mark a category for left-panel additions.</span>
            </div>

            <div className="ple-panel-content">
              {(!combinedBlocks || combinedBlocks.length === 0) && (!individualChannels || individualChannels.length === 0) ? (
                <div className="ple-right-empty">
                  <span className="ple-empty-icon">📋</span>
                  <h4>Playlist is Empty</h4>
                  <p>Add source categories or individual channels from the left panel to build your custom playlist.</p>
                </div>
              ) : (
                <div className="ple-contents-list">
                  {/* Category Blocks drag-reorder container */}
                  {combinedBlocks && combinedBlocks.length > 0 && (
                    <div
                      className="ple-section-category-links"
                      ref={categoryListRef}
                      onPointerMove={handleCatPointerMove}
                      onPointerUp={handleCatPointerUp}
                      onPointerCancel={handleCatPointerCancel}
                    >
                      {combinedBlocks.map((block, index) => {
                        const isDragging = dragFromCatIdx.current === index;
                        const isDragOver = dragOverCatIdx === index && dragFromCatIdx.current !== null && dragFromCatIdx.current !== index;
                        const blockId = block.type === 'native' ? block.id : `link:${block.linkId}`;
                        const isMarked = markedCategoryId === blockId;

                        return (
                          <CategoryBlockCard
                            key={block.id}
                            playlistId={playlistId}
                            block={block}
                            sources={sources}
                            index={index}
                            isDragging={isDragging}
                            isDragOver={isDragOver}
                            isMarked={isMarked}
                            onMark={() => setMarkedCategoryId(prev => prev === blockId ? null : blockId)}
                            onPointerDown={handleCatPointerDown}
                            onRemove={block.type === 'link' ? () => removeCategoryFromPlaylist(block.linkId) : undefined}
                            showHidden={showHidden}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Individual Channels Section */}
                  {individualChannels && individualChannels.length > 0 && visibleIndivCount > 0 && (
                    <div className="ple-indiv-section">
                      <div className="ple-indiv-header">
                        <h4>🎬 Individual Channels ({visibleIndivCount})</h4>
                      </div>

                      <div
                        className="ple-indiv-list"
                        ref={indivListRef}
                        onPointerMove={handleIndivPointerMove}
                        onPointerUp={handleIndivPointerUp}
                        onPointerCancel={handleIndivPointerCancel}
                      >
                        {individualChannels.map((ch, index) => {
                          const isDragging = dragFromIndivIdx.current === index;
                          const isDragOver = dragOverIndivIdx === index && dragFromIndivIdx.current !== null && dragFromIndivIdx.current !== index;
                          
                          if (ch.enabled === false && !showHidden) {
                            return null;
                          }

                          const srcName = sources.find(s => s.id === ch.source_id)?.name || 'Source';

                          return (
                            <div
                              key={ch.stream_id}
                              className={`ple-indiv-card${isDragging ? ' dragging' : ''}${isDragOver ? ' drag-over' : ''}${ch.enabled === false ? ' ple-hidden-item' : ''}`}
                              data-index={index}
                            >
                              <span
                                className="ple-block-drag-handle"
                                style={{ touchAction: 'none' }}
                                onPointerDown={e => handleIndivPointerDown(e, index)}
                              >⋮⋮</span>

                              <div className="ple-indiv-ch-info">
                                {ch.stream_icon ? (
                                  <img src={ch.stream_icon} className="ple-indiv-ch-logo" alt="" />
                                ) : (
                                  <span className="ple-indiv-ch-logo-placeholder">📺</span>
                                )}
                                <div className="ple-indiv-ch-meta">
                                  <span className="ple-indiv-ch-name">{ch.name}</span>
                                  <span className="ple-indiv-ch-sub">{srcName}</span>
                                </div>
                              </div>

                              <button
                                className={`ple-visibility-btn${ch.enabled === false ? ' hidden-item' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleChannelEnabledGlobal(ch.stream_id, ch.enabled !== false);
                                }}
                                title={ch.enabled === false ? "Show channel" : "Hide channel"}
                              >
                                {ch.enabled === false ? <EyeSlashIcon /> : <EyeIcon />}
                              </button>

                              <button
                                className="ple-remove-btn"
                                onClick={() => removeIndividualChannelFromPlaylist(playlistId, ch.stream_id)}
                                title="Remove channel"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

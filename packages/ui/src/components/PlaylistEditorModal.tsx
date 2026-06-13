import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from '../hooks/useSqliteLiveQuery';
import { db, type PlaylistCategoryLink, type PlaylistIndividualChannel, type StoredChannel, type StoredCategory } from '../db';
import {
  addCategoryToPlaylist,
  removeCategoryFromPlaylist,
  renameCategoryLink,
  reorderPlaylistCategories,
  addIndividualChannelToPlaylist,
  removeIndividualChannelFromPlaylist,
  reorderPlaylistIndividualChannels,
  renamePlaylist,
  addMultipleIndividualChannelsToPlaylist,
} from '../services/playlist-editor';
import './PlaylistEditorModal.css';

interface PlaylistEditorModalProps {
  playlistId: string;
  playlistName: string;
  onClose: () => void;
}

interface BrowseSource {
  id: string;
  name: string;
  isCustomPlaylist?: boolean;
}


export function PlaylistEditorModal({ playlistId, playlistName, onClose }: PlaylistEditorModalProps) {
  const [sources, setSources] = useState<BrowseSource[]>([]);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [sourceCategories, setSourceCategories] = useState<Record<string, StoredCategory[]>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [categoryChannels, setCategoryChannels] = useState<Record<string, StoredChannel[]>>({});
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StoredChannel[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Playlist name editing
  const [currentName, setCurrentName] = useState(playlistName);
  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Category renaming inline state
  const [renamingLinkId, setRenamingLinkId] = useState<number | null>(null);
  const [renamingName, setRenamingName] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop lists pointer refs
  const categoryListRef = useRef<HTMLDivElement>(null);
  const dragFromCatIdx = useRef<number | null>(null);
  const [dragOverCatIdx, setDragOverCatIdx] = useState<number | null>(null);

  const indivListRef = useRef<HTMLDivElement>(null);
  const dragFromIndivIdx = useRef<number | null>(null);
  const [dragOverIndivIdx, setDragOverIndivIdx] = useState<number | null>(null);

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

  // Resolve individual channel metadata
  const [individualChannels, setIndividualChannels] = useState<StoredChannel[]>([]);
  useEffect(() => {
    if (!individualMappings || individualMappings.length === 0) {
      setIndividualChannels([]);
      return;
    }
    const ids = individualMappings.map(m => m.stream_id);
    db.channels.where('stream_id').anyOf(ids).toArray().then(channels => {
      const channelMap = new Map(channels.map(ch => [ch.stream_id, ch]));
      const resolved = individualMappings
        .map(m => channelMap.get(m.stream_id))
        .filter((ch): ch is StoredChannel => ch !== undefined);
      setIndividualChannels(resolved);
    });
  }, [individualMappings]);

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

  // Count channels inside category links live
  const [linkChannelCounts, setLinkChannelCounts] = useState<Record<number, number>>({});
  useEffect(() => {
    if (!categoryLinks || categoryLinks.length === 0) return;
    const fetchCounts = async () => {
      const counts: Record<number, number> = {};
      for (const link of categoryLinks) {
        if (link.id === undefined) continue;
        const rows = await db.channels.whereRaw(
          `source_id = ? AND EXISTS (SELECT 1 FROM json_each(category_ids) WHERE value = ?) AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))`,
          [link.source_id, link.category_id]
        ).toArray();
        counts[link.id] = rows.length;
      }
      setLinkChannelCounts(counts);
    };
    fetchCounts();
  }, [categoryLinks]);

  // Expand source -> load categories
  const handleToggleSource = async (sourceId: string) => {
    const isExpanded = !expandedSources[sourceId];
    setExpandedSources(prev => ({ ...prev, [sourceId]: isExpanded }));
    
    if (isExpanded && !sourceCategories[sourceId]) {
      if (sourceId.startsWith('playlist:')) {
        // It's a custom playlist!
        const plId = sourceId.replace('playlist:', '');
        
        // Find all category links in this playlist
        const links = await db.playlistCategoryLinks
          .where('playlist_id')
          .equals(plId)
          .sortBy('display_order');
          
        // Map these links to StoredCategory format
        const linkCategories = links.map(link => ({
          category_id: `link:${link.id}`,
          source_id: sourceId,
          category_name: link.custom_name || `Category: ${link.category_id}`,
          alias: undefined,
          enabled: true
        }));
        
        // Check if there are individual channels in this playlist
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
        // Sort alphabetically
        cats.sort((a, b) => a.category_name.localeCompare(b.category_name));
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
              `source_id = ? AND EXISTS (SELECT 1 FROM json_each(category_ids) WHERE value = ?) AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))`,
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
        
        channels.sort((a, b) => a.name.localeCompare(b.name));
        setCategoryChannels(prev => ({ ...prev, [key]: channels }));
      } else {
        const channels = await db.channels.whereRaw(
          `source_id = ? AND EXISTS (SELECT 1 FROM json_each(category_ids) WHERE value = ?) AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))`,
          [sourceId, categoryId]
        ).toArray();
        channels.sort((a, b) => a.name.localeCompare(b.name));
        setCategoryChannels(prev => ({ ...prev, [key]: channels }));
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
      const results = await db.channels.whereRaw(
        `LOWER(name) LIKE ? AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))`,
        [`%${searchQuery.toLowerCase()}%`]
      ).toArray();
      // Filter out disabled sources
      const activeSourceIds = new Set(sources.filter(s => !s.isCustomPlaylist).map(s => s.id));
      const filtered = results.filter(ch => activeSourceIds.has(ch.source_id));
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      setSearchResults(filtered.slice(0, 100));
      setSearchLoading(false);
    }, 400);

    return () => clearTimeout(tid);
  }, [searchQuery, sources]);

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

  // Category renaming inline
  const startRenameCategory = (link: PlaylistCategoryLink) => {
    if (link.id === undefined) return;
    const cat = dbCategories[link.category_id];
    const originalName = cat?.alias || cat?.category_name || link.category_id;
    setRenamingLinkId(link.id);
    setRenamingName(link.custom_name || originalName);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const handleSaveCategoryName = async (linkId: number) => {
    const trimmed = renamingName.trim();
    await renameCategoryLink(linkId, trimmed || null);
    setRenamingLinkId(null);
  };

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
    await addIndividualChannelToPlaylist(playlistId, streamId);
  };

  // Right panel drag-reorder categories
  const getCatIndexFromClientY = (clientY: number): number => {
    if (!categoryListRef.current) return 0;
    const children = Array.from(categoryListRef.current.children) as HTMLElement[];
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return Math.max(0, children.length - 1);
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
    if (from === to || !categoryLinks) return;

    const next = [...categoryLinks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    try {
      await reorderPlaylistCategories(playlistId, next.map(l => l.id as number));
    } catch (err) {
      console.error('Failed to reorder playlist categories:', err);
    }
  }, [categoryLinks, playlistId]);

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
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return Math.max(0, children.length - 1);
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
    if (from === to || !individualMappings) return;

    const next = [...individualMappings];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    try {
      await reorderPlaylistIndividualChannels(playlistId, next.map(m => m.stream_id));
    } catch (err) {
      console.error('Failed to reorder individual channels:', err);
    }
  }, [individualMappings, playlistId]);

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

  return (
    <div className="playlist-editor-backdrop" onClick={onClose}>
      <div className="playlist-editor-modal" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="playlist-editor-header">
          <div className="ple-header-left">
            <span className="ple-header-icon">📋</span>
            {isEditingName ? (
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
              <h2 className="ple-name-title" onClick={() => setIsEditingName(true)} title="Click to rename">
                {currentName} ✏️
              </h2>
            )}
          </div>
          <div className="ple-header-right">
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
                  ) : (
                    searchResults.map(ch => {
                      const srcName = sources.find(s => s.id === ch.source_id)?.name || 'Source';
                      return (
                        <div key={ch.stream_id} className="ple-channel-row">
                          <div className="ple-ch-info">
                            {ch.stream_icon ? (
                              <img src={ch.stream_icon} className="ple-ch-logo" alt="" />
                            ) : (
                              <span className="ple-ch-logo-placeholder">📺</span>
                            )}
                            <div className="ple-ch-meta">
                              <span className="ple-ch-name">{ch.name}</span>
                              <span className="ple-ch-source">{srcName}</span>
                            </div>
                          </div>
                          <button
                            className="ple-add-btn"
                            onClick={() => handleAddChannel(ch.stream_id)}
                            title="Add channel to playlist"
                          >
                            ＋ Channel
                          </button>
                        </div>
                      );
                    })
                  )}
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

                                return (
                                  <div key={cat.category_id} className="ple-cat-block">
                                    <div className="ple-cat-header">
                                      <button
                                        className="ple-cat-toggle"
                                        onClick={() => handleToggleCategory(source.id, cat.category_id)}
                                      >
                                        <span className="ple-chevron-small">{isCatExpanded ? '▼' : '▶'}</span>
                                        <span className="ple-cat-name">{displayName}</span>
                                      </button>
                                      <button
                                        className="ple-add-btn"
                                        onClick={() => handleAddCategory(source.id, cat.category_id)}
                                        title="Add category link to playlist"
                                      >
                                        ＋ Category
                                      </button>
                                    </div>

                                    {isCatExpanded && (
                                      <div className="ple-cat-channels">
                                        {channels.length === 0 ? (
                                          <div className="ple-empty-hint">No channels.</div>
                                        ) : (
                                          channels.map(ch => (
                                            <div key={ch.stream_id} className="ple-cat-channel-row">
                                              <span className="ple-cat-ch-name">{ch.name}</span>
                                              <button
                                                className="ple-add-indiv-btn"
                                                onClick={() => handleAddChannel(ch.stream_id)}
                                                title="Add channel"
                                              >
                                                ＋
                                              </button>
                                            </div>
                                          ))
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
            <div className="ple-panel-header">
              <h3>Playlist Contents</h3>
              <span className="ple-meta-hint">Drag handle ⋮⋮ to reorder. Categories sync automatically.</span>
            </div>

            <div className="ple-panel-content">
              {(!categoryLinks || categoryLinks.length === 0) && (!individualMappings || individualMappings.length === 0) ? (
                <div className="ple-right-empty">
                  <span className="ple-empty-icon">📋</span>
                  <h4>Playlist is Empty</h4>
                  <p>Add source categories or individual channels from the left panel to build your custom playlist.</p>
                </div>
              ) : (
                <div className="ple-contents-list">
                  {/* Category Links drag-reorder container */}
                  {categoryLinks && categoryLinks.length > 0 && (
                    <div
                      className="ple-section-category-links"
                      ref={categoryListRef}
                      onPointerMove={handleCatPointerMove}
                      onPointerUp={handleCatPointerUp}
                      onPointerCancel={handleCatPointerCancel}
                    >
                      {categoryLinks.map((link, index) => {
                        const isDragging = dragFromCatIdx.current === index;
                        const isDragOver = dragOverCatIdx === index && dragFromCatIdx.current !== null && dragFromCatIdx.current !== index;
                        const cat = dbCategories[link.category_id];
                        const srcName = sources.find(s => s.id === link.source_id)?.name || 'Source';
                        
                        const resolvedCatName = cat?.alias || cat?.category_name || link.category_id;
                        const blockTitle = link.custom_name || resolvedCatName;
                        const channelCount = linkChannelCounts[link.id as number] ?? 0;

                        return (
                          <div
                            key={link.id}
                            className={`ple-block-card${isDragging ? ' dragging' : ''}${isDragOver ? ' drag-over' : ''}`}
                          >
                            <span
                              className="ple-block-drag-handle"
                              style={{ touchAction: 'none' }}
                              onPointerDown={e => handleCatPointerDown(e, index)}
                            >⋮⋮</span>

                            <div className="ple-block-info">
                              {renamingLinkId === link.id ? (
                                <div className="ple-inline-rename">
                                  <input
                                    ref={renameInputRef}
                                    className="ple-rename-input"
                                    value={renamingName}
                                    onChange={e => setRenamingName(e.target.value)}
                                    onBlur={() => handleSaveCategoryName(link.id as number)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleSaveCategoryName(link.id as number);
                                      if (e.key === 'Escape') setRenamingLinkId(null);
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="ple-block-title-row">
                                  <span className="ple-block-title" onClick={() => startRenameCategory(link)} title="Click to rename category block">
                                    📂 {blockTitle} ✏️
                                  </span>
                                  {link.custom_name && (
                                    <span className="ple-original-title-hint">(orig: {resolvedCatName})</span>
                                  )}
                                </div>
                              )}
                              <span className="ple-block-sub">
                                {srcName} · {channelCount} channels link
                              </span>
                            </div>

                            <button
                              className="ple-remove-btn"
                              onClick={() => removeCategoryFromPlaylist(link.id as number)}
                              title="Remove category"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Individual Channels Section */}
                  {individualChannels && individualChannels.length > 0 && (
                    <div className="ple-indiv-section">
                      <div className="ple-indiv-header">
                        <h4>🎬 Individual Channels ({individualChannels.length})</h4>
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
                          const srcName = sources.find(s => s.id === ch.source_id)?.name || 'Source';

                          return (
                            <div
                              key={ch.stream_id}
                              className={`ple-indiv-card${isDragging ? ' dragging' : ''}${isDragOver ? ' drag-over' : ''}`}
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

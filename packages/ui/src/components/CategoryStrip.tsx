import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from '../hooks/useSqliteLiveQuery';
import { useCategoriesBySource, type CategoryWithCount, type SourceWithCategories } from '../hooks/useChannels';
import { db, getWatchlistCount, type CustomGroup, updateCategoryEnabled, updateCategoryAlias, type CustomPlaylist, type PlaylistCategoryLink } from '../db';
import { PlaylistEditorModal } from './PlaylistEditorModal';
import type { Source } from '@ynotv/core';
import { useSourceVersion } from '../contexts/SourceVersionContext';
import { normalizeBoolean } from '../utils/db-helpers';
import { useModal } from './Modal';
import { createCustomGroup, deleteCustomGroup } from '../services/custom-groups';
import { CustomGroupManager } from './CustomGroupManager';
import { CreateCustomOptionModal } from './CreateCustomOptionModal';
import { CategoryManager } from './settings/CategoryManager';
import { FavoriteManager } from './settings/FavoriteManager';
import { SourceContextMenu } from './SourceContextMenu';
import { CategoryContextMenu } from './CategoryContextMenu';
import { FavoritesContextMenu } from './FavoritesContextMenu';
import { RecentChannelsContextMenu } from './RecentChannelsContextMenu';
import { PlaylistContextMenu } from './PlaylistContextMenu';
import { EpgEditorModal } from './EpgEditorModal';
import { clearRecentChannels } from '../utils/recentChannels';
import { useCategorySortOrder, useIncludeAllChannelsToPlaylist } from '../stores/uiStore';
import { isCategorySortCustomized } from '../utils/categorySortOverrides';
import './CategoryStrip.css';

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

// Component that detects text overflow and only scrolls when necessary
function ScrollingText({ children, className }: { children: React.ReactNode; className?: string }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const checkOverflow = () => {
      // Check if text overflows its container
      // scrollWidth = full text width including overflow
      // clientWidth = visible width of the element
      const textWidth = element.scrollWidth;
      const visibleWidth = element.clientWidth;
      const hasOverflow = textWidth > visibleWidth + 2; // +2px safety margin
      setIsOverflowing(hasOverflow);
    };

    // Check multiple times to catch layout changes
    checkOverflow();
    const timeouts = [
      setTimeout(checkOverflow, 50),
      setTimeout(checkOverflow, 200),
      setTimeout(checkOverflow, 500)
    ];

    // Also check on window resize
    const handleResize = () => checkOverflow();
    window.addEventListener('resize', handleResize);

    return () => {
      timeouts.forEach(clearTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [children]);

  return (
    <span 
      ref={textRef} 
      className={`${className || ''} ${isOverflowing ? 'overflowing' : ''}`}
    >
      {children}
    </span>
  );
}

interface CategoryStripProps {
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  visible: boolean;
  onEditSource?: (sourceId: string) => void;
  onClose?: () => void;
  onShow?: () => void;
  isLiveTV?: boolean;
}

// Chevron Icon for expand/collapse
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16" height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 0.2s ease',
      marginRight: '8px'
    }}
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

// Favorites button component
function FavoritesButton({ selectedCategoryId, onSelectCategory, onContextMenu }: { selectedCategoryId: string | null; onSelectCategory: (categoryId: string | null) => void; onContextMenu?: (e: React.MouseEvent) => void }) {
  const favoriteCount = useLiveQuery(
    async () => {
      return await db.channels.countWhere('(is_favorite = 1 OR is_favorite = true)');
    }
  );

  return (
    <button
      className={`category-item category-list-bar ${selectedCategoryId === '__favorites__' ? 'selected' : ''}`}
      onClick={() => onSelectCategory('__favorites__')}
      onContextMenu={onContextMenu}
    >
      <div className="category-item-left">
        <span className="category-icon favorites-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </span>
        <ScrollingText className="category-name">Favorites</ScrollingText>
      </div>
      <span className="category-count">{favoriteCount ?? 0}</span>
    </button>
  );
}

// Watchlist button component
function WatchlistButton({ selectedCategoryId, onSelectCategory, onContextMenu }: { selectedCategoryId: string | null; onSelectCategory: (categoryId: string | null) => void; onContextMenu?: (e: React.MouseEvent) => void }) {
  const watchlistCount = useLiveQuery(
    async () => {
      return await getWatchlistCount();
    }
  );

  return (
    <button
      className={`category-item category-list-bar ${selectedCategoryId === '__watchlist__' ? 'selected' : ''}`}
      onClick={() => onSelectCategory('__watchlist__')}
      onContextMenu={onContextMenu}
    >
      <div className="category-item-left">
        <span className="category-icon watchlist-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <ScrollingText className="category-name">Watchlist</ScrollingText>
      </div>
      <span className="category-count">{watchlistCount ?? 0}</span>
    </button>
  );
}

// Recently Viewed button component
function RecentlyViewedButton({ selectedCategoryId, onSelectCategory, onContextMenu }: { selectedCategoryId: string | null; onSelectCategory: (categoryId: string | null) => void; onContextMenu?: (e: React.MouseEvent) => void }) {
  const recentCount = useLiveQuery(
    async () => {
      const { getRecentChannels } = await import('../utils/recentChannels');
      return getRecentChannels().length;
    }
  );

  return (
    <button
      className={`category-item category-list-bar ${selectedCategoryId === '__recent__' ? 'selected' : ''}`}
      onClick={() => onSelectCategory('__recent__')}
      onContextMenu={onContextMenu}
    >
      <div className="category-item-left">
        <span className="category-icon recent-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
        <ScrollingText className="category-name">Recently Viewed</ScrollingText>
      </div>
      <span className="category-count">{recentCount ?? 0}</span>
    </button>
  );
}

// Custom Group button with reactive channel count
interface CustomGroupButtonProps {
  group: CustomGroup;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  onContextMenu: (e: React.MouseEvent, groupId: string) => void;
}
function CustomGroupButton({ group, selectedCategoryId, onSelectCategory, onContextMenu }: CustomGroupButtonProps) {
  const channelCount = useLiveQuery(
    () => db.customGroupChannels.where('group_id').equals(group.group_id).count(),
    [group.group_id]
  );

  return (
    <button
      className={`category-item category-list-bar custom-group-item ${selectedCategoryId === group.group_id ? 'selected' : ''}`}
      onClick={() => onSelectCategory(group.group_id)}
      onContextMenu={(e) => onContextMenu(e, group.group_id)}
    >
      <div className="category-item-left">
        <span className="category-icon custom-group-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <ScrollingText className="category-name">{group.name}</ScrollingText>
      </div>
      <span className="category-count">{channelCount ?? 0}</span>
    </button>
  );
}

function PlaylistCategoryLinkItem({
  link,
  selectedCategoryId,
  onSelectCategory,
  displayName,
  channelCount,
}: {
  link: PlaylistCategoryLink;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  displayName?: string;
  channelCount?: number;
}) {
  const virtualId = `__plcat_${link.id}`;
  
  // Live lookup of category name (bypassed if precomputed)
  const category = useLiveQuery(
    () => displayName !== undefined ? null : db.categories.get(link.category_id),
    [link.category_id, displayName]
  );

  // Live count of channels in this category (bypassed if precomputed)
  const queryChannelCount = useLiveQuery(
    async () => {
      if (channelCount !== undefined) return channelCount;
      let count = 0;
      if (link.source_id !== 'custom') {
        const rows = await db.channels.whereRaw(
          `source_id = ? AND EXISTS (SELECT 1 FROM json_each(category_ids) WHERE value = ?) AND (enabled IS NULL OR enabled NOT IN (0, '0', 'false'))`,
          [link.source_id, link.category_id]
        ).toArray();
        count += rows.length;
      }
      let manualCount = await db.playlistIndividualChannels
        .whereRaw('playlist_id = ? AND parent_category_id = ?', [link.playlist_id, `link:${link.id}`])
        .count();
      if (manualCount === 0) {
        manualCount = await db.playlistIndividualChannels
          .whereRaw('playlist_id = ? AND parent_category_id = ?', [link.source_id, link.category_id])
          .count();
      }
      return count + manualCount;
    },
    [link.source_id, link.category_id, link.playlist_id, link.id, channelCount],
    0
  );

  const finalName = displayName !== undefined ? displayName : (link.custom_name || category?.alias || category?.category_name || link.category_id);
  const finalCount = channelCount !== undefined ? channelCount : (queryChannelCount ?? 0);

  return (
    <button
      className={`category-item nested playlist-cat-item ${selectedCategoryId === virtualId ? 'selected' : ''}`}
      onClick={() => onSelectCategory(virtualId)}
    >
      <ScrollingText className="category-name">{finalName}</ScrollingText>
      <span className="category-count">{finalCount}</span>
    </button>
  );
}



export function CategoryStrip({ selectedCategoryId, onSelectCategory, visible, onEditSource, onClose, onShow, isLiveTV }: CategoryStripProps) {
  const groupedCategories = useCategoriesBySource();
  const categorySortOrder = useCategorySortOrder();
  const includeAllChannelsToPlaylist = useIncludeAllChannelsToPlaylist();
  const [sortOverridesVersion, setSortOverridesVersion] = useState(0);

  useEffect(() => {
    const handleOverridesChange = () => {
      setSortOverridesVersion(prev => prev + 1);
    };
    window.addEventListener('ynotv:category-sort-overrides-changed', handleOverridesChange);
    return () => {
      window.removeEventListener('ynotv:category-sort-overrides-changed', handleOverridesChange);
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const filteredGroupedCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupedCategories;
    }
    const query = searchQuery.toLowerCase();
    
    return groupedCategories.map(group => {
      // Find categories that match the search query (case insensitive)
      const filteredCategories = group.categories.filter(cat => 
        (cat.alias || cat.category_name).toLowerCase().includes(query)
      );
      
      return {
        ...group,
        categories: filteredCategories
      };
    }).filter(group => group.categories.length > 0); // Only keep groups that have matching categories
  }, [groupedCategories, searchQuery]);

  const [sources, setSources] = useState<Record<string, string>>({});
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const { version } = useSourceVersion(); // Listen for source changes

  // Category visibility settings
  const [showAllChannels, setShowAllChannels] = useState(true);
  const [showFavorites, setShowFavorites] = useState(true);
  const [showWatchlist, setShowWatchlist] = useState(true);
  const [showRecentlyViewed, setShowRecentlyViewed] = useState(true);

  // Listen for setting changes to immediately reflect them
  useEffect(() => {
    const handleCategorySettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        if (customEvent.detail.showAllChannels !== undefined) {
          setShowAllChannels(customEvent.detail.showAllChannels);
        }
        if (customEvent.detail.showFavorites !== undefined) {
          setShowFavorites(customEvent.detail.showFavorites);
        }
        if (customEvent.detail.showWatchlist !== undefined) {
          setShowWatchlist(customEvent.detail.showWatchlist);
        }
        if (customEvent.detail.showRecentlyViewed !== undefined) {
          setShowRecentlyViewed(customEvent.detail.showRecentlyViewed);
        }
      }
    };
    window.addEventListener('ynotv:category-settings-changed', handleCategorySettingsChange);
    return () => {
      window.removeEventListener('ynotv:category-settings-changed', handleCategorySettingsChange);
    };
  }, []);

  // Resizable category sidebar width
  const [categoryWidth, setCategoryWidth] = useState(() => {
    const saved = localStorage.getItem('categoryStripContentWidth');
    return saved ? parseInt(saved) : 240;
  });

  // Set CSS custom property for layout
  useEffect(() => {
    document.documentElement.style.setProperty('--category-strip-content-width', `${categoryWidth}px`);
  }, [categoryWidth]);

  // Track mouse position for hover-to-show sidebar button
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);

  // Calculate if mouse is in the "middle left" area (center 40% of screen height, within 40px of left edge)
  const isInMiddleLeftZone = useMemo(() => {
    const windowHeight = window.innerHeight;
    const middleStart = windowHeight * 0.3; // 30% from top
    const middleEnd = windowHeight * 0.7;   // 70% from top (30% from bottom)
    const isInVerticalZone = mouseY >= middleStart && mouseY <= middleEnd;
    const isNearLeftEdge = mouseX <= 50; // Within 50px of left edge
    return isNearLeftEdge && isInVerticalZone && !visible && isLiveTV;
  }, [mouseX, mouseY, visible, isLiveTV]);

  // Calculate if mouse is near left edge but NOT in the middle zone (for hint)
  const isNearLeftEdgeOutsideMiddle = useMemo(() => {
    const windowHeight = window.innerHeight;
    const middleStart = windowHeight * 0.3;
    const middleEnd = windowHeight * 0.7;
    const isOutsideVerticalZone = mouseY < middleStart || mouseY > middleEnd;
    const isNearLeftEdge = mouseX <= 50;
    return isNearLeftEdge && isOutsideVerticalZone && !visible && isLiveTV;
  }, [mouseX, mouseY, visible, isLiveTV]);

  // Handle mouse movement globally when sidebar is hidden
  useEffect(() => {
    if (!visible && isLiveTV) {
      const handleMouseMove = (e: MouseEvent) => {
        setMouseX(e.clientX);
        setMouseY(e.clientY);
      };

      document.addEventListener('mousemove', handleMouseMove);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [visible, isLiveTV]);

  // Custom Groups additions
  const { showModal, showConfirm, showPrompt, ModalComponent } = useModal();
  const [managingGroup, setManagingGroup] = useState<{ id: string, name: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, groupId: string } | null>(null);
  const [isCreateOptionModalOpen, setIsCreateOptionModalOpen] = useState(false);

  // Custom Playlists states
  const [expandedPlaylists, setExpandedPlaylists] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('ynotv:expandedPlaylists');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [playlistContextMenu, setPlaylistContextMenu] = useState<{
    x: number; y: number; playlistId: string; playlistName: string
  } | null>(null);
  const [editingPlaylist, setEditingPlaylist] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    localStorage.setItem('ynotv:expandedPlaylists', JSON.stringify(expandedPlaylists));
  }, [expandedPlaylists]);

  const handleTogglePlaylist = (playlistId: string) => {
    setExpandedPlaylists(prev => ({ ...prev, [playlistId]: !prev[playlistId] }));
  };

  const handleCreatePlaylist = () => {
    showPrompt(
      'New Custom Playlist',
      'Enter a name for the new playlist:',
      async (name) => {
        if (name.trim()) {
          const { createPlaylist } = await import('../services/playlist-editor');
          const id = await createPlaylist(name.trim());
          setExpandedPlaylists(prev => ({ ...prev, [id]: true }));
          setEditingPlaylist({ id, name: name.trim() });
        }
      },
      undefined,
      'Playlist name...',
      '',
      'Create',
      'Cancel'
    );
  };

  const handleDeletePlaylist = (playlistId: string) => {
    showConfirm(
      'Delete Playlist',
      'Are you sure you want to delete this custom playlist? This cannot be undone.',
      async () => {
        const { deletePlaylist } = await import('../services/playlist-editor');
        await deletePlaylist(playlistId);
        if (selectedCategoryId?.startsWith('__plcat_') || 
            selectedCategoryId?.startsWith('__plindiv_')) {
          onSelectCategory(null);
        }
      }
    );
  };

  const handlePlaylistContextMenu = (e: React.MouseEvent, playlistId: string, playlistName: string) => {
    e.preventDefault();
    setPlaylistContextMenu({ x: e.clientX, y: e.clientY, playlistId, playlistName });
  };

  // Source Context Menu additions
  const [sourceContextMenu, setSourceContextMenu] = useState<{ x: number, y: number, sourceId: string, sourceName: string } | null>(null);
  const [managingCategorySource, setManagingCategorySource] = useState<{ id: string, name: string } | null>(null);
  const [epgEditorSource, setEpgEditorSource] = useState<{ id: string, name: string } | null>(null);

  // Favorites Context Menu additions
  const [favoritesContextMenu, setFavoritesContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [managingFavorites, setManagingFavorites] = useState(false);

  // Recently Viewed Context Menu additions
  const [recentContextMenu, setRecentContextMenu] = useState<{ x: number, y: number } | null>(null);

  // Generic Sidebar Item Context Menu additions
  const [genericSidebarContextMenu, setGenericSidebarContextMenu] = useState<{ x: number, y: number, type: 'all' | 'watchlist', title: string } | null>(null);

  const handleSidebarItemHide = async (type: 'all' | 'watchlist' | 'favorites' | 'recent') => {
    let settingKey: string;
    if (type === 'all') {
      settingKey = 'showAllChannels';
      setShowAllChannels(false);
    } else if (type === 'watchlist') {
      settingKey = 'showWatchlist';
      setShowWatchlist(false);
    } else if (type === 'favorites') {
      settingKey = 'showFavorites';
      setShowFavorites(false);
    } else {
      settingKey = 'showRecentlyViewed';
      setShowRecentlyViewed(false);
    }

    if (window.storage) {
      await window.storage.updateSettings({ [settingKey]: false });
    }
    window.dispatchEvent(new CustomEvent('ynotv:category-settings-changed', {
      detail: { [settingKey]: false }
    }));
  };

  // Category Context Menu additions
  const [categoryContextMenu, setCategoryContextMenu] = useState<{ x: number, y: number, categoryId: string, categoryName: string, sourceId: string, sourceName: string } | null>(null);

  const customGroups = useLiveQuery(
    () => db.customGroups.orderBy('display_order').toArray()
  );

  // Load all custom playlists ordered by display_order
  const customPlaylists = useLiveQuery(
    () => db.customPlaylists.orderBy('display_order').toArray(),
    [],
    [],
    0,
    'custom_playlists'
  );

  // Load all playlist category links
  const allPlaylistCategoryLinks = useLiveQuery(
    () => db.playlistCategoryLinks.toArray(),
    [],
    [],
    0,
    'playlist_category_links'
  );

  // Load all categories for link name mapping
  const allCategoriesList = useLiveQuery(
    () => db.categories.toArray(),
    [],
    []
  );

  const categoryNamesMap = useMemo(() => {
    const map = new Map<string, string>();
    if (allCategoriesList) {
      for (const cat of allCategoriesList) {
        map.set(cat.category_id, cat.alias || cat.category_name);
      }
    }
    return map;
  }, [allCategoriesList]);

  // Load flat playlist individual channel counts (where parent_category_id is NULL)
  const flatPlaylistIndividualCounts = useLiveQuery(
    async () => {
      const all = await db.playlistIndividualChannels.toArray();
      const counts = new Map<string, number>();
      for (const item of all) {
        if (!item.parent_category_id) {
          counts.set(item.playlist_id, (counts.get(item.playlist_id) || 0) + 1);
        }
      }
      return counts;
    },
    [],
    new Map(),
    0,
    'playlist_individual_channels'
  );

  // Load total playlist individual channel counts (all of them)
  const totalPlaylistIndividualCounts = useLiveQuery(
    async () => {
      const all = await db.playlistIndividualChannels.toArray();
      const counts = new Map<string, number>();
      for (const item of all) {
        counts.set(item.playlist_id, (counts.get(item.playlist_id) || 0) + 1);
      }
      return counts;
    },
    [],
    new Map(),
    0,
    'playlist_individual_channels'
  );

  // Load manual nested channel counts grouped by parent_category_id
  const manualCategoryChannelCounts = useLiveQuery(
    async () => {
      const all = await db.playlistIndividualChannels.toArray();
      const links = await db.playlistCategoryLinks.toArray();
      
      const streamIds = all.map(item => item.stream_id);
      const channels = streamIds.length > 0 ? await db.channels.where('stream_id').anyOf(streamIds).toArray() : [];
      const channelMap = new Map(channels.map(ch => [ch.stream_id, ch]));

      const counts = new Map<string, number>();
      for (const item of all) {
        if (item.parent_category_id) {
          let targetSourceId: string | null = null;
          let targetCategoryId: string | null = null;

          if (item.parent_category_id.startsWith('link:')) {
            const linkId = parseInt(item.parent_category_id.replace('link:', ''), 10);
            const link = links.find(l => l.id === linkId);
            if (link) {
              targetSourceId = link.source_id;
              targetCategoryId = link.category_id;
            }
          } else {
            targetSourceId = item.playlist_id;
            targetCategoryId = item.parent_category_id;
          }

          const ch = channelMap.get(item.stream_id);
          const isCustomCategory = targetSourceId === 'custom';
          const isNative = !isCustomCategory && targetSourceId && targetCategoryId && ch && ch.source_id === targetSourceId && parseCategoryIds(ch.category_ids).includes(targetCategoryId);

          if (!isNative) {
            const key = `${item.playlist_id}:${item.parent_category_id}`;
            counts.set(key, (counts.get(key) || 0) + 1);
          }
        }
      }
      // Add inherited counts for links that do not have custom overrides
      for (const link of links) {
        const linkKey = `${link.playlist_id}:link:${link.id}`;
        if (!counts.has(linkKey) || counts.get(linkKey) === 0) {
          const targetKey = `${link.source_id}:${link.category_id}`;
          const targetCount = counts.get(targetKey) || 0;
          if (targetCount > 0) {
            counts.set(linkKey, targetCount);
          }
        }
      }
      return counts;
    },
    [],
    new Map<string, number>()
  );

  interface SidebarSourceItem {
    id: string;
    type: 'real' | 'playlist';
    name: string;
    count: number;
    realGroup?: typeof filteredGroupedCategories[0];
    playlistGroup?: CustomPlaylist;
  }

  // Load unified sidebar order from preference
  const sidebarOrderPref = useLiveQuery(
    () => db.prefs.get('sidebar_sources_order'),
    []
  );

  const sidebarSourcesOrder = useMemo(() => {
    if (!sidebarOrderPref?.value) return null;
    try {
      return JSON.parse(sidebarOrderPref.value) as string[];
    } catch {
      return null;
    }
  }, [sidebarOrderPref]);

  const categoryChannelCounts = useMemo(() => {
    const catCounts = new Map<string, number>();
    if (!filteredGroupedCategories) return catCounts;
    for (const g of filteredGroupedCategories) {
      for (const cat of g.categories) {
        catCounts.set(cat.category_id, cat.channelCount);
      }
    }
    return catCounts;
  }, [filteredGroupedCategories]);

  const combinedSources = useMemo(() => {
    const list: SidebarSourceItem[] = [];
    
    // Add real sources
    for (const group of filteredGroupedCategories) {
      const customLinks = (allPlaylistCategoryLinks || [])
        .filter(l => l.playlist_id === group.sourceId);
      const individualCount = totalPlaylistIndividualCounts?.get(group.sourceId) || 0;
      
      let count = group.categories.reduce((s, cat) => s + cat.channelCount, 0);
      for (const link of customLinks) {
        count += categoryChannelCounts.get(link.category_id) || 0;
      }
      count += individualCount;

      list.push({
        id: group.sourceId,
        type: 'real',
        name: sources[group.sourceId] || 'Loading...',
        count,
        realGroup: group
      });
    }
    
    // Add custom playlists
    if (customPlaylists) {
      for (const playlist of customPlaylists) {
        const playlistLinks = (allPlaylistCategoryLinks || [])
          .filter(l => l.playlist_id === playlist.playlist_id);
        const individualCount = flatPlaylistIndividualCounts?.get(playlist.playlist_id) || 0;
        
        let totalCount = 0;
        for (const link of playlistLinks) {
          const nativeCount = categoryChannelCounts.get(link.category_id) || 0;
          const manualCount = manualCategoryChannelCounts?.get(`${playlist.playlist_id}:link:${link.id}`) || 0;
          totalCount += nativeCount + manualCount;
        }
        totalCount += individualCount;
        
        list.push({
          id: `playlist:${playlist.playlist_id}`,
          type: 'playlist',
          name: playlist.name,
          count: totalCount,
          playlistGroup: playlist
        });
      }
    }
    
    // Sort according to sidebarSourcesOrder if it exists
    if (sidebarSourcesOrder) {
      const orderMap = new Map(sidebarSourcesOrder.map((id, index) => [id, index]));
      list.sort((a, b) => {
        const orderA = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
        const orderB = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
    }
    
    return list;
  }, [filteredGroupedCategories, sources, customPlaylists, allPlaylistCategoryLinks, flatPlaylistIndividualCounts, totalPlaylistIndividualCounts, sidebarSourcesOrder, categoryChannelCounts, manualCategoryChannelCounts]);

  const handleCreateGroup = () => {
    showPrompt(
      'Create Custom Group',
      'Enter a name for the new group:',
      async (name) => {
        if (name.trim()) {
          await createCustomGroup(name.trim());
        }
      },
      undefined, // cancel handler
      'Group name...',
      '', // initial value
      'Create',
      'Cancel'
    );
  };

  const handleDeleteGroup = (groupId: string) => {
    showConfirm(
      'Delete Group',
      'Are you sure you want to delete this custom group?',
      async () => {
        await deleteCustomGroup(groupId);
      }
    );
  };

  const handleContextMenu = (e: React.MouseEvent, groupId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, groupId });
  };

  const handleSourceContextMenu = (e: React.MouseEvent, sourceId: string, sourceName: string) => {
    e.preventDefault();
    setSourceContextMenu({ x: e.clientX, y: e.clientY, sourceId, sourceName });
  };

  const handleFavoritesContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setFavoritesContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRecentContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setRecentContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCategoryContextMenu = (e: React.MouseEvent, categoryId: string, categoryName: string, sourceId: string, sourceName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCategoryContextMenu({ x: e.clientX, y: e.clientY, categoryId, categoryName, sourceId, sourceName });
  };

  const handleHideCategory = async (categoryId: string) => {
    try {
      await updateCategoryEnabled(categoryId, false);
    } catch (err) {
      console.error('[CategoryStrip] Failed to hide category:', err);
    }
  };

  const handleRenameCategory = (categoryId: string, currentName: string) => {
    showPrompt(
      'Rename Category',
      'Enter a new display name for this category:',
      async (newName) => {
        const trimmed = newName.trim();
        if (trimmed && trimmed !== currentName) {
          try {
            await updateCategoryAlias(categoryId, trimmed);
          } catch (err) {
            console.error('[CategoryStrip] Failed to rename category:', err);
          }
        }
      },
      undefined,
      'Category name...',
      currentName,
      'Rename',
      'Cancel',
      false
    );
  };

  // ── Drag-to-resize for category sidebar ───────────────────────────────────
  const isResizingCategory = useRef(false);
  const isFirstLoad = useRef(true);

  const handleCategoryResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingCategory.current = true;

    const startX = e.clientX;
    const startWidth = categoryWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingCategory.current) return;
      const dx = moveEvent.clientX - startX;
      let newWidth = startWidth + dx;
      newWidth = Math.max(180, Math.min(newWidth, 500));
      document.documentElement.style.setProperty('--category-strip-content-width', `${newWidth}px`);
    };

    const handleMouseUp = () => {
      if (!isResizingCategory.current) return;
      isResizingCategory.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      const finalWidthStr = getComputedStyle(document.documentElement).getPropertyValue('--category-strip-content-width');
      const finalWidth = parseInt(finalWidthStr) || 240;
      setCategoryWidth(finalWidth);
      localStorage.setItem('categoryStripContentWidth', String(finalWidth));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [categoryWidth]);

  const handleCategoryResizeContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCategoryWidth(240);
    localStorage.setItem('categoryStripContentWidth', '240');
    document.documentElement.style.setProperty('--category-strip-content-width', '240px');
  }, []);

  // Fetch source names to resolve IDs
  useEffect(() => {
    async function fetchSources() {
      if (window.storage) {
        // Get settings to check if sources should be collapsed on startup
        const settingsResult = await window.storage.getSettings();
        const collapseOnStartup = settingsResult.data?.collapseSourceCategoriesOnStartup ?? false;
        setShowAllChannels(settingsResult.data?.showAllChannels ?? true);
        setShowFavorites(settingsResult.data?.showFavorites ?? true);
        setShowWatchlist(settingsResult.data?.showWatchlist ?? true);
        setShowRecentlyViewed(settingsResult.data?.showRecentlyViewed ?? true);

        if (collapseOnStartup && isFirstLoad.current) {
          setExpandedPlaylists({});
        }
        isFirstLoad.current = false;
        
        const result = await window.storage.getSources();
        if (result.data) {
          const sourceMap = result.data.reduce((acc: Record<string, string>, s: Source) => {
            acc[s.id] = s.name;
            return acc;
          }, {});
          setSources(sourceMap);

          const sourcesData = result.data;

          // Initialize new sources as expanded or collapsed based on setting
          setExpandedSources(prev => {
            const next = { ...prev };
            sourcesData.forEach((s: Source) => {
              if (next[s.id] === undefined) {
                next[s.id] = !collapseOnStartup; // false if collapseOnStartup is true
              }
            });
            return next;
          });
        }
      }
    }
    fetchSources();
  }, [version]); // Re-fetch when version changes

  // Toggle expansion for a source
  const toggleSource = (sourceId: string) => {
    setExpandedSources(prev => ({
      ...prev,
      [sourceId]: !prev[sourceId]
    }));
  };

  // Calculate total channel count for "All" option
  const totalChannels = groupedCategories.reduce((sum, group) =>
    sum + group.categories.reduce((s, cat) => s + cat.channelCount, 0), 0
  );

  return (
    <>
      <div className={`category-strip ${visible ? 'visible' : 'hidden'}`}>
        {/* Resizer Handle */}
        <div
          className="category-strip-resizer"
          onMouseDown={handleCategoryResizeMouseDown}
          onContextMenu={handleCategoryResizeContextMenu}
          title="Drag to resize sidebar | Right-click to reset"
        />
        <div className="category-strip-header">
          <span className="category-strip-title">Categories</span>
          <div className="category-strip-actions">
            <button
              className="add-group-btn"
              onClick={() => setIsCreateOptionModalOpen(true)}
              title="Create Custom Group / Playlist"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            {onClose && (
              <button
                className="guide-nav-btn"
                onClick={onClose}
                title="Hide Sidebar"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="category-search-container">
          <div className={`category-search-input-wrapper ${searchFocused ? 'focused' : ''}`}>
            <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="category-search-input"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
                ✕
              </button>
            )}
          </div>
        </div>

      <div className="category-strip-top">
        {/* "All Channels" option */}
        {showAllChannels && (
          <button
            className={`category-item category-list-bar ${selectedCategoryId === null ? 'selected' : ''}`}
            onClick={() => onSelectCategory(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setGenericSidebarContextMenu({ x: e.clientX, y: e.clientY, type: 'all', title: 'All Channels' });
            }}
          >
            <div className="category-item-left">
              <span className="category-icon all-channels-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
                  <polyline points="17 2 12 7 7 2" />
                </svg>
              </span>
              <ScrollingText className="category-name">All Channels</ScrollingText>
            </div>
            <span className="category-count">{totalChannels}</span>
          </button>
        )}

        {/* "Favorites" option */}
        {showFavorites && (
          <FavoritesButton
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={onSelectCategory}
            onContextMenu={handleFavoritesContextMenu}
          />
        )}

        {/* "Watchlist" option */}
        {showWatchlist && (
          <WatchlistButton
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={onSelectCategory}
            onContextMenu={(e) => {
              e.preventDefault();
              setGenericSidebarContextMenu({ x: e.clientX, y: e.clientY, type: 'watchlist', title: 'Watchlist' });
            }}
          />
        )}

        {/* "Recently Viewed" option */}
        {showRecentlyViewed && (
          <RecentlyViewedButton
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={onSelectCategory}
            onContextMenu={handleRecentContextMenu}
          />
        )}

        {/* Custom Groups Section */}
        {customGroups && customGroups.length > 0 && (
          <div className="custom-groups-section">
            {customGroups.map(group => (
              <CustomGroupButton
                key={group.group_id}
                group={group}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={onSelectCategory}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        )}

      </div>

      <div className="category-strip-scrollable">
        {combinedSources.map((item, index) => {
          if (item.type === 'real' && item.realGroup) {
            const group = item.realGroup;
            const isExpanded = expandedSources[group.sourceId] || searchQuery.trim().length > 0;
            return (
              <div 
                key={group.sourceId} 
                className={`category-source-group ${isExpanded ? 'is-expanded' : ''}`}
              >
                <button
                  className="category-source-header"
                  onClick={() => toggleSource(group.sourceId)}
                  onContextMenu={(e) => handleSourceContextMenu(e, group.sourceId, sources[group.sourceId] || 'Source')}
                >
                  <div className="source-header-left">
                    <ChevronIcon expanded={isExpanded} />
                    <div className="source-name-container">
                      <ScrollingText className="source-name">{sources[group.sourceId] || 'Loading...'}</ScrollingText>
                    </div>
                  </div>
                  <span className="source-count">{item.count}</span>
                </button>

                {isExpanded && (
                  <div className="category-source-content">
                    {(() => {
                      interface UnifiedSidebarCat {
                        id: string;
                        type: 'native' | 'link';
                        name: string;
                        count: number;
                        displayOrder: number;
                        nativeCat?: typeof group.categories[0];
                        customLink?: PlaylistCategoryLink;
                      }
                      
                      const list: UnifiedSidebarCat[] = [];
                      
                      // Add native categories
                      for (const cat of group.categories) {
                        const manualCount = manualCategoryChannelCounts?.get(`${group.sourceId}:${cat.category_id}`) || 0;
                        list.push({
                          id: cat.category_id,
                          type: 'native',
                          name: cat.alias || cat.category_name,
                          count: cat.channelCount + manualCount,
                          displayOrder: cat.display_order ?? 0,
                          nativeCat: cat
                        });
                      }
                      
                      // Add custom links
                      const customLinks = (allPlaylistCategoryLinks || [])
                        .filter(l => l.playlist_id === group.sourceId);
                      for (const link of customLinks) {
                        const nativeCount = categoryChannelCounts.get(link.category_id) || 0;
                        const manualCount = manualCategoryChannelCounts?.get(`${group.sourceId}:link:${link.id}`) || 0;
                        list.push({
                          id: `link:${link.id}`,
                          type: 'link',
                          name: link.custom_name || (categoryNamesMap.get(link.category_id) || link.category_id),
                          count: nativeCount + manualCount,
                          displayOrder: link.display_order ?? 0,
                          customLink: link
                        });
                      }
                      
                      // Sort
                      const isAlphabetical = categorySortOrder === 'alphabetical' && !isCategorySortCustomized(group.sourceId);
                      if (isAlphabetical) {
                        list.sort((a, b) => a.name.localeCompare(b.name));
                      } else {
                        list.sort((a, b) => {
                          if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
                          return a.name.localeCompare(b.name);
                        });
                      }
                      
                      const individualCount = flatPlaylistIndividualCounts?.get(group.sourceId) || 0;
                      
                       return (
                        <>
                          {includeAllChannelsToPlaylist && (
                            <button
                              key={`__allsrc_${group.sourceId}`}
                              className={`category-item nested ${selectedCategoryId === `__allsrc_${group.sourceId}` ? 'selected' : ''}`}
                              onClick={() => onSelectCategory(`__allsrc_${group.sourceId}`)}
                            >
                              <ScrollingText className="category-name">All Channels</ScrollingText>
                              <span className="category-count">{item.count}</span>
                            </button>
                          )}
                          {list.map(catItem => {
                            if (catItem.type === 'native' && catItem.nativeCat) {
                              const category = catItem.nativeCat;
                              return (
                                <button
                                  key={category.category_id}
                                  className={`category-item nested ${selectedCategoryId === category.category_id ? 'selected' : ''}`}
                                  onClick={() => onSelectCategory(category.category_id)}
                                  onContextMenu={(e) => handleCategoryContextMenu(e, category.category_id, category.alias || category.category_name, group.sourceId, sources[group.sourceId] || 'Source')}
                                >
                                  <ScrollingText className="category-name">{category.alias || category.category_name}</ScrollingText>
                                  <span className="category-count">{catItem.count}</span>
                                </button>
                              );
                            } else if (catItem.type === 'link' && catItem.customLink) {
                              return (
                                <PlaylistCategoryLinkItem
                                  key={catItem.id}
                                  link={catItem.customLink}
                                  selectedCategoryId={selectedCategoryId}
                                  onSelectCategory={onSelectCategory}
                                  displayName={catItem.name}
                                  channelCount={catItem.count}
                                />
                              );
                            }
                            return null;
                          })}
                          
                          {individualCount > 0 && (
                            <button
                              className={`category-item nested playlist-indiv-item ${
                                selectedCategoryId === `__plindiv_${group.sourceId}` ? 'selected' : ''
                              }`}
                              onClick={() => onSelectCategory(`__plindiv_${group.sourceId}`)}
                            >
                              <ScrollingText className="category-name">Individual Channels</ScrollingText>
                              <span className="category-count">{individualCount}</span>
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          } else if (item.type === 'playlist' && item.playlistGroup) {
            const playlist = item.playlistGroup;
            const isExpanded = !!expandedPlaylists[playlist.playlist_id];
            const getLinkName = (link: PlaylistCategoryLink) => {
              return link.custom_name || (categoryNamesMap.get(link.category_id) || link.category_id);
            };

            const playlistLinks = (allPlaylistCategoryLinks || [])
              .filter(l => l.playlist_id === playlist.playlist_id);

            const isAlphabetical = categorySortOrder === 'alphabetical' && !isCategorySortCustomized(playlist.playlist_id);

            if (isAlphabetical) {
              playlistLinks.sort((a, b) => {
                const nameA = getLinkName(a);
                const nameB = getLinkName(b);
                return nameA.localeCompare(nameB);
              });
            } else {
              playlistLinks.sort((a, b) => a.display_order - b.display_order);
            }

            const individualCount = flatPlaylistIndividualCounts?.get(playlist.playlist_id) || 0;

            return (
              <div 
                key={playlist.playlist_id} 
                className={`category-source-group playlist-source-group ${isExpanded ? 'is-expanded' : ''}`}
              >
                <button
                  className="category-source-header playlist-source-header"
                  onClick={() => handleTogglePlaylist(playlist.playlist_id)}
                  onContextMenu={(e) => handlePlaylistContextMenu(e, playlist.playlist_id, playlist.name)}
                >
                  <div className="source-header-left">
                    <ChevronIcon expanded={isExpanded} />
                    <div className="source-name-container">
                      <ScrollingText className="source-name">{playlist.name}</ScrollingText>
                    </div>
                  </div>
                  <span className="source-count">{item.count}</span>
                </button>

                {isExpanded && (
                  <div className="category-source-content">
                    {includeAllChannelsToPlaylist && (
                      <button
                        key={`__allsrc_pl_${playlist.playlist_id}`}
                        className={`category-item nested ${selectedCategoryId === `__allsrc_pl_${playlist.playlist_id}` ? 'selected' : ''}`}
                        onClick={() => onSelectCategory(`__allsrc_pl_${playlist.playlist_id}`)}
                      >
                        <ScrollingText className="category-name">All Channels</ScrollingText>
                        <span className="category-count">{item.count}</span>
                      </button>
                    )}
                    {playlistLinks.map(link => {
                      const nativeCount = categoryChannelCounts.get(link.category_id) || 0;
                      const manualCount = manualCategoryChannelCounts?.get(`${playlist.playlist_id}:link:${link.id}`) || 0;
                      const count = nativeCount + manualCount;
                      const name = link.custom_name || (categoryNamesMap.get(link.category_id) || link.category_id);
                      return (
                        <PlaylistCategoryLinkItem
                          key={link.id}
                          link={link}
                          selectedCategoryId={selectedCategoryId}
                          onSelectCategory={onSelectCategory}
                          displayName={name}
                          channelCount={count}
                        />
                      );
                    })}

                    {individualCount > 0 && (
                      <button
                        className={`category-item nested playlist-indiv-item ${
                          selectedCategoryId === `__plindiv_${playlist.playlist_id}` ? 'selected' : ''
                        }`}
                        onClick={() => onSelectCategory(`__plindiv_${playlist.playlist_id}`)}
                      >
                        <ScrollingText className="category-name">Individual Channels</ScrollingText>
                        <span className="category-count">{individualCount}</span>
                      </button>
                    )}

                    {playlistLinks.length === 0 && individualCount === 0 && (
                      <div className="playlist-empty-hint">
                        <span>Empty playlist</span>
                        <button 
                          className="playlist-edit-link"
                          onClick={() => setEditingPlaylist({ id: playlist.playlist_id, name: playlist.name })}
                        >
                          Edit Playlist
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }
          return null;
        })}

        {filteredGroupedCategories.length === 0 && (!customPlaylists || customPlaylists.length === 0) && (
          <div className="category-empty">
            <p>No categories yet</p>
            <p className="hint">Add a source in Settings</p>
          </div>
        )}
      </div>

      <ModalComponent />

      <CreateCustomOptionModal
        isOpen={isCreateOptionModalOpen}
        onClose={() => setIsCreateOptionModalOpen(false)}
        onCreateGroup={async (name) => {
          await createCustomGroup(name);
        }}
        onCreatePlaylist={async (name) => {
          const { createPlaylist } = await import('../services/playlist-editor');
          const id = await createPlaylist(name);
          setExpandedPlaylists(prev => ({ ...prev, [id]: true }));
          setEditingPlaylist({ id, name });
        }}
      />

      {managingGroup && (
        <CustomGroupManager
          groupId={managingGroup.id}
          groupName={managingGroup.name}
          onClose={() => setManagingGroup(null)}
        />
      )}

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 2000,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--surface-border)',
            borderRadius: '6px',
            padding: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}
        >
          <div
            onClick={() => {
              const grp = customGroups?.find(g => g.group_id === contextMenu.groupId);
              if (grp) setManagingGroup({ id: grp.group_id, name: grp.name });
              setContextMenu(null);
            }}
            style={{ padding: '8px 12px', cursor: 'pointer', color: 'var(--text-primary)' }}
          >
            Manage
          </div>
          <div
            onClick={() => {
              handleDeleteGroup(contextMenu.groupId);
              setContextMenu(null);
            }}
            style={{ padding: '8px 12px', cursor: 'pointer', color: 'var(--status-live)' }}
          >
            Delete
          </div>

          {/* Overlay to close menu on click outside */}
          <div
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}
            onClick={() => setContextMenu(null)}
          />
        </div>
      )}

      {sourceContextMenu && (
        <SourceContextMenu
          sourceId={sourceContextMenu.sourceId}
          sourceName={sourceContextMenu.sourceName}
          position={{ x: sourceContextMenu.x, y: sourceContextMenu.y }}
          onClose={() => setSourceContextMenu(null)}
          onManageCategories={(id, name) => setManagingCategorySource({ id, name })}
          onEditSource={(id) => {
            if (onEditSource) {
              onEditSource(id);
            }
          }}
          onEditEpg={(id, name) => setEpgEditorSource({ id, name })}
        />
      )}

      {/* Playlist Context Menu */}
      {playlistContextMenu && (
        <PlaylistContextMenu
          playlistId={playlistContextMenu.playlistId}
          playlistName={playlistContextMenu.playlistName}
          position={{ x: playlistContextMenu.x, y: playlistContextMenu.y }}
          onClose={() => setPlaylistContextMenu(null)}
          onEditContents={() => {
            setEditingPlaylist({ id: playlistContextMenu.playlistId, name: playlistContextMenu.playlistName });
          }}
          onExportM3u={async () => {
            try {
              const { generateM3uForPlaylist } = await import('../services/playlist-export');
              const content = await generateM3uForPlaylist(playlistContextMenu.playlistId);
              const result = await window.storage.saveM3UFile(content, playlistContextMenu.playlistName);
              if (result.success) {
                alert('Playlist exported successfully!');
              }
            } catch (err) {
              console.error('[CategoryStrip] M3U export failed:', err);
              alert('Export failed: ' + String(err));
            }
          }}
          onRename={() => {
            showPrompt(
              'Rename Playlist',
              'Enter a new name:',
              async (newName) => {
                if (newName.trim()) {
                  const { renamePlaylist } = await import('../services/playlist-editor');
                  await renamePlaylist(playlistContextMenu.playlistId, newName.trim());
                }
              },
              undefined, 'New name...', playlistContextMenu.playlistName, 'Rename', 'Cancel'
            );
          }}
          onDelete={() => {
            handleDeletePlaylist(playlistContextMenu.playlistId);
          }}
        />
      )}

      {/* Playlist Editor Modal */}
      {editingPlaylist && (
        <PlaylistEditorModal
          playlistId={editingPlaylist.id}
          playlistName={editingPlaylist.name}
          onClose={() => setEditingPlaylist(null)}
        />
      )}

      {/* Category Context Menu */}
      {categoryContextMenu && (
        <CategoryContextMenu
          categoryId={categoryContextMenu.categoryId}
          categoryName={categoryContextMenu.categoryName}
          sourceId={categoryContextMenu.sourceId}
          sourceName={categoryContextMenu.sourceName}
          position={{ x: categoryContextMenu.x, y: categoryContextMenu.y }}
          onClose={() => setCategoryContextMenu(null)}
          onManageCategories={(id, name) => setManagingCategorySource({ id, name })}
          onHideCategory={handleHideCategory}
          onRenameCategory={handleRenameCategory}
        />
      )}

      {/* Favorites Context Menu */}
      {favoritesContextMenu && (
        <FavoritesContextMenu
          position={{ x: favoritesContextMenu.x, y: favoritesContextMenu.y }}
          onClose={() => setFavoritesContextMenu(null)}
          onManageFavorites={() => setManagingFavorites(true)}
          onHide={() => handleSidebarItemHide('favorites')}
        />
      )}

      {/* Recently Viewed Context Menu */}
      {recentContextMenu && (
        <RecentChannelsContextMenu
          position={{ x: recentContextMenu.x, y: recentContextMenu.y }}
          onClose={() => setRecentContextMenu(null)}
          onClearRecent={() => {
            showConfirm(
              'Clear Recent Channels',
              'Are you sure you want to clear your Recently Viewed channels list?',
              () => {
                clearRecentChannels();
                if (selectedCategoryId === '__recent__') {
                  onSelectCategory(null);
                }
              }
            );
          }}
          onHide={() => handleSidebarItemHide('recent')}
        />
      )}

      {/* Generic Sidebar Context Menu */}
      {genericSidebarContextMenu && (
        <SidebarItemContextMenu
          position={{ x: genericSidebarContextMenu.x, y: genericSidebarContextMenu.y }}
          title={genericSidebarContextMenu.title}
          onClose={() => setGenericSidebarContextMenu(null)}
          onHide={() => handleSidebarItemHide(genericSidebarContextMenu.type)}
        />
      )}

      {/* Favorite Manager Modal */}
      {managingFavorites && (
        <FavoriteManager
          onClose={() => setManagingFavorites(false)}
          onChange={() => {
            // Refresh categories - the useChannels hook will pick up the new order
          }}
        />
      )}

      {/* Category Manager Modal overlaying the app native to CategoryStrip entirely */}
      {managingCategorySource && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'var(--bg-primary)' }}>
          <CategoryManager
            sourceId={managingCategorySource.id}
            sourceName={managingCategorySource.name}
            onClose={() => setManagingCategorySource(null)}
            onChange={() => {
              // The DB sync finishes naturally, updating the live hook automatically down the road
            }}
          />
        </div>
      )}

      {/* EPG Editor Modal — opened from source right-click */}
      {epgEditorSource && (
        <EpgEditorModal
          sourceId={epgEditorSource.id}
          sourceName={epgEditorSource.name}
          onClose={() => setEpgEditorSource(null)}
        />
      )}
      </div>

      {/* Sidebar hint - subtle indicator when hovering left edge outside middle zone */}
      {isNearLeftEdgeOutsideMiddle && (
        <div
          className="sidebar-hint-indicator"
          style={{
            position: 'fixed',
            left: 0,
            top: mouseY - 15,
            width: '3px',
            height: '30px',
            background: 'var(--accent-primary, rgba(0, 212, 255, 0.4))',
            borderRadius: '0 3px 3px 0',
            zIndex: 109,
            pointerEvents: 'none',
            transition: 'opacity 0.2s ease',
          }}
        />
      )}

      {/* Show Sidebar Button - visible when sidebar is hidden, in LiveTV, and hovering middle-left */}
      {!visible && onShow && isLiveTV && (
        <button
          className={`show-sidebar-btn ${isInMiddleLeftZone ? 'visible' : ''}`}
          onClick={onShow}
          onMouseEnter={() => {
            // Ensure button stays visible when hovering over it
            setMouseX(25);
          }}
          title="Show Sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      )}
    </>
  );
}

interface SidebarItemContextMenuProps {
  position: { x: number; y: number };
  title: string;
  onClose: () => void;
  onHide: () => void;
}

function SidebarItemContextMenu({ position, title, onClose, onHide }: SidebarItemContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useLayoutEffect(() => {
    if (menuRef.current) {
      const menu = menuRef.current;
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      const isBottomHalf = position.y > viewportHeight / 2;
      if (isBottomHalf) {
        y = position.y - menuHeight;
      }

      if (x + menuWidth > viewportWidth) x = viewportWidth - menuWidth - 10;
      if (x < 10) x = 10;

      if (y + menuHeight > viewportHeight) y = viewportHeight - menuHeight - 10;
      if (y < 10) y = 10;

      setAdjustedPosition({ x, y });
    }
  }, [position]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="program-context-menu"
      style={{ left: `${adjustedPosition.x}px`, top: `${adjustedPosition.y}px` }}
    >
      <div className="context-menu-header" style={{ padding: '8px 12px 4px', fontSize: '11px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {title}
      </div>
      <div className="context-menu-item" onClick={() => { onHide(); onClose(); }}>
        🚫 Hide Category
      </div>
    </div>,
    document.body
  );
}

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLiveQuery } from '../hooks/useSqliteLiveQuery';
import { useCategoriesBySource, type CategoryWithCount, type SourceWithCategories } from '../hooks/useChannels';
import { db, getWatchlistCount, type CustomGroup, updateCategoryEnabled, updateCategoryAlias } from '../db';
import type { Source } from '@ynotv/core';
import { useSourceVersion } from '../contexts/SourceVersionContext';
import { normalizeBoolean } from '../utils/db-helpers';
import { useModal } from './Modal';
import { createCustomGroup, deleteCustomGroup } from '../services/custom-groups';
import { CustomGroupManager } from './CustomGroupManager';
import { CategoryManager } from './settings/CategoryManager';
import { FavoriteManager } from './settings/FavoriteManager';
import { SourceContextMenu } from './SourceContextMenu';
import { CategoryContextMenu } from './CategoryContextMenu';
import { FavoritesContextMenu } from './FavoritesContextMenu';
import { RecentChannelsContextMenu } from './RecentChannelsContextMenu';
import { EpgEditorModal } from './EpgEditorModal';
import { clearRecentChannels } from '../utils/recentChannels';
import './CategoryStrip.css';

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
function WatchlistButton({ selectedCategoryId, onSelectCategory }: { selectedCategoryId: string | null; onSelectCategory: (categoryId: string | null) => void }) {
  const watchlistCount = useLiveQuery(
    async () => {
      return await getWatchlistCount();
    }
  );

  return (
    <button
      className={`category-item category-list-bar ${selectedCategoryId === '__watchlist__' ? 'selected' : ''}`}
      onClick={() => onSelectCategory('__watchlist__')}
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



export function CategoryStrip({ selectedCategoryId, onSelectCategory, visible, onEditSource, onClose, onShow, isLiveTV }: CategoryStripProps) {
  const groupedCategories = useCategoriesBySource();
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

  // Source Context Menu additions
  const [sourceContextMenu, setSourceContextMenu] = useState<{ x: number, y: number, sourceId: string, sourceName: string } | null>(null);
  const [managingCategorySource, setManagingCategorySource] = useState<{ id: string, name: string } | null>(null);
  const [epgEditorSource, setEpgEditorSource] = useState<{ id: string, name: string } | null>(null);

  // Favorites Context Menu additions
  const [favoritesContextMenu, setFavoritesContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [managingFavorites, setManagingFavorites] = useState(false);

  // Recently Viewed Context Menu additions
  const [recentContextMenu, setRecentContextMenu] = useState<{ x: number, y: number } | null>(null);

  // Category Context Menu additions
  const [categoryContextMenu, setCategoryContextMenu] = useState<{ x: number, y: number, categoryId: string, categoryName: string, sourceId: string, sourceName: string } | null>(null);

  const customGroups = useLiveQuery(
    () => db.customGroups.orderBy('display_order').toArray()
  );

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
              onClick={handleCreateGroup}
              title="Create Custom Group"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            {onClose && (
              <button
                className="hide-sidebar-btn"
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
        <button
          className={`category-item category-list-bar ${selectedCategoryId === null ? 'selected' : ''}`}
          onClick={() => onSelectCategory(null)}
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

        {/* "Favorites" option */}
        <FavoritesButton
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={onSelectCategory}
          onContextMenu={handleFavoritesContextMenu}
        />

        {/* "Watchlist" option */}
        <WatchlistButton
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={onSelectCategory}
        />

        {/* "Recently Viewed" option */}
        <RecentlyViewedButton
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={onSelectCategory}
          onContextMenu={handleRecentContextMenu}
        />

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
        {/* Grouped Category list */}
        {filteredGroupedCategories.length > 0 && (
          <div className="sidebar-section-header">Sources</div>
        )}
        {filteredGroupedCategories.map((group) => {
          const isExpanded = expandedSources[group.sourceId] || searchQuery.trim().length > 0;
          return (
          <div key={group.sourceId} className={`category-source-group ${isExpanded ? 'is-expanded' : ''}`}>
            <button
              className="category-source-header"
              onClick={() => toggleSource(group.sourceId)}
              onContextMenu={(e) => handleSourceContextMenu(e, group.sourceId, sources[group.sourceId] || 'Source')}
            >
              <div className="source-header-left">
                <ChevronIcon expanded={isExpanded} />
                <span className="source-icon-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                </span>
                <div className="source-name-container">
                  <ScrollingText className="source-name">{sources[group.sourceId] || 'Loading...'}</ScrollingText>
                </div>
              </div>
              <span className="source-count">
                {group.categories.reduce((s, cat) => s + cat.channelCount, 0)}
              </span>
            </button>

            {isExpanded && (
              <div className="category-source-content">
                {group.categories.map((category) => (
                  <button
                    key={category.category_id}
                    className={`category-item nested ${selectedCategoryId === category.category_id ? 'selected' : ''}`}
                    onClick={() => onSelectCategory(category.category_id)}
                    onContextMenu={(e) => handleCategoryContextMenu(e, category.category_id, category.alias || category.category_name, group.sourceId, sources[group.sourceId] || 'Source')}
                  >
                    <div className="category-item-left">
                      <span className="category-hash-icon">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="4" y1="9" x2="20" y2="9"></line>
                          <line x1="4" y1="15" x2="20" y2="15"></line>
                          <line x1="10" y1="3" x2="8" y2="21"></line>
                          <line x1="16" y1="3" x2="14" y2="21"></line>
                        </svg>
                      </span>
                      <ScrollingText className="category-name">{category.alias || category.category_name}</ScrollingText>
                    </div>
                    <span className="category-count">{category.channelCount}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )})}

        {filteredGroupedCategories.length === 0 && (
          <div className="category-empty">
            <p>No categories yet</p>
            <p className="hint">Add a source in Settings</p>
          </div>
        )}
      </div>

      <ModalComponent />

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

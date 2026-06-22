/**
 * VerticalSidebar - Vertical navigation sidebar for VOD pages
 *
 * Features:
 * - Fixed width, full height
 * - Vertical scrolling list of categories
 * - Integrated search input at the top
 * - Back button
 */

import { useMemo, useCallback, useState, useEffect } from 'react';
import './VerticalSidebar.css';

// Chevron Icon for expand/collapse
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg
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

interface Category {
    id: string;
    name: string;
    source_id?: string;
}

export interface VerticalSidebarProps {
    categories: Category[];
    selectedId: string | null; // null = home, 'all' = all, string = category
    onSelect: (id: string | null) => void;
    type?: 'movie' | 'series';
    onBack?: () => void;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
    onSearchSubmit?: () => void;
    onContextMenu?: (e: React.MouseEvent, sourceId: string, sourceName: string) => void;
}

// Icons
const BackArrow = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
);

const MovieIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" />
        <path d="M8 4l0 16" />
        <path d="M16 4l0 16" />
        <path d="M4 8l4 0" />
        <path d="M4 16l4 0" />
        <path d="M4 12l16 0" />
        <path d="M16 8l4 0" />
        <path d="M16 16l4 0" />
        <path d="M16 16l4 0" />
    </svg>
);

const SeriesIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9" />
        <path d="M16 3l-4 4l-4 -4" />
    </svg>
);

const SearchIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
    </svg>
);

const ClearIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

export function VerticalSidebar({
    categories,
    selectedId,
    onSelect,
    type,
    onBack,
    searchQuery = '',
    onSearchChange,
    onSearchSubmit,
    onContextMenu,
}: VerticalSidebarProps) {
    const [sources, setSources] = useState<Record<string, string>>({});
    const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
    const [isV3, setIsV3] = useState(false);

    useEffect(() => {
        setIsV3(document.documentElement.classList.contains('modern-ui-v3'));
    }, []);

    // Fetch sources to resolve names and initialize expanded state
    useEffect(() => {
        async function fetchSources() {
            if (window.storage) {
                const result = await window.storage.getSources();
                if (result.data) {
                    const data = result.data;
                    const sourceMap = data.reduce((acc: Record<string, string>, s: any) => {
                        acc[s.id] = s.name;
                        return acc;
                    }, {});
                    setSources(sourceMap);

                    // Initialize expanded state for sources
                    setExpandedSources(prev => {
                        const next = { ...prev };
                        data.forEach((s: any) => {
                            if (next[s.id] === undefined) {
                                next[s.id] = true; // default expanded
                            }
                        });
                        return next;
                    });
                }
            }
        }
        fetchSources();
    }, []);

    const toggleSource = (sourceId: string) => {
        setExpandedSources(prev => ({
            ...prev,
            [sourceId]: !prev[sourceId]
        }));
    };

    // Process categories: strip prefixes and preserve database / custom order
    const processedCategories = useMemo(() => {
        return categories
            .map((cat) => ({
                ...cat,
                displayName: cat.name
                    ? cat.name.replace(/^(Series|Movies|Movie)-/i, '').trim()
                    : '', // Handle null/undefined names
            }));
    }, [categories]);

    // Group categories by source
    const groupedCategories = useMemo(() => {
        const groups: Record<string, typeof processedCategories> = {};
        const orphans: typeof processedCategories = [];

        for (const cat of processedCategories) {
            if (cat.source_id) {
                if (!groups[cat.source_id]) {
                    groups[cat.source_id] = [];
                }
                groups[cat.source_id].push(cat);
            } else {
                orphans.push(cat);
            }
        }

        // Sort groups by source name
        const sortedGroupEntries = Object.entries(groups).sort(([aId], [bId]) => {
            const nameA = sources[aId] || '';
            const nameB = sources[bId] || '';
            return nameA.localeCompare(nameB);
        });

        return { entries: sortedGroupEntries, orphans };
    }, [processedCategories, sources]);

    // Handle search key down
    const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSearchSubmit?.();
        }
    }, [onSearchSubmit]);

    return (
        <div className="vertical-sidebar">
            {/* Header: Back Button & Title */}
            {!isV3 && (
                <div className="vertical-sidebar__header">
                    {onBack && (
                        <button
                            className="vertical-sidebar__back"
                            onClick={onBack}
                            aria-label="Go back"
                        >
                            <span className="vertical-sidebar__back-arrow">
                                <BackArrow />
                            </span>
                            <span className="vertical-sidebar__back-text">Back</span>
                            <span className="vertical-sidebar__back-icon">
                                {type === 'series' ? <SeriesIcon /> : <MovieIcon />}
                            </span>
                        </button>
                    )}
                </div>
            )}

            {/* Search Bar */}
            {onSearchChange && (
                <div className="vertical-sidebar__search-container">
                    <div className="vertical-sidebar__search">
                        <SearchIcon />
                        <input
                            type="text"
                            placeholder={type === 'series' ? 'Search series...' : 'Search movies...'}
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                        />
                        {searchQuery && (
                            <button
                                className="vertical-sidebar__search-clear"
                                onClick={() => onSearchChange('')}
                                aria-label="Clear search"
                            >
                                <ClearIcon />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Fixed Top Section: Home, All, Recent */}
            <div className="vertical-sidebar__top">
                {isV3 ? (
                    <>
                        {/* Home Link */}
                        <button
                            className={`vertical-sidebar__item category-list-bar ${selectedId === null ? 'active' : ''}`}
                            onClick={() => onSelect(null)}
                        >
                            <div className="category-item-left">
                                <span className="category-icon watchlist-icon">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                        <polyline points="9 22 9 12 15 12 15 22" />
                                    </svg>
                                </span>
                                <span className="category-name">Home</span>
                            </div>
                        </button>

                        {/* All Link */}
                        <button
                            className={`vertical-sidebar__item category-list-bar ${selectedId === 'all' ? 'active' : ''}`}
                            onClick={() => onSelect('all')}
                        >
                            <div className="category-item-left">
                                <span className="category-icon all-channels-icon">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
                                        <polyline points="17 2 12 7 7 2" />
                                    </svg>
                                </span>
                                <span className="category-name">All {type === 'series' ? 'Series' : 'Movies'}</span>
                            </div>
                        </button>

                        {/* Favorites Link */}
                        <button
                            className={`vertical-sidebar__item category-list-bar ${selectedId === 'favorites' ? 'active' : ''}`}
                            onClick={() => onSelect('favorites')}
                        >
                            <div className="category-item-left">
                                <span className="category-icon favorites-icon">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                </span>
                                <span className="category-name">Favorites</span>
                            </div>
                        </button>

                        {/* Recent Link */}
                        <button
                            className={`vertical-sidebar__item category-list-bar ${selectedId === 'recent' ? 'active' : ''}`}
                            onClick={() => onSelect('recent')}
                        >
                            <div className="category-item-left">
                                <span className="category-icon recent-icon">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                </span>
                                <span className="category-name">Recent</span>
                            </div>
                        </button>
                    </>
                ) : (
                    <>
                        {/* Home Link */}
                        <button
                            className={`vertical-sidebar__item ${selectedId === null ? 'active' : ''}`}
                            onClick={() => onSelect(null)}
                        >
                            Home
                        </button>

                        {/* All Link */}
                        <button
                            className={`vertical-sidebar__item ${selectedId === 'all' ? 'active' : ''}`}
                            onClick={() => onSelect('all')}
                        >
                            All {type === 'series' ? 'Series' : 'Movies'}
                        </button>

                        {/* Favorites Link */}
                        <button
                            className={`vertical-sidebar__item ${selectedId === 'favorites' ? 'active' : ''}`}
                            onClick={() => onSelect('favorites')}
                        >
                            Favorites
                        </button>

                        {/* Recent Link */}
                        <button
                            className={`vertical-sidebar__item ${selectedId === 'recent' ? 'active' : ''}`}
                            onClick={() => onSelect('recent')}
                        >
                            Recent
                        </button>
                    </>
                )}
            </div>

            {/* Scrollable Bottom Section: Source Groups */}
            <div className="vertical-sidebar__scrollable">
                {/* Categories grouped by Source */}
                {groupedCategories.entries.map(([sourceId, sourceCats]) => (
                    <div key={sourceId} className={`vertical-sidebar__source-group ${expandedSources[sourceId] ? 'is-expanded' : ''}`}>
                        <button
                            className="vertical-sidebar__source-header"
                            onClick={() => toggleSource(sourceId)}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                onContextMenu?.(e, sourceId, sources[sourceId] || 'Unknown Source');
                            }}
                        >
                            <div className="source-header-left">
                                <ChevronIcon expanded={!!expandedSources[sourceId]} />
                                <span className="source-name">{sources[sourceId] || 'Loading...'}</span>
                            </div>
                            <span className="source-count">{sourceCats.length}</span>
                        </button>

                        {expandedSources[sourceId] && (
                            <div className="vertical-sidebar__source-content">
                                {sourceCats.map((cat) => (
                                    <button
                                        key={cat.id}
                                        className={`vertical-sidebar__item nested ${selectedId === cat.id ? 'active' : ''}`}
                                        onClick={() => onSelect(cat.id)}
                                    >
                                        {cat.displayName}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {/* Orphan Categories (if any) */}
                {groupedCategories.orphans.map((cat) => (
                    <button
                        key={cat.id}
                        className={`vertical-sidebar__item ${selectedId === cat.id ? 'active' : ''}`}
                        onClick={() => onSelect(cat.id)}
                    >
                        {cat.displayName}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default VerticalSidebar;

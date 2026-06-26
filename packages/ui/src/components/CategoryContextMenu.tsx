import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../db';
import './ProgramContextMenu.css';

interface CategoryContextMenuProps {
    categoryId: string;
    categoryName: string;
    sourceId: string;
    sourceName: string;
    position: { x: number; y: number };
    onClose: () => void;
    onManageCategories?: (sourceId: string, sourceName: string) => void;
    onHideCategory?: (categoryId: string) => void;
    onRenameCategory?: (categoryId: string, currentName: string) => void;
}

export function CategoryContextMenu({
    categoryId,
    categoryName,
    sourceId,
    sourceName,
    position,
    onClose,
    onManageCategories,
    onHideCategory,
    onRenameCategory,
}: CategoryContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);
    
    // Submenu state
    const [currentView, setCurrentView] = useState<'main' | 'playlist_add'>('main');
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [addingToPlaylist, setAddingToPlaylist] = useState<string | null>(null);

    // Dynamic Context Menu calculation
    useLayoutEffect(() => {
        if (menuRef.current) {
            const menu = menuRef.current;
            const menuWidth = menu.offsetWidth;
            const menuHeight = menu.offsetHeight;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let x = position.x;
            let y = position.y;

            // Determine if click was in top or bottom half of the screen
            const isBottomHalf = position.y > viewportHeight / 2;

            // Pop UP if cursor is below 50% screen height
            if (isBottomHalf) {
                y = position.y - menuHeight;
            }

            // Prevent menu from going off right edge
            if (x + menuWidth > viewportWidth) x = viewportWidth - menuWidth - 10;
            if (x < 10) x = 10;

            // Safety bounds for Y-axis
            if (y + menuHeight > viewportHeight) y = viewportHeight - menuHeight - 10;
            if (y < 10) y = 10;

            setAdjustedPosition({ x, y });
        }
    }, [position, currentView]);

    // Close on click outside (ignore clicks inside modals since they are rendered in portals)
    useEffect(() => {
        function isInsideModal(target: Node): boolean {
            const el = target as HTMLElement;
            return !!el.closest?.('.modal-overlay') || !!el.closest?.('.modal-container');
        }
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) && !isInsideModal(e.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Close on escape
    useEffect(() => {
        function handleEscape(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Load playlists when user opens the playlist submenu
    useEffect(() => {
        if (currentView !== 'playlist_add') return;
        let isMounted = true;

        const loadPlaylistsAndSources = async () => {
            try {
                const customList = await db.customPlaylists.toArray();
                let realList: any[] = [];
                if (window.storage) {
                    const res = await window.storage.getSources();
                    if (res.success && res.data) {
                        realList = res.data
                            .filter((s: any) => s.enabled !== false)
                            .map((s: any) => ({
                                playlist_id: s.id,
                                name: s.name,
                                isCustom: false
                            }));
                    }
                }

                if (!isMounted) return;

                const mappedCustom = customList.map(item => ({
                    playlist_id: item.playlist_id,
                    name: item.name,
                    isCustom: true
                }));

                const combined = [...mappedCustom, ...realList].sort((a, b) =>
                    a.name.localeCompare(b.name)
                );

                setPlaylists(combined);
            } catch (err) {
                console.error("Failed to load playlists/sources:", err);
                if (isMounted) setPlaylists([]);
            }
        };

        loadPlaylistsAndSources();
        return () => { isMounted = false; };
    }, [currentView]);

    if (currentView === 'playlist_add') {
        return createPortal(
            <div
                ref={menuRef}
                className="program-context-menu"
                style={{ left: `${adjustedPosition.x}px`, top: `${adjustedPosition.y}px`, minWidth: '220px' }}
            >
                <div className="context-menu-header" style={{ padding: '8px 12px 4px', fontSize: '11px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Add Category to Playlist
                </div>
                <div className="context-menu-separator" />
                <div className="context-menu-scrollable-container">
                    {playlists.length === 0 && (
                        <div style={{ padding: '10px 16px', opacity: 0.5, fontSize: '0.85rem' }}>
                            No playlists yet
                        </div>
                    )}
                    {playlists.map(playlist => (
                        <div
                            key={playlist.playlist_id}
                            className="context-menu-item"
                            onClick={async () => {
                                setAddingToPlaylist(playlist.playlist_id);
                                try {
                                    const { addCategoryToPlaylist } = await import('../services/playlist-editor');
                                    await addCategoryToPlaylist(playlist.playlist_id, sourceId, categoryId);
                                } finally {
                                    setAddingToPlaylist(null);
                                    onClose();
                                }
                            }}
                            style={{
                                opacity: addingToPlaylist === playlist.playlist_id ? 0.5 : 1
                            }}
                        >
                            <span>
                                {addingToPlaylist === playlist.playlist_id ? '⏳ ' : ''}{playlist.name}
                            </span>
                            {!playlist.isCustom && (
                                <span style={{
                                    fontSize: '9px',
                                    opacity: 0.6,
                                    border: '1px solid var(--text-secondary, #888)',
                                    borderRadius: '3px',
                                    padding: '1px 4px',
                                    marginLeft: 'auto',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    flexShrink: 0
                                }}>
                                    Source
                                </span>
                            )}
                        </div>
                    ))}
                </div>
                <div className="context-menu-separator" />
                <div className="context-menu-item context-menu-item-secondary" onClick={() => setCurrentView('main')}>
                    ← Back
                </div>
            </div>,
            document.body
        );
    }

    return createPortal(
        <div
            ref={menuRef}
            className="program-context-menu"
            style={{ left: `${adjustedPosition.x}px`, top: `${adjustedPosition.y}px` }}
        >
            <div className="context-menu-header" style={{ padding: '8px 12px 4px', fontSize: '11px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {categoryName}
            </div>
            {onRenameCategory && (
                <div className="context-menu-item" onClick={() => { onRenameCategory(categoryId, categoryName); onClose(); }}>
                    Rename Category
                </div>
            )}
            {onManageCategories && (
                <div className="context-menu-item" onClick={() => { onManageCategories(sourceId, sourceName); onClose(); }}>
                    Manage Categories
                </div>
            )}
            {onHideCategory && (
                <div className="context-menu-item" onClick={() => { onHideCategory(categoryId); onClose(); }}>
                    Hide Category
                </div>
            )}
            <div className="context-menu-item" onClick={() => setCurrentView('playlist_add')}>
                Add to Playlist →
            </div>
        </div>,
        document.body
    );
}


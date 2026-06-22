import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from '../../hooks/useSqliteLiveQuery';
import { db, type StoredCategory, updateCategoriesBatch } from '../../db';
import { useCategorySortOrder } from '../../stores/uiStore';
import { isCategorySortCustomized, setCategorySortCustomized } from '../../utils/categorySortOverrides';
import { ChannelManager } from './ChannelManager';
import './CategoryManager.css';

interface CategoryManagerProps {
    sourceId: string;
    sourceName: string;
    onClose: () => void;
    onChange?: () => void;
}

export function CategoryManager({ sourceId, sourceName, onClose, onChange }: CategoryManagerProps) {
    const [categories, setCategories] = useState<Array<
        | { type: 'native'; id: string; name: string; enabled: boolean; displayOrder: number; category: StoredCategory }
        | { type: 'link'; id: string; linkId: number; name: string; enabled: boolean; displayOrder: number; link: any }
    >>([]);
    const [isDirty, setIsDirty] = useState(false);
    const [hideUnselected, setHideUnselected] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [managingCategory, setManagingCategory] = useState<{ id: string; name: string } | null>(null);
    const isSavingRef = useRef(false);
    const [selectToMoveMode, setSelectToMoveMode] = useState<'inactive' | 'selecting' | 'ready'>('inactive');
    const [selectedForMove, setSelectedForMove] = useState<Set<string>>(new Set());
    const categorySortOrder = useCategorySortOrder();
    const targetPlaylistId = sourceId.startsWith('playlist:') ? sourceId.replace('playlist:', '') : sourceId;
    const [isCustomized, setIsCustomized] = useState(() => isCategorySortCustomized(targetPlaylistId));
    const isUnlockingRef = useRef(false);

    const handleUnlockOrder = useCallback(() => {
        isUnlockingRef.current = true;
        setCategorySortCustomized(targetPlaylistId, true);
        setIsCustomized(true);
        setIsDirty(true);
    }, [targetPlaylistId]);

    const handleResetToAlphabetical = useCallback(() => {
        isUnlockingRef.current = false;
        setCategorySortCustomized(targetPlaylistId, false);
        setIsCustomized(false);
    }, [targetPlaylistId]);

    // Pointer-event drag state
    const dragFromIdx = useRef<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Compute which list-item index a clientY falls into
    const getIndexFromClientY = (clientY: number): number => {
        if (!listRef.current) return 0;
        const children = Array.from(listRef.current.children) as HTMLElement[];
        for (let i = 0; i < children.length; i++) {
            const rect = children[i].getBoundingClientRect();
            if (clientY < rect.top + rect.height / 2) return i;
        }
        return Math.max(0, children.length - 1);
    };


    // Load categories for this source
    const dbCategories = useLiveQuery(
        () => db.categories.where('source_id').equals(targetPlaylistId).toArray(),
        [targetPlaylistId],
        []
    );

    // Load category links for this source
    const categoryLinks = useLiveQuery(
        () => db.playlistCategoryLinks.where('playlist_id').equals(targetPlaylistId).sortBy('display_order'),
        [targetPlaylistId],
        []
    );

    // Resolve name details for link categories
    const [dbCategoriesMap, setDbCategoriesMap] = useState<Record<string, StoredCategory>>({});
    useEffect(() => {
        if (!categoryLinks || categoryLinks.length === 0) return;
        const ids = categoryLinks.map(l => l.category_id);
        db.categories.where('category_id').anyOf(ids).toArray().then(cats => {
            const map = cats.reduce((acc: Record<string, StoredCategory>, cat) => {
                acc[cat.category_id] = cat;
                return acc;
            }, {});
            setDbCategoriesMap(map);
        });
    }, [categoryLinks]);

    // Initialize categories from database (but not while saving)
    useEffect(() => {
        if (isUnlockingRef.current) {
            isUnlockingRef.current = false;
            return;
        }

        if (dbCategories && !isSavingRef.current) {
            const list: Array<
                | { type: 'native'; id: string; name: string; enabled: boolean; displayOrder: number; category: StoredCategory }
                | { type: 'link'; id: string; linkId: number; name: string; enabled: boolean; displayOrder: number; link: any }
            > = [];

            // Add native categories
            for (const cat of dbCategories) {
                list.push({
                    type: 'native',
                    id: cat.category_id,
                    name: cat.alias || cat.category_name,
                    enabled: cat.enabled !== false,
                    displayOrder: cat.display_order ?? 9999,
                    category: cat,
                });
            }

            // Add custom category links
            for (const link of categoryLinks || []) {
                if (link.id === undefined) continue;
                const cat = dbCategoriesMap[link.category_id];
                const resolvedName = cat?.alias || cat?.category_name || link.category_id;
                list.push({
                    type: 'link',
                    id: `link:${link.id}`,
                    linkId: link.id,
                    name: link.custom_name || resolvedName,
                    enabled: true, // category links are always active
                    displayOrder: link.display_order ?? 9999,
                    link,
                });
            }

            // Sort
            const isAlphabetical = categorySortOrder === 'alphabetical' && !isCustomized;
            if (isAlphabetical) {
                list.sort((a, b) => a.name.localeCompare(b.name));
            } else {
                list.sort((a, b) => {
                    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
                    return a.name.localeCompare(b.name);
                });
            }

            // Set final displayOrder based on sorted index
            const normalized = list.map((item, idx) => ({
                ...item,
                displayOrder: idx,
            }));

            setCategories(normalized);
            setIsDirty(false);
        }
    }, [dbCategories, categoryLinks, dbCategoriesMap, categorySortOrder, isCustomized]);

    // Toggle enable/disable
    const toggleCategory = useCallback((id: string) => {
        setCategories(cats => cats.map(cat =>
            cat.id === id ? { ...cat, enabled: !cat.enabled } : cat
        ));
        setIsDirty(true);
    }, []);

    // Move category to top
    const moveToTop = useCallback((index: number) => {
        if (index === 0) return;
        setCategories(cats => {
            const newCats = [...cats];
            const [moved] = newCats.splice(index, 1);
            newCats.unshift(moved);
            return newCats.map((cat, idx) => ({ ...cat, displayOrder: idx }));
        });
        setIsDirty(true);
    }, []);

    const handleSelectToMoveToggle = useCallback(() => {
        if (selectToMoveMode === 'inactive') {
            setSelectToMoveMode('selecting');
            setSelectedForMove(new Set());
        } else if (selectToMoveMode === 'selecting') {
            if (selectedForMove.size > 0) {
                setSelectToMoveMode('ready');
            } else {
                setSelectToMoveMode('inactive');
            }
        } else if (selectToMoveMode === 'ready') {
            if (selectedForMove.size > 0) {
                setCategories(cats => {
                    const newCats = [...cats];
                    const selected = newCats.filter(cat => selectedForMove.has(cat.id));
                    const unselected = newCats.filter(cat => !selectedForMove.has(cat.id));
                    const reordered = [...selected, ...unselected];
                    return reordered.map((cat, idx) => ({ ...cat, displayOrder: idx }));
                });
                setIsDirty(true);
            }
            setSelectedForMove(new Set());
            setSelectToMoveMode('inactive');
        }
    }, [selectToMoveMode, selectedForMove]);

    const handleSelectToMoveCancel = useCallback(() => {
        setSelectToMoveMode('inactive');
        setSelectedForMove(new Set());
    }, []);

    const toggleSelectForMove = useCallback((id: string) => {
        setSelectedForMove(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    // Move category up
    const moveUp = useCallback((index: number) => {
        if (index === 0) return;
        setCategories(cats => {
            const newCats = [...cats];
            [newCats[index - 1], newCats[index]] = [newCats[index], newCats[index - 1]];
            return newCats.map((cat, idx) => ({ ...cat, displayOrder: idx }));
        });
        setIsDirty(true);
    }, []);

    // Move category down
    const moveDown = useCallback((index: number) => {
        setCategories(cats => {
            if (index === cats.length - 1) return cats;
            const newCats = [...cats];
            [newCats[index], newCats[index + 1]] = [newCats[index + 1], newCats[index]];
            return newCats.map((cat, idx) => ({ ...cat, displayOrder: idx }));
        });
        setIsDirty(true);
    }, []);

    // Delete custom categories / category links
    const handleDeleteLink = useCallback(async (linkId: number) => {
        const confirm = window.confirm("Are you sure you want to delete this category link?");
        if (!confirm) return;
        const { removeCategoryFromPlaylist } = await import('../../services/playlist-editor');
        await removeCategoryFromPlaylist(linkId);
        if (onChange) onChange();
    }, [onChange]);

    // Pointer-event drag handlers — attached to the CONTAINER
    const handleHandlePointerDown = useCallback((e: React.PointerEvent, index: number) => {
        if (e.button !== 0) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragFromIdx.current = index;
        setDragOverIdx(index);
    }, []);

    const handleContainerPointerMove = useCallback((e: React.PointerEvent) => {
        if (dragFromIdx.current === null) return;
        e.preventDefault();
        const idx = getIndexFromClientY(e.clientY);
        setDragOverIdx(idx);
    }, []);

    const handleContainerPointerUp = useCallback((e: React.PointerEvent) => {
        if (dragFromIdx.current === null) return;
        const from = dragFromIdx.current;
        const to = getIndexFromClientY(e.clientY);
        dragFromIdx.current = null;
        setDragOverIdx(null);
        if (from === to) return;
        setCategories(cats => {
            const newCats = [...cats];
            const [removed] = newCats.splice(from, 1);
            newCats.splice(to, 0, removed);
            return newCats.map((cat, idx) => ({ ...cat, displayOrder: idx }));
        });
        setIsDirty(true);
    }, []);

    const handleContainerPointerCancel = useCallback(() => {
        dragFromIdx.current = null;
        setDragOverIdx(null);
    }, []);

    // Select all visible
    const handleSelectAll = useCallback(() => {
        setCategories(cats => cats.map(cat => {
            const isVisible = (!hideUnselected || cat.enabled !== false) && 
                              (!searchQuery.trim() || cat.name.toLowerCase().includes(searchQuery.toLowerCase()));
            if (isVisible && cat.type === 'native') {
                return { ...cat, enabled: true };
            }
            return cat;
        }));
        setIsDirty(true);
    }, [hideUnselected, searchQuery]);

    // Select none visible
    const handleSelectNone = useCallback(() => {
        setCategories(cats => cats.map(cat => {
            const isVisible = (!hideUnselected || cat.enabled !== false) && 
                              (!searchQuery.trim() || cat.name.toLowerCase().includes(searchQuery.toLowerCase()));
            if (isVisible && cat.type === 'native') {
                return { ...cat, enabled: false };
            }
            return cat;
        }));
        setIsDirty(true);
    }, [hideUnselected, searchQuery]);

    // Save changes
    const handleSave = useCallback(async () => {
        try {
            isSavingRef.current = true;

            // Save native categories in batch
            const nativeUpdates = categories
                .filter(cat => cat.type === 'native')
                .map(cat => ({
                    categoryId: cat.id,
                    enabled: cat.enabled,
                    displayOrder: cat.displayOrder,
                }));

            if (nativeUpdates.length > 0) {
                await updateCategoriesBatch(nativeUpdates);
            }

            // Save custom links updates in database
            const linkItems = categories
                .filter(cat => cat.type === 'link')
                .map(cat => ({
                    ...cat.link,
                    display_order: cat.displayOrder,
                }));

            if (linkItems.length > 0) {
                await db.playlistCategoryLinks.bulkPut(linkItems);
            }

            await new Promise(resolve => setTimeout(resolve, 300));
            if (onChange) await onChange();
            onClose();
        } catch (err) {
            console.error('[CategoryManager] Failed to save:', err);
            alert('Failed to save changes. Please try again.');
            isSavingRef.current = false;
        }
    }, [categories, onChange, onClose]);

    // Get visible categories based on filter and search
    const visibleCategories = useMemo(() => {
        let filtered = categories;

        if (hideUnselected) {
            filtered = filtered.filter(c => c.enabled !== false);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(c => c.name.toLowerCase().includes(query));
        }

        return filtered;
    }, [categories, hideUnselected, searchQuery]);

    const enabledCount = categories.filter(c => c.enabled !== false).length;
    const totalCount = categories.length;

    const modalContent = (
        <div className="category-manager-overlay">
            <div className="category-manager-modal" onClick={e => e.stopPropagation()}>
                <div className="category-manager-header">
                    <h2>Manage Categories - {sourceName}</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="category-manager-stats" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{enabledCount} of {totalCount} categories enabled</span>
                    <span style={{ opacity: 0.7, fontSize: '0.85em' }}>
                        ({categorySortOrder === 'alphabetical' && !isCustomized ? 'Alphabetical' : 'Default'} order)
                    </span>
                    {categorySortOrder === 'alphabetical' && (
                        !isCustomized ? (
                            <button
                                onClick={handleUnlockOrder}
                                style={{
                                    padding: '2px 8px',
                                    fontSize: '0.85em',
                                    background: 'var(--bg-primary, #1e1e1e)',
                                    border: '1px solid var(--surface-border, #333)',
                                    borderRadius: '4px',
                                    color: 'var(--text-primary, #fff)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    marginLeft: '8px'
                                }}
                                title="Unlock manual reordering for this specific playlist/source"
                            >
                                <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    width="12" 
                                    height="12" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                >
                                    <path d="M12 20h9"/>
                                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                                </svg>
                                <span>Customize Order</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleResetToAlphabetical}
                                style={{
                                    padding: '2px 8px',
                                    fontSize: '0.85em',
                                    background: 'var(--bg-primary, #1e1e1e)',
                                    border: '1px solid var(--surface-border, #333)',
                                    borderRadius: '4px',
                                    color: 'var(--text-primary, #fff)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    marginLeft: '8px'
                                }}
                                title="Reset sorting for this specific playlist/source back to alphabetical"
                            >
                                <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    width="12" 
                                    height="12" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                >
                                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                    <path d="M3 3v5h5"/>
                                </svg>
                                <span>Reset to Alphabetical</span>
                            </button>
                        )
                    )}
                </div>

                <div className="category-manager-actions">
                    <button onClick={handleSelectAll}>✓ Select All</button>
                    <button onClick={handleSelectNone}>✗ Select None</button>
                    <div className="divider-vertical"></div>
                    <button
                        onClick={() => setHideUnselected(!hideUnselected)}
                        className={hideUnselected ? 'active-toggle' : ''}
                    >
                        {hideUnselected ? '👁 Show All' : '👁‍🗨 Hide Unselected'}
                    </button>
                    <button
                        onClick={handleSelectToMoveToggle}
                        className={selectToMoveMode !== 'inactive' ? 'active-toggle' : ''}
                    >
                        {selectToMoveMode === 'inactive' && '⇈ Select to Move to Top'}
                        {selectToMoveMode === 'selecting' && `✓ Done Selecting (${selectedForMove.size})`}
                        {selectToMoveMode === 'ready' && '⇈ Move Selected to Top'}
                    </button>
                    {selectToMoveMode !== 'inactive' && (
                        <button
                            onClick={handleSelectToMoveCancel}
                            className="cancel-select-btn"
                        >
                            Cancel
                        </button>
                    )}
                </div>

                <div className="category-search">
                    <input
                        type="text"
                        placeholder="Search categories..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div
                    className="category-list"
                    ref={listRef}
                    onPointerMove={handleContainerPointerMove}
                    onPointerUp={handleContainerPointerUp}
                    onPointerCancel={handleContainerPointerCancel}
                >
                    {visibleCategories.map((cat) => {
                        const index = categories.findIndex(c => c.id === cat.id);
                        const isDragging = dragFromIdx.current === index;
                        const isDragOver = dragOverIdx === index && dragFromIdx.current !== null && dragFromIdx.current !== index;

                        const isAlphabetical = categorySortOrder === 'alphabetical' && !isCustomized;

                        return (
                            <div
                                key={cat.id}
                                className={`category-item ${!isAlphabetical && isDragging ? 'dragging' : ''} ${!isAlphabetical && isDragOver ? 'drag-over' : ''} ${selectToMoveMode !== 'inactive' && selectedForMove.has(cat.id) ? 'selected-for-move' : ''} ${selectToMoveMode !== 'inactive' ? 'selection-mode-item' : ''}`}
                                onClick={selectToMoveMode !== 'inactive' ? () => toggleSelectForMove(cat.id) : undefined}
                            >
                                {!isAlphabetical && (
                                    <span
                                        className="drag-handle"
                                        style={{ touchAction: 'none', opacity: selectToMoveMode !== 'inactive' ? 0.3 : 1 }}
                                        onPointerDown={selectToMoveMode !== 'inactive' ? undefined : (e) => handleHandlePointerDown(e, index)}
                                    >
                                        ⋮⋮
                                    </span>
                                )}

                                {cat.type === 'native' ? (
                                    <label 
                                        className="category-checkbox" 
                                        onClick={selectToMoveMode !== 'inactive' ? (e) => e.preventDefault() : undefined}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={cat.enabled}
                                            onChange={selectToMoveMode !== 'inactive' ? () => {} : () => toggleCategory(cat.id)}
                                            disabled={selectToMoveMode !== 'inactive'}
                                        />
                                        <span className="category-name">{cat.name}</span>
                                    </label>
                                ) : (
                                    <div className="category-checkbox">
                                        <span className="category-name" style={{ marginLeft: '24px' }}>
                                            🔗 {cat.name}
                                        </span>
                                    </div>
                                )}

                                <div className="category-actions-row" style={{ display: 'flex', alignItems: 'center' }}>
                                    <button
                                        className="manage-channels-btn"
                                        onClick={selectToMoveMode !== 'inactive' ? (e) => e.stopPropagation() : () => setManagingCategory({ id: cat.id, name: cat.name })}
                                        disabled={selectToMoveMode !== 'inactive'}
                                        title="Manage channels in this category"
                                    >
                                        📺 Channels
                                    </button>
                                    {cat.type === 'link' && (
                                        <button
                                            className="category-delete-btn"
                                            onClick={selectToMoveMode !== 'inactive' ? (e) => e.stopPropagation() : () => handleDeleteLink(cat.linkId)}
                                            disabled={selectToMoveMode !== 'inactive'}
                                            title="Remove category link"
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#ff4b4b',
                                                cursor: selectToMoveMode !== 'inactive' ? 'default' : 'pointer',
                                                fontSize: '1rem',
                                                marginLeft: '8px',
                                                padding: '4px',
                                                opacity: selectToMoveMode !== 'inactive' ? 0.3 : 1
                                            }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {!isAlphabetical && (
                                    <div className="category-reorder">
                                        <button
                                            className="order-btn"
                                            onClick={selectToMoveMode !== 'inactive' ? (e) => e.stopPropagation() : () => moveToTop(index)}
                                            disabled={index === 0 || selectToMoveMode !== 'inactive'}
                                            title="Move to top"
                                        >
                                            ↑↑
                                        </button>
                                        <button
                                            className="order-btn"
                                            onClick={selectToMoveMode !== 'inactive' ? (e) => e.stopPropagation() : () => moveUp(index)}
                                            disabled={index === 0 || selectToMoveMode !== 'inactive'}
                                            title="Move up"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            className="order-btn"
                                            onClick={selectToMoveMode !== 'inactive' ? (e) => e.stopPropagation() : () => moveDown(index)}
                                            disabled={index === categories.length - 1 || selectToMoveMode !== 'inactive'}
                                            title="Move down"
                                        >
                                            ↓
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="category-manager-footer">
                    <button className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button
                        className="save-btn"
                        onClick={handleSave}
                        disabled={!isDirty}
                    >
                        Save Changes
                    </button>
                </div>

                {managingCategory && (
                    <ChannelManager
                        categoryId={managingCategory.id}
                        categoryName={managingCategory.name}
                        sourceId={sourceId}
                        onClose={() => setManagingCategory(null)}
                        onChange={onChange}
                    />
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db, type StoredCategory } from '../db';
import './AdvancedSearchModal.css';

export type SearchScope = 'channels' | 'epg' | 'both';

export interface AdvancedSearchConfig {
  query: string;
  scope: SearchScope;
  sourceIds: string[];
  categoryIds: string[];
  useForRegular: boolean;
}

interface SourceInfo {
  id: string;
  name: string;
  enabled: boolean;
}

interface AdvancedSearchModalProps {
  isOpen: boolean;
  initialConfig?: AdvancedSearchConfig;
  onSearch: (config: AdvancedSearchConfig) => void;
  onClose: () => void;
}

export function AdvancedSearchModal({ isOpen, initialConfig, onSearch, onClose }: AdvancedSearchModalProps) {
  const [query, setQuery] = useState(initialConfig?.query ?? '');
  const [scope, setScope] = useState<SearchScope>(initialConfig?.scope ?? 'both');
  const [useForRegular, setUseForRegular] = useState(initialConfig?.useForRegular ?? false);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [categories, setCategories] = useState<StoredCategory[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set(initialConfig?.sourceIds ?? []));
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set(initialConfig?.categoryIds ?? []));
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load enabled sources and categories on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    async function loadData() {
      try {
        // Load sources from storage
        const sourcesResult = window.storage ? await window.storage.getSources() : { data: [] };
        const enabledSources = (sourcesResult.data || [])
          .filter((s: any) => s.enabled !== false)
          .map((s: any) => ({ id: s.id, name: s.name, enabled: true }));

        // Load categories from DB
        const allCategories = await db.categories.toArray();
        const enabledCategories = allCategories.filter(c => c.enabled !== false);

        if (!isMounted) return;

        setSources(enabledSources);
        setCategories(enabledCategories);

        // Auto-expand sources that have selected categories
        const sourceIdsWithSelection = new Set<string>();
        for (const cat of enabledCategories) {
          if (selectedCategoryIds.has(cat.category_id)) {
            sourceIdsWithSelection.add(cat.source_id);
          }
        }
        setExpandedSources(prev => new Set([...prev, ...sourceIdsWithSelection]));
      } catch (err) {
        console.error('[AdvancedSearchModal] Failed to load data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [isOpen]);

  // Reset state when initialConfig changes
  useEffect(() => {
    if (initialConfig) {
      setQuery(initialConfig.query);
      setScope(initialConfig.scope);
      setUseForRegular(initialConfig.useForRegular);
      setSelectedSourceIds(new Set(initialConfig.sourceIds));
      setSelectedCategoryIds(new Set(initialConfig.categoryIds));
    }
  }, [initialConfig]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Group categories by source
  const categoriesBySource = useMemo(() => {
    const grouped = new Map<string, StoredCategory[]>();
    for (const cat of categories) {
      const list = grouped.get(cat.source_id) || [];
      list.push(cat);
      grouped.set(cat.source_id, list);
    }
    // Sort categories within each source
    for (const [, list] of grouped) {
      list.sort((a, b) => a.category_name.localeCompare(b.category_name));
    }
    return grouped;
  }, [categories]);

  const toggleSource = useCallback((sourceId: string) => {
    setSelectedSourceIds(prev => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
        // Also unselect all categories from this source
        setSelectedCategoryIds(catPrev => {
          const catNext = new Set(catPrev);
          for (const cat of categoriesBySource.get(sourceId) || []) {
            catNext.delete(cat.category_id);
          }
          return catNext;
        });
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }, [categoriesBySource]);

  const toggleCategory = useCallback((categoryId: string, sourceId: string) => {
    setSelectedCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
        // Also select the source
        setSelectedSourceIds(srcPrev => new Set([...srcPrev, sourceId]));
      }
      return next;
    });
  }, []);

  const toggleExpandSource = useCallback((sourceId: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedSourceIds(new Set(sources.map(s => s.id)));
    setSelectedCategoryIds(new Set(categories.map(c => c.category_id)));
  }, [sources, categories]);

  const handleClearAll = useCallback(() => {
    setSelectedSourceIds(new Set());
    setSelectedCategoryIds(new Set());
  }, []);

  const handleSubmit = useCallback(() => {
    onSearch({
      query: query.trim(),
      scope,
      sourceIds: Array.from(selectedSourceIds),
      categoryIds: Array.from(selectedCategoryIds),
      useForRegular,
    });
  }, [query, scope, selectedSourceIds, selectedCategoryIds, useForRegular, onSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }, [handleSubmit]);

  if (!isOpen) return null;

  const hasSelection = selectedSourceIds.size > 0 || selectedCategoryIds.size > 0;
  const canSearch = query.trim().length >= 2;

  return createPortal(
    <div className="advanced-search-overlay">
      <div className="advanced-search-modal">
        {/* Header */}
        <div className="advanced-search-header">
          <div className="advanced-search-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
            <h2>Advanced Search</h2>
          </div>
          <button className="advanced-search-close-btn" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="advanced-search-body">
          {/* Search Input */}
          <div className="advanced-search-section">
            <label className="advanced-search-label">Search Term</label>
            <div className="advanced-search-input-wrap">
              <svg className="advanced-search-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.3-4.3"></path>
              </svg>
              <input
                type="text"
                className="advanced-search-input"
                placeholder="Type at least 2 characters..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              {query && (
                <button className="advanced-search-input-clear" onClick={() => setQuery('')}>
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Search Scope */}
          <div className="advanced-search-section">
            <label className="advanced-search-label">Search In</label>
            <div className="advanced-search-scope">
              <button
                className={`scope-btn ${scope === 'channels' ? 'active' : ''}`}
                onClick={() => setScope('channels')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                  <polyline points="17 2 12 7 7 2"></polyline>
                </svg>
                Channels
              </button>
              <button
                className={`scope-btn ${scope === 'epg' ? 'active' : ''}`}
                onClick={() => setScope('epg')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z" />
                  <path d="M16 3v4" />
                  <path d="M8 3v4" />
                  <path d="M4 11h16" />
                </svg>
                EPG Only
              </button>
              <button
                className={`scope-btn ${scope === 'both' ? 'active' : ''}`}
                onClick={() => setScope('both')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                  <polyline points="17 2 12 7 7 2"></polyline>
                  <path d="M4 11h16" />
                </svg>
                Both
              </button>
            </div>
          </div>

          {/* Source / Category Filters */}
          <div className="advanced-search-section">
            <div className="advanced-search-label-row">
              <label className="advanced-search-label">Sources & Categories</label>
              <div className="advanced-search-actions">
                <button className="action-link" onClick={handleSelectAll}>Select All</button>
                <span className="action-divider">|</span>
                <button className="action-link" onClick={handleClearAll}>Clear</button>
              </div>
            </div>

            <div className="advanced-search-filters">
              {loading ? (
                <div className="advanced-search-loading">
                  <div className="spinner-small"></div>
                  <span>Loading sources...</span>
                </div>
              ) : sources.length === 0 ? (
                <div className="advanced-search-empty">No enabled sources found</div>
              ) : (
                sources.map(source => {
                  const sourceCategories = categoriesBySource.get(source.id) || [];
                  const isExpanded = expandedSources.has(source.id);
                  const isSourceSelected = selectedSourceIds.has(source.id);
                  const selectedCount = sourceCategories.filter(c => selectedCategoryIds.has(c.category_id)).length;
                  const allSelected = sourceCategories.length > 0 && selectedCount === sourceCategories.length;
                  const isIndeterminate = selectedCount > 0 && selectedCount < sourceCategories.length;

                  return (
                    <div key={source.id} className="filter-source-group">
                      <div
                        className={`filter-source-header ${isExpanded ? 'expanded' : ''}`}
                        onClick={() => toggleExpandSource(source.id)}
                      >
                        <svg className="filter-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                        <div
                          className={`filter-checkbox ${isSourceSelected ? 'checked' : ''} ${isIndeterminate ? 'indeterminate' : ''}`}
                          onClick={e => { e.stopPropagation(); toggleSource(source.id); }}
                        >
                          {isSourceSelected && !isIndeterminate && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                          {isIndeterminate && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                          )}
                        </div>
                        <span className="filter-source-name">{source.name}</span>
                        <span className="filter-source-count">
                          {selectedCount > 0 ? `${selectedCount}/${sourceCategories.length}` : sourceCategories.length}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="filter-categories">
                          {sourceCategories.map(cat => {
                            const isCatSelected = selectedCategoryIds.has(cat.category_id);
                            return (
                              <div
                                key={cat.category_id}
                                className={`filter-category-item ${isCatSelected ? 'selected' : ''}`}
                                onClick={() => toggleCategory(cat.category_id, source.id)}
                              >
                                <div className={`filter-checkbox ${isCatSelected ? 'checked' : ''}`}>
                                  {isCatSelected && (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  )}
                                </div>
                                <span className="filter-category-name">{cat.category_name}</span>
                                <span className="filter-category-count">{cat.channel_count ?? 0}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Use for regular search toggle */}
          <div className="advanced-search-section">
            <label className="advanced-search-toggle" onClick={() => setUseForRegular(!useForRegular)}>
              <div className={`toggle-switch ${useForRegular ? 'on' : ''}`}>
                <div className="toggle-knob"></div>
              </div>
              <span className="toggle-label">Use these settings for regular title bar searches</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="advanced-search-footer">
          <button className="advanced-search-btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`advanced-search-btn primary ${!canSearch ? 'disabled' : ''}`}
            onClick={handleSubmit}
            disabled={!canSearch}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
            Search
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

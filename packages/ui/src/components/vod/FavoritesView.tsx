import { useCallback, useMemo, useRef, forwardRef, useState } from 'react';
import { VirtuosoGrid, VirtuosoGridHandle } from 'react-virtuoso';
import { MediaCard } from './MediaCard';
import type { StoredMovie, StoredSeries } from '../../db';
import { useVodFavoritesStore } from '../../stores/vodFavoritesStore';
import { useSourceNameMap } from '../../hooks/useChannels';
import './VodBrowse.css';

const GridScroller = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <div
      ref={ref}
      {...props}
      style={{ ...props.style, overflowY: 'scroll' }}
    />
  )
);

export interface FavoritesViewProps {
  type: 'movie' | 'series';
  items: (StoredMovie | StoredSeries)[];
  loading: boolean;
  onItemClick: (item: StoredMovie | StoredSeries) => void;
}

export function FavoritesView({
  type,
  items,
  loading,
  onItemClick,
}: FavoritesViewProps) {
  const virtuosoRef = useRef<VirtuosoGridHandle>(null);
  const removeFavorite = useVodFavoritesStore((s) => s.removeFavorite);
  const sourceNameMap = useSourceNameMap();

  const [showSourceBadge, setShowSourceBadge] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vodFavoritesShowSourceBadge');
      return saved === 'true';
    }
    return false;
  });

  const toggleSourceBadge = useCallback(() => {
    setShowSourceBadge((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('vodFavoritesShowSourceBadge', String(next));
      }
      return next;
    });
  }, []);

  const handleRemove = useCallback((item: StoredMovie | StoredSeries) => {
    const id = type === 'movie'
      ? (item as StoredMovie).stream_id
      : (item as StoredSeries).series_id;
    removeFavorite(id, type);
  }, [type, removeFavorite]);

  const itemContent = useCallback((index: number) => {
    const item = items[index];
    if (!item) return null;

    const sourceName = (showSourceBadge && sourceNameMap)
      ? sourceNameMap.get(item.source_id)
      : undefined;

    return (
      <MediaCard
        item={item}
        type={type}
        onClick={onItemClick}
        isFavorited={true}
        onToggleFavorite={handleRemove}
        sourceName={sourceName}
      />
    );
  }, [items, type, onItemClick, handleRemove, showSourceBadge, sourceNameMap]);

  if (loading) {
    return (
      <div className="vod-browse">
        <div className="vod-browse__loading-container">
          <div className="vod-browse__spinner" />
          <span>Loading favorites...</span>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="vod-browse">
        <div className="vod-browse__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48" style={{ marginBottom: '16px', opacity: 0.5 }}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2>No Favorites Yet</h2>
          <p>Go to a {type === 'movie' ? 'movie' : 'series'} detail page and click "Add to Favorite" to see it here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vod-browse">
      <div className="vod-browse__toolbar">
        <div className="vod-browse__toolbar-left">
          <span className="vod-browse__category-name">Favorites</span>
          <span className="vod-browse__item-count">{items.length.toLocaleString()} items</span>
        </div>
        <div className="vod-browse__toolbar-right">
          <button
            className={`vod-favorites-toggle-btn ${showSourceBadge ? 'active' : ''}`}
            onClick={toggleSourceBadge}
            title={showSourceBadge ? 'Hide source badge' : 'Show source badge'}
            aria-label="Toggle source badge"
            type="button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Show Source</span>
          </button>
        </div>
      </div>

      <VirtuosoGrid
        ref={virtuosoRef}
        className="vod-browse__grid"
        data={items}
        totalCount={items.length}
        itemContent={itemContent}
        components={{
          Scroller: GridScroller,
        }}
        listClassName="vod-browse__grid-list"
        itemClassName="vod-browse__grid-item"
      />
    </div>
  );
}

export default FavoritesView;

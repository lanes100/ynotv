import { useCallback, useMemo, useRef, forwardRef } from 'react';
import { VirtuosoGrid, VirtuosoGridHandle } from 'react-virtuoso';
import { MediaCard } from './MediaCard';
import type { StoredMovie, StoredSeries } from '../../db';
import { useVodFavoritesStore } from '../../stores/vodFavoritesStore';
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

  const handleRemove = useCallback((item: StoredMovie | StoredSeries) => {
    const id = type === 'movie'
      ? (item as StoredMovie).stream_id
      : (item as StoredSeries).series_id;
    removeFavorite(id, type);
  }, [type, removeFavorite]);

  const itemContent = useCallback((index: number) => {
    const item = items[index];
    if (!item) return null;

    return (
      <MediaCard
        item={item}
        type={type}
        onClick={onItemClick}
        isFavorited={true}
        onToggleFavorite={handleRemove}
      />
    );
  }, [items, type, onItemClick, handleRemove]);

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

import { useCallback } from 'react';
import type { StoredChannel } from '../db';
import { useLiveQuery } from '../hooks/useSqliteLiveQuery';
import { useCurrentProgram } from '../hooks/useChannels';
import { db } from '../db';
import './FavoritesWidget.css';

interface FavoriteChannelItemProps {
  channel: StoredChannel;
  onChannelClick: (channel: StoredChannel) => void;
}

function FavoriteChannelItem({ channel, onChannelClick }: FavoriteChannelItemProps) {
  const currentProgram = useCurrentProgram(channel.stream_id);

  const handleClick = useCallback(() => {
    onChannelClick(channel);
  }, [channel, onChannelClick]);

  return (
    <div
      className="favorite-channel-item"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      title={`${channel.name}${currentProgram ? ` - ${currentProgram.title}` : ''}`}
    >
      <span className="favorite-channel-name">{channel.alias || channel.name}</span>
      {currentProgram && (
        <>
          <span className="favorite-channel-separator"> - </span>
          <span className="favorite-channel-program">{currentProgram.title}</span>
        </>
      )}
    </div>
  );
}

interface FavoritesWidgetProps {
  showControls: boolean;
  activeView: string;
  onChannelClick: (channel: StoredChannel) => void;
  isVod: boolean;
}

export function FavoritesWidget({
  showControls,
  activeView,
  onChannelClick,
  isVod,
}: FavoritesWidgetProps) {
  const favoriteChannels = useLiveQuery(
    async () => {
      const results = await db.channels.whereRaw('(is_favorite = 1 OR is_favorite = true)').toArray();
      // Sort by fav_order (nulls last, then by name)
      results.sort((a, b) => {
        if (a.fav_order != null && b.fav_order != null) return a.fav_order - b.fav_order;
        if (a.fav_order != null) return -1;
        if (b.fav_order != null) return 1;
        return (a.alias || a.name).localeCompare(b.alias || b.name);
      });
      return results;
    },
    [],
    [],
    0,
    'channels'
  );

  // Only visible on main screen when controls are shown
  const isMainScreen = activeView === 'none';
  const isVisible = isMainScreen && showControls && (favoriteChannels?.length ?? 0) > 0 && !isVod;

  if (!isVisible) {
    return null;
  }

  return (
    <div className="favorites-widget">
      <div className="favorites-header">Favorites</div>
      <div className="favorites-list">
        {favoriteChannels?.map((channel) => (
          <FavoriteChannelItem
            key={channel.stream_id}
            channel={channel}
            onChannelClick={onChannelClick}
          />
        ))}
      </div>
    </div>
  );
}

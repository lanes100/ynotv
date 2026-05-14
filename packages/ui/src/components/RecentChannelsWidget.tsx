import { useState, useEffect, useCallback } from 'react';
import { getRecentChannels, onRecentChannelsUpdate, type RecentChannelEntry } from '../utils/recentChannels';
import { useCurrentProgram } from '../hooks/useChannels';
import { db } from '../db';
import type { StoredChannel } from '../db';
import './RecentChannelsWidget.css';

interface RecentChannelItemProps {
  entry: RecentChannelEntry;
  onChannelClick: (channel: StoredChannel) => void;
}

function RecentChannelItem({ entry, onChannelClick }: RecentChannelItemProps) {
  const currentProgram = useCurrentProgram(entry.streamId);

  const handleClick = useCallback(async () => {
    const channel = await db.channels.get(entry.streamId);
    if (channel) {
      onChannelClick(channel);
    }
  }, [entry.streamId, onChannelClick]);

  return (
    <div
      className="recent-channel-item"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      title={`${entry.channelName}${currentProgram ? ` - ${currentProgram.title}` : ''}`}
    >
      <span className="recent-channel-name">{entry.channelName}</span>
      {currentProgram && (
        <>
          <span className="recent-channel-separator"> - </span>
          <span className="recent-channel-program">{currentProgram.title}</span>
        </>
      )}
    </div>
  );
}

interface RecentChannelsWidgetProps {
  showControls: boolean;
  activeView: string;
  channelInfoOverlayEnabled: boolean;
  onChannelClick: (channel: StoredChannel) => void;
}

export function RecentChannelsWidget({
  showControls,
  activeView,
  channelInfoOverlayEnabled,
  onChannelClick,
}: RecentChannelsWidgetProps) {
  const [recentEntries, setRecentEntries] = useState<RecentChannelEntry[]>([]);

  useEffect(() => {
    // Load initial recent channels
    setRecentEntries(getRecentChannels());

    // Subscribe to updates
    const unsubscribe = onRecentChannelsUpdate(() => {
      setRecentEntries(getRecentChannels());
    });

    return unsubscribe;
  }, []);

  // Only visible on main screen when controls are shown
  const isMainScreen = activeView === 'none';
  const isVisible = isMainScreen && showControls && recentEntries.length > 0;

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`recent-channels-widget ${channelInfoOverlayEnabled ? 'cio-enabled' : ''}`}>
      <div className="recent-channels-header">Recent</div>
      <div className="recent-channels-list">
        {recentEntries.map((entry) => (
          <RecentChannelItem
            key={entry.streamId}
            entry={entry}
            onChannelClick={onChannelClick}
          />
        ))}
      </div>
    </div>
  );
}

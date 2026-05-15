import { useCallback } from 'react';
import { useLiveQuery } from '../hooks/useSqliteLiveQuery';
import { useCurrentProgram } from '../hooks/useChannels';
import { db } from '../db';
import type { StoredChannel } from '../db';
import './CustomGroupWidget.css';

/* ── Single channel row ──────────────────────────────────────────── */
interface GroupChannelItemProps {
  channel: StoredChannel;
  onChannelClick: (channel: StoredChannel) => void;
}

function GroupChannelItem({ channel, onChannelClick }: GroupChannelItemProps) {
  const currentProgram = useCurrentProgram(channel.stream_id);

  const handleClick = useCallback(() => {
    onChannelClick(channel);
  }, [channel, onChannelClick]);

  return (
    <div
      className="group-channel-item"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); }
      }}
      title={`${channel.alias || channel.name}${currentProgram ? ` - ${currentProgram.title}` : ''}`}
    >
      <span className="group-channel-name">{channel.alias || channel.name}</span>
      {currentProgram && (
        <>
          <span className="group-channel-separator"> - </span>
          <span className="group-channel-program">{currentProgram.title}</span>
        </>
      )}
    </div>
  );
}

/* ── Widget ──────────────────────────────────────────────────────── */
interface CustomGroupWidgetProps {
  groupId: string;
  showControls: boolean;
  activeView: string;
  onChannelClick: (channel: StoredChannel) => void;
  isVod: boolean;
}

export function CustomGroupWidget({
  groupId,
  showControls,
  activeView,
  onChannelClick,
  isVod,
}: CustomGroupWidgetProps) {
  // Single query: load group metadata + ordered channels in one shot
  const data = useLiveQuery(
    async () => {
      const [group, mappings] = await Promise.all([
        db.customGroups.get(groupId),
        db.customGroupChannels.where('group_id').equals(groupId).toArray(),
      ]);

      if (!group) return null;

      // Sort by display_order
      mappings.sort((a, b) => a.display_order - b.display_order);

      // Resolve stream IDs → channel objects (preserving order)
      const channels = (
        await Promise.all(mappings.map((m) => db.channels.get(m.stream_id)))
      ).filter(Boolean) as StoredChannel[];

      return { group, channels };
    },
    [groupId],
    undefined,
    0,
    'custom_group_channels'
  );

  const isMainScreen = activeView === 'none';
  const isVisible = isMainScreen && showControls && (data?.channels?.length ?? 0) > 0 && !isVod;

  if (!isVisible) return null;

  const groupName = data!.group.name;

  return (
    <div className="custom-group-widget">
      <div className="custom-group-header" title={groupName}>{groupName}</div>
      <div className="custom-group-list">
        {data!.channels.map((ch) => (
          <GroupChannelItem
            key={ch.stream_id}
            channel={ch}
            onChannelClick={onChannelClick}
          />
        ))}
      </div>
    </div>
  );
}

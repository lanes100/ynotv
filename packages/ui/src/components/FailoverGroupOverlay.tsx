import { useState, useEffect } from 'react';
import type { StoredChannel } from '../db';
import { db } from '../db';
import { getFailoverGroupMembers } from '../services/failover-groups';
import './FailoverGroupOverlay.css';

interface FailoverGroupOverlayProps {
  currentChannel: StoredChannel | null;
  visible: boolean;
  onChannelClick: (channel: StoredChannel) => void;
}

interface GroupMember {
  stream_id: string;
  priority: number;
  name: string;
  stream_icon?: string;
}

export function FailoverGroupOverlay({
  currentChannel,
  visible,
  onChannelClick,
}: FailoverGroupOverlayProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [groupName, setGroupName] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentChannel) {
      setMembers([]);
      setGroupName('');
      return;
    }

    let isMounted = true;
    setLoading(true);

    async function load() {
      try {
        // First find which group this channel belongs to
        const membership = await db.failoverGroupMembers
          .where('stream_id')
          .equals(currentChannel!.stream_id)
          .first();

        if (!membership) {
          if (isMounted) {
            setMembers([]);
            setGroupName('');
          }
          return;
        }

        const groupId = membership.group_id;

        // Fetch group name
        const group = await db.failoverGroups
          .where('group_id')
          .equals(groupId)
          .first();

        if (group && isMounted) {
          setGroupName(group.name);
        }

        // Fetch all members of this group
        const groupMembers = await getFailoverGroupMembers(groupId);
        if (isMounted) setMembers(groupMembers);
      } catch (e) {
        console.error('[FailoverGroupOverlay] Failed to load members:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => { isMounted = false; };
  }, [currentChannel?.stream_id]);

  if (!visible || members.length <= 1) return null;

  const currentStreamId = currentChannel?.stream_id;

  return (
    <div className="failover-group-overlay">
      <div className="fgo-header">
        <span className="fgo-header-icon">🔗</span>
        <span className="fgo-header-name" title={groupName}>{groupName}</span>
      </div>
      <div className="fgo-list">
        {members.map((member) => {
          const isActive = member.stream_id === currentStreamId;
          return (
            <button
              key={member.stream_id}
              className={`fgo-item ${isActive ? 'fgo-active' : ''}`}
              onClick={() => {
                if (isActive) return;
                // Need to find the full channel object — fetch from db
                db.channels.where('stream_id').equals(member.stream_id).first().then((ch) => {
                  if (ch) onChannelClick(ch);
                });
              }}
              disabled={isActive}
              title={isActive ? 'Currently playing' : `Switch to ${member.name}`}
            >
              {member.stream_icon ? (
                <img
                  src={member.stream_icon}
                  alt=""
                  className="fgo-logo"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <span className="fgo-logo-placeholder">📺</span>
              )}
              <span className="fgo-name">{member.name}</span>
              {isActive && <span className="fgo-badge">●</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

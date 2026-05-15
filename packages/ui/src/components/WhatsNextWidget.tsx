import type { StoredChannel } from '../db';
import { useNextProgram } from '../hooks/useChannels';
import './WhatsNextWidget.css';

interface WhatsNextWidgetProps {
  channel: StoredChannel | null;
  showControls: boolean;
  activeView: string;
  isVod: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function WhatsNextWidget({
  channel,
  showControls,
  activeView,
  isVod,
}: WhatsNextWidgetProps) {
  const nextProgram = useNextProgram(channel?.stream_id ?? null);

  const isMainScreen = activeView === 'none';
  const isVisible = isMainScreen && showControls && !!channel && !isVod;

  if (!isVisible) {
    return null;
  }

  const channelName = channel.alias || channel.name;

  return (
    <div className="whats-next-widget">
      <div className="whats-next-header">What&apos;s Next</div>
      <div className="whats-next-body">
        {nextProgram ? (
          <div className="whats-next-content">
            <div className="whats-next-channel" title={channelName}>
              {channelName}
            </div>
            <div className="whats-next-title" title={nextProgram.title}>
              {nextProgram.title}
            </div>
            <div className="whats-next-time">
              {formatTime(new Date(nextProgram.start))} – {formatTime(new Date(nextProgram.end))}
            </div>
            {nextProgram.description && (
              <div className="whats-next-desc" title={nextProgram.description}>
                {nextProgram.description}
              </div>
            )}
          </div>
        ) : (
          <div className="whats-next-empty">No upcoming program in guide</div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { StoredChannel } from '../db';
import { useCurrentProgram } from '../hooks/useChannels';
import { MetadataBadge } from './MetadataBadge';
import './ChannelInfoOverlay.css';

interface ChannelInfoOverlayProps {
  channel: StoredChannel | null;
  visible: boolean;
  hideDescription?: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChannelInfoOverlay({
  channel,
  visible,
  hideDescription,
}: ChannelInfoOverlayProps) {
  const currentProgram = useCurrentProgram(channel?.stream_id ?? null);
  const [showDescription, setShowDescription] = useState(false);

  // Progress tracking for live TV - updates every second
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    if (!visible) {
      setShowDescription(false);
      return;
    }
    const timer = setTimeout(() => setShowDescription(true), 300);
    return () => clearTimeout(timer);
  }, [visible, channel?.stream_id]);

  // Track program progress and time remaining
  useEffect(() => {
    if (!currentProgram) {
      setProgress(0);
      setTimeRemaining('');
      return;
    }

    const updateProgress = () => {
      const now = new Date().getTime();
      const start = new Date(currentProgram.raw_start ?? currentProgram.start).getTime();
      const end = new Date(currentProgram.end).getTime();
      const duration = end - start;
      const elapsed = now - start;

      const pct = Math.min(100, Math.max(0, (elapsed / duration) * 100));
      setProgress(pct);

      // Calculate time remaining
      const remainingMs = Math.max(0, end - now);
      const remainingMins = Math.ceil(remainingMs / 60000);
      if (remainingMins >= 60) {
        const hrs = Math.floor(remainingMins / 60);
        const mins = remainingMins % 60;
        setTimeRemaining(`${hrs}h ${mins}m left`);
      } else {
        setTimeRemaining(`${remainingMins}m left`);
      }
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, [currentProgram]);

  if (!channel) return null;

  // Don't show for VOD or recordings
  const isVod = channel.stream_id === 'vod' || channel.stream_id?.startsWith('recording_');
  if (isVod) return null;

  return (
    <div
      className={`channel-info-overlay ${visible ? 'visible' : 'hidden'}`}
    >
      <div className="cio-content">
        {/* Channel logo and name row */}
        <div className="cio-header">
          {channel.stream_icon && (
            <img
              key={channel.stream_icon}
              src={channel.stream_icon}
              alt=""
              className="cio-logo"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <div className="cio-header-text">
            <span className="cio-channel-name" title={channel.alias || channel.name}>
              {channel.alias || channel.name}
            </span>
            <MetadataBadge streamId={channel.stream_id} variant="detailed" />
          </div>
        </div>

        {/* Program info */}
        {currentProgram && (
          <div className={`cio-program ${showDescription ? 'show' : ''}`}>
            {/* Program title */}
            <div className="cio-program-title" title={currentProgram.title}>
              {currentProgram.title}
            </div>

            {/* Time row: start - end | time remaining */}
            <div className="cio-time-row">
              <span className="cio-time-range">
                {formatTime(new Date(currentProgram.start))} - {formatTime(new Date(currentProgram.end))}
              </span>
              {timeRemaining && (
                <span className="cio-time-remaining">{timeRemaining}</span>
              )}
            </div>

            {/* Progress bar */}
            <div className="cio-progress-bar">
              <div
                className="cio-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Description */}
            {!hideDescription && currentProgram.description && (
              <div className="cio-program-desc" title={currentProgram.description}>
                {currentProgram.description}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

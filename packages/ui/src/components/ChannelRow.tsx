import { memo, useMemo, useState, useCallback } from 'react';
import { ProgramBlock, EmptyProgramBlock } from './ProgramBlock';
import { ProgramContextMenu } from './ProgramContextMenu';
import { ChannelContextMenu } from './ChannelContextMenu';
import { FavoriteButton } from './FavoriteButton';
import { MetadataBadge } from './MetadataBadge';
import { RecordingIndicator } from './RecordingIndicator';
import type { StoredChannel, StoredProgram } from '../db';
import { normalizeBoolean } from '../utils/db-helpers';
import type { RecordingInfo } from '../hooks/useActiveRecordings';

// Channel column width is controlled via CSS custom property for resizability

interface ChannelRowProps {
  channel: StoredChannel;
  index: number;
  sortOrder: 'alphabetical' | 'number' | 'provider';
  programs: StoredProgram[];
  windowStart: Date;
  windowEnd: Date;
  pixelsPerHour: number;
  visibleHours: number;
  onPlay: () => void;
  onPlayCatchup?: (channel: StoredChannel, programTitle: string, startTimeMs: number, durationMinutes: number, programDesc?: string) => void;
  onFavoriteToggle?: () => void;
  categoryId?: string | null;
  activeRecordings?: RecordingInfo[];
  currentLayout?: string;
  onSendToSlot?: (slotId: 2 | 3 | 4, channelName: string, channelUrl: string, sourceName?: string | null) => void;
  onPlayInPopout?: (channel: StoredChannel) => void;
  onPlayInExternal?: (channel: StoredChannel) => void;
  isCurrentlyPlaying?: boolean;
  showPlaylistName?: boolean;
  sourceNames?: Map<string, string>;
}

export const ChannelRow = memo(function ChannelRow({
  channel,
  index,
  sortOrder,
  programs,
  windowStart,
  windowEnd,
  pixelsPerHour,
  visibleHours,
  onPlay,
  onPlayCatchup,
  onFavoriteToggle,
  categoryId,
  activeRecordings = [],
  currentLayout,
  onSendToSlot,
  onPlayInPopout,
  onPlayInExternal,
  isCurrentlyPlaying,
  showPlaylistName,
  sourceNames,
}: ChannelRowProps) {
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ program: StoredProgram; x: number; y: number } | null>(null);
  const [channelContextMenu, setChannelContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Show channel_num when sorting by number, otherwise show list position
  const displayNumber = sortOrder === 'number' && channel.channel_num !== undefined
    ? channel.channel_num
    : index + 1;

  // Normalize the is_favorite value (SQLite stores BOOLEAN as 0/1)
  const isFavorite = normalizeBoolean(channel.is_favorite);

  // Channel name is already filtered at the data level (useChannels hook)
  // No need to apply filter words here anymore

  // Check if this channel is being recorded
  const isRecording = useMemo(() => {
    return activeRecordings.some(r =>
      r.channelId === channel.stream_id && r.isRecording
    );
  }, [activeRecordings, channel.stream_id]);

  // Check if a program is scheduled to be recorded
  const isProgramScheduled = useCallback((program: StoredProgram): boolean => {
    const progStartMs = program.start instanceof Date ? program.start.getTime() : new Date(program.start).getTime();
    const progEndMs = program.end instanceof Date ? program.end.getTime() : new Date(program.end).getTime();
    return activeRecordings.some(r =>
      r.channelId === channel.stream_id &&
      r.startTime <= Math.floor(progEndMs / 1000) &&
      r.endTime >= Math.floor(progStartMs / 1000)
    );
  }, [activeRecordings, channel.stream_id]);

  // Handle context menu on programs
  function handleContextMenu(e: React.MouseEvent, program: StoredProgram) {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      program,
      x: e.clientX,
      y: e.clientY,
    });
  }

  // Handle context menu on channel
  function handleChannelContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    setChannelContextMenu({
      x: e.clientX,
      y: e.clientY,
    });
  }

  const isPlaylistNameShown = showPlaylistName && (categoryId === '__favorites__' || categoryId === '__recent__');

  return (
    <div className={`guide-channel-row ${isCurrentlyPlaying ? 'currently-playing' : ''} ${isPlaylistNameShown ? 'has-playlist-name' : ''}`}>
      {/* Channel info column */}
      <div
        className={`guide-channel-info ${isRecording ? 'is-recording' : ''} ${isPlaylistNameShown ? 'has-playlist-name' : ''}`}
        style={{
          width: 'var(--epg-channel-column-width, 264px)',
          minWidth: 'var(--epg-channel-column-width, 264px)',
          maxWidth: 'var(--epg-channel-column-width, 264px)'
        }}
        onClick={onPlay}
        onContextMenu={handleChannelContextMenu}
      >
        {isRecording && (
          <div className="channel-recording-indicator">
            <RecordingIndicator size="small" />
          </div>
        )}
        <FavoriteButton
          streamId={channel.stream_id}
          isFavorite={isFavorite}
          onToggle={onFavoriteToggle}
        />
        <div className="guide-channel-logo">
          {channel.stream_icon ? (
            <img
              key={channel.stream_icon}
              src={channel.stream_icon}
              alt=""
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="logo-placeholder">{(channel.alias || channel.name).charAt(0)}</span>
          )}
        </div>
        <div className="guide-channel-name-container">
          <span className="guide-channel-name" title={channel.alias || channel.name}>
            {channel.alias || channel.name}
            {(Boolean(channel.tv_archive) || channel.tv_archive === 1) && (
              <span style={{ color: '#e5a00d', marginLeft: '4px', fontSize: '1.1em', verticalAlign: 'middle' }}>↺</span>
            )}
            {channel.is_adult && (
              <span className="adult-badge" title="Adult channel" style={{
                backgroundColor: 'rgba(220, 53, 69, 0.85)',
                color: '#fff',
                fontSize: '0.65em',
                fontWeight: 700,
                padding: '1px 4px',
                borderRadius: '3px',
                marginLeft: '5px',
                verticalAlign: 'middle',
                letterSpacing: '0.3px',
                lineHeight: 1,
                display: 'inline-block',
              }}>18+</span>
            )}
          </span>
          {showPlaylistName && (categoryId === '__favorites__' || categoryId === '__recent__') && (
            <span className="guide-channel-playlist-name" title={sourceNames?.get(channel.source_id) || channel.source_id}>
              {sourceNames?.get(channel.source_id) || channel.source_id}
            </span>
          )}
        </div>
        <div className="channel-row-metadata">
          <MetadataBadge streamId={channel.stream_id} variant="detailed" />
        </div>
      </div>

      {/* Program grid */}
      <div className="guide-program-grid">
        {programs.length > 0 ? (
          programs.map((program, index, arr) => {
            // Check if this specific program is being recorded or scheduled
            // Use programStartTime/programEndTime for precise matching (without padding)
            const progStartMs = program.start instanceof Date ? program.start.getTime() : new Date(program.start).getTime();
            const originalEndMs = program.end instanceof Date ? program.end.getTime() : new Date(program.end).getTime();
            
            let progEndMs = originalEndMs;
            if (index < arr.length - 1) {
              const nextProgram = arr[index + 1];
              const nextStartMs = nextProgram.start instanceof Date ? nextProgram.start.getTime() : new Date(nextProgram.start).getTime();
              if (progEndMs > nextStartMs) {
                progEndMs = nextStartMs;
              }
            }

            const clampedProgram = progEndMs !== originalEndMs ? { ...program, end: new Date(progEndMs) } : program;

            const progStartSec = Math.floor(progStartMs / 1000);
            const progEndSec = Math.floor(originalEndMs / 1000);

            const matchingRecording = activeRecordings.find(r =>
              r.channelId === channel.stream_id &&
              // Match based on program times (without padding) for precise program matching
              r.programStartTime <= progEndSec &&
              r.programEndTime >= progStartSec &&
              // Also verify the recording actually overlaps with this program
              r.startTime < progEndSec &&
              r.endTime > progStartSec
            );
            const isProgramRecording = matchingRecording?.isRecording ?? false;
            const isProgramScheduled = matchingRecording?.isScheduled ?? false;
            const isCatchupAvailable = Boolean(channel.tv_archive) || channel.tv_archive === 1;

            return (
              <ProgramBlock
                key={program.id}
                program={clampedProgram}
                channel={channel}
                windowStart={windowStart}
                windowEnd={windowEnd}
                pixelsPerHour={pixelsPerHour}
                onClick={onPlay}
                onPlayCatchup={onPlayCatchup}
                onContextMenu={(e) => handleContextMenu(e, program)}
                isRecording={isProgramRecording}
                isScheduled={isProgramScheduled}
                isCatchupAvailable={isCatchupAvailable}
              />
            );
          })
        ) : (
          <EmptyProgramBlock pixelsPerHour={pixelsPerHour} visibleHours={visibleHours} />
        )}
      </div>

      {/* Program Context Menu */}
      {contextMenu && (
        <ProgramContextMenu
          program={contextMenu.program}
          sourceId={channel.source_id}
          channelId={channel.stream_id}
          channelName={channel.name}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Channel Context Menu */}
      {channelContextMenu && (
        <ChannelContextMenu
          channel={channel}
          position={{ x: channelContextMenu.x, y: channelContextMenu.y }}
          onClose={() => setChannelContextMenu(null)}
          currentLayout={currentLayout}
          onSendToSlot={onSendToSlot}
          onPlayInPopout={onPlayInPopout}
          onPlayInExternal={onPlayInExternal}
        />
      )}
    </div>
  );
});

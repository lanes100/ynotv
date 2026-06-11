import { useState, useCallback } from 'react';
import type { StremioStream } from '../../types/stremio';
import { useDownloadStore } from '../../stores/downloadStore';
import './StreamPickerModal.css';

interface StreamPickerModalProps {
  streams: StremioStream[];
  onSelect: (stream: StremioStream) => void;
  onClose: () => void;
  meta?: any;
  selectedVideo?: any;
}

export function StreamPickerModal({ streams, onSelect, onClose, meta, selectedVideo }: StreamPickerModalProps) {
  const directStreams = streams.filter(s => s.url);
  const torrentStreams = streams.filter(s => s.infoHash);

  const startDownload = useDownloadStore((s) => s.startDownload);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  const handleDownloadStream = useCallback(
    async (stream: StremioStream, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!stream.url) return;
      setDownloadingUrl(stream.url);
      try {
        let title = '';
        if (meta) {
          if (meta.type === 'series' && selectedVideo) {
            title = `${meta.name} - S${selectedVideo.season}E${selectedVideo.episode}${selectedVideo.title ? ` - ${selectedVideo.title}` : ''}`;
          } else {
            title = `${meta.name}${meta.year ? ` (${meta.year})` : ''}`;
          }
        } else {
          title = stream.title || stream.name || 'Stremio Stream';
        }
        await startDownload(
          title,
          stream.url,
          undefined,
          undefined,
          undefined,
          meta?.poster || undefined
        );
      } catch (error) {
        console.error('[StreamPickerModal] Stream download failed:', error);
        alert('Failed to start download');
      } finally {
        setDownloadingUrl(null);
      }
    },
    [meta, selectedVideo, startDownload]
  );

  return (
    <div className="stremio-picker-overlay" onClick={onClose}>
      <div className="stremio-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stremio-picker-header">
          <h3 className="stremio-picker-title">Pick a Stream</h3>
          <button className="stremio-picker-close" onClick={onClose}>✕</button>
        </div>

        <div className="stremio-picker-body">
          {directStreams.length > 0 && (
            <div className="stremio-picker-section">
              <h4 className="stremio-picker-section-title">Direct Streams</h4>
              {directStreams.map((s, i) => {
                const name = s.name || '';
                const desc = s.description || s.title || '';
                const displayName = name || desc || `Stream #${i + 1}`;
                const displayDesc = name ? desc : '';
                return (
                  <div key={`direct-${i}`} className="stremio-picker-item-row">
                    <button className="stremio-picker-item" onClick={() => onSelect(s)}>
                      <div className="stremio-picker-item-name">{displayName}</div>
                      {displayDesc && <div className="stremio-picker-item-desc">{displayDesc}</div>}
                      <div className="stremio-picker-item-source">{s.addonName}</div>
                    </button>
                    {s.url && (
                      <button
                        className={`stremio-picker-item-download ${downloadingUrl === s.url ? 'downloading' : ''}`}
                        onClick={(e) => handleDownloadStream(s, e)}
                        disabled={downloadingUrl === s.url}
                        title="Download Stream"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {downloadingUrl === s.url ? (
                            <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" style={{ transformOrigin: 'center', animation: 'spin 1.5s linear infinite' }} />
                          ) : (
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3" strokeLinecap="round" strokeLinejoin="round" />
                          )}
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {torrentStreams.length > 0 && (
            <div className="stremio-picker-section">
              <h4 className="stremio-picker-section-title">
                Torrent Streams ({torrentStreams.length})
                <span className="stremio-picker-section-sub">(resolved via debrid)</span>
              </h4>
              {torrentStreams.map((s, i) => {
                const name = s.name || '';
                const desc = s.description || s.title || '';
                const displayName = name || desc || `Torrent #${i + 1}`;
                const displayDesc = name ? desc : '';
                return (
                  <button key={`torrent-${i}`} className="stremio-picker-item" onClick={() => onSelect(s)}>
                    <div className="stremio-picker-item-name">{displayName}</div>
                    {displayDesc && <div className="stremio-picker-item-desc">{displayDesc}</div>}
                    <div className="stremio-picker-item-hash">
                      infoHash: {s.infoHash?.substring(0, 16)}...
                      {s.fileIdx !== undefined && ` | fileIdx: ${s.fileIdx}`}
                    </div>
                    <div className="stremio-picker-item-source">{s.addonName}</div>
                  </button>
                );
              })}
            </div>
          )}

          {streams.length === 0 && (
            <div className="stremio-picker-empty">No streams available.</div>
          )}
        </div>
      </div>
    </div>
  );
}

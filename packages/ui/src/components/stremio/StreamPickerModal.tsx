import type { StremioStream } from '../../types/stremio';
import './StreamPickerModal.css';

interface StreamPickerModalProps {
  streams: StremioStream[];
  onSelect: (stream: StremioStream) => void;
  onClose: () => void;
}

export function StreamPickerModal({ streams, onSelect, onClose }: StreamPickerModalProps) {
  const directStreams = streams.filter(s => s.url);
  const torrentStreams = streams.filter(s => s.infoHash);

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
                  <button key={`direct-${i}`} className="stremio-picker-item" onClick={() => onSelect(s)}>
                    <div className="stremio-picker-item-name">{displayName}</div>
                    {displayDesc && <div className="stremio-picker-item-desc">{displayDesc}</div>}
                    <div className="stremio-picker-item-source">{s.addonName}</div>
                  </button>
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

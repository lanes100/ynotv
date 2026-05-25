import type { StremioStreamPickerMode } from '../../types/stremio';

interface StremTabProps {
  stremioStreamPickerMode: StremioStreamPickerMode;
  onStremioStreamPickerModeChange: (mode: StremioStreamPickerMode) => Promise<void>;
}

export function StremTab({ stremioStreamPickerMode, onStremioStreamPickerModeChange }: StremTabProps) {
  return (
    <div className="settings-section">
      <h3 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
        Strem Playback
      </h3>
      <p style={{ margin: '0 0 12px 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
        Choose how streams from Stremio addons are played.
      </p>
      <div className="retry-setting-row" style={{ borderBottom: 'none' }}>
        <div className="timeshift-toggle-info">
          <span className="timeshift-toggle-label">Stream Picker Mode</span>
          <span className="timeshift-toggle-sub">
            Show a picker modal to choose which stream to play, or auto-play the first direct stream.
          </span>
        </div>
        <div className="stremio-picker-toggle">
          <button
            className={`stremio-picker-btn ${stremioStreamPickerMode === 'modal' ? 'active' : ''}`}
            onClick={() => onStremioStreamPickerModeChange('modal')}
          >
            Show Picker
          </button>
          <button
            className={`stremio-picker-btn ${stremioStreamPickerMode === 'autoplay' ? 'active' : ''}`}
            onClick={() => onStremioStreamPickerModeChange('autoplay')}
          >
            Auto-play
          </button>
        </div>
      </div>
    </div>
  );
}

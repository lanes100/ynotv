import './PlaybackTab.css'; // Reuse existing tab styles

interface PopoutTabProps {
  popoutStopMain: boolean;
  onPopoutStopMainChange: (stop: boolean) => void;
  popoutAlwaysOnTop: boolean;
  onPopoutAlwaysOnTopChange: (onTop: boolean) => void;
}

export function PopoutTab({
  popoutStopMain,
  onPopoutStopMainChange,
  popoutAlwaysOnTop,
  onPopoutAlwaysOnTopChange,
}: PopoutTabProps) {
  return (
    <div className="playback-tab-content">
      <div className="settings-section">
        <h3 className="settings-section-title">Popout Player</h3>
        <p className="settings-section-description">
          Control how the standalone popout MPV player behaves when activated.
        </p>

        <div className="timeshift-settings" style={{ marginTop: '16px' }}>
          {/* Stop main player */}
          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Stop main player when popout opens</span>
              <span className="timeshift-toggle-sub">
                When enabled, the embedded player in the main window will stop when a popout is opened.
                Disable this to keep both playing simultaneously (like multiview in separate windows).
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={popoutStopMain}
                onChange={(e) => onPopoutStopMainChange(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {/* Always on top */}
          <div className="timeshift-toggle-row" style={{ marginTop: '12px' }}>
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Always on top</span>
              <span className="timeshift-toggle-sub">
                Keep the popout window above all other windows. Useful for watching while browsing.
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={popoutAlwaysOnTop}
                onChange={(e) => onPopoutAlwaysOnTopChange(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

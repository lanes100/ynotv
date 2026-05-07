import './PlaybackTab.css'; // Reuse existing tab styles

interface LiveViewTabProps {
  channelInfoOverlayEnabled: boolean;
  onChannelInfoOverlayChange: (enabled: boolean) => void;
  channelInfoOverlayFontSize: number;
  onChannelInfoOverlayFontSizeChange: (size: number) => void;
  channelInfoOverlayLogoSize: number;
  onChannelInfoOverlayLogoSizeChange: (size: number) => void;
  channelInfoOverlayBoxWidth: number;
  onChannelInfoOverlayBoxWidthChange: (width: number) => void;
  channelInfoOverlayOpacity: number;
  onChannelInfoOverlayOpacityChange: (opacity: number) => void;
  channelInfoOverlayHideDescription: boolean;
  onChannelInfoOverlayHideDescriptionChange: (hide: boolean) => void;
}

export function LiveViewTab({
  channelInfoOverlayEnabled,
  onChannelInfoOverlayChange,
  channelInfoOverlayFontSize,
  onChannelInfoOverlayFontSizeChange,
  channelInfoOverlayLogoSize,
  onChannelInfoOverlayLogoSizeChange,
  channelInfoOverlayBoxWidth,
  onChannelInfoOverlayBoxWidthChange,
  channelInfoOverlayOpacity,
  onChannelInfoOverlayOpacityChange,
  channelInfoOverlayHideDescription,
  onChannelInfoOverlayHideDescriptionChange,
}: LiveViewTabProps) {
  return (
    <div className="settings-tab-content playback-tab-content">
      <div className="settings-section">
        <div className="section-header">
          <h3>Channel Information Overlay</h3>
        </div>
        <p className="section-description">
          When enabled, channel information (logo, name, metadata, and EPG) is moved from the Now Playing bar to a dedicated overlay that appears briefly when switching channels.
        </p>

        <div className="timeshift-settings">
          {/* Enable Channel Information Overlay */}
          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Enable channel information</span>
              <span className="timeshift-toggle-sub">
                When enabled, the Now Playing bar hides the channel logo, name, resolution/fps/audio metadata, and EPG info. Instead, this information appears in a transparent box at the top-left when switching channels, and auto-hides after a few seconds — similar to classic cable TV channel surfing.
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={channelInfoOverlayEnabled}
                onChange={(e) => onChannelInfoOverlayChange(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Hide Program Description */}
          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Hide Program Summary</span>
              <span className="timeshift-toggle-sub">
                When enabled, the program description text will be hidden from the overlay. The title, time, and progress bar will still be shown.
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={channelInfoOverlayHideDescription}
                onChange={(e) => onChannelInfoOverlayHideDescriptionChange(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>

      {channelInfoOverlayEnabled && (
        <>
          {/* Overlay Appearance Settings */}
          <div className="settings-section">
            <div className="section-header">
              <h3>Overlay Appearance</h3>
            </div>
            <p className="section-description">
              Customize the size and transparency of the channel info overlay.
            </p>

            <div className="timeshift-settings">
              {/* Font Size */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.9)' }}>Text Size</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input
                    type="range"
                    min="10"
                    max="28"
                    value={channelInfoOverlayFontSize}
                    onChange={(e) => onChannelInfoOverlayFontSizeChange(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ minWidth: '3rem', textAlign: 'right', color: 'rgba(255,255,255,0.8)' }}>
                    {channelInfoOverlayFontSize}px
                  </span>
                </div>
                <p className="form-hint" style={{ marginTop: '0.5rem' }}>
                  Adjusts the channel name and program text size.
                </p>
              </div>

              {/* Logo Size */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.9)' }}>Logo Size</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input
                    type="range"
                    min="24"
                    max="72"
                    value={channelInfoOverlayLogoSize}
                    onChange={(e) => onChannelInfoOverlayLogoSizeChange(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ minWidth: '3rem', textAlign: 'right', color: 'rgba(255,255,255,0.8)' }}>
                    {channelInfoOverlayLogoSize}px
                  </span>
                </div>
                <p className="form-hint" style={{ marginTop: '0.5rem' }}>
                  Adjusts the channel logo dimensions.
                </p>
              </div>

              {/* Box Width */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.9)' }}>Box Width</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input
                    type="range"
                    min="200"
                    max="600"
                    step="10"
                    value={channelInfoOverlayBoxWidth}
                    onChange={(e) => onChannelInfoOverlayBoxWidthChange(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ minWidth: '3rem', textAlign: 'right', color: 'rgba(255,255,255,0.8)' }}>
                    {channelInfoOverlayBoxWidth}px
                  </span>
                </div>
                <p className="form-hint" style={{ marginTop: '0.5rem' }}>
                  Adjusts the maximum width of the overlay box.
                </p>
              </div>

              {/* Background Opacity */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.9)' }}>Background Opacity</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input
                    type="range"
                    min="20"
                    max="90"
                    value={channelInfoOverlayOpacity}
                    onChange={(e) => onChannelInfoOverlayOpacityChange(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ minWidth: '3rem', textAlign: 'right', color: 'rgba(255,255,255,0.8)' }}>
                    {channelInfoOverlayOpacity}%
                  </span>
                </div>
                <p className="form-hint" style={{ marginTop: '0.5rem' }}>
                  Lower values make the overlay more transparent. Higher values make it more opaque.
                </p>
              </div>

              {/* Reset Button */}
              <div style={{ marginTop: '16px' }}>
                <button
                  className="sync-btn"
                  onClick={() => {
                    onChannelInfoOverlayFontSizeChange(16);
                    onChannelInfoOverlayLogoSizeChange(42);
                    onChannelInfoOverlayBoxWidthChange(380);
                    onChannelInfoOverlayOpacityChange(55);
                  }}
                  style={{ maxWidth: '200px' }}
                >
                  Reset to Default
                </button>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="settings-section">
            <div className="section-header">
              <h3>Preview</h3>
            </div>
            <p className="section-description">
              This is how the overlay will look when switching channels.
            </p>
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
              <div
                style={{
                  maxWidth: `${channelInfoOverlayBoxWidth}px`,
                  background: `rgba(0, 0, 0, ${channelInfoOverlayOpacity / 100})`,
                  backdropFilter: 'blur(12px)',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: `${channelInfoOverlayLogoSize}px`,
                      height: `${channelInfoOverlayLogoSize}px`,
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      color: 'rgba(255,255,255,0.4)',
                      flexShrink: 0,
                    }}
                  >
                    Logo
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                    <span style={{ fontSize: `${channelInfoOverlayFontSize}px`, fontWeight: 700, color: 'rgba(255,255,255,0.95)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Channel Name
                    </span>
                    <span style={{ fontSize: `${Math.max(10, channelInfoOverlayFontSize - 4)}px`, color: 'rgba(255,255,255,0.55)' }}>
                      Current Program Title
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

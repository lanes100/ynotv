import './PlaybackTab.css'; // Reuse existing tab styles
import './WidgetsTab.css';

interface WidgetsTabProps {
  widgetScale: number;
  onWidgetScaleChange: (scale: number) => void;
}

export function WidgetsTab({ widgetScale, onWidgetScaleChange }: WidgetsTabProps) {
  const scalePercent = Math.round(widgetScale * 100);

  return (
    <div className="settings-tab-content playback-tab-content">

      {/* ── Overlay Widgets ── */}
      <div className="settings-section">
        <div className="section-header">
          <h3>Overlay Widgets</h3>
        </div>
        <p className="section-description">
          Adjust the size of the Recent and Favorites overlay widgets that appear on the main
          screen. Scaling up makes the boxes and text larger; scaling down makes them smaller —
          useful for high-res or small displays.
        </p>

        <div className="timeshift-settings">
          {/* Scale slider */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.9)' }}>
              Widget Scale
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', minWidth: '28px' }}>50%</span>
              <input
                type="range"
                min="50"
                max="200"
                step="5"
                value={scalePercent}
                onChange={(e) => onWidgetScaleChange(parseInt(e.target.value) / 100)}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', minWidth: '32px', textAlign: 'right' }}>200%</span>
              <span
                className="widget-scale-value"
                style={{
                  minWidth: '46px',
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.9)',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  background: 'rgba(255,255,255,0.07)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                }}
              >
                {scalePercent}%
              </span>
            </div>
            <p className="form-hint" style={{ marginTop: '0.5rem' }}>
              Default is 100%. Changes apply instantly to the live overlay.
            </p>
          </div>

          {/* Quick-preset buttons */}
          <div className="timeshift-presets-label">Quick Presets</div>
          <div className="timeshift-presets">
            {[75, 100, 125, 150].map((pct) => (
              <button
                key={pct}
                className={`timeshift-preset-btn${scalePercent === pct ? ' active' : ''}`}
                onClick={() => onWidgetScaleChange(pct / 100)}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Reset */}
          <div style={{ marginTop: '20px' }}>
            <button
              className="sync-btn"
              onClick={() => onWidgetScaleChange(1)}
              style={{ maxWidth: '180px' }}
            >
              Reset to 100%
            </button>
          </div>
        </div>
      </div>

      {/* ── Live Preview ── */}
      <div className="settings-section">
        <div className="section-header">
          <h3>Preview</h3>
        </div>
        <p className="section-description">
          This is how the widgets will look at the selected scale.
        </p>

        <div className="widget-preview-area">
          {/* Scaled wrapper */}
          <div
            className="widget-preview-scaled"
            style={{ transform: `scale(${widgetScale})`, transformOrigin: 'top left' }}
          >
            {/* Recent widget mock */}
            <div className="widget-preview-box">
              <div className="widget-preview-header">Recent 5</div>
              <div className="widget-preview-list">
                {['Animal Planet  -  I Was Prey', 'BET  -  Martin', 'Animal Planet HD  -  I Was Prey', 'ASPiRE TV  -  The Bernie Mac Show', 'US | ABC  -  The Golden Girls'].map((item, i) => (
                  <div key={i} className="widget-preview-item">
                    <span className="widget-preview-name">{item.split('  -  ')[0]}</span>
                    {item.includes('  -  ') && (
                      <>
                        <span className="widget-preview-sep"> - </span>
                        <span className="widget-preview-prog">{item.split('  -  ')[1]}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Favorites widget mock */}
            <div className="widget-preview-box widget-preview-box--fav">
              <div className="widget-preview-header">Favorites</div>
              <div className="widget-preview-list">
                {['US | ABC  -  The Golden Girls', 'BUZZER  -  Match Game Hollywood', 'US | Discovery Channel  -  Caught!', 'US | Comedy Central  -  Family Guy', 'US | Fox HD  -  Kelly Clarkson'].map((item, i) => (
                  <div key={i} className="widget-preview-item widget-preview-item--fav">
                    <span className="widget-preview-name">{item.split('  -  ')[0]}</span>
                    {item.includes('  -  ') && (
                      <>
                        <span className="widget-preview-sep"> - </span>
                        <span className="widget-preview-prog">{item.split('  -  ')[1]}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Spacer that matches the scaled content height so the section doesn't collapse */}
          <div
            aria-hidden="true"
            style={{
              height: `calc(${Math.round((172 + 36) * widgetScale)}px + 8px)`,
              width: `calc(${Math.round(700 * widgetScale)}px)`,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

    </div>
  );
}

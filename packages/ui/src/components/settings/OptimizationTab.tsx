import { useAppSettings } from '../../hooks/useAppSettings';

export function OptimizationTab() {
  const {
    disableThemeBlobs,
    setDisableThemeBlobs,
    disableThemeBackdropBlur,
    setDisableThemeBackdropBlur,
    epgLazyLoadingEnabled,
    setEpgLazyLoadingEnabled,
    disableEpgTransitions,
    setDisableEpgTransitions,
    epgReduceGpuLayers,
    setEpgReduceGpuLayers,
    epgDisableChannelFade,
    setEpgDisableChannelFade,
  } = useAppSettings();

  return (
    <div className="settings-tab-content">
      {/* Theme Optimization Section */}
      <div className="settings-section" style={{ paddingTop: '8px' }}>
        <div className="section-header">
          <h3>Theme Optimization</h3>
        </div>

        <p className="section-description">
          Customize theme rendering performance. If you experience high GPU usage, interface lag, or frame drops when using the glass, gradient, or solid themes, you can disable individual intensive effects here.
        </p>

        <div className="tmdb-form" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label className="genre-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', maxWidth: '450px' }}>
              <input
                type="checkbox"
                checked={disableThemeBlobs}
                onChange={(e) => setDisableThemeBlobs(e.target.checked)}
              />
              <span className="genre-name" style={{ fontWeight: 600, fontSize: '0.95rem' }}>Disable Background Animations (Glass Blobs)</span>
            </label>
            <p className="form-hint" style={{ marginTop: '0.4rem', marginLeft: '26px', opacity: 0.8, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Hides the animated floating glass blobs and ambient background glows. This is the most effective way to eliminate idle GPU load for themes.
            </p>
          </div>

          <div>
            <label className="genre-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', maxWidth: '450px' }}>
              <input
                type="checkbox"
                checked={disableThemeBackdropBlur}
                onChange={(e) => setDisableThemeBackdropBlur(e.target.checked)}
              />
              <span className="genre-name" style={{ fontWeight: 600, fontSize: '0.95rem' }}>Disable Glass Backdrop Blur</span>
            </label>
            <p className="form-hint" style={{ marginTop: '0.4rem', marginLeft: '26px', opacity: 0.8, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Removes the backdrop blur effect from cards, menus, and overlays. Significantly increases UI responsiveness on integrated or older graphics processors.
            </p>
          </div>
        </div>
      </div>

      {/* EPG Optimization Section */}
      <div className="settings-section" style={{ marginTop: '2rem' }}>
        <div className="section-header">
          <h3>EPG Optimization</h3>
        </div>

        <p className="section-description">
          Optimize EPG guide performance and loading speeds, especially when using large playlists.
        </p>

        <div className="tmdb-form" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label className="genre-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', maxWidth: '450px' }}>
              <input
                type="checkbox"
                checked={epgLazyLoadingEnabled}
                onChange={(e) => setEpgLazyLoadingEnabled(e.target.checked)}
              />
              <span className="genre-name" style={{ fontWeight: 600, fontSize: '0.95rem' }}>Enable EPG Lazy Loading</span>
            </label>
            <p className="form-hint" style={{ marginTop: '0.4rem', marginLeft: '26px', opacity: 0.8, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Only loads EPG programs for the visible time window (plus a small scroll buffer) rather than loading the entire EPG guide database upfront. Recommended for large playlists to reduce memory usage and scroll lag.
            </p>
          </div>

          <div>
            <label className="genre-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', maxWidth: '450px' }}>
              <input
                type="checkbox"
                checked={disableEpgTransitions}
                onChange={(e) => setDisableEpgTransitions(e.target.checked)}
              />
              <span className="genre-name" style={{ fontWeight: 600, fontSize: '0.95rem' }}>Disable EPG Card Shadows & Transitions</span>
            </label>
            <p className="form-hint" style={{ marginTop: '0.4rem', marginLeft: '26px', opacity: 0.8, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Disables animations, hover scales, and drop shadows on the timeline program blocks, channel info hover transitions, and the channel name marquee scroll. Reduces GPU paint spikes when scrolling the guide.
            </p>
          </div>

          <div>
            <label className="genre-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', maxWidth: '450px' }}>
              <input
                type="checkbox"
                checked={epgReduceGpuLayers}
                onChange={(e) => setEpgReduceGpuLayers(e.target.checked)}
              />
              <span className="genre-name" style={{ fontWeight: 600, fontSize: '0.95rem' }}>Reduce EPG GPU Layer Usage</span>
            </label>
            <p className="form-hint" style={{ marginTop: '0.4rem', marginLeft: '26px', opacity: 0.8, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Removes persistent GPU compositing layers from channel rows and the scroll container. Adds layout containment so repaints are isolated per row.
            </p>
          </div>

          <div>
            <label className="genre-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', maxWidth: '450px' }}>
              <input
                type="checkbox"
                checked={epgDisableChannelFade}
                onChange={(e) => setEpgDisableChannelFade(e.target.checked)}
              />
              <span className="genre-name" style={{ fontWeight: 600, fontSize: '0.95rem' }}>Disable EPG Channel Name Gradient Fade</span>
            </label>
            <p className="form-hint" style={{ marginTop: '0.4rem', marginLeft: '26px', opacity: 0.8, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Removes the soft gradient fade on the right edge of long channel names (each one creates a GPU compositing layer). Also disables smooth-scroll on the guide list. Visual trade-off: long names show ellipsis (…) instead of a gradient fade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

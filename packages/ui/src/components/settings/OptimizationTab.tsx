import { useAppSettings } from '../../hooks/useAppSettings';

export function OptimizationTab() {
  const {
    disableThemeBlobs,
    setDisableThemeBlobs,
    disableThemeBackdropBlur,
    setDisableThemeBackdropBlur,
  } = useAppSettings();

  return (
    <div className="settings-tab-content">
      <div className="settings-section" style={{ paddingTop: '8px' }}>
        <div className="section-header">
          <h3>Theme Optimization</h3>
        </div>

        <p className="section-description">
          Customize theme rendering performance. If you experience high GPU usage, interface lag, or frame drops when using the glass, gradient, or solid themes, you can disable individual intensive effects here.
        </p>

        <div className="tmdb-form" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label className="genre-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', maxWidth: '400px' }}>
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
            <label className="genre-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', maxWidth: '400px' }}>
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
    </div>
  );
}

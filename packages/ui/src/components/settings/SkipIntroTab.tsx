import './PlaybackTab.css';

interface SkipIntroTabProps {
  skipIntroTimerSeconds: number;
  onSkipIntroTimerSecondsChange: (seconds: number) => void;
  skipIntroAutoSkip: boolean;
  onSkipIntroAutoSkipChange: (auto: boolean) => void;
}

export function SkipIntroTab({
  skipIntroTimerSeconds,
  onSkipIntroTimerSecondsChange,
  skipIntroAutoSkip,
  onSkipIntroAutoSkipChange,
}: SkipIntroTabProps) {
  return (
    <div className="playback-tab-content" style={{ overflow: 'auto', height: '100%' }}>
      <div className="settings-section">
        <h3 className="settings-section-title">Skip Intro</h3>
        <p className="settings-section-description">
          Configure the IntroDB-powered skip intro feature for series episodes.
          When a valid intro entry exists from the IntroDB API, the app can show a
          skip button or skip automatically.
        </p>

        <div className="timeshift-settings" style={{ marginTop: '16px' }}>
          {/* Auto-skip toggle */}
          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Automatic Intro Skip</span>
              <span className="timeshift-toggle-sub">
                When enabled, the intro will be skipped automatically as soon as it
                starts — no button needed. Disable to show the skip button instead.
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={skipIntroAutoSkip}
                onChange={(e) => onSkipIntroAutoSkipChange(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {/* Timer duration */}
          <div className="retry-setting-row" style={{ marginTop: '16px' }}>
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Skip Button Duration</span>
              <span className="timeshift-toggle-sub">
                How many seconds the skip button stays visible before auto-dismissing
                (only applies when Automatic Intro Skip is disabled).
              </span>
            </div>
            <div className="retry-input-wrapper">
              <input
                id="skip-intro-timer"
                type="number"
                min={3}
                max={30}
                step={1}
                className="retry-number-input"
                value={skipIntroTimerSeconds}
                onChange={(e) => {
                  const n = Math.max(3, Math.min(30, parseInt(e.target.value, 10) || 10));
                  onSkipIntroTimerSecondsChange(n);
                }}
              />
              <span className="retry-input-unit">sec</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

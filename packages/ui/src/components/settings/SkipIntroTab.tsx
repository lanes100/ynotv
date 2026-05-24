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
    <div className="settings-tab-content">
      <div className="settings-section" style={{ paddingTop: '8px' }}>
        <div className="section-header">
          <h3>Skip Intro</h3>
        </div>
        <p className="section-description">
          Configure the IntroDB-powered skip intro feature for series episodes.
          When a valid intro entry exists from the IntroDB API, the app can show a
          skip button or skip automatically.
        </p>

        <div className="timeshift-settings">
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

          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Skip Button Duration</span>
              <span className="timeshift-toggle-sub">
                How many seconds the skip button stays visible before auto-dismissing
                (only applies when Automatic Intro Skip is disabled).
              </span>
            </div>
            <input
              type="number"
              min={3}
              max={30}
              step={1}
              value={skipIntroTimerSeconds}
              onChange={(e) => {
                const n = Math.max(3, Math.min(30, parseInt(e.target.value, 10) || 10));
                onSkipIntroTimerSecondsChange(n);
              }}
              className="query-input"
              style={{ width: '80px', textAlign: 'center' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
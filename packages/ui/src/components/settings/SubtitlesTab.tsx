import { useState, useEffect, useCallback } from 'react';
import { validateSubSourceApiKey } from '../../services/subsource';
import './PlaybackTab.css'; // Reuse existing tab styles

export interface SubtitleSettings {
  subsourceApiKey: string;
  defaultLanguage: string;
  defaultSize: number;
  subColor: string;
  subBackgroundColor: string;
  subOutlineColor: string;
  subDelay: number;
  subVerticalOffset: number;
}

const DEFAULT_SETTINGS: SubtitleSettings = {
  subsourceApiKey: '',
  defaultLanguage: 'en',
  defaultSize: 35,
  subColor: '#FFFFFF',
  subBackgroundColor: '#000000',
  subOutlineColor: '#000000',
  subDelay: 0,
  subVerticalOffset: 0,
};

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'no', label: 'Norwegian' },
  { code: 'fi', label: 'Finnish' },
  { code: 'cs', label: 'Czech' },
  { code: 'el', label: 'Greek' },
  { code: 'he', label: 'Hebrew' },
  { code: 'id', label: 'Indonesian' },
  { code: 'ms', label: 'Malay' },
  { code: 'th', label: 'Thai' },
  { code: 'vi', label: 'Vietnamese' },
];

interface SubtitlesTabProps {
  settings: SubtitleSettings;
  onSettingsChange: (settings: Partial<SubtitleSettings>) => void;
}

export function SubtitlesTab({ settings, onSettingsChange }: SubtitlesTabProps) {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  const [localKey, setLocalKey] = useState(merged.subsourceApiKey);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    setLocalKey(merged.subsourceApiKey);
    if (merged.subsourceApiKey) {
      setKeyValid(true); // assume valid if previously saved
    } else {
      setKeyValid(null);
    }
  }, [merged.subsourceApiKey]);

  const handleSaveKey = useCallback(async () => {
    if (!window.storage) return;
    setValidating(true);
    setKeyValid(null);

    const trimmed = localKey.trim();
    if (!trimmed) {
      // Empty key: just clear it (valid)
      setKeyValid(true);
      await window.storage.updateSettings({ subtitleSettings: { ...merged, subsourceApiKey: '' } });
      onSettingsChange({ subsourceApiKey: '' });
      setValidating(false);
      return;
    }

    const isValid = await validateSubSourceApiKey(trimmed);
    setKeyValid(isValid);

    if (isValid) {
      await window.storage.updateSettings({ subtitleSettings: { ...merged, subsourceApiKey: trimmed } });
      onSettingsChange({ subsourceApiKey: trimmed });
    }

    setValidating(false);
  }, [localKey, merged, onSettingsChange]);

  const update = useCallback(
    (partial: Partial<SubtitleSettings>) => {
      onSettingsChange(partial);
    },
    [onSettingsChange]
  );

  return (
    <div className="settings-tab-content playback-tab-content">
      {/* SubSource API Section */}
      <div className="settings-section">
        <div className="section-header">
          <h3>SubSource Integration</h3>
        </div>
        <p className="section-description">
          SubSource provides subtitles for movies and series. Enter your API key below.
          <br />
          <a
            href="https://subsource.net/dashboard/profile"
            target="_blank"
            rel="noopener noreferrer"
            className="tmdb-link"
          >
            Get your API key here
          </a>
        </p>

        <div className="tmdb-form">
            <div className="form-group inline">
            <label>API Key</label>
            <input
              type="password"
              value={localKey}
              onChange={(e) => {
                setLocalKey(e.target.value);
                setKeyValid(null);
              }}
              placeholder="Enter your SubSource API key"
            />
            <button
              type="button"
              onClick={handleSaveKey}
              disabled={validating}
              className={keyValid === true ? 'success' : keyValid === false ? 'error' : ''}
            >
              {validating ? 'Validating...' : keyValid === true ? 'Valid' : keyValid === false ? 'Invalid' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Default Appearance Section */}
      <div className="settings-section" style={{ marginTop: '2rem' }}>
        <div className="section-header">
          <h3>Default Appearance</h3>
        </div>
        <p className="section-description">
          Configure how subtitles look by default. These settings can be adjusted per-video from the player.
        </p>

        <div className="timeshift-settings">
          {/* Default Language */}
          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Default Language</span>
              <span className="timeshift-toggle-sub">Preferred subtitle language for auto-selection.</span>
            </div>
            <select
              value={merged.defaultLanguage}
              onChange={(e) => update({ defaultLanguage: e.target.value })}
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Default Size */}
          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Default Size</span>
              <span className="timeshift-toggle-sub">Base font size for subtitles (can be adjusted per-video).</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px', justifyContent: 'flex-end' }}>
              <input
                type="range"
                min="10"
                max="80"
                value={merged.defaultSize}
                onChange={(e) => update({ defaultSize: parseInt(e.target.value) })}
                style={{ width: '140px' }}
              />
              <span style={{ minWidth: '32px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {merged.defaultSize}
              </span>
            </div>
          </div>

          {/* Subtitle Color */}
          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Text Color</span>
              <span className="timeshift-toggle-sub">Color of the subtitle text.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="color"
                value={merged.subColor}
                onChange={(e) => update({ subColor: e.target.value })}
                style={{ width: '40px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                {merged.subColor}
              </span>
            </div>
          </div>

          {/* Background Color */}
          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Background Color</span>
              <span className="timeshift-toggle-sub">Background box color behind subtitles.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="color"
                value={merged.subBackgroundColor}
                onChange={(e) => update({ subBackgroundColor: e.target.value })}
                style={{ width: '40px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                {merged.subBackgroundColor}
              </span>
            </div>
          </div>

          {/* Outline Color */}
          <div className="timeshift-toggle-row">
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Outline Color</span>
              <span className="timeshift-toggle-sub">Border/outline color around subtitle text.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="color"
                value={merged.subOutlineColor}
                onChange={(e) => update({ subOutlineColor: e.target.value })}
                style={{ width: '40px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                {merged.subOutlineColor}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="settings-section" style={{ marginTop: '2rem' }}>
        <div className="section-header">
          <h3>Preview</h3>
        </div>
        <p className="section-description">
          This is how your subtitles will look with the current settings.
        </p>

        <div
          style={{
            marginTop: '16px',
            padding: '40px 24px',
            background: '#1a1a1a',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            minHeight: '160px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Fake video background */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
              opacity: 0.6,
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontSize: `${merged.defaultSize}px`,
                color: merged.subColor,
                backgroundColor: merged.subBackgroundColor + 'CC',
                padding: '4px 12px',
                borderRadius: '4px',
                fontFamily: "'Arial', sans-serif",
                fontWeight: 500,
                lineHeight: 1.4,
                textShadow: `0 0 2px ${merged.subOutlineColor}, 0 0 4px ${merged.subOutlineColor}`,
                display: 'inline-block',
              }}
            >
              This is a preview of your subtitles
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

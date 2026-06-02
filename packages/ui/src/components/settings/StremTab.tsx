import { useState, useCallback } from 'react';
import type { StremioStreamPickerMode, BadgeSource } from '../../types/stremio';
import { parseBadgePayload } from '../../utils/streamBadges';

interface StremTabProps {
  stremioStreamPickerMode: StremioStreamPickerMode;
  onStremioStreamPickerModeChange: (mode: StremioStreamPickerMode) => Promise<void>;
  showStremioStreamBadges: boolean;
  onShowStremioStreamBadgesChange: (show: boolean) => Promise<void>;
  badgeSources: BadgeSource[];
  onBadgeSourcesChange: (sources: BadgeSource[]) => Promise<void>;
}

export function StremTab({
  stremioStreamPickerMode,
  onStremioStreamPickerModeChange,
  showStremioStreamBadges,
  onShowStremioStreamBadgesChange,
  badgeSources,
  onBadgeSourcesChange,
}: StremTabProps) {
  const [badgeUrl, setBadgeUrl] = useState('');
  const [badgePaste, setBadgePaste] = useState('');
  const [badgeImportError, setBadgeImportError] = useState('');
  const [badgeImporting, setBadgeImporting] = useState(false);

  const handleImportBadge = useCallback(async () => {
    setBadgeImportError('');
    const url = badgeUrl.trim();
    const paste = badgePaste.trim();
    if (!url && !paste) {
      setBadgeImportError('Enter a badge JSON URL or paste the JSON content.');
      return;
    }

    setBadgeImporting(true);
    try {
      let payloadStr = paste;
      let sourceUrl = url || 'Pasted';
      if (!paste && url) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          setBadgeImportError('URL must start with http:// or https://');
          setBadgeImporting(false);
          return;
        }
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        payloadStr = await resp.text();
      }

      const payload = parseBadgePayload(payloadStr);
      const newSource: BadgeSource = {
        url: sourceUrl,
        name: url ? url.split('/').pop() || url : 'Pasted',
        payload,
        isActive: true,
      };

      const updated = badgeSources.filter(
        (s) => s.url.toLowerCase() !== newSource.url.toLowerCase(),
      );
      updated.push(newSource);

      await onBadgeSourcesChange(updated);
      setBadgeUrl('');
      setBadgePaste('');
    } catch (err: any) {
      setBadgeImportError(err?.message || 'Import failed');
    } finally {
      setBadgeImporting(false);
    }
  }, [badgeUrl, badgePaste, badgeSources, onBadgeSourcesChange]);

  const handleToggleSource = useCallback(
    async (url: string) => {
      const updated = badgeSources.map((s) => ({
        ...s,
        isActive: s.url === url,
      }));
      await onBadgeSourcesChange(updated);
    },
    [badgeSources, onBadgeSourcesChange],
  );

  const handleDeleteSource = useCallback(
    async (url: string) => {
      const updated = badgeSources.filter((s) => s.url !== url);
      await onBadgeSourcesChange(updated);
    },
    [badgeSources, onBadgeSourcesChange],
  );

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

      <h3 style={{ margin: '24px 0 8px 0', fontSize: '0.95rem', fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
        Stream Badges
      </h3>
      <p style={{ margin: '0 0 12px 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
        Show quality, codec, HDR and audio badges on stream links, or import custom badge rules.
      </p>

      <div className="retry-setting-row" style={{ borderBottom: 'none' }}>
        <div className="timeshift-toggle-info">
          <span className="timeshift-toggle-label">Enable Badges</span>
          <span className="timeshift-toggle-sub">Toggle stream badges on or off.</span>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={showStremioStreamBadges}
            onChange={(e) => onShowStremioStreamBadgesChange(e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {/* Custom Badge Import */}
      <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
          Custom Badge Rules
        </div>

        <input
          type="text"
          placeholder="Badge JSON URL (e.g. https://pastebin.com/raw/...)"
          value={badgeUrl}
          onChange={(e) => setBadgeUrl(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.85)',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '0.8rem',
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: '8px',
          }}
        />

        <textarea
          placeholder="Or paste badge JSON directly..."
          value={badgePaste}
          onChange={(e) => setBadgePaste(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.85)',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            outline: 'none',
            boxSizing: 'border-box',
            resize: 'vertical',
            marginBottom: '8px',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={handleImportBadge}
            disabled={badgeImporting}
            style={{
              background: 'rgba(0, 212, 255, 0.15)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              color: '#00d4ff',
              borderRadius: '6px',
              padding: '7px 16px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: badgeImporting ? 'not-allowed' : 'pointer',
              opacity: badgeImporting ? 0.6 : 1,
            }}
          >
            {badgeImporting ? 'Importing...' : 'Import'}
          </button>
          {badgeImportError && (
            <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{badgeImportError}</span>
          )}
        </div>

        {/* Imported Sources List */}
        {badgeSources.length > 0 && (
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '8px', letterSpacing: '0.05em' }}>
              IMPORTED SOURCES
            </div>
            {badgeSources.map((source) => (
              <div
                key={source.url}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${source.isActive ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.04)'}`,
                  marginBottom: '4px',
                }}
              >
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.85)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {source.name}
                  </div>
                  <div style={{
                    fontSize: '0.65rem',
                    color: 'rgba(255,255,255,0.35)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {source.payload.filters.length} filters · {source.payload.groups.length} groups
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginLeft: '8px' }}>
                  <button
                    onClick={() => handleToggleSource(source.url)}
                    title={source.isActive ? 'Active' : 'Click to activate'}
                    style={{
                      background: source.isActive ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${source.isActive ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      color: source.isActive ? '#00d4ff' : 'rgba(255,255,255,0.4)',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {source.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => handleDeleteSource(source.url)}
                    title="Remove"
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#ef4444',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

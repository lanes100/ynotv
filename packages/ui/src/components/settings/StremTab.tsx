import { useState, useCallback } from 'react';
import type { StremioStreamPickerMode, BadgeSource } from '../../types/stremio';
import { parseBadgePayload, isLightColor, convertArgbToRgba } from '../../utils/streamBadges';

interface StremTabProps {
  stremioStreamPickerMode: StremioStreamPickerMode;
  onStremioStreamPickerModeChange: (mode: StremioStreamPickerMode) => Promise<void>;
  showStremioStreamBadges: boolean;
  onShowStremioStreamBadgesChange: (show: boolean) => Promise<void>;
  badgeSources: BadgeSource[];
  onBadgeSourcesChange: (sources: BadgeSource[]) => Promise<void>;
  stremioBadgeSize: number;
  onStremioBadgeSizeChange: (size: number) => Promise<void>;
  showHoverDetails: boolean;
  onShowHoverDetailsChange: (show: boolean) => Promise<void>;
  showFileSizeBadges: boolean;
  onShowFileSizeBadgesChange: (show: boolean) => Promise<void> | void;
  streamBadgePlacement: 'top' | 'bottom';
  onStreamBadgePlacementChange: (placement: 'top' | 'bottom') => Promise<void> | void;
}

export function StremTab({
  stremioStreamPickerMode,
  onStremioStreamPickerModeChange,
  showStremioStreamBadges,
  onShowStremioStreamBadgesChange,
  badgeSources,
  onBadgeSourcesChange,
  stremioBadgeSize,
  onStremioBadgeSizeChange,
  showHoverDetails,
  onShowHoverDetailsChange,
  showFileSizeBadges,
  onShowFileSizeBadgesChange,
  streamBadgePlacement,
  onStreamBadgePlacementChange,
}: StremTabProps) {
  const [badgeUrl, setBadgeUrl] = useState('');
  const [badgePaste, setBadgePaste] = useState('');
  const [badgeImportError, setBadgeImportError] = useState('');
  const [badgeImporting, setBadgeImporting] = useState(false);
  const [expandedSourceUrl, setExpandedSourceUrl] = useState<string | null>(null);

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
      let sourceUrl = url;
      let sourceName = '';
      if (paste) {
        sourceUrl = `pasted_${Date.now()}`;
        const pastedCount = badgeSources.filter((s) => s.url.startsWith('pasted_')).length + 1;
        sourceName = `Pasted Rule ${pastedCount}`;
      } else {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          setBadgeImportError('URL must start with http:// or https://');
          setBadgeImporting(false);
          return;
        }
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        payloadStr = await resp.text();
        sourceName = url.split('/').pop() || url;
      }

      const payload = parseBadgePayload(payloadStr);
      const newSource: BadgeSource = {
        url: sourceUrl,
        name: sourceName,
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
        isActive: s.url === url ? !s.isActive : s.isActive,
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
    <div className="settings-tab-content">
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

      <div className="retry-setting-row" style={{ borderBottom: 'none', marginTop: '20px' }}>
        <div className="timeshift-toggle-info">
          <span className="timeshift-toggle-label">Hover Details</span>
          <span className="timeshift-toggle-sub">Show hover cards with details when hovering over items.</span>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={showHoverDetails}
            onChange={(e) => onShowHoverDetailsChange(e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
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

      {showStremioStreamBadges && (
        <>
          <div className="retry-setting-row" style={{ borderBottom: 'none', marginTop: '12px' }}>
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Show File Size Badges</span>
              <span className="timeshift-toggle-sub">Display the video file size badge if available.</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={showFileSizeBadges}
                onChange={(e) => onShowFileSizeBadgesChange(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="retry-setting-row" style={{ borderBottom: 'none', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="timeshift-toggle-info">
              <span className="timeshift-toggle-label">Badge Position</span>
              <span className="timeshift-toggle-sub">Render badges above or below the stream title.</span>
            </div>
            <select
              value={streamBadgePlacement}
              onChange={(e) => onStreamBadgePlacementChange(e.target.value as 'top' | 'bottom')}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.85)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="bottom" style={{ background: '#1a1a1a' }}>Bottom (Below Title)</option>
              <option value="top" style={{ background: '#1a1a1a' }}>Top (Above Title)</option>
            </select>
          </div>

          <div className="retry-setting-row" style={{ borderBottom: 'none', flexDirection: 'column', alignItems: 'stretch', gap: '10px', marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span className="timeshift-toggle-label" style={{ fontSize: '0.85rem' }}>Badge Scale ({stremioBadgeSize}%)</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
            <input
              type="range"
              min="80"
              max="180"
              step="5"
              value={stremioBadgeSize}
              onChange={(e) => onStremioBadgeSizeChange(Number(e.target.value))}
              style={{
                flex: 1,
                accentColor: '#00d4ff',
                cursor: 'pointer',
                height: '6px',
                borderRadius: '3px',
                background: 'rgba(255,255,255,0.1)',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.05em' }}>
              LIVE PREVIEW
            </div>
            <div className="stremio-detail-stream-badges" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="stremio-stream-badge-img" style={{ backgroundColor: '#ffffff', borderColor: '#ffffff' }}>
                <img src="https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/4k.png" alt="4K" />
              </span>
              <span className="stremio-stream-badge-img" style={{ backgroundColor: '#ffffff', borderColor: '#ffffff' }}>
                <img src="https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/HDR.png" alt="HDR" />
              </span>
              <span className="stremio-stream-badge-img" style={{ backgroundColor: '#ffffff', borderColor: '#ffffff' }}>
                <img src="https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images%20w:o%20logo/webdl-black.png" alt="WEB-DL" />
              </span>
              <span className="stremio-stream-badge-img" style={{ backgroundColor: '#ffffff', borderColor: '#ffffff' }}>
                <img src="https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/51.png" alt="5.1" />
              </span>
            </div>
          </div>
        </div>
      </>
      )}

      {/* Custom Badge Import */}
      <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
          Fusion Badges / Custom Rules
        </div>

        <input
          type="text"
          placeholder="Fusion Badge JSON URL (e.g. https://pastebin.com/raw/...)"
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
            {badgeSources.map((source) => {
              const isExpanded = expandedSourceUrl === source.url;
              return (
                <div
                  key={source.url}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${source.isActive ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.04)'}`,
                    marginBottom: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div
                      onClick={() => setExpandedSourceUrl(isExpanded ? null : source.url)}
                      style={{ flex: 1, overflow: 'hidden', cursor: 'pointer' }}
                    >
                      <div style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.85)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}>
                        <span>{source.name}</span>
                        <span style={{
                          fontSize: '0.55rem',
                          color: 'rgba(255,255,255,0.3)',
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.15s',
                          display: 'inline-block',
                        }}>
                          ▶
                        </span>
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
                      {!source.isDefault && (
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
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.03em' }}>
                        PREVIEW BADGES ({source.payload.filters.length}):
                      </div>
                      <div className="stremio-detail-stream-badges" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {source.payload.filters.map((filter, fIdx) => {
                          const bgColor = convertArgbToRgba(filter.tagColor) || '#1a1a1a';
                          const isLightBg = isLightColor(bgColor);
                          const textColor = convertArgbToRgba(filter.textColor) || (isLightBg ? '#000000' : '#ffffff');
                          const borderColor = convertArgbToRgba(filter.borderColor) || 'transparent';

                          return filter.imageURL ? (
                            <span
                              key={filter.id || fIdx}
                              className="stremio-stream-badge-img"
                              style={{
                                backgroundColor: bgColor,
                                borderColor: borderColor,
                              }}
                            >
                              <img src={filter.imageURL} alt={filter.name} title={filter.name} />
                            </span>
                          ) : (
                            <span
                              key={filter.id || fIdx}
                              className="stremio-stream-badge"
                              style={{
                                backgroundColor: bgColor,
                                color: textColor,
                                borderColor: borderColor,
                              }}
                            >
                              {filter.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </div>
);
}

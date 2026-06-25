import React from 'react';
import './HeroWidgetsPanel.css';

interface HeroWidgetsPanelProps {
  sportsWidget: 'autohide' | 'persistent' | null;
  recentWidget: '5' | '10' | null;
  favoritesWidget: boolean;
  whatsNextWidget: boolean;
  customGroupIds: string[];
  onAddSportsAutohide: () => void;
  onAddSportsPersistent: () => void;
  onRemoveSports: () => void;
  onAddRecent5: () => void;
  onAddRecent10: () => void;
  onRemoveRecent: () => void;
  onAddFavorites: () => void;
  onRemoveFavorites: () => void;
  onAddWhatsNext: () => void;
  onRemoveWhatsNext: () => void;
  onRemoveCustomGroup?: (groupId: string) => void;
  onAddCustomGroup: () => void;
  liveTvDesign?: 'v1' | 'v2' | 'v3';
}

export function HeroWidgetsPanel({
  sportsWidget,
  recentWidget,
  favoritesWidget,
  whatsNextWidget,
  customGroupIds,
  onAddSportsAutohide,
  onAddSportsPersistent,
  onRemoveSports,
  onAddRecent5,
  onAddRecent10,
  onRemoveRecent,
  onAddFavorites,
  onRemoveFavorites,
  onAddWhatsNext,
  onRemoveWhatsNext,
  onRemoveCustomGroup,
  onAddCustomGroup,
  liveTvDesign,
}: HeroWidgetsPanelProps) {
  const hasCustomGroups = customGroupIds.length > 0;
  const hasAnyWidget = sportsWidget !== null || recentWidget !== null || favoritesWidget || whatsNextWidget || hasCustomGroups;

  return (
    <div className={`hero-widgets-panel${liveTvDesign === 'v3' ? ' design-v3' : ''}`}>
      {hasAnyWidget && (
        <div className="widgets-panel-section">
          <div className="widgets-panel-header">Active Widgets</div>
          <div className="widgets-panel-list">
            {sportsWidget && (
              <div className="widgets-panel-item active-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Live Sports ({sportsWidget === 'autohide' ? 'Autohide' : 'Persistent'})</span>
                </span>
                <button
                  className="widgets-panel-remove-btn"
                  onClick={(e) => { e.stopPropagation(); onRemoveSports(); }}
                  title="Stop Live Sports Overlay"
                >
                  ✕
                </button>
              </div>
            )}
            {recentWidget && (
              <div className="widgets-panel-item active-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  <span>Recent Channels ({recentWidget})</span>
                </span>
                <button
                  className="widgets-panel-remove-btn"
                  onClick={(e) => { e.stopPropagation(); onRemoveRecent(); }}
                  title="Stop Recent Channels"
                >
                  ✕
                </button>
              </div>
            )}
            {favoritesWidget && (
              <div className="widgets-panel-item active-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span>Favorites</span>
                </span>
                <button
                  className="widgets-panel-remove-btn"
                  onClick={(e) => { e.stopPropagation(); onRemoveFavorites(); }}
                  title="Stop Favorites"
                >
                  ✕
                </button>
              </div>
            )}
            {whatsNextWidget && (
              <div className="widgets-panel-item active-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span>What's Next</span>
                </span>
                <button
                  className="widgets-panel-remove-btn"
                  onClick={(e) => { e.stopPropagation(); onRemoveWhatsNext(); }}
                  title="Stop What's Next"
                >
                  ✕
                </button>
              </div>
            )}
            {hasCustomGroups && customGroupIds.map((gid) => (
              <div key={gid} className="widgets-panel-item active-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <span>Custom Group</span>
                </span>
                {onRemoveCustomGroup && (
                  <button
                    className="widgets-panel-remove-btn"
                    onClick={(e) => { e.stopPropagation(); onRemoveCustomGroup(gid); }}
                    title="Stop Custom Group"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="widgets-panel-section">
        <div className="widgets-panel-header">Add Widget</div>
        <div className="widgets-panel-list">
          {sportsWidget !== 'autohide' && (
            <div className="widgets-panel-item click-item" onClick={onAddSportsAutohide}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Live Sports (Autohide)</span>
            </div>
          )}
          {sportsWidget !== 'persistent' && (
            <div className="widgets-panel-item click-item" onClick={onAddSportsPersistent}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Live Sports (Persistent)</span>
            </div>
          )}
          {!recentWidget && (
            <>
              <div className="widgets-panel-item click-item" onClick={onAddRecent5}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                <span>Recent Channels (5)</span>
              </div>
              <div className="widgets-panel-item click-item" onClick={onAddRecent10}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                <span>Recent Channels (10)</span>
              </div>
            </>
          )}
          {!favoritesWidget && (
            <div className="widgets-panel-item click-item" onClick={onAddFavorites}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>Favorites</span>
            </div>
          )}
          {!whatsNextWidget && (
            <div className="widgets-panel-item click-item" onClick={onAddWhatsNext}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span>What's Next</span>
            </div>
          )}
          <div className="widgets-panel-item click-item" onClick={onAddCustomGroup}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>Custom Group…</span>
          </div>
        </div>
      </div>
    </div>
  );
}

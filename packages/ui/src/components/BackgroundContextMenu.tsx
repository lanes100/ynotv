import { useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './BackgroundContextMenu.css';

interface BackgroundContextMenuProps {
  position: { x: number; y: number };
  sportsWidget: 'autohide' | 'persistent' | null;
  recentWidget: '5' | '10' | null;
  favoritesWidget: boolean;
  whatsNextWidget: boolean;
  /** IDs of groups currently active as widgets */
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
  /** Open the group picker modal */
  onAddCustomGroup: () => void;
  onClose: () => void;
}

export function BackgroundContextMenu({
  position,
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
  onAddCustomGroup,
  onClose,
}: BackgroundContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      const isBottomHalf = position.y > viewportHeight / 2;
      if (isBottomHalf) {
        y = position.y - rect.height;
      }

      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width - 10;
      }
      if (x < 10) x = 10;
      if (y + rect.height > viewportHeight) y = viewportHeight - rect.height - 10;
      if (y < 10) y = 10;

      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
    }
  }, [position]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const hasCustomGroups = customGroupIds.length > 0;
  const hasAnyWidget = sportsWidget !== null || recentWidget !== null || favoritesWidget || whatsNextWidget || hasCustomGroups;

  return createPortal(
    <div ref={menuRef} className="background-context-menu">
      {hasAnyWidget && (
        <>
          <div className="context-menu-header">Active Widgets</div>
          {sportsWidget && (
            <div className="context-menu-item context-menu-item-info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Live Sports ({sportsWidget === 'autohide' ? 'Autohide' : 'Persistent'})
            </div>
          )}
          {recentWidget && (
            <div className="context-menu-item context-menu-item-info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              Recent Channels ({recentWidget})
            </div>
          )}
          {favoritesWidget && (
            <div className="context-menu-item context-menu-item-info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Favorites
            </div>
          )}
          {whatsNextWidget && (
            <div className="context-menu-item context-menu-item-info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              What&apos;s Next
            </div>
          )}
          {hasCustomGroups && customGroupIds.map((gid) => (
            <div key={gid} className="context-menu-item context-menu-item-info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
              Custom Group
            </div>
          ))}
          <div className="context-menu-separator" />
        </>
      )}

      <div className="context-menu-header">Add Widget</div>
      {!sportsWidget && (
        <>
          <div className="context-menu-item" onClick={() => { onAddSportsAutohide(); onClose(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Live Sports Overlay (Autohide)
          </div>
          <div className="context-menu-item" onClick={() => { onAddSportsPersistent(); onClose(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Live Sports Overlay (Persistent)
          </div>
        </>
      )}
      {!recentWidget && (
        <>
          <div className="context-menu-item" onClick={() => { onAddRecent5(); onClose(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Recent Channels (5)
          </div>
          <div className="context-menu-item" onClick={() => { onAddRecent10(); onClose(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Recent Channels (10)
          </div>
        </>
      )}
      {!favoritesWidget && (
        <div className="context-menu-item" onClick={() => { onAddFavorites(); onClose(); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Favorites
        </div>
      )}
      {!whatsNextWidget && (
        <div className="context-menu-item" onClick={() => { onAddWhatsNext(); onClose(); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          What&apos;s Next
        </div>
      )}
      {/* Custom Group — always available; opens the picker */}
      <div className="context-menu-item" onClick={() => { onAddCustomGroup(); onClose(); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
        Custom Group…
      </div>

      {hasAnyWidget && (
        <>
          <div className="context-menu-separator" />
          <div className="context-menu-header">Remove Widget</div>
          {sportsWidget && (
            <div className="context-menu-item context-menu-item-danger" onClick={() => { onRemoveSports(); onClose(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Live Sports Overlay
            </div>
          )}
          {recentWidget && (
            <div className="context-menu-item context-menu-item-danger" onClick={() => { onRemoveRecent(); onClose(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Recent Channels
            </div>
          )}
          {favoritesWidget && (
            <div className="context-menu-item context-menu-item-danger" onClick={() => { onRemoveFavorites(); onClose(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Favorites
            </div>
          )}
          {whatsNextWidget && (
            <div className="context-menu-item context-menu-item-danger" onClick={() => { onRemoveWhatsNext(); onClose(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              What&apos;s Next
            </div>
          )}
          {/* Manage custom groups via the picker (re-opens so user can remove from there) */}
          {hasCustomGroups && (
            <div className="context-menu-item context-menu-item-danger" onClick={() => { onAddCustomGroup(); onClose(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
              Manage Custom Groups…
            </div>
          )}
        </>
      )}
    </div>,
    document.body
  );
}

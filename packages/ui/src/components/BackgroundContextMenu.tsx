import { useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './BackgroundContextMenu.css';

interface BackgroundContextMenuProps {
  position: { x: number; y: number };
  sportsWidget: 'autohide' | 'persistent' | null;
  recentWidget: boolean;
  onAddSportsAutohide: () => void;
  onAddSportsPersistent: () => void;
  onRemoveSports: () => void;
  onAddRecent: () => void;
  onRemoveRecent: () => void;
  onClose: () => void;
}

export function BackgroundContextMenu({
  position,
  sportsWidget,
  recentWidget,
  onAddSportsAutohide,
  onAddSportsPersistent,
  onRemoveSports,
  onAddRecent,
  onRemoveRecent,
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

  const hasAnyWidget = sportsWidget !== null || recentWidget;

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
              Recent Channels
            </div>
          )}
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
        <div className="context-menu-item" onClick={() => { onAddRecent(); onClose(); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Recent Channels
        </div>
      )}

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
        </>
      )}
    </div>,
    document.body
  );
}

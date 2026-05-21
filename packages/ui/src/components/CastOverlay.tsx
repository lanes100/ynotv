import React from 'react';
import './CastOverlay.css';

interface CastOverlayProps {
  deviceName: string;
  mediaTitle?: string;
  mediaSubtitle?: string;
  onDisconnect?: () => void;
}

export function CastOverlay({
  deviceName,
  mediaTitle,
  mediaSubtitle,
  onDisconnect
}: CastOverlayProps) {
  return (
    <div className="cast-overlay">
      <div className="cast-overlay-content">
        <div className="cast-logo-container">
          <div className="cast-wave wave-1"></div>
          <div className="cast-wave wave-2"></div>
          <div className="cast-wave wave-3"></div>
          <svg
            className="cast-active-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 17a5 5 0 0 1 5 5" />
            <path d="M2 13a9 9 0 0 1 9 9" />
            <path d="M2 9a13 13 0 0 1 13 13" />
            <path d="M2 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6" />
            <line x1="2" y1="20" x2="2.01" y2="20" />
          </svg>
        </div>

        <h3 className="cast-title">Casting to {deviceName || 'Chromecast'}</h3>
        
        {(mediaTitle || mediaSubtitle) && (
          <div className="cast-media-info">
            {mediaTitle && <h4 className="cast-media-title">{mediaTitle}</h4>}
            {mediaSubtitle && <p className="cast-media-subtitle">{mediaSubtitle}</p>}
          </div>
        )}

        {onDisconnect && (
          <button className="cast-disconnect-btn" onClick={onDisconnect}>
            <svg
              className="cast-disconnect-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
            Disconnect Cast
          </button>
        )}
      </div>
    </div>
  );
}

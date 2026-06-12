import { useEffect, useState } from 'react';
import './BackButtonOverlay.css';

interface BackButtonOverlayProps {
  visible: boolean;
  sourceView: 'movies' | 'series' | 'dvr' | 'stremio' | null;
  onBack: () => void;
}

export function BackButtonOverlay({ visible, sourceView, onBack }: BackButtonOverlayProps) {
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (!visible) {
      setHiding(true);
      const timer = setTimeout(() => setHiding(false), 300);
      return () => clearTimeout(timer);
    } else {
      setHiding(false);
    }
  }, [visible]);

  if (!sourceView) return null;
  if (!visible && !hiding) return null;

  const labelMap: Record<string, string> = {
    movies: 'Back to Movies',
    series: 'Back to Series',
    dvr: 'Back to Recordings',
    stremio: 'Back to Stremio',
  };

  const label = labelMap[sourceView] || 'Back';

  return (
    <div className={`back-button-overlay${hiding ? ' hiding' : ''}`}>
      <button className="back-button-overlay__btn" onClick={onBack}>
        <svg className="back-button-overlay__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span className="back-button-overlay__text">{label}</span>
      </button>
    </div>
  );
}

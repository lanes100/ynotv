import { useEffect, useState, useRef } from 'react';
import './SkipIntroButton.css';

interface SkipIntroButtonProps {
  visible: boolean;
  countdown: number;
  onSkip: () => void;
}

export function SkipIntroButton({ visible, countdown, onSkip }: SkipIntroButtonProps) {
  const [hiding, setHiding] = useState(false);
  const hasRenderedVisible = useRef(false);

  useEffect(() => {
    if (visible) {
      hasRenderedVisible.current = true;
      setHiding(false);
    } else if (hasRenderedVisible.current) {
      setHiding(true);
      const timer = setTimeout(() => setHiding(false), 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible && !hiding) return null;

  return (
    <button
      className={`skip-intro-btn${hiding ? ' hiding' : ''}`}
      onClick={onSkip}
    >
      <svg className="skip-intro-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 4 15 12 5 20 5 4" />
        <line x1="19" y1="5" x2="19" y2="19" />
      </svg>
      <span className="skip-intro-btn__text">Skip Intro</span>
      <span className="skip-intro-btn__countdown">{countdown}s</span>
    </button>
  );
}

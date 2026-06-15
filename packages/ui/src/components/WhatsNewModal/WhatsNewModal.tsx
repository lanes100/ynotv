import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import changelogContent from '@root/CHANGELOG.md?raw';
import './WhatsNewModal.css';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
}

export function WhatsNewModal({ isOpen, onClose, version }: WhatsNewModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="whats-new-overlay" onClick={onClose}>
      <div className="whats-new-panel" onClick={(e) => e.stopPropagation()}>
        <div className="whats-new-header">
          <div className="whats-new-title-area">
            <span className="whats-new-sparkle" role="img" aria-label="sparkles">✨</span>
            <h2>What's New</h2>
          </div>
          {version && <span className="whats-new-badge">v{version}</span>}
          <button className="whats-new-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="whats-new-content">
          <div className="whats-new-intro">
            <p>Welcome! Here's a summary of the latest features, enhancements, and fixes added to ynoTV.</p>
          </div>
          <div className="whats-new-changelog">
            <ReactMarkdown>{changelogContent}</ReactMarkdown>
          </div>
        </div>

        <div className="whats-new-footer">
          <button className="whats-new-btn-primary" onClick={onClose}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

export default WhatsNewModal;

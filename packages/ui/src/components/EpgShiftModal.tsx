import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';
import './EpgShiftModal.css';

interface EpgShiftModalProps {
  isOpen: boolean;
  currentOffset: number;
  onClose: () => void;
  onChange: (offset: number) => void;
}

export function EpgShiftModal({ isOpen, currentOffset, onClose, onChange }: EpgShiftModalProps) {
  const [offset, setOffset] = useState(currentOffset);

  useEffect(() => {
    if (isOpen) {
      setOffset(currentOffset);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const decrease = () => {
    const newOffset = Math.max(-12, offset - 1);
    setOffset(newOffset);
    onChange(newOffset);
  };

  const increase = () => {
    const newOffset = Math.min(12, offset + 1);
    setOffset(newOffset);
    onChange(newOffset);
  };

  const formatOffset = (val: number) => {
    if (val === 0) return '0h';
    return `${val > 0 ? '+' : ''}${val}h`;
  };

  return createPortal(
    <div className="modal-overlay epg-shift-overlay" onClick={onClose}>
      <div className="modal-container epg-shift-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">EPG Time Offset</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="epg-shift-body">
          <div className="epg-shift-value">{formatOffset(offset)}</div>
          <div className="epg-shift-controls">
            <button className="epg-shift-btn" onClick={decrease} disabled={offset <= -12} aria-label="Decrease offset">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <span className="epg-shift-hint">Adjust by 1 hour</span>
            <button className="epg-shift-btn" onClick={increase} disabled={offset >= 12} aria-label="Increase offset">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="epg-shift-footer">
          <button className="modal-btn modal-btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

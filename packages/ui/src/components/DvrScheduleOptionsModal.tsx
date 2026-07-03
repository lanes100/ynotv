import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './DvrScheduleOptionsModal.css';

interface DvrScheduleOptionsModalProps {
  isOpen: boolean;
  programTitle: string;
  channelName: string;
  timeString: string;
  defaultStartPadding: number;
  defaultEndPadding: number;
  onConfirm: (options: {
    startPadding: number;
    endPadding: number;
    recurrence: string;
  }) => void;
  onCancel: () => void;
}

export function DvrScheduleOptionsModal({
  isOpen,
  programTitle,
  channelName,
  timeString,
  defaultStartPadding,
  defaultEndPadding,
  onConfirm,
  onCancel,
}: DvrScheduleOptionsModalProps) {
  const [startPadding, setStartPadding] = useState(defaultStartPadding);
  const [endPadding, setEndPadding] = useState(defaultEndPadding);
  const [recurrence, setRecurrence] = useState('once');
  const [recurrenceDays, setRecurrenceDays] = useState(3);

  useEffect(() => {
    if (isOpen) {
      setStartPadding(defaultStartPadding);
      setEndPadding(defaultEndPadding);
      setRecurrence('once');
      setRecurrenceDays(3);
    }
  }, [isOpen, defaultStartPadding, defaultEndPadding]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  const handleConfirm = useCallback(() => {
    const finalRecurrence = recurrence === 'every' ? `every:${recurrenceDays}` : recurrence;
    onConfirm({
      startPadding,
      endPadding,
      recurrence: finalRecurrence,
    });
  }, [onConfirm, startPadding, endPadding, recurrence, recurrenceDays]);

  if (!isOpen) return null;

  return createPortal(
    <div className="dvr-options-modal-overlay" onClick={onCancel}>
      <div className="dvr-options-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dvr-options-modal-header">
          <h3>📹 Schedule Recording</h3>
          <button className="dvr-options-modal-close" onClick={onCancel}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="dvr-options-modal-body">
          {/* Program Info */}
          <div className="dvr-options-program-info">
            <div className="dvr-options-program-title">{programTitle}</div>
            <div className="dvr-options-program-channel">{channelName}</div>
            <div className="dvr-options-program-time">{timeString}</div>
          </div>

          {/* Recurrence Selection */}
          <div className="dvr-options-form-group">
            <label className="dvr-options-label">Recurrence</label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="dvr-options-select"
            >
              <option value="once">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="every">Every X Days</option>
            </select>
          </div>

          {recurrence === 'every' && (
            <div className="dvr-options-form-group">
              <label className="dvr-options-label">Repeat Every (Days)</label>
              <input
                type="number"
                min="1"
                max="365"
                value={recurrenceDays}
                onChange={(e) => setRecurrenceDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="dvr-options-number-input"
              />
            </div>
          )}

          {/* Padding */}
          <div className="dvr-options-form-group">
            <label className="dvr-options-label">Start Padding</label>
            <div className="dvr-options-padding-control">
              <input
                type="range"
                min="0"
                max="300"
                step="30"
                value={startPadding}
                onChange={(e) => setStartPadding(Number(e.target.value))}
              />
              <span className="dvr-options-padding-value">{startPadding}s</span>
            </div>
            <span className="dvr-options-hint">Record this many seconds before start time</span>
          </div>

          <div className="dvr-options-form-group">
            <label className="dvr-options-label">End Padding</label>
            <div className="dvr-options-padding-control">
              <input
                type="range"
                min="0"
                max="600"
                step="30"
                value={endPadding}
                onChange={(e) => setEndPadding(Number(e.target.value))}
              />
              <span className="dvr-options-padding-value">{endPadding}s</span>
            </div>
            <span className="dvr-options-hint">Record this many seconds after end time</span>
          </div>
        </div>

        <div className="dvr-options-modal-footer">
          <button className="dvr-options-btn dvr-options-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="dvr-options-btn dvr-options-btn-primary" onClick={handleConfirm}>
            Schedule
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useToastStore } from '../stores/toastStore';
import './Toast.css';

function ToastItem({ id, message, type }: { id: number; message: string; type: 'error' | 'success' }) {
  const [isHiding, setIsHiding] = useState(false);
  const removeToast = useToastStore((s) => s.removeToast);

  const handleClose = useCallback(() => {
    setIsHiding(true);
    setTimeout(() => removeToast(id), 300);
  }, [id, removeToast]);

  return (
    <div className={`toast ${type} ${isHiding ? 'hiding' : ''}`}>
      <span className="toast-icon">
        {type === 'error' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        )}
      </span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={handleClose}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} message={t.message} type={t.type} />
      ))}
    </div>,
    document.body
  );
}

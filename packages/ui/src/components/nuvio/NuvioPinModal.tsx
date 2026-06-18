import { useState, useEffect, useRef } from 'react';
import { useNuvioAuthStore } from '../../stores/nuvioAuthStore';
import './NuvioPinModal.css';

interface NuvioPinModalProps {
  profile: any; // NuvioProfile
  onClose: () => void;
  onSuccess?: () => void;
}

export function NuvioPinModal({ profile, onClose, onSuccess }: NuvioPinModalProps) {
  const authStore = useNuvioAuthStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length !== 4) return;

    setSubmitting(true);
    setError(null);
    try {
      const success = await authStore.selectProfile(profile.profile_index, pin);
      if (success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError('Failed to unlock profile.');
        setPin('');
        inputRef.current?.focus();
      }
    } catch (err: any) {
      setError(err.message || 'Incorrect PIN code');
      setPin('');
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (val: string) => {
    const numeric = val.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(numeric);
    setError(null);
    if (numeric.length === 4) {
      // Auto submit when 4 digits are entered
      setSubmitting(true);
      authStore.selectProfile(profile.profile_index, numeric)
        .then((success) => {
          if (success) {
            if (onSuccess) onSuccess();
            onClose();
          } else {
            setError('Failed to unlock profile.');
            setPin('');
            inputRef.current?.focus();
          }
        })
        .catch((err) => {
          setError(err.message || 'Incorrect PIN code');
          setPin('');
          inputRef.current?.focus();
        })
        .finally(() => {
          setSubmitting(false);
        });
    }
  };

  return (
    <div className="nuvio-pin-modal-overlay" onClick={onClose}>
      <div className="nuvio-pin-modal-card" onClick={(e) => e.stopPropagation()}>
        <div 
          className="nuvio-pin-modal-avatar" 
          style={{ backgroundColor: profile.avatar_color_hex || '#00d4ff' }}
        >
          {profile.name.charAt(0).toUpperCase()}
        </div>
        <div className="nuvio-pin-modal-info">
          <h3>Enter Profile PIN</h3>
          <p>Profile <strong>{profile.name}</strong> is locked</p>
        </div>
        <form onSubmit={handleSubmit} className="nuvio-pin-modal-form">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => handleInputChange(e.target.value)}
            className="nuvio-pin-modal-input"
            disabled={submitting}
            placeholder="••••"
          />
          {error && <div className="nuvio-pin-modal-error">{error}</div>}
          <div className="nuvio-pin-modal-actions">
            <button 
              type="button" 
              onClick={onClose} 
              className="nuvio-pin-btn nuvio-pin-btn-cancel"
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="nuvio-pin-btn nuvio-pin-btn-submit"
              disabled={submitting || pin.length !== 4}
            >
              {submitting ? 'Verifying...' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

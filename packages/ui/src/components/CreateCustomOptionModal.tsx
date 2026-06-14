import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './CreateCustomOptionModal.css';

interface CreateCustomOptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (name: string) => Promise<void>;
  onCreatePlaylist: (name: string) => Promise<void>;
}

export function CreateCustomOptionModal({
  isOpen,
  onClose,
  onCreateGroup,
  onCreatePlaylist,
}: CreateCustomOptionModalProps) {
  const [activeTab, setActiveTab] = useState<'group' | 'playlist'>('group');
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Focus input on mount or tab change
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen, activeTab]);

  // Reset name and tab on open
  useEffect(() => {
    if (isOpen) {
      setName('');
      setActiveTab('group');
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (activeTab === 'group') {
      await onCreateGroup(trimmed);
    } else {
      await onCreatePlaylist(trimmed);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return createPortal(
    <div ref={overlayRef} className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container cco-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header">
          <div className="modal-icon modal-icon-info">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <h3 className="modal-title">Create Custom Option</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="cco-tabs">
          <button
            className={`cco-tab-btn ${activeTab === 'group' ? 'active' : ''}`}
            onClick={() => setActiveTab('group')}
          >
            Custom Group
          </button>
          <button
            className={`cco-tab-btn ${activeTab === 'playlist' ? 'active' : ''}`}
            onClick={() => setActiveTab('playlist')}
          >
            Custom Playlist
          </button>
        </div>

        {/* Body */}
        <div className="modal-body cco-body">
          <p className="modal-message cco-desc">
            {activeTab === 'group'
              ? 'Create a custom group to add channels into from any source into its own category.'
              : 'Create a custom playlist to manually add categories/channels from different sources into one. Can also create custom categories.'}
          </p>

          <input
            ref={inputRef}
            type="text"
            className="modal-input"
            placeholder={activeTab === 'group' ? 'Group name...' : 'Playlist name...'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="modal-btn modal-btn-primary"
            onClick={handleCreate}
            disabled={!name.trim()}
          >
            Create
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}

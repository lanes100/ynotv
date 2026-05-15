import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from '../hooks/useSqliteLiveQuery';
import { db } from '../db';
import type { CustomGroup } from '../db';
import './GroupPickerModal.css';

interface GroupPickerModalProps {
  /** IDs of groups already pinned as widgets (shown as active / removable) */
  activeGroupIds: string[];
  onAdd: (group: CustomGroup) => void;
  onRemove: (groupId: string) => void;
  onClose: () => void;
}

export function GroupPickerModal({
  activeGroupIds,
  onAdd,
  onRemove,
  onClose,
}: GroupPickerModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const groups = useLiveQuery(
    async () => {
      const all = await db.customGroups.toArray();
      all.sort((a, b) => a.display_order - b.display_order);
      return all;
    },
    [],
    [],
    0,
    'custom_groups'
  );

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  const isEmpty = !groups || groups.length === 0;

  return createPortal(
    <div ref={overlayRef} className="group-picker-backdrop" onClick={handleBackdrop}>
      <div className="group-picker-modal">
        {/* Header */}
        <div className="group-picker-header">
          <div className="group-picker-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Add Custom Group Widget
          </div>
          <button className="group-picker-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <p className="group-picker-desc">
          Select a custom group to pin as an overlay widget. Its channels and live programs will appear next to the other widgets.
        </p>

        {/* List */}
        <div className="group-picker-list">
          {isEmpty ? (
            <div className="group-picker-empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
              </svg>
              <span>No custom groups yet.</span>
              <small>Create groups in Settings → Channel Manager.</small>
            </div>
          ) : (
            groups!.map((group) => {
              const isActive = activeGroupIds.includes(group.group_id);
              return (
                <div key={group.group_id} className={`group-picker-item${isActive ? ' active' : ''}`}>
                  <div className="group-picker-item-info">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                    <span className="group-picker-item-name">{group.name}</span>
                    {isActive && <span className="group-picker-badge">Active</span>}
                  </div>
                  <div className="group-picker-item-actions">
                    {isActive ? (
                      <button
                        className="group-picker-btn group-picker-btn--remove"
                        onClick={() => { onRemove(group.group_id); }}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        className="group-picker-btn group-picker-btn--add"
                        onClick={() => { onAdd(group); onClose(); }}
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

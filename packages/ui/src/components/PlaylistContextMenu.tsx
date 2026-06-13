import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import './ProgramContextMenu.css';

interface PlaylistContextMenuProps {
    playlistId: string;
    playlistName: string;
    position: { x: number; y: number };
    onClose: () => void;
    onEditContents: () => void;
    onExportM3u: () => void;
    onRename: () => void;
    onDelete: () => void;
}

export function PlaylistContextMenu({
    playlistId,
    playlistName,
    position,
    onClose,
    onEditContents,
    onExportM3u,
    onRename,
    onDelete,
}: PlaylistContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    // Dynamic Position Adjustment (Flip upward if in bottom half)
    useLayoutEffect(() => {
        if (menuRef.current) {
            const menu = menuRef.current;
            const rect = menu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let x = position.x;
            let y = position.y;

            // Determine if click was in top or bottom half of the screen
            const isBottomHalf = position.y > viewportHeight / 2;

            // Pop UP if cursor is below 50% screen height
            if (isBottomHalf) {
                y = position.y - rect.height;
            }

            // Prevent menu from going off right edge
            if (x + rect.width > viewportWidth) x = viewportWidth - rect.width - 10;
            if (x < 10) x = 10;

            // Safety bounds for Y-axis
            if (y + rect.height > viewportHeight) y = viewportHeight - rect.height - 10;
            if (y < 10) y = 10;

            setAdjustedPosition({ x, y });
        }
    }, [position]);

    // Close on click outside (ignore clicks inside modals since they are rendered in portals)
    useEffect(() => {
        function isInsideModal(target: Node): boolean {
            const el = target as HTMLElement;
            return !!el.closest?.('.modal-overlay') || !!el.closest?.('.modal-container');
        }
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) && !isInsideModal(e.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Close on escape
    useEffect(() => {
        function handleEscape(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    return createPortal(
        <div
            ref={menuRef}
            className="program-context-menu"
            style={{
                position: 'fixed',
                left: `${adjustedPosition.x}px`,
                top: `${adjustedPosition.y}px`,
                zIndex: 10000,
                minWidth: '240px'
            }}
        >
            <div className="context-menu-header" style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                {playlistName}
            </div>
            <div
                className="context-menu-item"
                onClick={() => {
                    onEditContents();
                    onClose();
                }}
            >
                Edit Contents
            </div>
            <div
                className="context-menu-item"
                onClick={() => {
                    onExportM3u();
                    onClose();
                }}
            >
                Export .m3u
            </div>
            <div
                className="context-menu-item"
                onClick={() => {
                    onRename();
                    onClose();
                }}
            >
                Rename
            </div>
            <div
                className="context-menu-item"
                onClick={() => {
                    onDelete();
                    onClose();
                }}
                style={{ color: 'var(--status-live)' }}
            >
                Delete
            </div>
        </div>,
        document.body
    );
}

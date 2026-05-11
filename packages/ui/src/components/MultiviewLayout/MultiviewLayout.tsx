import { useRef } from 'react';
import { MultiviewCell } from '../MultiviewCell/MultiviewCell';
import { ViewerSlot } from '../../hooks/useMultiview';
import { useDraggable } from '../../hooks/useDraggable';
import { useResizable } from '../../hooks/useResizable';
import './MultiviewLayout.css';

interface MultiviewLayoutProps {
    layout: 'main' | 'pip' | '2x2' | 'bigbottom';
    slots: ViewerSlot[];
    onSwapWithMain: (slotId: 2 | 3 | 4) => void;
    onStop: (slotId: 2 | 3 | 4) => void;
    onSetProperty: (slotId: 2 | 3 | 4, property: string, value: any) => void;
    onReposition: () => void;
    onSwitchLayout?: (layout: 'main' | 'pip' | '2x2' | 'bigbottom') => void;
}

export function MultiviewLayout({
    layout,
    slots,
    onSwapWithMain,
    onStop,
    onSetProperty,
    onReposition,
    onSwitchLayout,
}: MultiviewLayoutProps) {
    const slot2 = slots.find(s => s.id === 2)!;
    const slot3 = slots.find(s => s.id === 3)!;
    const slot4 = slots.find(s => s.id === 4)!;
    const pipDragRef = useRef<HTMLDivElement>(null);
    const pipResizeRef = useRef<HTMLDivElement>(null);
    useDraggable(pipDragRef, () => {
        onReposition();
    });
    useResizable(pipResizeRef, pipDragRef, () => {
        onReposition();
    }, 16 / 9, 36);

    const cell = (slot: ViewerSlot) => (
        <MultiviewCell
            key={slot.id}
            slotId={slot.id}
            channelName={slot.channelName}
            channelUrl={slot.channelUrl}
            sourceName={slot.sourceName}
            active={slot.active}
            onSwapWithMain={() => onSwapWithMain(slot.id)}
            onStop={() => onStop(slot.id)}
            onSetProperty={(prop: string, val: any) => onSetProperty(slot.id, prop, val)}
        />
    );

    if (layout === 'main') {
        // MPV fills the window — no cells visible
        return null;
    }

    if (layout === 'pip') {
        return (
            <div className="layout-pip-container">
                <div className="layout-pip-overlay" ref={pipDragRef}>
                    <button
                        className="layout-pip-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            onSwitchLayout?.('main');
                        }}
                        title="Close and return to Main View"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                    {cell(slot2)}
                    <div className="layout-pip-resize" ref={pipResizeRef} title="Drag to resize" />
                </div>
            </div>
        );
    }

    if (layout === '2x2') {
        return (
            <div className="layout-2x2-cells">
                {/* Top-left is MPV (empty div, MPV renders behind) */}
                <div className="layout-mpv-placeholder layout-2x2-mpv" />
                {cell(slot2)}
                {cell(slot3)}
                {cell(slot4)}
            </div>
        );
    }

    if (layout === 'bigbottom') {
        return (
            <div className="layout-bigbottom-cells">
                {/* Top is MPV */}
                <div className="layout-mpv-placeholder layout-bigbottom-mpv" />
                <div className="layout-bottom-bar">
                    {cell(slot2)}
                    {cell(slot3)}
                    {cell(slot4)}
                </div>
            </div>
        );
    }

    return null;
}

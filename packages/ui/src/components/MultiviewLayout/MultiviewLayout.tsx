import { useRef } from 'react';
import { MultiviewCell } from '../MultiviewCell/MultiviewCell';
import { HlsMultiviewCell } from '../MultiviewCell/HlsMultiviewCell';
import { ViewerSlot, type MultiviewEngineMode } from '../../hooks/useMultiview';
import { useDraggable } from '../../hooks/useDraggable';
import { useResizable } from '../../hooks/useResizable';
import './MultiviewLayout.css';

interface MultiviewLayoutProps {
    layout: 'main' | 'pip' | '2x2' | 'bigbottom' | 'sbs';
    slots: ViewerSlot[];
    engineMode: MultiviewEngineMode;
    mainChannelName: string | null;
    mainPlaying: boolean;
    mainMuted: boolean;
    mainVolume: number;
    onMainTogglePlayPause: () => void;
    onMainToggleMute: () => void;
    onMainSetVolume: (vol: number) => void;
    onSwapWithMain: (slotId: 2 | 3 | 4) => void;
    onMainStop: () => void;
    onStop: (slotId: 2 | 3 | 4) => void;
    onSetProperty: (slotId: 2 | 3 | 4, property: string, value: any) => void;
    onReposition: () => void;
    onSwitchLayout?: (layout: 'main' | 'pip' | '2x2' | 'bigbottom' | 'sbs') => void;
    hidden?: boolean;
}

export function MultiviewLayout({
    layout,
    slots,
    engineMode,
    mainChannelName,
    mainPlaying,
    mainMuted,
    mainVolume,
    onMainTogglePlayPause,
    onMainToggleMute,
    onMainSetVolume,
    onSwapWithMain,
    onMainStop,
    onStop,
    onSetProperty,
    onReposition,
    onSwitchLayout,
    hidden,
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

    const isHls = engineMode === 'hls';

    // Render either a native-MPV overlay cell or an in-DOM HLS <video> cell
    const cell = (slot: ViewerSlot) =>
        isHls ? (
            <HlsMultiviewCell
                key={slot.id}
                slotId={slot.id}
                channelName={slot.channelName}
                channelUrl={slot.channelUrl}
                sourceName={slot.sourceName}
                active={slot.active}
                onSwapWithMain={() => onSwapWithMain(slot.id)}
                onStop={() => onStop(slot.id)}
            />
        ) : (
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
            <div className="layout-pip-container" style={{ display: hidden ? 'none' : undefined }}>
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
    const mainControls = (
        <div className="multiview-cell-controls primary-mpv-controls" onClick={(e) => e.stopPropagation()}>
            <span className="multiview-cell-controls-name">{mainChannelName || 'Main Player'}</span>
            <div className="multiview-cell-controls-buttons">
                <div className="multiview-cell-controls-volume" onClick={(e) => e.stopPropagation()}>
                    <button className="multiview-cell-controls-btn" onClick={onMainToggleMute} title={mainMuted ? 'Unmute' : 'Mute'}>
                        {mainMuted ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                        )}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={mainMuted ? 0 : mainVolume}
                        onChange={(e) => onMainSetVolume(parseInt(e.target.value))}
                        className="multiview-cell-volume-slider"
                        title="Volume"
                    />
                </div>
                <button className="multiview-cell-controls-btn" onClick={onMainTogglePlayPause} title={mainPlaying ? 'Pause' : 'Play'}>
                    {mainPlaying ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    )}
                </button>
                <button className="multiview-cell-controls-btn danger" onClick={onMainStop} title="Stop">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z" /></svg>
                </button>
            </div>
        </div>
    );

    if (layout === '2x2') {
        return (
            <div className="layout-2x2-cells" data-engine={engineMode} style={{ display: hidden ? 'none' : undefined }}>
                {/* Top-left grid cell: occupied by primary MPV (renders behind this div).
                    Must always be rendered so slots 2/3/4 land in the correct grid positions.
                    CSS removes the box-shadow curtain in HLS mode. */}
                <div className="layout-mpv-placeholder layout-2x2-mpv">
                    {mainControls}
                </div>
                {cell(slot2)}
                {cell(slot3)}
                {cell(slot4)}
            </div>
        );
    }

    if (layout === 'sbs') {
        return (
            <div className="layout-sbs-cells" data-engine={engineMode} style={{ display: hidden ? 'none' : undefined }}>
                <div className="layout-mpv-placeholder layout-sbs-mpv">
                    {mainControls}
                </div>
                {cell(slot2)}
            </div>
        );
    }

    if (layout === 'bigbottom') {
        // Calculate exact 16:9 height for the bottom row cells to prevent letterboxing
        const gap = 2; // matches CSS gap
        const cellW = Math.floor((window.innerWidth - (2 * gap)) / 3);
        const cellH = Math.floor(cellW * 9 / 16);

        return (
            <div 
                className="layout-bigbottom-cells" 
                data-engine={engineMode} 
                style={{ 
                    display: hidden ? 'none' : undefined,
                    gridTemplateRows: `1fr ${cellH}px`
                }}
            >
                {/* Top grid row: primary MPV renders behind this placeholder.
                    Must always be rendered so layout-bottom-bar stays in grid row 2.
                    CSS removes the box-shadow curtain in HLS mode. */}
                <div className="layout-mpv-placeholder layout-bigbottom-mpv">
                    {mainControls}
                </div>
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

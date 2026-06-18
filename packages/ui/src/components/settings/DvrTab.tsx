import { useState, useEffect } from 'react';
import { getDvrSettings, saveDvrSetting } from '../../db';
import { open } from '@tauri-apps/plugin-dialog';
import '../Settings.css';

export function DvrTab() {
    const [storagePath, setStoragePath] = useState('');
    const [downloadsPath, setDownloadsPath] = useState('');
    const [startPadding, setStartPadding] = useState(60);
    const [endPadding, setEndPadding] = useState(300);
    const [customEndPaddingInput, setCustomEndPaddingInput] = useState('');
    const [autoConvertFormat, setAutoConvertFormat] = useState('none');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        setLoading(true);
        try {
            const settings = await getDvrSettings();
            setStoragePath(settings.storage_path || '');
            setStartPadding(settings.default_start_padding_sec || 60);
            const endSec = settings.default_end_padding_sec || 300;
            setEndPadding(endSec);
            const mins = endSec / 60;
            setCustomEndPaddingInput(Number(mins.toFixed(2)).toString());
            setAutoConvertFormat(settings.auto_convert_format || 'none');

            if (window.storage) {
                const settingsRes = await window.storage.getSettings();
                if (settingsRes?.data?.downloadsPath) {
                    setDownloadsPath(settingsRes.data.downloadsPath);
                }
            }
        } catch (error) {
            console.error('Failed to load DVR settings:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSelectPath() {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Select DVR Storage Directory',
            });

            if (selected && typeof selected === 'string') {
                setStoragePath(selected);
                await saveDvrSetting('storage_path', selected);
            }
        } catch (error) {
            console.error('Failed to select directory:', error);
            alert('Failed to select directory');
        }
    }

    async function handleSelectDownloadsPath() {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Select Media Downloads Directory',
            });

            if (selected && typeof selected === 'string') {
                setDownloadsPath(selected);
                if (window.storage) {
                    await window.storage.updateSettings({ downloadsPath: selected });
                }
            }
        } catch (error) {
            console.error('Failed to select downloads directory:', error);
            alert('Failed to select downloads directory');
        }
    }

    async function handleStartPaddingChange(value: number) {
        setStartPadding(value);
        await saveDvrSetting('default_start_padding_sec', value);
    }

    async function handleEndPaddingChange(value: number) {
        setEndPadding(value);
        const mins = value / 60;
        setCustomEndPaddingInput(Number(mins.toFixed(2)).toString());
        await saveDvrSetting('default_end_padding_sec', value);
    }

    async function handleSaveCustomEndPadding() {
        const mins = parseFloat(customEndPaddingInput);
        if (!isNaN(mins) && mins >= 0) {
            const seconds = Math.round(mins * 60);
            await handleEndPaddingChange(seconds);
        }
    }

    async function handleAutoConvertChange(value: string) {
        setAutoConvertFormat(value);
        await saveDvrSetting('auto_convert_format', value);
    }

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        if (mins < 1) return `${seconds}s`;
        if (mins === 1) return '1 min';
        return `${mins} mins`;
    };

    if (loading) {
        return (
            <div className="settings-tab-content">
                <div className="settings-section">
                    <p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-tab-content">
            {/* Storage Location */}
            <div className="settings-section" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
                <div className="section-header">
                    <h3>Storage Location</h3>
                </div>
                <p className="section-description" style={{ marginBottom: '12px' }}>
                    Where recorded videos will be saved.
                    {!storagePath && (
                        <span style={{ color: '#ff9900', display: 'block', marginTop: '4px' }}>
                            ⚠️ Storage path is required for recordings to work
                        </span>
                    )}
                </p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                        type="text"
                        value={storagePath || 'Default location'}
                        readOnly
                        style={{
                            flex: 1,
                            padding: '10px 14px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: storagePath ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                            fontSize: '0.85rem',
                            fontFamily: 'monospace'
                        }}
                    />
                    <button
                        className="sync-btn"
                        onClick={handleSelectPath}
                        type="button"
                        style={{ maxWidth: '120px', borderColor: 'rgba(255,255,255,0.2)' }}
                    >
                        Browse
                    </button>
                </div>
            </div>

            {/* Downloads Location */}
            <div className="settings-section" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
                <div className="section-header">
                    <h3>Downloads Location</h3>
                </div>
                <p className="section-description" style={{ marginBottom: '12px' }}>
                    Where downloaded videos/VODs will be saved. If unset, you will be prompted for a location each time.
                </p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                        type="text"
                        value={downloadsPath || 'Ask every time'}
                        readOnly
                        style={{
                            flex: 1,
                            padding: '10px 14px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: downloadsPath ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                            fontSize: '0.85rem',
                            fontFamily: 'monospace'
                        }}
                    />
                    <button
                        className="sync-btn"
                        onClick={handleSelectDownloadsPath}
                        type="button"
                        style={{ maxWidth: '120px', borderColor: 'rgba(255,255,255,0.2)' }}
                    >
                        Browse
                    </button>
                </div>
            </div>

            {/* Recording Padding */}
            <div className="settings-section" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
                <div className="section-header">
                    <h3>Recording Padding</h3>
                </div>
                <p className="section-description">
                    Default buffer time added to the beginning and end of recordings.
                </p>

                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>Start Padding</label>
                        <span style={{ 
                            fontSize: '0.8rem', 
                            color: '#00d4ff',
                            background: 'rgba(0, 212, 255, 0.1)',
                            padding: '2px 8px',
                            borderRadius: '4px'
                        }}>
                            {formatDuration(startPadding)}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="300"
                        step="15"
                        value={startPadding}
                        onChange={(e) => handleStartPaddingChange(parseInt(e.target.value))}
                        style={{
                            width: '100%',
                            height: '4px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '2px',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                        <span>None</span>
                        <span>5 min</span>
                    </div>
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>End Padding</label>
                        <span style={{ 
                            fontSize: '0.8rem', 
                            color: '#00d4ff',
                            background: 'rgba(0, 212, 255, 0.1)',
                            padding: '2px 8px',
                            borderRadius: '4px'
                        }}>
                            {formatDuration(endPadding)}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max={Math.max(900, endPadding)}
                        step="30"
                        value={endPadding}
                        onChange={(e) => handleEndPaddingChange(parseInt(e.target.value))}
                        style={{
                            width: '100%',
                            height: '4px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '2px',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                        <span>None</span>
                        <span>{formatDuration(Math.max(900, endPadding))}</span>
                    </div>

                    {/* Custom End Padding Input */}
                    <div style={{ 
                        marginTop: '16px', 
                        display: 'flex', 
                        gap: '12px', 
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.02)',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ 
                                display: 'block', 
                                fontSize: '0.75rem', 
                                color: 'rgba(255,255,255,0.5)',
                                marginBottom: '4px'
                            }}>
                                Custom End Padding (minutes)
                            </label>
                            <input
                                type="number"
                                min="0"
                                placeholder="Enter custom minutes"
                                value={customEndPaddingInput}
                                onChange={(e) => setCustomEndPaddingInput(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#fff',
                                    fontSize: '0.85rem',
                                    outline: 'none',
                                    padding: '2px 0'
                                }}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSaveCustomEndPadding}
                            disabled={customEndPaddingInput === '' || isNaN(parseFloat(customEndPaddingInput)) || parseFloat(customEndPaddingInput) < 0}
                            className="sync-btn"
                            style={{
                                padding: '6px 12px',
                                fontSize: '0.8rem',
                                border: '1px solid rgba(0, 212, 255, 0.4)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                outline: 'none'
                            }}
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>

            {/* Auto-Convert Settings */}
            <div className="settings-section" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
                <div className="section-header">
                    <h3>Auto-Convert Recordings</h3>
                </div>
                <p className="section-description" style={{ marginBottom: '12px' }}>
                    Automatically convert completed recordings to MP4 or MKV format using FFmpeg (lossless stream copy).
                </p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <select
                        value={autoConvertFormat}
                        onChange={(e) => handleAutoConvertChange(e.target.value)}
                        style={{
                            flex: 1,
                            padding: '10px 14px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            outline: 'none',
                        }}
                    >
                        <option value="none" style={{ background: '#1c1c1e', color: 'rgba(255,255,255,0.9)' }}>None (Keep original .ts)</option>
                        <option value="mp4" style={{ background: '#1c1c1e', color: 'rgba(255,255,255,0.9)' }}>MP4 (.mp4)</option>
                        <option value="mkv" style={{ background: '#1c1c1e', color: 'rgba(255,255,255,0.9)' }}>MKV (.mkv)</option>
                    </select>
                </div>
            </div>
        </div>
    );
}

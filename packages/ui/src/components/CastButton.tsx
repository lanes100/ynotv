import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './CastButton.css';

interface DiscoveredDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
}

interface CastStatus {
  connected: boolean;
  deviceName: string;
  playerState: string;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
}

interface CastButtonProps {
  castEnabled: boolean;
  onCastCurrentStream?: () => void;
}

export function CastButton({ castEnabled, onCastCurrentStream }: CastButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [status, setStatus] = useState<CastStatus>({
    connected: false,
    deviceName: '',
    playerState: 'IDLE',
    currentTime: 0,
    duration: 0,
    volume: 1.0,
    muted: false,
  });
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Listen to Tauri events for device discovery and connection status
  useEffect(() => {
    if (!castEnabled) {
      setDevices([]);
      setStatus(prev => ({ ...prev, connected: false, deviceName: '' }));
      return;
    }

    let unlistenDevice: (() => void) | undefined;
    let unlistenStatus: (() => void) | undefined;

    // Listen to discovered devices
    listen<DiscoveredDevice[]>('cast-device-found', (event) => {
      console.log('[Cast] Devices found event:', event.payload);
      setDevices(event.payload);
    }).then((unsub) => {
      unlistenDevice = unsub;
    });

    // Listen to status updates
    listen<CastStatus>('cast-status', (event) => {
      const newStatus = event.payload;
      setStatus(newStatus);
      if (newStatus.connected) {
        setConnectingId(null);
        setErrorMsg(null);
      }
    }).then((unsub) => {
      unlistenStatus = unsub;
    });

    return () => {
      if (unlistenDevice) unlistenDevice();
      if (unlistenStatus) unlistenStatus();
    };
  }, [castEnabled]);

  const handleConnect = async (device: DiscoveredDevice) => {
    if (connectingId) return;
    setConnectingId(device.id);
    setErrorMsg(null);
    try {
      await invoke('cast_connect', {
        ip: device.ip,
        port: device.port,
        name: device.name,
      });
    } catch (e: any) {
      console.error('[Cast] Connection failed:', e);
      setErrorMsg(typeof e === 'string' ? e : e.message || 'Failed to connect');
      setConnectingId(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      await invoke('cast_disconnect');
      setStatus(prev => ({ ...prev, connected: false, deviceName: '' }));
      setConnectingId(null);
      setErrorMsg(null);
    } catch (e: any) {
      console.error('[Cast] Disconnect failed:', e);
    }
  };

  if (!castEnabled) return null;

  return (
    <div className="cast-button-container" ref={containerRef}>
      <button
        className={`title-bar-cast-btn ${status.connected ? 'connected' : ''} ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={status.connected ? `Casting to ${status.deviceName}` : 'Google Cast'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="cast-icon"
        >
          {/* Base Cast Icon Paths */}
          <path d="M2 17a5 5 0 0 1 5 5" className="cast-wave-line-1" />
          <path d="M2 13a9 9 0 0 1 9 9" className="cast-wave-line-2" />
          <path d="M2 9a13 13 0 0 1 13 13" className="cast-wave-line-3" />
          <path d="M2 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6" />
          <line x1="2" y1="20" x2="2.01" y2="20" />
        </svg>
        {status.connected && <span className="cast-indicator-dot" />}
      </button>

      {isOpen && (
        <div className="cast-dropdown">
          <div className="cast-dropdown-header">
            <h4>Google Cast</h4>
            <span className="cast-scan-pulse"></span>
          </div>

          <div className="cast-device-list">
            {status.connected ? (
              <div className="cast-connected-device-item-expanded">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                  <div className="cast-device-info" style={{ flexGrow: 1, minWidth: 0 }}>
                    <div className="cast-device-name-active">{status.deviceName}</div>
                    <div className="cast-device-status-label">
                      {status.playerState === 'PLAYING'
                        ? 'Playing'
                        : status.playerState === 'PAUSED'
                        ? 'Paused'
                        : 'Connected'}
                    </div>
                  </div>
                  <button className="cast-dropdown-disconnect-btn" onClick={handleDisconnect}>
                    Disconnect
                  </button>
                </div>

                <div className="cast-controls-row">
                  {status.playerState === 'PLAYING' ? (
                    <button className="cast-control-btn" onClick={() => invoke('cast_pause')} title="Pause">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="5" y="4" width="4" height="16" rx="1" />
                        <rect x="15" y="4" width="4" height="16" rx="1" />
                      </svg>
                    </button>
                  ) : (
                    <button className="cast-control-btn" onClick={() => invoke('cast_play')} title="Play">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="6,4 20,12 6,20" />
                      </svg>
                    </button>
                  )}

                  <button className="cast-control-btn" onClick={() => invoke('cast_toggle_mute')} title={status.muted ? "Unmute" : "Mute"}>
                    {status.muted ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 5L6 9H2v6h4l5 4V5z" />
                        <line x1="23" y1="9" x2="17" y2="15" />
                        <line x1="17" y1="9" x2="23" y2="15" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 5L6 9H2v6h4l5 4V5z" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    )}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(status.volume * 100)}
                    className="cast-volume-slider"
                    onChange={(e) => invoke('cast_set_volume', { level: parseFloat(e.target.value) / 100 })}
                    title="Volume"
                  />
                </div>

                {onCastCurrentStream && (
                  <button className="cast-current-stream-btn" onClick={onCastCurrentStream}>
                    Cast Current Video
                  </button>
                )}
              </div>
            ) : (
              <>
                {devices.length === 0 ? (
                  <div className="cast-no-devices">
                    <span className="cast-spinner"></span>
                    Searching for devices...
                  </div>
                ) : (
                  devices.map((device) => {
                    const isConnecting = connectingId === device.id;
                    return (
                      <button
                        key={device.id}
                        className={`cast-device-item ${isConnecting ? 'connecting' : ''}`}
                        onClick={() => handleConnect(device)}
                        disabled={!!connectingId}
                      >
                        <svg
                          className="cast-device-icon"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                        <span className="cast-device-name-text">{device.name}</span>
                        {isConnecting && <span className="cast-connecting-spinner"></span>}
                      </button>
                    );
                  })
                )}
              </>
            )}
          </div>

          {errorMsg && (
            <div className="cast-dropdown-error">
              {errorMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

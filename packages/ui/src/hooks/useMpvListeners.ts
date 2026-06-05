import { useState, useEffect, useRef, useCallback } from 'react';
import type { MpvStatus } from '../types/app';
import { Bridge } from '../services/tauri-bridge';

export interface MpvState {
    mpvReady: boolean;
    playing: boolean;
    volume: number;
    muted: boolean;
    position: number;
    duration: number;
    error: string | null;
    // Drag/seek refs exposed for NowPlayingBar
    volumeDraggingRef: React.MutableRefObject<boolean>;
    seekingRef: React.MutableRefObject<boolean>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
    setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    setPosition: React.Dispatch<React.SetStateAction<number>>;
    setVolume: React.Dispatch<React.SetStateAction<number>>;
    setCurrentChannelNull: () => void;
}

interface UseMpvListenersOptions {
    onReady?: () => void;
    timeshiftEnabled?: boolean;
    timeshiftCacheBytes?: number;
    settingsLoaded?: boolean; // Wait for settings before initializing MPV
}

/**
 * Subscribes to all Tauri mpv-* events and exposes the resulting player state.
 * Extracted from App.tsx to keep the event wiring self-contained.
 */
export function useMpvListeners(options: UseMpvListenersOptions = {}) {
    const [mpvReady, setMpvReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [volume, setVolume] = useState(100);
    const [muted, setMuted] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const volumeDraggingRef = useRef(false);
    const seekingRef = useRef(false);
    const initializedRef = useRef(false);
    const timeshiftSettingsRef = useRef({
        enabled: options.timeshiftEnabled,
        cacheBytes: options.timeshiftCacheBytes,
    });

    // When true, the mpv-http-error event is silenced.
    // Used for Stalker/MAC sources where auth headers cause false 401/403 errors
    // even when the stream actually plays successfully.
    const ignoreHttpErrorsRef = useRef(false);
    const setIgnoreHttpErrors = useCallback((val: boolean) => { ignoreHttpErrorsRef.current = val; }, []);
    const isIgnoringHttpErrors = useCallback(() => ignoreHttpErrorsRef.current, []);

    // Keep a ref to the onReady callback to avoid re-running the effect on identity changes
    const onReadyRef = useRef(options.onReady);
    useEffect(() => { onReadyRef.current = options.onReady; }, [options.onReady]);
    useEffect(() => {
        timeshiftSettingsRef.current = {
            enabled: options.timeshiftEnabled,
            cacheBytes: options.timeshiftCacheBytes,
        };
    }, [options.timeshiftEnabled, options.timeshiftCacheBytes]);

    useEffect(() => {
        if (!Bridge.isTauri) {
            setError('mpv API not available');
            return;
        }

        // Don't initialize MPV until settings are loaded from store
        // This ensures timeshift settings are available before MPV starts
        if (!options.settingsLoaded) {
            return;
        }

        let unlistenFns: (() => void)[] = [];
        let disposed = false;

        import('@tauri-apps/api/event').then(async ({ listen }) => {
            const unlistenReady = await listen('mpv-ready', (e: any) => {
                setMpvReady(e.payload);
                if (e.payload) onReadyRef.current?.();
            });

            const unlistenStatus = await listen('mpv-status', (e: any) => {
                const status = e.payload as MpvStatus;
                if (status.playing !== undefined) setPlaying(status.playing);
                if (status.volume !== undefined && !volumeDraggingRef.current) setVolume(status.volume);
                if (status.muted !== undefined) setMuted(status.muted);
                if (status.position !== undefined && !seekingRef.current) setPosition(status.position);
                if (status.duration !== undefined) setDuration(status.duration);

                // Clear stale playback errors once the stream is playing and making progress
                if (status.playing && status.position !== undefined && status.position > 0) {
                    setError(null);
                }
            });

            const unlistenError = await listen('mpv-error', (e: any) => {
                const err: string = e.payload;
                setError(prev => {
                    // Don't overwrite specific HTTP/contextual errors with generic ones
                    if (prev && prev !== err && (
                        prev.includes('HTTP Error') ||
                        prev.includes('Access Denied') ||
                        prev.includes('Stream Not Found') ||
                        prev.includes('Stream Error:')
                    )) return prev;
                    return err;
                });
            });

            const unlistenHttpError = await listen('mpv-http-error', (e: any) => {
                // Suppress HTTP errors for Stalker/MAC sources where auth headers
                // cause false 401/403 errors but the stream plays fine.
                if (!ignoreHttpErrorsRef.current) {
                    setError(e.payload);
                }
            });

            const unlistenEndFileError = await listen('mpv-end-file-error', (e: any) => {
                setError(prev => prev ? prev : e.payload);
            });

            unlistenFns = [
                unlistenReady, unlistenStatus, unlistenError,
                unlistenHttpError, unlistenEndFileError,
            ];

            if (disposed) {
                unlistenFns.forEach(fn => fn());
                return;
            }

            // Init MPV after listeners are registered to catch the ready event
            // Pass timeshift settings from frontend state (already loaded from store)
            if (!initializedRef.current) {
                initializedRef.current = true;
                const { enabled, cacheBytes } = timeshiftSettingsRef.current;
                Bridge.initMpv(enabled, cacheBytes);
            }
        });

        return () => {
            disposed = true;
            unlistenFns.forEach(fn => fn());
        };
    }, [
        options.settingsLoaded,
    ]); // Register listeners once after settings load; MPV init is intentionally one-shot.

    return {
        mpvReady, playing, volume, muted, position, duration, error,
        volumeDraggingRef, seekingRef,
        setError, setPlaying, setPosition, setVolume, setMuted,
        setDuration, setMpvReady,
        setIgnoreHttpErrors, isIgnoringHttpErrors,
    };
}

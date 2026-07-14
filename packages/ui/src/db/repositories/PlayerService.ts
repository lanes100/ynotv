import { IPlayerService, PlayerState } from '@ynotv/core';
import { Bridge } from '../../services/tauri-bridge';

export class PlayerService implements IPlayerService {
  private _state: PlayerState = {
    playing: false,
    volume: 100,
    muted: false,
    position: 0,
    duration: 0,
    buffering: false,
  };

  private _stateListeners: Set<(state: PlayerState) => void> = new Set();
  private _errorListeners: Set<(error: string) => void> = new Set();
  private _unlistenFns: (() => void)[] = [];

  constructor() {
    this.initMpvListeners();
  }

  private async initMpvListeners() {
    if (!Bridge.isTauri) return;

    try {
      const { listen } = await import('@tauri-apps/api/event');
      
      const unlistenStatus = await listen('mpv-status', (event: any) => {
        const payload = event.payload;
        this._state = {
          playing: !!payload.playing,
          volume: typeof payload.volume === 'number' ? payload.volume : 100,
          muted: !!payload.muted,
          position: typeof payload.position === 'number' ? payload.position : 0,
          duration: typeof payload.duration === 'number' ? payload.duration : 0,
          buffering: !!payload.pausedForCache,
        };
        this.notifyStateListeners();
      });
      this._unlistenFns.push(unlistenStatus);

      const unlistenError = await listen('mpv-error', (event: any) => {
        const errorMsg = String(event.payload || 'Unknown playback error');
        this.notifyErrorListeners(errorMsg);
      });
      this._unlistenFns.push(unlistenError);
    } catch (err) {
      console.error('[PlayerService] Failed to bind MPV listeners:', err);
    }
  }

  private notifyStateListeners() {
    for (const listener of this._stateListeners) {
      try {
        listener({ ...this._state });
      } catch (e) {
        console.error(e);
      }
    }
  }

  private notifyErrorListeners(error: string) {
    for (const listener of this._errorListeners) {
      try {
        listener(error);
      } catch (e) {
        console.error(e);
      }
    }
  }

  async load(url: string): Promise<void> {
    await Bridge.loadVideo(url);
  }

  async play(): Promise<void> {
    await Bridge.play();
  }

  async pause(): Promise<void> {
    await Bridge.pause();
  }

  async togglePause(): Promise<void> {
    if (this._state.playing) {
      await Bridge.pause();
    } else {
      await Bridge.play();
    }
  }

  async stop(): Promise<void> {
    await Bridge.stop();
  }

  async seek(seconds: number, _relative?: boolean): Promise<void> {
    await Bridge.seek(seconds);
  }

  async setVolume(volume: number): Promise<void> {
    await Bridge.setProperty('volume', volume);
  }

  async getVolume(): Promise<number> {
    const res = await Bridge.getProperty('volume');
    return typeof res === 'number' ? res : this._state.volume;
  }

  async setMute(muted: boolean): Promise<void> {
    await Bridge.setProperty('mute', muted);
  }

  async isMuted(): Promise<boolean> {
    const res = await Bridge.getProperty('mute');
    return typeof res === 'boolean' ? res : this._state.muted;
  }

  isPlaying(): boolean {
    return this._state.playing;
  }

  async getCurrentPosition(): Promise<number> {
    const res = await Bridge.getProperty('time-pos');
    return typeof res === 'number' ? res : this._state.position;
  }

  async getDuration(): Promise<number> {
    const res = await Bridge.getProperty('duration');
    return typeof res === 'number' ? res : this._state.duration;
  }

  onStateChange(callback: (state: PlayerState) => void): () => void {
    this._stateListeners.add(callback);
    callback({ ...this._state });
    return () => {
      this._stateListeners.delete(callback);
    };
  }

  onError(callback: (error: string) => void): () => void {
    this._errorListeners.add(callback);
    return () => {
      this._errorListeners.delete(callback);
    };
  }

  dispose() {
    for (const unlisten of this._unlistenFns) {
      unlisten();
    }
    this._unlistenFns = [];
    this._stateListeners.clear();
    this._errorListeners.clear();
  }
}

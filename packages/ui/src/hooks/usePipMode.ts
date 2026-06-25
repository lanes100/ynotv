import { useState, useCallback, useRef, useEffect } from 'react';
import { getCurrentWindow, currentMonitor, LogicalSize, LogicalPosition } from '@tauri-apps/api/window';

interface WindowSnapshot {
  width: number;
  height: number;
  x: number;
  y: number;
  maximized: boolean;
  alwaysOnTop: boolean;
}

interface PipSavedState {
  x: number | null;
  y: number | null;
  width: number;
  height: number;
}

const PIP_W = 480;
const PIP_H = 270;
const PIP_RIGHT = 24;
const PIP_BOTTOM = 56;
const PIP_MIN_W = 360;
const PIP_MIN_H = 203;
const MAIN_MIN_W = 960;
const MAIN_MIN_H = 600;
const AUTO_HIDE_MS = 1000;
const STORAGE_KEY = 'ynotv_pip_state';

function loadPipState(): PipSavedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { x: null, y: null, width: PIP_W, height: PIP_H };
}

function savePipState(s: PipSavedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

export function usePipMode() {
  const [pipMode, setPipMode] = useState(false);
  const [pipControlsVisible, setPipControlsVisible] = useState(false);
  const snap = useRef<WindowSnapshot | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pipActiveRef = useRef(false);

  useEffect(() => { pipActiveRef.current = pipMode; }, [pipMode]);

  const showPipControls = useCallback(() => {
    setPipControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setPipControlsVisible(false);
    }, AUTO_HIDE_MS);
  }, []);

  useEffect(() => {
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  const enterPip = useCallback(async () => {
    try {
      const w = getCurrentWindow();
      const [maximized, innerSize, outerSize, pos, onTop, sf] = await Promise.all([
        w.isMaximized(),
        w.innerSize(),
        w.outerSize(),
        w.outerPosition(),
        w.isAlwaysOnTop(),
        w.scaleFactor(),
      ]);

      // Store snapshot in logical (DPI-independent) units
      snap.current = {
        width: innerSize.width / sf,
        height: innerSize.height / sf,
        x: pos.x / sf,
        y: pos.y / sf,
        maximized,
        alwaysOnTop: onTop,
      };

      const saved = loadPipState();
      let pipW = saved.width;
      let pipH = saved.height;
      let tx = saved.x;
      let ty = saved.y;

      if (tx === null || ty === null) {
        if (maximized) {
          const mon = await currentMonitor();
          if (mon) {
            tx = (mon.position.x + mon.size.width) / sf - pipW - PIP_RIGHT;
            ty = (mon.position.y + mon.size.height) / sf - pipH - PIP_BOTTOM;
          } else {
            tx = pos.x / sf + outerSize.width / sf - pipW - PIP_RIGHT;
            ty = pos.y / sf + outerSize.height / sf - pipH - PIP_BOTTOM;
          }
        } else {
          tx = pos.x / sf + outerSize.width / sf - pipW - PIP_RIGHT;
          ty = pos.y / sf + outerSize.height / sf - pipH - PIP_BOTTOM;
        }
      }

      if (maximized) {
        await w.unmaximize();
        await new Promise(r => setTimeout(r, 50));
      }

      await w.setMinSize(new LogicalSize(PIP_MIN_W, PIP_MIN_H));
      await w.setSize(new LogicalSize(pipW, pipH));
      await w.setPosition(new LogicalPosition(tx, ty));
      await w.setAlwaysOnTop(true);
      setPipMode(true);
      setPipControlsVisible(true);
    } catch (e) {
      console.error('[PiP] enter failed:', e);
    }
  }, []);

  const exitPip = useCallback(async () => {
    try {
      const w = getCurrentWindow();

      const [innerSize, pos, sf] = await Promise.all([
        w.innerSize(),
        w.outerPosition(),
        w.scaleFactor(),
      ]);

      // Save current PiP geometry in logical units so loadPipState is DPI-independent
      savePipState({
        x: Math.round(pos.x / sf),
        y: Math.round(pos.y / sf),
        width: Math.round(innerSize.width / sf),
        height: Math.round(innerSize.height / sf),
      });

      const s = snap.current;

      await w.setMinSize(new LogicalSize(MAIN_MIN_W, MAIN_MIN_H));
      await w.setAlwaysOnTop(s?.alwaysOnTop ?? false);

      if (s?.maximized) {
        await w.maximize();
      } else if (s) {
        // Restore from logical snapshot
        await w.setSize(new LogicalSize(s.width, s.height));
        await w.setPosition(new LogicalPosition(s.x, s.y));
      } else {
        await w.setSize(new LogicalSize(1280, 800));
      }

      if (hideTimer.current) clearTimeout(hideTimer.current);
      snap.current = null;
      setPipMode(false);
      setPipControlsVisible(false);
    } catch (e) {
      console.error('[PiP] exit failed:', e);
    }
  }, []);

  const togglePip = useCallback(async () => {
    if (pipMode) await exitPip();
    else await enterPip();
  }, [pipMode, enterPip, exitPip]);

  return { pipMode, pipControlsVisible, togglePip, exitPip, showPipControls };
}

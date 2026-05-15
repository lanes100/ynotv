import type { ReactNode } from 'react';
import './WidgetBar.css';

interface WidgetBarProps {
  /** Apply the tighter bottom offset when the Channel Info Overlay is enabled */
  cioEnabled: boolean;
  children: ReactNode;
}

/**
 * Shared flex container for all overlay widgets (Recent, Favorites, …).
 * Widgets sit inside this bar as plain block children — they flow naturally
 * side-by-side with a gap, and scale/positioning is handled here once,
 * so adding more widgets never requires hardcoded left-offset math.
 */
export function WidgetBar({ cioEnabled, children }: WidgetBarProps) {
  return (
    <div className={`widget-bar${cioEnabled ? ' cio-enabled' : ''}`}>
      {children}
    </div>
  );
}

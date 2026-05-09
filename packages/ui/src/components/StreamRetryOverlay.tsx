import './StreamRetryOverlay.css';

export interface RetryState {
  isRetrying: boolean;
  countdown: number;
  attempt: number;
  maxRetries: number;
}

interface StreamRetryOverlayProps {
  retryState: RetryState;
  /** Render in compact mode for the ChannelPanel preview pane */
  isSmall?: boolean;
}

export function StreamRetryOverlay({ retryState, isSmall = false }: StreamRetryOverlayProps) {
  const { countdown, attempt, maxRetries } = retryState;
  const isConnecting = countdown === 0;

  return (
    <div className={`stream-retry-overlay ${isSmall ? 'small' : ''}`}>
      <div className="stream-retry-content">
        {/* Animated signal icon */}
        <div className="stream-retry-icon">
          <div className="stream-retry-pulse" />
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Wifi-off style icon */}
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </div>

        <div className="stream-retry-text">
          <span className="stream-retry-title">Stream disconnected</span>
          <span className="stream-retry-countdown">
            {isConnecting ? 'Reconnecting…' : `Retrying in ${countdown}s`}
          </span>
          <span className="stream-retry-attempt">
            Attempt {attempt} of {maxRetries}
          </span>
        </div>
      </div>
    </div>
  );
}

import './ChannelLoadingOverlay.css';

interface ChannelLoadingOverlayProps {
  channelName: string;
  loadingState: 'loading' | 'buffering' | 'unavailable';
  isSmall?: boolean;
}

export function ChannelLoadingOverlay({
  channelName,
  loadingState,
  isSmall = false,
}: ChannelLoadingOverlayProps) {
  let statusText = '';
  let subtext = '';
  let showSpinner = true;
  let icon = '';

  if (loadingState === 'loading') {
    statusText = `'${channelName}' Working on it...`;
  } else if (loadingState === 'buffering') {
    statusText = `'${channelName}' Buffering...`;
  } else if (loadingState === 'unavailable') {
    statusText = `'${channelName}' is currently unavailable`;
    subtext = 'Unable to reach stream.';
    showSpinner = false;
    icon = '⚠️';
  }

  return (
    <div className={`channel-loading-overlay ${isSmall ? 'small' : ''} state-${loadingState}`}>
      <div className="channel-loading-content">
        {showSpinner ? (
          <div className="channel-loading-spinner-container">
            <svg className="channel-loading-spinner" viewBox="0 0 50 50">
              <circle
                className="path"
                cx="25"
                cy="25"
                r="20"
                fill="none"
                strokeWidth="4"
              />
            </svg>
          </div>
        ) : (
          <div className="channel-loading-icon">{icon}</div>
        )}
        <div className="channel-loading-text">
          <span className="channel-loading-status">{statusText}</span>
          {subtext && <span className="channel-loading-subtext">{subtext}</span>}
        </div>
      </div>
    </div>
  );
}

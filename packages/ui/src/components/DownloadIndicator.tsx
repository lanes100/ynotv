import { useDownloadStore } from '../stores/downloadStore';
import './DownloadIndicator.css';

interface DownloadIndicatorProps {
  size?: 'small' | 'medium';
  className?: string;
}

export function DownloadIndicator({ size = 'small', className = '' }: DownloadIndicatorProps) {
  const downloads = useDownloadStore((s) => s.downloads) || [];
  const activeCount = downloads.filter((d) => d.status === 'downloading').length;

  if (activeCount === 0) return null;

  return (
    <div
      className={`download-indicator ${size} ${className}`}
      title={`${activeCount} download${activeCount !== 1 ? 's' : ''} in progress`}
    >
      <div className="download-dot pulse"></div>
      <span className="download-text">
        {activeCount > 1 ? `DL (${activeCount})` : 'DL'}
      </span>
    </div>
  );
}

export default DownloadIndicator;

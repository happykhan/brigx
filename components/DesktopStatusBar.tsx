import type { ProgressUpdate } from '@/lib/types';
import { APP_VERSION } from '@/lib/version';

interface DesktopStatusBarProps {
  progress: ProgressUpdate;
  isProcessing: boolean;
  referenceName: string | null;
  ringCount: number;
  isDirty: boolean;
}

export default function DesktopStatusBar({
  progress,
  isProcessing,
  referenceName,
  ringCount,
  isDirty,
}: DesktopStatusBarProps) {
  const status = isProcessing
    ? `${progress.step}${progress.message ? ` — ${progress.message}` : ''}`
    : referenceName
      ? 'Ready'
      : 'Waiting for a reference genome';

  return (
    <footer className="desktop-status" aria-label="Application status">
      <div className="desktop-status-primary" aria-live="polite">
        <span className={isProcessing ? 'desktop-status-indicator active' : 'desktop-status-indicator'} aria-hidden="true" />
        <span>{status}</span>
        {isProcessing && <span className="desktop-status-progress">{Math.round(progress.percent)}%</span>}
      </div>
      <div className="desktop-status-meta">
        <span>{referenceName ?? 'No reference'}</span>
        <span>{ringCount} {ringCount === 1 ? 'ring' : 'rings'}</span>
        <span>{isDirty ? 'Modified' : 'Saved'}</span>
        <span>BRIGX {APP_VERSION} Beta</span>
      </div>
    </footer>
  );
}

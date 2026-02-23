'use client';

import type { ProgressUpdate } from '@/lib/types';

interface ProgressPanelProps {
  progress: ProgressUpdate;
}

export default function ProgressPanel({ progress }: ProgressPanelProps) {
  return (
    <div className="card animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: 'var(--gx-text)' }}>{progress.step}</span>
        <span className="text-sm" style={{ color: 'var(--gx-text-muted)' }}>{progress.percent}%</span>
      </div>
      <div className="progress-bg">
        <div
          className="progress-bar"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      {progress.message && (
        <div className="mt-2 text-xs" style={{ color: 'var(--gx-text-muted)' }}>{progress.message}</div>
      )}
    </div>
  );
}

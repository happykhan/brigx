'use client';

import type { ProgressUpdate } from '@/lib/types';

interface ProgressPanelProps {
  progress: ProgressUpdate;
}

export default function ProgressPanel({ progress }: ProgressPanelProps) {
  return (
    <div className="card animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{progress.step}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">{progress.percent}%</span>
      </div>
      <div className="progress-bg">
        <div
          className="progress-bar"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      {progress.message && (
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">{progress.message}</div>
      )}
    </div>
  );
}

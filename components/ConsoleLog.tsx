'use client';

import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import type { ProgressUpdate } from '@/lib/types';

interface ConsoleLogProps {
  logs: string[];
  progress?: ProgressUpdate;
}

export default function ConsoleLog({ logs, progress }: ConsoleLogProps) {
  const [isOpen, setIsOpen] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = () => {
    const text = logs.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Console logs copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy logs');
    });
  };

  return (
    <div className="card mt-6">
      {/* Progress Bar */}
      {progress && progress.step !== 'idle' && progress.step !== 'Complete!' && (
        <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
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
      )}
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            {isOpen ? '▼' : '▶'}
          </button>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Debug Console</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">({logs.length} messages)</span>
        </div>
        <button
          onClick={copyToClipboard}
          className="btn-secondary text-xs px-3 py-1 flex items-center gap-1"
          disabled={logs.length === 0}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </button>
      </div>
      
      {isOpen && (
        <div
          ref={logRef}
          className="bg-gray-900 dark:bg-black text-green-400 font-mono text-xs p-4 rounded max-h-96 overflow-y-auto"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500">No logs yet...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1 whitespace-pre-wrap break-all">
                {log}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

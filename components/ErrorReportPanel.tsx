import { useEffect, useState } from 'react';
import { buildErrorReportText } from '@/lib/errorReport';

interface ErrorReportPanelProps {
  error: string;
  diagnosticLogs: string[];
  onRetry?: () => void;
}

type CopyState = 'idle' | 'copied' | 'failed';

export default function ErrorReportPanel({ error, diagnosticLogs, onRetry }: ErrorReportPanelProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');

  useEffect(() => setCopyState('idle'), [error]);

  const copyError = async () => {
    try {
      await navigator.clipboard.writeText(buildErrorReportText(error, diagnosticLogs));
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <section className="console-error-panel" aria-label="Alignment error">
      <div className="console-error-heading">
        <div>
          <strong>Error</strong>
          <p>Something stopped the alignment.</p>
        </div>
        <div className="console-error-actions">
          {onRetry && (
            <button type="button" className="btn-primary console-error-retry" onClick={onRetry}>
              Retry alignment
            </button>
          )}
          <button type="button" className="btn-secondary console-error-copy" onClick={copyError}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy error details'}
          </button>
        </div>
      </div>
      <pre>{error}</pre>
      <span className="sr-only" aria-live="polite">
        {copyState === 'copied' ? 'Error details copied to clipboard' : copyState === 'failed' ? 'Could not copy error details' : ''}
      </span>
    </section>
  );
}

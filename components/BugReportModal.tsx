import { useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '@/lib/version';

interface BugReportModalProps {
  debugOutput: string;
  onClose: () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TEST_SITE_KEY = '1x00000000000000000000AA';

export default function BugReportModal({ debugOutput, onClose }: BugReportModalProps) {
  const [happened, setHappened] = useState('');
  const [expected, setExpected] = useState('');
  const [steps, setSteps] = useState('');
  const [email, setEmail] = useState('');
  const [includeDebugOutput, setIncludeDebugOutput] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const turnstileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY || (import.meta.env.DEV ? TEST_SITE_KEY : '');
    if (!sitekey || !turnstileRef.current) return;

    let widgetId: string | null = null;
    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !window.turnstile || !turnstileRef.current || widgetId) return;
      widgetId = window.turnstile.render(turnstileRef.current, {
        sitekey,
        callback: setTurnstileToken,
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT}"]`);
    if (existingScript) {
      if (window.turnstile) renderWidget();
      else existingScript.addEventListener('load', renderWidget, { once: true });
    } else {
      const script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', renderWidget, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, []);

  const submitReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    try {
      const response = await fetch('/api/report-bug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          happened,
          expected,
          steps,
          email,
          debugOutput: includeDebugOutput ? debugOutput : '',
          turnstileToken,
          environment: {
            appVersion: APP_VERSION,
            page: window.location.href,
            userAgent: navigator.userAgent,
          },
        }),
      });

      const responseBody = await response.text();
      let result: { error?: string } = {};
      if (responseBody) {
        try {
          result = JSON.parse(responseBody) as { error?: string };
        } catch {
          // Some hosting and proxy errors return HTML or plain text. The HTTP
          // status below is more useful to the reporter than a JSON parse error.
        }
      }

      if (!response.ok) {
        const localDevelopmentError = import.meta.env.DEV && response.status === 404
          ? 'Bug reports cannot be sent from the local Vite server because the Cloudflare reporting endpoint is not running. Submit the report from the deployed BRIGX site.'
          : '';
        throw new Error(result.error || localDevelopmentError || `The report could not be sent (HTTP ${response.status}).`);
      }
      setStatus('sent');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'The report could not be sent.');
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0, 0, 0, 0.6)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="bug-report-title" className="rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--gx-bg-alt)' }} onClick={event => event.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 id="bug-report-title" className="text-xl font-semibold">Report a bug</h2>
          <button type="button" onClick={onClose} aria-label="Close bug report">×</button>
        </div>

        {status === 'sent' ? (
          <div>
            <p>Thanks. Your report has been sent.</p>
            <button type="button" className="btn-primary mt-5" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submitReport}>
            <label className="block">
              <span className="block text-sm font-medium mb-1">What happened?</span>
              <textarea required maxLength={4000} rows={4} className="input-field w-full" value={happened} onChange={event => setHappened(event.target.value)} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">What did you expect?</span>
              <textarea required maxLength={2000} rows={3} className="input-field w-full" value={expected} onChange={event => setExpected(event.target.value)} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">Steps to reproduce</span>
              <textarea required maxLength={4000} rows={4} className="input-field w-full" value={steps} onChange={event => setSteps(event.target.value)} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">Email address <span className="font-normal" style={{ color: 'var(--gx-text-muted)' }}>(optional)</span></span>
              <input type="email" maxLength={254} className="input-field w-full" value={email} onChange={event => setEmail(event.target.value)} />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={includeDebugOutput} onChange={event => setIncludeDebugOutput(event.target.checked)} />
              Include the BRIGX debug output with this report
            </label>
            <p className="text-xs" style={{ color: 'var(--gx-text-muted)' }}>Do not include confidential, patient-identifiable, or raw sequence data.</p>
            <div ref={turnstileRef} />
            {status === 'error' && <p role="alert" style={{ color: 'var(--gx-error)' }}>{errorMessage}</p>}
            <button type="submit" className="btn-primary" disabled={status === 'sending' || !turnstileToken}>
              {status === 'sending' ? 'Sending…' : 'Send report'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

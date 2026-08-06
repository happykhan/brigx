import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductNav from '@/components/ProductNav';
import ResultViewer from '@/components/ResultViewer';
import { readFileText } from '@/lib/fileAccess';
import { parseResultSnapshotJson, type ResultSnapshot } from '@/lib/resultSnapshot';
import { fetchGitHubJson } from '@/lib/remoteJson';
import { importSession } from '@/lib/session';

interface ViewerPayload {
  snapshot: ResultSnapshot;
  editableSession: boolean;
}

function parseViewerPayload(json: string): ViewerPayload {
  try {
    const session = importSession(json);
    if (!session.result) {
      throw new Error('This older session has no embedded result to preview');
    }
    return { snapshot: session.result, editableSession: true };
  } catch (sessionError) {
    if (sessionError instanceof Error && sessionError.message.includes('no embedded result')) {
      throw sessionError;
    }
    return { snapshot: parseResultSnapshotJson(json), editableSession: false };
  }
}

export default function ViewerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceUrl = searchParams.get('url');
  const [snapshot, setSnapshot] = useState<ResultSnapshot | null>(null);
  const [editableSession, setEditableSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(sourceUrl ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sourceUrl) return;
    let cancelled = false;
    setSnapshot(null);
    setError(null);
    fetchGitHubJson(sourceUrl)
      .then(parseViewerPayload)
      .then(payload => {
        if (cancelled) return;
        setSnapshot(payload.snapshot);
        setEditableSession(payload.editableSession);
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load the GitHub file');
      });
    return () => { cancelled = true; };
  }, [sourceUrl]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = parseViewerPayload(await readFileText(file));
      setSnapshot(payload.snapshot);
      setEditableSession(payload.editableSession);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid BRIGX result file');
    }
    event.target.value = '';
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".json,.brigx-result.json,.brigx-session.json,application/json"
      className="hidden"
      aria-label="BRIGX result file"
      onChange={handleFile}
    />
  );

  if (snapshot) {
    const editUrl = sourceUrl && editableSession
      ? `/app?${new URLSearchParams({ url: sourceUrl }).toString()}`
      : undefined;
    return (
      <>
        <ProductNav />
        {fileInput}
        <ResultViewer
          snapshot={snapshot}
          mode={sourceUrl ? 'remote' : 'file'}
          onOpenFile={() => inputRef.current?.click()}
          editUrl={editUrl}
        />
      </>
    );
  }

  if (sourceUrl && !error) {
    return (
      <>
        <ProductNav />
        <main className="publication-page publication-message">Opening read-only result…</main>
      </>
    );
  }

  return (
    <>
      <ProductNav />
      <main className="publication-page publication-message preview-file-picker">
        <span className="product-kicker">BRIGX result viewer</span>
        <h1>{error ?? 'Open a read-only BRIGX result'}</h1>
        <p>Paste a public GitHub session URL, or choose a BRIGX result or session file. Files are loaded directly in your browser.</p>
        <form
          className="preview-url-form"
          onSubmit={event => {
            event.preventDefault();
            const value = urlInput.trim();
            if (value) setSearchParams({ url: value });
          }}
        >
          <label htmlFor="github-session-url">Public GitHub file URL</label>
          <div>
            <input
              id="github-session-url"
              type="url"
              value={urlInput}
              onChange={event => setUrlInput(event.target.value)}
              placeholder="https://github.com/owner/repo/blob/main/session.json"
              required
            />
            <button type="submit" className="gx-btn gx-btn-primary">Open in viewer</button>
          </div>
        </form>
        <button type="button" className="gx-btn gx-btn-primary" onClick={() => inputRef.current?.click()}>Choose result or session file</button>
        <Link to="/app">Return to BRIGX</Link>
        {fileInput}
      </main>
    </>
  );
}

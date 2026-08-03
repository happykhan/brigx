import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ResultViewer from '@/components/ResultViewer';
import { readFileText } from '@/lib/fileAccess';
import { loadResultPreview } from '@/lib/resultPreviewStore';
import { parseResultSnapshotJson, type ResultSnapshot } from '@/lib/resultSnapshot';
import { fetchGitHubJson } from '@/lib/remoteJson';
import { importSession } from '@/lib/session';

interface PreviewPayload {
  snapshot: ResultSnapshot;
  editableSession: boolean;
}

function parsePreviewPayload(json: string): PreviewPayload {
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

export default function PreviewPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceUrl = searchParams.get('url');
  const [snapshot, setSnapshot] = useState<ResultSnapshot | null>(null);
  const [editableSession, setEditableSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(sourceUrl ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    loadResultPreview(id)
      .then(result => {
        if (cancelled) return;
        if (result) setSnapshot(result);
        else setError('This local preview is unavailable or has expired.');
      })
      .catch(() => {
        if (!cancelled) setError('This local preview could not be opened.');
      });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (id || !sourceUrl) return;
    let cancelled = false;
    setSnapshot(null);
    setError(null);
    fetchGitHubJson(sourceUrl)
      .then(parsePreviewPayload)
      .then(payload => {
        if (cancelled) return;
        setSnapshot(payload.snapshot);
        setEditableSession(payload.editableSession);
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load the GitHub file');
      });
    return () => { cancelled = true; };
  }, [id, sourceUrl]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = parsePreviewPayload(await readFileText(file));
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
        {fileInput}
        <ResultViewer
          snapshot={snapshot}
          mode={sourceUrl ? 'remote' : id ? 'preview' : 'file'}
          onOpenFile={() => inputRef.current?.click()}
          editUrl={editUrl}
        />
      </>
    );
  }

  if ((id || sourceUrl) && !error) {
    return <main className="publication-page publication-message">Opening read-only result…</main>;
  }

  return (
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
          <button type="submit" className="gx-btn gx-btn-primary">Preview URL</button>
        </div>
      </form>
      <button type="button" className="gx-btn gx-btn-primary" onClick={() => inputRef.current?.click()}>Choose result or session file</button>
      <Link to="/app">Return to BRIGX</Link>
      {fileInput}
    </main>
  );
}

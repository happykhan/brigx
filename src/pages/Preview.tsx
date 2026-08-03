import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ResultViewer from '@/components/ResultViewer';
import { readFileText } from '@/lib/fileAccess';
import { loadResultPreview } from '@/lib/resultPreviewStore';
import { parseResultSnapshotJson, type ResultSnapshot } from '@/lib/resultSnapshot';

export default function PreviewPage() {
  const { id } = useParams();
  const [snapshot, setSnapshot] = useState<ResultSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setSnapshot(parseResultSnapshotJson(await readFileText(file)));
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
      accept=".json,.brigx-result.json,application/json"
      className="hidden"
      aria-label="BRIGX result file"
      onChange={handleFile}
    />
  );

  if (snapshot) {
    return (
      <>
        {fileInput}
        <ResultViewer snapshot={snapshot} mode={id ? 'preview' : 'file'} onOpenFile={() => inputRef.current?.click()} />
      </>
    );
  }

  if (id && !error) {
    return <main className="publication-page publication-message">Opening read-only result…</main>;
  }

  return (
    <main className="publication-page publication-message preview-file-picker">
      <span className="product-kicker">BRIGX result viewer</span>
      <h1>{error ?? 'Open a read-only BRIGX result'}</h1>
      <p>Choose a <code>.brigx-result.json</code> file. It is opened locally and is not uploaded.</p>
      <button type="button" className="gx-btn gx-btn-primary" onClick={() => inputRef.current?.click()}>Choose result file</button>
      <Link to="/app">Return to BRIGX</Link>
      {fileInput}
    </main>
  );
}

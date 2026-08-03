import { Link } from 'react-router-dom';
import CircularPlot from '@/components/CircularPlot';
import {
  resultSnapshotFilename,
  type ResultSnapshot,
} from '@/lib/resultSnapshot';

interface ResultViewerProps {
  snapshot: ResultSnapshot;
  mode: 'preview' | 'publication' | 'file' | 'remote';
  onOpenFile?: () => void;
  editUrl?: string;
}

function downloadSnapshot(snapshot: ResultSnapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = resultSnapshotFilename(snapshot);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ResultViewer({ snapshot, mode, onOpenFile, editUrl }: ResultViewerProps) {
  return (
    <main className="publication-page">
      <header className="publication-header">
        <div>
          <span className="product-kicker">
            {mode === 'publication' ? 'BRIGX publication' : 'BRIGX read-only result'}
          </span>
          <h1>{snapshot.title}</h1>
          {snapshot.description && <p>{snapshot.description}</p>}
          {mode === 'preview' && (
            <p className="publication-note">Local preview · available in this browser for 24 hours · this URL is not shareable</p>
          )}
          {mode === 'remote' && (
            <p className="publication-note">Loaded from a public GitHub session · read-only preview</p>
          )}
        </div>
        <div className="publication-actions">
          {mode !== 'publication' && (
            <button type="button" className="gx-btn" onClick={() => downloadSnapshot(snapshot)}>Download result</button>
          )}
          {onOpenFile && <button type="button" className="gx-btn" onClick={onOpenFile}>Open another result</button>}
          {editUrl
            ? <Link to={editUrl} className="gx-btn gx-btn-primary">Edit session</Link>
            : <Link to="/app" className="gx-btn gx-btn-primary">Open BRIGX</Link>}
        </div>
      </header>
      <section className="publication-viewer" aria-label="Read-only interactive genome comparison">
        <CircularPlot data={snapshot.plot} imageProperties={snapshot.imageConfig} />
      </section>
    </main>
  );
}

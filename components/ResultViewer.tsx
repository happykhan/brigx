import { Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import CircularPlot from '@/components/CircularPlot';
import StatisticsPanel from '@/components/StatisticsPanel';
import {
  resultSnapshotFilename,
  type ResultSnapshot,
} from '@/lib/resultSnapshot';

interface ResultViewerProps {
  snapshot: ResultSnapshot;
  mode: 'publication' | 'file' | 'remote';
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
      <Toaster position="bottom-right" />
      <header className="publication-header">
        <div>
          {mode === 'publication' && <span className="product-kicker">BRIGX publication</span>}
          <h1>{snapshot.title}</h1>
          {snapshot.description && <p>{snapshot.description}</p>}
          {mode === 'remote' && (
            <p className="publication-note">Loaded from a public GitHub session · read-only viewer</p>
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
      <section className="publication-statistics" aria-label="Comparison statistics">
        <StatisticsPanel plotData={snapshot.plot} />
      </section>
    </main>
  );
}

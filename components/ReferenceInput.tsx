import toast from 'react-hot-toast';
import { isDesktopApp, pickDesktopInputFiles } from '@/lib/desktopBridge';

interface ReferenceInputProps {
  referenceFile: File | null;
  onFileChange: (file: File) => void;
  referenceReady: boolean;
  referenceAnnotationFileName: string | null;
  referenceAnnotationCount: number;
  onReferenceAnnotationFileChange: (file: File) => void;
  onClearReferenceAnnotations: () => void;
}

export default function ReferenceInput({
  referenceFile,
  onFileChange,
  referenceReady,
  referenceAnnotationFileName,
  referenceAnnotationCount,
  onReferenceAnnotationFileChange,
  onClearReferenceAnnotations,
}: ReferenceInputProps) {
  const desktop = isDesktopApp();

  const pickDesktopReference = () => {
    void pickDesktopInputFiles('reference').then(files => {
      if (files[0]) onFileChange(files[0]);
    }).catch(error => {
      toast.error(`Failed to open reference file: ${error instanceof Error ? error.message : String(error)}`);
    });
  };

  return (
    <div className="card">
      <h2 className="section-title">Reference Genome</h2>
      <div>
        <label className="label">Reference Genome (FASTA / GenBank / GBFF)</label>
        {desktop ? (
          <button
            type="button"
            aria-label="Reference genome file"
            onClick={pickDesktopReference}
            className="btn-secondary w-full text-sm"
          >
            Choose reference file…
          </button>
        ) : (
          <input
            type="file"
            aria-label="Reference genome file"
            accept=".fasta,.fa,.fna,.gbk,.gb,.gbff,.genbank,.fasta.gz,.fa.gz,.fna.gz,.gbk.gz,.gb.gz,.gbff.gz,.genbank.gz,.gz"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onFileChange(e.target.files[0]);
              }
            }}
            className="input-field w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:cursor-pointer"
            style={{ fontSize: '0.8rem' }}
          />
        )}
        {referenceFile && (
          <div className="mt-2 flex items-center text-sm" style={{ color: 'var(--gx-accent)' }}>
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {referenceFile.name}
          </div>
        )}
        <p className="text-xs mt-2" style={{ color: 'var(--gx-text-muted)' }}>
          GenBank and GBFF CDS annotations are displayed automatically. Multi-FASTA references are joined with spacers.
        </p>
      </div>

      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--gx-border)' }}>
        <label className="label">Companion reference annotations (optional)</label>
        <input
          type="file"
          aria-label="Companion reference annotation file"
          accept=".gff3,.gff,.gbff,.gbk,.gb,.genbank"
          disabled={!referenceReady}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onReferenceAnnotationFileChange(file);
            event.target.value = '';
          }}
          className="input-field w-full text-sm disabled:opacity-50 disabled:cursor-not-allowed file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:cursor-pointer"
          style={{ fontSize: '0.8rem' }}
        />
        <p className="text-xs mt-2" style={{ color: 'var(--gx-text-muted)' }}>
          For a FASTA reference, add Bakta GFF3 or a separate GenBank/GBFF file here. Features are drawn on the reference track, not a query ring.
        </p>
        {referenceAnnotationFileName && (
          <div className="mt-2 flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--gx-accent)' }}>
            <span className="truncate" title={referenceAnnotationFileName}>
              {referenceAnnotationFileName} — {referenceAnnotationCount} CDS feature(s)
            </span>
            <button
              type="button"
              onClick={onClearReferenceAnnotations}
              className="shrink-0 hover:underline"
              style={{ color: 'var(--gx-error)' }}
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

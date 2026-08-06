

import { useRef } from 'react';

interface ReferenceInputProps {
  referenceFile: File | null;
  onFileChange: (file: File) => void;
}

export default function ReferenceInput({
  referenceFile,
  onFileChange,
}: ReferenceInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="card">
      <h2 className="section-title">Reference Genome</h2>
      <div>
        <label className="label">Reference Genome (FASTA / GenBank / GBFF)</label>
        <div className="reference-file-picker">
          <button
            type="button"
            className="btn-secondary reference-file-button"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" />
            </svg>
            {referenceFile ? 'Replace file' : 'Choose reference file'}
          </button>
          <div className={`reference-file-status ${referenceFile ? 'is-selected' : ''}`}>
            {referenceFile && (
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            <span title={referenceFile?.name}>{referenceFile?.name ?? 'No file selected'}</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Reference genome file"
            accept=".fasta,.fa,.fna,.gbk,.gb,.gbff,.genbank,.fasta.gz,.fa.gz,.fna.gz,.gbk.gz,.gb.gz,.gbff.gz,.genbank.gz,.gz"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onFileChange(e.target.files[0]);
              }
            }}
            className="sr-only"
          />
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--gx-text-muted)' }}>
          GenBank and GBFF CDS annotations are displayed automatically. Multi-FASTA references are joined with spacers.
        </p>
      </div>
    </div>
  );
}

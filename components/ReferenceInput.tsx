'use client';

interface ReferenceInputProps {
  referenceFile: File | null;
  onFileChange: (file: File) => void;
}

export default function ReferenceInput({ referenceFile, onFileChange }: ReferenceInputProps) {
  return (
    <div className="card">
      <h2 className="section-title">Reference Genome</h2>
      <div>
        <label className="label">Reference Genome (FASTA)</label>
        <input
          type="file"
          accept=".fasta,.fa,.fna,.gbk,.gb"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onFileChange(e.target.files[0]);
            }
          }}
          className="input-field w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:cursor-pointer"
          style={{ fontSize: '0.8rem' }}
        />
        {referenceFile && (
          <div className="mt-2 flex items-center text-sm" style={{ color: 'var(--gx-accent)' }}>
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {referenceFile.name}
          </div>
        )}
        <p className="text-xs mt-2" style={{ color: 'var(--gx-text-muted)' }}>
          Single sequence or multi-FASTA with spacers
        </p>
      </div>
    </div>
  );
}

'use client';

import type { Dispatch, SetStateAction } from 'react';

interface FileUploadProps {
  referenceFile: File | null;
  setReferenceFile: Dispatch<SetStateAction<File | null>>;
  queryFiles: File[];
  setQueryFiles: Dispatch<SetStateAction<File[]>>;
}

export default function FileUpload({
  referenceFile,
  setReferenceFile,
  queryFiles,
  setQueryFiles
}: FileUploadProps) {
  const handleReferenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReferenceFile(e.target.files[0]);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setQueryFiles(Array.from(e.target.files));
    }
  };

  const removeQueryFile = (index: number) => {
    setQueryFiles(queryFiles.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label">
          Reference Genome (FASTA or GenBank)
        </label>
        <input
          type="file"
          accept=".fasta,.fa,.fna,.gbk,.gb,.genbank,.fasta.gz,.fa.gz,.fna.gz,.gbk.gz,.gb.gz,.genbank.gz,.gz"
          onChange={handleReferenceChange}
          className="block w-full text-sm cursor-pointer input-field
            file:mr-4 file:py-2 file:px-4
            file:rounded file:border-0
            file:text-sm file:font-semibold
            file:cursor-pointer"
        />
        {referenceFile && (
          <div className="mt-2 text-sm flex items-center" style={{ color: 'var(--gx-accent)' }}>
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {referenceFile.name}
          </div>
        )}
      </div>

      <div>
        <label className="label">
          Query Genomes (FASTA or GenBank)
        </label>
        <input
          type="file"
          accept=".fasta,.fa,.fna,.gbk,.gb,.genbank,.fasta.gz,.fa.gz,.fna.gz,.gbk.gz,.gb.gz,.genbank.gz,.gz"
          multiple
          onChange={handleQueryChange}
          className="block w-full text-sm cursor-pointer input-field
            file:mr-4 file:py-2 file:px-4
            file:rounded file:border-0
            file:text-sm file:font-semibold
            file:cursor-pointer"
        />
        {queryFiles.length > 0 && (
          <div className="mt-2 space-y-1">
            {queryFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between text-sm p-2 rounded-lg" style={{ background: 'var(--gx-bg-elevated)', border: '1px solid var(--gx-border)' }}>
                <span className="truncate" style={{ color: 'var(--gx-text)' }}>{file.name}</span>
                <button
                  onClick={() => removeQueryFile(index)}
                  className="ml-2 p-1 rounded transition-colors"
                  style={{ color: 'var(--gx-error)' }}
                  aria-label="Remove file"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

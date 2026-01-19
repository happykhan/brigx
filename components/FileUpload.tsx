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
          className="block w-full text-sm text-gray-500 dark:text-gray-400
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            dark:file:bg-blue-900/30 dark:file:text-blue-400
            hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50
            cursor-pointer transition-all"
        />
        {referenceFile && (
          <div className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center">
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
          className="block w-full text-sm text-gray-500 dark:text-gray-400
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-semibold
            file:bg-green-50 file:text-green-700
            dark:file:bg-green-900/30 dark:file:text-green-400
            hover:file:bg-green-100 dark:hover:file:bg-green-900/50
            cursor-pointer transition-all"
        />
        {queryFiles.length > 0 && (
          <div className="mt-2 space-y-1">
            {queryFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border border-gray-200 dark:border-gray-600">
                <span className="text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                <button
                  onClick={() => removeQueryFile(index)}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 ml-2 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
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

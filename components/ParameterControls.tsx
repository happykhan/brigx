'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { PipelineParams } from '@/lib/types';

interface ParameterControlsProps {
  params: PipelineParams;
  setParams: Dispatch<SetStateAction<PipelineParams>>;
  disabled?: boolean;
}

export default function ParameterControls({
  params,
  setParams,
  disabled = false
}: ParameterControlsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="label">
          Minimum Identity (%)
        </label>
        <input
          type="number"
          value={params.minIdentity}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setParams({ ...params, minIdentity: isNaN(val) ? 0 : val });
          }}
          disabled={disabled}
          min="50"
          max="100"
          className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs" style={{ color: 'var(--gx-text-muted)' }}>
          Filter alignments below this identity (50-100)
        </p>
      </div>

      <div>
        <label className="label">
          Minimum Alignment Length (bp)
        </label>
        <input
          type="number"
          value={params.minAlignmentLength}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setParams({ ...params, minAlignmentLength: isNaN(val) ? 50 : val });
          }}
          disabled={disabled}
          min="50"
          max="5000"
          step="50"
          className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs" style={{ color: 'var(--gx-text-muted)' }}>
          Filter short alignments (50-5000)
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={params.forceAlignment}
            onChange={(e) => setParams({ ...params, forceAlignment: e.target.checked })}
            disabled={disabled}
            className="w-4 h-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ accentColor: 'var(--gx-accent)' }}
          />
          <span className="label mb-0">Force Re-alignment</span>
        </label>
        <p className="mt-1 text-xs" style={{ color: 'var(--gx-text-muted)' }}>
          Re-run alignment even if cached results exist
        </p>
      </div>

      <div>
        <label className="label">
          BLAST Options
        </label>
        <input
          type="text"
          value={params.alignerOptions || ''}
          onChange={(e) => setParams({ ...params, alignerOptions: e.target.value })}
          disabled={disabled}
          placeholder="e.g., -W 11 -e 1e-3"
          className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
        />
        <p className="mt-1 text-xs" style={{ color: 'var(--gx-text-muted)' }}>
          Custom blastall parameters (default: megablast -e 1e-5)
        </p>
      </div>

      <div>
        <label className="label">
          Spacer Size (bp)
        </label>
        <input
          type="number"
          value={params.spacerSize || 0}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setParams({ ...params, spacerSize: isNaN(val) ? 0 : val });
          }}
          disabled={disabled}
          min="0"
          max="100000"
          step="100"
          className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs" style={{ color: 'var(--gx-text-muted)' }}>
          Spacer between contigs in multi-FASTA reference (default: 0)
        </p>
      </div>
    </div>
  );
}

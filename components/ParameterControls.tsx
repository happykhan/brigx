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
          Window Size (bp)
        </label>
        <input
          type="number"
          value={params.windowSize}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setParams({ ...params, windowSize: isNaN(val) ? 100 : val });
          }}
          disabled={disabled}
          min="100"
          max="10000"
          step="100"
          className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Resolution of the circular plot (100-10000)
        </p>
      </div>

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
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="label mb-0">Force Re-alignment</span>
        </label>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Re-run alignment even if cached results exist
        </p>
      </div>

      <div>
        <label className="label">
          LASTZ Options
        </label>
        <input
          type="text"
          value={params.lastzOptions || ''}
          onChange={(e) => setParams({ ...params, lastzOptions: e.target.value })}
          disabled={disabled}
          placeholder="e.g., --step=20 --seed=match12"
          className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Custom LASTZ parameters (default: --ambiguous=iupac --gapped --chain)
        </p>
      </div>
    </div>
  );
}

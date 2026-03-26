'use client';

import type { Dispatch, SetStateAction } from 'react';
import ParameterControls from '@/components/ParameterControls';
import type { PipelineParams, CircularPlotData, RingConfig } from '@/lib/types';

interface ControlPanelProps {
  params: PipelineParams;
  setParams: Dispatch<SetStateAction<PipelineParams>>;
  isProcessing: boolean;
  referenceFile: File | null;
  rings: RingConfig[];
  plotData: CircularPlotData | null;
  onRun: () => void;
}

export default function ControlPanel({
  params,
  setParams,
  isProcessing,
  referenceFile,
  rings,
  plotData,
  onRun,
}: ControlPanelProps) {
  return (
    <>
      <div className="card">
        <h2 className="section-title">Parameters</h2>
        <ParameterControls
          params={params}
          setParams={setParams}
          disabled={isProcessing}
          isMultiFasta={!!(plotData?.reference?.contigs && plotData.reference.contigs.length > 1)}
        />
      </div>

      <button
        onClick={onRun}
        disabled={isProcessing || !referenceFile || rings.filter(r => r.files.length > 0).length === 0}
        className="w-full btn-primary py-3 px-6 text-lg font-semibold"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Running Alignments...
          </span>
        ) : (
          'Run Alignments'
        )}
      </button>
    </>
  );
}

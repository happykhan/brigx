

import { useState } from 'react';
import toast from 'react-hot-toast';
import type { CircularPlotData } from '@/lib/types';
import { saveBlob } from '@/lib/download';

/** Inline info icon that shows a tooltip on hover/click. */
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block ml-1 align-middle">
      <button
        type="button"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none cursor-help"
        style={{ background: 'var(--gx-border)', color: 'var(--gx-text-muted)' }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
        aria-label="More information"
      >
        ?
      </button>
      {open && (
        <span
          className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 rounded text-xs leading-relaxed shadow-lg"
          style={{ background: 'var(--gx-surface)', color: 'var(--gx-text)', border: '1px solid var(--gx-border)' }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

interface StatisticsPanelProps {
  plotData: CircularPlotData;
}

export default function StatisticsPanel({ plotData }: StatisticsPanelProps) {
  return (
    <div className="mt-6 card animate-fade-in">
      <h2 className="section-title">Statistics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--gx-accent) 10%, transparent)', border: '1px solid var(--gx-border)' }}>
          <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--gx-text-muted)' }}>Reference</div>
          <div className="text-base font-semibold truncate mt-1" style={{ color: 'var(--gx-text)' }}>{plotData.reference.name}</div>
          <div className="text-sm" style={{ color: 'var(--gx-text-muted)' }}>{(plotData.reference.length / 1000).toFixed(1)} kb</div>
        </div>
        <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--gx-accent) 10%, transparent)', border: '1px solid var(--gx-border)' }}>
          <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--gx-text-muted)' }}>Query Genomes</div>
          <div className="text-2xl font-bold mt-1" style={{ color: 'var(--gx-text)' }}>{plotData.rings?.length || 0}</div>
        </div>
        <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--gx-indigo) 10%, transparent)', border: '1px solid var(--gx-border)' }}>
          <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--gx-text-muted)' }}>Min Identity</div>
          <div className="text-2xl font-bold mt-1" style={{ color: 'var(--gx-text)' }}>{plotData.config?.minIdentity || 0}%</div>
        </div>
      </div>

      {plotData.rings && plotData.rings.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-3" style={{ color: 'var(--gx-text)' }}>Query Genome Coverage</h3>
          <div className="space-y-2">
            {plotData.rings.map((ring) => (
              <div key={ring.queryId} className="flex items-center justify-between p-3 rounded-lg transition-colors" style={{ background: 'var(--gx-surface)', border: '1px solid var(--gx-border)' }}>
                <div className="flex-1">
                  <div className="font-medium" style={{ color: 'var(--gx-text)' }}>{ring.queryName}</div>
                  <div className="text-sm" style={{ color: 'var(--gx-text-muted)' }}>
                    Coverage: {ring.statistics.genomeCoverage.toFixed(1)}% |
                    Avg Identity: {ring.statistics.meanIdentity.toFixed(1)}%
                    <InfoTip text="Alignment-length-weighted mean of BLAST percent identity across all hits that pass the minimum identity and length filters. Each hit's identity is weighted by the number of reference bases it covers." />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {ring.alignmentOutput && (
                    <button
                      onClick={() => {
                        void (async () => {
                          try {
                            const header = '#query\tsubject\t%identity\talignment_length\tmismatches\tgap_opens\tq.start\tq.end\ts.start\ts.end\tevalue\tbit_score\n';
                            const blob = new Blob([header + ring.alignmentOutput!], { type: 'text/plain' });
                            if (await saveBlob(blob, `${ring.queryName}_alignment.txt`)) {
                              toast.success(`Saved alignment results for ${ring.queryName}`);
                            }
                          } catch (error) {
                            toast.error(`Could not save alignment results: ${error instanceof Error ? error.message : String(error)}`);
                          }
                        })();
                      }}
                      className="btn-secondary text-xs px-2 py-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                  )}
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: ring.color, boxShadow: '0 0 0 2px var(--gx-border)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

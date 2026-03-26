'use client';

import toast from 'react-hot-toast';
import type { CircularPlotData } from '@/lib/types';

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
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {ring.alignmentOutput && (
                    <button
                      onClick={() => {
                        const header = '#query\tsubject\t%identity\talignment_length\tmismatches\tgap_opens\tq.start\tq.end\ts.start\ts.end\tevalue\tbit_score\n';
                        const blob = new Blob([header + ring.alignmentOutput!], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${ring.queryName}_alignment.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success(`Downloaded alignment results for ${ring.queryName}`);
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

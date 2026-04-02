

import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PipelineParams } from '@/lib/types';

interface ParameterControlsProps {
  params: PipelineParams;
  setParams: Dispatch<SetStateAction<PipelineParams>>;
  disabled?: boolean;
  isMultiFasta?: boolean;
}

export default function ParameterControls({
  params,
  setParams,
  disabled = false,
  isMultiFasta = false
}: ParameterControlsProps) {
  const [showProgramHelp, setShowProgramHelp] = useState(false);
  const [showOptionsHelp, setShowOptionsHelp] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer" title="Show GC content (G+C percentage) as a ring. High GC shown in green, low GC in red.">
          <input
            type="checkbox"
            checked={params.showGCContent !== false}
            onChange={(e) => setParams({ ...params, showGCContent: e.target.checked })}
            disabled={disabled}
            className="w-4 h-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ accentColor: 'var(--gx-accent)' }}
          />
          <span className="text-sm" style={{ color: 'var(--gx-text)' }}>GC Content</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer" title="Show GC skew ((G-C)/(G+C)) as a ring. Indicates leading/lagging strand and origin of replication.">
          <input
            type="checkbox"
            checked={params.showGCSkew !== false}
            onChange={(e) => setParams({ ...params, showGCSkew: e.target.checked })}
            disabled={disabled}
            className="w-4 h-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ accentColor: 'var(--gx-accent)' }}
          />
          <span className="text-sm" style={{ color: 'var(--gx-text)' }}>GC Skew</span>
        </label>
      </div>

      <div>
        <label className="label">Minimum Identity (%)</label>
        <input
          type="number"
          value={params.minIdentity}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setParams({ ...params, minIdentity: isNaN(val) ? 0 : val });
          }}
          disabled={disabled}
          min="50" max="100"
          className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs" style={{ color: 'var(--gx-text-muted)' }}>Filter alignments below this identity (50-100)</p>
      </div>

      <div>
        <label className="label">Minimum Alignment Length (bp)</label>
        <input
          type="number"
          value={params.minAlignmentLength}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setParams({ ...params, minAlignmentLength: isNaN(val) ? 50 : val });
          }}
          disabled={disabled}
          min="50" max="5000" step="50"
          className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs" style={{ color: 'var(--gx-text-muted)' }}>Filter short alignments (50-5000)</p>
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
        <p className="mt-1 text-xs" style={{ color: 'var(--gx-text-muted)' }}>Re-run alignment even if cached results exist</p>
      </div>

      <div>
        <div className="flex items-center gap-1">
          <label className="label">BLAST Program</label>
          <button
            type="button"
            onClick={() => setShowProgramHelp(true)}
            className="text-xs rounded-full w-4 h-4 flex items-center justify-center"
            style={{ color: 'var(--gx-text-muted)', border: '1px solid var(--gx-border)' }}
            title="Help"
          >?</button>
        </div>
        <select
          value={params.blastProgram || 'blastn'}
          onChange={(e) => setParams({ ...params, blastProgram: e.target.value as 'blastn' | 'blastx' })}
          disabled={disabled}
          className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="blastn">blastn (nucleotide vs nucleotide)</option>
          <option value="blastx">blastx (translated nucleotide vs protein)</option>
        </select>
      </div>

      <div>
        <div className="flex items-center gap-1">
          <label className="label">BLAST Options</label>
          <button
            type="button"
            onClick={() => setShowOptionsHelp(true)}
            className="text-xs rounded-full w-4 h-4 flex items-center justify-center"
            style={{ color: 'var(--gx-text-muted)', border: '1px solid var(--gx-border)' }}
            title="Help"
          >?</button>
        </div>
        <input
          type="text"
          value={params.alignerOptions || ''}
          onChange={(e) => setParams({ ...params, alignerOptions: e.target.value })}
          disabled={disabled}
          placeholder="e.g., -W 11 -e 1e-3"
          className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
        />
        <p className="mt-1 text-xs" style={{ color: 'var(--gx-text-muted)' }}>Default: megablast -e 1e-5</p>
      </div>

      {isMultiFasta && (
        <div>
          <label className="label">Spacer Size (bp)</label>
          <input
            type="number"
            value={params.spacerSize || 0}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setParams({ ...params, spacerSize: isNaN(val) ? 0 : val });
            }}
            disabled={disabled}
            min="0" max="100000" step="100"
            className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-xs" style={{ color: 'var(--gx-text-muted)' }}>Spacer between contigs in multi-FASTA reference</p>
        </div>
      )}

      {/* BLAST Program Help Modal */}
      {showProgramHelp && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0, 0, 0, 0.6)' }} onClick={() => setShowProgramHelp(false)}>
          <div className="rounded-lg max-w-md w-full p-6" style={{ background: 'var(--gx-bg-alt)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold" style={{ color: 'var(--gx-text)' }}>BLAST Programs</h3>
              <button onClick={() => setShowProgramHelp(false)} style={{ color: 'var(--gx-text-muted)' }}>&times;</button>
            </div>
            <div className="space-y-3 text-sm" style={{ color: 'var(--gx-text)' }}>
              <div className="p-3 rounded" style={{ background: 'var(--gx-surface)' }}>
                <strong>blastn</strong>
                <p className="mt-1" style={{ color: 'var(--gx-text-muted)' }}>Nucleotide vs nucleotide. Default for whole genome comparisons. Uses megablast algorithm for speed.</p>
              </div>
              <div className="p-3 rounded" style={{ background: 'var(--gx-surface)' }}>
                <strong>blastx</strong>
                <p className="mt-1" style={{ color: 'var(--gx-text-muted)' }}>Translated nucleotide vs protein database. Use when the reference contains protein sequences and queries are nucleotide. Better for detecting divergent homologs.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BLAST Options Help Modal */}
      {showOptionsHelp && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0, 0, 0, 0.6)' }} onClick={() => setShowOptionsHelp(false)}>
          <div className="rounded-lg max-w-md w-full p-6" style={{ background: 'var(--gx-bg-alt)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold" style={{ color: 'var(--gx-text)' }}>BLAST Options (Legacy 2.2.26)</h3>
              <button onClick={() => setShowOptionsHelp(false)} style={{ color: 'var(--gx-text-muted)' }}>&times;</button>
            </div>
            <div className="space-y-2 text-sm" style={{ color: 'var(--gx-text)' }}>
              {[
                { flag: 'e', desc: 'E-value threshold. Default: 10. Use 1e-5 for stringent filtering.' },
                { flag: 'F', desc: 'Low-complexity filter. T = on (default), F = off. Turning off may fill alignment gaps.' },
                { flag: 'W', desc: 'Word size. blastn default: 11, megablast: 28. Smaller = more sensitive but slower.' },
                { flag: 'n', desc: 'MegaBLAST mode. T = on, F = off. BRIGX uses megablast by default.' },
              ].map(opt => (
                <div key={opt.flag} className="flex gap-3 p-2 rounded" style={{ background: 'var(--gx-surface)' }}>
                  <code className="font-bold whitespace-nowrap" style={{ color: 'var(--gx-accent)' }}>{opt.flag}</code>
                  <span style={{ color: 'var(--gx-text-muted)' }}>{opt.desc}</span>
                </div>
              ))}
              <div className="mt-3 p-2 rounded text-xs" style={{ background: 'var(--gx-surface)', color: 'var(--gx-text-muted)' }}>
                <strong>Do not use:</strong> o, d, p, i, m flags (managed by BRIGX automatically)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



import { useState } from 'react';
import type { RingConfig, RingData } from '@/lib/types';

/** Small controlled hex input that syncs with external colour state on blur / valid input. */
function HexInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);

  // Sync from parent when not focused (e.g. colour picker changes)
  const displayed = focused ? local : value;

  return (
    <input
      type="text"
      value={displayed}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        if (/^#[0-9a-fA-F]{6}$/.test(v)) {
          onChange(v.toLowerCase());
        }
      }}
      onFocus={() => { setLocal(value); setFocused(true); }}
      onBlur={(e) => {
        setFocused(false);
        let v = e.target.value.trim();
        if (!v.startsWith('#')) v = '#' + v;
        if (/^#[0-9a-fA-F]{6}$/.test(v)) {
          onChange(v.toLowerCase());
        }
        // Reset local to current canonical value
        setLocal(value);
      }}
      className="input-field text-xs font-mono w-20 flex-shrink-0"
      placeholder="#000000"
      maxLength={7}
      title="Hex colour code"
    />
  );
}

interface RingConfigurationProps {
  rings: RingConfig[];
  setRings: (rings: RingConfig[]) => void;
  onEditAnnotations?: (ringId: string) => void;
  ringDataList?: RingData[]; // Computed ring data (for graph stats display)
}

const PRESET_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
];

export default function RingConfiguration({ rings, setRings, onEditAnnotations, ringDataList }: RingConfigurationProps) {

  const addNewRing = () => {
    console.log('[RingConfiguration] Add New Ring clicked, current rings:', rings.length);
    const newRing: RingConfig = {
      id: `ring_${Date.now()}`,
      legendText: `Ring ${rings.length + 1}`,
      files: [],
      color: PRESET_COLORS[rings.length % PRESET_COLORS.length],
      upperThreshold: 90,
      lowerThreshold: 70
    };
    console.log('[RingConfiguration] Creating new ring:', newRing);
    setRings([...rings, newRing]);
    console.log('[RingConfiguration] setRings called');
  };

  const removeRing = (id: string) => {
    setRings(rings.filter(r => r.id !== id));
  };

  const updateRing = (id: string, updates: Partial<RingConfig>) => {
    setRings(rings.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const addFilesToRing = (id: string, files: FileList | null) => {
    if (!files) return;
    const ring = rings.find(r => r.id === id);
    if (!ring) return;

    const newFiles = Array.from(files);
    updateRing(id, { files: [...ring.files, ...newFiles] });
  };

  const removeFileFromRing = (ringId: string, fileIndex: number) => {
    const ring = rings.find(r => r.id === ringId);
    if (!ring) return;

    updateRing(ringId, { files: ring.files.filter((_, i) => i !== fileIndex) });
  };

  const moveRing = (index: number, direction: 'up' | 'down') => {
    const newRings = [...rings];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rings.length) return;

    [newRings[index], newRings[targetIndex]] = [newRings[targetIndex], newRings[index]];
    setRings(newRings);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--gx-text)' }}>Ring Configuration</h3>
        <button
          type="button"
          onClick={addNewRing}
          className="btn-secondary text-xs px-3 py-1"
        >
          + Add New Ring
        </button>
      </div>

      {rings.length === 0 && (
        <div className="text-center py-8 rounded-lg" style={{ color: 'var(--gx-text-muted)', border: '2px dashed var(--gx-border)' }}>
          <p className="mb-2">No rings configured</p>
          <p className="text-sm">Click &quot;Add New Ring&quot; to start</p>
        </div>
      )}

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {rings.map((ring, index) => (
          <div
            key={ring.id}
            className="rounded-lg p-4"
            style={{ border: '1px solid var(--gx-border)', background: 'var(--gx-surface)' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => moveRing(index, 'up')}
                    disabled={index === 0}
                    className="disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ color: 'var(--gx-text-muted)' }}
                  >
                    &#9650;
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRing(index, 'down')}
                    disabled={index === rings.length - 1}
                    className="disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ color: 'var(--gx-text-muted)' }}
                  >
                    &#9660;
                  </button>
                </div>
                <input
                  type="text"
                  value={ring.legendText}
                  onChange={(e) => updateRing(ring.id, { legendText: e.target.value })}
                  className="input-field text-sm font-medium flex-1"
                  placeholder="Ring name"
                />
                <input
                  type="color"
                  value={ring.color}
                  onChange={(e) => updateRing(ring.id, { color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0 flex-shrink-0"
                  style={{ border: '2px solid var(--gx-border)' }}
                  title="Ring colour"
                />
                <HexInput
                  value={ring.color}
                  onChange={(hex) => updateRing(ring.id, { color: hex })}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRing(ring.id)}
                className="ml-2"
                style={{ color: 'var(--gx-error)' }}
                title="Remove ring"
              >
                &#10005;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--gx-text-muted)' }}>Upper Threshold (%)</label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={ring.upperThreshold}
                  onChange={(e) => updateRing(ring.id, { upperThreshold: Number(e.target.value) })}
                  className="input-field text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--gx-text-muted)' }}>Lower Threshold (%)</label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={ring.lowerThreshold}
                  onChange={(e) => updateRing(ring.id, { lowerThreshold: Number(e.target.value) })}
                  className="input-field text-sm w-full"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-xs mb-1" style={{ color: 'var(--gx-text-muted)' }}>
                Custom Ring Width (px)
                <span className="ml-1" style={{ color: 'var(--gx-text-muted)', opacity: 0.7 }}>(leave empty for default)</span>
              </label>
              <input
                type="number"
                min="10"
                max="200"
                placeholder="Use default"
                value={ring.customWidth || ''}
                onChange={(e) => updateRing(ring.id, { customWidth: e.target.value ? Number(e.target.value) : undefined })}
                className="input-field text-sm w-full"
              />
            </div>

            {ring.files.some(f => {
              const n = f.name.toLowerCase();
              return n.endsWith('.graph') || n.endsWith('.bedgraph') || n.endsWith('.wig') || n.endsWith('.bed') || n.endsWith('.sam');
            }) && (
              <div className="mb-3">
                <label className="block text-xs mb-1" style={{ color: 'var(--gx-text-muted)' }}>
                  Graph Max Value
                  <span className="ml-1" style={{ opacity: 0.7 }}>(values above shown in blue)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Auto (use data max)"
                  value={ring.graphMaxCap || ''}
                  onChange={(e) => updateRing(ring.id, { graphMaxCap: e.target.value ? Number(e.target.value) : undefined })}
                  className="input-field text-sm w-full"
                />
                {(() => {
                  const rd = ringDataList?.find(r => r.queryId === ring.id);
                  if (rd?.graphStats) {
                    const s = rd.graphStats;
                    return (
                      <div className="flex gap-3 mt-1 text-xs" style={{ color: 'var(--gx-text-muted)' }}>
                        <span>Mean: <strong>{s.mean}</strong></span>
                        <span>Q3: <strong>{s.q3}</strong></span>
                        <span>Max: <strong>{s.max}</strong></span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium" style={{ color: 'var(--gx-text-muted)' }}>
                  Files ({ring.files.length})
                </label>
                <div className="flex gap-2 items-center">
                  {onEditAnnotations && (
                    <button
                      type="button"
                      onClick={() => onEditAnnotations(ring.id)}
                      className="text-xs hover:underline"
                      style={{ color: 'var(--gx-indigo)' }}
                      title="Add custom region highlights or import gene features (GenBank/GFF3) to overlay on this ring"
                    >
                      Custom Annotations
                    </button>
                  )}
                  <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: 'var(--gx-text-muted)' }} title="Show annotation labels on the ring">
                    <input
                      type="checkbox"
                      checked={ring.showLabels !== false}
                      onChange={(e) => updateRing(ring.id, { showLabels: e.target.checked })}
                      className="w-3 h-3"
                      style={{ accentColor: 'var(--gx-accent)' }}
                    />
                    Labels
                  </label>
                  <label className="text-xs cursor-pointer hover:underline" style={{ color: 'var(--gx-accent)' }}>
                    + Add Files
                    <input
                      type="file"
                      multiple
                      accept=".fasta,.fa,.fna,.gbk,.gb,.gbff,.genbank,.fasta.gz,.fa.gz,.fna.gz,.gbk.gz,.gb.gz,.gbff.gz,.genbank.gz,.gz,.graph,.bedgraph,.wig,.bed,.sam"
                      onChange={(e) => addFilesToRing(ring.id, e.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {ring.files.length > 0 && (
                <div className="space-y-1">
                  {ring.files.map((file, fileIndex) => (
                    <div
                      key={fileIndex}
                      className="flex items-center justify-between text-xs px-2 py-1 rounded"
                      style={{ background: 'var(--gx-bg-alt)', border: '1px solid var(--gx-border)' }}
                    >
                      <span className="truncate flex-1" title={file.name} style={{ color: 'var(--gx-text)' }}>{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFileFromRing(ring.id, fileIndex)}
                        className="ml-2"
                        style={{ color: 'var(--gx-error)' }}
                      >
                        &#10005;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

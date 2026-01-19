'use client';

import { useState, useRef, useEffect } from 'react';
import type { RingConfig } from '@/lib/types';

interface RingConfigurationProps {
  rings: RingConfig[];
  setRings: (rings: RingConfig[]) => void;
  onEditAnnotations?: (ringId: string) => void;
}

const PRESET_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
];

export default function RingConfiguration({ rings, setRings, onEditAnnotations }: RingConfigurationProps) {
  const [editingRing, setEditingRing] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setColorPickerOpen(null);
      }
    };

    if (colorPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [colorPickerOpen]);

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
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ring Configuration</h3>
        <button
          type="button"
          onClick={addNewRing}
          className="text-sm btn-secondary px-3 py-1"
        >
          + Add New Ring
        </button>
      </div>

      {rings.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <p className="mb-2">No rings configured</p>
          <p className="text-sm">Click "Add New Ring" to start</p>
        </div>
      )}

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {rings.map((ring, index) => (
          <div
            key={ring.id}
            className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => moveRing(index, 'up')}
                    disabled={index === 0}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRing(index, 'down')}
                    disabled={index === rings.length - 1}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ▼
                  </button>
                </div>
                <input
                  type="text"
                  value={ring.legendText}
                  onChange={(e) => updateRing(ring.id, { legendText: e.target.value })}
                  className="input-field text-sm font-medium flex-1"
                  placeholder="Ring name"
                />
                <div className="relative" ref={colorPickerOpen === ring.id ? colorPickerRef : null}>
                  <button
                    type="button"
                    onClick={() => setColorPickerOpen(colorPickerOpen === ring.id ? null : ring.id)}
                    className="w-10 h-8 rounded border-2 border-gray-300 dark:border-gray-500 cursor-pointer"
                    style={{ backgroundColor: ring.color }}
                    title="Ring color"
                  />
                  {colorPickerOpen === ring.id && (
                    <div className="absolute top-10 right-0 z-10 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
                      <input
                        type="color"
                        value={ring.color}
                        onChange={(e) => updateRing(ring.id, { color: e.target.value })}
                        className="w-32 h-32 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeRing(ring.id)}
                className="text-red-500 hover:text-red-700 dark:hover:text-red-400 ml-2"
                title="Remove ring"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Upper Threshold (%)</label>
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
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Lower Threshold (%)</label>
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
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Custom Ring Width (px) 
                <span className="text-gray-500 ml-1">(leave empty for default)</span>
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Files ({ring.files.length})
                </label>
                <div className="flex gap-2">
                  {onEditAnnotations && (
                    <button
                      type="button"
                      onClick={() => onEditAnnotations(ring.id)}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      📝 Annotations
                    </button>
                  )}
                  <label className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    + Add Files
                    <input
                      type="file"
                      multiple
                      accept=".fasta,.fa,.fna,.gbk,.gb,.genbank,.fasta.gz,.fa.gz,.fna.gz,.gbk.gz,.gb.gz,.genbank.gz,.gz"
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
                      className="flex items-center justify-between text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600"
                    >
                      <span className="truncate flex-1" title={file.name}>{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFileFromRing(ring.id, fileIndex)}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        ✕
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

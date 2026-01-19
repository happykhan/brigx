'use client';

import { useState } from 'react';
import type { Annotation } from '@/lib/types';
import { parseAnnotationFile, exportAnnotationsToTSV } from '@/lib/annotationParser';
import toast from 'react-hot-toast';

interface AnnotationEditorProps {
  ringId: string;
  ringName: string;
  annotations: Annotation[];
  referenceLength: number;
  onAnnotationsChange: (ringId: string, annotations: Annotation[]) => void;
  onClose: () => void;
}

export default function AnnotationEditor({
  ringId,
  ringName,
  annotations,
  referenceLength,
  onAnnotationsChange,
  onClose
}: AnnotationEditorProps) {
  const [localAnnotations, setLocalAnnotations] = useState<Annotation[]>([...annotations]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const result = parseAnnotationFile(content, referenceLength);
      
      if (result.errors.length > 0) {
        toast.error(`Parsed with ${result.errors.length} warning(s)`);
        console.warn('Annotation parsing warnings:', result.errors);
      }
      
      if (result.annotations.length === 0) {
        toast.error('No valid annotations found in file');
        return;
      }
      
      setLocalAnnotations([...localAnnotations, ...result.annotations]);
      toast.success(`Loaded ${result.annotations.length} annotation(s)`);
    } catch (error) {
      toast.error('Failed to parse annotation file');
      console.error('Parse error:', error);
    }
    
    // Reset input
    e.target.value = '';
  };

  const handleAddNew = () => {
    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      start: 1,
      end: Math.min(1000, referenceLength),
      label: `Annotation ${localAnnotations.length + 1}`,
      shape: 'block',
      color: '#666666'
    };
    setLocalAnnotations([...localAnnotations, newAnnotation]);
    setEditingId(newAnnotation.id);
  };

  const handleDelete = () => {
    if (selectedIds.size === 0) {
      toast.error('No annotations selected');
      return;
    }
    setLocalAnnotations(localAnnotations.filter(ann => !selectedIds.has(ann.id)));
    setSelectedIds(new Set());
    toast.success(`Deleted ${selectedIds.size} annotation(s)`);
  };

  const handleFieldChange = (id: string, field: keyof Annotation, value: any) => {
    setLocalAnnotations(localAnnotations.map(ann => {
      if (ann.id === id) {
        let updatedValue = value;
        
        // Clamp numeric values
        if (field === 'start' || field === 'end') {
          const num = parseInt(value, 10);
          if (!isNaN(num)) {
            updatedValue = Math.max(1, Math.min(num, referenceLength));
          }
        }
        
        return { ...ann, [field]: updatedValue };
      }
      return ann;
    }));
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === localAnnotations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(localAnnotations.map(ann => ann.id)));
    }
  };

  const handleSave = () => {
    onAnnotationsChange(ringId, localAnnotations);
    toast.success('Annotations updated');
    onClose();
  };

  const handleExport = () => {
    const tsv = exportAnnotationsToTSV(localAnnotations);
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ringName.replace(/\s+/g, '_')}_annotations.tsv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported annotations');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Annotations for {ringName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex gap-2 flex-wrap">
          <label className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer">
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            Load File
          </label>
          <button
            onClick={handleAddNew}
            className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Add New
          </button>
          <button
            onClick={handleDelete}
            disabled={selectedIds.size === 0}
            className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Selected ({selectedIds.size})
          </button>
          <button
            onClick={handleExport}
            disabled={localAnnotations.length === 0}
            className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            Export TSV
          </button>
          <div className="ml-auto text-sm text-gray-600 dark:text-gray-400 self-center">
            {referenceLength > 0 
              ? `Reference: ${referenceLength.toLocaleString()} bp`
              : 'Reference: Not loaded (generate plot first)'}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-4">
          {localAnnotations.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No annotations. Click "Load File" to import or "Add New" to create one.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="p-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === localAnnotations.length && localAnnotations.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="p-2 text-left text-gray-700 dark:text-gray-300">Start</th>
                  <th className="p-2 text-left text-gray-700 dark:text-gray-300">End</th>
                  <th className="p-2 text-left text-gray-700 dark:text-gray-300">Label</th>
                  <th className="p-2 text-left text-gray-700 dark:text-gray-300">Shape</th>
                  <th className="p-2 text-left text-gray-700 dark:text-gray-300">Color</th>
                </tr>
              </thead>
              <tbody>
                {localAnnotations.map((ann, idx) => (
                  <tr
                    key={ann.id}
                    className={`border-b border-gray-200 dark:border-gray-700 ${
                      selectedIds.has(ann.id) ? 'bg-blue-50 dark:bg-blue-900' : ''
                    }`}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(ann.id)}
                        onChange={() => handleToggleSelect(ann.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={ann.start}
                        onChange={(e) => handleFieldChange(ann.id, 'start', e.target.value)}
                        className="w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                        min={1}
                        max={referenceLength}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={ann.end}
                        onChange={(e) => handleFieldChange(ann.id, 'end', e.target.value)}
                        className="w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                        min={1}
                        max={referenceLength}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={ann.label}
                        onChange={(e) => handleFieldChange(ann.id, 'label', e.target.value)}
                        className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={ann.shape}
                        onChange={(e) => handleFieldChange(ann.id, 'shape', e.target.value)}
                        className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                      >
                        <option value="block">Block</option>
                        <option value="arrow-forward">Arrow →</option>
                        <option value="arrow-reverse">Arrow ←</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="color"
                        value={ann.color || '#666666'}
                        onChange={(e) => handleFieldChange(ann.id, 'color', e.target.value)}
                        className="w-12 h-8 border rounded cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}

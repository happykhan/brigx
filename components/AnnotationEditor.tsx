'use client';

import { useState, useRef, useCallback } from 'react';
import { HotTable } from '@handsontable/react';
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import type { Annotation } from '@/lib/types';
import { parseAnnotationFile, exportAnnotationsToTSV } from '@/lib/annotationParser';
import toast from 'react-hot-toast';

// Register all Handsontable modules (including cell types)
registerAllModules();

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
  const hotRef = useRef<Handsontable | null>(null);

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
    toast.success('Added new annotation');
  };

  const handleDeleteSelected = () => {
    const hot = hotRef.current;
    if (!hot) return;

    const selected = hot.getSelected();
    if (!selected || selected.length === 0) {
      toast.error('No rows selected');
      return;
    }

    // Get all selected row indices
    const rowsToDelete = new Set<number>();
    selected.forEach(([startRow, , endRow]) => {
      for (let i = startRow; i <= endRow; i++) {
        rowsToDelete.add(i);
      }
    });

    // Filter out selected rows
    const newAnnotations = localAnnotations.filter((_, idx) => !rowsToDelete.has(idx));
    setLocalAnnotations(newAnnotations);
    toast.success(`Deleted ${rowsToDelete.size} annotation(s)`);
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

  // Convert annotations to table data
  const data = localAnnotations.map(ann => ({
    start: ann.start,
    end: ann.end,
    label: ann.label,
    shape: ann.shape,
    color: ann.color || '#666666'
  }));

  // Handle data changes from Handsontable
  const afterChange = useCallback((changes: Handsontable.CellChange[] | null) => {
    if (!changes) return;

    const newAnnotations = [...localAnnotations];
    changes.forEach(([row, prop, oldValue, newValue]) => {
      if (oldValue === newValue) return;
      
      const ann = newAnnotations[row];
      if (!ann) return;

      if (prop === 'start' || prop === 'end') {
        const num = parseInt(String(newValue), 10);
        if (!isNaN(num)) {
          ann[prop] = Math.max(1, Math.min(num, referenceLength));
        }
      } else if (prop === 'label') {
        ann.label = String(newValue);
      } else if (prop === 'shape') {
        ann.shape = newValue as 'block' | 'arrow-forward' | 'arrow-reverse';
      } else if (prop === 'color') {
        ann.color = String(newValue);
      }
    });

    setLocalAnnotations(newAnnotations);
  }, [localAnnotations, referenceLength]);

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
            onClick={handleDeleteSelected}
            className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete Selected
          </button>
          <button
            onClick={handleExport}
            disabled={localAnnotations.length === 0}
            className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            Export TSV
          </button>
          <div className="ml-auto text-sm text-gray-600 dark:text-gray-400 self-center">
            {localAnnotations.length} annotation(s) | Reference: {referenceLength.toLocaleString()} bp
          </div>
        </div>

        {/* Spreadsheet */}
        <div className="flex-1 overflow-hidden p-4" style={{ minHeight: '400px' }}>
          <HotTable
            ref={(ref) => { hotRef.current = ref?.hotInstance || null; }}
            data={data}
            colHeaders={['Start', 'End', 'Label', 'Shape', 'Color']}
            columns={[
              { data: 'start', type: 'numeric' },
              { data: 'end', type: 'numeric' },
              { data: 'label', type: 'text' },
              {
                data: 'shape',
                type: 'dropdown',
                source: ['block', 'arrow-forward', 'arrow-reverse']
              },
              { data: 'color', type: 'text' }
            ]}
            rowHeaders={true}
            width="100%"
            height={450}
            licenseKey="non-commercial-and-evaluation"
            afterChange={afterChange}
            contextMenu={true}
            manualRowResize={true}
            manualColumnResize={true}
            stretchH="all"
            minRows={10}
            minSpareRows={1}
          />
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

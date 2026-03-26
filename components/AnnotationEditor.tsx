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
  ringColor?: string;
  annotations: Annotation[];
  referenceLength: number;
  onAnnotationsChange: (ringId: string, annotations: Annotation[]) => void;
  onClose: () => void;
}

export default function AnnotationEditor({
  ringId,
  ringName,
  ringColor = '#666666',
  annotations,
  referenceLength,
  onAnnotationsChange,
  onClose
}: AnnotationEditorProps) {
  const [localAnnotations, setLocalAnnotations] = useState<Annotation[]>([...annotations]);
  const hotRef = useRef<Handsontable | null>(null);
  const [showGenbankImport, setShowGenbankImport] = useState(false);
  const [gbFeatureType, setGbFeatureType] = useState('CDS');
  const [gbTextFilter, setGbTextFilter] = useState('');

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

      // Use ring colour as default for annotations without a specified colour
      const coloured = result.annotations.map(a => ({
        ...a,
        color: a.color === '#666666' ? ringColor : a.color
      }));
      setLocalAnnotations([...localAnnotations, ...coloured]);
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
      color: ringColor
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

  const handleGenBankImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const { extractGenBankFeatures } = await import('@/workers/parser.worker');
      const features = extractGenBankFeatures(text, gbFeatureType, gbTextFilter || undefined);

      if (features.length === 0) {
        toast.error(`No ${gbFeatureType} features found`);
        return;
      }

      // Use ring colour for GenBank features (they default to #000000)
      const coloured = features.map(f => ({ ...f, color: ringColor }));
      setLocalAnnotations([...localAnnotations, ...coloured]);
      if (features.length > 200) {
        toast.success(`Imported ${features.length} features. Labels auto-disabled (too many).`);
      } else {
        toast.success(`Imported ${features.length} ${gbFeatureType} feature(s)`);
      }
      setShowGenbankImport(false);
    } catch (error: any) {
      toast.error(`GenBank parse error: ${error.message}`);
    }

    e.target.value = '';
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
        ann.shape = newValue as Annotation['shape'];
      } else if (prop === 'color') {
        ann.color = String(newValue);
      }
    });

    setLocalAnnotations(newAnnotations);
  }, [localAnnotations, referenceLength]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0, 0, 0, 0.6)' }}>
      <div className="rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col" style={{ background: 'var(--gx-bg-alt)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        {/* Header */}
        <div className="p-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--gx-border)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--gx-text)' }}>
            Annotations for {ringName}
          </h2>
          <button
            onClick={onClose}
            style={{ color: 'var(--gx-text-muted)' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 flex gap-2 flex-wrap" style={{ borderBottom: '1px solid var(--gx-border)' }}>
          <label className="btn-primary cursor-pointer text-sm">
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
            className="btn-secondary text-sm"
          >
            Add New
          </button>
          <button
            onClick={handleDeleteSelected}
            className="btn-secondary text-sm"
            style={{ borderColor: 'var(--gx-error)', color: 'var(--gx-error)' }}
          >
            Delete Selected
          </button>
          <button
            onClick={handleExport}
            disabled={localAnnotations.length === 0}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            Export TSV
          </button>
          <button
            onClick={() => setShowGenbankImport(!showGenbankImport)}
            className="btn-secondary text-sm"
          >
            Import GenBank Features
          </button>
          <div className="ml-auto text-sm self-center" style={{ color: 'var(--gx-text-muted)' }}>
            {localAnnotations.length} annotation(s) | Reference: {referenceLength.toLocaleString()} bp
          </div>
        </div>

        {/* GenBank Import Panel */}
        {showGenbankImport && (
          <div className="px-4 pb-4 flex gap-2 items-end flex-wrap" style={{ borderBottom: '1px solid var(--gx-border)' }}>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--gx-text-muted)' }}>Feature Type</label>
              <select
                value={gbFeatureType}
                onChange={(e) => setGbFeatureType(e.target.value)}
                className="input-field text-sm"
              >
                <option value="CDS">CDS</option>
                <option value="gene">gene</option>
                <option value="rRNA">rRNA</option>
                <option value="tRNA">tRNA</option>
                <option value="misc_feature">misc_feature</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--gx-text-muted)' }}>Text Filter (optional)</label>
              <input
                type="text"
                value={gbTextFilter}
                onChange={(e) => setGbTextFilter(e.target.value)}
                placeholder="e.g. kinase"
                className="input-field text-sm"
              />
            </div>
            <label className="btn-primary text-sm cursor-pointer">
              Choose .gbk File
              <input
                type="file"
                accept=".gbk,.gb,.genbank"
                onChange={handleGenBankImport}
                className="hidden"
              />
            </label>
          </div>
        )}

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
                source: ['block', 'arrow-forward', 'arrow-reverse', 'arc', 'hidden']
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
        <div className="p-4 flex justify-end gap-2" style={{ borderTop: '1px solid var(--gx-border)' }}>
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}

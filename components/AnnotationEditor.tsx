


import { useState, useRef, useCallback } from 'react';
import { HotTable } from '@handsontable/react';
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import type { Annotation, AnnotationShape } from '@/lib/types';
import { parseAnnotationFile, exportAnnotationsToTSV } from '@/lib/annotationParser';
import { readFileText } from '@/lib/fileAccess';
import toast from 'react-hot-toast';
import { extractGenBankFeatures, extractGFF3Features } from '@/lib/featureParser';

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

/** Row shape used internally by Handsontable. */
interface TableRow {
  id?: string;
  start: number;
  end: number;
  label: string;
  shape: string;
  color: string;
}

const ANNOTATION_SHAPES: AnnotationShape[] = [
  'block',
  'arrow-forward',
  'arrow-reverse',
  'arc',
  'hidden',
];

function normalizeShape(shape: string): AnnotationShape {
  switch (shape) {
    case 'arrow-forward':
    case 'arrow-reverse':
    case 'arc':
    case 'hidden':
      return shape;
    default:
      return 'block';
  }
}

type FeatureImportKind = 'genbank' | 'gff3';

const FEATURE_IMPORT_CONFIG = {
  genbank: {
    label: 'GenBank',
    accept: '.gbk,.gb,.genbank,.gbff',
    fileLabel: 'Choose .gbk File',
  },
  gff3: {
    label: 'GFF3',
    accept: '.gff3,.gff',
    fileLabel: 'Choose .gff3 File',
  },
} as const;

/** Convert Annotation[] to the flat row objects Handsontable works with. */
function toTableData(anns: Annotation[]): TableRow[] {
  return anns.map(a => ({
    id: a.id,
    start: a.start,
    end: a.end,
    label: a.label,
    shape: a.shape,
    color: a.color || '#666666',
  }));
}

/** Read Handsontable's current data back into Annotation objects. */
function readHotData(hot: Handsontable): Annotation[] {
  const src = hot.getSourceData() as TableRow[];
  return src
    .filter(r => r && (r.label || r.start || r.end)) // skip completely empty spare rows
    .map((r, i) => ({
      id: r.id || `ann-${Date.now()}-${i}`,
      start: Number(r.start) || 1,
      end: Number(r.end) || 1,
      label: r.label || '',
      shape: normalizeShape(r.shape),
      color: r.color || '#666666',
    }));
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
  // The source-of-truth data array is held in a ref so Handsontable can
  // mutate it directly without React re-renders overwriting cell edits.
  const tableDataRef = useRef<TableRow[]>(toTableData(annotations));
  const selectedRowsRef = useRef<number[]>([]);

  // Counter displayed in the toolbar (updated on sync)
  const [count, setCount] = useState(annotations.length);

  const hotRef = useRef<Handsontable | null>(null);
  const [featureImportKind, setFeatureImportKind] = useState<FeatureImportKind | null>(null);
  const [featureType, setFeatureType] = useState('CDS');
  const [featureTextFilter, setFeatureTextFilter] = useState('');

  /** Push new data into Handsontable without a full re-render. */
  const loadDataIntoHot = useCallback((anns: Annotation[]) => {
    const rows = toTableData(anns);
    tableDataRef.current = rows;
    selectedRowsRef.current = [];
    setCount(anns.length);
    const hot = hotRef.current;
    if (hot && !hot.isDestroyed) {
      hot.loadData(rows);
    }
  }, []);

  /** Read current table state back into Annotation objects. */
  const readAnnotations = useCallback((): Annotation[] => {
    const hot = hotRef.current;
    if (!hot || hot.isDestroyed) return [];
    return readHotData(hot);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileText(file);
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
      const current = readAnnotations();
      loadDataIntoHot([...current, ...coloured]);
      toast.success(`Loaded ${result.annotations.length} annotation(s)`);
    } catch (error) {
      toast.error('Failed to parse annotation file');
      console.error('Parse error:', error);
    }

    // Reset input
    e.target.value = '';
  };

  const handleAddNew = () => {
    const current = readAnnotations();
    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      start: 1,
      end: Math.min(1000, referenceLength),
      label: `Annotation ${current.length + 1}`,
      shape: 'block',
      color: ringColor
    };
    loadDataIntoHot([...current, newAnnotation]);
    toast.success('Added new annotation');
  };

  const handleDeleteSelected = () => {
    const hot = hotRef.current;
    if (!hot) return;

    const selected = hot.getSelected();
    const rowsToDelete = new Set<number>(selectedRowsRef.current);

    if (selected) {
      selected.forEach(([startRow, , endRow]) => {
        const first = Math.min(startRow, endRow);
        const last = Math.max(startRow, endRow);
        for (let row = first; row <= last; row++) rowsToDelete.add(row);
      });
    }

    if (rowsToDelete.size === 0) {
      toast.error('No rows selected');
      return;
    }

    const current = readAnnotations();
    const remaining = current.filter((_, idx) => !rowsToDelete.has(idx));
    loadDataIntoHot(remaining);
    toast.success(`Deleted ${rowsToDelete.size} annotation(s)`);
  };

  const handleReset = () => {
    loadDataIntoHot([]);
    toast.success('All annotations cleared');
  };

  const handleSave = () => {
    const current = readAnnotations();
    onAnnotationsChange(ringId, current);
    toast.success('Annotations updated');
    onClose();
  };

  const handleExport = () => {
    const current = readAnnotations();
    const tsv = exportAnnotationsToTSV(current);
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ringName.replace(/\s+/g, '_')}_annotations.tsv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported annotations');
  };

  const handleFeatureImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const kind = featureImportKind;
    if (!file || !kind) return;

    try {
      const text = await readFileText(file);
      const extract = kind === 'genbank' ? extractGenBankFeatures : extractGFF3Features;
      const features = extract(text, featureType, featureTextFilter || undefined);

      if (features.length === 0) {
        toast.error(`No ${featureType} features found`);
        return;
      }

      // Imported features default to black; use the ring colour in the editor.
      const coloured = features.map(f => ({ ...f, color: ringColor }));
      const current = readAnnotations();
      loadDataIntoHot([...current, ...coloured]);
      if (features.length > 200) {
        toast.success(`Imported ${features.length} features. Labels auto-disabled (too many).`);
      } else {
        const suffix = kind === 'gff3' ? ' from GFF3' : '';
        toast.success(`Imported ${features.length} ${featureType} feature(s)${suffix}`);
      }
      setFeatureImportKind(null);
    } catch (error) {
      toast.error(`${FEATURE_IMPORT_CONFIG[kind].label} parse error: ${error instanceof Error ? error.message : String(error)}`);
    }

    e.target.value = '';
  };

  // Keep the count in sync when Handsontable rows change via context menu or paste
  const syncCount = useCallback(() => {
    const hot = hotRef.current;
    if (!hot || hot.isDestroyed) return;
    const src = hot.getSourceData() as TableRow[];
    const realRows = src.filter(r => r && (r.label || r.start || r.end)).length;
    setCount(realRows);
  }, []);

  // afterChange: update count (Handsontable handles its own data in uncontrolled mode)
  const afterChange = useCallback((_changes: Handsontable.CellChange[] | null, source: string) => {
    if (source === 'loadData') return; // ignore initial load
    syncCount();
  }, [syncCount]);

  // afterRemoveRow / afterCreateRow: keep the displayed count in sync
  const afterRemoveRow = useCallback(() => {
    syncCount();
  }, [syncCount]);

  const afterCreateRow = useCallback(() => {
    syncCount();
  }, [syncCount]);

  const afterPaste = useCallback(() => {
    syncCount();
  }, [syncCount]);

  const handleSelection = useCallback((row: number, _column: number, row2: number) => {
    const first = Math.min(row, row2);
    const last = Math.max(row, row2);
    selectedRowsRef.current = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }, []);

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
            onClick={handleReset}
            className="btn-secondary text-sm"
            style={{ borderColor: 'var(--gx-error)', color: 'var(--gx-error)' }}
          >
            Reset All
          </button>
          <button
            onClick={handleExport}
            disabled={count === 0}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            Export TSV
          </button>
          <button
            onClick={() => setFeatureImportKind(current => current === 'genbank' ? null : 'genbank')}
            className="btn-secondary text-sm"
          >
            Import GenBank Features
          </button>
          <button
            onClick={() => setFeatureImportKind(current => current === 'gff3' ? null : 'gff3')}
            className="btn-secondary text-sm"
          >
            Import GFF3 Features
          </button>
          <div className="ml-auto text-sm self-center" style={{ color: 'var(--gx-text-muted)' }}>
            {count} annotation(s) | Reference: {referenceLength.toLocaleString()} bp
          </div>
        </div>

        {/* GenBank/GFF3 Import Panel */}
        {featureImportKind && (
          <div className="px-4 pb-4 flex gap-2 items-end flex-wrap" style={{ borderBottom: '1px solid var(--gx-border)' }}>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--gx-text-muted)' }}>Feature Type</label>
              <select
                value={featureType}
                onChange={(e) => setFeatureType(e.target.value)}
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
                value={featureTextFilter}
                onChange={(e) => setFeatureTextFilter(e.target.value)}
                placeholder="e.g. kinase"
                className="input-field text-sm"
              />
            </div>
            <label className="btn-primary text-sm cursor-pointer">
              {FEATURE_IMPORT_CONFIG[featureImportKind].fileLabel}
              <input
                type="file"
                accept={FEATURE_IMPORT_CONFIG[featureImportKind].accept}
                onChange={handleFeatureImport}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Spreadsheet — uncontrolled mode: data is passed once via ref, not re-rendered */}
        <div className="flex-1 overflow-hidden p-4" style={{ minHeight: '400px' }}>
          <HotTable
            ref={(ref) => { hotRef.current = ref?.hotInstance || null; }}
            data={tableDataRef.current}
            colHeaders={['Start', 'End', 'Label', 'Shape', 'Colour']}
            columns={[
              { data: 'start', type: 'numeric' },
              { data: 'end', type: 'numeric' },
              { data: 'label', type: 'text' },
              {
                data: 'shape',
                type: 'dropdown',
                source: ANNOTATION_SHAPES
              },
              { data: 'color', type: 'text' }
            ]}
            rowHeaders={true}
            width="100%"
            height={450}
            licenseKey="non-commercial-and-evaluation"
            themeName="ht-theme-main-dark-auto"
            afterChange={afterChange}
            afterRemoveRow={afterRemoveRow}
            afterCreateRow={afterCreateRow}
            afterPaste={afterPaste}
            afterSelection={handleSelection}
            afterSelectionEnd={handleSelection}
            contextMenu={['row_above', 'row_below', 'remove_row', '---------', 'copy', 'cut']}
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

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { Annotation } from '@/lib/types';
import {
  ANNOTATION_SHAPES,
  annotationsToRows,
  pasteAnnotationCells,
  rowsToAnnotations,
  type AnnotationColumn,
  type AnnotationTableRow,
} from '@/lib/annotationTable';
import { parseAnnotationFile, exportAnnotationsToTSV } from '@/lib/annotationParser';
import { readFileText } from '@/lib/fileAccess';
import { extractGenBankFeatures, extractGFF3Features } from '@/lib/featureParser';

interface AnnotationEditorProps {
  ringId: string;
  ringName: string;
  ringColor?: string;
  annotations: Annotation[];
  referenceLength: number;
  onAnnotationsChange: (ringId: string, annotations: Annotation[]) => void;
  onClose: () => void;
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

const CELL_STYLE = {
  borderColor: 'var(--gx-border)',
  background: 'var(--gx-bg)',
  color: 'var(--gx-text)',
};

export default function AnnotationEditor({
  ringId,
  ringName,
  ringColor = '#666666',
  annotations,
  referenceLength,
  onAnnotationsChange,
  onClose,
}: AnnotationEditorProps) {
  const [rows, setRows] = useState<AnnotationTableRow[]>(() => annotationsToRows(annotations));
  const [selectedRows, setSelectedRows] = useState<Set<number>>(() => new Set());
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const [featureImportKind, setFeatureImportKind] = useState<FeatureImportKind | null>(null);
  const [featureType, setFeatureType] = useState('CDS');
  const [featureTextFilter, setFeatureTextFilter] = useState('');
  const nextRowId = useRef(annotations.length);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const createRowId = () => `annotation-${Date.now()}-${nextRowId.current++}`;

  const replaceRows = (nextRows: AnnotationTableRow[]) => {
    setRows(nextRows);
    setSelectedRows(new Set());
    setFocusedRow(null);
  };

  const currentAnnotations = () => rowsToAnnotations(rows, referenceLength);

  const appendAnnotations = (newAnnotations: Annotation[]) => {
    setRows(current => [...current, ...annotationsToRows(newAnnotations)]);
    setSelectedRows(new Set());
  };

  const updateRow = <Column extends AnnotationColumn>(
    rowIndex: number,
    column: Column,
    value: AnnotationTableRow[Column],
  ) => {
    setRows(current => current.map((row, index) => (
      index === rowIndex ? { ...row, [column]: value } : row
    )));
  };

  const handlePaste = (
    event: React.ClipboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIndex: number,
    column: AnnotationColumn,
  ) => {
    const clipboardText = event.clipboardData.getData('text/plain');
    if (!clipboardText) return;
    event.preventDefault();
    setRows(current => pasteAnnotationCells(current, rowIndex, column, clipboardText, createRowId));
    setFocusedRow(rowIndex);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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

      appendAnnotations(result.annotations.map(annotation => ({
        ...annotation,
        color: annotation.color === '#666666' ? ringColor : annotation.color,
      })));
      toast.success(`Loaded ${result.annotations.length} annotation(s)`);
    } catch (error) {
      toast.error('Failed to parse annotation file');
      console.error('Parse error:', error);
    } finally {
      event.target.value = '';
    }
  };

  const handleAddNew = () => {
    const newRow: AnnotationTableRow = {
      id: createRowId(),
      start: 1,
      end: Math.min(1000, referenceLength),
      label: `Annotation ${rows.length + 1}`,
      shape: 'block',
      color: ringColor,
    };
    setRows(current => [...current, newRow]);
    setFocusedRow(rows.length);
    toast.success('Added new annotation');
  };

  const handleDeleteSelected = () => {
    const rowsToDelete = new Set(selectedRows);
    if (focusedRow !== null) rowsToDelete.add(focusedRow);

    if (rowsToDelete.size === 0) {
      toast.error('No rows selected');
      return;
    }

    replaceRows(rows.filter((_, index) => !rowsToDelete.has(index)));
    toast.success(`Deleted ${rowsToDelete.size} annotation(s)`);
  };

  const handleReset = () => {
    replaceRows([]);
    toast.success('All annotations cleared');
  };

  const handleSave = () => {
    onAnnotationsChange(ringId, currentAnnotations());
    toast.success('Annotations updated');
    onClose();
  };

  const handleExport = () => {
    const tsv = exportAnnotationsToTSV(currentAnnotations());
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${ringName.replace(/\s+/g, '_')}_annotations.tsv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Exported annotations');
  };

  const handleFeatureImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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

      appendAnnotations(features.map(feature => ({ ...feature, color: ringColor })));
      toast.success(features.length > 200
        ? `Imported ${features.length} features. Labels auto-disabled (too many).`
        : `Imported ${features.length} ${featureType} feature(s)${kind === 'gff3' ? ' from GFF3' : ''}`);
      setFeatureImportKind(null);
    } catch (error) {
      toast.error(`${FEATURE_IMPORT_CONFIG[kind].label} parse error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      event.target.value = '';
    }
  };

  const toggleSelectedRow = (rowIndex: number) => {
    setSelectedRows(current => {
      const next = new Set(current);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const toggleAllRows = () => {
    setSelectedRows(current => (
      current.size === rows.length ? new Set() : new Set(rows.map((_, index) => index))
    ));
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0, 0, 0, 0.6)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="annotation-editor-title"
    >
      <div className="rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col" style={{ background: 'var(--gx-bg-alt)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        <div className="p-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--gx-border)' }}>
          <h2 id="annotation-editor-title" className="text-xl font-bold" style={{ color: 'var(--gx-text)' }}>
            Annotations for {ringName}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close annotation editor" style={{ color: 'var(--gx-text-muted)' }}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="px-4 py-2 text-xs" style={{ color: 'var(--gx-text-muted)', borderBottom: '1px solid var(--gx-border)' }}>
          This is an optional overlay on the selected query ring. Paste rows from a spreadsheet, or import GenBank or GFF3 features here.
        </p>

        <div className="p-4 flex gap-2 flex-wrap" style={{ borderBottom: '1px solid var(--gx-border)' }}>
          <label className="btn-primary cursor-pointer text-sm">
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" />
            Load File
          </label>
          <button type="button" onClick={handleAddNew} className="btn-secondary text-sm">Add New</button>
          <button type="button" onClick={handleDeleteSelected} className="btn-secondary text-sm" style={{ borderColor: 'var(--gx-error)', color: 'var(--gx-error)' }}>
            Delete Selected
          </button>
          <button type="button" onClick={handleReset} className="btn-secondary text-sm" style={{ borderColor: 'var(--gx-error)', color: 'var(--gx-error)' }}>
            Reset All
          </button>
          <button type="button" onClick={handleExport} disabled={rows.length === 0} className="btn-secondary text-sm disabled:opacity-50">
            Export TSV
          </button>
          <button type="button" onClick={() => setFeatureImportKind(current => current === 'genbank' ? null : 'genbank')} className="btn-secondary text-sm">
            Import GenBank Features
          </button>
          <button type="button" onClick={() => setFeatureImportKind(current => current === 'gff3' ? null : 'gff3')} className="btn-secondary text-sm">
            Import GFF3 Features
          </button>
          <div className="ml-auto text-sm self-center" style={{ color: 'var(--gx-text-muted)' }} aria-live="polite">
            {rows.length} annotation(s) | Reference: {referenceLength.toLocaleString()} bp
          </div>
        </div>

        {featureImportKind && (
          <div className="px-4 pb-4 flex gap-2 items-end flex-wrap" style={{ borderBottom: '1px solid var(--gx-border)' }}>
            <div>
              <label htmlFor="feature-type" className="block text-xs mb-1" style={{ color: 'var(--gx-text-muted)' }}>Feature Type</label>
              <select id="feature-type" value={featureType} onChange={event => setFeatureType(event.target.value)} className="input-field text-sm">
                <option value="CDS">CDS</option>
                <option value="gene">gene</option>
                <option value="rRNA">rRNA</option>
                <option value="tRNA">tRNA</option>
                <option value="misc_feature">misc_feature</option>
              </select>
            </div>
            <div>
              <label htmlFor="feature-filter" className="block text-xs mb-1" style={{ color: 'var(--gx-text-muted)' }}>Text Filter (optional)</label>
              <input id="feature-filter" type="text" value={featureTextFilter} onChange={event => setFeatureTextFilter(event.target.value)} placeholder="e.g. kinase" className="input-field text-sm" />
            </div>
            <label className="btn-primary text-sm cursor-pointer">
              {FEATURE_IMPORT_CONFIG[featureImportKind].fileLabel}
              <input type="file" accept={FEATURE_IMPORT_CONFIG[featureImportKind].accept} onChange={handleFeatureImport} className="hidden" />
            </label>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4" style={{ minHeight: '400px' }}>
          <table className="w-full border-collapse text-sm" aria-label="Annotations">
            <caption className="sr-only">Editable annotations. Use the checkboxes to select rows for deletion.</caption>
            <thead className="sticky top-0 z-10" style={{ background: 'var(--gx-bg-alt)' }}>
              <tr>
                <th className="border p-2 w-12" style={{ borderColor: 'var(--gx-border)' }} scope="col">
                  <input
                    type="checkbox"
                    aria-label="Select all annotation rows"
                    checked={rows.length > 0 && selectedRows.size === rows.length}
                    onChange={toggleAllRows}
                  />
                </th>
                <th className="border p-2 text-left" style={{ borderColor: 'var(--gx-border)' }} scope="col">Start</th>
                <th className="border p-2 text-left" style={{ borderColor: 'var(--gx-border)' }} scope="col">End</th>
                <th className="border p-2 text-left" style={{ borderColor: 'var(--gx-border)' }} scope="col">Label</th>
                <th className="border p-2 text-left" style={{ borderColor: 'var(--gx-border)' }} scope="col">Shape</th>
                <th className="border p-2 text-left" style={{ borderColor: 'var(--gx-border)' }} scope="col">Colour</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.id} data-testid="annotation-row" style={selectedRows.has(rowIndex) ? { background: 'color-mix(in srgb, var(--gx-accent) 12%, transparent)' } : undefined}>
                  <th className="border p-2 text-center" style={{ borderColor: 'var(--gx-border)' }} scope="row">
                    <input type="checkbox" aria-label={`Select annotation row ${rowIndex + 1}`} checked={selectedRows.has(rowIndex)} onChange={() => toggleSelectedRow(rowIndex)} />
                  </th>
                  <td className="border p-0" style={{ borderColor: 'var(--gx-border)' }}>
                    <input type="number" min={1} max={referenceLength} value={row.start} aria-label={`Start row ${rowIndex + 1}`} className="w-full p-2 bg-transparent" style={CELL_STYLE} onFocus={() => setFocusedRow(rowIndex)} onPaste={event => handlePaste(event, rowIndex, 'start')} onChange={event => updateRow(rowIndex, 'start', event.target.valueAsNumber || 1)} />
                  </td>
                  <td className="border p-0" style={{ borderColor: 'var(--gx-border)' }}>
                    <input type="number" min={1} max={referenceLength} value={row.end} aria-label={`End row ${rowIndex + 1}`} className="w-full p-2 bg-transparent" style={CELL_STYLE} onFocus={() => setFocusedRow(rowIndex)} onPaste={event => handlePaste(event, rowIndex, 'end')} onChange={event => updateRow(rowIndex, 'end', event.target.valueAsNumber || 1)} />
                  </td>
                  <td className="border p-0" style={{ borderColor: 'var(--gx-border)' }}>
                    <input type="text" value={row.label} aria-label={`Label row ${rowIndex + 1}`} className="w-full p-2 bg-transparent" style={CELL_STYLE} onFocus={() => setFocusedRow(rowIndex)} onPaste={event => handlePaste(event, rowIndex, 'label')} onChange={event => updateRow(rowIndex, 'label', event.target.value)} />
                  </td>
                  <td className="border p-0" style={{ borderColor: 'var(--gx-border)' }}>
                    <select value={row.shape} aria-label={`Shape row ${rowIndex + 1}`} className="w-full p-2" style={CELL_STYLE} onFocus={() => setFocusedRow(rowIndex)} onPaste={event => handlePaste(event, rowIndex, 'shape')} onChange={event => updateRow(rowIndex, 'shape', event.target.value as AnnotationTableRow['shape'])}>
                      {ANNOTATION_SHAPES.map(shape => <option key={shape} value={shape}>{shape}</option>)}
                    </select>
                  </td>
                  <td className="border p-0" style={{ borderColor: 'var(--gx-border)' }}>
                    <input type="text" value={row.color} aria-label={`Colour row ${rowIndex + 1}`} className="w-full p-2 bg-transparent font-mono" style={CELL_STYLE} onFocus={() => setFocusedRow(rowIndex)} onPaste={event => handlePaste(event, rowIndex, 'color')} onChange={event => updateRow(rowIndex, 'color', event.target.value)} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="border p-2 text-center" style={{ borderColor: 'var(--gx-border)', color: 'var(--gx-text-muted)' }}>1</td>
                  <td className="border p-0" style={{ borderColor: 'var(--gx-border)' }}>
                    <input
                      type="number"
                      min={1}
                      max={referenceLength}
                      aria-label="Paste annotations here"
                      placeholder="Paste here"
                      className="w-full p-2 bg-transparent"
                      style={CELL_STYLE}
                      onPaste={event => handlePaste(event, 0, 'start')}
                      onChange={event => {
                        if (!event.target.value) return;
                        setRows([{ id: createRowId(), start: event.target.valueAsNumber || 1, end: 1, label: '', shape: 'block', color: ringColor }]);
                        setFocusedRow(0);
                      }}
                    />
                  </td>
                  <td colSpan={4} className="border p-2" style={{ borderColor: 'var(--gx-border)', color: 'var(--gx-text-muted)' }}>
                    Paste tab-separated rows here, load a file, or add an annotation.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 flex justify-end gap-2" style={{ borderTop: '1px solid var(--gx-border)' }}>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleSave} className="btn-primary">Save &amp; Close</button>
        </div>
      </div>
    </div>
  );
}

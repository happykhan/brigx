import type { Annotation, AnnotationShape } from './types';

export interface AnnotationTableRow {
  id: string;
  start: number;
  end: number;
  label: string;
  shape: AnnotationShape;
  color: string;
}

export type AnnotationColumn = keyof Pick<AnnotationTableRow, 'start' | 'end' | 'label' | 'shape' | 'color'>;

export const ANNOTATION_COLUMNS: AnnotationColumn[] = ['start', 'end', 'label', 'shape', 'color'];

export const ANNOTATION_SHAPES: AnnotationShape[] = [
  'block',
  'arrow-forward',
  'arrow-reverse',
  'arc',
  'hidden',
];

export function normalizeAnnotationShape(value: string): AnnotationShape {
  return ANNOTATION_SHAPES.includes(value as AnnotationShape)
    ? value as AnnotationShape
    : 'block';
}

export function annotationsToRows(annotations: Annotation[]): AnnotationTableRow[] {
  return annotations.map((annotation, index) => ({
    id: annotation.id || `annotation-${index + 1}`,
    start: annotation.start,
    end: annotation.end,
    label: annotation.label,
    shape: annotation.shape,
    color: annotation.color || '#666666',
  }));
}

export function rowsToAnnotations(rows: AnnotationTableRow[], referenceLength: number): Annotation[] {
  return rows.map((row, index) => ({
    id: row.id || `annotation-${Date.now()}-${index}`,
    start: clampCoordinate(row.start, referenceLength),
    end: clampCoordinate(row.end, referenceLength),
    label: row.label,
    shape: normalizeAnnotationShape(row.shape),
    color: row.color || '#666666',
  }));
}

export function pasteAnnotationCells(
  rows: AnnotationTableRow[],
  startRow: number,
  startColumn: AnnotationColumn,
  clipboardText: string,
  createId: () => string,
): AnnotationTableRow[] {
  const pastedRows = clipboardText
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line, index, lines) => line.length > 0 || index < lines.length - 1)
    .map(line => line.split('\t'));

  if (pastedRows.length === 0) return rows;

  const next = rows.map(row => ({ ...row }));
  const firstColumn = ANNOTATION_COLUMNS.indexOf(startColumn);

  pastedRows.forEach((cells, pastedRowIndex) => {
    const targetIndex = startRow + pastedRowIndex;
    if (!next[targetIndex]) {
      next[targetIndex] = {
        id: createId(),
        start: 1,
        end: 1,
        label: '',
        shape: 'block',
        color: '#666666',
      };
    }

    cells.forEach((cell, pastedColumnIndex) => {
      const column = ANNOTATION_COLUMNS[firstColumn + pastedColumnIndex];
      if (!column) return;

      if (column === 'start' || column === 'end') {
        const value = Number.parseInt(cell, 10);
        if (Number.isFinite(value)) next[targetIndex][column] = value;
      } else if (column === 'shape') {
        next[targetIndex].shape = normalizeAnnotationShape(cell.trim());
      } else {
        next[targetIndex][column] = cell.trim();
      }
    });
  });

  return next;
}

function clampCoordinate(value: number, referenceLength: number): number {
  const finiteValue = Number.isFinite(value) ? Math.round(value) : 1;
  return Math.max(1, Math.min(finiteValue, Math.max(1, referenceLength)));
}

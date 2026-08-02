import { describe, expect, it } from 'vitest';
import {
  annotationsToRows,
  pasteAnnotationCells,
  rowsToAnnotations,
  type AnnotationTableRow,
} from '@/lib/annotationTable';

const row: AnnotationTableRow = {
  id: 'original',
  start: 10,
  end: 20,
  label: 'original label',
  shape: 'block',
  color: '#000000',
};

describe('annotation table data', () => {
  it('round-trips annotations and clamps coordinates to the reference', () => {
    const rows = annotationsToRows([{ ...row, start: -10, end: 2_000 }]);
    expect(rowsToAnnotations(rows, 1_000)).toEqual([
      { ...row, start: 1, end: 1_000 },
    ]);
  });

  it('pastes rectangular spreadsheet data and creates missing rows', () => {
    let id = 0;
    const result = pasteAnnotationCells(
      [],
      0,
      'start',
      '100\t200\tgene A\tblock\t#ff0000\n300\t450\tgene B\tarrow-forward\t#00ff00',
      () => `new-${++id}`,
    );

    expect(result).toEqual([
      { id: 'new-1', start: 100, end: 200, label: 'gene A', shape: 'block', color: '#ff0000' },
      { id: 'new-2', start: 300, end: 450, label: 'gene B', shape: 'arrow-forward', color: '#00ff00' },
    ]);
  });

  it('does not overwrite cells beyond the pasted range', () => {
    const result = pasteAnnotationCells([row], 0, 'label', 'changed\tarc', () => 'unused');
    expect(result[0]).toEqual({ ...row, label: 'changed', shape: 'arc' });
  });
});

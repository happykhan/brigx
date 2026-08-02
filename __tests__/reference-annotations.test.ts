import { describe, expect, it } from 'vitest';
import { referenceFeaturesToAnnotations } from '@/lib/referenceAnnotations';

describe('referenceFeaturesToAnnotations', () => {
  it('uses one renderer-independent mapping for labels, shape, and colour', () => {
    const annotations = referenceFeaturesToAnnotations([
      { type: 'CDS', start: 10, end: 20, strand: '+', product: 'kinase' },
      { type: 'gene', start: 30, end: 40, strand: '-', name: 'recA', color: '#123456' },
    ]);

    expect(annotations).toEqual([
      { id: 'ref-feat-0', start: 10, end: 20, label: 'kinase', shape: 'arrow-forward', color: '#4a90e2' },
      { id: 'ref-feat-1', start: 30, end: 40, label: 'recA', shape: 'arrow-reverse', color: '#123456' },
    ]);
  });
});

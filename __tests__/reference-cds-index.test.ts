import { describe, expect, it } from 'vitest';
import { getReferenceCdsIndex } from '@/lib/referenceCdsIndex';
import type { Annotation, ReferenceCDS } from '@/lib/types';

const cds: ReferenceCDS[] = [{
  name: 'compound', strand: '-', segments: [{ start: 10, end: 20 }, { start: 30, end: 40 }],
}];
const annotations: Annotation[] = [{ id: 'companion', start: 50, end: 60, label: 'companion', shape: 'arrow-forward' }];

describe('reference CDS index', () => {
  it('reuses source arrays across scene objects and rebuilds when a companion file changes', () => {
    const first = getReferenceCdsIndex({ cds, annotations });
    expect(getReferenceCdsIndex({ cds, annotations })).toBe(first);

    const replacement = [{ ...annotations[0], start: 70, end: 80 }];
    const updated = getReferenceCdsIndex({ cds, annotations: replacement });
    expect(updated).not.toBe(first);
    expect(first.findOverlaps(49, 60, 5).map(feature => feature.name)).toEqual(['companion']);
    expect(updated.findOverlaps(49, 60, 5)).toEqual([]);
    expect(updated.findOverlaps(69, 80, 5).map(feature => feature.name)).toEqual(['companion']);
    expect(getReferenceCdsIndex({ cds, annotations }).findOverlaps(49, 60, 5)).toEqual(first.findOverlaps(49, 60, 5));
  });

  it('uses half-open overlaps and deduplicates joined CDS without covering intervening bases', () => {
    const index = getReferenceCdsIndex({ cds });
    expect(index.findOverlaps(10, 40, 5)).toEqual(cds);
    expect(index.findOverlaps(20, 30, 5)).toEqual([]);
    expect(index.findOverlaps(40, 41, 5)).toEqual([]);
  });

  it('keeps dense overlap queries bounded and preserves their ordering', () => {
    const dense = Array.from({ length: 10000 }, (_, index): ReferenceCDS => ({
      name: `cds${index}`, strand: '+', segments: [{ start: 10, end: 20 }],
    }));
    const index = getReferenceCdsIndex({ cds: dense });
    expect(index.findOverlaps(12, 18, 6)).toEqual(dense.slice(0, 6));
    expect(index.findOverlaps(12, 18, 0)).toEqual([]);
    expect(getReferenceCdsIndex({}).hasCds).toBe(false);
  });
});

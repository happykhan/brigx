import { describe, expect, it } from 'vitest';
import { importPlotData, isCircularPlotData } from '@/lib/plotValidation';
import type { CircularPlotData } from '@/lib/types';

const validPlot: CircularPlotData = {
  reference: {
    name: 'reference',
    length: 8,
    gcContent: [0.5, 0.25],
    annotations: [{ id: 'a', start: 1, end: 4, label: 'gene', shape: 'block' }],
  },
  rings: [{
    queryId: 'ring-1',
    queryName: 'query',
    color: '#00aabb',
    visible: true,
    hits: [{
      queryName: 'query',
      refStart: 1,
      refEnd: 8,
      queryStart: 1,
      queryEnd: 8,
      percentIdentity: 100,
      alignmentLength: 8,
      strand: '+',
    }],
    statistics: { meanIdentity: 100, genomeCoverage: 100, totalAlignedBases: 8 },
  }],
  config: { minIdentity: 70, minAlignmentLength: 1 },
};

describe('desktop plot validation', () => {
  it('accepts valid persisted plot data', () => {
    expect(isCircularPlotData(validPlot)).toBe(true);
    expect(importPlotData(JSON.stringify(validPlot))).toEqual(validPlot);
  });

  it('rejects structurally invalid or non-finite data', () => {
    expect(isCircularPlotData({ ...validPlot, rings: [{ queryId: 'incomplete' }] })).toBe(false);
    expect(() => importPlotData(JSON.stringify({ ...validPlot, reference: { name: 'x', length: -1 } })))
      .toThrow('Invalid BRIGX plot data');
  });
});

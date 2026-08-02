import { describe, expect, it } from 'vitest';
import { mergeAlignmentRings, synchronizeConfiguredRings, updatePlotAnnotations } from '@/lib/ringState';
import type { Annotation, CircularPlotData, RingConfig, RingData } from '@/lib/types';

const annotations: Annotation[] = [
  { id: 'ann-1', start: 1000, end: 2000, label: 'Sp 12', shape: 'arrow-forward', color: '#ff0000' },
  { id: 'ann-2', start: 3000, end: 4000, label: 'Sp 13', shape: 'block', color: '#00ff00' },
];

function createRing(hits = 1): RingData {
  return {
    queryId: 'ring-1',
    queryName: 'E_coli_K12',
    color: '#666666',
    visible: true,
    hits: Array.from({ length: hits }, (_, index) => ({
      queryName: 'query1',
      refStart: index * 100,
      refEnd: (index + 1) * 100,
      queryStart: index * 100,
      queryEnd: (index + 1) * 100,
      percentIdentity: 95,
      alignmentLength: 100,
      strand: '+' as const,
    })),
    statistics: { meanIdentity: 95, genomeCoverage: 50, totalAlignedBases: hits * 100 },
    alignmentOutput: 'mock alignment output',
  };
}

function createPlot(ring: RingData): CircularPlotData {
  return {
    reference: { name: 'Reference', length: 5_000_000 },
    rings: [ring],
    config: { minIdentity: 70, minAlignmentLength: 50 },
  };
}

describe('annotation and alignment preservation', () => {
  it('preserves annotations while replacing computed alignment data', () => {
    const existing = { ...createRing(0), annotations };
    const incoming = createRing(2);

    const [merged] = mergeAlignmentRings([existing], [incoming], {});

    expect(merged.annotations).toEqual(annotations);
    expect(merged.hits).toHaveLength(2);
    expect(merged.statistics.totalAlignedBases).toBe(200);
  });

  it('preserves alignment data while replacing annotations', () => {
    const original = createRing(2);
    const plot = createPlot(original);

    const updated = updatePlotAnnotations(plot, original.queryId, annotations);

    expect(updated?.rings[0].annotations).toEqual(annotations);
    expect(updated?.rings[0].hits).toEqual(original.hits);
    expect(updated?.rings[0].statistics).toEqual(original.statistics);
    expect(updated?.rings[0].alignmentOutput).toBe(original.alignmentOutput);
  });

  it('supports deleting every annotation without restoring stale values', () => {
    const original = { ...createRing(1), annotations };
    const cleared = updatePlotAnnotations(createPlot(original), original.queryId, []);
    const [merged] = mergeAlignmentRings(cleared?.rings, [createRing(2)], { [original.queryId]: [] });

    expect(merged.annotations).toEqual([]);
    expect(merged.hits).toHaveLength(2);
  });

  it('leaves unrelated rings unchanged', () => {
    const first = createRing(1);
    const second = { ...createRing(3), queryId: 'ring-2', queryName: 'Second' };
    const plot = { ...createPlot(first), rings: [first, second] };

    const updated = updatePlotAnnotations(plot, first.queryId, annotations);

    expect(updated?.rings[1]).toBe(second);
  });

  it('handles an absent plot while the reference is still loading', () => {
    expect(updatePlotAnnotations(null, 'ring-1', annotations)).toBeNull();
  });

  it('applies ring settings without discarding computed data', () => {
    const original = { ...createRing(2), annotations };
    const config: RingConfig = {
      id: original.queryId,
      legendText: 'Renamed ring',
      files: [],
      color: '#123456',
      upperThreshold: 99,
      lowerThreshold: 75,
      customWidth: 24,
    };

    const [updated] = synchronizeConfiguredRings([original], [config], {});

    expect(updated).toMatchObject({
      queryName: 'Renamed ring',
      color: '#123456',
      upperThreshold: 99,
      lowerThreshold: 75,
      customWidth: 24,
      hits: original.hits,
      annotations,
    });
  });
});

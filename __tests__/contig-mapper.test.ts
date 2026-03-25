/**
 * Tests for contig mapping and graph conversion modules.
 */

import { describe, it, expect } from '@jest/globals';
import { mapContigsToReference, convertGraph } from '@/lib/contigMapper';
import type { AlignmentHit } from '@/lib/types';

function makeHit(
  queryName: string,
  refStart: number,
  refEnd: number,
  identity: number = 90,
  strand: '+' | '-' = '+'
): AlignmentHit {
  return {
    queryName,
    refStart,
    refEnd,
    queryStart: 0,
    queryEnd: refEnd - refStart,
    percentIdentity: identity,
    alignmentLength: refEnd - refStart,
    strand
  };
}

describe('Contig Mapping', () => {
  it('should map contigs to reference positions', () => {
    const hits = [
      makeHit('contig1', 0, 1000),
      makeHit('contig2', 2000, 3000),
      makeHit('contig3', 5000, 6000)
    ];

    const result = mapContigsToReference(hits, ['contig1', 'contig2', 'contig3']);

    expect(result).toHaveLength(3);
    // Should be sorted by reference position
    expect(result[0].name).toBe('contig1');
    expect(result[1].name).toBe('contig2');
    expect(result[2].name).toBe('contig3');
  });

  it('should sort by reference position not original order', () => {
    const hits = [
      makeHit('contigA', 5000, 6000),
      makeHit('contigB', 1000, 2000),
      makeHit('contigC', 3000, 4000)
    ];

    const result = mapContigsToReference(hits, ['contigA', 'contigB', 'contigC']);

    expect(result[0].name).toBe('contigB');
    expect(result[1].name).toBe('contigC');
    expect(result[2].name).toBe('contigA');
  });

  it('should handle unmapped contigs', () => {
    const hits = [makeHit('contig1', 0, 1000)];

    const result = mapContigsToReference(hits, ['contig1', 'unmapped']);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('contig1');
    expect(result[1].name).toBe('unmapped');
    expect(result[1].hitCount).toBe(0);
    expect(result[1].bestRefStart).toBe(-1);
  });

  it('should detect reverse orientation', () => {
    const hits = [makeHit('contig1', 0, 1000, 90, '-')];
    const result = mapContigsToReference(hits, ['contig1']);

    expect(result[0].orientation).toBe('-');
  });

  it('should aggregate multiple hits per contig', () => {
    const hits = [
      makeHit('contig1', 0, 500, 95),
      makeHit('contig1', 600, 1000, 85)
    ];

    const result = mapContigsToReference(hits, ['contig1']);

    expect(result[0].hitCount).toBe(2);
    expect(result[0].bestRefStart).toBe(0);
    expect(result[0].bestRefEnd).toBe(1000);
    expect(result[0].totalAlignedBases).toBe(900);
    // Weighted identity: (95*500 + 85*400) / 900 ≈ 90.56
    expect(result[0].meanIdentity).toBeCloseTo(90.56, 0);
  });

  it('should handle empty hits', () => {
    const result = mapContigsToReference([], ['contig1']);
    expect(result).toHaveLength(1);
    expect(result[0].hitCount).toBe(0);
  });
});

describe('Graph Conversion', () => {
  it('should map graph values from old to new reference', () => {
    const graphPoints = [
      { start: 0, end: 100, value: 10 },
      { start: 100, end: 200, value: 20 }
    ];

    // Alignment: old[0..200] maps to new[1000..1200]
    const hits: AlignmentHit[] = [{
      queryName: 'old',
      refStart: 1000,
      refEnd: 1200,
      queryStart: 0,
      queryEnd: 200,
      percentIdentity: 99,
      alignmentLength: 200,
      strand: '+'
    }];

    const result = convertGraph(graphPoints, hits, 2000, 100);

    expect(result.length).toBe(20); // 2000/100 = 20 windows

    // Windows 10-11 (1000-1200) should have values
    expect(result[10].value).toBeGreaterThan(0);
    expect(result[11].value).toBeGreaterThan(0);

    // Other windows should be 0
    expect(result[0].value).toBe(0);
    expect(result[15].value).toBe(0);
  });

  it('should handle empty graph', () => {
    const result = convertGraph([], [], 1000, 100);
    expect(result).toHaveLength(10);
    result.forEach(p => expect(p.value).toBe(0));
  });

  it('should handle no alignment hits', () => {
    const graphPoints = [{ start: 0, end: 100, value: 50 }];
    const result = convertGraph(graphPoints, [], 1000, 100);

    result.forEach(p => expect(p.value).toBe(0));
  });
});

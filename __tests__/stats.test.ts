/**
 * Ring statistics and controller logic tests.
 *
 * Tests the computeRingStats logic extracted from controller.ts
 * without needing Web Workers.
 */

import { describe, it, expect } from '@jest/globals';
import type { AlignmentHit } from '@/lib/types';

// Extracted from controller.ts for testability
function computeRingStats(
  hits: AlignmentHit[],
  referenceLength: number,
  minIdentity: number,
  minLength: number
): { meanIdentity: number; genomeCoverage: number; totalAlignedBases: number } {
  const filtered = hits.filter(
    h => h.percentIdentity >= minIdentity && h.alignmentLength >= minLength
  );

  if (filtered.length === 0) {
    return { meanIdentity: 0, genomeCoverage: 0, totalAlignedBases: 0 };
  }

  const covered = new Uint8Array(referenceLength);
  let totalWeightedIdentity = 0;
  let totalAlignedBases = 0;

  for (const hit of filtered) {
    const start = Math.max(0, hit.refStart);
    const end = Math.min(referenceLength, hit.refEnd);
    const len = end - start;
    if (len > 0) {
      covered.fill(1, start, end);
      totalWeightedIdentity += hit.percentIdentity * len;
      totalAlignedBases += len;
    }
  }

  let coveredBases = 0;
  for (let i = 0; i < referenceLength; i++) {
    if (covered[i]) coveredBases++;
  }

  return {
    meanIdentity: totalAlignedBases > 0 ? totalWeightedIdentity / totalAlignedBases : 0,
    genomeCoverage: (coveredBases / referenceLength) * 100,
    totalAlignedBases: coveredBases
  };
}

function makeHit(
  refStart: number,
  refEnd: number,
  percentIdentity: number,
  alignmentLength?: number
): AlignmentHit {
  const len = alignmentLength ?? (refEnd - refStart);
  return {
    queryName: 'query',
    refStart,
    refEnd,
    queryStart: 0,
    queryEnd: len,
    percentIdentity,
    alignmentLength: len,
    strand: '+'
  };
}

describe('computeRingStats', () => {
  it('should return zeros for empty hits', () => {
    const stats = computeRingStats([], 1000, 70, 50);
    expect(stats.meanIdentity).toBe(0);
    expect(stats.genomeCoverage).toBe(0);
    expect(stats.totalAlignedBases).toBe(0);
  });

  it('should calculate 100% coverage for full-length hit', () => {
    const hits = [makeHit(0, 1000, 95, 1000)];
    const stats = computeRingStats(hits, 1000, 70, 50);

    expect(stats.genomeCoverage).toBeCloseTo(100, 1);
    expect(stats.meanIdentity).toBeCloseTo(95, 1);
    expect(stats.totalAlignedBases).toBe(1000);
  });

  it('should calculate partial coverage correctly', () => {
    const hits = [makeHit(0, 500, 90, 500)];
    const stats = computeRingStats(hits, 1000, 70, 50);

    expect(stats.genomeCoverage).toBeCloseTo(50, 1);
    expect(stats.meanIdentity).toBeCloseTo(90, 1);
    expect(stats.totalAlignedBases).toBe(500);
  });

  it('should handle overlapping hits correctly (no double-counting coverage)', () => {
    const hits = [
      makeHit(0, 600, 90, 600),
      makeHit(400, 1000, 95, 600)
    ];
    const stats = computeRingStats(hits, 1000, 70, 50);

    // Coverage should be 100% (0-600 + 400-1000 = 0-1000)
    expect(stats.genomeCoverage).toBeCloseTo(100, 1);
    expect(stats.totalAlignedBases).toBe(1000);

    // Mean identity is weighted by alignment length, NOT unique bases
    // (90*600 + 95*600) / (600+600) = 92.5
    expect(stats.meanIdentity).toBeCloseTo(92.5, 1);
  });

  it('should filter by minimum identity', () => {
    const hits = [
      makeHit(0, 500, 90, 500),   // passes
      makeHit(500, 1000, 60, 500)  // fails minIdentity=70
    ];
    const stats = computeRingStats(hits, 1000, 70, 50);

    expect(stats.genomeCoverage).toBeCloseTo(50, 1);
    expect(stats.meanIdentity).toBeCloseTo(90, 1);
  });

  it('should filter by minimum alignment length', () => {
    const hits = [
      makeHit(0, 500, 90, 500),  // passes
      makeHit(500, 520, 99, 20)  // fails minLength=50
    ];
    const stats = computeRingStats(hits, 1000, 70, 50);

    expect(stats.genomeCoverage).toBeCloseTo(50, 1);
    expect(stats.totalAlignedBases).toBe(500);
  });

  it('should clamp hits that extend beyond reference', () => {
    const hits = [makeHit(900, 1200, 90, 300)];
    const stats = computeRingStats(hits, 1000, 70, 50);

    // Only 900-1000 = 100 bases should count for coverage
    expect(stats.totalAlignedBases).toBe(100);
    expect(stats.genomeCoverage).toBeCloseTo(10, 1);
  });

  it('should handle multiple non-overlapping hits', () => {
    const hits = [
      makeHit(0, 100, 95, 100),
      makeHit(200, 300, 85, 100),
      makeHit(400, 500, 90, 100)
    ];
    const stats = computeRingStats(hits, 1000, 70, 50);

    expect(stats.totalAlignedBases).toBe(300);
    expect(stats.genomeCoverage).toBeCloseTo(30, 1);
    // Weighted mean: (95*100 + 85*100 + 90*100) / 300 = 90
    expect(stats.meanIdentity).toBeCloseTo(90, 1);
  });

  it('should handle hits at boundary of reference', () => {
    const hits = [makeHit(0, 0, 90, 0)];
    const stats = computeRingStats(hits, 1000, 70, 0);

    // Zero-length hit
    expect(stats.totalAlignedBases).toBe(0);
  });

  it('should work with realistic genome-scale numbers', () => {
    // Simulate a typical E. coli comparison: ~90% coverage at ~85% identity
    const refLength = 5_000_000;
    const hits: AlignmentHit[] = [];

    // Create 100 large hits covering ~90% of the genome
    for (let i = 0; i < 100; i++) {
      const start = Math.floor(i * 50_000 * 0.9);
      const end = start + 45_000;
      hits.push(makeHit(start, end, 80 + Math.random() * 20, end - start));
    }

    const stats = computeRingStats(hits, refLength, 70, 50);

    expect(stats.genomeCoverage).toBeGreaterThan(0);
    expect(stats.genomeCoverage).toBeLessThanOrEqual(100);
    expect(stats.meanIdentity).toBeGreaterThan(70);
    expect(stats.meanIdentity).toBeLessThanOrEqual(100);
  });
});

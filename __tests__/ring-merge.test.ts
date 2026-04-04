/**
 * Tests for ring merging logic when adding new rings after initial alignment.
 *
 * Regression test for bug: when running alignment, then adding a new ring
 * and running again, the new ring's data was lost in the final merge because
 * the merge only iterated over cached rings and never appended new ones.
 */

import { describe, it, expect } from 'vitest';
import type { RingData } from '@/lib/types';

function createRing(name: string, hitCount: number): RingData {
  return {
    queryId: `ring-${name}`,
    queryName: name,
    color: '#000000',
    visible: true,
    hits: Array.from({ length: hitCount }, (_, i) => ({
      queryName: 'q',
      refStart: i * 1000,
      refEnd: (i + 1) * 1000,
      queryStart: 0,
      queryEnd: 1000,
      percentIdentity: 90,
      alignmentLength: 1000,
      strand: '+' as const
    })),
    statistics: { meanIdentity: 90, genomeCoverage: 50, totalAlignedBases: hitCount * 1000 }
  };
}

// Simulates the final merge logic from page.tsx
function finalMerge(
  cachedRings: RingData[] | undefined,
  resultRings: RingData[],
  ringAnnotations: Record<string, any[]>
): RingData[] {
  const hasExistingRings = cachedRings && cachedRings.length > 0;

  let finalRings: RingData[];
  if (hasExistingRings) {
    // Update existing cached rings with new alignment data
    finalRings = cachedRings.map(existingRing => {
      const newRingData = resultRings.find(r => r.queryName === existingRing.queryName);
      if (newRingData) {
        return {
          ...existingRing,
          hits: newRingData.hits,
          statistics: newRingData.statistics,
          alignmentOutput: newRingData.alignmentOutput,
          annotations: existingRing.annotations || ringAnnotations[existingRing.queryId] || []
        };
      }
      return existingRing;
    });

    // Append new rings from result that weren't in the cache
    const newRingsToAdd = resultRings.filter(
      newRing => !cachedRings.some(existing => existing.queryName === newRing.queryName)
    );
    if (newRingsToAdd.length > 0) {
      const newRingsWithAnnotations = newRingsToAdd.map(ring => ({
        ...ring,
        annotations: ring.annotations || ringAnnotations[ring.queryId] || []
      }));
      finalRings = [...finalRings, ...newRingsWithAnnotations];
    }
  } else {
    finalRings = resultRings.map(ring => ({
      ...ring,
      annotations: ring.annotations || ringAnnotations[ring.queryId] || []
    }));
  }

  return finalRings;
}

describe('Ring merge: add ring after initial alignment', () => {
  it('should include new ring when cache has existing rings', () => {
    // First run: only Ring 1
    const cachedRings = [createRing('Ring 1', 100)];

    // Second run: Ring 1 (cached) + Ring 3 (new)
    const resultRings = [createRing('Ring 1', 100), createRing('Ring 3', 80)];

    const merged = finalMerge(cachedRings, resultRings, {});

    expect(merged).toHaveLength(2);
    expect(merged[0].queryName).toBe('Ring 1');
    expect(merged[1].queryName).toBe('Ring 3');
    expect(merged[1].hits).toHaveLength(80);
  });

  it('should update existing ring data while adding new rings', () => {
    const cachedRings = [createRing('Ring 1', 50)];

    // Result has updated Ring 1 (more hits) + new Ring 2
    const resultRing1 = createRing('Ring 1', 100);
    const resultRing2 = createRing('Ring 2', 75);

    const merged = finalMerge(cachedRings, [resultRing1, resultRing2], {});

    expect(merged).toHaveLength(2);
    expect(merged[0].queryName).toBe('Ring 1');
    expect(merged[0].hits).toHaveLength(100); // Updated
    expect(merged[1].queryName).toBe('Ring 2');
    expect(merged[1].hits).toHaveLength(75);
  });

  it('should preserve annotations on existing rings', () => {
    const cachedRing = createRing('Ring 1', 50);
    cachedRing.annotations = [
      { id: 'ann-1', start: 100, end: 200, label: 'Gene1', shape: 'block' as const }
    ];

    const resultRings = [createRing('Ring 1', 100), createRing('Ring 2', 60)];

    const merged = finalMerge([cachedRing], resultRings, {});

    expect(merged[0].annotations).toHaveLength(1);
    expect(merged[0].annotations![0].label).toBe('Gene1');
    expect(merged[0].hits).toHaveLength(100); // Updated hits
  });

  it('should work when cache is empty (first run)', () => {
    const resultRings = [createRing('Ring 1', 100), createRing('Ring 2', 80)];

    const merged = finalMerge(undefined, resultRings, {});

    expect(merged).toHaveLength(2);
  });

  it('should handle adding multiple new rings at once', () => {
    const cachedRings = [createRing('Ring 1', 50)];
    const resultRings = [
      createRing('Ring 1', 50),
      createRing('Ring 2', 60),
      createRing('Ring 3', 70),
      createRing('Ring 4', 80)
    ];

    const merged = finalMerge(cachedRings, resultRings, {});

    expect(merged).toHaveLength(4);
    expect(merged.map(r => r.queryName)).toEqual(['Ring 1', 'Ring 2', 'Ring 3', 'Ring 4']);
  });

  it('should keep cached rings that are not in new result (removed from pipeline but still displayed)', () => {
    // User had Ring 1 + Ring 2, removed Ring 2's files but it still has cached data
    const cachedRings = [createRing('Ring 1', 50), createRing('Ring 2', 40)];

    // Only Ring 1 was re-run (Ring 2 had no files)
    const resultRings = [createRing('Ring 1', 100)];

    const merged = finalMerge(cachedRings, resultRings, {});

    expect(merged).toHaveLength(2);
    expect(merged[0].hits).toHaveLength(100); // Updated
    expect(merged[1].hits).toHaveLength(40);  // Preserved from cache
  });
});

describe('Ring merge: graph ring data isolation', () => {
  it('should not leak graphPoints from a graph ring to adjacent alignment rings', () => {
    // Simulate: Ring 1 = alignment, Ring 2 = graph, Ring 3 = alignment
    const ring1 = createRing('Ring 1', 100);
    const ring2: RingData = {
      ...createRing('Ring 2', 0),
      graphPoints: [{ start: 0, end: 1000, value: 50 }],
      graphMaxValue: 50,
    };
    const ring3 = createRing('Ring 3', 80);

    const resultRings = [ring1, ring2, ring3];
    const merged = finalMerge(undefined, resultRings, {});

    expect(merged).toHaveLength(3);

    // Ring 1 should have hits, no graphPoints
    expect(merged[0].hits).toHaveLength(100);
    expect(merged[0].graphPoints).toBeUndefined();

    // Ring 2 should have graphPoints, no hits
    expect(merged[1].graphPoints).toHaveLength(1);
    expect(merged[1].hits).toHaveLength(0);

    // Ring 3 should have hits, no graphPoints
    expect(merged[2].hits).toHaveLength(80);
    expect(merged[2].graphPoints).toBeUndefined();
  });

  it('should preserve graphPoints during merge with cached rings', () => {
    const cachedRings = [
      createRing('Ring 1', 50),
      {
        ...createRing('Ring 2', 0),
        graphPoints: [{ start: 0, end: 1000, value: 50 }],
        graphMaxValue: 50,
      },
    ];

    const resultRings = [
      createRing('Ring 1', 100),
      {
        ...createRing('Ring 2', 0),
        graphPoints: [{ start: 0, end: 1000, value: 50 }],
        graphMaxValue: 50,
      },
    ];

    const merged = finalMerge(cachedRings, resultRings, {});

    expect(merged).toHaveLength(2);
    expect(merged[0].graphPoints).toBeUndefined();
    expect(merged[1].graphPoints).toHaveLength(1);
  });
});

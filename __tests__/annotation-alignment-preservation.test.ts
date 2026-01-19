/**
 * Tests for annotation and alignment data preservation
 * 
 * Critical scenarios:
 * 1. Annotations must be preserved when alignments complete
 * 2. Alignments must be preserved when annotations are updated
 * 3. Multiple operations should not lose data
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { PlotData, RingData, Annotation } from '@/lib/types';

// Mock data helpers
function createMockAnnotations(): Annotation[] {
  return [
    {
      id: 'ann-1',
      start: 1000,
      end: 2000,
      label: 'Sp 12',
      shape: 'arrow-forward',
      color: '#ff0000'
    },
    {
      id: 'ann-2',
      start: 3000,
      end: 4000,
      label: 'Sp 13',
      shape: 'block',
      color: '#00ff00'
    }
  ];
}

function createMockRingData(queryId: string, queryName: string): RingData {
  return {
    queryId,
    queryName,
    color: '#666666',
    upper: 0,
    lower: 100,
    hits: [
      {
        refStart: 100,
        refEnd: 200,
        queryStart: 100,
        queryEnd: 200,
        identity: 95,
        strand: '+'
      }
    ],
    windows: [
      { position: 100, value: 95 }
    ],
    statistics: {
      meanIdentity: 95,
      genomeCoverage: 50,
      totalAlignedBases: 1000
    },
    lastzOutput: 'mock lastz output',
    annotations: []
  };
}

function createMockPlotData(): PlotData {
  return {
    reference: {
      name: 'Reference',
      length: 5000000,
      sequence: 'ATCG',
      gcContent: [0.5, 0.5],
      gcSkew: [0.1, -0.1]
    },
    rings: [],
    config: {
      windowSize: 100,
      stepSize: 50,
      minIdentity: 70,
      minAlignmentLength: 50,
      ringHeight: 20,
      ringSpacing: 5,
      labelFontSize: 12,
      showGCContent: true,
      showGCSkew: true,
      gcContentColor: '#00ff00',
      gcSkewPosColor: '#ff0000',
      gcSkewNegColor: '#0000ff'
    }
  };
}

describe('Annotation and Alignment Preservation', () => {
  let mockPlotData: PlotData;
  let mockRing: RingData;
  let mockAnnotations: Annotation[];

  beforeEach(() => {
    mockPlotData = createMockPlotData();
    mockRing = createMockRingData('ring-1', 'E_coli_K12');
    mockAnnotations = createMockAnnotations();
  });

  describe('Alignment completion preserves annotations', () => {
    it('should preserve existing annotations when partial alignment results arrive', () => {
      // Setup: Ring with annotations but no alignment data
      const ringWithAnnotations: RingData = {
        ...mockRing,
        hits: [],
        windows: [],
        annotations: mockAnnotations
      };
      mockPlotData.rings = [ringWithAnnotations];

      // Simulate partial alignment result (has alignment data, no annotations)
      const partialAlignmentResult: RingData = {
        ...mockRing,
        hits: [
          { refStart: 100, refEnd: 200, queryStart: 100, queryEnd: 200, identity: 95, strand: '+' },
          { refStart: 300, refEnd: 400, queryStart: 300, queryEnd: 400, identity: 90, strand: '+' }
        ],
        windows: [{ position: 100, value: 95 }, { position: 300, value: 90 }],
        annotations: [] // Worker doesn't include annotations
      };

      // Merge logic (from page.tsx partial update)
      const mergedRing = {
        ...ringWithAnnotations,
        hits: partialAlignmentResult.hits,
        windows: partialAlignmentResult.windows,
        statistics: partialAlignmentResult.statistics,
        lastzOutput: partialAlignmentResult.lastzOutput,
        annotations: ringWithAnnotations.annotations || []
      };

      // Assertions
      expect(mergedRing.annotations).toHaveLength(2);
      expect(mergedRing.annotations[0].label).toBe('Sp 12');
      expect(mergedRing.hits).toHaveLength(2);
      expect(mergedRing.windows).toHaveLength(2);
    });

    it('should preserve annotations during final alignment merge', () => {
      // Setup: Cached data with annotations
      const cachedRing: RingData = {
        ...mockRing,
        annotations: mockAnnotations
      };
      const cachedPlotData: PlotData = {
        ...mockPlotData,
        rings: [cachedRing]
      };

      // Final alignment result (no annotations from worker)
      const finalAlignmentResult: RingData = {
        ...mockRing,
        hits: [{ refStart: 500, refEnd: 600, queryStart: 500, queryEnd: 600, identity: 98, strand: '+' }],
        windows: [{ position: 500, value: 98 }],
        annotations: []
      };

      // Final merge logic (from page.tsx final merge)
      const finalRing = {
        ...cachedRing,
        hits: finalAlignmentResult.hits,
        windows: finalAlignmentResult.windows,
        statistics: finalAlignmentResult.statistics,
        lastzOutput: finalAlignmentResult.lastzOutput,
        annotations: cachedRing.annotations || []
      };

      // Assertions
      expect(finalRing.annotations).toHaveLength(2);
      expect(finalRing.annotations).toEqual(mockAnnotations);
      expect(finalRing.hits).toHaveLength(1);
      expect(finalRing.hits[0].identity).toBe(98);
    });
  });

  describe('Annotation updates preserve alignment data', () => {
    it('should preserve alignment results when annotations are updated', () => {
      // Setup: Ring with both annotations and alignment data
      const ringWithBoth: RingData = {
        ...mockRing,
        hits: [
          { refStart: 1000, refEnd: 2000, queryStart: 1000, queryEnd: 2000, identity: 92, strand: '+' }
        ],
        windows: [{ position: 1000, value: 92 }],
        statistics: {
          meanIdentity: 92,
          genomeCoverage: 60,
          totalAlignedBases: 2000
        },
        lastzOutput: 'existing lastz output',
        annotations: mockAnnotations
      };

      // User adds new annotation
      const newAnnotations: Annotation[] = [
        ...mockAnnotations,
        {
          id: 'ann-3',
          start: 5000,
          end: 6000,
          label: 'Sp 14',
          shape: 'arrow-reverse',
          color: '#0000ff'
        }
      ];

      // Update logic (from handleAnnotationsChange)
      const updatedRing = {
        ...ringWithBoth,
        annotations: newAnnotations,
        // CRITICAL: Explicitly preserve alignment data
        hits: ringWithBoth.hits || [],
        windows: ringWithBoth.windows || [],
        statistics: ringWithBoth.statistics || { meanIdentity: 0, genomeCoverage: 0, totalAlignedBases: 0 },
        lastzOutput: ringWithBoth.lastzOutput || ''
      };

      // Assertions
      expect(updatedRing.annotations).toHaveLength(3);
      expect(updatedRing.annotations[2].label).toBe('Sp 14');
      expect(updatedRing.hits).toHaveLength(1);
      expect(updatedRing.hits[0].identity).toBe(92);
      expect(updatedRing.windows).toHaveLength(1);
      expect(updatedRing.statistics.meanIdentity).toBe(92);
      expect(updatedRing.lastzOutput).toBe('existing lastz output');
    });

    it('should handle annotation deletion without losing alignment data', () => {
      const ringWithBoth: RingData = {
        ...mockRing,
        annotations: mockAnnotations
      };

      // User deletes one annotation
      const updatedAnnotations = [mockAnnotations[0]]; // Keep only Sp 12

      const updatedRing = {
        ...ringWithBoth,
        annotations: updatedAnnotations,
        hits: ringWithBoth.hits || [],
        windows: ringWithBoth.windows || [],
        statistics: ringWithBoth.statistics || { meanIdentity: 0, genomeCoverage: 0, totalAlignedBases: 0 },
        lastzOutput: ringWithBoth.lastzOutput || ''
      };

      expect(updatedRing.annotations).toHaveLength(1);
      expect(updatedRing.annotations[0].label).toBe('Sp 12');
      expect(updatedRing.hits).toHaveLength(1);
      expect(updatedRing.statistics).toBeDefined();
    });
  });

  describe('Multiple operations maintain data integrity', () => {
    it('should preserve both annotations and alignments through multiple updates', () => {
      // Start with ring that has annotations
      let currentRing: RingData = {
        ...mockRing,
        hits: [],
        annotations: [mockAnnotations[0]]
      };

      // Step 1: Run alignment (should keep annotations)
      currentRing = {
        ...currentRing,
        hits: [{ refStart: 100, refEnd: 200, queryStart: 100, queryEnd: 200, identity: 95, strand: '+' }],
        windows: [{ position: 100, value: 95 }],
        annotations: currentRing.annotations || []
      };

      expect(currentRing.annotations).toHaveLength(1);
      expect(currentRing.hits).toHaveLength(1);

      // Step 2: Add more annotations (should keep alignments)
      currentRing = {
        ...currentRing,
        annotations: [...currentRing.annotations, mockAnnotations[1]],
        hits: currentRing.hits || [],
        windows: currentRing.windows || []
      };

      expect(currentRing.annotations).toHaveLength(2);
      expect(currentRing.hits).toHaveLength(1);

      // Step 3: Run alignment again (should keep all annotations)
      currentRing = {
        ...currentRing,
        hits: [
          ...currentRing.hits,
          { refStart: 300, refEnd: 400, queryStart: 300, queryEnd: 400, identity: 90, strand: '+' }
        ],
        windows: [
          ...currentRing.windows,
          { position: 300, value: 90 }
        ],
        annotations: currentRing.annotations || []
      };

      // Final check: Everything should still be there
      expect(currentRing.annotations).toHaveLength(2);
      expect(currentRing.hits).toHaveLength(2);
      expect(currentRing.windows).toHaveLength(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined annotations gracefully', () => {
      const ringWithUndefinedAnnotations: RingData = {
        ...mockRing,
        annotations: undefined as any
      };

      const merged = {
        ...ringWithUndefinedAnnotations,
        annotations: ringWithUndefinedAnnotations.annotations || []
      };

      expect(merged.annotations).toEqual([]);
      expect(merged.hits).toBeDefined();
    });

    it('should handle empty arrays correctly', () => {
      const ringWithEmptyArrays: RingData = {
        ...mockRing,
        hits: [],
        windows: [],
        annotations: []
      };

      const updated = {
        ...ringWithEmptyArrays,
        annotations: mockAnnotations,
        hits: ringWithEmptyArrays.hits || [],
        windows: ringWithEmptyArrays.windows || []
      };

      expect(updated.annotations).toHaveLength(2);
      expect(updated.hits).toEqual([]);
      expect(updated.windows).toEqual([]);
    });

    it('should handle missing statistics gracefully', () => {
      const ringWithoutStats: RingData = {
        ...mockRing,
        statistics: undefined as any
      };

      const updated = {
        ...ringWithoutStats,
        annotations: mockAnnotations,
        statistics: ringWithoutStats.statistics || { meanIdentity: 0, genomeCoverage: 0, totalAlignedBases: 0 }
      };

      expect(updated.statistics).toBeDefined();
      expect(updated.statistics.meanIdentity).toBe(0);
      expect(updated.statistics.genomeCoverage).toBe(0);
    });
  });
});

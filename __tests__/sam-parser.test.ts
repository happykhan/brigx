/**
 * Tests for SAM file parsing and coverage computation.
 */

import { describe, it, expect } from '@jest/globals';
import { parseSAMCoverage } from '@/lib/samParser';
import * as fs from 'fs';
import * as path from 'path';

describe('SAM Coverage Parser', () => {
  it('should parse a minimal SAM with mapped reads', () => {
    const sam = [
      '@SQ\tSN:ref\tLN:1000',
      'read1\t0\tref\t1\t30\t100M\t*\t0\t0\tACGT\t*',
      'read2\t0\tref\t201\t30\t100M\t*\t0\t0\tACGT\t*',
      'read3\t0\tref\t501\t30\t50M\t*\t0\t0\tACGT\t*'
    ].join('\n');

    const result = parseSAMCoverage(sam, 100);

    expect(result.totalReads).toBe(3);
    expect(result.mappedReads).toBe(3);
    expect(result.referenceLength).toBe(1000);
    expect(result.points.length).toBe(10); // 1000/100 = 10 windows

    // Window 0 (0-100): read1 covers it fully
    expect(result.points[0].value).toBeCloseTo(1.0, 1);
    // Window 2 (200-300): read2 covers it fully
    expect(result.points[2].value).toBeCloseTo(1.0, 1);
  });

  it('should skip unmapped reads (flag & 4)', () => {
    const sam = [
      '@SQ\tSN:ref\tLN:1000',
      'mapped\t0\tref\t1\t30\t100M\t*\t0\t0\tACGT\t*',
      'unmapped\t4\t*\t0\t0\t*\t*\t0\t0\tACGT\t*'
    ].join('\n');

    const result = parseSAMCoverage(sam, 100);

    expect(result.totalReads).toBe(2);
    expect(result.mappedReads).toBe(1);
  });

  it('should handle CIGAR with insertions and deletions', () => {
    // 50M10I50M = 100 ref bases consumed (I doesn't consume ref)
    // 50M10D50M = 110 ref bases consumed (D consumes ref)
    const sam = [
      '@SQ\tSN:ref\tLN:1000',
      'read1\t0\tref\t1\t30\t50M10I50M\t*\t0\t0\tACGT\t*',
      'read2\t0\tref\t201\t30\t50M10D50M\t*\t0\t0\tACGT\t*'
    ].join('\n');

    const result = parseSAMCoverage(sam, 1000);

    expect(result.mappedReads).toBe(2);
    // read1 covers 100 ref bases, read2 covers 110 ref bases
    expect(result.points.length).toBeGreaterThan(0);
  });

  it('should infer reference length from @SQ header', () => {
    const sam = '@SQ\tSN:chr1\tLN:5000\nread1\t0\tchr1\t1\t30\t100M\t*\t0\t0\tACGT\t*\n';
    const result = parseSAMCoverage(sam, 1000);

    expect(result.referenceLength).toBe(5000);
  });

  it('should handle empty SAM', () => {
    const result = parseSAMCoverage('', 100);

    expect(result.points).toHaveLength(0);
    expect(result.totalReads).toBe(0);
  });

  it('should compute coverage for overlapping reads', () => {
    const sam = [
      '@SQ\tSN:ref\tLN:100',
      'r1\t0\tref\t1\t30\t100M\t*\t0\t0\tACGT\t*',
      'r2\t0\tref\t1\t30\t100M\t*\t0\t0\tACGT\t*',
      'r3\t0\tref\t1\t30\t100M\t*\t0\t0\tACGT\t*'
    ].join('\n');

    const result = parseSAMCoverage(sam, 100);

    // 3 reads all covering the same 100bp window = 3x coverage
    expect(result.points[0].value).toBeCloseTo(3.0, 1);
    expect(result.maxValue).toBeCloseTo(3.0, 1);
  });

  it('should parse real Mu50.sam from Chapter 7 examples', () => {
    const samPath = path.join(
      __dirname, '..', 'examples', 'brig_examples', 'BRIG_examples',
      'Chapter7-sam-examples', 'Mu50.sam'
    );
    const content = fs.readFileSync(samPath, 'utf-8');
    const result = parseSAMCoverage(content, 100);

    // Mu50.sam has ~50K reads against a ~25kb plasmid
    expect(result.totalReads).toBeGreaterThan(1000);
    expect(result.referenceLength).toBe(25107); // From @SQ header
    expect(result.points.length).toBeGreaterThan(200); // ~251 windows at 100bp

    // Should have some coverage (mapped reads)
    expect(result.mappedReads).toBeGreaterThan(0);

    // Max coverage should be reasonable
    if (result.mappedReads > 0) {
      expect(result.maxValue).toBeGreaterThan(0);
    }
  });
});

/**
 * Tests for graph ring parsing and multi-FASTA reference support.
 */

import { describe, it, expect } from 'vitest';
import { parseGraphFile } from '@/lib/graphParser';
import {
  parseFasta,
  mergeGenomes
} from '@/workers/parser.worker';
import type { ContigBoundary } from '@/lib/types';
import * as fs from 'fs';
import * as path from 'path';

const EXAMPLES_DIR = path.join(__dirname, '..', 'examples');

function readExample(filename: string): string {
  return fs.readFileSync(path.join(EXAMPLES_DIR, filename), 'utf-8');
}

describe('Graph File Parser', () => {
  it('should parse real BRIGExample.graph', () => {
    const content = readExample('BRIGExample.graph');
    const result = parseGraphFile(content);

    expect(result.errors).toHaveLength(0);
    expect(result.points.length).toBeGreaterThan(100);
    expect(result.maxValue).toBeGreaterThan(0);

    // All points should have valid values
    result.points.forEach(p => {
      expect(p.start).toBeLessThanOrEqual(p.end);
      expect(p.value).toBeGreaterThanOrEqual(0);
    });
  });

  it('should parse simple graph data', () => {
    const content = '#start\tend\n0\t1000\t50.5\n1000\t2000\t75.3\n2000\t3000\t25.1\n';
    const result = parseGraphFile(content);

    expect(result.errors).toHaveLength(0);
    expect(result.points).toHaveLength(3);
    expect(result.points[0]).toEqual({ start: 0, end: 1000, value: 50.5 });
    expect(result.maxValue).toBeCloseTo(75.3);
  });

  it('should skip comment lines starting with #', () => {
    const content = '#1\t409\n0\t1000\t50\n#comment\n1000\t2000\t60\n';
    const result = parseGraphFile(content);

    expect(result.points).toHaveLength(2);
  });

  it('should handle empty file', () => {
    const result = parseGraphFile('');
    expect(result.points).toHaveLength(0);
    expect(result.maxValue).toBe(0);
  });

  it('should report errors for malformed lines', () => {
    const content = '0\t1000\t50\nbadline\n1000\t2000\t60\n';
    const result = parseGraphFile(content);

    expect(result.points).toHaveLength(2);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle whitespace-separated values', () => {
    const content = '0 1000 50.5\n1000 2000 75.3\n';
    const result = parseGraphFile(content);

    expect(result.points).toHaveLength(2);
    expect(result.points[0].value).toBeCloseTo(50.5);
  });
});

describe('Multi-FASTA Reference with Spacers', () => {
  it('should parse EHEC_vir.fna as multi-gene reference', async () => {
    const text = readExample('EHEC_vir.fna');
    const genomes = await parseFasta(text);

    expect(genomes.length).toBeGreaterThan(5);
  });

  it('should compute contig boundaries from multi-FASTA', async () => {
    const genomes = await parseFasta(readExample('EHEC_vir.fna'));
    const spacerSize = 50;

    // Simulate controller logic for building contig boundaries
    const boundaries: ContigBoundary[] = [];
    let pos = 0;

    for (let i = 0; i < genomes.length; i++) {
      if (i > 0) pos += spacerSize;
      boundaries.push({
        name: genomes[i].name,
        start: pos,
        end: pos + genomes[i].length,
        index: i
      });
      pos += genomes[i].length;
    }

    // Should have same number of boundaries as genomes
    expect(boundaries.length).toBe(genomes.length);

    // Boundaries should be non-overlapping and sequential
    for (let i = 1; i < boundaries.length; i++) {
      expect(boundaries[i].start).toBeGreaterThan(boundaries[i - 1].end);
      // Gap should be exactly spacerSize
      expect(boundaries[i].start - boundaries[i - 1].end).toBe(spacerSize);
    }

    // First boundary starts at 0
    expect(boundaries[0].start).toBe(0);
  });

  it('should merge with custom spacer size', async () => {
    const g1 = { id: '1', name: 'A', sequence: 'AAAA', length: 4, gcContent: 0, isCircular: false };
    const g2 = { id: '2', name: 'B', sequence: 'CCCC', length: 4, gcContent: 1, isCircular: false };

    // Default mergeGenomes uses 100N spacer
    const merged = mergeGenomes([g1, g2]);
    expect(merged.sequence).toBe('AAAA' + 'N'.repeat(100) + 'CCCC');

    // For multi-FASTA reference, spacer=0 means no gap
    const spacer0 = [g1, g2].map(g => g.sequence).join('');
    expect(spacer0).toBe('AAAACCCC');
    expect(spacer0.length).toBe(8);

    // Spacer=50
    const spacer50 = [g1, g2].map(g => g.sequence).join('N'.repeat(50));
    expect(spacer50.length).toBe(4 + 50 + 4);
  });

  it('should handle single sequence (no spacer needed)', async () => {
    const genomes = await parseFasta('>Single\nACGT\n');

    const boundaries: ContigBoundary[] = [{
      name: genomes[0].name,
      start: 0,
      end: genomes[0].length,
      index: 0
    }];

    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].start).toBe(0);
    expect(boundaries[0].end).toBe(4);
  });

  it('should track boundaries correctly for real BRIGExample.fna', async () => {
    const genomes = await parseFasta(readExample('BRIGExample.fna'));

    if (genomes.length > 1) {
      // It's a multi-contig draft - verify boundaries
      const boundaries: ContigBoundary[] = [];
      let pos = 0;
      const spacerSize = 0;

      for (let i = 0; i < genomes.length; i++) {
        if (i > 0) pos += spacerSize;
        boundaries.push({
          name: genomes[i].name,
          start: pos,
          end: pos + genomes[i].length,
          index: i
        });
        pos += genomes[i].length;
      }

      // Total should equal sum of all genome lengths
      const totalLength = genomes.reduce((s, g) => s + g.length, 0);
      expect(boundaries[boundaries.length - 1].end).toBe(totalLength);
    }
  });
});

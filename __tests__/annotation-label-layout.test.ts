import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { Annotation } from '@/lib/types';
import { extractGenBankFeatures } from '@/lib/featureParser';
import { layoutAnnotationLabels } from '@/lib/rendering/annotationGeometry';

const REFERENCE_LENGTH = 5_000_000;

function annotationsAroundGenome(count: number): Annotation[] {
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor(index * REFERENCE_LENGTH / count) + 1;
    return {
      id: `trna-${index}`,
      start,
      end: start + 80,
      label: `trn${index}`,
      shape: 'arrow-forward',
    };
  });
}

describe('annotation label layout', () => {
  it('keeps sparse labels and their leaders on the feature side of the plot', () => {
    const layouts = layoutAnnotationLabels(
      annotationsAroundGenome(12),
      REFERENCE_LENGTH,
      500,
      500,
      430,
      14,
    );

    expect(layouts.size).toBe(12);
    for (const layout of layouts.values()) {
      expect(Math.cos(layout.midAngle) * Math.cos(layout.adjustedAngle)).toBeGreaterThanOrEqual(0);
    }
  });

  it('selects a readable subset for a dense tRNA set without crossing the centre', () => {
    const annotations = annotationsAroundGenome(120);
    const layouts = layoutAnnotationLabels(
      annotations,
      REFERENCE_LENGTH,
      500,
      500,
      430,
      14,
    );

    expect(layouts.size).toBeGreaterThan(20);
    expect(layouts.size).toBeLessThan(annotations.length);

    for (const layout of layouts.values()) {
      const featureX = 500 + 400 * Math.cos(layout.midAngle);
      expect((featureX - 500) * (layout.labelX - 500)).toBeGreaterThanOrEqual(0);
    }
  });

  it('lays out the 105 real E. coli Sakai tRNAs without centre-crossing leaders', () => {
    const genbank = fs.readFileSync(
      path.join(process.cwd(), 'examples/E_coli_O157H7Sakai.gbk'),
      'utf8',
    );
    const annotations = extractGenBankFeatures(genbank, 'tRNA');
    const layouts = layoutAnnotationLabels(
      annotations,
      5_498_450,
      500,
      500,
      430,
      14,
    );

    expect(annotations).toHaveLength(105);
    expect(layouts.size).toBeGreaterThan(20);
    expect(layouts.size).toBeLessThan(annotations.length);
    for (const layout of layouts.values()) {
      expect(Math.cos(layout.midAngle) * Math.cos(layout.adjustedAngle)).toBeGreaterThanOrEqual(0);
    }
  });
});

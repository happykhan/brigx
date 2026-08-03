import { describe, expect, it } from 'vitest';
import {
  createResultSnapshot,
  parseResultSnapshot,
  parseResultSnapshotJson,
  resultSnapshotFilename,
} from '@/lib/resultSnapshot';
import type { CircularPlotData } from '@/lib/types';

const plot: CircularPlotData = {
  reference: { name: 'reference.fa', length: 1200 },
  rings: [],
  config: { minIdentity: 70, minAlignmentLength: 1000 },
};

const imageConfig = {
  title: 'Example comparison',
  innerRadius: 200,
  ringWidth: 20,
  gcRingWidth: 40,
  ringSpacing: 4,
  legendFontSize: 16,
  scaleFontSize: 12,
  titleFontSize: 24,
  labelFontSize: 14,
};

describe('BRIGX result snapshots', () => {
  it('creates a versioned portable result containing the rendered plot', () => {
    const snapshot = createResultSnapshot(plot, imageConfig);
    const reparsed = parseResultSnapshotJson(JSON.stringify(snapshot));

    expect(reparsed.type).toBe('brigx-result');
    expect(reparsed.schemaVersion).toBe(1);
    expect(reparsed.title).toBe('Example comparison');
    expect(reparsed.plot).toEqual(plot);
    expect(resultSnapshotFilename(reparsed)).toBe('example-comparison.brigx-result.json');
  });

  it('accepts the original checked-in publication shape', () => {
    const snapshot = parseResultSnapshot({
      schemaVersion: 1,
      createdAt: '2026-08-03T13:40:07.938Z',
      title: 'Legacy result',
      plot,
      imageConfig,
    });

    expect(snapshot.title).toBe('Legacy result');
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.createdAt).toBe(Date.parse('2026-08-03T13:40:07.938Z'));
  });

  it('rejects incomplete and unsupported results', () => {
    expect(() => parseResultSnapshot({ title: 'Missing plot', imageConfig })).toThrow('Invalid BRIGX result file');
    expect(() => parseResultSnapshot({
      ...createResultSnapshot(plot, imageConfig),
      schemaVersion: 2,
    })).toThrow('Unsupported BRIGX result version');
  });
});

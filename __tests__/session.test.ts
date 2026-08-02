/**
 * Tests for session save/load and profile import/export.
 */

import { describe, it, expect } from 'vitest';
import { exportSession, importSession, exportProfile, importProfile } from '@/lib/session';
import type { PipelineParams, Annotation } from '@/lib/types';

const mockParams: PipelineParams = {
  minIdentity: 70,
  minAlignmentLength: 100,
  colorScheme: 'blue-red',
  forceAlignment: false,
  alignerOptions: '-W 28'
};

const mockImageConfig = {
  title: 'Test Image',
  innerRadius: 150,
  ringWidth: 24,
  gcRingWidth: 20,
  ringSpacing: 2,
  legendFontSize: 10,
  scaleFontSize: 10,
  titleFontSize: 18,
  labelFontSize: 9
};

describe('Session Export/Import', () => {
  it('should export and re-import a session', () => {
    const rings = [
      {
        id: 'ring-1',
        legendText: 'K12',
        color: '#ff0000',
        upperThreshold: 90,
        lowerThreshold: 70,
        files: [{ name: 'K12.fna' } as File]
      },
      {
        id: 'ring-2',
        legendText: 'CFT073',
        color: '#0000ff',
        upperThreshold: 90,
        lowerThreshold: 70,
        files: [{ name: 'CFT073.fna' } as File, { name: 'UTI89.fna' } as File]
      }
    ];

    const annotations: Record<string, Annotation[]> = {
      'ring-1': [
        { id: 'ann-1', start: 100, end: 200, label: 'Gene1', shape: 'arrow-forward', color: '#ff0000' }
      ]
    };

    const json = exportSession('0.2.0', 'reference.fna', rings, annotations, mockParams, mockImageConfig);
    const session = importSession(json);

    expect(session.version).toBe('0.2.0');
    expect(session.referenceFileName).toBe('reference.fna');
    expect(session.rings).toHaveLength(2);
    expect(session.rings[0].legendText).toBe('K12');
    expect(session.rings[0].fileNames).toEqual(['K12.fna']);
    expect(session.rings[1].fileNames).toEqual(['CFT073.fna', 'UTI89.fna']);
    expect(session.rings[0].annotations).toHaveLength(1);
    expect(session.rings[0].annotations[0].label).toBe('Gene1');
    expect(session.params.minIdentity).toBe(70);
    expect(session.params.alignerOptions).toBe('-W 28');
    expect(session.imageConfig.title).toBe('Test Image');
  });

  it('should reject invalid session JSON', () => {
    expect(() => importSession('{}')).toThrow('Invalid BRIGX session file');
    expect(() => importSession('not json')).toThrow();
    expect(() => importSession(JSON.stringify({
      version: '0.2.0',
      timestamp: Date.now(),
      referenceFileName: 'ref.fna',
      rings: [{ id: 'ring-1' }],
      params: mockParams,
      imageConfig: mockImageConfig,
    }))).toThrow('Invalid BRIGX session file');
  });

  it('should include timestamp', () => {
    const json = exportSession('0.2.0', 'ref.fna', [], {}, mockParams, mockImageConfig);
    const session = importSession(json);

    expect(session.timestamp).toBeGreaterThan(0);
    expect(session.timestamp).toBeLessThanOrEqual(Date.now());
  });
});

describe('Profile Export/Import', () => {
  it('should export and re-import a profile', () => {
    const json = exportProfile('0.2.0', mockImageConfig);
    const config = importProfile(json);

    expect(config.title).toBe('Test Image');
    expect(config.innerRadius).toBe(150);
    expect(config.ringWidth).toBe(24);
  });

  it('should reject invalid profile JSON', () => {
    expect(() => importProfile('{}')).toThrow('Invalid BRIGX profile file');
    expect(() => importProfile('{"imageConfig":{"title":"Incomplete"}}')).toThrow('Invalid BRIGX profile file');
  });
});

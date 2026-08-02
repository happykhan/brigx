import { describe, expect, it } from 'vitest';
import { buildDesktopProjectRequest, restoreDesktopFiles } from '@/lib/desktopBridge';
import type { BRIGXSession } from '@/lib/session';

const imageConfig = {
  innerRadius: 200,
  ringWidth: 20,
  gcRingWidth: 40,
  ringSpacing: 4,
  legendFontSize: 16,
  scaleFontSize: 12,
  titleFontSize: 24,
  labelFontSize: 14,
  title: '',
};

const session: BRIGXSession = {
  version: '1.0.0',
  timestamp: 1,
  referenceFileName: 'reference.fa',
  rings: [{
    id: 'ring-1',
    legendText: 'Query',
    color: '#123456',
    upperThreshold: 90,
    lowerThreshold: 70,
    fileNames: ['query.fa'],
    annotations: [],
  }],
  params: {
    minIdentity: 70,
    minAlignmentLength: 10,
    colorScheme: 'blue-red',
    forceAlignment: false,
  },
  imageConfig,
};

describe('desktop renderer bridge', () => {
  it('restores File objects and preserves opaque main-process tokens when re-saving', () => {
    const restored = restoreDesktopFiles(session, [
      {
        role: 'reference',
        token: 'reference-token',
        name: 'reference.fa',
        type: 'text/plain',
        size: 6,
        lastModified: 1,
        bytes: new TextEncoder().encode('>r\nAC\n'),
      },
      {
        role: 'ring',
        ringId: 'ring-1',
        token: 'ring-token',
        name: 'query.fa',
        type: 'text/plain',
        size: 6,
        lastModified: 2,
        bytes: new TextEncoder().encode('>q\nAC\n'),
      },
    ]);

    const request = buildDesktopProjectRequest({
      appVersion: '1.0.0',
      referenceFile: restored.referenceFile,
      rings: restored.rings,
      ringAnnotations: {},
      params: session.params,
      imageProperties: imageConfig,
      referenceAnnotations: [],
      plotData: null,
    });

    expect(request.files.map(file => file.token)).toEqual(['reference-token', 'ring-token']);
    expect(restored.rings[0].files[0].name).toBe('query.fa');
  });
});

import { describe, expect, it } from 'vitest';
import { buildPlotScene, selectDisplayedPlotData } from '@/lib/plotScene';
import type { CircularPlotData } from '@/lib/types';
import type { RenderConfig } from '@/lib/rendering/types';

const config: RenderConfig = {
  width: 1000,
  height: 800,
  innerRadius: 200,
  ringWidth: 20,
  gcRingWidth: 40,
  ringSpacing: 4,
  minIdentity: 70,
  maxIdentity: 100,
  legendFontSize: 16,
  scaleFontSize: 12,
  titleFontSize: 24,
  labelFontSize: 14,
  title: '',
};

function plot(): CircularPlotData {
  return {
    reference: {
      name: 'reference',
      length: 10_000,
      gcContent: [0.4, 0.6],
      gcSkew: [-0.2, 0.2],
      features: [{ type: 'CDS', start: 100, end: 200, strand: '+', name: 'feature' }],
      annotations: [{ id: 'reference-note', start: 300, end: 400, label: 'note', shape: 'block' }],
      contigs: [
        { name: 'one', start: 0, end: 5_000, index: 0 },
        { name: 'two', start: 5_000, end: 10_000, index: 1 },
      ],
    },
    rings: [
      {
        queryId: 'alignment',
        queryName: 'Alignment',
        color: '#3366cc',
        visible: true,
        customWidth: 30,
        hits: [
          {
            queryName: 'Alignment',
            refStart: 100,
            refEnd: 1_000,
            queryStart: 1,
            queryEnd: 901,
            percentIdentity: 95,
            alignmentLength: 900,
            strand: '+',
          },
          {
            queryName: 'Alignment',
            refStart: 200,
            refEnd: 300,
            queryStart: 1,
            queryEnd: 101,
            percentIdentity: 99,
            alignmentLength: 100,
            strand: '+',
          },
        ],
        annotations: [{ id: 'ring-note', start: 500, end: 600, label: 'ring note', shape: 'block' }],
        statistics: { meanIdentity: 0, genomeCoverage: 0, totalAlignedBases: 0 },
      },
      {
        queryId: 'hidden',
        queryName: 'Hidden',
        color: '#ff0000',
        visible: false,
        hits: [],
        statistics: { meanIdentity: 0, genomeCoverage: 0, totalAlignedBases: 0 },
      },
      {
        queryId: 'graph',
        queryName: 'Graph',
        color: '#00aa00',
        visible: true,
        hits: [],
        graphPoints: [{ start: 0, end: 1_000, value: 5 }],
        graphMaxCap: 4,
        statistics: { meanIdentity: 0, genomeCoverage: 0, totalAlignedBases: 0 },
      },
    ],
    config: { minIdentity: 70, minAlignmentLength: 100 },
  };
}

describe('buildPlotScene', () => {
  it('creates one ordered track plan for both rendering backends', () => {
    const scene = buildPlotScene(plot(), config);

    expect(scene).toMatchObject({
      width: 1000,
      height: 800,
      centerX: 500,
      centerY: 400,
      referenceLength: 10_000,
    });
    expect(scene.referenceAnnotations.map(annotation => annotation.label)).toEqual(['feature', 'note']);
    expect(scene.gcContent?.layout).toMatchObject({ type: 'gc-content', radius: 204, width: 40 });
    expect(scene.gcSkew?.layout).toMatchObject({ type: 'gc-skew', radius: 248, width: 40 });
    expect(scene.rings.map(track => ({
      id: track.ring.queryId,
      type: track.layout.type,
      radius: track.layout.radius,
      width: track.layout.width,
    }))).toEqual([
      { id: 'alignment', type: 'alignment', radius: 292, width: 30 },
      { id: 'graph', type: 'graph', radius: 326, width: 20 },
    ]);
    expect(scene.rings[0].annotations).toHaveLength(1);
    expect(scene.rings[0].alignmentArcs).toHaveLength(1);
    expect(scene.rings[0].alignmentArcs[0]).toMatchObject({
      innerRadius: 292,
      outerRadius: 322,
      fill: 'rgb(85, 128, 213)',
      identity: 95,
    });
    expect(scene.rings[1].graphArcs[0]).toMatchObject({
      innerRadius: 326,
      outerRadius: 346,
      fill: 'rgb(30, 100, 220)',
      value: 5,
    });
    expect(scene.contigLayout).toMatchObject({ type: 'contig', radius: 350, width: 6 });
    expect(scene.contigArcs.map(arc => arc.fill)).toEqual(['#ef4444', '#3b82f6']);
    expect(scene.scaleMarkers).toHaveLength(12);
    expect(scene.gcContent?.arcs).toHaveLength(2);
    expect(scene.gcSkew?.arcs).toHaveLength(2);
    expect(scene.gcLegend?.sections.map(section => section.title)).toEqual([
      'GC Content',
      'GC Skew',
    ]);
    expect(scene.ringLegend?.sections.map(section => ({
      kind: section.kind,
      title: section.title,
    }))).toEqual([
      { kind: 'gradient', title: 'Alignment' },
      { kind: 'swatch', title: 'Graph' },
    ]);
  });

  it('removes absent GC tracks without leaving radial gaps', () => {
    const data = plot();
    data.reference.gcContent = undefined;
    const scene = buildPlotScene(data, config);

    expect(scene.gcContent).toBeNull();
    expect(scene.gcSkew?.layout).toMatchObject({ radius: 200 });
    expect(scene.rings[0].layout).toMatchObject({ radius: 244 });
    expect(scene.gcLegend?.sections.map(section => section.title)).toEqual(['GC Skew']);
  });

  it('retains the exact interactive view state', () => {
    const viewState = {
      zoom: 1.5,
      panX: 20,
      panY: -10,
      gcLegendPos: { x: 50, y: 60 },
      ringLegendPos: { x: 700, y: 80 },
    };

    const scene = buildPlotScene(plot(), config, viewState);

    expect(scene.viewState).toBe(viewState);
    expect(scene.gcLegend?.bounds).toMatchObject({ x: 45, y: 60 });
    expect(scene.ringLegend?.bounds).toMatchObject({ x: 695, y: 80 });
  });

  it('omits all legend geometry when legends are disabled', () => {
    const scene = buildPlotScene(plot(), { ...config, showLegend: false });

    expect(scene.gcLegend).toBeNull();
    expect(scene.ringLegend).toBeNull();
  });
});

describe('selectDisplayedPlotData', () => {
  it('hides GC tracks without mutating or discarding the source analysis', () => {
    const source = plot();
    const displayed = selectDisplayedPlotData(source, {
      showGCContent: false,
      showGCSkew: true,
    });

    expect(displayed.reference.gcContent).toBeUndefined();
    expect(displayed.reference.gcSkew).toEqual([-0.2, 0.2]);
    expect(source.reference.gcContent).toEqual([0.4, 0.6]);
    expect(source.reference.gcSkew).toEqual([-0.2, 0.2]);
  });
});

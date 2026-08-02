import { describe, expect, it } from 'vitest';
import { CircularPlotRenderer } from '@/lib/renderer';
import type { CircularPlotData } from '@/lib/types';

const plotData: CircularPlotData = {
  reference: {
    name: 'reference',
    length: 10_000,
    gcContent: [0.4, 0.6],
    gcSkew: [-0.2, 0.2],
    features: [
      { type: 'CDS', start: 100, end: 900, strand: '+', name: 'reference-gene' },
    ],
  },
  rings: [
    {
      queryId: 'ring-1',
      queryName: 'Query One',
      color: '#3366cc',
      visible: true,
      hits: [
        {
          queryName: 'Query One',
          refStart: 100,
          refEnd: 1_000,
          queryStart: 1,
          queryEnd: 901,
          percentIdentity: 95,
          alignmentLength: 900,
          strand: '+',
        },
      ],
      annotations: [
        { id: 'ann-1', start: 2_000, end: 2_500, label: 'ring-gene', shape: 'block' },
      ],
      statistics: { meanIdentity: 95, genomeCoverage: 9, totalAlignedBases: 900 },
    },
  ],
  config: { minIdentity: 70, minAlignmentLength: 100 },
};

function createRenderer() {
  return new CircularPlotRenderer({
    width: 1000,
    height: 1000,
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
    title: 'BRIGX test',
  });
}

describe('editable SVG export', () => {
  it('preserves preview transform and dragged legend coordinates', () => {
    const container = document.createElement('div');
    const svg = createRenderer().render(container, plotData, {
      zoom: 1.5,
      panX: 25,
      panY: -15,
      gcLegendPos: { x: 40, y: 50 },
      ringLegendPos: { x: 700, y: 60 },
    });

    expect(svg.querySelector('#main-content')?.getAttribute('transform')).toBe(
      'translate(525, 485) scale(1.5) translate(-500, -500)',
    );
    expect(svg.querySelector('#gc-legend rect')?.getAttribute('x')).toBe('35');
    expect(svg.querySelector('#ring-legend rect')?.getAttribute('x')).toBe('695');
  });

  it('exports named Inkscape groups, top-level gradients, and reference features', () => {
    const container = document.createElement('div');
    const renderer = createRenderer();
    const svg = renderer.render(container, plotData);
    const exported = renderer.exportSVG();

    expect(svg.getAttribute('xmlns:inkscape')).toBe('http://www.inkscape.org/namespaces/inkscape');
    expect(svg.querySelector('#defs')?.querySelectorAll('linearGradient').length).toBeGreaterThan(0);
    expect(svg.querySelector('#ring-ring-1')?.getAttribute('inkscape:label')).toBe('Ring: Query One');
    expect(svg.querySelector('#annotations-ring-1')?.getAttribute('inkscape:label')).toBe('Annotations: Query One');
    expect(svg.querySelector('#reference-annotations')?.textContent).toContain('reference-gene');
    expect(svg.querySelector('#title-group')?.textContent).toContain('BRIGX test');
    expect(exported).toContain('xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"');
  });
});

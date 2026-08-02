import { describe, expect, it } from 'vitest';
import { INITIAL_PLOT_STATE, plotStateReducer } from '../lib/plotState';
import type { CircularPlotData, RingConfig, RingData } from '../lib/types';

function ring(id: string, hitCount = 0): RingData {
  return {
    queryId: id,
    queryName: `Ring ${id}`,
    color: '#112233',
    visible: true,
    hits: Array.from({ length: hitCount }, (_, index) => ({
      queryName: id,
      refStart: index,
      refEnd: index + 1,
      queryStart: index,
      queryEnd: index + 1,
      percentIdentity: 99,
      alignmentLength: 1,
      strand: '+',
    })),
    statistics: { meanIdentity: 99, genomeCoverage: 10, totalAlignedBases: hitCount },
  };
}

function plot(rings: RingData[]): CircularPlotData {
  return {
    reference: { name: 'reference', length: 1000, gcContent: [0.5] },
    rings,
    config: { minIdentity: 70, minAlignmentLength: 1000 },
  };
}

function config(id: string, color = '#abcdef'): RingConfig {
  return {
    id,
    legendText: `Configured ${id}`,
    files: [],
    color,
    upperThreshold: 90,
    lowerThreshold: 70,
  };
}

describe('plotStateReducer', () => {
  it('keeps a single committed/displayed object after replacement and configuration', () => {
    const initial = plotStateReducer(INITIAL_PLOT_STATE, {
      type: 'replace',
      data: plot([ring('a', 2)]),
    });
    const configured = plotStateReducer(initial, {
      type: 'configure',
      rings: [config('a')],
      annotationsByRing: {},
    });

    expect(configured.displayed).toBe(configured.committed);
    expect(configured.displayed?.rings[0]).toMatchObject({
      queryId: 'a',
      queryName: 'Configured a',
      color: '#abcdef',
    });
    expect(configured.displayed?.rings[0].hits).toHaveLength(2);
  });

  it('shows partial results without changing the complete baseline', () => {
    const baseline = plot([ring('a', 0), ring('b', 0)]);
    const state = plotStateReducer(
      { committed: baseline, displayed: baseline },
      { type: 'partial', data: { rings: [ring('a', 3)] }, annotationsByRing: {} },
    );

    expect(state.committed).toBe(baseline);
    expect(state.committed?.rings[0].hits).toHaveLength(0);
    expect(state.displayed?.rings[0].hits).toHaveLength(3);
    expect(state.displayed?.rings[1].queryId).toBe('b');
  });

  it('applies presentation changes without discarding a partial result', () => {
    const baseline = plot([ring('a', 0)]);
    const partial = plot([ring('a', 3)]);
    const state = plotStateReducer(
      { committed: baseline, displayed: partial },
      { type: 'configure', rings: [config('a', '#ff0000')], annotationsByRing: {} },
    );

    expect(state.committed?.rings[0].hits).toHaveLength(0);
    expect(state.displayed?.rings[0].hits).toHaveLength(3);
    expect(state.displayed?.rings[0].color).toBe('#ff0000');
  });

  it('commits final results atomically and preserves local annotations', () => {
    const baseline = plot([ring('a')]);
    const annotation = {
      id: 'feature-1',
      start: 10,
      end: 20,
      label: 'gene',
      shape: 'arrow-forward' as const,
    };
    const state = plotStateReducer(
      { committed: baseline, displayed: baseline },
      {
        type: 'commit',
        data: { ...plot([ring('a', 4)]), config: { minIdentity: 85, minAlignmentLength: 500 } },
        annotationsByRing: { a: [annotation] },
      },
    );

    expect(state.displayed).toBe(state.committed);
    expect(state.committed?.rings[0].hits).toHaveLength(4);
    expect(state.committed?.rings[0].annotations).toEqual([annotation]);
    expect(state.committed?.config).toEqual({ minIdentity: 85, minAlignmentLength: 500 });
  });

  it('updates annotations in both baseline and a distinct partial display', () => {
    const baseline = plot([ring('a')]);
    const partial = plot([ring('a', 2)]);
    const annotation = {
      id: 'feature-1',
      start: 10,
      end: 20,
      label: 'gene',
      shape: 'block' as const,
    };
    const state = plotStateReducer(
      { committed: baseline, displayed: partial },
      { type: 'annotations', ringId: 'a', annotations: [annotation] },
    );

    expect(state.committed?.rings[0].annotations).toEqual([annotation]);
    expect(state.displayed?.rings[0].annotations).toEqual([annotation]);
    expect(state.displayed?.rings[0].hits).toHaveLength(2);
  });

  it('keeps companion reference annotations across partial plot updates', () => {
    const baseline = plot([ring('a')]);
    const annotation = {
      id: 'reference-feature',
      start: 25,
      end: 75,
      label: 'reference gene',
      shape: 'arrow-forward' as const,
    };
    const annotated = plotStateReducer(
      { committed: baseline, displayed: baseline },
      { type: 'reference-annotations', annotations: [annotation] },
    );
    const partial = plotStateReducer(annotated, {
      type: 'partial',
      data: { reference: { name: 'reference', length: 1000 }, rings: [ring('a', 2)] },
      annotationsByRing: {},
    });

    expect(partial.committed?.reference.annotations).toEqual([annotation]);
    expect(partial.displayed?.reference.annotations).toEqual([annotation]);
  });
});

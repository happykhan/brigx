import type { Annotation, CircularPlotData, RingConfig } from './types';
import {
  mergeAlignmentRings,
  synchronizeConfiguredRings,
  updatePlotAnnotations,
  type RingAnnotationMap,
} from './ringState';

export interface PlotState {
  /** Last complete plot. Partial alignment updates never mutate this baseline. */
  committed: CircularPlotData | null;
  /** Plot currently shown to the user, including partial alignment progress. */
  displayed: CircularPlotData | null;
}

export const INITIAL_PLOT_STATE: PlotState = {
  committed: null,
  displayed: null,
};

export type PlotStateAction =
  | { type: 'clear' }
  | { type: 'replace'; data: CircularPlotData }
  | { type: 'annotations'; ringId: string; annotations: readonly Annotation[] }
  | { type: 'reference-annotations'; annotations: readonly Annotation[] }
  | {
      type: 'configure';
      rings: readonly RingConfig[];
      annotationsByRing: RingAnnotationMap;
    }
  | {
      type: 'partial';
      data: Partial<CircularPlotData> & Pick<CircularPlotData, 'rings'>;
      annotationsByRing: RingAnnotationMap;
    }
  | {
      type: 'commit';
      data: CircularPlotData;
      annotationsByRing: RingAnnotationMap;
    };

function configurePlot(
  plot: CircularPlotData,
  rings: readonly RingConfig[],
  annotationsByRing: RingAnnotationMap,
): CircularPlotData {
  return {
    ...plot,
    rings: synchronizeConfiguredRings(plot.rings, rings, annotationsByRing),
  };
}

export function plotStateReducer(state: PlotState, action: PlotStateAction): PlotState {
  switch (action.type) {
    case 'clear':
      return INITIAL_PLOT_STATE;

    case 'replace':
      return { committed: action.data, displayed: action.data };

    case 'annotations': {
      const committed = updatePlotAnnotations(
        state.committed,
        action.ringId,
        action.annotations,
      );
      const displayed = state.displayed === state.committed
        ? committed
        : updatePlotAnnotations(state.displayed, action.ringId, action.annotations);
      return { committed, displayed };
    }

    case 'reference-annotations': {
      const updateReference = (plot: CircularPlotData | null): CircularPlotData | null => (
        plot
          ? {
              ...plot,
              reference: { ...plot.reference, annotations: [...action.annotations] },
            }
          : null
      );
      const committed = updateReference(state.committed);
      const displayed = state.displayed === state.committed
        ? committed
        : updateReference(state.displayed);
      return { committed, displayed };
    }

    case 'configure': {
      if (!state.committed) return state;
      const committed = configurePlot(state.committed, action.rings, action.annotationsByRing);
      const displayed = state.displayed === state.committed
        ? committed
        : state.displayed
          ? configurePlot(state.displayed, action.rings, action.annotationsByRing)
          : committed;
      return { committed, displayed };
    }

    case 'partial': {
      const baseline = state.committed;
      const nextReference = action.data.reference ?? baseline?.reference ?? { name: '', length: 0 };
      const displayed: CircularPlotData = {
        reference: baseline?.reference.annotations
          ? { ...nextReference, annotations: baseline.reference.annotations }
          : nextReference,
        rings: mergeAlignmentRings(baseline?.rings, action.data.rings, action.annotationsByRing),
        config: action.data.config ?? baseline?.config ?? {
          minIdentity: 70,
          minAlignmentLength: 1000,
        },
      };
      return { ...state, displayed };
    }

    case 'commit': {
      const committed: CircularPlotData = state.committed
        ? {
            ...state.committed,
            config: action.data.config,
            rings: mergeAlignmentRings(
              state.committed.rings,
              action.data.rings,
              action.annotationsByRing,
            ),
          }
        : {
            ...action.data,
            rings: mergeAlignmentRings(undefined, action.data.rings, action.annotationsByRing),
          };
      return { committed, displayed: committed };
    }
  }
}

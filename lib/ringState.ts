import type { Annotation, CircularPlotData, RingConfig, RingData } from './types';

export type RingAnnotationMap = Readonly<Record<string, readonly Annotation[]>>;

const EMPTY_STATISTICS = {
  meanIdentity: 0,
  genomeCoverage: 0,
  totalAlignedBases: 0,
};

function annotationsFor(
  ring: RingData,
  annotationsByRing: RingAnnotationMap,
  fallback?: readonly Annotation[],
): Annotation[] {
  return [...(annotationsByRing[ring.queryId] ?? ring.annotations ?? fallback ?? [])];
}

/** Apply editable ring settings without discarding alignment or graph data. */
export function synchronizeConfiguredRings(
  existingRings: readonly RingData[],
  ringConfigs: readonly RingConfig[],
  annotationsByRing: RingAnnotationMap,
): RingData[] {
  const existingById = new Map(existingRings.map(ring => [ring.queryId, ring]));

  return ringConfigs.map(config => {
    const existing = existingById.get(config.id);
    const configured = {
      queryId: config.id,
      queryName: config.legendText,
      color: config.color,
      visible: true,
      customWidth: config.customWidth,
      upperThreshold: config.upperThreshold,
      lowerThreshold: config.lowerThreshold,
      graphMaxCap: config.graphMaxCap,
      showLabels: config.showLabels,
    };

    if (!existing) {
      return {
        ...configured,
        hits: [],
        annotations: [...(annotationsByRing[config.id] ?? [])],
        statistics: { ...EMPTY_STATISTICS },
      };
    }

    return {
      ...existing,
      ...configured,
      annotations: annotationsFor(existing, annotationsByRing),
    };
  });
}

/**
 * Merge fresh alignment payloads into the displayed rings.
 *
 * Ring identity is the immutable query ID, never the user-editable legend.
 * Presentation settings and annotations stay local; computed alignment and
 * graph fields come from the newest result when that result provides them.
 */
export function mergeAlignmentRings(
  existingRings: readonly RingData[] | undefined,
  incomingRings: readonly RingData[],
  annotationsByRing: RingAnnotationMap,
): RingData[] {
  const existing = existingRings ?? [];
  const incomingById = new Map(incomingRings.map(ring => [ring.queryId, ring]));

  const merged = existing.map(current => {
    const incoming = incomingById.get(current.queryId);
    if (!incoming) {
      return {
        ...current,
        annotations: annotationsFor(current, annotationsByRing),
      };
    }

    return {
      ...current,
      hits: incoming.hits,
      statistics: incoming.statistics,
      alignmentOutput: incoming.alignmentOutput,
      graphPoints: incoming.graphPoints ?? current.graphPoints,
      graphMaxValue: incoming.graphMaxValue ?? current.graphMaxValue,
      graphStats: incoming.graphStats ?? current.graphStats,
      annotations: annotationsFor(current, annotationsByRing, incoming.annotations),
    };
  });

  const existingIds = new Set(existing.map(ring => ring.queryId));
  for (const incoming of incomingRings) {
    if (!existingIds.has(incoming.queryId)) {
      merged.push({
        ...incoming,
        annotations: annotationsFor(incoming, annotationsByRing),
      });
    }
  }

  return merged;
}

/** Replace one ring's annotations while leaving all computed data untouched. */
export function updatePlotAnnotations(
  plotData: CircularPlotData | null,
  ringId: string,
  annotations: readonly Annotation[],
): CircularPlotData | null {
  if (!plotData) return null;

  return {
    ...plotData,
    rings: plotData.rings.map(ring => (
      ring.queryId === ringId
        ? { ...ring, annotations: [...annotations] }
        : ring
    )),
  };
}

import { getReferenceCdsIndex } from "./referenceCdsIndex";
import type { AlignmentHit, CircularPlotData, ReferenceGap, RingData } from "./types";

interface Interval {
  start: number;
  end: number;
}

const coverageCache = new WeakMap<readonly AlignmentHit[], readonly Interval[]>();
const MAX_GAP_CDS = 5;

function getCoveredIntervals(hits: readonly AlignmentHit[]): readonly Interval[] {
  const cached = coverageCache.get(hits);
  if (cached) return cached;

  const sorted = hits
    .filter((hit) => Number.isFinite(hit.refStart) && Number.isFinite(hit.refEnd) && hit.refEnd > hit.refStart)
    .map((hit) => ({ start: Math.max(0, hit.refStart), end: hit.refEnd }))
    .sort((left, right) => left.start - right.start);
  const merged: Interval[] = [];

  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end);
    }
    else {
      merged.push({ ...interval });
    }
  }

  coverageCache.set(hits, merged);
  return merged;
}

/** Find the last interval whose start is at or before the position, or -1. */
function findIntervalBeforePosition(intervals: readonly Interval[], position: number): number {
  let low = 0;
  let high = intervals.length;

  while (low < high) {
    const middle = (low + high) >>> 1;
    if (intervals[middle].start <= position) low = middle + 1;
    else high = middle;
  }

  return low - 1;
}

/** One cached interval index per hits array; no gap arcs, DOM nodes, or per-CDS handlers. */
export interface GapLookup {
  at(position: number): ReferenceGap | null;
}

export function createGapLookup(ring: RingData, reference: CircularPlotData["reference"]): GapLookup | null {
  // Empty editor/annotation-only rings have no alignment evidence to inspect.
  if (!ring.hits.length && ring.alignmentOutput === undefined) return null;

  const intervals = getCoveredIntervals(ring.hits);
  const cdsIndex = getReferenceCdsIndex(reference);
  let lastGap: Omit<ReferenceGap, "position"> | null = null;

  return {
    at(position) {
      if (position < 0 || position >= reference.length) return null;

      const previousIndex = findIntervalBeforePosition(intervals, position);
      const previous = intervals[previousIndex];
      if (previous && position < previous.end) return null;

      let start = previous?.end ?? 0;
      let end = Math.min(reference.length, intervals[previousIndex + 1]?.start ?? reference.length);
      let contigName: string | undefined;

      if (reference.contigs?.length) {
        const contigIndex = findIntervalBeforePosition(reference.contigs, position);
        const contig = reference.contigs[contigIndex];
        if (!contig || position >= contig.end) return null; // Synthetic reference spacer.
        start = Math.max(start, contig.start);
        end = Math.min(end, contig.end);
        contigName = contig.name;
      }

      if (!lastGap || lastGap.start !== start + 1 || lastGap.end !== end) {
        const cds = cdsIndex.findOverlaps(start, end, MAX_GAP_CDS + 1);
        lastGap = {
          type: "gap",
          queryName: ring.queryName,
          name: reference.name,
          contigName,
          start: start + 1,
          end,
          length: end - start,
          cds: cds.slice(0, MAX_GAP_CDS),
          moreCds: cds.length > MAX_GAP_CDS,
          hasCds: cdsIndex.hasCds,
        };
      }

      return { ...lastGap, position: Math.floor(position) + 1 };
    },
  };
}

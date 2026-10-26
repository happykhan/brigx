import type { AlignmentHit, CircularPlotData, ReferenceCDS, RingData } from './types';
import type { PlotTooltip } from './rendering/types';

interface Interval { start: number; end: number }
interface CdsInterval extends Interval { feature: ReferenceCDS }
interface CdsNode { interval: CdsInterval; maxEnd: number; left: CdsNode | null; right: CdsNode | null }

const coverageCache = new WeakMap<readonly AlignmentHit[], readonly Interval[]>();
const cdsCache = new WeakMap<object, {
  cds: unknown; features: unknown; annotations: unknown; tree: CdsNode | null;
}>();

function coveredIntervals(hits: readonly AlignmentHit[]): readonly Interval[] {
  const cached = coverageCache.get(hits);
  if (cached) return cached;
  const sorted = hits.filter(hit => Number.isFinite(hit.refStart) && Number.isFinite(hit.refEnd) && hit.refEnd > hit.refStart)
    .map(hit => ({ start: Math.max(0, hit.refStart), end: hit.refEnd }))
    .sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  coverageCache.set(hits, merged);
  return merged;
}

function buildCdsTree(intervals: CdsInterval[], start = 0, end = intervals.length): CdsNode | null {
  if (start >= end) return null;
  const mid = (start + end) >>> 1;
  const left = buildCdsTree(intervals, start, mid);
  const right = buildCdsTree(intervals, mid + 1, end);
  return { interval: intervals[mid], left, right,
    maxEnd: Math.max(intervals[mid].end, left?.maxEnd ?? 0, right?.maxEnd ?? 0) };
}

function referenceCdsTree(reference: CircularPlotData['reference']): CdsNode | null {
  const key = reference.cds ?? reference.features ?? reference.annotations;
  if (!key) return null;
  const cached = cdsCache.get(key);
  if (cached && cached.cds === reference.cds && cached.features === reference.features
    && cached.annotations === reference.annotations) return cached.tree;
  // Older results and companion CDS files use the existing 1-based annotation model.
  const features: ReferenceCDS[] = [
    ...(reference.cds ?? []),
    ...(reference.features ?? []).filter(feature => feature.type === 'CDS').map(feature => ({
      name: feature.name || feature.product || 'CDS', product: feature.product, strand: feature.strand,
      segments: [{ start: feature.start - 1, end: feature.end }],
    })),
    ...(reference.annotations ?? []).map(annotation => ({
      name: annotation.label, strand: annotation.shape === 'arrow-reverse' ? '-' as const : '+' as const,
      segments: [{ start: annotation.start - 1, end: annotation.end }],
    })),
  ];
  const intervals = features.flatMap(feature => feature.segments.map(segment => ({ ...segment, feature })))
    .filter(interval => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
    .sort((a, b) => a.start - b.start);
  const tree = buildCdsTree(intervals);
  cdsCache.set(key, { cds: reference.cds, features: reference.features, annotations: reference.annotations, tree });
  return tree;
}

function overlappingCds(tree: CdsNode | null, start: number, end: number): ReferenceCDS[] {
  const matches = new Set<ReferenceCDS>();
  const visit = (node: CdsNode | null): void => {
    if (!node || node.maxEnd <= start || matches.size >= 6) return;
    visit(node.left);
    if (node.interval.start >= end) return;
    if (node.interval.end > start) matches.add(node.interval.feature);
    visit(node.right);
  };
  visit(tree);
  return [...matches];
}

/** One cached interval index per hits array; no gap arcs, DOM nodes, or per-CDS handlers. */
export interface GapLookup { at(position: number): PlotTooltip | null }

export function createGapLookup(ring: RingData, reference: CircularPlotData['reference']): GapLookup | null {
  // Empty editor/annotation-only rings have no alignment evidence to inspect.
  if (!ring.hits.length && ring.alignmentOutput === undefined) return null;
  const intervals = coveredIntervals(ring.hits);
  const tree = referenceCdsTree(reference);
  let lastStart = -1;
  let lastEnd = -1;
  let lastCds: ReferenceCDS[] = [];
  return { at(position) {
    if (position < 0 || position >= reference.length) return null;
    let low = 0;
    let high = intervals.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (intervals[mid].start <= position) low = mid + 1;
      else high = mid;
    }
    const previous = intervals[low - 1];
    if (previous && position < previous.end) return null;
    let start = previous?.end ?? 0;
    let end = Math.min(reference.length, intervals[low]?.start ?? reference.length);
    let contigName: string | undefined;
    if (reference.contigs?.length) {
      let left = 0;
      let right = reference.contigs.length;
      while (left < right) {
        const mid = (left + right) >>> 1;
        if (reference.contigs[mid].start <= position) left = mid + 1;
        else right = mid;
      }
      const contig = reference.contigs[left - 1];
      if (!contig || position >= contig.end) return null; // Synthetic reference spacer.
      start = Math.max(start, contig.start);
      end = Math.min(end, contig.end);
      contigName = contig.name;
    }
    if (start !== lastStart || end !== lastEnd) {
      lastCds = overlappingCds(tree, start, end);
      lastStart = start;
      lastEnd = end;
    }
    return {
      type: 'gap', queryName: ring.queryName, name: reference.name, contigName,
      start: start + 1, end, length: end - start, position: Math.floor(position) + 1,
      cds: lastCds.slice(0, 5), moreCds: lastCds.length > 5, hasCds: tree !== null,
    };
  } };
}

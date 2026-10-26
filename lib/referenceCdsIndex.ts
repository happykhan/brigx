import type { CircularPlotData, ReferenceCDS } from "./types";

type ReferenceCdsSources = Pick<CircularPlotData["reference"], "cds" | "features" | "annotations">;
type ReferenceCdsSource = NonNullable<ReferenceCdsSources[keyof ReferenceCdsSources]>;

interface CdsInterval {
  start: number;
  end: number;
  feature: ReferenceCDS;
}

interface CdsNode {
  interval: CdsInterval;
  maxEnd: number;
  left: CdsNode | null;
  right: CdsNode | null;
}

export interface ReferenceCdsIndex {
  hasCds: boolean;
  findOverlaps(start: number, end: number, limit: number): ReferenceCDS[];
}

interface CachedCdsIndex extends ReferenceCdsSources {
  index: ReferenceCdsIndex;
}

const referenceCdsCache = new WeakMap<ReferenceCdsSource, CachedCdsIndex>();
const EMPTY_CDS_INDEX: ReferenceCdsIndex = {
  hasCds: false,
  findOverlaps: () => [],
};

/** Adapt legacy features and companion CDS annotations to the half-open inspection model. */
function collectReferenceCds(reference: ReferenceCdsSources): ReferenceCDS[] {
  const cds = [...(reference.cds ?? [])];

  for (const feature of reference.features ?? []) {
    if (feature.type !== "CDS") continue;
    cds.push({
      name: feature.name || feature.product || "CDS",
      product: feature.product,
      strand: feature.strand,
      segments: [{ start: feature.start - 1, end: feature.end }],
    });
  }

  for (const annotation of reference.annotations ?? []) {
    cds.push({
      name: annotation.label,
      strand: annotation.shape === "arrow-reverse" ? "-" : "+",
      segments: [{ start: annotation.start - 1, end: annotation.end }],
    });
  }

  return cds;
}

function buildCdsTree(intervals: readonly CdsInterval[], start = 0, end = intervals.length): CdsNode | null {
  if (start >= end) return null;

  const middle = (start + end) >>> 1;
  const interval = intervals[middle];
  const left = buildCdsTree(intervals, start, middle);
  const right = buildCdsTree(intervals, middle + 1, end);

  return {
    interval,
    left,
    right,
    maxEnd: Math.max(interval.end, left?.maxEnd ?? 0, right?.maxEnd ?? 0),
  };
}

function findOverlappingCds(tree: CdsNode | null, start: number, end: number, limit: number): ReferenceCDS[] {
  const matches = new Set<ReferenceCDS>();
  const visit = (node: CdsNode | null): void => {
    if (!node || node.maxEnd <= start || matches.size >= limit) return;
    visit(node.left);
    if (matches.size >= limit || node.interval.start >= end) return;
    if (node.interval.end > start) matches.add(node.interval.feature);
    visit(node.right);
  };

  visit(tree);
  return [...matches];
}

/** Cache by source-array identity so zoom, pan and new scene objects reuse the same index. */
export function getReferenceCdsIndex(reference: ReferenceCdsSources): ReferenceCdsIndex {
  const key = reference.cds ?? reference.features ?? reference.annotations;
  if (!key) return EMPTY_CDS_INDEX;

  const cached = referenceCdsCache.get(key);
  if (cached && cached.cds === reference.cds && cached.features === reference.features
    && cached.annotations === reference.annotations) {
    return cached.index;
  }

  const intervals = collectReferenceCds(reference)
    .flatMap((feature) => feature.segments.map((segment) => ({ ...segment, feature })))
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
    .sort((left, right) => left.start - right.start);
  const tree = buildCdsTree(intervals);
  const index: ReferenceCdsIndex = {
    hasCds: tree !== null,
    findOverlaps: (start, end, limit) => findOverlappingCds(tree, start, end, limit),
  };

  referenceCdsCache.set(key, {
    cds: reference.cds,
    features: reference.features,
    annotations: reference.annotations,
    index,
  });
  return index;
}

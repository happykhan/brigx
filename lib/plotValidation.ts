import type {
  AlignmentHit,
  Annotation,
  CircularPlotData,
  ContigBoundary,
  Feature,
  GraphPoint,
  RingData,
} from './types';

export function importPlotData(json: string): CircularPlotData {
  const value: unknown = JSON.parse(json);
  if (!isCircularPlotData(value)) throw new Error('Invalid BRIGX plot data');
  return value;
}

export function isCircularPlotData(value: unknown): value is CircularPlotData {
  if (!isRecord(value) || !isRecord(value.reference) || !isRecord(value.config)) return false;
  const reference = value.reference;
  const config = value.config;
  return typeof reference.name === 'string'
    && isNonNegativeInteger(reference.length)
    && optionalArray(reference.gcContent, isFiniteNumber)
    && optionalArray(reference.gcSkew, isFiniteNumber)
    && optionalArray(reference.features, isFeature)
    && optionalArray(reference.annotations, isAnnotation)
    && optionalArray(reference.contigs, isContig)
    && Array.isArray(value.rings)
    && value.rings.every(isRingData)
    && isFiniteNumber(config.minIdentity)
    && isFiniteNumber(config.minAlignmentLength);
}

function isRingData(value: unknown): value is RingData {
  if (!isRecord(value) || !isRecord(value.statistics)) return false;
  return typeof value.queryId === 'string'
    && typeof value.queryName === 'string'
    && typeof value.color === 'string'
    && typeof value.visible === 'boolean'
    && Array.isArray(value.hits)
    && value.hits.every(isAlignmentHit)
    && optionalArray(value.annotations, isAnnotation)
    && optionalArray(value.graphPoints, isGraphPoint)
    && optionalNumber(value.customWidth)
    && optionalNumber(value.graphMaxValue)
    && optionalNumber(value.graphMaxCap)
    && optionalNumber(value.upperThreshold)
    && optionalNumber(value.lowerThreshold)
    && (value.alignmentOutput === undefined || typeof value.alignmentOutput === 'string')
    && (value.showLabels === undefined || typeof value.showLabels === 'boolean')
    && (
      value.graphStats === undefined
      || (isRecord(value.graphStats)
        && isFiniteNumber(value.graphStats.mean)
        && isFiniteNumber(value.graphStats.q3)
        && isFiniteNumber(value.graphStats.max))
    )
    && isFiniteNumber(value.statistics.meanIdentity)
    && isFiniteNumber(value.statistics.genomeCoverage)
    && isFiniteNumber(value.statistics.totalAlignedBases);
}

function isAlignmentHit(value: unknown): value is AlignmentHit {
  if (!isRecord(value)) return false;
  return typeof value.queryName === 'string'
    && isFiniteNumber(value.refStart)
    && isFiniteNumber(value.refEnd)
    && isFiniteNumber(value.queryStart)
    && isFiniteNumber(value.queryEnd)
    && isFiniteNumber(value.percentIdentity)
    && isFiniteNumber(value.alignmentLength)
    && (value.strand === '+' || value.strand === '-')
    && optionalNumber(value.score);
}

function isAnnotation(value: unknown): value is Annotation {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && isFiniteNumber(value.start)
    && isFiniteNumber(value.end)
    && typeof value.label === 'string'
    && ['arrow-forward', 'arrow-reverse', 'block', 'arc', 'hidden'].includes(String(value.shape))
    && (value.color === undefined || typeof value.color === 'string');
}

function isFeature(value: unknown): value is Feature {
  if (!isRecord(value)) return false;
  return typeof value.type === 'string'
    && isFiniteNumber(value.start)
    && isFiniteNumber(value.end)
    && (value.strand === '+' || value.strand === '-')
    && optionalString(value.name)
    && optionalString(value.product)
    && optionalString(value.color)
    && (
      value.attributes === undefined
      || (isRecord(value.attributes) && Object.values(value.attributes).every(item => typeof item === 'string'))
    );
}

function isContig(value: unknown): value is ContigBoundary {
  if (!isRecord(value)) return false;
  return typeof value.name === 'string'
    && isNonNegativeInteger(value.start)
    && isNonNegativeInteger(value.end)
    && isNonNegativeInteger(value.index);
}

function isGraphPoint(value: unknown): value is GraphPoint {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.start) && isFiniteNumber(value.end) && isFiniteNumber(value.value);
}

function optionalArray<T>(value: unknown, predicate: (item: unknown) => item is T): boolean {
  return value === undefined || (Array.isArray(value) && value.every(predicate));
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || isFiniteNumber(value);
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

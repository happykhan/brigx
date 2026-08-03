import type { ImagePropertiesConfig } from '@/components/ImageProperties';
import type { CircularPlotData } from './types';

export const RESULT_SNAPSHOT_TYPE = 'brigx-result';
export const RESULT_SNAPSHOT_SCHEMA_VERSION = 1;

export interface ResultSnapshot {
  type: typeof RESULT_SNAPSHOT_TYPE;
  schemaVersion: typeof RESULT_SNAPSHOT_SCHEMA_VERSION;
  createdAt: number;
  title: string;
  description?: string;
  plot: CircularPlotData;
  imageConfig: ImagePropertiesConfig;
}

interface LegacyPublication {
  title: string;
  description?: string;
  plot: CircularPlotData;
  imageConfig: ImagePropertiesConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasPlotShape(value: unknown): value is CircularPlotData {
  if (!isRecord(value) || !isRecord(value.reference) || !isRecord(value.config)) return false;
  return typeof value.reference.name === 'string'
    && typeof value.reference.length === 'number'
    && Number.isFinite(value.reference.length)
    && Array.isArray(value.rings)
    && typeof value.config.minIdentity === 'number'
    && typeof value.config.minAlignmentLength === 'number';
}

function hasImageConfigShape(value: unknown): value is ImagePropertiesConfig {
  if (!isRecord(value) || typeof value.title !== 'string') return false;
  const numericFields = [
    'innerRadius', 'ringWidth', 'gcRingWidth', 'ringSpacing',
    'legendFontSize', 'scaleFontSize', 'titleFontSize', 'labelFontSize',
  ];
  return numericFields.every(field => typeof value[field] === 'number' && Number.isFinite(value[field]));
}

export function createResultSnapshot(
  plot: CircularPlotData,
  imageConfig: ImagePropertiesConfig,
): ResultSnapshot {
  return {
    type: RESULT_SNAPSHOT_TYPE,
    schemaVersion: RESULT_SNAPSHOT_SCHEMA_VERSION,
    createdAt: Date.now(),
    title: imageConfig.title.trim() || plot.reference.name || 'BRIGX comparison',
    plot,
    imageConfig,
  };
}

/** Parse both versioned result files and the original checked-in publication format. */
export function parseResultSnapshot(value: unknown): ResultSnapshot {
  if (!isRecord(value)
    || typeof value.title !== 'string'
    || (value.description !== undefined && typeof value.description !== 'string')
    || !hasPlotShape(value.plot)
    || !hasImageConfigShape(value.imageConfig)) {
    throw new Error('Invalid BRIGX result file');
  }

  if (value.type === undefined) {
    if (value.schemaVersion !== undefined && value.schemaVersion !== RESULT_SNAPSHOT_SCHEMA_VERSION) {
      throw new Error('Unsupported BRIGX result version');
    }
    const legacy = value as unknown as LegacyPublication;
    const legacyCreatedAt = typeof value.createdAt === 'string'
      ? Date.parse(value.createdAt)
      : value.createdAt;
    return {
      type: RESULT_SNAPSHOT_TYPE,
      schemaVersion: RESULT_SNAPSHOT_SCHEMA_VERSION,
      createdAt: typeof legacyCreatedAt === 'number' && Number.isFinite(legacyCreatedAt) ? legacyCreatedAt : 0,
      title: legacy.title,
      description: legacy.description,
      plot: legacy.plot,
      imageConfig: legacy.imageConfig,
    };
  }

  if (value.type !== RESULT_SNAPSHOT_TYPE
    || value.schemaVersion !== RESULT_SNAPSHOT_SCHEMA_VERSION
    || typeof value.createdAt !== 'number'
    || !Number.isFinite(value.createdAt)) {
    throw new Error('Unsupported BRIGX result version');
  }

  return value as unknown as ResultSnapshot;
}

export function parseResultSnapshotJson(json: string): ResultSnapshot {
  return parseResultSnapshot(JSON.parse(json));
}

export function resultSnapshotFilename(snapshot: ResultSnapshot): string {
  const slug = snapshot.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'comparison';
  return `${slug}.brigx-result.json`;
}

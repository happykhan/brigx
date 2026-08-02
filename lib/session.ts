// Session save/load for BRIGX
// Saves ring configuration, annotations, image settings, and alignment params
// Does NOT save file contents (too large) - only file names for reference

import type { PipelineParams, Annotation, AnnotationShape, RingConfig } from './types';
import type { ImagePropertiesConfig } from '@/components/ImageProperties';

export interface RingSessionData {
  id: string;
  legendText: string;
  color: string;
  upperThreshold: number;
  lowerThreshold: number;
  customWidth?: number;
  blastType?: 'blastn' | 'blastx';
  showLabels?: boolean;
  graphMaxCap?: number;
  fileNames: string[]; // Original file names (files must be re-loaded)
  annotations: Annotation[];
}

export interface BRIGXSession {
  version: string;
  timestamp: number;
  referenceFileName: string;
  rings: RingSessionData[];
  params: PipelineParams;
  imageConfig: ImagePropertiesConfig;
}

/**
 * Export current session state as JSON string.
 */
export function exportSession(
  version: string,
  referenceFileName: string,
  rings: readonly RingConfig[],
  ringAnnotations: Record<string, Annotation[]>,
  params: PipelineParams,
  imageConfig: ImagePropertiesConfig
): string {
  const session: BRIGXSession = {
    version,
    timestamp: Date.now(),
    referenceFileName,
    rings: rings.map(r => ({
      id: r.id,
      legendText: r.legendText,
      color: r.color,
      upperThreshold: r.upperThreshold,
      lowerThreshold: r.lowerThreshold,
      customWidth: r.customWidth,
      blastType: r.blastType,
      showLabels: r.showLabels,
      graphMaxCap: r.graphMaxCap,
      fileNames: r.files.map(f => f.name),
      annotations: ringAnnotations[r.id] || []
    })),
    params,
    imageConfig
  };

  return JSON.stringify(session, null, 2);
}

/**
 * Import session from JSON string.
 * Returns the session data - caller must re-load files.
 */
export function importSession(json: string): BRIGXSession {
  const session: unknown = JSON.parse(json);
  if (!isSession(session)) {
    throw new Error('Invalid BRIGX session file');
  }

  return session;
}

/**
 * Export only image settings as a reusable profile.
 */
export function exportProfile(
  version: string,
  imageConfig: ImagePropertiesConfig
): string {
  return JSON.stringify({
    type: 'brigx-profile',
    version,
    timestamp: Date.now(),
    imageConfig
  }, null, 2);
}

/**
 * Import image profile from JSON string.
 */
export function importProfile(json: string): ImagePropertiesConfig {
  const data: unknown = JSON.parse(json);
  if (!isRecord(data) || !isImageConfig(data.imageConfig)) {
    throw new Error('Invalid BRIGX profile file');
  }
  return data.imageConfig;
}

const ANNOTATION_SHAPES = new Set<AnnotationShape>([
  'arrow-forward',
  'arrow-reverse',
  'block',
  'arc',
  'hidden',
]);

const IMAGE_NUMBER_FIELDS: ReadonlyArray<keyof ImagePropertiesConfig> = [
  'innerRadius',
  'ringWidth',
  'gcRingWidth',
  'ringSpacing',
  'legendFontSize',
  'scaleFontSize',
  'titleFontSize',
  'labelFontSize',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isAnnotation(value: unknown): value is Annotation {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && isFiniteNumber(value.start)
    && isFiniteNumber(value.end)
    && typeof value.label === 'string'
    && typeof value.shape === 'string'
    && ANNOTATION_SHAPES.has(value.shape as AnnotationShape)
    && (value.color === undefined || typeof value.color === 'string');
}

function isRing(value: unknown): value is RingSessionData {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.legendText === 'string'
    && typeof value.color === 'string'
    && isFiniteNumber(value.upperThreshold)
    && isFiniteNumber(value.lowerThreshold)
    && (value.customWidth === undefined || isFiniteNumber(value.customWidth))
    && (value.graphMaxCap === undefined || isFiniteNumber(value.graphMaxCap))
    && (value.showLabels === undefined || typeof value.showLabels === 'boolean')
    && (value.blastType === undefined || value.blastType === 'blastn' || value.blastType === 'blastx')
    && Array.isArray(value.fileNames)
    && value.fileNames.every(fileName => typeof fileName === 'string')
    && Array.isArray(value.annotations)
    && value.annotations.every(isAnnotation);
}

function isPipelineParams(value: unknown): value is PipelineParams {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.minIdentity)
    && isFiniteNumber(value.minAlignmentLength)
    && typeof value.colorScheme === 'string'
    && typeof value.forceAlignment === 'boolean'
    && (value.alignerOptions === undefined || typeof value.alignerOptions === 'string')
    && (value.spacerSize === undefined || isFiniteNumber(value.spacerSize))
    && (value.blastProgram === undefined || value.blastProgram === 'blastn' || value.blastProgram === 'blastx')
    && (value.showGCContent === undefined || typeof value.showGCContent === 'boolean')
    && (value.showGCSkew === undefined || typeof value.showGCSkew === 'boolean');
}

function isImageConfig(value: unknown): value is ImagePropertiesConfig {
  if (!isRecord(value) || typeof value.title !== 'string') return false;
  return IMAGE_NUMBER_FIELDS.every(field => isFiniteNumber(value[field]))
    && (value.showLegend === undefined || typeof value.showLegend === 'boolean');
}

function isSession(value: unknown): value is BRIGXSession {
  if (!isRecord(value)) return false;
  return typeof value.version === 'string'
    && value.version.length > 0
    && isFiniteNumber(value.timestamp)
    && typeof value.referenceFileName === 'string'
    && Array.isArray(value.rings)
    && value.rings.every(isRing)
    && isPipelineParams(value.params)
    && isImageConfig(value.imageConfig);
}

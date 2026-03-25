// Session save/load for BRIGX
// Saves ring configuration, annotations, image settings, and alignment params
// Does NOT save file contents (too large) - only file names for reference

import type { PipelineParams, Annotation } from './types';
import type { ImagePropertiesConfig } from '@/components/ImageProperties';

export interface RingSessionData {
  id: string;
  legendText: string;
  color: string;
  upperThreshold: number;
  lowerThreshold: number;
  customWidth?: number;
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
  rings: Array<{
    id: string;
    legendText: string;
    color: string;
    upperThreshold: number;
    lowerThreshold: number;
    customWidth?: number;
    files: File[];
  }>,
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
  const session = JSON.parse(json) as BRIGXSession;

  if (!session.version || !session.rings) {
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
  const data = JSON.parse(json);
  if (!data.imageConfig) {
    throw new Error('Invalid BRIGX profile file');
  }
  return data.imageConfig;
}

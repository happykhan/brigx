// Parse annotation files (CSV/TSV format)
import type { Annotation, AnnotationShape } from './types';

export interface ParsedAnnotations {
  annotations: Annotation[];
  errors: string[];
}

// BRIG-compatible colour names
const BRIG_COLOURS: Record<string, string> = {
  default: '#666666',
  red: '#ff0000',
  aqua: '#00ffff',
  black: '#000000',
  blue: '#0000ff',
  fuchsia: '#ff00ff',
  gray: '#808080',
  grey: '#808080',
  green: '#008000',
  lime: '#00ff00',
  maroon: '#800000',
  navy: '#000080',
  olive: '#808000',
  orange: '#ffa500',
  purple: '#800080',
  silver: '#c0c0c0',
  teal: '#008080',
  white: '#ffffff',
  yellow: '#ffff00'
};

// BRIG-compatible decoration values mapped to shapes
const BRIG_DECORATIONS: Record<string, AnnotationShape> = {
  default: 'block',
  arc: 'arc',
  hidden: 'hidden',
  'counterclockwise-arrow': 'arrow-reverse',
  'clockwise-arrow': 'arrow-forward'
};

/**
 * Resolve a colour string to hex.
 * Accepts BRIG colour names, hex codes (#rrggbb), or returns default.
 */
export function resolveColour(colour: string | undefined): string | undefined {
  if (!colour || colour === 'default' || colour.trim() === '') return undefined;
  const lower = colour.trim().toLowerCase();
  if (BRIG_COLOURS[lower]) return BRIG_COLOURS[lower];
  if (/^#[0-9a-f]{3,8}$/i.test(colour.trim())) return colour.trim();
  return undefined;
}

/**
 * Resolve a decoration string to an AnnotationShape.
 */
export function resolveDecoration(decoration: string | undefined): AnnotationShape {
  if (!decoration || decoration.trim() === '') return 'block';
  const lower = decoration.trim().toLowerCase();
  return BRIG_DECORATIONS[lower] || 'block';
}

/**
 * Parse annotation file in CSV or TSV format.
 *
 * Supports BRIG's full 5-column format:
 *   #START  STOP  Label  Colour  Decoration
 *
 * Colour: BRIG colour name or hex code
 * Decoration: default, arc, hidden, counterclockwise-arrow, clockwise-arrow
 *
 * Columns 4 and 5 are optional.
 */
export function parseAnnotationFile(content: string, referenceLength: number): ParsedAnnotations {
  const lines = content.split('\n').filter(line => line.trim());
  const annotations: Annotation[] = [];
  const errors: string[] = [];

  let headerFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    // Check for header line
    if (line.startsWith('#') || line.toLowerCase().includes('start')) {
      headerFound = true;
      continue;
    }

    // Parse data line - try tab first, then comma, then any whitespace
    let parts: string[];
    if (line.includes('\t')) {
      parts = line.split('\t').map(p => p.trim());
    } else if (line.includes(',')) {
      parts = line.split(',').map(p => p.trim());
    } else {
      parts = line.split(/\s+/).filter(p => p);
    }

    // Need at least 2 columns: start, stop (label can be empty)
    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: Expected at least 2 columns (start, stop), got ${parts.length}`);
      continue;
    }

    const start = parseInt(parts[0], 10);
    const stop = parseInt(parts[1], 10);
    const label = parts.length >= 3 ? parts[2] : '';
    const colourStr = parts.length >= 4 ? parts[3] : undefined;
    const decorationStr = parts.length >= 5 ? parts[4] : undefined;

    // Validate numbers
    if (isNaN(start)) {
      errors.push(`Line ${i + 1}: Invalid start position "${parts[0]}"`);
      continue;
    }

    if (isNaN(stop)) {
      errors.push(`Line ${i + 1}: Invalid stop position "${parts[1]}"`);
      continue;
    }

    if (start < 1) {
      errors.push(`Line ${i + 1}: Start position ${start} < 1, will be clamped to 1`);
    }

    if (stop > referenceLength) {
      errors.push(`Line ${i + 1}: Stop position ${stop} > reference length ${referenceLength}, will be clamped`);
    }

    // Wrap values to reference length
    const clampedStart = Math.max(1, Math.min(start, referenceLength));
    const clampedStop = Math.max(1, Math.min(stop, referenceLength));

    const colour = resolveColour(colourStr);
    const shape = resolveDecoration(decorationStr);

    annotations.push({
      id: `ann-${Date.now()}-${i}`,
      start: clampedStart,
      end: clampedStop,
      label: label || `Region ${annotations.length + 1}`,
      shape,
      color: colour || '#666666'
    });
  }

  if (!headerFound && annotations.length === 0) {
    errors.push('No header found. Expected format: #Start\\tStop\\tLabel or Start,Stop,Label');
  }

  return { annotations, errors };
}

/**
 * Export annotations to TSV format (full 5-column BRIG format)
 */
export function exportAnnotationsToTSV(annotations: Annotation[]): string {
  const lines = ['#Start\tStop\tLabel\tColour\tDecoration'];

  const shapeToDecoration: Record<string, string> = {
    'arrow-forward': 'clockwise-arrow',
    'arrow-reverse': 'counterclockwise-arrow',
    'block': 'default',
    'arc': 'arc',
    'hidden': 'hidden'
  };

  annotations.forEach(ann => {
    const colour = ann.color || 'default';
    const decoration = shapeToDecoration[ann.shape] || 'default';
    lines.push(`${ann.start}\t${ann.end}\t${ann.label}\t${colour}\t${decoration}`);
  });

  return lines.join('\n');
}

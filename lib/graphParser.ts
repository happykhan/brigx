// Parse BRIG .graph files (tab-delimited: start, stop, value)
// Also handles the BRIG header format: #start\tstop on its own line
import type { GraphPoint } from './types';

export interface ParsedGraph {
  points: GraphPoint[];
  maxValue: number;
  errors: string[];
}

/**
 * Parse a .graph file in BRIG format.
 *
 * Format:
 *   #start\tstop          (optional header/comment lines starting with #)
 *   start\tstop\tvalue    (data lines with 3 tab-separated values)
 *
 * BRIG .graph files may have comment lines like "#1\t409" which define
 * contig boundaries - these are skipped.
 */
export function parseGraphFile(content: string): ParsedGraph {
  const lines = content.split('\n');
  const points: GraphPoint[] = [];
  const errors: string[] = [];
  let maxValue = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip comment/header lines
    if (line.startsWith('#')) continue;

    const parts = line.split('\t');
    if (parts.length < 3) {
      // Try whitespace split
      const wsParts = line.split(/\s+/);
      if (wsParts.length >= 3) {
        parts.length = 0;
        parts.push(...wsParts);
      } else {
        errors.push(`Line ${i + 1}: Expected 3 columns (start, stop, value), got ${parts.length}`);
        continue;
      }
    }

    const start = parseInt(parts[0], 10);
    const end = parseInt(parts[1], 10);
    const value = parseFloat(parts[2]);

    if (isNaN(start) || isNaN(end) || isNaN(value)) {
      errors.push(`Line ${i + 1}: Invalid number in "${line}"`);
      continue;
    }

    points.push({ start, end, value });
    if (value > maxValue) maxValue = value;
  }

  return { points, maxValue, errors };
}

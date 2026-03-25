// Parse SAM files and compute windowed coverage
// Produces GraphPoint[] suitable for graph ring display
import type { GraphPoint } from './types';

export interface SAMCoverageResult {
  points: GraphPoint[];
  maxValue: number;
  totalReads: number;
  mappedReads: number;
  referenceLength: number;
}

/**
 * Parse a SAM file and compute per-base coverage, then window it.
 *
 * SAM format: tab-separated, columns:
 *   0: QNAME (read name)
 *   1: FLAG
 *   2: RNAME (reference name, * = unmapped)
 *   3: POS (1-based leftmost position)
 *   4: MAPQ
 *   5: CIGAR
 *   6-10: ...
 *
 * @param content - Raw SAM file content
 * @param windowSize - Coverage window size in bp (default: 1)
 * @param referenceLength - Reference length (if known). If 0, inferred from @SQ header or max position.
 */
export function parseSAMCoverage(
  content: string,
  windowSize: number = 1,
  referenceLength: number = 0
): SAMCoverageResult {
  const lines = content.split('\n');
  let refLength = referenceLength;
  let totalReads = 0;
  let mappedReads = 0;

  // First pass: get reference length from @SQ header if not provided
  if (refLength === 0) {
    for (const line of lines) {
      if (line.startsWith('@SQ')) {
        const lnMatch = line.match(/LN:(\d+)/);
        if (lnMatch) {
          refLength = Math.max(refLength, parseInt(lnMatch[1], 10));
        }
      }
      if (!line.startsWith('@')) break;
    }
  }

  // Collect mapped read positions
  const positions: Array<{ start: number; end: number }> = [];

  for (const line of lines) {
    if (!line || line.startsWith('@')) continue;

    const parts = line.split('\t');
    if (parts.length < 6) continue;

    totalReads++;

    const flag = parseInt(parts[1], 10);
    const rname = parts[2];
    const pos = parseInt(parts[3], 10);
    const cigar = parts[5];

    // Skip unmapped reads (flag & 4) or rname = *
    if ((flag & 4) !== 0 || rname === '*' || pos === 0) continue;

    mappedReads++;

    // Calculate alignment length from CIGAR
    const alignLen = cigarToAlignmentLength(cigar);
    const start = pos - 1; // Convert to 0-based
    const end = start + alignLen;

    positions.push({ start, end });

    // Track max position for reference length inference
    if (end > refLength) refLength = end;
  }

  if (refLength === 0) {
    return { points: [], maxValue: 0, totalReads, mappedReads, referenceLength: 0 };
  }

  // Compute per-window coverage
  const numWindows = Math.ceil(refLength / windowSize);
  const coverage = new Float64Array(numWindows);

  for (const { start, end } of positions) {
    const startWindow = Math.floor(start / windowSize);
    const endWindow = Math.min(Math.ceil(end / windowSize), numWindows);

    for (let w = startWindow; w < endWindow; w++) {
      const wStart = w * windowSize;
      const wEnd = Math.min((w + 1) * windowSize, refLength);
      const overlapStart = Math.max(start, wStart);
      const overlapEnd = Math.min(end, wEnd);
      if (overlapEnd > overlapStart) {
        coverage[w] += (overlapEnd - overlapStart) / (wEnd - wStart);
      }
    }
  }

  // Convert to GraphPoints
  let maxValue = 0;
  const points: GraphPoint[] = [];

  for (let i = 0; i < numWindows; i++) {
    const value = coverage[i];
    if (value > maxValue) maxValue = value;
    points.push({
      start: i * windowSize,
      end: Math.min((i + 1) * windowSize, refLength),
      value
    });
  }

  return { points, maxValue, totalReads, mappedReads, referenceLength: refLength };
}

/**
 * Parse CIGAR string to get alignment length on reference.
 * M/D/N/=/X consume reference. I/S/H/P do not.
 */
function cigarToAlignmentLength(cigar: string): number {
  if (cigar === '*') return 0;

  let length = 0;
  const regex = /(\d+)([MIDNSHP=X])/g;
  let match;

  while ((match = regex.exec(cigar)) !== null) {
    const count = parseInt(match[1], 10);
    const op = match[2];

    // These operations consume reference bases
    if ('MDN=X'.includes(op)) {
      length += count;
    }
  }

  return length;
}

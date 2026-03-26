// Parse graph/coverage files in various bioinformatics formats
// Supports: BRIG .graph, BedGraph, Wiggle (variableStep/fixedStep), BED
import type { GraphPoint } from './types';

export interface ParsedGraph {
  points: GraphPoint[];
  maxValue: number;
  errors: string[];
}

/**
 * Auto-detect format and parse graph data.
 *
 * Supported formats:
 * - BRIG .graph: start\tstop\tvalue (3 columns, numeric)
 * - BedGraph: chrom\tstart\tend\tvalue (4 columns, first is string)
 * - BED: chrom\tstart\tend\tname\tscore (5+ columns, score in col 5)
 * - Wiggle variableStep: position\tvalue (with header declaring step type)
 * - Wiggle fixedStep: one value per line (with header declaring start/step)
 */
export function parseGraphFile(content: string): ParsedGraph {
  const lines = content.split('\n');
  const points: GraphPoint[] = [];
  const errors: string[] = [];
  let maxValue = 0;

  // Detect wiggle format
  const firstNonComment = lines.find(l => l.trim() && !l.startsWith('#') && !l.startsWith('track'));
  const isWiggle = lines.some(l => l.startsWith('variableStep') || l.startsWith('fixedStep'));

  if (isWiggle) {
    return parseWiggle(lines);
  }

  // Detect if first data column is a chromosome name (BedGraph/BED) or numeric (BRIG .graph)
  let chromOffset = 0;
  if (firstNonComment) {
    const parts = firstNonComment.split(/\t|\s+/);
    if (parts.length >= 3 && isNaN(parseInt(parts[0], 10))) {
      chromOffset = 1; // First column is chrom name, skip it
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('#') || line.startsWith('track') || line.startsWith('browser')) continue;

    let parts = line.split('\t');
    if (parts.length < 3) {
      const wsParts = line.split(/\s+/);
      if (wsParts.length >= 3) {
        parts = wsParts;
      } else {
        errors.push(`Line ${i + 1}: Expected at least 3 columns, got ${parts.length}`);
        continue;
      }
    }

    let start: number, end: number, value: number;

    if (chromOffset === 1 && parts.length >= 4) {
      // BedGraph: chrom start end value
      // BED: chrom start end name score ...
      start = parseInt(parts[1], 10);
      end = parseInt(parts[2], 10);
      // Value is col 4 for bedgraph, col 5 (score) for BED
      value = parseFloat(parts[3]);
      if (isNaN(value) && parts.length >= 5) {
        value = parseFloat(parts[4]); // Try score column for BED
      }
    } else {
      // BRIG .graph: start end value
      start = parseInt(parts[0], 10);
      end = parseInt(parts[1], 10);
      value = parseFloat(parts[2]);
    }

    if (isNaN(start) || isNaN(end) || isNaN(value)) {
      errors.push(`Line ${i + 1}: Invalid number in "${line}"`);
      continue;
    }

    points.push({ start, end, value });
    if (value > maxValue) maxValue = value;
  }

  return { points, maxValue, errors };
}

/**
 * Parse Wiggle format (variableStep and fixedStep).
 */
function parseWiggle(lines: string[]): ParsedGraph {
  const points: GraphPoint[] = [];
  const errors: string[] = [];
  let maxValue = 0;
  let mode: 'variable' | 'fixed' | null = null;
  let span = 1;
  let fixedStart = 0;
  let fixedStep = 1;
  let fixedIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('track') || line.startsWith('browser')) continue;

    if (line.startsWith('variableStep')) {
      mode = 'variable';
      const spanMatch = line.match(/span=(\d+)/);
      span = spanMatch ? parseInt(spanMatch[1], 10) : 1;
      continue;
    }

    if (line.startsWith('fixedStep')) {
      mode = 'fixed';
      const startMatch = line.match(/start=(\d+)/);
      const stepMatch = line.match(/step=(\d+)/);
      const spanMatch = line.match(/span=(\d+)/);
      fixedStart = startMatch ? parseInt(startMatch[1], 10) : 1;
      fixedStep = stepMatch ? parseInt(stepMatch[1], 10) : 1;
      span = spanMatch ? parseInt(spanMatch[1], 10) : fixedStep;
      fixedIndex = 0;
      continue;
    }

    if (mode === 'variable') {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const pos = parseInt(parts[0], 10);
        const value = parseFloat(parts[1]);
        if (!isNaN(pos) && !isNaN(value)) {
          points.push({ start: pos, end: pos + span, value });
          if (value > maxValue) maxValue = value;
        }
      }
    } else if (mode === 'fixed') {
      const value = parseFloat(line);
      if (!isNaN(value)) {
        const pos = fixedStart + fixedIndex * fixedStep;
        points.push({ start: pos, end: pos + span, value });
        if (value > maxValue) maxValue = value;
        fixedIndex++;
      }
    }
  }

  return { points, maxValue, errors };
}

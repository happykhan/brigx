// Contig mapping: order contigs from a draft assembly onto a reference
// Uses alignment hits to find the best position for each contig
import type { AlignmentHit } from './types';

export interface MappedContig {
  name: string;
  originalIndex: number;
  bestRefStart: number;
  bestRefEnd: number;
  orientation: '+' | '-';
  hitCount: number;
  totalAlignedBases: number;
  meanIdentity: number;
}

/**
 * Map contigs onto a reference using alignment hits.
 *
 * For each contig (identified by queryName), finds the best BLAST hit
 * position on the reference and determines orientation.
 *
 * @param hits - Alignment hits from BLAST (all contigs vs reference)
 * @param contigNames - List of contig names in original order
 * @returns Mapped contigs sorted by best reference position
 */
export function mapContigsToReference(
  hits: AlignmentHit[],
  contigNames: string[]
): MappedContig[] {
  // Group hits by contig name
  const hitsByContig = new Map<string, AlignmentHit[]>();
  for (const hit of hits) {
    const name = hit.queryName;
    if (!hitsByContig.has(name)) hitsByContig.set(name, []);
    hitsByContig.get(name)!.push(hit);
  }

  const mapped: MappedContig[] = [];

  for (let i = 0; i < contigNames.length; i++) {
    const name = contigNames[i];
    const contigHits = hitsByContig.get(name) || [];

    if (contigHits.length === 0) {
      // Unmapped contig
      mapped.push({
        name,
        originalIndex: i,
        bestRefStart: -1,
        bestRefEnd: -1,
        orientation: '+',
        hitCount: 0,
        totalAlignedBases: 0,
        meanIdentity: 0
      });
      continue;
    }

    // Find the best hit (longest alignment)
    let bestHit = contigHits[0];
    for (const hit of contigHits) {
      if (hit.alignmentLength > bestHit.alignmentLength) {
        bestHit = hit;
      }
    }

    // Compute stats
    let totalBases = 0;
    let weightedIdentity = 0;
    let minRef = Infinity;
    let maxRef = -Infinity;

    for (const hit of contigHits) {
      totalBases += hit.alignmentLength;
      weightedIdentity += hit.percentIdentity * hit.alignmentLength;
      minRef = Math.min(minRef, hit.refStart);
      maxRef = Math.max(maxRef, hit.refEnd);
    }

    // Determine orientation from best hit
    const orientation = bestHit.strand;

    mapped.push({
      name,
      originalIndex: i,
      bestRefStart: minRef,
      bestRefEnd: maxRef,
      orientation,
      hitCount: contigHits.length,
      totalAlignedBases: totalBases,
      meanIdentity: totalBases > 0 ? weightedIdentity / totalBases : 0
    });
  }

  // Sort by reference position
  return mapped.sort((a, b) => {
    if (a.bestRefStart === -1 && b.bestRefStart === -1) return 0;
    if (a.bestRefStart === -1) return 1; // Unmapped go to end
    if (b.bestRefStart === -1) return -1;
    return a.bestRefStart - b.bestRefStart;
  });
}

/**
 * Convert graph data from one reference coordinate system to another
 * using BLAST alignments between the two references.
 *
 * @param graphPoints - Original graph points (start, end, value)
 * @param alignmentHits - BLAST hits from original ref (query) vs new ref (database)
 * @param newRefLength - Length of the new reference
 * @param windowSize - Output window size
 */
export function convertGraph(
  graphPoints: Array<{ start: number; end: number; value: number }>,
  alignmentHits: AlignmentHit[],
  newRefLength: number,
  windowSize: number = 1
): Array<{ start: number; end: number; value: number }> {
  // Build a mapping from old coordinates to new coordinates
  // For each alignment hit, we know oldRef[start..end] maps to newRef[refStart..refEnd]
  const numWindows = Math.ceil(newRefLength / windowSize);
  const values = new Float64Array(numWindows);
  const counts = new Float64Array(numWindows);

  for (const hit of alignmentHits) {
    // hit.queryStart..queryEnd = position on OLD reference
    // hit.refStart..refEnd = position on NEW reference
    const oldStart = hit.queryStart;
    const oldEnd = hit.queryEnd;
    const newStart = hit.refStart;
    const newEnd = hit.refEnd;

    // Find graph points that overlap with this alignment region
    for (const point of graphPoints) {
      const overlapStart = Math.max(point.start, oldStart);
      const overlapEnd = Math.min(point.end, oldEnd);

      if (overlapEnd <= overlapStart) continue;

      // Map the overlapping region to new coordinates
      const fraction = (overlapEnd - overlapStart) / (oldEnd - oldStart);
      const mappedStart = newStart + ((overlapStart - oldStart) / (oldEnd - oldStart)) * (newEnd - newStart);
      const mappedEnd = mappedStart + fraction * (newEnd - newStart);

      // Add to output windows
      const startWindow = Math.max(0, Math.floor(mappedStart / windowSize));
      const endWindow = Math.min(numWindows, Math.ceil(mappedEnd / windowSize));

      for (let w = startWindow; w < endWindow; w++) {
        values[w] += point.value;
        counts[w] += 1;
      }
    }
  }

  // Average values where multiple mappings overlap
  const result: Array<{ start: number; end: number; value: number }> = [];
  for (let i = 0; i < numWindows; i++) {
    result.push({
      start: i * windowSize,
      end: Math.min((i + 1) * windowSize, newRefLength),
      value: counts[i] > 0 ? values[i] / counts[i] : 0
    });
  }

  return result;
}

import { describe, expect, it } from 'vitest';
import { createGapLookup } from '@/lib/gapLookup';
import { parseGenBank } from '@/lib/genomeParser';
import { offsetReferenceCds } from '@/lib/referenceCds';
import { createResultSnapshot, parseResultSnapshotJson } from '@/lib/resultSnapshot';
import type { CircularPlotData, RingData } from '@/lib/types';
import { readFileSync } from 'node:fs';

const ring = (intervals: number[][]): RingData => ({
  queryId: 'q', queryName: 'Query', color: '#ff0000', visible: true,
  hits: intervals.map(([refStart, refEnd]) => ({ refStart, refEnd, queryName: 'Query', queryStart: 0,
    queryEnd: refEnd - refStart, alignmentLength: refEnd - refStart, percentIdentity: 60, strand: '+' })),
  statistics: { meanIdentity: 60, genomeCoverage: 0, totalAlignedBases: 0 },
});
const reference = { name: 'Reference', length: 1000 };

describe('gap lookup', () => {
  it('merges overlapping, nested and adjacent hits and reports precise inclusive coordinates', () => {
    const lookup = createGapLookup(ring([[100, 200], [50, 150], [80, 90], [200, 250], [500, 900]]), reference)!;
    expect(lookup.at(49)).toMatchObject({ start: 1, end: 50, length: 50 });
    expect(lookup.at(50)).toBeNull();
    expect(lookup.at(249)).toBeNull();
    expect(lookup.at(250)).toMatchObject({ start: 251, end: 500, length: 250, position: 251 });
    expect(lookup.at(500)).toBeNull();
    expect(lookup.at(999)).toMatchObject({ start: 901, end: 1000, length: 100 });
    expect(lookup.at(1000)).toBeNull();
    expect(lookup.at(-1)).toBeNull();
  });

  it('does not call a low-identity alignment a gap, or an empty editor ring an alignment result', () => {
    expect(createGapLookup(ring([[0, 1000]]), reference)!.at(500)).toBeNull();
    expect(createGapLookup(ring([]), reference)).toBeNull();
    expect(createGapLookup({ ...ring([]), alignmentOutput: '' }, reference)!.at(500)).toMatchObject({ start: 1, end: 1000 });
  });

  it('clips intervals to contigs and excludes synthetic spacers', () => {
    const lookup = createGapLookup(ring([[0, 100]]), { ...reference, contigs: [
      { name: 'a', start: 0, end: 400, index: 0 }, { name: 'b', start: 500, end: 1000, index: 1 },
    ] })!;
    expect(lookup.at(300)).toMatchObject({ start: 101, end: 400, contigName: 'a' });
    expect(lookup.at(450)).toBeNull();
    expect(lookup.at(500)).toMatchObject({ start: 501, end: 1000, contigName: 'b' });
  });

  it('bounds CDS results, includes partially overlapping CDS and supports companion annotations', () => {
    const annotations = Array.from({ length: 10000 }, (_, index) => ({ id: `${index}`, label: `cds${index}`,
      start: 100, end: 300, shape: 'arrow-forward' as const }));
    const hitRing = ring([[0, 200], [250, 1000]]);
    const result = createGapLookup(hitRing, { ...reference, annotations })!.at(220)!;
    expect(result.cds).toHaveLength(5);
    expect(result.moreCds).toBe(true);
    expect(result.hasCds).toBe(true);
    expect(createGapLookup(hitRing, reference)!.at(220)?.hasCds).toBe(false);
  });

  it('keeps compound CDS segments separate and avoids false overlaps between segments', async () => {
    const text = `LOCUS       demo 1000 bp DNA circular
FEATURES             Location/Qualifiers
     CDS             complement(join(<101..150,
                     301..>350))
                     /gene="abc"
                     /locus_tag="ABC_1"
                     /product="a long
                     product name"
     CDS             OTHER.1:100..200
                     /gene="remote"
ORIGIN
        1 ${'a'.repeat(1000)}
//
`;
    const [genome] = await parseGenBank(text);
    expect(genome.cds).toEqual([{ name: 'abc', locusTag: 'ABC_1', product: 'a long product name', strand: '-',
      segments: [{ start: 100, end: 150 }, { start: 300, end: 350 }] }]);
    const ref = { ...reference, cds: genome.cds };
    expect(createGapLookup(ring([[0, 150], [300, 1000]]), ref)!.at(200)?.cds).toEqual([]);
    expect(createGapLookup(ring([[0, 125], [140, 1000]]), ref)!.at(130)?.cds?.[0].name).toBe('abc');
    expect(offsetReferenceCds(genome.cds!, 1100)[0].segments).toEqual([
      { start: 1200, end: 1250 }, { start: 1400, end: 1450 },
    ]);
  });

  it('retains inspection metadata in saved results without adding painted annotations', async () => {
    const snapshot = JSON.parse(readFileSync('public/publications/ecoli-comparison.json', 'utf8'));
    const genomes = await parseGenBank(readFileSync('examples/E_coli_O157H7Sakai.gbk', 'utf8'));
    expect(genomes[0].cds!.length).toBeGreaterThan(5000);
    const plot: CircularPlotData = { ...snapshot.plot, reference: { ...snapshot.plot.reference, cds: genomes[0].cds } };
    const restored = parseResultSnapshotJson(JSON.stringify(createResultSnapshot(plot, snapshot.imageConfig)));
    expect(restored.plot.reference.cds).toEqual(genomes[0].cds);
    expect(restored.plot.reference.annotations).toEqual(snapshot.plot.reference.annotations);
  });

  it('handles repeated lookups across the large example using cached indexes', async () => {
    const snapshot = JSON.parse(readFileSync('public/publications/ecoli-comparison.json', 'utf8'));
    const [genome] = await parseGenBank(readFileSync('examples/E_coli_O157H7Sakai.gbk', 'utf8'));
    const ref = { ...snapshot.plot.reference, cds: genome.cds };
    const rings: RingData[] = snapshot.plot.rings;
    const started = performance.now();
    const lookups = rings.map(track => createGapLookup(track, ref));
    const indexed = performance.now();
    let gaps = 0;
    for (let index = 0; index < 100000; index++) {
      const lookup = lookups[index % lookups.length];
      if (lookup?.at((index * 7919) % ref.length)) gaps++;
    }
    const elapsed = performance.now() - indexed;
    expect(gaps).toBeGreaterThan(1000);
    // A deliberately generous guard against accidental per-event sorting/scanning.
    expect(elapsed).toBeLessThan(5000);
    console.info(`Gap lookup benchmark: ${rings.reduce((sum, track) => sum + track.hits.length, 0)} hits, ${genome.cds!.length} CDS; index ${(indexed - started).toFixed(1)} ms; 100000 lookups ${elapsed.toFixed(1)} ms`);
  });
});

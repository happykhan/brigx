/**
 * End-to-end integration test: Chapter 5 walkthrough
 *
 * Mirrors the BRIG manual Chapter 5 "Visualising whole genome comparisons":
 * - Reference: BRIGExample.fna (simulated draft E. coli O157:H7 genome)
 * - Ring 1 (O157:H7): E_coli_O157H7Sakai.gbk
 * - Ring 2 (HS and K12): E_coli_HS.fna + E_coli_K12MG1655.fna (merged)
 * - Ring 3 (CFT073 and UTI89): E_coli_CFT073.fna + E_coli_UTI89.fna (merged)
 *
 * This test exercises the full pipeline EXCEPT the WASM BLAST alignment
 * (which requires browser environment). It validates:
 * - Parsing of all input files
 * - GC content / GC skew computation
 * - Query genome merging for multi-file rings
 * - Ring statistics computation with synthetic alignment data
 * - Annotation parsing from SP-Sites.txt
 * - Complete CircularPlotData structure assembly
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  parseFasta,
  parseGenBank,
  calculateGCWindows,
  calculateGCSkewWindows,
  mergeGenomes
} from '@/lib/genomeParser';
import { parseAnnotationFile } from '@/lib/annotationParser';
import type {
  ParsedGenome,
  AlignmentHit,
  RingData,
  CircularPlotData,
  Annotation
} from '@/lib/types';
import * as fs from 'fs';
import * as path from 'path';

const EXAMPLES_DIR = path.join(__dirname, '..', 'examples');

function readExample(filename: string): string {
  return fs.readFileSync(path.join(EXAMPLES_DIR, filename), 'utf-8');
}

// Extracted from controller.ts for testing without workers
function computeRingStats(
  hits: AlignmentHit[],
  referenceLength: number,
  minIdentity: number,
  minLength: number
): { meanIdentity: number; genomeCoverage: number; totalAlignedBases: number } {
  const filtered = hits.filter(
    h => h.percentIdentity >= minIdentity && h.alignmentLength >= minLength
  );
  if (filtered.length === 0) {
    return { meanIdentity: 0, genomeCoverage: 0, totalAlignedBases: 0 };
  }
  const covered = new Uint8Array(referenceLength);
  let totalWeightedIdentity = 0;
  let totalAlignedBases = 0;
  for (const hit of filtered) {
    const start = Math.max(0, hit.refStart);
    const end = Math.min(referenceLength, hit.refEnd);
    const len = end - start;
    if (len > 0) {
      covered.fill(1, start, end);
      totalWeightedIdentity += hit.percentIdentity * len;
      totalAlignedBases += len;
    }
  }
  let coveredBases = 0;
  for (let i = 0; i < referenceLength; i++) {
    if (covered[i]) coveredBases++;
  }
  return {
    meanIdentity: totalAlignedBases > 0 ? totalWeightedIdentity / totalAlignedBases : 0,
    genomeCoverage: (coveredBases / referenceLength) * 100,
    totalAlignedBases: coveredBases
  };
}

// Generate synthetic alignment hits that simulate a real BLAST comparison
// between two related E. coli genomes
function generateSyntheticHits(
  refLength: number,
  coverageFraction: number,
  avgIdentity: number,
  hitSize: number = 10_000
): AlignmentHit[] {
  const hits: AlignmentHit[] = [];
  const numHits = Math.floor((refLength * coverageFraction) / hitSize);

  for (let i = 0; i < numHits; i++) {
    const start = Math.floor((i / numHits) * refLength);
    const end = Math.min(start + hitSize, refLength);
    // Add some identity variance
    const identity = avgIdentity + (Math.random() - 0.5) * 4;
    hits.push({
      queryName: 'query',
      refStart: start,
      refEnd: end,
      queryStart: 0,
      queryEnd: end - start,
      percentIdentity: Math.min(100, Math.max(70, identity)),
      alignmentLength: end - start,
      strand: Math.random() > 0.05 ? '+' : '-'
    });
  }
  return hits;
}

describe('Chapter 5: Whole Genome Comparison E2E', () => {
  // Parsed genomes
  let reference: ParsedGenome;
  let o157h7Genomes: ParsedGenome[];
  let hsGenomes: ParsedGenome[];
  let k12Genomes: ParsedGenome[];
  let cft073Genomes: ParsedGenome[];
  let uti89Genomes: ParsedGenome[];

  beforeAll(async () => {
    // Step 1: Parse all input files (mirrors manual Section 5.1)
    const refGenomes = await parseFasta(readExample('BRIGExample.fna'));
    // BRIGExample is a multi-contig draft - merge into single reference
    reference = mergeGenomes(refGenomes);

    o157h7Genomes = await parseGenBank(readExample('E_coli_O157H7Sakai.gbk'));
    hsGenomes = await parseFasta(readExample('E_coli_HS.fna'));
    k12Genomes = await parseFasta(readExample('E_coli_K12MG1655.fna'));
    cft073Genomes = await parseFasta(readExample('E_coli_CFT073.fna'));
    uti89Genomes = await parseFasta(readExample('E_coli_UTI89.fna'));
  });

  describe('Step 1: Parse reference genome', () => {
    it('should parse BRIGExample.fna as multi-contig draft assembly', async () => {
      const genomes = await parseFasta(readExample('BRIGExample.fna'));
      // The manual says this is a simulated draft assembly with multiple contigs
      expect(genomes.length).toBeGreaterThanOrEqual(1);
    });

    it('should have merged reference of ~5.3 Mbp', () => {
      // The manual states: "Simulated E. coli O157:H7 5357923 bp"
      expect(reference.length).toBeGreaterThan(5_000_000);
      expect(reference.length).toBeLessThan(6_000_000);
    });

    it('should have valid nucleotide sequence', () => {
      // All characters should be valid (including N from merging spacers)
      const invalid = reference.sequence.match(/[^ACGTNRYSWKMBDHV-]/g);
      expect(invalid).toBeNull();
    });
  });

  describe('Step 1b: Parse all query genomes', () => {
    it('should parse O157:H7 Sakai from GenBank', () => {
      expect(o157h7Genomes.length).toBeGreaterThanOrEqual(1);
      const totalLen = o157h7Genomes.reduce((s, g) => s + g.length, 0);
      // O157:H7 Sakai is ~5.5 Mbp
      expect(totalLen).toBeGreaterThan(5_000_000);
    });

    it('should parse E. coli HS', () => {
      expect(hsGenomes).toHaveLength(1);
      expect(hsGenomes[0].length).toBeGreaterThan(4_500_000);
    });

    it('should parse E. coli K12 MG1655', () => {
      expect(k12Genomes).toHaveLength(1);
      expect(k12Genomes[0].length).toBeGreaterThan(4_500_000);
    });

    it('should parse E. coli CFT073', () => {
      expect(cft073Genomes).toHaveLength(1);
      expect(cft073Genomes[0].length).toBeGreaterThan(5_000_000);
    });

    it('should parse E. coli UTI89', () => {
      expect(uti89Genomes).toHaveLength(1);
      expect(uti89Genomes[0].length).toBeGreaterThan(5_000_000);
    });
  });

  describe('Step 2a: GC content and skew', () => {
    it('should compute GC content with 1000bp windows', () => {
      const gc = calculateGCWindows(reference.sequence, 1000);

      // Should have ~5357 windows for ~5.3Mbp genome
      expect(gc.length).toBeGreaterThan(5000);
      expect(gc.length).toBeLessThan(6000);

      // All values between 0 and 1
      gc.forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      });

      // Average GC should be ~50% for E. coli
      const avgGC = gc.reduce((s, v) => s + v, 0) / gc.length;
      expect(avgGC).toBeGreaterThan(0.40);
      expect(avgGC).toBeLessThan(0.60);
    });

    it('should compute GC skew with 1000bp windows', () => {
      const skew = calculateGCSkewWindows(reference.sequence, 1000);

      expect(skew.length).toBeGreaterThan(5000);

      // All values between -1 and 1
      skew.forEach(v => {
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      });

      // Average skew should be near zero (whole genome)
      const avgSkew = skew.reduce((s, v) => s + v, 0) / skew.length;
      expect(Math.abs(avgSkew)).toBeLessThan(0.1);
    });
  });

  describe('Step 2b: Merge multi-file rings', () => {
    it('should merge HS + K12 into single query for Ring 2', () => {
      const merged = mergeGenomes([...hsGenomes, ...k12Genomes]);

      // Combined should be HS (~4.6M) + K12 (~4.6M) + 100N spacer
      expect(merged.length).toBeGreaterThan(9_000_000);
      expect(merged.name).toContain('|');
    });

    it('should merge CFT073 + UTI89 into single query for Ring 3', () => {
      const merged = mergeGenomes([...cft073Genomes, ...uti89Genomes]);

      // Combined should be CFT073 (~5.2M) + UTI89 (~5.1M) + spacer
      expect(merged.length).toBeGreaterThan(10_000_000);
    });
  });

  describe('Step 3: Assemble complete plot data', () => {
    it('should build a valid CircularPlotData with 3 rings', () => {
      const gcContent = calculateGCWindows(reference.sequence, 1000);
      const gcSkew = calculateGCSkewWindows(reference.sequence, 1000);

      // Ring 1: O157:H7 - highly similar to reference (same strain)
      const ring1Hits = generateSyntheticHits(reference.length, 0.95, 98);
      const ring1Stats = computeRingStats(ring1Hits, reference.length, 70, 100);

      // Ring 2: HS + K12 - moderately related (different pathovar)
      const ring2Hits = generateSyntheticHits(reference.length, 0.75, 85);
      const ring2Stats = computeRingStats(ring2Hits, reference.length, 70, 100);

      // Ring 3: CFT073 + UTI89 - UPEC, also moderately related
      const ring3Hits = generateSyntheticHits(reference.length, 0.80, 87);
      const ring3Stats = computeRingStats(ring3Hits, reference.length, 70, 100);

      const plotData: CircularPlotData = {
        reference: {
          name: reference.name,
          length: reference.length,
          gcContent,
          gcSkew,
          features: []
        },
        rings: [
          {
            queryId: 'ring-1',
            queryName: 'O157:H7',
            color: '#0000FF',
            visible: true,
            hits: ring1Hits,
            statistics: ring1Stats
          },
          {
            queryId: 'ring-2',
            queryName: 'HS and K12',
            color: '#00FF00',
            visible: true,
            hits: ring2Hits,
            statistics: ring2Stats
          },
          {
            queryId: 'ring-3',
            queryName: 'CFT073 and UTI89',
            color: '#FF00FF',
            visible: true,
            hits: ring3Hits,
            statistics: ring3Stats
          }
        ],
        config: {
          minIdentity: 70,
          minAlignmentLength: 100
        }
      };

      // Validate structure
      expect(plotData.reference.name).toBeTruthy();
      expect(plotData.reference.length).toBeGreaterThan(0);
      expect(plotData.reference.gcContent!.length).toBeGreaterThan(0);
      expect(plotData.reference.gcSkew!.length).toBeGreaterThan(0);
      expect(plotData.rings).toHaveLength(3);

      // Ring 1 (O157:H7) should have highest coverage (same species, same serotype)
      expect(plotData.rings[0].statistics.genomeCoverage).toBeGreaterThan(80);
      expect(plotData.rings[0].statistics.meanIdentity).toBeGreaterThan(90);

      // All rings should have hits
      plotData.rings.forEach(ring => {
        expect(ring.hits.length).toBeGreaterThan(0);
        expect(ring.statistics.totalAlignedBases).toBeGreaterThan(0);
        expect(ring.visible).toBe(true);
      });
    });
  });

  describe('Annotation support (SP-Sites)', () => {
    it('should parse SP-Sites.txt prophage annotations', () => {
      const content = readExample('SP-Sites.txt');
      const result = parseAnnotationFile(content, reference.length);

      expect(result.errors).toHaveLength(0);
      expect(result.annotations).toHaveLength(18);

      // All positions should be within reference bounds
      result.annotations.forEach(ann => {
        expect(ann.start).toBeGreaterThanOrEqual(1);
        expect(ann.end).toBeLessThanOrEqual(reference.length);
        expect(ann.start).toBeLessThan(ann.end);
      });
    });

    it('should integrate annotations into ring data', () => {
      const content = readExample('SP-Sites.txt');
      const { annotations } = parseAnnotationFile(content, reference.length);

      // Create an annotation ring (Ring 5 in manual: prophage sites)
      const annotationRing: RingData = {
        queryId: 'ring-annotations',
        queryName: 'SP Sites',
        color: '#000000',
        visible: true,
        hits: [], // No alignment data
        annotations,
        statistics: { meanIdentity: 0, genomeCoverage: 0, totalAlignedBases: 0 }
      };

      expect(annotationRing.annotations).toHaveLength(18);
      expect(annotationRing.hits).toHaveLength(0);

      // Verify known prophage sites from the manual
      const sp1 = annotations.find(a => a.label === 'Sp 1');
      expect(sp1).toBeDefined();
      expect(sp1!.start).toBe(300041);
      expect(sp1!.end).toBe(310626);
    });
  });
});

describe('Chapter 6: Multi-FASTA Reference', () => {
  it('should parse EHEC_vir.fna as multi-gene reference', async () => {
    const text = readExample('EHEC_vir.fna');
    const genomes = await parseFasta(text);

    // Should have multiple virulence gene sequences
    expect(genomes.length).toBeGreaterThan(5);

    // Each should be small (individual genes, not whole genomes)
    genomes.forEach(g => {
      expect(g.length).toBeLessThan(10_000);
      expect(g.length).toBeGreaterThan(0);
    });

    // Total should be ~31-46 kbp (LEE + ecpA-R + focA-I)
    const total = genomes.reduce((s, g) => s + g.length, 0);
    expect(total).toBeGreaterThan(20_000);
    expect(total).toBeLessThan(60_000);
  });

  it('should merge multi-FASTA with spacers for reference', async () => {
    const genomes = await parseFasta(readExample('EHEC_vir.fna'));
    const merged = mergeGenomes(genomes);

    // Merged should include spacers between genes
    const expectedMinLength = genomes.reduce((s, g) => s + g.length, 0);
    expect(merged.length).toBeGreaterThan(expectedMinLength);

    // Should contain N spacers
    expect(merged.sequence).toContain('N'.repeat(100));
  });
});

describe('Chapter 8: Custom Annotations', () => {
  it('should parse SP-Sites with all 18 prophage regions', () => {
    const content = readExample('SP-Sites.txt');
    const result = parseAnnotationFile(content, 5_500_000);

    const labels = result.annotations.map(a => a.label);
    expect(labels).toContain('Sp 1');
    expect(labels).toContain('Sp 9');
    expect(labels).toContain('Sp 18');
    expect(labels).toHaveLength(18);
  });

  it('should handle annotations on rings with alignment data', () => {
    // Simulate Ring 4 from manual: has both alignment data AND GenBank annotations
    const hits = generateSyntheticHits(5_500_000, 0.9, 92);
    const annotations: Annotation[] = [
      { id: 'cds-1', start: 100, end: 500, label: 'repA', shape: 'arrow-forward', color: '#ff0000' },
      { id: 'cds-2', start: 600, end: 900, label: 'aacA', shape: 'arrow-reverse', color: '#ff0000' }
    ];

    const ring: RingData = {
      queryId: 'ring-with-both',
      queryName: 'CDS + Alignment',
      color: '#000066',
      visible: true,
      hits,
      annotations,
      statistics: computeRingStats(hits, 5_500_000, 70, 100)
    };

    // Both should coexist
    expect(ring.hits.length).toBeGreaterThan(0);
    expect(ring.annotations).toHaveLength(2);
    expect(ring.statistics.genomeCoverage).toBeGreaterThan(0);
  });
});

describe('Chapter 7: GenBank parsing for S. aureus plasmids', () => {
  const CH7_DIR = path.join(__dirname, '..', 'examples', 'brig_examples', 'BRIG_examples', 'Chapter7-sam-examples');

  function readCh7(filename: string): string {
    return fs.readFileSync(path.join(CH7_DIR, filename), 'utf-8');
  }

  it('should parse S. aureus Mu50 plasmid reference (GenBank)', async () => {
    const text = readCh7('S.aureus.Mu50-plasmid-AP003367.gbk');
    const genomes = await parseGenBank(text);

    expect(genomes.length).toBeGreaterThanOrEqual(1);
    // Mu50 plasmid is ~25 kbp
    const totalLen = genomes.reduce((s, g) => s + g.length, 0);
    expect(totalLen).toBeGreaterThan(20_000);
    expect(totalLen).toBeLessThan(30_000);
  });

  it('should parse pSK57 plasmid (GenBank)', async () => {
    const text = readCh7('S.aureus.pSK57-plasmid-GQ900493.gbk');
    const genomes = await parseGenBank(text);

    expect(genomes.length).toBeGreaterThanOrEqual(1);
    genomes.forEach(g => {
      expect(g.sequence.length).toBeGreaterThan(0);
    });
  });

  it('should parse SAP014A plasmid (GenBank)', async () => {
    const text = readCh7('S.aureus.SAP014A-plasmid-GQ900379.gbk');
    const genomes = await parseGenBank(text);

    expect(genomes.length).toBeGreaterThanOrEqual(1);
  });

  it('should build complete plot for S. aureus plasmid comparison', async () => {
    const refGenomes = await parseGenBank(readCh7('S.aureus.Mu50-plasmid-AP003367.gbk'));
    const reference = refGenomes[0];

    const psk57 = await parseGenBank(readCh7('S.aureus.pSK57-plasmid-GQ900493.gbk'));
    const sap014a = await parseGenBank(readCh7('S.aureus.SAP014A-plasmid-GQ900379.gbk'));
    expect(psk57.length).toBeGreaterThan(0);
    expect(sap014a.length).toBeGreaterThan(0);

    const gcContent = calculateGCWindows(reference.sequence, 100); // small genome = small window
    const gcSkew = calculateGCSkewWindows(reference.sequence, 100);

    // Synthetic hits for plasmid comparisons
    const psk57Hits = generateSyntheticHits(reference.length, 0.6, 88);
    const sap014aHits = generateSyntheticHits(reference.length, 0.5, 85);

    const plotData: CircularPlotData = {
      reference: {
        name: reference.name,
        length: reference.length,
        gcContent,
        gcSkew
      },
      rings: [
        {
          queryId: 'psk57',
          queryName: 'pSK57',
          color: '#000066',
          visible: true,
          hits: psk57Hits,
          statistics: computeRingStats(psk57Hits, reference.length, 70, 50)
        },
        {
          queryId: 'sap014a',
          queryName: 'SAP014A',
          color: '#660066',
          visible: true,
          hits: sap014aHits,
          statistics: computeRingStats(sap014aHits, reference.length, 70, 50)
        }
      ],
      config: { minIdentity: 70, minAlignmentLength: 50 }
    };

    expect(plotData.rings).toHaveLength(2);
    expect(plotData.reference.length).toBeGreaterThan(20_000);
    expect(plotData.reference.gcContent!.length).toBeGreaterThan(0);
  });
});

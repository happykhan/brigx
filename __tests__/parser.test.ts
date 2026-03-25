/**
 * Parser unit tests
 * Tests FASTA parsing, GenBank parsing, GC content/skew calculation,
 * genome merging, and annotation file parsing.
 *
 * Uses real example files from examples/ where appropriate.
 */

import { describe, it, expect } from '@jest/globals';
import {
  parseFasta,
  parseGenBank,
  calculateGCWindows,
  calculateGCSkewWindows,
  mergeGenomes,
  extractGenBankFeatures
} from '@/workers/parser.worker';
import { parseAnnotationFile, exportAnnotationsToTSV, resolveColour, resolveDecoration } from '@/lib/annotationParser';
import type { ParsedGenome, Annotation } from '@/lib/types';
import * as fs from 'fs';
import * as path from 'path';

// Helper to read example files
function readExample(filename: string): string {
  return fs.readFileSync(
    path.join(__dirname, '..', 'examples', filename),
    'utf-8'
  );
}

describe('FASTA Parser', () => {
  it('should parse a simple single-sequence FASTA', async () => {
    const fasta = '>TestSeq\nACGTACGT\nACGTACGT\n';
    const genomes = await parseFasta(fasta);

    expect(genomes).toHaveLength(1);
    expect(genomes[0].name).toBe('TestSeq');
    expect(genomes[0].sequence).toBe('ACGTACGTACGTACGT');
    expect(genomes[0].length).toBe(16);
  });

  it('should parse multi-sequence FASTA', async () => {
    const fasta = '>Seq1\nACGT\n>Seq2\nTTTT\n>Seq3\nGGGG\n';
    const genomes = await parseFasta(fasta);

    expect(genomes).toHaveLength(3);
    expect(genomes[0].name).toBe('Seq1');
    expect(genomes[1].name).toBe('Seq2');
    expect(genomes[2].name).toBe('Seq3');
    expect(genomes[0].sequence).toBe('ACGT');
    expect(genomes[1].sequence).toBe('TTTT');
    expect(genomes[2].sequence).toBe('GGGG');
  });

  it('should handle FASTA with complex headers (take first word as name)', async () => {
    const fasta = '>gi|157159467|ref|NC_009800.1| Escherichia coli HS, complete genome\nACGT\n';
    const genomes = await parseFasta(fasta);

    expect(genomes).toHaveLength(1);
    expect(genomes[0].name).toBe('gi|157159467|ref|NC_009800.1|');
  });

  it('should calculate GC content correctly', async () => {
    // 50% GC
    const fasta = '>Test\nACGT\n';
    const genomes = await parseFasta(fasta);
    expect(genomes[0].gcContent).toBeCloseTo(0.5, 2);

    // 100% GC
    const fasta2 = '>Test\nGCGC\n';
    const genomes2 = await parseFasta(fasta2);
    expect(genomes2[0].gcContent).toBeCloseTo(1.0, 2);

    // 0% GC
    const fasta3 = '>Test\nATAT\n';
    const genomes3 = await parseFasta(fasta3);
    expect(genomes3[0].gcContent).toBeCloseTo(0.0, 2);
  });

  it('should handle ambiguous nucleotides (IUPAC)', async () => {
    const fasta = '>Test\nACGTNRYSWKMBDHV\n';
    const genomes = await parseFasta(fasta);
    expect(genomes).toHaveLength(1);
    expect(genomes[0].sequence).toBe('ACGTNRYSWKMBDHV');
  });

  it('should reject invalid nucleotide characters', async () => {
    const fasta = '>Test\nACGTZ\n';
    await expect(parseFasta(fasta)).rejects.toThrow('Invalid nucleotide');
  });

  it('should skip empty sequences', async () => {
    const fasta = '>Empty\n\n>HasData\nACGT\n';
    const genomes = await parseFasta(fasta);
    expect(genomes).toHaveLength(1);
    expect(genomes[0].name).toBe('HasData');
  });

  it('should strip whitespace from sequences', async () => {
    const fasta = '>Test\n  ACGT  \n  TTTT  \n';
    const genomes = await parseFasta(fasta);
    expect(genomes[0].sequence).toBe('ACGTTTTT');
  });

  it('should parse real BRIGExample.fna (draft E. coli genome)', async () => {
    const text = readExample('BRIGExample.fna');
    const genomes = await parseFasta(text);

    // BRIGExample is a multi-contig draft assembly
    expect(genomes.length).toBeGreaterThanOrEqual(1);

    // Total sequence should be ~5.3 Mbp
    const totalLength = genomes.reduce((sum, g) => sum + g.length, 0);
    expect(totalLength).toBeGreaterThan(5_000_000);
    expect(totalLength).toBeLessThan(6_000_000);
  });

  it('should parse real E_coli_HS.fna (complete genome)', async () => {
    const text = readExample('E_coli_HS.fna');
    const genomes = await parseFasta(text);

    expect(genomes).toHaveLength(1);
    // E. coli HS is ~4.6 Mbp
    expect(genomes[0].length).toBeGreaterThan(4_500_000);
    expect(genomes[0].length).toBeLessThan(5_000_000);
    // GC content should be ~50% for E. coli
    expect(genomes[0].gcContent).toBeGreaterThan(0.45);
    expect(genomes[0].gcContent).toBeLessThan(0.55);
  });

  it('should parse real E_coli_K12MG1655.fna', async () => {
    const text = readExample('E_coli_K12MG1655.fna');
    const genomes = await parseFasta(text);

    expect(genomes).toHaveLength(1);
    // K12 MG1655 is ~4.6 Mbp
    expect(genomes[0].length).toBeGreaterThan(4_500_000);
    expect(genomes[0].length).toBeLessThan(4_700_000);
  });
});

describe('GenBank Parser', () => {
  it('should parse a minimal GenBank record', async () => {
    const gbk = `LOCUS       TestSeq                   16 bp    DNA     linear   BCT 01-JAN-2020
DEFINITION  Test sequence.
ORIGIN
        1 acgtacgtac gtacgt
//
`;
    const genomes = await parseGenBank(gbk);
    expect(genomes).toHaveLength(1);
    expect(genomes[0].name).toBe('TestSeq');
    expect(genomes[0].sequence).toBe('ACGTACGTACGTACGT');
    expect(genomes[0].length).toBe(16);
  });

  it('should detect circular genomes', async () => {
    const gbk = `LOCUS       CircularSeq                10 bp    DNA     circular BCT 01-JAN-2020
ORIGIN
        1 acgtacgtac
//
`;
    const genomes = await parseGenBank(gbk);
    expect(genomes[0].isCircular).toBe(true);
  });

  it('should detect linear genomes', async () => {
    const gbk = `LOCUS       LinearSeq                  10 bp    DNA     linear   BCT 01-JAN-2020
ORIGIN
        1 acgtacgtac
//
`;
    const genomes = await parseGenBank(gbk);
    expect(genomes[0].isCircular).toBe(false);
  });

  it('should parse real E_coli_O157H7Sakai.gbk', async () => {
    const text = readExample('E_coli_O157H7Sakai.gbk');
    const genomes = await parseGenBank(text);

    expect(genomes.length).toBeGreaterThanOrEqual(1);
    // O157:H7 Sakai is ~5.5 Mbp
    const totalLength = genomes.reduce((sum, g) => sum + g.length, 0);
    expect(totalLength).toBeGreaterThan(5_000_000);
    expect(totalLength).toBeLessThan(6_000_000);
  });

  it('should skip records without ORIGIN section', async () => {
    const gbk = `LOCUS       NoOrigin                   0 bp    DNA     linear   BCT 01-JAN-2020
DEFINITION  No sequence.
//
LOCUS       HasOrigin                  4 bp    DNA     linear   BCT 01-JAN-2020
ORIGIN
        1 acgt
//
`;
    const genomes = await parseGenBank(gbk);
    expect(genomes).toHaveLength(1);
    expect(genomes[0].name).toBe('HasOrigin');
  });
});

describe('GC Content Calculation', () => {
  it('should calculate GC content in windows', () => {
    // 10bp sequence, window size 5
    // Window 1: GCGCG -> G=3, C=2 -> 5/5 = 1.0
    // Window 2: ATATG -> G=1, C=0 -> 1/5 = 0.2
    const gc = calculateGCWindows('GCGCGATATG', 5);
    expect(gc).toHaveLength(2);
    expect(gc[0]).toBeCloseTo(1.0, 2);
    expect(gc[1]).toBeCloseTo(0.2, 2);
  });

  it('should handle uniform GC content', () => {
    const gc = calculateGCWindows('GCGCGCGCGC', 10);
    expect(gc).toHaveLength(1);
    expect(gc[0]).toBeCloseTo(1.0, 2);
  });

  it('should handle zero GC content', () => {
    const gc = calculateGCWindows('ATATATATAT', 10);
    expect(gc).toHaveLength(1);
    expect(gc[0]).toBeCloseTo(0.0, 2);
  });

  it('should handle partial last window', () => {
    const gc = calculateGCWindows('GCGCGCGA', 5);
    expect(gc).toHaveLength(2);
    // Window 1: GCGCG = 5/5 = 1.0
    expect(gc[0]).toBeCloseTo(1.0, 2);
    // Window 2: CGA = 2/3 ≈ 0.667
    expect(gc[1]).toBeCloseTo(2 / 3, 2);
  });
});

describe('GC Skew Calculation', () => {
  it('should calculate positive skew (more G than C)', () => {
    const skew = calculateGCSkewWindows('GGGGAAAAAA', 10);
    expect(skew).toHaveLength(1);
    // G=4, C=0, skew = (4-0)/(4+0) = 1.0
    expect(skew[0]).toBeCloseTo(1.0, 2);
  });

  it('should calculate negative skew (more C than G)', () => {
    const skew = calculateGCSkewWindows('CCCCAAAAAA', 10);
    expect(skew).toHaveLength(1);
    // G=0, C=4, skew = (0-4)/(0+4) = -1.0
    expect(skew[0]).toBeCloseTo(-1.0, 2);
  });

  it('should return zero for balanced GC', () => {
    const skew = calculateGCSkewWindows('GCGCATATAT', 10);
    expect(skew).toHaveLength(1);
    // G=2, C=2, skew = 0
    expect(skew[0]).toBeCloseTo(0.0, 2);
  });

  it('should return zero for AT-only sequence', () => {
    const skew = calculateGCSkewWindows('ATATATATAT', 10);
    expect(skew).toHaveLength(1);
    expect(skew[0]).toBeCloseTo(0.0, 2);
  });
});

describe('Genome Merging', () => {
  it('should return single genome unchanged', () => {
    const genome: ParsedGenome = {
      id: 'test',
      name: 'Test',
      sequence: 'ACGT',
      length: 4,
      gcContent: 0.5,
      isCircular: false
    };

    const merged = mergeGenomes([genome]);
    expect(merged.sequence).toBe('ACGT');
    expect(merged.name).toBe('Test');
  });

  it('should merge multiple genomes with N spacer', () => {
    const g1: ParsedGenome = {
      id: '1', name: 'A', sequence: 'AAAA', length: 4, gcContent: 0, isCircular: false
    };
    const g2: ParsedGenome = {
      id: '2', name: 'B', sequence: 'CCCC', length: 4, gcContent: 1, isCircular: false
    };

    const merged = mergeGenomes([g1, g2]);
    expect(merged.sequence).toBe('AAAA' + 'N'.repeat(100) + 'CCCC');
    expect(merged.name).toBe('A|B');
  });

  it('should throw for empty array', () => {
    expect(() => mergeGenomes([])).toThrow('No genomes to merge');
  });
});

describe('Annotation File Parser', () => {
  it('should parse real SP-Sites.txt', () => {
    const content = readExample('SP-Sites.txt');
    const result = parseAnnotationFile(content, 5_500_000);

    expect(result.errors).toHaveLength(0);
    expect(result.annotations.length).toBe(18);

    // Check first annotation (Sp 1)
    expect(result.annotations[0].start).toBe(300041);
    expect(result.annotations[0].end).toBe(310626);
    expect(result.annotations[0].label).toBe('Sp 1');

    // Check last annotation (Sp 18)
    expect(result.annotations[17].start).toBe(5040843);
    expect(result.annotations[17].end).toBe(5079601);
    expect(result.annotations[17].label).toBe('Sp 18');
  });

  it('should parse tab-delimited format', () => {
    const content = '#Start\tStop\tLabel\n100\t200\tGene1\n300\t400\tGene2\n';
    const result = parseAnnotationFile(content, 1000);

    expect(result.errors).toHaveLength(0);
    expect(result.annotations).toHaveLength(2);
    expect(result.annotations[0].label).toBe('Gene1');
    expect(result.annotations[1].label).toBe('Gene2');
  });

  it('should parse comma-delimited format', () => {
    const content = '#Start,Stop,Label\n100,200,Gene1\n300,400,Gene2\n';
    const result = parseAnnotationFile(content, 1000);

    expect(result.errors).toHaveLength(0);
    expect(result.annotations).toHaveLength(2);
  });

  it('should clamp out-of-bounds coordinates', () => {
    const content = '#Start\tStop\tLabel\n-5\t2000\tBig\n';
    const result = parseAnnotationFile(content, 1000);

    expect(result.annotations[0].start).toBe(1);
    expect(result.annotations[0].end).toBe(1000);
  });

  it('should report errors for invalid lines', () => {
    const content = '#Start\tStop\tLabel\nabc\t200\tBad\n100\txyz\tAlsoBad\n';
    const result = parseAnnotationFile(content, 1000);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.annotations).toHaveLength(0);
  });

  it('should handle lines with too few columns', () => {
    const content = '#Start\tStop\tLabel\n100\n';
    const result = parseAnnotationFile(content, 1000);

    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should accept 2-column format (start + stop, no label)', () => {
    const content = '#Start\tStop\n100\t200\n300\t400\n';
    const result = parseAnnotationFile(content, 1000);

    expect(result.annotations).toHaveLength(2);
    // Should get auto-generated labels
    expect(result.annotations[0].label).toContain('Region');
  });

  it('should parse BRIG 5-column format with colour and decoration', () => {
    const content = '#START\tSTOP\tLabel\tColour\tDecoration\n100\t200\tGene1\tred\tclockwise-arrow\n300\t400\tGene2\tblue\tcounterclockwise-arrow\n500\t600\tRegion\tblack\tarc\n';
    const result = parseAnnotationFile(content, 1000);

    expect(result.errors).toHaveLength(0);
    expect(result.annotations).toHaveLength(3);

    expect(result.annotations[0].color).toBe('#ff0000');
    expect(result.annotations[0].shape).toBe('arrow-forward');

    expect(result.annotations[1].color).toBe('#0000ff');
    expect(result.annotations[1].shape).toBe('arrow-reverse');

    expect(result.annotations[2].color).toBe('#000000');
    expect(result.annotations[2].shape).toBe('arc');
  });

  it('should handle hex colour codes', () => {
    const content = '#START\tSTOP\tLabel\tColour\n100\t200\tGene1\t#ff6600\n';
    const result = parseAnnotationFile(content, 1000);

    expect(result.annotations[0].color).toBe('#ff6600');
  });

  it('should handle hidden decoration', () => {
    const content = '#START\tSTOP\tLabel\tColour\tDecoration\n100\t200\tHidden\tdefault\thidden\n';
    const result = parseAnnotationFile(content, 1000);

    expect(result.annotations[0].shape).toBe('hidden');
  });

  it('should default missing colour/decoration columns', () => {
    const content = '#Start\tStop\tLabel\n100\t200\tGene1\n';
    const result = parseAnnotationFile(content, 1000);

    expect(result.annotations[0].color).toBe('#666666');
    expect(result.annotations[0].shape).toBe('block');
  });

  it('should export annotations to TSV with 5 columns', () => {
    const annotations: Annotation[] = [
      { id: '1', start: 100, end: 200, label: 'Gene1', shape: 'block', color: '#ff0000' },
      { id: '2', start: 300, end: 400, label: 'Gene2', shape: 'arrow-forward', color: '#0000ff' }
    ];

    const tsv = exportAnnotationsToTSV(annotations);
    const lines = tsv.split('\n');

    expect(lines[0]).toBe('#Start\tStop\tLabel\tColour\tDecoration');
    expect(lines[1]).toContain('Gene1');
    expect(lines[1]).toContain('#ff0000');
    expect(lines[2]).toContain('clockwise-arrow');
  });

  it('should roundtrip: export then re-import with colour and decoration', () => {
    const original: Annotation[] = [
      { id: '1', start: 100, end: 200, label: 'Sp 1', shape: 'arrow-forward', color: '#ff0000' },
      { id: '2', start: 300, end: 400, label: 'Sp 2', shape: 'arrow-reverse', color: '#0000ff' }
    ];

    const tsv = exportAnnotationsToTSV(original);
    const result = parseAnnotationFile(tsv, 5_500_000);

    expect(result.annotations).toHaveLength(2);
    expect(result.annotations[0].shape).toBe('arrow-forward');
    expect(result.annotations[0].color).toBe('#ff0000');
    expect(result.annotations[1].shape).toBe('arrow-reverse');
    expect(result.annotations[1].color).toBe('#0000ff');
  });
});

describe('Colour and Decoration Resolution', () => {
  it('should resolve BRIG colour names', () => {
    expect(resolveColour('red')).toBe('#ff0000');
    expect(resolveColour('blue')).toBe('#0000ff');
    expect(resolveColour('black')).toBe('#000000');
    expect(resolveColour('navy')).toBe('#000080');
  });

  it('should resolve hex codes', () => {
    expect(resolveColour('#ff6600')).toBe('#ff6600');
    expect(resolveColour('#abc')).toBe('#abc');
  });

  it('should return undefined for default/empty', () => {
    expect(resolveColour('default')).toBeUndefined();
    expect(resolveColour('')).toBeUndefined();
    expect(resolveColour(undefined)).toBeUndefined();
  });

  it('should resolve BRIG decoration names', () => {
    expect(resolveDecoration('clockwise-arrow')).toBe('arrow-forward');
    expect(resolveDecoration('counterclockwise-arrow')).toBe('arrow-reverse');
    expect(resolveDecoration('arc')).toBe('arc');
    expect(resolveDecoration('hidden')).toBe('hidden');
    expect(resolveDecoration('default')).toBe('block');
  });

  it('should default unknown decorations to block', () => {
    expect(resolveDecoration('unknown')).toBe('block');
    expect(resolveDecoration('')).toBe('block');
    expect(resolveDecoration(undefined)).toBe('block');
  });
});

describe('GenBank Feature Extraction', () => {
  it('should extract CDS features from a GenBank file', () => {
    const gbk = `LOCUS       TestSeq                   1000 bp    DNA     circular BCT 01-JAN-2020
FEATURES             Location/Qualifiers
     CDS             100..500
                     /gene="geneA"
                     /product="protein A"
     CDS             complement(600..900)
                     /gene="geneB"
                     /product="protein B"
     gene            100..500
                     /gene="geneA"
ORIGIN
        1 ${'acgt'.repeat(250)}
//
`;
    const features = extractGenBankFeatures(gbk, 'CDS');

    expect(features).toHaveLength(2);
    expect(features[0].start).toBe(100);
    expect(features[0].end).toBe(500);
    expect(features[0].label).toBe('geneA');
    expect(features[0].shape).toBe('arrow-forward');

    expect(features[1].start).toBe(600);
    expect(features[1].end).toBe(900);
    expect(features[1].label).toBe('geneB');
    expect(features[1].shape).toBe('arrow-reverse');
  });

  it('should filter by text contains', () => {
    const gbk = `LOCUS       TestSeq                   1000 bp    DNA     linear BCT 01-JAN-2020
FEATURES             Location/Qualifiers
     CDS             100..500
                     /gene="adhesinA"
                     /product="adhesin protein A"
     CDS             600..900
                     /gene="toxinB"
                     /product="toxin B"
ORIGIN
        1 ${'acgt'.repeat(250)}
//
`;
    const features = extractGenBankFeatures(gbk, 'CDS', 'adhesin');

    expect(features).toHaveLength(1);
    expect(features[0].label).toBe('adhesinA');
  });

  it('should extract features from real E_coli_O157H7Sakai.gbk', () => {
    const text = readExample('E_coli_O157H7Sakai.gbk');
    const features = extractGenBankFeatures(text, 'CDS');

    // O157:H7 Sakai has thousands of CDS features
    expect(features.length).toBeGreaterThan(100);

    // Each should have start, end, and a label
    features.forEach(f => {
      expect(f.start).toBeGreaterThan(0);
      expect(f.end).toBeGreaterThan(f.start);
      expect(f.shape).toMatch(/^arrow-(forward|reverse)$/);
    });
  });

  it('should extract gene features', () => {
    const text = readExample('E_coli_O157H7Sakai.gbk');
    const features = extractGenBankFeatures(text, 'gene');

    expect(features.length).toBeGreaterThan(100);
  });

  it('should return empty for non-existent feature type', () => {
    const text = readExample('E_coli_O157H7Sakai.gbk');
    const features = extractGenBankFeatures(text, 'nonexistent_feature');

    expect(features).toHaveLength(0);
  });

  it('should extract from S. aureus plasmid GenBank', () => {
    const ch7Dir = path.join(__dirname, '..', 'examples', 'brig_examples', 'BRIG_examples', 'Chapter7-sam-examples');
    const text = fs.readFileSync(path.join(ch7Dir, 'S.aureus.Mu50-plasmid-AP003367.gbk'), 'utf-8');
    const features = extractGenBankFeatures(text, 'CDS');

    // Should have CDS features for the plasmid
    expect(features.length).toBeGreaterThan(10);
  });
});

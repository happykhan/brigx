import pako from 'pako';
import { readFileArrayBuffer } from './fileAccess';
import type { ParsedGenome } from './types';

function isGzipped(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function decompressGzip(bytes: Uint8Array): string {
  try {
    const decompressed = pako.inflate(bytes);
    return new TextDecoder('utf-8').decode(decompressed);
  } catch (error) {
    throw new Error(`Failed to decompress gzip file: ${error}`);
  }
}

function detectFileFormat(text: string): 'fasta' | 'genbank' | 'unknown' {
  if (text.trimStart().startsWith('>')) return 'fasta';
  return text.split('\n').slice(0, 10).some(line => line.startsWith('LOCUS'))
    ? 'genbank'
    : 'unknown';
}

function genomeId(prefix = 'genome'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function validateSequence(sequence: string, name: string): void {
  const invalidCharacters = sequence.match(/[^ACGTNRYSWKMBDHV-]/g);
  if (invalidCharacters) {
    throw new Error(
      `Invalid nucleotide characters found in ${name}: ${[...new Set(invalidCharacters)].join(', ')}`,
    );
  }
}

function parsedGenome(name: string, sequence: string, isCircular: boolean): ParsedGenome {
  validateSequence(sequence, name);
  const gcCount = (sequence.match(/[GC]/g) || []).length;
  return {
    id: genomeId(),
    name,
    sequence,
    length: sequence.length,
    gcContent: gcCount / sequence.length,
    isCircular,
  };
}

export async function parseGenBank(text: string): Promise<ParsedGenome[]> {
  console.log('[Parser] Parsing GenBank file');
  const genomes: ParsedGenome[] = [];
  const records = text.split(/^LOCUS/m).filter(record => record.trim().length > 0);

  for (const recordWithoutPrefix of records) {
    const record = recordWithoutPrefix.startsWith('LOCUS')
      ? recordWithoutPrefix
      : `LOCUS${recordWithoutPrefix}`;
    const name = record.match(/^LOCUS\s+(\S+)/)?.[1] ?? 'Unknown';
    const origin = record.match(/ORIGIN([\s\S]*?)(\/\/|$)/)?.[1];
    if (!origin) {
      console.warn(`[Parser] No ORIGIN section found for ${name}, skipping`);
      continue;
    }

    const sequence = origin.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (!sequence) continue;
    genomes.push(parsedGenome(name, sequence, /circular/i.test(record.split('\n')[0])));
  }
  return genomes;
}

export async function parseFasta(text: string): Promise<ParsedGenome[]> {
  console.log('[Parser] Parsing FASTA format');
  const genomes: ParsedGenome[] = [];

  for (const record of text.split('>').filter(Boolean)) {
    const lines = record.split('\n');
    const header = lines[0].trim();
    const sequence = lines.slice(1).join('').replace(/\s/g, '').toUpperCase();
    if (!sequence) continue;
    const normalizedHeader = header.toLowerCase();
    genomes.push(parsedGenome(
      header.split(/\s+/)[0],
      sequence,
      normalizedHeader.includes('circular') || normalizedHeader.includes('complete'),
    ));
  }
  return genomes;
}

export async function parseFile(file: File): Promise<ParsedGenome[]> {
  console.log(`[Parser] Parsing file: ${file.name}, size: ${file.size} bytes`);
  const bytes = new Uint8Array(await readFileArrayBuffer(file));
  const text = isGzipped(bytes)
    ? decompressGzip(bytes)
    : new TextDecoder('utf-8').decode(bytes);

  const format = detectFileFormat(text);
  if (format === 'genbank') return parseGenBank(text);
  if (format === 'fasta') return parseFasta(text);
  throw new Error('Unable to detect file format. File must be FASTA or GenBank format (optionally gzipped).');
}

export function calculateGCWindows(sequence: string, windowSize: number): number[] {
  const gcContent: number[] = [];
  const windowCount = Math.ceil(sequence.length / windowSize);
  for (let index = 0; index < windowCount; index++) {
    const window = sequence.substring(
      index * windowSize,
      Math.min((index + 1) * windowSize, sequence.length),
    );
    gcContent.push((window.match(/[GC]/g) || []).length / window.length);
  }
  return gcContent;
}

export function calculateGCSkewWindows(sequence: string, windowSize: number): number[] {
  const gcSkew: number[] = [];
  const windowCount = Math.ceil(sequence.length / windowSize);
  for (let index = 0; index < windowCount; index++) {
    const window = sequence.substring(
      index * windowSize,
      Math.min((index + 1) * windowSize, sequence.length),
    );
    const gCount = (window.match(/G/g) || []).length;
    const cCount = (window.match(/C/g) || []).length;
    const total = gCount + cCount;
    gcSkew.push(total > 0 ? (gCount - cCount) / total : 0);
  }
  return gcSkew;
}

export function mergeGenomes(genomes: ParsedGenome[]): ParsedGenome {
  if (genomes.length === 0) throw new Error('No genomes to merge');
  if (genomes.length === 1) return genomes[0];

  const spacer = 'N'.repeat(100);
  const sequence = genomes.map(genome => genome.sequence).join(spacer);
  const gcCount = (sequence.match(/[GC]/g) || []).length;
  return {
    id: genomeId('merged'),
    name: genomes.map(genome => genome.name).join('|'),
    sequence,
    length: sequence.length,
    gcContent: gcCount / sequence.length,
    isCircular: false,
  };
}

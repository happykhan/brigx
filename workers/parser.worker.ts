// Parser Worker - Handles FASTA and GenBank parsing with format auto-detection
import type { ParsedGenome } from '../lib/types';
import pako from 'pako';

// Detect if file is gzipped by checking magic numbers
function isGzipped(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

// Decompress gzipped data
function decompressGzip(bytes: Uint8Array): string {
  try {
    const decompressed = pako.inflate(bytes);
    return new TextDecoder('utf-8').decode(decompressed);
  } catch (error) {
    throw new Error(`Failed to decompress gzip file: ${error}`);
  }
}

// Detect file format by examining first few lines
function detectFileFormat(text: string): 'fasta' | 'genbank' | 'unknown' {
  const lines = text.split('\n').slice(0, 10); // Check first 10 lines
  
  // Check for FASTA format (starts with >)
  if (text.trimStart().startsWith('>')) {
    return 'fasta';
  }
  
  // Check for GenBank format (has LOCUS line)
  for (const line of lines) {
    if (line.startsWith('LOCUS')) {
      return 'genbank';
    }
  }
  
  return 'unknown';
}

// Parse GenBank file and extract sequences
export async function parseGenBank(text: string): Promise<ParsedGenome[]> {
  console.log('[Parser Worker] Parsing GenBank file');
  const genomes: ParsedGenome[] = [];
  
  // Split by LOCUS to get individual records
  const records = text.split(/^LOCUS/m).filter(record => record.trim().length > 0);
  console.log(`[Parser Worker] Found ${records.length} GenBank records`);
  
  for (let record of records) {
    // Re-add LOCUS prefix if needed
    if (!record.startsWith('LOCUS')) {
      record = 'LOCUS' + record;
    }
    
    // Extract LOCUS name from first line
    const locusMatch = record.match(/^LOCUS\s+(\S+)/);
    const name = locusMatch ? locusMatch[1] : 'Unknown';
    
    // Check if circular
    const isCircular = /circular/i.test(record.split('\n')[0]);
    
    // Extract sequence from ORIGIN section
    const originMatch = record.match(/ORIGIN([\s\S]*?)(\/\/|$)/);
    if (!originMatch) {
      console.warn(`[Parser Worker] No ORIGIN section found for ${name}, skipping`);
      continue;
    }
    
    // Parse sequence: remove line numbers and spaces
    const sequenceLines = originMatch[1];
    const sequence = sequenceLines
      .replace(/[^a-zA-Z]/g, '') // Remove everything except letters
      .toUpperCase();
    
    if (sequence.length === 0) {
      console.warn(`[Parser Worker] Empty sequence for ${name}, skipping`);
      continue;
    }
    
    // Validate sequence contains only valid nucleotides
    const invalidChars = sequence.match(/[^ACGTNRYSWKMBDHV-]/g);
    if (invalidChars) {
      throw new Error(`Invalid nucleotide characters found in ${name}: ${[...new Set(invalidChars)].join(', ')}`);
    }
    
    const gcCount = (sequence.match(/[GC]/g) || []).length;
    const gcContent = gcCount / sequence.length;
    
    genomes.push({
      id: `genome_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      sequence,
      length: sequence.length,
      gcContent,
      isCircular
    });
    
    console.log(`[Parser Worker] Parsed GenBank record: ${name}, length: ${sequence.length}`);
  }
  
  return genomes;
}

// Universal file parser that auto-detects format
export async function parseFile(file: File): Promise<ParsedGenome[]> {
  console.log(`[Parser Worker] Parsing file: ${file.name}, size: ${file.size} bytes`);
  
  // Read file as array buffer first
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  
  // Check if gzipped and decompress if needed
  let text: string;
  if (isGzipped(bytes)) {
    console.log('[Parser Worker] Detected gzipped file, decompressing...');
    text = decompressGzip(bytes);
  } else {
    text = new TextDecoder('utf-8').decode(bytes);
  }
  
  console.log(`[Parser Worker] File content length: ${text.length} characters`);
  
  // Detect format
  const format = detectFileFormat(text);
  console.log(`[Parser Worker] Detected format: ${format}`);
  
  // Parse based on format
  let genomes: ParsedGenome[];
  if (format === 'genbank') {
    genomes = await parseGenBank(text);
  } else if (format === 'fasta') {
    genomes = await parseFasta(text);
  } else {
    throw new Error(`Unable to detect file format. File must be FASTA or GenBank format (optionally gzipped).`);
  }
  
  return genomes;
}

// FASTA parser (now takes text string instead of File)
export async function parseFasta(text: string): Promise<ParsedGenome[]> {
  console.log(`[Parser Worker] Parsing FASTA format`);
  const genomes: ParsedGenome[] = [];
  
  const records = text.split('>').filter(Boolean);
  console.log(`[Parser Worker] Found ${records.length} records`);
  
  for (const record of records) {
    const lines = record.split('\n');
    const header = lines[0].trim();
    const sequence = lines.slice(1).join('').replace(/\s/g, '').toUpperCase();
    
    if (sequence.length === 0) continue;
    
    // Validate sequence contains only valid nucleotides
    const invalidChars = sequence.match(/[^ACGTNRYSWKMBDHV-]/g);
    if (invalidChars) {
      throw new Error(`Invalid nucleotide characters in sequence ${header}: ${[...new Set(invalidChars)].join(', ')}`);
    }
    
    const gcCount = (sequence.match(/[GC]/g) || []).length;
    const gcContent = gcCount / sequence.length;
    
    genomes.push({
      id: `genome_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: header.split(/\s+/)[0],
      sequence,
      length: sequence.length,
      gcContent,
      isCircular: header.toLowerCase().includes('circular') || header.toLowerCase().includes('complete')
    });
  }
  
  return genomes;
}

export function calculateGCWindows(sequence: string, windowSize: number): number[] {
  const gcContent: number[] = [];
  const numWindows = Math.ceil(sequence.length / windowSize);
  
  for (let i = 0; i < numWindows; i++) {
    const start = i * windowSize;
    const end = Math.min((i + 1) * windowSize, sequence.length);
    const window = sequence.substring(start, end);
    const gcCount = (window.match(/[GC]/g) || []).length;
    gcContent.push(gcCount / window.length);
  }
  
  return gcContent;
}

export function calculateGCSkewWindows(sequence: string, windowSize: number): number[] {
  const gcSkew: number[] = [];
  const numWindows = Math.ceil(sequence.length / windowSize);
  
  for (let i = 0; i < numWindows; i++) {
    const start = i * windowSize;
    const end = Math.min((i + 1) * windowSize, sequence.length);
    const window = sequence.substring(start, end);
    const gCount = (window.match(/G/g) || []).length;
    const cCount = (window.match(/C/g) || []).length;
    
    // GC Skew = (G-C)/(G+C)
    const sum = gCount + cCount;
    const skew = sum > 0 ? (gCount - cCount) / sum : 0;
    gcSkew.push(skew);
  }
  
  return gcSkew;
}

// Merge multiple genomes into a single concatenated sequence
// This is used when multiple query sequences are in one file and should be compared together
export function mergeGenomes(genomes: ParsedGenome[]): ParsedGenome {
  if (genomes.length === 0) {
    throw new Error('No genomes to merge');
  }
  
  if (genomes.length === 1) {
    return genomes[0];
  }
  
  console.log(`[Parser Worker] Merging ${genomes.length} genomes`);
  
  // Concatenate sequences with NNN spacer
  const spacer = 'N'.repeat(100); // 100 N's as separator
  const mergedSequence = genomes.map(g => g.sequence).join(spacer);
  const mergedName = genomes.map(g => g.name).join('|');
  
  const gcCount = (mergedSequence.match(/[GC]/g) || []).length;
  const gcContent = gcCount / mergedSequence.length;
  
  return {
    id: `merged_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: mergedName,
    sequence: mergedSequence,
    length: mergedSequence.length,
    gcContent,
    isCircular: false
  };
}

// Worker message handler
self.onmessage = async (e: MessageEvent) => {
  console.log('[Parser Worker] Received message:', e.data.type);
  const { type, file, sequence, windowSize, genomes } = e.data;
  
  try {
    if (type === 'parse') {
      console.log('[Parser Worker] Starting parse...');
      const parsedGenomes = await parseFile(file);
      console.log(`[Parser Worker] Parse complete, ${parsedGenomes.length} genomes`);
      self.postMessage({ type: 'parsed', genomes: parsedGenomes });
    } else if (type === 'gc') {
      console.log('[Parser Worker] Starting GC calculation...');
      const gcContent = calculateGCWindows(sequence, windowSize);
      console.log(`[Parser Worker] GC calculation complete, ${gcContent.length} windows`);
      self.postMessage({ type: 'gc', gcContent });
    } else if (type === 'gcSkew') {
      console.log('[Parser Worker] Starting GC Skew calculation...');
      const gcSkew = calculateGCSkewWindows(sequence, windowSize);
      console.log(`[Parser Worker] GC Skew calculation complete, ${gcSkew.length} windows`);
      self.postMessage({ type: 'gcSkew', gcSkew });
    } else if (type === 'merge') {
      console.log('[Parser Worker] Starting genome merge...');
      const merged = mergeGenomes(genomes);
      console.log(`[Parser Worker] Merge complete: ${merged.name}`);
      self.postMessage({ type: 'merged', genome: merged });
    }
  } catch (error: any) {
    console.error('[Parser Worker] Error:', error);
    self.postMessage({ type: 'error', error: error.message });
  }
};

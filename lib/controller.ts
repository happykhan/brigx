// Application Controller - Orchestrates the entire pipeline
import type {
  ParsedGenome,
  AlignmentHit,
  AlignmentResult,
  CircularPlotData,
  RingData,
  RingConfig,
  PipelineParams,
  ProgressUpdate,
  ContigBoundary,
  GraphPoint,
  Feature
} from './types';
import { extractGenBankFeatures } from './featureParser';
import { parseSAMCoverage } from '@/lib/samParser';
import { parseGraphFile } from '@/lib/graphParser';
import { normaliseFileAccessError, readFileText } from '@/lib/fileAccess';

export function isGraphFileName(fileName: string): boolean {
  const name = fileName.toLowerCase();
  return ['.graph', '.bedgraph', '.wig', '.bed'].some(extension => name.endsWith(extension));
}

const ALIGNMENT_WORKER_COUNT = 4;
const WORKER_INITIALIZATION_TIMEOUT_MS = 30_000;

function fileIdentity(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function createAlignmentCacheKey(
  referenceFile: File,
  ring: RingConfig,
  params: PipelineParams,
): string {
  return JSON.stringify([
    fileIdentity(referenceFile),
    ring.id,
    ring.legendText,
    ring.files.map(fileIdentity),
    ring.blastType ?? params.blastProgram ?? 'blastn',
    params.alignerOptions?.trim() ?? '',
  ]);
}

function emptyAlignment(
  ring: RingConfig,
  queryLength: number,
  alignerVersion: string,
  params: Partial<PipelineParams> = {},
): { result: AlignmentResult; rawOutput: string } {
  return {
    result: {
      queryId: ring.id,
      queryName: ring.legendText,
      queryLength,
      totalHits: 0,
      hits: [],
      metadata: { timestamp: Date.now(), alignerVersion, parameters: params },
    },
    rawOutput: '',
  };
}


export class BRIGController {
  private parserWorker?: Worker;
  private alignmentWorkers: Worker[] = [];
  private progressCallback?: (update: ProgressUpdate) => void;
  private alignmentCache: Map<string, AlignmentResult> = new Map();

  async initialize(): Promise<void> {
    console.log('[Controller] Starting initialization...');
    if (this.parserWorker) return;

    console.log('[Controller] Creating parser worker...');
    this.parserWorker = new Worker(
      new URL('../workers/parser.worker.ts', import.meta.url),
      { type: 'module' }
    );
    console.log('[Controller] Parser worker created');
  }

  private initializeAlignmentWorker(worker: Worker, index: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const workerNumber = index + 1;
      const timeout = setTimeout(() => {
        reject(new Error(`Worker ${workerNumber} initialization timeout`));
      }, WORKER_INITIALIZATION_TIMEOUT_MS);

      worker.onmessage = event => {
        if (event.data.type === 'initialized') {
          console.log(`[Controller] Worker ${workerNumber} initialized successfully`);
          clearTimeout(timeout);
          resolve();
        } else if (event.data.type === 'error') {
          clearTimeout(timeout);
          reject(new Error(event.data.error));
        }
      };
      worker.onerror = error => {
        clearTimeout(timeout);
        reject(error);
      };
      worker.postMessage({ type: 'init' });
    });
  }

  private async ensureAlignmentWorkers(): Promise<void> {
    if (this.alignmentWorkers.length > 0) return;
    console.log(`[Controller] Initializing ${ALIGNMENT_WORKER_COUNT} alignment workers...`);
    const workers = Array.from({ length: ALIGNMENT_WORKER_COUNT }, () => (
      new Worker(
        new URL('../workers/alignment.worker.ts', import.meta.url),
        { type: 'module' }
      )
    ));
    this.alignmentWorkers = workers;
    try {
      await Promise.all(workers.map((worker, index) => (
        this.initializeAlignmentWorker(worker, index)
      )));
    } catch (error) {
      this.resetAlignmentWorkers();
      throw error;
    }
    console.log('[Controller] All workers initialized successfully');
  }

  private resetAlignmentWorkers(): void {
    this.alignmentWorkers.forEach(worker => worker.terminate());
    this.alignmentWorkers = [];
  }

  private updateProgress(step: string, percent: number, message?: string) {
    if (this.progressCallback) {
      this.progressCallback({ step, percent, message });
    }
  }

  private async parseGenomes(file: File): Promise<ParsedGenome[]> {
    console.log(`[Controller] Parsing genomes: ${file.name}`);
    return new Promise((resolve, reject) => {
      if (!this.parserWorker) {
        console.error('[Controller] Parser worker not initialized');
        reject(new Error('Parser worker not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        console.error('[Controller] Genome parsing timeout');
        reject(new Error('Genome parsing timeout'));
      }, 60000); // 60 second timeout

      this.parserWorker.onmessage = (e) => {
        if (e.data.type === 'parsed') {
          clearTimeout(timeout);
          console.log(`[Controller] Parsed ${e.data.genomes.length} sequences from ${file.name}`);
          resolve(e.data.genomes);
        } else if (e.data.type === 'error') {
          clearTimeout(timeout);
          reject(normaliseFileAccessError(new Error(e.data.error), file.name));
        }
      };

      console.log('[Controller] Sending parse request');
      try {
        this.parserWorker.postMessage({ type: 'parse', file });
      } catch (error) {
        clearTimeout(timeout);
        reject(normaliseFileAccessError(error, file.name));
      }
    });
  }

  private async calculateGCMetrics(
    sequence: string,
    windowSize: number,
  ): Promise<{ gcContent: number[]; gcSkew: number[] }> {
    console.log(`[Controller] Calculating GC metrics, window size: ${windowSize}`);
    return new Promise((resolve, reject) => {
      if (!this.parserWorker) {
        reject(new Error('Parser worker not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('GC metrics calculation timeout'));
      }, 60000);

      this.parserWorker.onmessage = (e) => {
        if (e.data.type === 'gcMetrics') {
          clearTimeout(timeout);
          resolve({ gcContent: e.data.gcContent, gcSkew: e.data.gcSkew });
        } else if (e.data.type === 'error') {
          clearTimeout(timeout);
          reject(new Error(e.data.error));
        }
      };

      this.parserWorker.postMessage({ type: 'gcMetrics', sequence, windowSize });
    });
  }

  private async alignWithWorker(
    worker: Worker,
    reference: ParsedGenome,
    query: ParsedGenome,
    params: PipelineParams
  ): Promise<{ result: AlignmentResult; rawOutput: string }> {
    console.log(`[Controller] Starting alignment: ${query.name} vs ${reference.name}`);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (
        outcome: { result: AlignmentResult; rawOutput: string } | Error,
      ) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        worker.onmessage = null;
        worker.onerror = null;
        if (outcome instanceof Error) reject(outcome);
        else resolve(outcome);
      };
      const timeout = setTimeout(() => {
        console.error(`[Controller] Alignment timeout for ${query.name}`);
        finish(new Error(`Alignment timeout for ${query.name}`));
      }, 300000); // 5 minutes

      worker.onmessage = (e) => {
        console.log(`[Controller] Received message from worker for ${query.name}, type: ${e.data.type}`);
        if (e.data.type === 'aligned') {
          console.log(`[Controller] Alignment completed for ${query.name}: ${e.data.result.hits?.length || 0} hits`);
          finish({ result: e.data.result, rawOutput: e.data.rawOutput });
        } else if (e.data.type === 'error') {
          console.error(`[Controller] Alignment error for ${query.name}:`, e.data.error);
          finish(new Error(e.data.error));
        } else {
          console.warn(`[Controller] Unexpected message type for ${query.name}:`, e.data.type);
        }
      };

      worker.onerror = event => {
        const message = event instanceof ErrorEvent && event.message
          ? event.message
          : `Alignment worker crashed for ${query.name}`;
        finish(new Error(message));
      };

      console.log(`[Controller] Sending alignment request for ${query.name}`);
      worker.postMessage({
        type: 'align',
        referenceName: reference.name,
        referenceSeq: reference.sequence,
        queryName: query.name,
        querySeq: query.sequence,
        params,
      });
    });
  }

  private computeRingStats(
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

    // Track covered bases on reference using a boolean array for accuracy
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

  async runFullPipeline(
    referenceFile: File,
    rings: RingConfig[],
    _annotationFiles: File[],
    params: PipelineParams,
    progressCallback?: (update: ProgressUpdate) => void
  ): Promise<CircularPlotData> {
    console.log('[Controller] === Starting Full Pipeline ===');
    console.log(`[Controller] Reference: ${referenceFile.name}`);
    console.log(`[Controller] Rings: ${rings.map(r => `${r.legendText} (${r.files.length} files)`).join(', ')}`);
    console.log('[Controller] Parameters:', params);
    
    this.progressCallback = progressCallback;

    try {
      // Parse reference
      console.log('[Controller] Step 1: Parsing reference genome');
      this.updateProgress('Parsing reference genome', 5);
      const referenceGenomes = await this.parseGenomes(referenceFile);
      
      if (referenceGenomes.length === 0) {
        throw new Error('Reference file contains no sequences');
      }

      // Support multi-FASTA reference: merge with spacers and track contig boundaries
      let reference: ParsedGenome;
      let contigBoundaries: ContigBoundary[] | undefined;

      if (referenceGenomes.length > 1) {
        const spacerSize = params.spacerSize || 0;
        const spacer = spacerSize > 0 ? 'N'.repeat(spacerSize) : '';
        const sequences: string[] = [];
        contigBoundaries = [];
        let pos = 0;

        for (let i = 0; i < referenceGenomes.length; i++) {
          if (i > 0 && spacerSize > 0) pos += spacerSize;
          contigBoundaries.push({
            name: referenceGenomes[i].name,
            start: pos,
            end: pos + referenceGenomes[i].length,
            index: i
          });
          sequences.push(referenceGenomes[i].sequence);
          pos += referenceGenomes[i].length;
        }

        const mergedSeq = sequences.join(spacer);
        reference = {
          id: `merged-ref-${Date.now()}`,
          name: referenceGenomes[0].name,
          sequence: mergedSeq,
          length: mergedSeq.length,
          gcContent: 0,
          isCircular: false
        };
        console.log(`[Controller] Multi-FASTA reference: ${referenceGenomes.length} contigs merged (spacer: ${spacerSize}bp), total: ${reference.length} bp`);
      } else {
        reference = referenceGenomes[0];
      }
      console.log(`[Controller] Reference: ${reference.name}, ${(reference.length / 1_000_000).toFixed(2)} Mbp`);

      // Extract features from GenBank reference if applicable
      let referenceFeatures: Feature[] = [];
      const refExt = referenceFile.name.toLowerCase();
      if (refExt.match(/\.(gbk|gb|genbank|gbff)(\.gz)?$/)) {
        try {
          const refText = await readFileText(referenceFile);
          const annots = extractGenBankFeatures(refText, 'CDS');
          referenceFeatures = annots.map(a => ({
            type: 'CDS',
            start: a.start,
            end: a.end,
            strand: (a.shape === 'arrow-forward' ? '+' : '-') as '+' | '-',
            name: a.label,
          }));
          console.log(`[Controller] Extracted ${referenceFeatures.length} CDS features from reference`);
        } catch (e) {
          console.warn('[Controller] Failed to extract reference features:', e);
        }
      }

      console.log('[Controller] Step 2: Calculating GC content and skew');
      this.updateProgress('Calculating GC content and skew', 10);
      // Adapt window size to reference length: aim for ~500-5000 windows
      // For small genomes (<50kb), use smaller windows to maintain resolution
      const gcWindowSize = Math.max(10, Math.min(1000, Math.floor(reference.length / 500)));
      const { gcContent, gcSkew } = await this.calculateGCMetrics(
        reference.sequence,
        gcWindowSize,
      );
      console.log(`[Controller] GC metrics calculated: ${gcContent.length} windows`);

      // Send partial data with reference and GC content
      if (this.progressCallback) {
        this.progressCallback({
          step: 'GC content calculated',
          percent: 12,
          partialData: {
            reference: {
              name: reference.name,
              length: reference.length,
              gcContent,
              gcSkew,
              features: referenceFeatures,
              contigs: contigBoundaries
            },
            rings: [], // Empty rings array initially
            config: {
              minIdentity: params.minIdentity,
              minAlignmentLength: params.minAlignmentLength
            }
          }
        });
      }

      // Parse and prepare query genomes for each ring
      // Merge all files in each ring into a single query genome
      // Detect .sam and .graph files and handle them as graph rings
      console.log('[Controller] Step 3: Preparing query genomes for rings');
      this.updateProgress('Preparing query genomes', 15);

      const queryGenomes: ParsedGenome[] = [];
      // Track which rings are graph rings (index in rings array -> graph data)
      const graphRingData: Map<number, { points: GraphPoint[]; maxValue: number; graphStats?: { mean: number; q3: number; max: number } }> = new Map();
      const skippedRingIndices = new Set<number>();

      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        console.log(`[Controller] Processing ring ${i + 1}/${rings.length}: ${ring.legendText} with ${ring.files.length} files`);

        // Check if any file is a .sam or .graph file
        const samFile = ring.files.find(f => f.name.toLowerCase().endsWith('.sam'));
        const graphFile = ring.files.find(f => isGraphFileName(f.name));

        if (samFile) {
          console.log(`[Controller]   SAM file detected: ${samFile.name}, computing coverage`);
          const content = await readFileText(samFile);
          const gcWindowSize = 1000;
          const result = parseSAMCoverage(content, gcWindowSize);
          graphRingData.set(i, { points: result.points, maxValue: result.maxValue });
          console.log(`[Controller]   SAM coverage: ${result.mappedReads}/${result.totalReads} mapped reads, max coverage: ${result.maxValue.toFixed(1)}`);
          // Push a placeholder genome so array indices stay aligned
          queryGenomes.push({ id: `sam-${ring.id}`, name: ring.legendText, sequence: '', length: 0, gcContent: 0, isCircular: false });
          continue;
        }

        if (graphFile) {
          console.log(`[Controller]   Graph file detected: ${graphFile.name}`);
          const content = await readFileText(graphFile);
          const result = parseGraphFile(content);
          if (result.errors.length > 0) {
            console.warn(`[Controller]   Graph parse warnings: ${result.errors.slice(0, 3).join('; ')}`);
          }
          // Compute summary stats for the graph
          const values = result.points.map(p => p.value).filter(v => v > 0).sort((a, b) => a - b);
          const mean = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
          const q3 = values.length > 0 ? values[Math.floor(values.length * 0.75)] : 0;
          const graphStats = { mean: Math.round(mean * 10) / 10, q3: Math.round(q3 * 10) / 10, max: Math.round(result.maxValue * 10) / 10 };
          graphRingData.set(i, { points: result.points, maxValue: result.maxValue, graphStats });
          console.log(`[Controller]   Graph data: ${result.points.length} points, mean: ${graphStats.mean}, Q3: ${graphStats.q3}, max: ${graphStats.max}`);
          queryGenomes.push({ id: `graph-${ring.id}`, name: ring.legendText, sequence: '', length: 0, gcContent: 0, isCircular: false });
          continue;
        }

        // Parse all files and merge sequences
        const allSequences: string[] = [];
        let totalLength = 0;

        for (let j = 0; j < ring.files.length; j++) {
          console.log(`[Controller]   Parsing file ${j + 1}/${ring.files.length}: ${ring.files[j].name}`);
          const genomes = await this.parseGenomes(ring.files[j]);

          for (const genome of genomes) {
            allSequences.push(genome.sequence);
            totalLength += genome.sequence.length;
          }
        }

        if (allSequences.length === 0) {
          console.warn(`[Controller]   Warning: ${ring.legendText} has no sequences, skipping`);
          skippedRingIndices.add(i);
          queryGenomes.push({
            id: `empty-${ring.id}`,
            name: ring.legendText,
            sequence: '',
            length: 0,
            gcContent: 0,
            isCircular: false,
          });
          continue;
        }

        // Merge all sequences into a single genome for this ring
        const mergedGenome: ParsedGenome = {
          id: `merged-${ring.id}`,
          name: ring.legendText,
          sequence: allSequences.join('N'.repeat(100)), // Join with 100 N's as spacer
          length: totalLength + (allSequences.length - 1) * 100,
          gcContent: 0, // Will be calculated if needed
          isCircular: false
        };

        console.log(`[Controller]   Ring merged: ${allSequences.length} sequences -> ${mergedGenome.length} bp total`);
        queryGenomes.push(mergedGenome);
      }

      // Run alignments across worker pool
      console.log(`[Controller] Step 4: Running alignments for ${queryGenomes.length} rings`);
      this.updateProgress('Running alignments', 20);

      const needsAlignment = queryGenomes.some((_, index) => (
        !graphRingData.has(index) && !skippedRingIndices.has(index)
      ));
      if (needsAlignment) await this.ensureAlignmentWorkers();
      
      const alignmentResults: Array<{ result: AlignmentResult; rawOutput: string } | null> = new Array(queryGenomes.length).fill(null);

      // Process rings with worker pool (max 4 concurrent)
      let nextRingIndex = 0;
      const maxConcurrent = needsAlignment
        ? Math.min(ALIGNMENT_WORKER_COUNT, this.alignmentWorkers.length)
        : Math.min(1, queryGenomes.length);

      const processNextRing = async (workerIndex: number): Promise<void> => {
        while (nextRingIndex < queryGenomes.length) {
          const ringIndex = nextRingIndex++;
          const query = queryGenomes[ringIndex];
          const ring = rings[ringIndex];

          // Skip graph rings - they don't need BLAST alignment
          if (graphRingData.has(ringIndex)) {
            console.log(`[Controller] Skipping alignment for graph ring: ${ring.legendText}`);
            alignmentResults[ringIndex] = emptyAlignment(ring, 0, 'graph');
            continue;
          }

          if (skippedRingIndices.has(ringIndex)) {
            alignmentResults[ringIndex] = emptyAlignment(ring, 0, 'skipped');
            continue;
          }

          this.updateProgress(
            `Aligning ${ring.legendText}`,
            Math.round(20 + ((ringIndex + 1) / queryGenomes.length) * 50),
            `${ringIndex + 1}/${queryGenomes.length}`
          );

          const cacheKey = createAlignmentCacheKey(referenceFile, ring, params);
          let result: { result: AlignmentResult; rawOutput: string };

          if (!params.forceAlignment && this.alignmentCache.has(cacheKey)) {
            console.log(`[Controller] Using cached alignment for ${query.name}`);
            const cachedResult = this.alignmentCache.get(cacheKey)!;
            result = { result: cachedResult, rawOutput: '' };
          } else {
            console.log(`[Controller] Aligning ${query.name} (${query.length} bp)`);
            try {
              result = await this.alignWithWorker(
                this.alignmentWorkers[workerIndex],
                reference,
                query,
                {
                  ...params,
                  blastProgram: ring.blastType ?? params.blastProgram,
                },
              );
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              throw new Error(`Alignment failed for ${query.name}: ${message}`);
            }
            this.alignmentCache.set(cacheKey, result.result);
          }

          alignmentResults[ringIndex] = result;
          console.log(`[Controller] Ring ${ringIndex + 1}/${queryGenomes.length} completed: ${result.result.hits?.length || 0} hits`);
        }
      };
      
      // Start worker pool
      const workerOutcomes = await Promise.allSettled(
        Array.from({ length: maxConcurrent }, (_, i) => processNextRing(i))
      );
      const failedWorker = workerOutcomes.find(
        (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
      );
      if (failedWorker) throw failedWorker.reason;
      
      console.log(`[Controller] All ${alignmentResults.length} alignments completed`);

      // Build ring data with inline stats computation
      console.log(`[Controller] Step 5: Building ring data`);
      this.updateProgress('Processing alignment data', 70);
      const ringDataArray: RingData[] = [];

      for (let i = 0; i < alignmentResults.length; i++) {
        const ring = rings[i];
        const alignResult = alignmentResults[i];
        if (!alignResult) continue; // Should not happen, but guard

        console.log(`[Controller] Processing ring ${i + 1}/${alignmentResults.length}: ${ring.legendText}`);

        this.updateProgress(
          'Processing alignment data',
          Math.round(70 + ((i + 1) / alignmentResults.length) * 25),
          `${i + 1}/${alignmentResults.length}`
        );

        const statistics = this.computeRingStats(
          alignResult.result.hits,
          reference.length,
          params.minIdentity,
          params.minAlignmentLength
        );

        const ringData: RingData = {
          queryId: ring.id,
          queryName: alignResult.result.queryName,
          color: ring.color,
          visible: true,
          hits: alignResult.result.hits,
          alignmentOutput: alignResult.rawOutput,
          upperThreshold: ring.upperThreshold,
          lowerThreshold: ring.lowerThreshold,
          statistics
        };

        // Add graph data if this is a graph ring
        const graphData = graphRingData.get(i);
        if (graphData) {
          ringData.graphPoints = graphData.points;
          ringData.graphMaxValue = graphData.maxValue;
          ringData.graphStats = graphData.graphStats;
        }

        ringDataArray.push(ringData);
        console.log(`[Controller] Ring ${i + 1} processed: ${ringData.hits?.length || 0} hits`);
        
        // Send partial data after each ring is processed
        if (this.progressCallback) {
          this.progressCallback({
            step: `Ring ${i + 1}/${alignmentResults.length} processed`,
            percent: Math.round(70 + ((i + 1) / alignmentResults.length) * 25),
            partialData: {
              reference: {
                name: reference.name,
                length: reference.length,
                gcContent,
                gcSkew,
                features: referenceFeatures,
                contigs: contigBoundaries
              },
              rings: [...ringDataArray], // Send all rings processed so far
              config: {
                minIdentity: params.minIdentity,
                minAlignmentLength: params.minAlignmentLength
              }
            }
          });
        }
      }

      console.log(`[Controller] All ${ringDataArray.length} rings processed: ${ringDataArray.map(r => `${r.queryName} (${r.hits?.length || 0} hits, ${r.statistics.genomeCoverage.toFixed(1)}% coverage)`).join(', ')}`);
      
      this.updateProgress('Finalizing', 95);

      const finalData: CircularPlotData = {
        reference: {
          name: reference.name,
          length: reference.length,
          gcContent,
          gcSkew,
          features: referenceFeatures,
          contigs: contigBoundaries
        },
        rings: ringDataArray,
        config: {
          minIdentity: params.minIdentity,
          minAlignmentLength: params.minAlignmentLength
        }
      };

      console.log(`[Controller] Pipeline complete: ${finalData.reference.name} (${(finalData.reference.length / 1_000_000).toFixed(2)} Mbp), ${finalData.rings.length} rings`);
      
      // Return complete plot data
      return finalData;
    } catch (error) {
      // A worker that failed or timed out is not safe to reuse. Keep parsed
      // files and successful alignment cache entries, but rebuild the pool on retry.
      this.resetAlignmentWorkers();
      console.error('Pipeline error:', error);
      throw error;
    }
  }

  cleanup() {
    this.parserWorker?.terminate();
    this.parserWorker = undefined;
    this.resetAlignmentWorkers();
    this.progressCallback = undefined;
  }
}

// Application Controller - Orchestrates the entire pipeline
import type {
  ParsedGenome,
  AlignmentHit,
  AlignmentResult,
  CircularPlotData,
  RingData,
  RingConfig,
  PipelineParams,
  ProgressUpdate
} from './types';

const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
];

export class BRIGController {
  private parserWorker?: Worker;
  private alignmentWorkers: Worker[] = [];
  private progressCallback?: (update: ProgressUpdate) => void;
  private alignmentCache: Map<string, AlignmentResult> = new Map();

  async initialize() {
    console.log('[Controller] Starting initialization...');
    
    // Initialize parser worker
    console.log('[Controller] Creating parser worker...');
    this.parserWorker = new Worker(
      new URL('../workers/parser.worker.ts', import.meta.url),
      { type: 'module' }
    );
    console.log('[Controller] Parser worker created');

    // Initialize alignment workers (4 workers for balanced performance)
    const numWorkers = 4;
    console.log(`[Controller] Initializing ${numWorkers} alignment workers...`);
    
    for (let i = 0; i < numWorkers; i++) {
      console.log(`[Controller] Creating alignment worker ${i + 1}/${numWorkers}...`);
      const worker = new Worker(
        new URL('../workers/alignment.worker.ts', import.meta.url),
        { type: 'module' }
      );
      this.alignmentWorkers.push(worker);
      
      // Initialize BLAST aligner in each worker
      console.log(`[Controller] Initializing BLAST in worker ${i + 1}...`);
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Worker ${i + 1} initialization timeout`));
        }, 30000);
        
        worker.onmessage = (e) => {
          if (e.data.type === 'initialized') {
            console.log(`[Controller] Worker ${i + 1} initialized successfully`);
            clearTimeout(timeout);
            resolve();
          } else if (e.data.type === 'error') {
            console.error(`[Controller] Worker ${i + 1} initialization error:`, e.data.error);
            clearTimeout(timeout);
            reject(new Error(e.data.error));
          }
        };
        worker.onerror = (error) => {
          console.error(`[Controller] Worker ${i + 1} error:`, error);
          clearTimeout(timeout);
          reject(error);
        };
        worker.postMessage({ type: 'init' });
      });
    }
    console.log('[Controller] All workers initialized successfully');
  }

  private updateProgress(step: string, percent: number, message?: string) {
    if (this.progressCallback) {
      this.progressCallback({ step, percent, message });
    }
  }

  private async parseGenome(file: File): Promise<ParsedGenome> {
    console.log(`[Controller] Parsing genome: ${file.name}`);
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
          reject(new Error(e.data.error));
        }
      };

      console.log('[Controller] Sending parse request');
      this.parserWorker.postMessage({ type: 'parse', file });
    });
  }

  private async mergeGenomes(genomes: ParsedGenome[]): Promise<ParsedGenome> {
    console.log(`[Controller] Merging ${genomes.length} genomes`);
    return new Promise((resolve, reject) => {
      if (!this.parserWorker) {
        reject(new Error('Parser worker not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Genome merge timeout'));
      }, 30000); // 30 second timeout

      this.parserWorker.onmessage = (e) => {
        if (e.data.type === 'merged') {
          clearTimeout(timeout);
          console.log(`[Controller] Merged genome: ${e.data.genome.name}`);
          resolve(e.data.genome);
        } else if (e.data.type === 'error') {
          clearTimeout(timeout);
          reject(new Error(e.data.error));
        }
      };

      console.log('[Controller] Sending merge request');
      this.parserWorker.postMessage({ type: 'merge', genomes });
    });
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
          reject(new Error(e.data.error));
        }
      };

      console.log('[Controller] Sending parse request');
      this.parserWorker.postMessage({ type: 'parse', file });
    });
  }

  private async calculateGC(sequence: string, windowSize: number): Promise<number[]> {
    console.log(`[Controller] Calculating GC content, window size: ${windowSize}`);
    return new Promise((resolve, reject) => {
      if (!this.parserWorker) {
        console.error('[Controller] Parser worker not initialized for GC');
        reject(new Error('Parser worker not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        console.error('[Controller] GC calculation timeout');
        reject(new Error('GC calculation timeout'));
      }, 60000);

      this.parserWorker.onmessage = (e) => {
        if (e.data.type === 'gc') {
          console.log(`[Controller] GC content calculated: ${e.data.gcContent.length} windows`);
          clearTimeout(timeout);
          resolve(e.data.gcContent);
        } else if (e.data.type === 'error') {
          console.error('[Controller] GC calculation error:', e.data.error);
          clearTimeout(timeout);
          reject(new Error(e.data.error));
        }
      };

      console.log('[Controller] Sending GC calculation request');
      this.parserWorker.postMessage({ type: 'gc', sequence, windowSize });
    });
  }

  private async calculateGCSkew(sequence: string, windowSize: number): Promise<number[]> {
    console.log('[Controller] Calculating GC Skew with windowSize:', windowSize);
    return new Promise((resolve, reject) => {
      if (!this.parserWorker) {
        console.error('[Controller] Parser worker not initialized for GC Skew');
        reject(new Error('Parser worker not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        console.error('[Controller] GC Skew calculation timeout');
        reject(new Error('GC Skew calculation timeout'));
      }, 60000);

      this.parserWorker.onmessage = (e) => {
        if (e.data.type === 'gcSkew') {
          console.log(`[Controller] GC Skew calculated: ${e.data.gcSkew.length} windows`);
          clearTimeout(timeout);
          resolve(e.data.gcSkew);
        } else if (e.data.type === 'error') {
          console.error('[Controller] GC Skew calculation error:', e.data.error);
          clearTimeout(timeout);
          reject(new Error(e.data.error));
        }
      };

      console.log('[Controller] Sending GC Skew calculation request');
      this.parserWorker.postMessage({ type: 'gcSkew', sequence, windowSize });
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
      const timeout = setTimeout(() => {
        console.error(`[Controller] Alignment timeout for ${query.name}`);
        reject(new Error(`Alignment timeout for ${query.name}`));
      }, 300000); // 5 minutes

      worker.onmessage = (e) => {
        console.log(`[Controller] Received message from worker for ${query.name}, type: ${e.data.type}`);
        if (e.data.type === 'aligned') {
          console.log(`[Controller] Alignment completed for ${query.name}`);
          console.log(`[Controller] Alignment result:`, {
            queryId: e.data.result.queryId,
            queryName: e.data.result.queryName,
            hitsCount: e.data.result.hits?.length || 0,
            rawOutputLength: e.data.rawOutput?.length || 0
          });
          clearTimeout(timeout);
          resolve({ result: e.data.result, rawOutput: e.data.rawOutput });
        } else if (e.data.type === 'error') {
          console.error(`[Controller] Alignment error for ${query.name}:`, e.data.error);
          clearTimeout(timeout);
          reject(new Error(e.data.error));
        } else {
          console.warn(`[Controller] Unexpected message type for ${query.name}:`, e.data.type);
        }
      };

      console.log(`[Controller] Sending alignment request for ${query.name}`);
      worker.postMessage({
        type: 'align',
        referenceName: reference.name,
        referenceSeq: reference.sequence,
        queryName: query.name,
        querySeq: query.sequence,
        params
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
    annotationFiles: File[],
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
      
      // Validate reference has only one sequence
      if (referenceGenomes.length === 0) {
        throw new Error('Reference file contains no sequences');
      }
      if (referenceGenomes.length > 1) {
        throw new Error(`Reference file must contain exactly ONE sequence, but found ${referenceGenomes.length}. Please use a single-sequence FASTA file as reference.`);
      }
      
      const reference = referenceGenomes[0];
      console.log(`[Controller] Reference parsed: ${reference.name}, length: ${reference.length}`);
      
      // Calculate GC content
      console.log('[Controller] Step 2: Calculating GC content');
      this.updateProgress('Calculating GC content', 10);
      const gcWindowSize = 1000; // Fixed window size for GC resolution
      const gcContent = await this.calculateGC(reference.sequence, gcWindowSize);
      console.log(`[Controller] GC content calculated: ${gcContent.length} windows`);

      // Calculate GC Skew
      console.log('[Controller] Step 2b: Calculating GC Skew');
      this.updateProgress('Calculating GC Skew', 11);
      const gcSkew = await this.calculateGCSkew(reference.sequence, gcWindowSize);
      console.log(`[Controller] GC Skew calculated: ${gcSkew.length} windows`);

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
              features: []
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
      console.log('[Controller] Step 3: Preparing query genomes for rings');
      this.updateProgress('Preparing query genomes', 15);
      
      const queryGenomes: ParsedGenome[] = [];
      
      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        console.log(`[Controller] Processing ring ${i + 1}/${rings.length}: ${ring.legendText} with ${ring.files.length} files`);
        
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
      
      const alignmentResults: Array<{ result: AlignmentResult; rawOutput: string }> = [];
      
      // Process rings with worker pool (max 4 concurrent)
      let activeWorkers = 0;
      let nextRingIndex = 0;
      const maxConcurrent = Math.min(4, this.alignmentWorkers.length);
      
      const processNextRing = async (workerIndex: number): Promise<void> => {
        while (nextRingIndex < queryGenomes.length) {
          const ringIndex = nextRingIndex++;
          const query = queryGenomes[ringIndex];
          const ring = rings[ringIndex];
          
          this.updateProgress(
            `Aligning ${ring.legendText}`,
            Math.round(20 + ((ringIndex + 1) / queryGenomes.length) * 50),
            `${ringIndex + 1}/${queryGenomes.length}`
          );
          
          try {
            const cacheKey = `${reference.name}:${query.name}`;
            let result: { result: AlignmentResult; rawOutput: string };
            
            if (!params.forceAlignment && this.alignmentCache.has(cacheKey)) {
              console.log(`[Controller] Using cached alignment for ${query.name}`);
              const cachedResult = this.alignmentCache.get(cacheKey)!;
              result = { result: cachedResult, rawOutput: '' };
            } else {
              console.log(`[Controller] Aligning ${query.name} (${query.length} bp)`);
              result = await this.alignWithWorker(
                this.alignmentWorkers[workerIndex],
                reference,
                query,
                params
              );
              this.alignmentCache.set(cacheKey, result.result);
            }
            
            alignmentResults.push(result);
            console.log(`[Controller] Ring ${ringIndex + 1}/${queryGenomes.length} completed: ${result.result.hits?.length || 0} hits`);
          } catch (error: any) {
            console.error(`[Controller] Alignment error for ${query.name}:`, error);
            // Push empty result to maintain array alignment
            alignmentResults.push({
              result: {
                queryId: ring.id,
                queryName: ring.legendText,
                queryLength: query.length,
                totalHits: 0,
                hits: [],
                metadata: { timestamp: Date.now(), alignerVersion: 'BLAST', parameters: params }
              },
              rawOutput: ''
            });
          }
        }
      };
      
      // Start worker pool
      await Promise.all(
        Array.from({ length: maxConcurrent }, (_, i) => processNextRing(i))
      );
      
      console.log(`[Controller] All ${alignmentResults.length} alignments completed`);

      // Build ring data with inline stats computation
      console.log(`[Controller] Step 5: Building ring data`);
      this.updateProgress('Processing alignment data', 70);
      const ringDataArray: RingData[] = [];

      for (let i = 0; i < alignmentResults.length; i++) {
        const ring = rings[i];
        const alignResult = alignmentResults[i];

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
          statistics
        };

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
                features: []
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

      console.log(`[Controller] All ${ringDataArray.length} rings processed successfully`);
      console.log(`[Controller] Ring summary:`, ringDataArray.map(r => ({
        name: r.queryName,
        hits: r.hits?.length || 0,
        visible: r.visible
      })));
      
      this.updateProgress('Finalizing', 95);

      const finalData: CircularPlotData = {
        reference: {
          name: reference.name,
          length: reference.length,
          gcContent,
          gcSkew,
          features: []
        },
        rings: ringDataArray,
        config: {
          minIdentity: params.minIdentity,
          minAlignmentLength: params.minAlignmentLength
        }
      };

      console.log('[Controller] Returning final plot data with structure:', {
        referenceName: finalData.reference.name,
        referenceLength: finalData.reference.length,
        ringsCount: finalData.rings.length,
        gcContentWindows: finalData.reference.gcContent?.length || 0,
        gcSkewWindows: finalData.reference.gcSkew?.length || 0
      });
      console.log('[Controller] === Pipeline Complete ===');
      
      // Return complete plot data
      return finalData;
    } catch (error) {
      console.error('Pipeline error:', error);
      throw error;
    }
  }

  cleanup() {
    this.parserWorker?.terminate();
    this.alignmentWorkers.forEach(w => w.terminate());
  }
}

// Application Controller - Orchestrates the entire pipeline
import type {
  ParsedGenome,
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
  private processingWorker?: Worker;
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

    // Initialize processing worker
    console.log('[Controller] Creating processing worker...');
    this.processingWorker = new Worker(
      new URL('../workers/processing.worker.ts', import.meta.url),
      { type: 'module' }
    );
    console.log('[Controller] Processing worker created');

    // Initialize alignment workers (one per core)
    const numWorkers = Math.min(navigator.hardwareConcurrency || 4, 8);
    console.log(`[Controller] Initializing ${numWorkers} alignment workers...`);
    
    for (let i = 0; i < numWorkers; i++) {
      console.log(`[Controller] Creating alignment worker ${i + 1}/${numWorkers}...`);
      const worker = new Worker(
        new URL('../workers/alignment.worker.ts', import.meta.url),
        { type: 'module' }
      );
      this.alignmentWorkers.push(worker);
      
      // Initialize LASTZ in each worker
      console.log(`[Controller] Initializing LASTZ in worker ${i + 1}...`);
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Worker ${i + 1} initialization timeout`));
        }, 30000); // 30 second timeout
        
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
        if (e.data.type === 'aligned') {
          console.log(`[Controller] Alignment completed for ${query.name}`);
          clearTimeout(timeout);
          resolve({ result: e.data.result, rawOutput: e.data.rawOutput });
        } else if (e.data.type === 'error') {
          console.error(`[Controller] Alignment error for ${query.name}:`, e.data.error);
          clearTimeout(timeout);
          reject(new Error(e.data.error));
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

  private async processAlignmentToRing(
    alignment: AlignmentResult,
    referenceLength: number,
    params: PipelineParams,
    color: string,
    lastzOutput: string
  ): Promise<RingData> {
    return new Promise((resolve, reject) => {
      if (!this.processingWorker) {
        reject(new Error('Processing worker not initialized'));
        return;
      }

      this.processingWorker.onmessage = (e) => {
        if (e.data.type === 'processed') {
          // Add raw hits and LASTZ output to ring data
          const ringData = e.data.ringData;
          ringData.hits = alignment.hits;
          ringData.lastzOutput = lastzOutput;
          resolve(ringData);
        } else if (e.data.type === 'error') {
          reject(new Error(e.data.error));
        }
      };

      this.processingWorker.postMessage({
        type: 'process',
        alignments: alignment.hits,
        referenceLength,
        windowSize: params.windowSize,
        minIdentity: params.minIdentity,
        minLength: params.minAlignmentLength,
        queryId: alignment.queryId,
        queryName: alignment.queryName,
        color
      });
    });
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
      const gcContent = await this.calculateGC(reference.sequence, params.windowSize);
      console.log(`[Controller] GC content calculated: ${gcContent.length} windows`);

      // Calculate GC Skew
      console.log('[Controller] Step 2b: Calculating GC Skew');
      this.updateProgress('Calculating GC Skew', 11);
      const gcSkew = await this.calculateGCSkew(reference.sequence, params.windowSize);
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
              windowSize: params.windowSize,
              minIdentity: params.minIdentity,
              minAlignmentLength: params.minAlignmentLength
            }
          }
        });
      }

      // Parse and prepare query genomes for each ring
      console.log('[Controller] Step 3: Preparing query genomes for rings');
      this.updateProgress('Preparing query genomes', 15);
      const queries: ParsedGenome[] = [];
      
      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        console.log(`[Controller] Processing ring ${i + 1}/${rings.length}: ${ring.legendText} with ${ring.files.length} files`);
        
        // Parse all files in this ring
        const allGenomesInRing: ParsedGenome[] = [];
        for (let j = 0; j < ring.files.length; j++) {
          console.log(`[Controller]   Parsing file ${j + 1}/${ring.files.length}: ${ring.files[j].name}`);
          const genomes = await this.parseGenomes(ring.files[j]);
          allGenomesInRing.push(...genomes);
        }
        
        console.log(`[Controller]   Total sequences in ring: ${allGenomesInRing.length}`);
        
        if (allGenomesInRing.length === 0) {
          console.warn(`[Controller]   Warning: ${ring.legendText} has no sequences, skipping`);
          continue;
        }
        
        // Merge all sequences in this ring into one query
        let query: ParsedGenome;
        if (allGenomesInRing.length > 1) {
          console.log(`[Controller]   Merging ${allGenomesInRing.length} sequences for ${ring.legendText}`);
          query = await this.mergeGenomes(allGenomesInRing);
          // Override name with ring legend text
          query.name = ring.legendText;
        } else {
          query = allGenomesInRing[0];
          query.name = ring.legendText; // Use ring name instead of file name
        }
        
        queries.push(query);
        console.log(`[Controller]   Ring prepared: ${query.name}, length: ${query.length}`);
      }

      // Run alignments in parallel (using all 8 workers)
      console.log(`[Controller] Step 4: Running ${queries.length} alignments in parallel with ${this.alignmentWorkers.length} workers`);
      this.updateProgress('Running alignments', 20);
      const alignmentResults: Array<{ result: AlignmentResult; rawOutput: string }> = [];
      const workerPool = [...this.alignmentWorkers];
      let completed = 0;
      const totalQueries = queries.length;

      const runNextAlignment = async (workerIndex: number): Promise<void> => {
        while (queries.length > 0) {
          const query = queries.shift();
          if (!query) break;

          this.updateProgress(
            `Aligning ${query.name}`,
            20 + (completed / totalQueries) * 50,
            `${completed + 1}/${totalQueries}`
          );

          try {
            // Check cache if not forcing realignment
            const cacheKey = `${reference.name}:${query.name}`;
            let result: { result: AlignmentResult; rawOutput: string };
            
            if (!params.forceAlignment && this.alignmentCache.has(cacheKey)) {
              console.log(`[Controller] Using cached alignment for ${query.name}`);
              const cachedResult = this.alignmentCache.get(cacheKey)!;
              result = { result: cachedResult, rawOutput: '' }; // Use empty string for cached
            } else {
              console.log(`[Controller] Running fresh alignment for ${query.name}`);
              result = await this.alignWithWorker(
                workerPool[workerIndex],
                reference,
                query,
                params
              );
              // Cache the result
              this.alignmentCache.set(cacheKey, result.result);
            }
            
            alignmentResults.push(result);
            completed++;
          } catch (error) {
            console.error(`Error aligning ${query.name}:`, error);
            // Continue with other alignments
          }
        }
      };

      await Promise.all(workerPool.map((_, i) => runNextAlignment(i)));

      // Process alignments to rings
      this.updateProgress('Processing alignment data', 70);
      const ringDataArray: RingData[] = [];
      
      for (let i = 0; i < alignmentResults.length; i++) {
        const { result: alignment, rawOutput } = alignmentResults[i];
        const ringConfig = rings[i]; // Use the corresponding ring config
        const color = ringConfig.color;
        
        this.updateProgress(
          'Processing alignment data',
          70 + (i / alignmentResults.length) * 25,
          `${i + 1}/${alignmentResults.length}`
        );

        const ringData = await this.processAlignmentToRing(
          alignment,
          reference.length,
          params,
          color,
          rawOutput
        );
        ringDataArray.push(ringData);
        
        // Send partial data after each ring is processed
        if (this.progressCallback) {
          this.progressCallback({
            step: `Ring ${i + 1}/${alignmentResults.length} processed`,
            percent: 70 + ((i + 1) / alignmentResults.length) * 25,
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
                windowSize: params.windowSize,
                minIdentity: params.minIdentity,
                minAlignmentLength: params.minAlignmentLength
              }
            }
          });
        }
      }

      this.updateProgress('Finalizing', 95);

      // Return complete plot data
      return {
        reference: {
          name: reference.name,
          length: reference.length,
          gcContent,
          gcSkew,
          features: []
        },
        rings: ringDataArray,
        config: {
          windowSize: params.windowSize,
          minIdentity: params.minIdentity,
          minAlignmentLength: params.minAlignmentLength
        }
      };
    } catch (error) {
      console.error('Pipeline error:', error);
      throw error;
    }
  }

  cleanup() {
    this.parserWorker?.terminate();
    this.processingWorker?.terminate();
    this.alignmentWorkers.forEach(w => w.terminate());
  }
}

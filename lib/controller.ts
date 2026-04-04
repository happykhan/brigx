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
import { extractGenBankFeatures } from '../workers/parser.worker';
import { parseSAMCoverage } from '@/lib/samParser';
import { parseGraphFile } from '@/lib/graphParser';


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
          console.log(`[Controller] Alignment completed for ${query.name}: ${e.data.result.hits?.length || 0} hits`);
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
        params,
        blastProgram: params.blastProgram
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
          const refText = await referenceFile.text();
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

      // Calculate GC content
      console.log('[Controller] Step 2: Calculating GC content');
      this.updateProgress('Calculating GC content', 10);
      // Adapt window size to reference length: aim for ~500-5000 windows
      // For small genomes (<50kb), use smaller windows to maintain resolution
      const gcWindowSize = Math.max(10, Math.min(1000, Math.floor(reference.length / 500)));
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

      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        console.log(`[Controller] Processing ring ${i + 1}/${rings.length}: ${ring.legendText} with ${ring.files.length} files`);

        // Check if any file is a .sam or .graph file
        const samFile = ring.files.find(f => f.name.toLowerCase().endsWith('.sam'));
        const graphFile = ring.files.find(f => {
          const name = f.name.toLowerCase();
          return name.endsWith('.graph') || name.endsWith('.bedgraph') || name.endsWith('.wig');
        });

        if (samFile) {
          console.log(`[Controller]   SAM file detected: ${samFile.name}, computing coverage`);
          const content = await samFile.text();
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
          const content = await graphFile.text();
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
      
      const alignmentResults: Array<{ result: AlignmentResult; rawOutput: string } | null> = new Array(queryGenomes.length).fill(null);

      // Process rings with worker pool (max 4 concurrent)
      let nextRingIndex = 0;
      const maxConcurrent = Math.min(4, this.alignmentWorkers.length);

      const processNextRing = async (workerIndex: number): Promise<void> => {
        while (nextRingIndex < queryGenomes.length) {
          const ringIndex = nextRingIndex++;
          const query = queryGenomes[ringIndex];
          const ring = rings[ringIndex];

          // Skip graph rings - they don't need BLAST alignment
          if (graphRingData.has(ringIndex)) {
            console.log(`[Controller] Skipping alignment for graph ring: ${ring.legendText}`);
            alignmentResults[ringIndex] = {
              result: {
                queryId: ring.id,
                queryName: ring.legendText,
                queryLength: 0,
                totalHits: 0,
                hits: [],
                metadata: { timestamp: Date.now(), alignerVersion: 'graph', parameters: {} }
              },
              rawOutput: ''
            };
            continue;
          }

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

            alignmentResults[ringIndex] = result;
            console.log(`[Controller] Ring ${ringIndex + 1}/${queryGenomes.length} completed: ${result.result.hits?.length || 0} hits`);
          } catch (error: any) {
            console.error(`[Controller] Alignment error for ${query.name}:`, error);
            alignmentResults[ringIndex] = {
              result: {
                queryId: ring.id,
                queryName: ring.legendText,
                queryLength: query.length,
                totalHits: 0,
                hits: [],
                metadata: { timestamp: Date.now(), alignerVersion: 'BLAST', parameters: params }
              },
              rawOutput: ''
            };
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
          features: [],
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
      console.error('Pipeline error:', error);
      throw error;
    }
  }

  cleanup() {
    this.parserWorker?.terminate();
    this.alignmentWorkers.forEach(w => w.terminate());
  }
}

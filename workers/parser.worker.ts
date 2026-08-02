// Typed Web Worker adapter around the canonical genome parser.
import type { ParsedGenome } from '../lib/types';
import {
  calculateGCSkewWindows,
  calculateGCWindows,
  mergeGenomes,
  parseFile,
} from '../lib/genomeParser';

type ParserRequest =
  | { type: 'parse'; file: File }
  | { type: 'gc'; sequence: string; windowSize: number }
  | { type: 'gcSkew'; sequence: string; windowSize: number }
  | { type: 'gcMetrics'; sequence: string; windowSize: number }
  | { type: 'merge'; genomes: ParsedGenome[] };

interface ParserWorkerScope {
  onmessage: ((event: MessageEvent<ParserRequest>) => void) | null;
  postMessage(message: unknown): void;
}

const parserWorkerScope = typeof self === 'undefined'
  ? null
  : self as unknown as ParserWorkerScope;

if (parserWorkerScope && typeof document === 'undefined') {
  parserWorkerScope.onmessage = async event => {
    const request = event.data;
    try {
      if (request.type === 'parse') {
        parserWorkerScope.postMessage({
          type: 'parsed',
          genomes: await parseFile(request.file),
        });
      } else if (request.type === 'gc') {
        parserWorkerScope.postMessage({
          type: 'gc',
          gcContent: calculateGCWindows(request.sequence, request.windowSize),
        });
      } else if (request.type === 'gcSkew') {
        parserWorkerScope.postMessage({
          type: 'gcSkew',
          gcSkew: calculateGCSkewWindows(request.sequence, request.windowSize),
        });
      } else if (request.type === 'gcMetrics') {
        parserWorkerScope.postMessage({
          type: 'gcMetrics',
          gcContent: calculateGCWindows(request.sequence, request.windowSize),
          gcSkew: calculateGCSkewWindows(request.sequence, request.windowSize),
        });
      } else {
        parserWorkerScope.postMessage({
          type: 'merged',
          genome: mergeGenomes(request.genomes),
        });
      }
    } catch (error) {
      parserWorkerScope.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

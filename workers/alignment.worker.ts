// Alignment Worker - Runs LASTZ alignments
import type { AlignmentResult, AlignmentHit } from '../lib/types';

let lastzModule: any = null;

async function initializeLastz() {
  if (lastzModule) {
    console.log('[Alignment Worker] LASTZ already initialized');
    return;
  }
  
  console.log('[Alignment Worker] Starting LASTZ initialization...');
  try {
    console.log('[Alignment Worker] Loading LASTZ module directly...');
    
    // Load LASTZ module script as text and execute it
    const response = await fetch('/wasm/lastz/1.04.52/lastz.js');
    if (!response.ok) {
      throw new Error(`Failed to fetch lastz.js: ${response.status}`);
    }
    
    const moduleText = await response.text();
    console.log('[LASTZ Worker] Module text loaded, length:', moduleText.length);
    
    // Create a function from the module text
    const moduleFactory = new Function('Module', moduleText + '; return Module;');
    
    // Initialize the module with our configuration
    const Module = moduleFactory({});
    
    // Initialize module with stdout/stderr capture
    lastzModule = await Module({
      locateFile: (path: string) => {
        console.log('[LASTZ Worker] locateFile:', path);
        if (path.endsWith('.wasm')) {
          return '/wasm/lastz/1.04.52/lastz.wasm';
        }
        return '/wasm/lastz/1.04.52/' + path;
      },
      print: (text: string) => {
        console.log('[LASTZ]', text);
        if (!lastzModule) {
          // During initialization, store in temp variable
          if (!Module.out) Module.out = '';
          Module.out += text + '\n';
        } else {
          // After initialization, append to module
          lastzModule.out = (lastzModule.out || '') + text + '\n';
        }
      },
      printErr: (text: string) => {
        console.error('[LASTZ Error]', text);
        if (!lastzModule) {
          if (!Module.err) Module.err = '';
          Module.err += text + '\n';
        } else {
          lastzModule.err = (lastzModule.err || '') + text + '\n';
        }
      }
    });
    
    // Copy any initialization output
    lastzModule.out = Module.out || '';
    lastzModule.err = Module.err || '';
    
    console.log('[Alignment Worker] LASTZ initialized successfully');
  } catch (error) {
    console.error('[Alignment Worker] LASTZ initialization failed:', error);
    throw error;
  }
}

function parseLastzOutput(output: string, queryName: string): AlignmentResult {
  const hits: AlignmentHit[] = [];
  const lines = output.trim().split('\n').filter(Boolean);
  
  console.log(`[Alignment Worker] Parsing ${lines.length} lines of BLASTN output`);
  
  for (const line of lines) {
    // Skip header lines and empty lines
    if (line.startsWith('#') || line.trim() === '') continue;
    
    // BLASTN format is space-separated with columns:
    // Query_id Subject_id %_identity alignment_length mismatches gap_opens q_start q_end s_start s_end e-value bit_score
    const fields = line.trim().split(/\s+/);
    if (fields.length < 12) {
      console.log('[Alignment Worker] Skipping line with insufficient fields:', line);
      continue;
    }
    
    const [queryId, refId, identity, alignLen, , , qStart, qEnd, sStart, sEnd] = fields;
    
    // Determine strand based on coordinate order
    const strand = parseInt(qStart) <= parseInt(qEnd) ? '+' : '-';
    const queryStart = Math.min(parseInt(qStart), parseInt(qEnd)) - 1; // Convert to 0-based
    const queryEnd = Math.max(parseInt(qStart), parseInt(qEnd));
    const refStart = Math.min(parseInt(sStart), parseInt(sEnd)) - 1;
    const refEnd = Math.max(parseInt(sStart), parseInt(sEnd));
    
    hits.push({
      queryName,
      refStart,
      refEnd,
      queryStart,
      queryEnd,
      percentIdentity: parseFloat(identity),
      alignmentLength: parseInt(alignLen),
      strand: strand as '+' | '-'
    });
  }
  
  console.log(`[Alignment Worker] Parsed ${hits.length} hits from BLASTN output`);
  
  return {
    queryId: `query_${Date.now()}`,
    queryName,
    queryLength: 0, // Will be filled later
    totalHits: hits.length,
    hits,
    metadata: {
      timestamp: Date.now(),
      lastzVersion: '1.04.52',
      parameters: {}
    }
  };
}

async function alignGenomes(
  referenceName: string,
  referenceSeq: string,
  queryName: string,
  querySeq: string,
  params: any
): Promise<{ alignmentResult: AlignmentResult; rawOutput: string }> {
  console.log(`[Alignment Worker] alignGenomes called for ${queryName}`);
  await initializeLastz();
  
  // Reset stdout/stderr
  lastzModule.out = '';
  lastzModule.err = '';
  
  console.log('[Alignment Worker] Writing sequences to virtual filesystem...');
  // Write sequences to virtual filesystem using Emscripten FS API
  const refFasta = `>${referenceName}\n${referenceSeq}\n`;
  const queryFasta = `>${queryName}\n${querySeq}\n`;
  
  lastzModule.FS.writeFile('/reference.fasta', refFasta);
  lastzModule.FS.writeFile('/query.fasta', queryFasta);
  console.log('[Alignment Worker] Files written, executing LASTZ...');
  
  // Run LASTZ with BLASTN format for parsing
  const args = [
    '/reference.fasta',
    '/query.fasta',
    '--format=BLASTN',
    '--ambiguous=iupac'
  ];
  console.log(`[Alignment Worker] Calling with args:`, args);
  
  // Call main function
  try {
    lastzModule.callMain(args);
    console.log(`[Alignment Worker] LASTZ execution complete`);
  } catch (e) {
    // LASTZ exits with code 0 but throws, capture stdout anyway
    console.log(`[Alignment Worker] LASTZ execution finished (exit throw caught)`);
  }
  
  // Check for errors
  const errorOutput = lastzModule.err || '';
  if (errorOutput && errorOutput.toLowerCase().includes('failure')) {
    console.error('[Alignment Worker] LASTZ error detected:', errorOutput);
    throw new Error(`LASTZ execution failed: ${errorOutput}`);
  }
  
  // Get the captured stdout
  const output = lastzModule.out || '';
  console.log(`[Alignment Worker] Output length: ${output.length}, first 500 chars:`, output.substring(0, 500));
  
  // Parse output
  const alignmentResult = parseLastzOutput(output, queryName);
  alignmentResult.queryLength = querySeq.length;
  console.log(`[Alignment Worker] Alignment complete: ${alignmentResult.totalHits} hits`);
  
  return { alignmentResult, rawOutput: output };
}

// Worker message handler
self.onmessage = async (e: MessageEvent) => {
  console.log('[Alignment Worker] Received message:', e.data.type);
  const { type, referenceName, referenceSeq, queryName, querySeq, params } = e.data;
  
  try {
    if (type === 'init') {
      console.log('[Alignment Worker] Init request received');
      await initializeLastz();
      console.log('[Alignment Worker] Sending initialized message');
      self.postMessage({ type: 'initialized' });
    } else if (type === 'align') {
      console.log(`[Alignment Worker] Starting alignment: ${queryName}`);
      const { alignmentResult, rawOutput } = await alignGenomes(
        referenceName,
        referenceSeq,
        queryName,
        querySeq,
        params
      );
      self.postMessage({ type: 'aligned', result: alignmentResult, rawOutput });
    }
  } catch (error: any) {
    self.postMessage({ type: 'error', error: error.message, stack: error.stack });
  }
};

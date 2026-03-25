// Alignment Worker - Runs BLAST (formatdb + blastall) alignments
import type { AlignmentResult, AlignmentHit } from '../lib/types';

// Cache module factories and WASM binaries
let formatdbFactory: any = null;
let formatdbWasmBinary: ArrayBuffer | null = null;
let blastallFactory: any = null;
let blastallWasmBinary: ArrayBuffer | null = null;

// Cache the formatdb index for the current reference
let cachedRefName: string | null = null;
let cachedDbFiles: Map<string, Uint8Array> | null = null;

async function loadModuleFactory(name: string): Promise<{ factory: any; wasmBinary: ArrayBuffer }> {
  const [jsResponse, wasmResponse] = await Promise.all([
    fetch(`/wasm/blast/${name}.js`),
    fetch(`/wasm/blast/${name}.wasm`)
  ]);

  if (!jsResponse.ok) throw new Error(`Failed to fetch ${name}.js: ${jsResponse.status}`);
  if (!wasmResponse.ok) throw new Error(`Failed to fetch ${name}.wasm: ${wasmResponse.status}`);

  const [moduleText, wasmBinary] = await Promise.all([
    jsResponse.text(),
    wasmResponse.arrayBuffer()
  ]);

  const moduleWrapper = new Function('Module', moduleText + '; return Module;');
  const factory = moduleWrapper({});
  return { factory, wasmBinary };
}

async function initializeBlast() {
  if (formatdbFactory && blastallFactory) {
    return;
  }

  console.log('[Alignment Worker] Loading BLAST modules...');
  const [formatdb, blastall] = await Promise.all([
    loadModuleFactory('formatdb'),
    loadModuleFactory('blastall')
  ]);

  formatdbFactory = formatdb.factory;
  formatdbWasmBinary = formatdb.wasmBinary;
  blastallFactory = blastall.factory;
  blastallWasmBinary = blastall.wasmBinary;

  console.log('[Alignment Worker] BLAST modules ready');
}

async function createModuleInstance(factory: any, wasmBinary: ArrayBuffer): Promise<any> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const mod = await factory({
    wasmBinary: wasmBinary.slice(0),
    print: (text: string) => { stdout.push(text); },
    printErr: (text: string) => { stderr.push(text); },
    noInitialRun: true
  });
  mod._stdout = stdout;
  mod._stderr = stderr;
  return mod;
}

async function buildDatabase(referenceName: string, referenceSeq: string): Promise<Map<string, Uint8Array>> {
  // Return cached index if reference hasn't changed
  if (cachedRefName === referenceName && cachedDbFiles) {
    console.log('[Alignment Worker] Using cached formatdb index');
    return cachedDbFiles;
  }

  console.log('[Alignment Worker] Building formatdb index...');
  const t1 = performance.now();

  const db = await createModuleInstance(formatdbFactory!, formatdbWasmBinary!);
  db.FS.writeFile('/ref.fna', `>${referenceName}\n${referenceSeq}\n`);

  try {
    db.callMain(['-i', '/ref.fna', '-p', 'F', '-n', '/ref']);
  } catch {
    // formatdb calls exit() which may throw
  }

  const errOutput = db._stderr.join('\n');
  if (errOutput.includes('FATAL') || errOutput.includes('ERROR')) {
    throw new Error(`formatdb failed: ${errOutput}`);
  }

  // Collect database files
  const dbFiles = new Map<string, Uint8Array>();
  const allFiles = db.FS.readdir('/') as string[];
  for (const f of allFiles) {
    if (f.startsWith('ref.')) {
      dbFiles.set(f, db.FS.readFile('/' + f));
    }
  }

  const t2 = performance.now();
  console.log(`[Alignment Worker] formatdb: ${dbFiles.size} files, ${Math.round(t2 - t1)}ms`);

  if (dbFiles.size === 0) {
    throw new Error('formatdb produced no output files');
  }

  // Cache for reuse with other queries against same reference
  cachedRefName = referenceName;
  cachedDbFiles = dbFiles;

  return dbFiles;
}

function parseBlast6Output(output: string, queryName: string, refLength: number): AlignmentResult {
  const hits: AlignmentHit[] = [];
  const lines = output.trim().split('\n').filter(Boolean);

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue;

    const fields = line.trim().split(/\s+/);
    if (fields.length < 12) continue;

    const [, , identity, alignLen, , , qStart, qEnd, sStart, sEnd, , bitScore] = fields;

    // BLAST m8: coordinates are 1-based
    // Strand is determined by whether sstart > send
    const sS = parseInt(sStart);
    const sE = parseInt(sEnd);
    const qS = parseInt(qStart);
    const qE = parseInt(qEnd);

    const strand = sS <= sE ? '+' : '-';
    const refStart = Math.min(sS, sE) - 1; // Convert to 0-based
    const refEnd = Math.max(sS, sE);
    const queryStart = Math.min(qS, qE) - 1;
    const queryEnd = Math.max(qS, qE);

    if (refEnd > refLength) continue;

    hits.push({
      queryName,
      refStart,
      refEnd,
      queryStart,
      queryEnd,
      percentIdentity: parseFloat(identity),
      alignmentLength: parseInt(alignLen),
      strand: strand as '+' | '-',
      score: parseFloat(bitScore)
    });
  }

  console.log(`[Alignment Worker] Parsed ${hits.length} hits from ${lines.length} BLAST6 lines`);

  return {
    queryId: `query_${Date.now()}`,
    queryName,
    queryLength: 0,
    totalHits: hits.length,
    hits,
    metadata: {
      timestamp: Date.now(),
      alignerVersion: 'BLAST',
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
  console.log(`[Alignment Worker] alignGenomes: ${queryName} (${querySeq.length}bp query, ${referenceSeq.length}bp ref)`);
  await initializeBlast();

  const refUpper = referenceSeq.toUpperCase();
  const queryUpper = querySeq.toUpperCase();

  // Step 1: Build formatdb index (cached if same reference)
  const dbFiles = await buildDatabase(referenceName, refUpper);

  // Step 2: Run blastall (blastn) alignment
  console.log('[Alignment Worker] Running blastn...');
  const t1 = performance.now();

  const al = await createModuleInstance(blastallFactory!, blastallWasmBinary!);

  // Write database files into blastall's filesystem
  for (const [name, data] of dbFiles) {
    al.FS.writeFile('/' + name, data);
  }
  al.FS.writeFile('/query.fna', `>${queryName}\n${queryUpper}\n`);

  const args = ['-p', 'blastn', '-d', '/ref', '-i', '/query.fna', '-m', '8', '-e', '1e-5', '-F', 'F', '-b', '1000000', '-v', '0'];

  // Add custom blastall options if provided
  if (params?.alignerOptions?.trim()) {
    const customArgs = params.alignerOptions.trim().split(/\s+/);
    args.push(...customArgs);
  }

  try {
    al.callMain(args);
  } catch {
    // blastall calls exit() which may throw
  }

  const t2 = performance.now();
  console.log(`[Alignment Worker] blastn: ${Math.round(t2 - t1)}ms`);

  const errOutput = al._stderr.join('\n');
  if (errOutput.includes('FATAL') || errOutput.includes('ERROR')) {
    throw new Error(`blastall failed: ${errOutput}`);
  }

  const output = al._stdout.join('\n');

  const alignmentResult = parseBlast6Output(output, queryName, refUpper.length);
  alignmentResult.queryLength = querySeq.length;
  console.log(`[Alignment Worker] ${alignmentResult.totalHits} hits`);

  return { alignmentResult, rawOutput: output };
}

// Worker message handler
self.onmessage = async (e: MessageEvent) => {
  console.log('[Alignment Worker] Received message:', e.data.type);
  const { type, referenceName, referenceSeq, queryName, querySeq, params } = e.data;

  try {
    if (type === 'init') {
      await initializeBlast();
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
    console.error('[Alignment Worker] Error caught:', error);
    self.postMessage({ type: 'error', error: error.message, stack: error.stack });
  }
};

// Custom LASTZ WASM Loader - bypasses Aioli for direct local loading
export async function loadLastzModule() {
  console.log('[LASTZ Loader] Loading LASTZ module directly...');
  
  // Dynamically import the lastz.js module
  const lastzModulePath = '/wasm/lastz/1.04.52/lastz.js';
  const wasmPath = '/wasm/lastz/1.04.52/lastz.wasm';
  
  try {
    // Fetch the module script as text
    const response = await fetch(lastzModulePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch lastz.js: ${response.status} ${response.statusText}`);
    }
    
    const moduleText = await response.text();
    console.log('[LASTZ Loader] Module script loaded, size:', moduleText.length);
    
    // Create a blob URL for the module
    const blob = new Blob([moduleText], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    
    // Import the module dynamically
    const Module = await import(/* webpackIgnore: true */ blobUrl);
    console.log('[LASTZ Loader] Module imported:', Module);
    
    // Initialize with custom locateFile
    const moduleInstance = await Module.default({
      locateFile: (path: string) => {
        console.log('[LASTZ Loader] locateFile called for:', path);
        if (path.endsWith('.wasm')) {
          return wasmPath;
        }
        return '/wasm/lastz/1.04.52/' + path;
      },
      print: (text: string) => console.log('[LASTZ]', text),
      printErr: (text: string) => console.error('[LASTZ Error]', text),
    });
    
    console.log('[LASTZ Loader] Module initialized successfully');
    return moduleInstance;
  } catch (error) {
    console.error('[LASTZ Loader] Failed to load:', error);
    throw error;
  }
}

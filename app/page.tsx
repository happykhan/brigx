'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import RingConfiguration from '@/components/RingConfiguration';
import ParameterControls from '@/components/ParameterControls';
import ProgressPanel from '@/components/ProgressPanel';
import CircularPlot from '@/components/CircularPlot';
import ExportPanel from '@/components/ExportPanel';
import ConsoleLog from '@/components/ConsoleLog';
import ImageProperties, { type ImagePropertiesConfig } from '@/components/ImageProperties';
import AnnotationEditor from '@/components/AnnotationEditor';
import type { CircularPlotData, PipelineParams, ProgressUpdate, RingConfig, Annotation } from '@/lib/types';
import type { BRIGController as BRIGControllerType } from '@/lib/controller';

export default function Home() {
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [rings, setRings] = useState<RingConfig[]>([]);
  
  // Store controller instance in ref to persist alignment cache across runs
  const controllerRef = useRef<BRIGControllerType | null>(null);
  const [params, setParams] = useState<PipelineParams>({
    windowSize: 1000,
    minIdentity: 70,
    minAlignmentLength: 100,
    colorScheme: 'blue-red',
    forceAlignment: false,
    lastzOptions: ''
  });
  const [progress, setProgress] = useState<ProgressUpdate>({ step: 'idle', percent: 0 });
  const [plotData, setPlotData] = useState<CircularPlotData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [cachedPlotData, setCachedPlotData] = useState<CircularPlotData | null>(null);
  const [imageProperties, setImageProperties] = useState<ImagePropertiesConfig>({
    innerRadius: 200,
    ringWidth: 30,
    gcRingWidth: 30,
    ringSpacing: 8,
    legendFontSize: 12,
    scaleFontSize: 12,
    titleFontSize: 24,
    labelFontSize: 14,
    title: ''
  });
  
  // Annotation editor state
  const [annotationEditorOpen, setAnnotationEditorOpen] = useState(false);
  const [editingRingId, setEditingRingId] = useState<string | null>(null);
  const [ringAnnotations, setRingAnnotations] = useState<Record<string, Annotation[]>>({});
  const [referenceLength, setReferenceLength] = useState<number>(0);

  // Intercept console.log messages
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args: any[]) => {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          // Don't log huge arrays like gcContent
          if (arg && typeof arg === 'object' && 'partialData' in arg) {
            const { partialData, ...rest } = arg;
            return JSON.stringify({ ...rest, partialData: '[...]' }, null, 2);
          }
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      }).join(' ');
      setConsoleLogs(prev => [...prev, `[LOG] ${message}`]);
      originalLog.apply(console, args);
    };

    console.error = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setConsoleLogs(prev => [...prev, `[ERROR] ${message}`]);
      originalError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setConsoleLogs(prev => [...prev, `[WARN] ${message}`]);
      originalWarn.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  // Handle annotation changes
  const handleAnnotationsChange = (ringId: string, annotations: Annotation[]) => {
    setRingAnnotations(prev => ({
      ...prev,
      [ringId]: annotations
    }));
    
    // Update plot data if it exists
    if (cachedPlotData && cachedPlotData.rings) {
      const updatedRings = cachedPlotData.rings.map(ringData => {
        if (ringData.queryId === ringId) {
          console.log(`[Page] Updating annotations for ring ${ringData.queryName}, preserving hits: ${ringData.hits?.length || 0}, windows: ${ringData.windows?.length || 0}`);
          return {
            ...ringData,
            annotations,
            // CRITICAL: Explicitly preserve alignment data
            hits: ringData.hits || [],
            windows: ringData.windows || [],
            statistics: ringData.statistics || { meanIdentity: 0, genomeCoverage: 0, totalAlignedBases: 0 },
            lastzOutput: ringData.lastzOutput || ''
          };
        }
        return ringData;
      });
      
      const updatedPlotData = {
        reference: cachedPlotData.reference,
        rings: updatedRings,
        config: cachedPlotData.config
      };
      
      setPlotData(updatedPlotData);
      setCachedPlotData(updatedPlotData);
    }
  };

  const handleOpenAnnotationEditor = (ringId: string) => {
    setEditingRingId(ringId);
    setAnnotationEditorOpen(true);
  };

  // Auto-generate plot skeleton when reference file is loaded
  useEffect(() => {
    if (referenceFile && !plotData) {
      console.log('[Page] Reference file loaded, generating plot skeleton...');
      generatePlotSkeleton();
    }
  }, [referenceFile]);

  // Generate initial plot structure without running alignments
  const generatePlotSkeleton = async () => {
    try {
      const { BRIGController } = await import('@/lib/controller');
      const controller = new BRIGController();
      await controller.initialize();
      
      // Run pipeline without any ring files to just get reference data (GC content/skew)
      const skeletonResult = await controller.runFullPipeline(
        referenceFile!,
        [], // No rings for alignment
        [],
        params,
        (update) => setProgress(update)
      );
      
      // Create ring placeholders for configured rings
      const ringPlaceholders = rings.map((ringConfig) => ({
        queryId: ringConfig.id,
        queryName: ringConfig.legendText,
        color: ringConfig.color,
        visible: true,
        customWidth: ringConfig.customWidth,
        hits: [],
        windows: [],
        annotations: ringAnnotations[ringConfig.id] || [],
        statistics: {
          meanIdentity: 0,
          genomeCoverage: 0,
          totalAlignedBases: 0
        }
      }));
      
      const plotDataWithRings = {
        ...skeletonResult,
        rings: ringPlaceholders
      };
      
      setPlotData(plotDataWithRings);
      setCachedPlotData(plotDataWithRings);
      setReferenceLength(skeletonResult.reference.length);
    } catch (error: any) {
      console.error('[Page] Error generating skeleton:', error);
      toast.error(`Error: ${error.message}`);
    }
  };

  // Auto-update plot when ring settings change (colors, thresholds, visibility, annotations)
  // NOTE: This should NOT depend on cachedPlotData to avoid overwriting alignment results
  useEffect(() => {
    if (!cachedPlotData) return;
    
    console.log('[Page] Ring settings changed, updating plot');
    
    // Create a map of existing ring data by queryId
    const ringDataMap = new Map((cachedPlotData.rings || []).map(r => [r.queryId, r]));
    
    // Update all configured rings, whether they have alignment data or not
    const updatedRings = rings.map((ringConfig) => {
      const existingRingData = ringDataMap.get(ringConfig.id);
      
      if (existingRingData) {
        // Ring has alignment data - update it
        return {
          ...existingRingData,
          queryName: ringConfig.legendText,
          color: ringConfig.color,
          visible: true,
          customWidth: ringConfig.customWidth,
          annotations: ringAnnotations[ringConfig.id] || existingRingData.annotations || []
        };
      } else {
        // Ring has no alignment data yet (placeholder or annotation-only ring)
        return {
          queryId: ringConfig.id,
          queryName: ringConfig.legendText,
          color: ringConfig.color,
          visible: true,
          customWidth: ringConfig.customWidth,
          hits: [],
          windows: [],
          annotations: ringAnnotations[ringConfig.id] || [],
          statistics: {
            meanIdentity: 0,
            genomeCoverage: 0,
            totalAlignedBases: 0
          }
        };
      }
    });
    
    setPlotData({
      ...cachedPlotData,
      rings: updatedRings
    });
  }, [rings, ringAnnotations]); // Removed cachedPlotData from dependencies!

  const handleRun = async () => {
    console.log('[Page] === Generate Plot (Run Alignments) clicked ===');
    
    // Clear console logs on each run
    setConsoleLogs([]);
    
    if (!referenceFile) {
      toast.error('Please select a reference genome');
      return;
    }
    
    // Check if there are any rings with files to align
    const ringsWithFiles = rings.filter(r => r.files.length > 0);
    if (ringsWithFiles.length === 0) {
      toast('No alignment files to process. Add files to rings or just use annotations.');
      return;
    }

    console.log('[Page] Running alignments for:', ringsWithFiles.map(r => r.legendText).join(', '));

    setIsProcessing(true);
    setProgress({ step: 'Starting alignments...', percent: 0 });

    try {
      // Reuse existing controller instance to preserve alignment cache
      if (!controllerRef.current) {
        const { BRIGController } = await import('@/lib/controller');
        controllerRef.current = new BRIGController();
        await controllerRef.current.initialize();
        console.log('[Page] Created new BRIGController instance');
      } else {
        console.log('[Page] Reusing existing BRIGController instance (cache preserved)');
      }
      
      const controller = controllerRef.current;
      
      const result = await controller.runFullPipeline(
        referenceFile,
        ringsWithFiles,
        [],
        params,
        (update) => {
          console.log('[Page] Progress update:', update);
          setProgress(update);
          
          // Update plot immediately as each ring completes
          if (update.partialData?.rings && update.partialData.rings.length > 0) {
            console.log('[Page] Received partial data with', update.partialData.rings.length, 'rings');
            
            // Merge new ring data with existing cached data (preserve all rings and annotations)
            const hasExistingRings = cachedPlotData?.rings && cachedPlotData.rings.length > 0;
            
            let mergedRings;
            if (hasExistingRings) {
              // Start with all existing rings
              mergedRings = cachedPlotData.rings.map(existingRing => {
                const newRingData = update.partialData!.rings!.find(r => r.queryName === existingRing.queryName);
                if (newRingData) {
                  console.log(`[Page] Updating ring: ${existingRing.queryName}, hits: ${newRingData.hits?.length || 0}, preserving annotations: ${existingRing.annotations?.length || 0}`);
                  return {
                    ...existingRing,
                    hits: newRingData.hits,
                    windows: newRingData.windows,
                    statistics: newRingData.statistics,
                    lastzOutput: newRingData.lastzOutput,
                    // CRITICAL: Preserve annotations from existing ring
                    annotations: existingRing.annotations || []
                  };
                }
                return existingRing;
              });
              
              // Add any new rings that weren't in the cache
              const newRingsToAdd = update.partialData!.rings!.filter(
                newRing => !cachedPlotData.rings.some(existing => existing.queryName === newRing.queryName)
              );
              if (newRingsToAdd.length > 0) {
                console.log(`[Page] Adding ${newRingsToAdd.length} new rings:`, newRingsToAdd.map(r => r.queryName));
                // Add annotations from ringAnnotations state if they exist
                const newRingsWithAnnotations = newRingsToAdd.map(ring => {
                  const annotations = ringAnnotations[ring.queryId] || ring.annotations || [];
                  if (annotations.length > 0) {
                    console.log(`[Page] Adding annotations to new ring ${ring.queryName}:`, annotations.length);
                  }
                  return {
                    ...ring,
                    annotations
                  };
                });
                mergedRings = [...mergedRings, ...newRingsWithAnnotations];
              }
            } else {
              // No existing rings - add annotations from ringAnnotations state
              console.log('[Page] No existing rings, adding annotations from state');
              mergedRings = update.partialData!.rings!.map(ring => {
                const annotations = ringAnnotations[ring.queryId] || ring.annotations || [];
                if (annotations.length > 0) {
                  console.log(`[Page] Adding annotations to ring ${ring.queryName}:`, annotations.length);
                }
                return {
                  ...ring,
                  annotations
                };
              });
            }
            
            const updatedPlotData = {
              reference: update.partialData.reference || cachedPlotData?.reference!,
              rings: mergedRings,
              config: update.partialData.config || cachedPlotData?.config!
            };
            
            setPlotData(updatedPlotData);
          }
        }
      );
      
      console.log('[Page] Alignments complete! Merging results...');
      console.log('[Page] Result rings:', result.rings?.map(r => r.queryName).join(', '));
      console.log('[Page] Cached plot data:', cachedPlotData);
      console.log('[Page] Existing rings:', cachedPlotData?.rings?.map(r => ({ name: r.queryName, annotations: r.annotations?.length || 0 })));
      
      // Merge final alignment results into existing plot data
      // CRITICAL: Check if existing rings array has any items, not just if it exists
      const hasExistingRings = cachedPlotData?.rings && cachedPlotData.rings.length > 0;
      
      const finalRings = hasExistingRings
        ? cachedPlotData.rings.map(existingRing => {
            const newRingData = result.rings?.find(r => r.queryName === existingRing.queryName);
            if (newRingData) {
              console.log(`[Page] Final merge for ring: ${existingRing.queryName}, keeping annotations: ${existingRing.annotations?.length || 0}`);
              return {
                ...existingRing,
                hits: newRingData.hits,
                windows: newRingData.windows,
                statistics: newRingData.statistics,
                lastzOutput: newRingData.lastzOutput,
                // CRITICAL: Preserve annotations from existing ring OR ringAnnotations state
                annotations: existingRing.annotations || ringAnnotations[existingRing.queryId] || []
              };
            }
            console.log(`[Page] Keeping existing ring without alignment: ${existingRing.queryName}`);
            return existingRing;
          })
        : result.rings?.map(ring => ({
            ...ring,
            // Add annotations from ringAnnotations state if they exist
            annotations: ring.annotations || ringAnnotations[ring.queryId] || []
          })) || []; // Use alignment results directly with annotations from state if no existing rings
      
      console.log('[Page] Final rings after merge:', finalRings?.map(r => ({ name: r.queryName, hits: r.hits?.length || 0, annotations: r.annotations?.length || 0 })));
      
      // Keep existing skeleton (reference, GC data), only update rings with alignment data
      if (cachedPlotData) {
        const finalPlotData = {
          ...cachedPlotData,
          rings: finalRings
        };
        
        console.log('[Page] Setting final plot data with rings:', finalPlotData.rings?.length);
        setPlotData(finalPlotData);
        setCachedPlotData(finalPlotData);
      } else {
        // Fallback if no cached data (shouldn't happen)
        console.warn('[Page] No cached data, using result directly');
        setPlotData(result);
        setCachedPlotData(result);
      }
      setProgress({ step: 'Complete!', percent: 100 });
      toast.success('Alignments completed successfully!');
    } catch (error: any) {
      console.error('[Page] Alignment error:', error);
      toast.error(`Error: ${error.message}`, { duration: 6000 });
      setProgress({ step: 'Error', percent: 0, message: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Toaster 
        position="bottom-right"
        toastOptions={{
          className: 'dark:bg-gray-800 dark:text-white',
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 6000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth="2" />
                <circle cx="12" cy="12" r="5" strokeWidth="2" />
                <circle cx="12" cy="12" r="1" strokeWidth="2" fill="currentColor" />
              </svg>
              <div>
                <h1 className="text-2xl font-bold">BRIGX</h1>
                <p className="text-xs text-blue-100 dark:text-blue-200">Browser-based Ring Image Generator</p>
              </div>
            </div>
            <nav className="hidden md:flex space-x-6">
              <button className="text-blue-100 hover:text-white transition-colors">Documentation</button>
              <Link href="/about" className="text-blue-100 hover:text-white transition-colors">
                About
              </Link>
              <a href="https://github.com" target="_blank" rel="noopener" className="text-blue-100 hover:text-white transition-colors">
                GitHub
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Info Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Left Sidebar - Input Panel */}
            <div className="lg:col-span-1 space-y-6 animate-fade-in">
              <div className="card">
                <h2 className="section-title">Reference Genome</h2>
                <div>
                  <label className="label">Reference Genome (FASTA)</label>
                  <input
                    type="file"
                    accept=".fasta,.fa,.fna,.gbk,.gb"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setReferenceFile(e.target.files[0]);
                      }
                    }}
                    className="input-field w-full text-sm"
                  />
                  {referenceFile && (
                    <div className="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {referenceFile.name}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Must contain exactly ONE sequence
                  </p>
                </div>
              </div>

              <div className="card">
                <RingConfiguration 
                  rings={rings} 
                  setRings={setRings}
                  onEditAnnotations={handleOpenAnnotationEditor}
                />
              </div>

              <div className="card">
                <h2 className="section-title">Parameters</h2>
                <ParameterControls
                  params={params}
                  setParams={setParams}
                  disabled={isProcessing}
                />
              </div>

              <button
                onClick={handleRun}
                disabled={isProcessing || !referenceFile || rings.filter(r => r.files.length > 0).length === 0}
                className="w-full btn-primary py-3 px-6 text-lg font-semibold"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Running Alignments...
                  </span>
                ) : (
                  'Run Alignments'
                )}
              </button>
            </div>

            {/* Visualization Panel */}
            <div className="lg:col-span-2 animate-slide-up">
            {/* Image Properties */}
            <div className="mb-6 animate-fade-in">
              <ImageProperties 
                config={imageProperties}
                onChange={setImageProperties}
              />
            </div>

            <div className="card">
              <div className="flex justify-between items-center mb-6">
                <h2 className="section-title mb-0">Circular Plot</h2>
                {plotData && <ExportPanel plotData={plotData} imageProperties={imageProperties} />}
              </div>
              
              {plotData ? (
                <CircularPlot data={plotData} imageProperties={imageProperties} />
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-400 dark:text-gray-500">
                  <div className="text-center">
                    <svg className="mx-auto h-24 w-24 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                      <circle cx="12" cy="12" r="6" strokeWidth="1.5" />
                      <circle cx="12" cy="12" r="2" strokeWidth="1.5" />
                    </svg>
                    <p className="text-lg">Upload a reference genome to begin</p>
                    <p className="text-sm mt-2">The plot will generate automatically with GC content/skew rings</p>
                  </div>
                </div>
              )}
            </div>

            {/* Console Log */}
            <div className="mt-6 animate-fade-in">
              <ConsoleLog logs={consoleLogs} progress={progress} />
            </div>

            {plotData && (
              <div className="mt-6 card animaprogress={progress} te-fade-in">
                <h2 className="section-title">Statistics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Reference</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{plotData.reference.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{(plotData.reference.length / 1000).toFixed(1)} kb</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-100 dark:border-green-800">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Query Genomes</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{plotData.rings?.length || 0}</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg border border-purple-100 dark:border-purple-800">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Window Size</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{plotData.config?.windowSize || 0} bp</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-lg border border-orange-100 dark:border-orange-800">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Min Identity</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{plotData.config?.minIdentity || 0}%</div>
                  </div>
                </div>

                {plotData.rings && plotData.rings.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Query Genome Coverage</h3>
                  <div className="space-y-2">
                    {plotData.rings.map((ring) => (
                      <div key={ring.queryId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 hover:shadow-md transition-shadow">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{ring.queryName}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Coverage: {ring.statistics.genomeCoverage.toFixed(1)}% • 
                            Avg Identity: {ring.statistics.meanIdentity.toFixed(1)}%
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {ring.lastzOutput && (
                            <button
                              onClick={() => {
                                const blob = new Blob([ring.lastzOutput!], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${ring.queryName}_alignment.txt`;
                                a.click();
                                URL.revokeObjectURL(url);
                                toast.success(`Downloaded alignment results for ${ring.queryName}`);
                              }}
                              className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download
                            </button>
                          )}
                          <div 
                            className="w-4 h-4 rounded-full ring-2 ring-gray-300 dark:ring-gray-600 flex-shrink-0" 
                            style={{ backgroundColor: ring.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 md:mb-0">
              <p className="font-semibold">BRIGX - Powered by LASTZ & WebAssembly</p>
              <p className="mt-1">All processing runs locally in your browser - no data leaves your computer</p>
            </div>
            <div className="flex space-x-6 text-sm">
              <a href="/about" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                About
              </a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
      </div>

      {/* Annotation Editor Modal */}
      {annotationEditorOpen && editingRingId && (
        <AnnotationEditor
          ringId={editingRingId}
          ringName={rings.find(r => r.id === editingRingId)?.legendText || 'Unknown Ring'}
          annotations={ringAnnotations[editingRingId] || []}
          referenceLength={referenceLength}
          onAnnotationsChange={handleAnnotationsChange}
          onClose={() => {
            setAnnotationEditorOpen(false);
            setEditingRingId(null);
          }}
        />
      )}
    </>
  );
}

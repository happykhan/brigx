

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import type { CircularPlotData, PipelineParams, ProgressUpdate, RingConfig, Annotation, RingData } from '@/lib/types';
import { APP_VERSION } from '@/lib/version';
import type { BRIGController as BRIGControllerType } from '@/lib/controller';
import { exportSession, importSession } from '@/lib/session';
import { readFileText } from '@/lib/fileAccess';
import type { ImagePropertiesConfig } from '@/components/ImageProperties';

export function useBRIGController() {
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [rings, setRings] = useState<RingConfig[]>([]);

  // Store controller instance in ref to persist alignment cache across runs
  const controllerRef = useRef<BRIGControllerType | null>(null);
  const [params, setParams] = useState<PipelineParams>({
    minIdentity: 70,
    minAlignmentLength: 1000,
    colorScheme: 'blue-red',
    forceAlignment: false,
    alignerOptions: ''
  });
  const [progress, setProgress] = useState<ProgressUpdate>({ step: 'idle', percent: 0 });
  const [plotData, setPlotData] = useState<CircularPlotData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [cachedPlotData, setCachedPlotData] = useState<CircularPlotData | null>(null);
  const [imageProperties, setImageProperties] = useState<ImagePropertiesConfig>({
    innerRadius: 200,
    ringWidth: 20,
    gcRingWidth: 40,
    ringSpacing: 4,
    legendFontSize: 16,
    scaleFontSize: 12,
    titleFontSize: 24,
    labelFontSize: 14,
    title: ''
  });

  // Plot expand state
  const [plotExpanded, setPlotExpanded] = useState(false);
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

    // Summarize objects for display - avoid dumping raw arrays
    const summarizeArg = (arg: unknown): string => {
      if (arg == null) return String(arg);
      if (typeof arg !== 'object') return String(arg);
      if (Array.isArray(arg)) {
        if (arg.length > 5) return `[Array(${arg.length})]`;
        return JSON.stringify(arg);
      }
      // Summarize known large fields
      const clone: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(arg as Record<string, unknown>)) {
        if (Array.isArray(v) && v.length > 5) {
          clone[k] = `[${v.length} items]`;
        } else if (k === 'partialData' || k === 'sequence') {
          clone[k] = '[omitted]';
        } else if (typeof v === 'object' && v !== null) {
          clone[k] = summarizeArg(v);
        } else {
          clone[k] = v;
        }
      }
      return JSON.stringify(clone);
    };

    console.log = (...args: unknown[]) => {
      const message = args.map(summarizeArg).join(' ');
      setConsoleLogs(prev => [...prev, `[LOG] ${message}`]);
      originalLog.apply(console, args);
    };

    console.error = (...args: unknown[]) => {
      const message = args.map(summarizeArg).join(' ');
      setConsoleLogs(prev => [...prev, `[ERROR] ${message}`]);
      originalError.apply(console, args);
    };

    console.warn = (...args: unknown[]) => {
      const message = args.map(summarizeArg).join(' ');
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

    // Update plot data using functional updates to avoid stale closures
    setCachedPlotData(prev => {
      if (!prev || !prev.rings) return prev;
      const updatedRings = prev.rings.map(ringData => {
        if (ringData.queryId === ringId) {
          return {
            ...ringData,
            annotations,
            hits: ringData.hits || [],
            statistics: ringData.statistics || { meanIdentity: 0, genomeCoverage: 0, totalAlignedBases: 0 },
            alignmentOutput: ringData.alignmentOutput || ''
          };
        }
        return ringData;
      });
      const updated = { ...prev, rings: updatedRings };
      setPlotData(updated);
      return updated;
    });
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
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Page] Error generating skeleton:', error);
      toast.error(`Error: ${msg}`);
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
        return {
          ...existingRingData,
          queryName: ringConfig.legendText,
          color: ringConfig.color,
          visible: true,
          customWidth: ringConfig.customWidth,
          upperThreshold: ringConfig.upperThreshold,
          lowerThreshold: ringConfig.lowerThreshold,
          graphMaxCap: ringConfig.graphMaxCap,
          showLabels: ringConfig.showLabels,
          annotations: ringAnnotations[ringConfig.id] || existingRingData.annotations || []
        };
      } else {
        return {
          queryId: ringConfig.id,
          queryName: ringConfig.legendText,
          color: ringConfig.color,
          visible: true,
          customWidth: ringConfig.customWidth,
          upperThreshold: ringConfig.upperThreshold,
          lowerThreshold: ringConfig.lowerThreshold,
          graphMaxCap: ringConfig.graphMaxCap,
          showLabels: ringConfig.showLabels,
          hits: [],
          annotations: ringAnnotations[ringConfig.id] || [],
          statistics: {
            meanIdentity: 0,
            genomeCoverage: 0,
            totalAlignedBases: 0
          }
        };
      }
    });

    const updated = { ...cachedPlotData, rings: updatedRings };
    setPlotData(updated);
    setCachedPlotData(updated);
  }, [rings, ringAnnotations]); // Removed cachedPlotData from dependencies!

  const handleRun = async () => {
    console.log(`[BRIGX v${APP_VERSION}] Starting alignment pipeline`);

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
          console.log(`[Page] ${update.step} (${update.percent}%)${update.message ? ' - ' + update.message : ''}`);
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
                    statistics: newRingData.statistics,
                    alignmentOutput: newRingData.alignmentOutput,
                    graphPoints: newRingData.graphPoints || existingRing.graphPoints,
                    graphMaxValue: newRingData.graphMaxValue || existingRing.graphMaxValue,
                    graphStats: newRingData.graphStats || existingRing.graphStats,
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
              reference: update.partialData.reference || cachedPlotData?.reference || { name: '', length: 0 },
              rings: mergedRings,
              config: update.partialData.config || cachedPlotData?.config || { minIdentity: 70, minAlignmentLength: 100 }
            };

            setPlotData(updatedPlotData);
          }
        }
      );

      console.log(`[Page] Alignments complete. ${result.rings?.length || 0} rings: ${result.rings?.map(r => r.queryName).join(', ')}`);

      // Merge final alignment results into existing plot data
      // CRITICAL: Check if existing rings array has any items, not just if it exists
      const hasExistingRings = cachedPlotData?.rings && cachedPlotData.rings.length > 0;

      let finalRings: RingData[];
      if (hasExistingRings) {
        // Update existing cached rings with new alignment data
        finalRings = cachedPlotData.rings.map(existingRing => {
          const newRingData = result.rings?.find(r => r.queryName === existingRing.queryName);
          if (newRingData) {
            console.log(`[Page] Final merge - updating ring: ${existingRing.queryName}`);
            return {
              ...existingRing,
              hits: newRingData.hits,
              statistics: newRingData.statistics,
              alignmentOutput: newRingData.alignmentOutput,
              graphPoints: newRingData.graphPoints || existingRing.graphPoints,
              graphMaxValue: newRingData.graphMaxValue || existingRing.graphMaxValue,
              annotations: existingRing.annotations || ringAnnotations[existingRing.queryId] || []
            };
          }
          return existingRing;
        });

        // Append any NEW rings from result that weren't in the cache
        const newRingsToAdd = (result.rings || []).filter(
          newRing => !cachedPlotData.rings.some(existing => existing.queryName === newRing.queryName)
        );
        if (newRingsToAdd.length > 0) {
          console.log(`[Page] Final merge - adding ${newRingsToAdd.length} new rings: ${newRingsToAdd.map(r => r.queryName).join(', ')}`);
          const newRingsWithAnnotations = newRingsToAdd.map(ring => ({
            ...ring,
            annotations: ring.annotations || ringAnnotations[ring.queryId] || []
          }));
          finalRings = [...finalRings, ...newRingsWithAnnotations];
        }
      } else {
        finalRings = (result.rings || []).map(ring => ({
          ...ring,
          annotations: ring.annotations || ringAnnotations[ring.queryId] || []
        }));
      }

      console.log(`[Page] Final merge: ${finalRings?.length || 0} rings`);

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
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Page] Alignment error:', error);
      toast.error(`Error: ${msg}`, { duration: 6000 });
      setProgress({ step: 'Error', percent: 0, message: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReferenceFileChange = (file: File) => {
    setReferenceFile(file);
    // Reset plot when reference changes
    setPlotData(null);
    setCachedPlotData(null);
    setReferenceLength(0);
    if (controllerRef.current) {
      controllerRef.current.cleanup();
      controllerRef.current = null;
    }
  };

  const handleSaveSession = () => {
    const json = exportSession(
      APP_VERSION,
      referenceFile?.name || '',
      rings,
      ringAnnotations,
      params,
      imageProperties
    );
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brigx-session-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Session saved');
  };

  const handleLoadSession = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const json = await readFileText(file);
      const session = importSession(json);

      // Restore rings (without files - they can't be serialized)
      const restoredRings: RingConfig[] = session.rings.map(r => ({
        id: r.id,
        legendText: r.legendText,
        color: r.color,
        upperThreshold: r.upperThreshold,
        lowerThreshold: r.lowerThreshold,
        customWidth: r.customWidth,
        files: []
      }));
      setRings(restoredRings);

      // Restore annotations
      const restoredAnnotations: Record<string, Annotation[]> = {};
      session.rings.forEach(r => {
        if (r.annotations && r.annotations.length > 0) {
          restoredAnnotations[r.id] = r.annotations;
        }
      });
      setRingAnnotations(restoredAnnotations);

      // Restore params and image config
      setParams(session.params);
      setImageProperties(session.imageConfig);

      toast.success('Session loaded. Re-add reference and ring files to run alignments.');
    } catch (error) {
      toast.error(`Failed to load session: ${error instanceof Error ? error.message : String(error)}`);
    }

    e.target.value = '';
  };

  return {
    // State
    referenceFile,
    rings,
    setRings,
    params,
    setParams,
    progress,
    plotData,
    isProcessing,
    consoleLogs,
    imageProperties,
    setImageProperties,
    plotExpanded,
    setPlotExpanded,
    annotationEditorOpen,
    setAnnotationEditorOpen,
    editingRingId,
    setEditingRingId,
    ringAnnotations,
    referenceLength,
    // Handlers
    handleReferenceFileChange,
    handleAnnotationsChange,
    handleOpenAnnotationEditor,
    handleRun,
    handleSaveSession,
    handleLoadSession,
  };
}



import { useState, useEffect, useRef, useReducer } from 'react';
import toast from 'react-hot-toast';
import type { PipelineParams, ProgressUpdate, RingConfig, Annotation } from '@/lib/types';
import { APP_VERSION } from '@/lib/version';
import type { BRIGController as BRIGControllerType } from '@/lib/controller';
import { exportSession, importSession } from '@/lib/session';
import { readFileText } from '@/lib/fileAccess';
import { extractReferenceAnnotationFile } from '@/lib/featureParser';
import { INITIAL_PLOT_STATE, plotStateReducer } from '@/lib/plotState';
import type { ImagePropertiesConfig } from '@/components/ImageProperties';
import { useConsoleCapture } from './useConsoleCapture';

export function useBRIGController() {
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [rings, setRings] = useState<RingConfig[]>([]);
  const ringsRef = useRef(rings);
  ringsRef.current = rings;

  // Store controller instance in ref to persist alignment cache across runs
  const controllerRef = useRef<BRIGControllerType | null>(null);
  const referenceGenerationRef = useRef(0);
  const [params, setParams] = useState<PipelineParams>({
    minIdentity: 70,
    minAlignmentLength: 1000,
    colorScheme: 'blue-red',
    forceAlignment: false,
    alignerOptions: ''
  });
  const [progress, setProgress] = useState<ProgressUpdate>({ step: 'idle', percent: 0 });
  const [plotState, dispatchPlot] = useReducer(plotStateReducer, INITIAL_PLOT_STATE);
  const plotData = plotState.displayed;
  const [isProcessing, setIsProcessing] = useState(false);
  const { logs: consoleLogs, clearLogs: clearConsoleLogs } = useConsoleCapture();
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
  const ringAnnotationsRef = useRef(ringAnnotations);
  ringAnnotationsRef.current = ringAnnotations;
  const [referenceAnnotations, setReferenceAnnotations] = useState<Annotation[]>([]);
  const referenceAnnotationsRef = useRef(referenceAnnotations);
  referenceAnnotationsRef.current = referenceAnnotations;
  const [referenceAnnotationFileName, setReferenceAnnotationFileName] = useState<string | null>(null);
  const referenceLength = plotData?.reference.length ?? 0;

  useEffect(() => () => {
    referenceGenerationRef.current += 1;
    controllerRef.current?.cleanup();
    controllerRef.current = null;
  }, []);

  // Handle annotation changes
  const handleAnnotationsChange = (ringId: string, annotations: Annotation[]) => {
    setRingAnnotations(prev => ({
      ...prev,
      [ringId]: annotations
    }));

    dispatchPlot({ type: 'annotations', ringId, annotations });
  };

  const handleOpenAnnotationEditor = (ringId: string) => {
    setEditingRingId(ringId);
    setAnnotationEditorOpen(true);
  };

  const handleReferenceAnnotationsFileChange = async (file: File) => {
    if (referenceLength <= 0) {
      toast.error('Load the reference genome before its annotation file');
      return;
    }

    try {
      const text = await readFileText(file);
      const parsed = extractReferenceAnnotationFile(text, file.name, 'CDS');
      const annotations = parsed
        .filter(annotation => annotation.end >= 1 && annotation.start <= referenceLength)
        .map(annotation => ({
          ...annotation,
          start: Math.max(1, Math.min(annotation.start, referenceLength)),
          end: Math.max(1, Math.min(annotation.end, referenceLength)),
          color: annotation.color === '#000000' ? '#4a90e2' : annotation.color,
        }));

      if (annotations.length === 0) {
        toast.error('No CDS features matched the reference coordinates');
        return;
      }

      setReferenceAnnotations(annotations);
      setReferenceAnnotationFileName(file.name);
      dispatchPlot({ type: 'reference-annotations', annotations });
      toast.success(`Loaded ${annotations.length} reference CDS feature(s)`);
    } catch (error) {
      toast.error(`Reference annotation error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleClearReferenceAnnotations = () => {
    setReferenceAnnotations([]);
    setReferenceAnnotationFileName(null);
    dispatchPlot({ type: 'reference-annotations', annotations: [] });
  };

  // Auto-generate plot skeleton when reference file is loaded
  useEffect(() => {
    if (referenceFile && !plotData) {
      console.log('[Page] Reference file loaded, generating plot skeleton...');
      void generatePlotSkeleton(referenceFile, referenceGenerationRef.current);
    }
  }, [referenceFile]);

  // Generate initial plot structure without running alignments
  const generatePlotSkeleton = async (file: File, generation: number) => {
    let controller: BRIGControllerType | null = null;
    try {
      const { BRIGController } = await import('@/lib/controller');
      controller = new BRIGController();
      await controller.initialize();

      // Run pipeline without any ring files to just get reference data (GC content/skew)
      const skeletonResult = await controller.runFullPipeline(
        file,
        [], // No rings for alignment
        [],
        params,
        (update) => setProgress(update)
      );

      // Create ring placeholders for configured rings
      const ringPlaceholders = ringsRef.current.map((ringConfig) => ({
        queryId: ringConfig.id,
        queryName: ringConfig.legendText,
        color: ringConfig.color,
        visible: true,
        customWidth: ringConfig.customWidth,
        hits: [],
        annotations: ringAnnotationsRef.current[ringConfig.id] || [],
        statistics: {
          meanIdentity: 0,
          genomeCoverage: 0,
          totalAlignedBases: 0
        }
      }));

      const plotDataWithRings = {
        ...skeletonResult,
        reference: {
          ...skeletonResult.reference,
          annotations: referenceAnnotationsRef.current,
        },
        rings: ringPlaceholders
      };

      if (generation === referenceGenerationRef.current) {
        dispatchPlot({ type: 'replace', data: plotDataWithRings });
        setProgress({ step: 'Reference ready', percent: 100 });
      }
    } catch (error) {
      if (generation !== referenceGenerationRef.current) return;
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Page] Error generating skeleton:', error);
      toast.error(`Error: ${msg}`);
    } finally {
      controller?.cleanup();
    }
  };

  // Auto-update plot when ring settings change (colors, thresholds, visibility, annotations)
  // NOTE: This should NOT depend on cachedPlotData to avoid overwriting alignment results
  useEffect(() => {
    console.log('[Page] Ring settings changed, updating plot');
    dispatchPlot({ type: 'configure', rings, annotationsByRing: ringAnnotations });
  }, [rings, ringAnnotations]); // Removed cachedPlotData from dependencies!

  const handleRun = async () => {
    console.log(`[BRIGX v${APP_VERSION}] Starting alignment pipeline`);

    // Clear console logs on each run
    clearConsoleLogs();

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
    const runGeneration = referenceGenerationRef.current;

    try {
      // Reuse existing controller instance to preserve alignment cache
      if (!controllerRef.current) {
        const { BRIGController } = await import('@/lib/controller');
        const controller = new BRIGController();
        try {
          await controller.initialize();
          controllerRef.current = controller;
        } catch (error) {
          controller.cleanup();
          throw error;
        }
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
          if (runGeneration !== referenceGenerationRef.current) return;
          console.log(`[Page] ${update.step} (${update.percent}%)${update.message ? ' - ' + update.message : ''}`);
          setProgress(update);

          // Update plot immediately as each ring completes
          if (update.partialData?.rings && update.partialData.rings.length > 0) {
            console.log('[Page] Received partial data with', update.partialData.rings.length, 'rings');

            dispatchPlot({
              type: 'partial',
              data: {
                ...update.partialData,
                reference: update.partialData.reference
                  ? { ...update.partialData.reference, annotations: referenceAnnotationsRef.current }
                  : undefined,
                rings: update.partialData.rings,
              },
              annotationsByRing: ringAnnotationsRef.current,
            });
          }
        }
      );

      console.log(`[Page] Alignments complete. ${result.rings?.length || 0} rings: ${result.rings?.map(r => r.queryName).join(', ')}`);

      if (runGeneration !== referenceGenerationRef.current) return;
      dispatchPlot({
        type: 'commit',
        data: {
          ...result,
          reference: { ...result.reference, annotations: referenceAnnotationsRef.current },
        },
        annotationsByRing: ringAnnotationsRef.current,
      });
      setProgress({ step: 'Complete!', percent: 100 });
      toast.success('Alignments completed successfully!');
    } catch (error) {
      if (runGeneration !== referenceGenerationRef.current) return;
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Page] Alignment error:', error);
      toast.error(`Error: ${msg}`, { duration: 6000 });
      setProgress({ step: 'Error', percent: 0, message: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReferenceFileChange = (file: File) => {
    referenceGenerationRef.current += 1;
    if (referenceFile) {
      setReferenceAnnotations([]);
      setReferenceAnnotationFileName(null);
    }
    setReferenceFile(file);
    // Reset plot when reference changes
    dispatchPlot({ type: 'clear' });
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
      imageProperties,
      referenceAnnotations,
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
        blastType: r.blastType,
        showLabels: r.showLabels,
        graphMaxCap: r.graphMaxCap,
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

      const restoredReferenceAnnotations = session.referenceAnnotations ?? [];
      setReferenceAnnotations(restoredReferenceAnnotations);
      setReferenceAnnotationFileName(restoredReferenceAnnotations.length > 0 ? 'Loaded from session' : null);
      dispatchPlot({ type: 'reference-annotations', annotations: restoredReferenceAnnotations });

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
    referenceAnnotations,
    referenceAnnotationFileName,
    referenceLength,
    // Handlers
    handleReferenceFileChange,
    handleAnnotationsChange,
    handleOpenAnnotationEditor,
    handleReferenceAnnotationsFileChange,
    handleClearReferenceAnnotations,
    handleRun,
    handleSaveSession,
    handleLoadSession,
  };
}

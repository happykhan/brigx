

import { useState, useEffect, useRef, useReducer, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import type { PipelineParams, ProgressUpdate, RingConfig, Annotation } from '@/lib/types';
import type {
  DesktopOpenProjectResult,
  DesktopRecentProject,
} from '@/desktop/contracts';
import { APP_VERSION } from '@/lib/version';
import type { BRIGController as BRIGControllerType } from '@/lib/controller';
import { exportSession, importSession } from '@/lib/session';
import {
  buildDesktopProjectRequest,
  desktopProjectFingerprint,
  restoreDesktopFiles,
} from '@/lib/desktopBridge';
import { saveBlob } from '@/lib/download';
import { importPlotData } from '@/lib/plotValidation';
import { readFileText } from '@/lib/fileAccess';
import { extractReferenceAnnotationFile } from '@/lib/featureParser';
import { INITIAL_PLOT_STATE, plotStateReducer } from '@/lib/plotState';
import type { ImagePropertiesConfig } from '@/components/ImageProperties';
import { useConsoleCapture } from './useConsoleCapture';

const DEFAULT_PARAMS: PipelineParams = {
  minIdentity: 70,
  minAlignmentLength: 1000,
  colorScheme: 'blue-red',
  forceAlignment: false,
  alignerOptions: '',
};

const DEFAULT_IMAGE_PROPERTIES: ImagePropertiesConfig = {
  innerRadius: 200,
  ringWidth: 20,
  gcRingWidth: 40,
  ringSpacing: 4,
  legendFontSize: 16,
  scaleFontSize: 12,
  titleFontSize: 24,
  labelFontSize: 14,
  title: '',
};

export function useBRIGController() {
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [rings, setRings] = useState<RingConfig[]>([]);
  const ringsRef = useRef(rings);
  ringsRef.current = rings;

  // Store controller instance in ref to persist alignment cache across runs
  const controllerRef = useRef<BRIGControllerType | null>(null);
  const referenceGenerationRef = useRef(0);
  const [params, setParams] = useState<PipelineParams>({ ...DEFAULT_PARAMS });
  const [progress, setProgress] = useState<ProgressUpdate>({ step: 'idle', percent: 0 });
  const [plotState, dispatchPlot] = useReducer(plotStateReducer, INITIAL_PLOT_STATE);
  const plotData = plotState.displayed;
  const [isProcessing, setIsProcessing] = useState(false);
  const { logs: consoleLogs, clearLogs: clearConsoleLogs } = useConsoleCapture();
  const [imageProperties, setImageProperties] = useState<ImagePropertiesConfig>({
    ...DEFAULT_IMAGE_PROPERTIES,
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
  const desktop = typeof window === 'undefined' ? undefined : window.brigxDesktop;
  const [desktopProjectName, setDesktopProjectName] = useState<string | null>(null);
  const [desktopRecentProjects, setDesktopRecentProjects] = useState<DesktopRecentProject[]>([]);
  const [desktopHasRecovery, setDesktopHasRecovery] = useState(false);
  const [desktopSaving, setDesktopSaving] = useState(false);
  const [desktopProjectDirty, setDesktopProjectDirty] = useState(false);
  const [desktopProjectRevision, setDesktopProjectRevision] = useState(0);
  const savedDesktopFingerprintRef = useRef<string | null>(null);
  const lastRecoveryFingerprintRef = useRef<string | null>(null);
  const recoveryTimerRef = useRef<number | null>(null);

  const desktopProjectRequest = useMemo(() => (
    desktop
      ? buildDesktopProjectRequest({
          appVersion: APP_VERSION,
          referenceFile,
          rings,
          ringAnnotations,
          params,
          imageProperties,
          referenceAnnotations,
          plotData,
        }, false, 0)
      : null
  ), [
    desktop,
    referenceFile,
    rings,
    ringAnnotations,
    params,
    imageProperties,
    referenceAnnotations,
    plotData,
  ]);
  const desktopFingerprint = useMemo(() => (
    desktopProjectRequest ? desktopProjectFingerprint(desktopProjectRequest) : null
  ), [desktopProjectRequest]);

  useEffect(() => () => {
    referenceGenerationRef.current += 1;
    controllerRef.current?.cleanup();
    controllerRef.current = null;
  }, []);

  useEffect(() => {
    if (!desktop || desktopFingerprint === null) return;
    if (savedDesktopFingerprintRef.current === null) {
      savedDesktopFingerprintRef.current = desktopFingerprint;
      setDesktopProjectDirty(false);
      return;
    }
    setDesktopProjectDirty(savedDesktopFingerprintRef.current !== desktopFingerprint);
  }, [desktop, desktopFingerprint]);

  useEffect(() => {
    if (!desktop) return;
    void desktop.setDirtyState(desktopProjectDirty).catch(error => {
      console.error('[Desktop] Could not update window dirty state:', error);
    });
  }, [desktop, desktopProjectDirty]);

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

  const handleSaveSession = async () => {
    try {
      const json = exportSession(
        APP_VERSION,
        referenceFile?.name || '',
        rings,
        ringAnnotations,
        params,
        imageProperties,
        referenceAnnotations,
      );
      const saved = await saveBlob(
        new Blob([json], { type: 'application/json' }),
        `brigx-session-${new Date().toISOString().slice(0, 10)}.json`,
      );
      if (saved) toast.success('Session saved');
    } catch (error) {
      toast.error(`Failed to save session: ${error instanceof Error ? error.message : String(error)}`);
    }
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

  const applyDesktopProject = useCallback((result: DesktopOpenProjectResult, recovered = false) => {
    if (result.cancelled) return;
    if (!result.sessionJson) throw new Error('Project session is missing');

    const session = importSession(result.sessionJson);
    const restored = restoreDesktopFiles(session, result.files);
    const restoredAnnotations: Record<string, Annotation[]> = {};
    for (const ring of session.rings) {
      if (ring.annotations.length > 0) restoredAnnotations[ring.id] = ring.annotations;
    }
    const restoredReferenceAnnotations = session.referenceAnnotations ?? [];
    const restoredPlot = result.plotJson ? importPlotData(result.plotJson) : null;

    referenceGenerationRef.current += 1;
    controllerRef.current?.cleanup();
    controllerRef.current = null;
    const restoredFingerprint = desktopProjectFingerprint(buildDesktopProjectRequest({
      appVersion: APP_VERSION,
      referenceFile: restored.referenceFile,
      rings: restored.rings,
      ringAnnotations: restoredAnnotations,
      params: session.params,
      imageProperties: session.imageConfig,
      referenceAnnotations: restoredReferenceAnnotations,
      plotData: restoredPlot,
    }, false, 0));
    const requiresSave = recovered || result.issues.length > 0;
    savedDesktopFingerprintRef.current = requiresSave
      ? `unpersisted:${restoredFingerprint}`
      : restoredFingerprint;
    lastRecoveryFingerprintRef.current = recovered ? restoredFingerprint : null;
    setDesktopProjectDirty(requiresSave);
    setReferenceFile(restored.referenceFile);
    setRings(restored.rings);
    setRingAnnotations(restoredAnnotations);
    setReferenceAnnotations(restoredReferenceAnnotations);
    setReferenceAnnotationFileName(
      restoredReferenceAnnotations.length > 0 ? 'Loaded from project' : null,
    );
    setParams(session.params);
    setImageProperties(session.imageConfig);
    dispatchPlot(restoredPlot ? { type: 'replace', data: restoredPlot } : { type: 'clear' });
    setProgress(restoredPlot
      ? { step: 'Project restored', percent: 100 }
      : { step: 'Project files restored', percent: 0 });
    setDesktopProjectName(recovered ? 'Recovered session' : (result.displayName ?? null));
    setDesktopProjectRevision(value => value + 1);

    if (result.issues.length > 0) {
      toast.error(
        `Project opened, but ${result.issues.length} input file(s) could not be restored. ${result.issues.join('; ')}`,
        { duration: 10_000 },
      );
    } else {
      toast.success(recovered ? 'Recovered the last autosaved session' : 'Project opened');
    }
  }, []);

  const refreshDesktopProjectState = useCallback(async () => {
    if (!desktop) return;
    const [recent, hasRecovery] = await Promise.all([
      desktop.listRecentProjects(),
      desktop.hasRecoverySnapshot(),
    ]);
    setDesktopRecentProjects(recent);
    setDesktopHasRecovery(hasRecovery);
  }, [desktop]);

  const confirmReplaceDesktopProject = useCallback(() => (
    !desktopProjectDirty
    || window.confirm('Discard unsaved changes and open another BRIGX project?')
  ), [desktopProjectDirty]);

  const handleDesktopNew = useCallback(async () => {
    if (!desktop || !confirmReplaceDesktopProject()) return;
    try {
      await desktop.startNewProject();
    } catch (error) {
      toast.error(`Failed to start a new project: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    referenceGenerationRef.current += 1;
    controllerRef.current?.cleanup();
    controllerRef.current = null;
    const emptyRequest = buildDesktopProjectRequest({
      appVersion: APP_VERSION,
      referenceFile: null,
      rings: [],
      ringAnnotations: {},
      params: DEFAULT_PARAMS,
      imageProperties: DEFAULT_IMAGE_PROPERTIES,
      referenceAnnotations: [],
      plotData: null,
    }, false, 0);
    savedDesktopFingerprintRef.current = desktopProjectFingerprint(emptyRequest);
    lastRecoveryFingerprintRef.current = null;
    setReferenceFile(null);
    setRings([]);
    setRingAnnotations({});
    setReferenceAnnotations([]);
    setReferenceAnnotationFileName(null);
    setParams({ ...DEFAULT_PARAMS });
    setImageProperties({ ...DEFAULT_IMAGE_PROPERTIES });
    dispatchPlot({ type: 'clear' });
    setProgress({ step: 'idle', percent: 0 });
    setDesktopProjectName(null);
    setDesktopProjectDirty(false);
    setDesktopProjectRevision(value => value + 1);
    try {
      await desktop.clearRecoverySnapshot();
      setDesktopHasRecovery(false);
    } catch (error) {
      console.warn('[Desktop] New project created, but recovery data could not be cleared:', error);
    }
    toast.success('New project created');
  }, [confirmReplaceDesktopProject, desktop]);

  const handleDesktopOpen = useCallback(async () => {
    if (!desktop || !confirmReplaceDesktopProject()) return;
    try {
      applyDesktopProject(await desktop.openProject());
      await refreshDesktopProjectState();
    } catch (error) {
      toast.error(`Failed to open project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [applyDesktopProject, confirmReplaceDesktopProject, desktop, refreshDesktopProjectState]);

  const handleDesktopOpenRecent = useCallback(async (id: string) => {
    if (!desktop || !confirmReplaceDesktopProject()) return;
    try {
      applyDesktopProject(await desktop.openRecentProject(id));
      await refreshDesktopProjectState();
    } catch (error) {
      toast.error(`Failed to open recent project: ${error instanceof Error ? error.message : String(error)}`);
      await refreshDesktopProjectState().catch(() => undefined);
    }
  }, [applyDesktopProject, confirmReplaceDesktopProject, desktop, refreshDesktopProjectState]);

  const handleDesktopRecover = useCallback(async () => {
    if (!desktop || !confirmReplaceDesktopProject()) return;
    try {
      applyDesktopProject(await desktop.openRecoverySnapshot(), true);
    } catch (error) {
      toast.error(`Failed to recover session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [applyDesktopProject, confirmReplaceDesktopProject, desktop]);

  const saveDesktopProject = useCallback(async (saveAs = false, closeAfterSave = false) => {
    if (!desktop || !desktopProjectRequest || desktopFingerprint === null) return false;
    setDesktopSaving(true);
    try {
      const session = JSON.parse(desktopProjectRequest.sessionJson) as Record<string, unknown>;
      session.timestamp = Date.now();
      const result = await desktop.saveProject({
        ...desktopProjectRequest,
        sessionJson: JSON.stringify(session),
        saveAs,
      });
      if (result.cancelled) return false;

      savedDesktopFingerprintRef.current = desktopFingerprint;
      lastRecoveryFingerprintRef.current = desktopFingerprint;
      setDesktopProjectDirty(false);
      setDesktopProjectName(result.displayName ?? desktopProjectName);
      if (recoveryTimerRef.current !== null) {
        window.clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
      try {
        await desktop.clearRecoverySnapshot();
        setDesktopHasRecovery(false);
      } catch (error) {
        console.warn('[Desktop] Project saved, but the recovery snapshot could not be cleared:', error);
      }
      try {
        setDesktopRecentProjects(await desktop.listRecentProjects());
      } catch (error) {
        console.warn('[Desktop] Project saved, but recent projects could not be refreshed:', error);
      }
      toast.success(`Project saved${result.displayName ? ` as ${result.displayName}` : ''}`);
      if (closeAfterSave) await desktop.closeAfterSave();
      return true;
    } catch (error) {
      toast.error(`Failed to save project: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setDesktopSaving(false);
    }
  }, [desktop, desktopFingerprint, desktopProjectName, desktopProjectRequest]);

  useEffect(() => {
    if (!desktop) return;
    void refreshDesktopProjectState().catch(error => {
      console.error('[Desktop] Could not read project recovery state:', error);
    });
  }, [desktop, refreshDesktopProjectState]);

  useEffect(() => {
    if (!desktop) return;
    return desktop.onMenuAction(action => {
      switch (action.type) {
        case 'new-project':
          void handleDesktopNew();
          break;
        case 'open-project':
          void handleDesktopOpen();
          break;
        case 'open-recent':
          void handleDesktopOpenRecent(action.id);
          break;
        case 'save-project':
          void saveDesktopProject(false);
          break;
        case 'save-project-as':
          void saveDesktopProject(true);
          break;
        case 'save-and-close':
          void saveDesktopProject(false, true);
          break;
        case 'recover-project':
          void handleDesktopRecover();
          break;
      }
    });
  }, [
    desktop,
    handleDesktopNew,
    handleDesktopOpen,
    handleDesktopOpenRecent,
    handleDesktopRecover,
    saveDesktopProject,
  ]);

  useEffect(() => {
    if (
      !desktop
      || !desktopProjectRequest
      || desktopFingerprint === null
      || !desktopProjectDirty
      || isProcessing
      || (!referenceFile && rings.length === 0 && !plotData)
      || lastRecoveryFingerprintRef.current === desktopFingerprint
    ) return;

    recoveryTimerRef.current = window.setTimeout(() => {
      recoveryTimerRef.current = null;
      void desktop.saveRecoverySnapshot(desktopProjectRequest).then(() => {
        lastRecoveryFingerprintRef.current = desktopFingerprint;
        setDesktopHasRecovery(true);
      }).catch(error => {
        console.error('[Desktop] Recovery snapshot failed:', error);
      });
    }, 1_500);
    return () => {
      if (recoveryTimerRef.current !== null) {
        window.clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
    };
  }, [
    desktop,
    desktopFingerprint,
    desktopProjectDirty,
    desktopProjectRequest,
    isProcessing,
    plotData,
    referenceFile,
    rings.length,
  ]);

  useEffect(() => {
    if (!desktop) return;
    document.title = `${desktopProjectDirty ? '• ' : ''}${desktopProjectName ? `${desktopProjectName} — ` : ''}BRIGX Desktop Beta`;
  }, [desktop, desktopProjectDirty, desktopProjectName]);

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
    isDesktop: Boolean(desktop),
    desktopProjectName,
    desktopRecentProjects,
    desktopHasRecovery,
    desktopSaving,
    desktopProjectDirty,
    desktopProjectRevision,
    // Handlers
    handleReferenceFileChange,
    handleAnnotationsChange,
    handleOpenAnnotationEditor,
    handleReferenceAnnotationsFileChange,
    handleClearReferenceAnnotations,
    handleRun,
    handleSaveSession,
    handleLoadSession,
    handleDesktopOpen,
    handleDesktopNew,
    handleDesktopOpenRecent,
    handleDesktopRecover,
    handleDesktopSave: () => saveDesktopProject(false),
    handleDesktopSaveAs: () => saveDesktopProject(true),
  };
}


import { lazy, Suspense, useState as useReactState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Toaster } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { LogConsole } from '@genomicx/ui';
import BrowserSessionBar from '@/components/BrowserSessionBar';
import BugReportModal from '@/components/BugReportModal';
import CircularPlot from '@/components/CircularPlot';
import ErrorBoundary from '@/components/ErrorBoundary';
import ErrorReportPanel from '@/components/ErrorReportPanel';
import ExportPanel from '@/components/ExportPanel';
import ReferenceInput from '@/components/ReferenceInput';
import RingsPanel from '@/components/RingsPanel';
import ControlPanel from '@/components/ControlPanel';
import StatisticsPanel from '@/components/StatisticsPanel';
import ImagePropertiesPanel from '@/components/ImagePropertiesPanel';
import ProductFooter from '@/components/ProductFooter';
import ProductNav from '@/components/ProductNav';
import { useBRIGController } from '@/hooks/useBRIGController';
import { formatVisibleConsoleLine, isUsefulConsoleLine } from '@/hooks/useConsoleCapture';
import type { PlotViewState } from '@/lib/types';

const AnnotationEditor = lazy(() => import('@/components/AnnotationEditor'));

function sameLegendPosition(
  left: PlotViewState['gcLegendPos'],
  right: PlotViewState['gcLegendPos'],
) {
  if (left === right) return true;
  return left !== null && right !== null && left.x === right.x && left.y === right.y;
}

function samePlotViewState(left: PlotViewState | null, right: PlotViewState) {
  return left !== null
    && left.zoom === right.zoom
    && left.panX === right.panX
    && left.panY === right.panY
    && sameLegendPosition(left.gcLegendPos, right.gcLegendPos)
    && sameLegendPosition(left.ringLegendPos, right.ringLegendPos);
}

export default function Home() {
  const {
    referenceFile, rings, setRings, params, setParams, progress, plotData,
    isProcessing, consoleLogs, imageProperties, setImageProperties,
    plotExpanded, setPlotExpanded,
    annotationEditorOpen, setAnnotationEditorOpen, editingRingId, setEditingRingId,
    ringAnnotations, referenceLength,
    handleReferenceFileChange, handleAnnotationsChange, handleOpenAnnotationEditor,
    handleRun, handleSaveSession, handleLoadSession, handleLoadSessionUrl,
  } = useBRIGController();

  const [searchParams] = useSearchParams();
  const sessionUrl = searchParams.get('url');
  const loadedSessionUrlRef = useRef<string | null>(null);
  const plotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [plotViewState, setPlotViewState] = useReactState<PlotViewState | null>(null);
  const [plotCentreSignal, setPlotCentreSignal] = useReactState(0);
  const [bugReportOpen, setBugReportOpen] = useReactState(false);
  const handleViewStateChange = useCallback((state: PlotViewState) => {
    setPlotViewState(previous => samePlotViewState(previous, state) ? previous : state);
  }, []);
  const displayedPlotData = useMemo(() => {
    if (!plotData) return null;
    return {
      ...plotData,
      reference: {
        ...plotData.reference,
        gcContent: params.showGCContent !== false ? plotData.reference.gcContent : undefined,
        gcSkew: params.showGCSkew !== false ? plotData.reference.gcSkew : undefined,
      },
    };
  }, [plotData, params.showGCContent, params.showGCSkew]);
  const visibleConsoleLogs = useMemo(
    () => consoleLogs.filter(isUsefulConsoleLine).map(formatVisibleConsoleLine),
    [consoleLogs],
  );
  useEffect(() => {
    if (!sessionUrl || loadedSessionUrlRef.current === sessionUrl) return;
    loadedSessionUrlRef.current = sessionUrl;
    void handleLoadSessionUrl(sessionUrl);
  }, [handleLoadSessionUrl, sessionUrl]);
  const togglePlotExpanded = () => {
    if (!plotExpanded) setPlotCentreSignal(signal => signal + 1);
    setPlotExpanded(value => !value);
  };

  return (
    <>
      <Toaster position="bottom-right" toastOptions={{ style: { maxWidth: 'min(32rem, calc(100vw - 2rem))', whiteSpace: 'normal', overflowWrap: 'anywhere', background: 'var(--gx-bg-alt)', color: 'var(--gx-text)', border: '1px solid var(--gx-border)' }, success: { duration: 3000, iconTheme: { primary: '#14B8A6', secondary: '#fff' } }, error: { duration: 6000, iconTheme: { primary: '#ef4444', secondary: '#fff' } } }} />
      <div className="browser-app-shell">
        <ProductNav />
        <BrowserSessionBar
          onSave={handleSaveSession}
          onLoad={handleLoadSession}
          onReportBug={() => setBugReportOpen(true)}
        />

        <main className="browser-workspace">
          <div className="product-width browser-workspace-grid">
              <div className="browser-inspector">
                <ReferenceInput
                  referenceFile={referenceFile}
                  onFileChange={handleReferenceFileChange}
                />
                <ImagePropertiesPanel imageProperties={imageProperties} onChange={setImageProperties} />
                <ControlPanel params={params} setParams={setParams} isProcessing={isProcessing} referenceFile={referenceFile} rings={rings} plotData={plotData} onRun={handleRun} />
              </div>

              <div
                className="browser-plot-pane"
                style={plotExpanded ? { zIndex: 10_000 } : undefined}
              >
                <RingsPanel rings={rings} setRings={setRings} onEditAnnotations={handleOpenAnnotationEditor} ringDataList={plotData?.rings} />

                <div
                  className={`card ${plotExpanded ? 'fixed inset-0 flex flex-col' : ''}`}
                  style={plotExpanded
                    ? { background: 'var(--gx-bg-alt)', borderRadius: 0, zIndex: 10_000 }
                    : undefined}
                >
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="section-title mb-0">Circular Plot</h2>
                    <div className="flex items-center gap-2">
                      <button onClick={togglePlotExpanded} className="btn-secondary text-xs px-2 py-1" title={plotExpanded ? 'Shrink plot' : 'Expand plot'}>
                        {plotExpanded ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                        )}
                      </button>
                      {plotData && displayedPlotData && (
                        <ExportPanel
                          plotData={plotData}
                          displayedPlotData={displayedPlotData}
                          imageProperties={imageProperties}
                          viewState={plotViewState}
                          plotCanvasRef={plotCanvasRef}
                        />
                      )}
                    </div>
                  </div>

                  {displayedPlotData ? (
                    <div className={plotExpanded ? 'flex-1 min-h-0' : ''}>
                      <ErrorBoundary>
                        <CircularPlot data={displayedPlotData} imageProperties={imageProperties} onViewStateChange={handleViewStateChange} centreViewSignal={plotCentreSignal} exportCanvasRef={plotCanvasRef} />
                      </ErrorBoundary>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-96" style={{ color: 'var(--gx-text-muted)' }}>
                      <div className="text-center">
                        <svg className="mx-auto h-24 w-24 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="1.5" /><circle cx="12" cy="12" r="6" strokeWidth="1.5" /><circle cx="12" cy="12" r="2" strokeWidth="1.5" /></svg>
                        <p className="text-lg">Load a reference genome to begin</p>
                        <p className="text-sm mt-2">The plot will generate automatically with GC content/skew rings</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 animate-fade-in">
                  {progress.step === 'Error' && progress.message && (
                    <ErrorReportPanel error={progress.message} diagnosticLogs={consoleLogs} onRetry={handleRun} />
                  )}
                  <LogConsole
                    logs={visibleConsoleLogs}
                    progress={progress.step === 'Error' ? undefined : progress}
                    title="Debug Console"
                  />
                </div>

                {plotData && <StatisticsPanel plotData={plotData} />}
              </div>
          </div>
        </main>

        <ProductFooter />
      </div>

      {annotationEditorOpen && editingRingId && (
        <Suspense fallback={(
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.6)' }}>
            <div className="card">Loading annotation editor…</div>
          </div>
        )}>
          <AnnotationEditor
            ringId={editingRingId}
            ringName={rings.find(r => r.id === editingRingId)?.legendText || 'Unknown Ring'}
            ringColor={rings.find(r => r.id === editingRingId)?.color}
            annotations={ringAnnotations[editingRingId] || []}
            referenceLength={referenceLength}
            onAnnotationsChange={handleAnnotationsChange}
            onClose={() => { setAnnotationEditorOpen(false); setEditingRingId(null); }}
          />
        </Suspense>
      )}

      {bugReportOpen && (
        <BugReportModal
          onClose={() => setBugReportOpen(false)}
        />
      )}
    </>
  );
}

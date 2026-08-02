
import { lazy, Suspense, useState as useReactState, useCallback, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import { NavBar, AppFooter, LogConsole } from '@genomicx/ui';
import CircularPlot from '@/components/CircularPlot';
import ErrorBoundary from '@/components/ErrorBoundary';
import ExportPanel from '@/components/ExportPanel';
import ReferenceInput from '@/components/ReferenceInput';
import RingsPanel from '@/components/RingsPanel';
import ControlPanel from '@/components/ControlPanel';
import StatisticsPanel from '@/components/StatisticsPanel';
import ImagePropertiesPanel from '@/components/ImagePropertiesPanel';
import { useBRIGController } from '@/hooks/useBRIGController';
import { APP_VERSION } from '@/lib/version';
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
    ringAnnotations, referenceAnnotations, referenceAnnotationFileName, referenceLength,
    handleReferenceFileChange, handleAnnotationsChange, handleOpenAnnotationEditor,
    handleReferenceAnnotationsFileChange, handleClearReferenceAnnotations,
    handleRun, handleSaveSession, handleLoadSession,
  } = useBRIGController();

  const [plotViewState, setPlotViewState] = useReactState<PlotViewState | null>(null);
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

  return (
    <>
      <Toaster position="bottom-right" toastOptions={{ style: { background: 'var(--gx-bg-alt)', color: 'var(--gx-text)', border: '1px solid var(--gx-border)' }, success: { duration: 3000, iconTheme: { primary: '#14B8A6', secondary: '#fff' } }, error: { duration: 6000, iconTheme: { primary: '#ef4444', secondary: '#fff' } } }} />
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--gx-bg)' }}>
        <NavBar
          appName="BRIGX"
          appSubtitle="Browser-based Ring Image Generator"
          version={APP_VERSION}
        />

        {/* Session sub-nav — styled like RonaQC's secondary tab strip */}
        <nav style={{ background: 'var(--gx-bg-alt)', borderBottom: '1px solid var(--gx-border)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto">
            <button
              type="button"
              onClick={handleSaveSession}
              className="text-sm px-4 py-2.5 shrink-0"
              style={{ color: 'var(--gx-text-muted)', borderBottom: '2px solid transparent' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--gx-text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--gx-text-muted)')}
              title="Download the current configuration and results as a JSON file"
            >
              Save Session
            </button>
            <label
              className="text-sm px-4 py-2.5 shrink-0 cursor-pointer"
              style={{ color: 'var(--gx-text-muted)', borderBottom: '2px solid transparent' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--gx-text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--gx-text-muted)')}
              title="Restore a previously saved session from a JSON file"
            >
              Load Session
              <input type="file" accept=".json" onChange={handleLoadSession} className="hidden" />
            </label>
          </div>
        </nav>

        <main className="flex-1 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 lg:items-start">
              <div className="lg:col-span-1 space-y-6 animate-fade-in lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2">
                <ReferenceInput
                  referenceFile={referenceFile}
                  onFileChange={handleReferenceFileChange}
                  referenceReady={referenceLength > 0}
                  referenceAnnotationFileName={referenceAnnotationFileName}
                  referenceAnnotationCount={referenceAnnotations.length}
                  onReferenceAnnotationFileChange={handleReferenceAnnotationsFileChange}
                  onClearReferenceAnnotations={handleClearReferenceAnnotations}
                />
                <RingsPanel rings={rings} setRings={setRings} onEditAnnotations={handleOpenAnnotationEditor} ringDataList={plotData?.rings} />
                <ControlPanel params={params} setParams={setParams} isProcessing={isProcessing} referenceFile={referenceFile} rings={rings} plotData={plotData} onRun={handleRun} />
              </div>

              <div
                className="lg:col-span-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto animate-slide-up"
                style={plotExpanded ? { zIndex: 10_000 } : undefined}
              >
                <ImagePropertiesPanel imageProperties={imageProperties} onChange={setImageProperties} />

                <div
                  className={`card ${plotExpanded ? 'fixed inset-0 flex flex-col' : ''}`}
                  style={plotExpanded
                    ? { background: 'var(--gx-bg-alt)', borderRadius: 0, zIndex: 10_000 }
                    : undefined}
                >
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="section-title mb-0">Circular Plot</h2>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPlotExpanded(value => !value)} className="btn-secondary text-xs px-2 py-1" title={plotExpanded ? 'Shrink plot' : 'Expand plot'}>
                        {plotExpanded ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                        )}
                      </button>
                      {plotData && <ExportPanel plotData={plotData} imageProperties={imageProperties} viewState={plotViewState} />}
                    </div>
                  </div>

                  {displayedPlotData ? (
                    <div className={plotExpanded ? 'flex-1 min-h-0' : ''}>
                      <ErrorBoundary>
                        <CircularPlot data={displayedPlotData} imageProperties={imageProperties} onViewStateChange={handleViewStateChange} />
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
                  <LogConsole logs={consoleLogs} progress={progress} title="Debug Console" />
                </div>

                {plotData && <StatisticsPanel plotData={plotData} />}
              </div>
            </div>
          </div>
        </main>

        <AppFooter appName="BRIGX" bugReportEmail="nabil@happykhan.com" bugReportUrl="https://github.com/happykhan/brigx/issues" bugReportItems={['A description of what happened and what you expected', 'Your input files (reference + query genomes)', 'Saved session file (use "Save Session" button)', 'Debug console output (copy from the Debug Console panel)', 'Browser name and version']} />
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
    </>
  );
}



import { useEffect, useRef, useState, useCallback, type RefObject } from 'react';
import type { CircularPlotData, PlotViewState } from '@/lib/types';
import type { ImagePropertiesConfig } from './ImageProperties';
import { CanvasPlotRenderer } from '@/lib/canvas-renderer';
import type { PlotTooltip } from '@/lib/rendering/types';

interface CircularPlotProps {
  data: CircularPlotData;
  imageProperties: ImagePropertiesConfig;
  onViewStateChange?: (state: PlotViewState) => void;
  squarePlot?: boolean;
  centreViewSignal?: number;
  exportCanvasRef?: RefObject<HTMLCanvasElement | null>;
}

interface TooltipInfo extends PlotTooltip {
  x: number;
  y: number;
}

export default function CircularPlot({ data, imageProperties, onViewStateChange, squarePlot = false, centreViewSignal = 0, exportCanvasRef }: CircularPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasPlotRenderer | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggingLegend, setDraggingLegend] = useState<'gc' | 'ring' | null>(null);
  const [legendDragStart, setLegendDragStart] = useState({ x: 0, y: 0 });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  const propsRef = useRef(imageProperties);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  dataRef.current = data;
  propsRef.current = imageProperties;
  zoomRef.current = zoom;
  panRef.current = pan;

  const onViewStateChangeRef = useRef(onViewStateChange);
  const previousCentreViewSignal = useRef(centreViewSignal);
  onViewStateChangeRef.current = onViewStateChange;

  const setCanvasElement = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    if (exportCanvasRef) exportCanvasRef.current = canvas;
  }, [exportCanvasRef]);

  /** Emit current view state to parent (for SVG export). */
  const emitViewState = useCallback(() => {
    const cb = onViewStateChangeRef.current;
    if (!cb) return;
    const renderer = rendererRef.current;
    const legendPos = renderer ? renderer.getLegendPositions() : { gcLegendPos: null, ringLegendPos: null };
    cb({
      zoom: zoomRef.current,
      panX: panRef.current.x,
      panY: panRef.current.y,
      gcLegendPos: legendPos.gcLegendPos,
      ringLegendPos: legendPos.ringLegendPos,
    });
  }, []);

  // Render at the container's actual pixel size, preserving zoom/pan
  const renderAtSize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    const d = dataRef.current;
    if (!canvas || !wrapper || !d) return;

    const ip = propsRef.current;

    // Always use fixed 1000x1000 logical space - CSS + DPI handle actual pixel size
    const logicalSize = 1000;

    // Preserve legend positions from previous renderer
    const prevRenderer = rendererRef.current;

    const renderer = new CanvasPlotRenderer({
      width: logicalSize,
      height: logicalSize,
      innerRadius: ip.innerRadius,
      ringWidth: ip.ringWidth,
      gcRingWidth: ip.gcRingWidth,
      ringSpacing: ip.ringSpacing,
      minIdentity: d.config.minIdentity,
      maxIdentity: 100,
      legendFontSize: ip.legendFontSize,
      scaleFontSize: ip.scaleFontSize,
      titleFontSize: ip.titleFontSize,
      labelFontSize: ip.labelFontSize,
      title: ip.title,
      showLegend: ip.showLegend
    });

    // Copy legend positions from old renderer if it exists
    if (prevRenderer) {
      renderer.copyLegendPositions(prevRenderer);
    }

    renderer.render(canvas, d, zoomRef.current, panRef.current.x, panRef.current.y);
    // CSS size: fill container while staying square
    const rect = wrapper.getBoundingClientRect();
    const cssSize = Math.floor(Math.min(rect.width, rect.height));
    canvas.style.width = cssSize + 'px';
    canvas.style.height = cssSize + 'px';
    rendererRef.current = renderer;
    emitViewState();
  }, [emitViewState]);

  // Re-render on data/config change
  useEffect(() => {
    renderAtSize();
  }, [data, imageProperties, renderAtSize]);

  // Re-render on container resize (e.g. expand/shrink)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    let resizeTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderAtSize, 100);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [renderAtSize]);

  // Redraw on zoom/pan change
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.redraw(zoom, pan.x, pan.y);
    }
    emitViewState();
  }, [zoom, pan, emitViewState]);

  // A fullscreen transition should not preserve a plot dragged partly off-canvas.
  // Keep the user's zoom and legend placement, but centre the circular map.
  useEffect(() => {
    if (previousCentreViewSignal.current === centreViewSignal) return;
    previousCentreViewSignal.current = centreViewSignal;
    setPan({ x: 0, y: 0 });
    setTooltip(null);
  }, [centreViewSignal]);

  const getCanvasCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { canvasX: 0, canvasY: 0 };
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const logicalW = canvas.width / dpr;
    const logicalH = canvas.height / dpr;
    return {
      canvasX: (e.clientX - rect.left) * (logicalW / rect.width),
      canvasY: (e.clientY - rect.top) * (logicalH / rect.height),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !rendererRef.current) return;

    // Check if clicking on a legend first
    const { canvasX, canvasY } = getCanvasCoords(e);
    const legendHit = rendererRef.current.legendHitTest(canvasX, canvasY, zoom, pan.x, pan.y);
    if (legendHit) {
      setDraggingLegend(legendHit);
      setLegendDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Legend dragging
    if (draggingLegend && rendererRef.current && canvasRef.current) {
      const dx = e.clientX - legendDragStart.x;
      const dy = e.clientY - legendDragStart.y;
      // Scale CSS px delta to logical space (canvas is 1000×1000 logical but rendered at CSS size)
      const scale = 1000 / (canvasRef.current.offsetWidth || 1000);
      rendererRef.current.moveLegend(draggingLegend, dx * scale, dy * scale, zoom);
      setLegendDragStart({ x: e.clientX, y: e.clientY });
      rendererRef.current.redraw(zoom, pan.x, pan.y);
      emitViewState();
      return;
    }

    // Pan dragging
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      return;
    }

    // Cursor: check if over a legend
    if (rendererRef.current && canvasRef.current) {
      const { canvasX, canvasY } = getCanvasCoords(e);
      const overLegend = rendererRef.current.legendHitTest(canvasX, canvasY, zoom, pan.x, pan.y);
      const wrapper = wrapperRef.current;
      if (wrapper) {
        wrapper.style.cursor = overLegend ? 'move' : (isDragging ? 'grabbing' : 'grab');
      }
    }

    // Hit testing for tooltips
    if (!rendererRef.current || !canvasRef.current) return;

    const { canvasX, canvasY } = getCanvasCoords(e);

    const hit = rendererRef.current.hitTest(canvasX, canvasY, zoom, pan.x, pan.y);
    if (hit) {
      const bounds = wrapperRef.current?.getBoundingClientRect();
      setTooltip({
        ...hit,
        x: bounds ? e.clientX - bounds.left : 0,
        y: bounds ? e.clientY - bounds.top : 0,
      });
    } else {
      setTooltip(null);
    }
  };

  const handleMouseUp = () => { setIsDragging(false); setDraggingLegend(null); };
  const handleMouseLeave = () => { handleMouseUp(); setTooltip(null); };

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.3));
  const handleResetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const handleCenterView = () => setPan({ x: 0, y: 0 });
  const handleResetLegends = () => {
    if (!rendererRef.current) return;
    rendererRef.current.resetLegendPositions();
    rendererRef.current.redraw(zoomRef.current, panRef.current.x, panRef.current.y);
    emitViewState();
  };

  // Scroll to zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.3, Math.min(5, prev * delta)));
  }, []);

  return (
    <div className={`relative flex flex-col ${squarePlot ? '' : 'h-full'}`}>
      {/* Toolbar - horizontal, always visible */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-t-lg" style={{ background: 'var(--gx-surface)', borderBottom: '1px solid var(--gx-border)' }}>
        <div className="flex items-center gap-1">
          <button type="button" onClick={handleZoomOut} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--gx-text)' }} title="Zoom out (or scroll down)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <div data-testid="plot-zoom" className="text-xs font-mono w-12 text-center" style={{ color: 'var(--gx-text-muted)' }}>
            {Math.round(zoom * 100)}%
          </div>
          <button type="button" onClick={handleZoomIn} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--gx-text)' }} title="Zoom in (or scroll up)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button type="button" onClick={handleCenterView} className="p-1.5 rounded hover:opacity-80 flex items-center gap-1" style={{ color: 'var(--gx-text)' }} title="Centre the plot (keep current zoom)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4M2 12h4m12 0h4" />
            </svg>
            <span className="text-xs">Centre</span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={handleResetLegends} className="text-xs px-2 py-1 rounded hover:opacity-80" style={{ color: 'var(--gx-text-muted)' }} title="Return both legends to their default positions without changing the plot view">
            Reset legends
          </button>
          <button type="button" onClick={handleResetView} className="text-xs px-2 py-1 rounded hover:opacity-80" style={{ color: 'var(--gx-text-muted)' }} title="Reset zoom to 100% and centre the plot">
            Reset zoom
          </button>
        </div>
      </div>

      {/* Plot area */}
      <div
        ref={wrapperRef}
        data-testid="plot-area"
        className={`${squarePlot ? 'aspect-square flex-none' : 'flex-1 min-h-0'} relative overflow-hidden flex items-center justify-center`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        data-plot-pan-x={Math.round(pan.x)}
        data-plot-pan-y={Math.round(pan.y)}
        style={{ cursor: draggingLegend ? 'move' : isDragging ? 'grabbing' : 'grab', background: 'var(--gx-bg-alt)' }}
      >
        <canvas
          ref={setCanvasElement}
          style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', background: 'white', boxShadow: '0 0 0 1px var(--gx-border)' }}
        />
        {tooltip && tooltip.x != null && tooltip.y != null && (
          <div
            data-testid="plot-tooltip"
            className="absolute text-sm rounded px-3 py-2 pointer-events-none z-10 max-w-56"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: `${tooltip.x > (wrapperRef.current?.clientWidth ?? 0) / 2 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)'} ${tooltip.y > (wrapperRef.current?.clientHeight ?? 0) / 2 ? 'translateY(calc(-100% - 10px))' : 'translateY(10px)'}`,
              background: 'var(--gx-bg)',
              color: 'var(--gx-text)',
              border: '1px solid var(--gx-border)',
              boxShadow: 'var(--gx-shadow)',
            }}
          >
          {tooltip.type === 'gc-content' ? (
            <>
              <div className="font-semibold" style={{ color: 'var(--gx-accent)' }}>GC Content</div>
              <div>Position: {tooltip.position?.toLocaleString()}</div>
              <div>Window: {tooltip.windowSize?.toLocaleString()} bp</div>
              <div>GC: {tooltip.gc}%</div>
            </>
          ) : tooltip.type === 'gc-skew' ? (
            <>
              <div className="font-semibold" style={{ color: 'var(--gx-accent)' }}>GC Skew</div>
              <div>Position: {tooltip.position?.toLocaleString()}</div>
              <div>Window: {tooltip.windowSize?.toLocaleString()} bp</div>
              <div>Skew: {tooltip.skew}</div>
            </>
          ) : tooltip.type === 'contig' ? (
            <>
              <div className="font-semibold" style={{ color: 'var(--gx-accent)' }}>{tooltip.name}</div>
              {tooltip.start != null && tooltip.end != null && (
                <div>Position: {tooltip.start.toLocaleString()} - {tooltip.end.toLocaleString()}</div>
              )}
              {tooltip.length != null && (
                <div>Length: {tooltip.length.toLocaleString()} bp</div>
              )}
            </>
          ) : tooltip.type === 'graph' ? (
            <>
              <div className="font-semibold" style={{ color: 'var(--gx-accent)' }}>{tooltip.queryName}</div>
              {tooltip.start != null && tooltip.end != null && (
                <div>Position: {tooltip.start.toLocaleString()} - {tooltip.end.toLocaleString()}</div>
              )}
              {tooltip.value != null && (
                <div>Value: {tooltip.value}</div>
              )}
            </>
          ) : tooltip.type === 'annotation' ? (
            <>
              <div className="font-semibold" style={{ color: 'var(--gx-accent)' }}>{tooltip.label}</div>
              {tooltip.start != null && tooltip.end != null && (
                <div>Position: {tooltip.start.toLocaleString()} - {tooltip.end.toLocaleString()}</div>
              )}
              {tooltip.strand && (
                <div>Strand: {tooltip.strand}</div>
              )}
            </>
          ) : (
            <>
              <div className="font-semibold" style={{ color: 'var(--gx-accent)' }}>{tooltip.queryName}</div>
              {tooltip.start != null && tooltip.end != null && (
                <div>Position: {tooltip.start.toLocaleString()} - {tooltip.end.toLocaleString()}</div>
              )}
              {tooltip.identity != null && (
                <div>Identity: {tooltip.identity.toFixed(1)}%</div>
              )}
              {tooltip.coverage != null && (
                <div>Coverage: {(tooltip.coverage * 100).toFixed(1)}%</div>
              )}
            </>
          )}
          </div>
        )}
      </div>
    </div>
  );
}

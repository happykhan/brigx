'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CircularPlotData } from '@/lib/types';
import type { ImagePropertiesConfig } from './ImageProperties';
import { CircularPlotRenderer } from '@/lib/renderer';

interface CircularPlotProps {
  data: CircularPlotData;
  imageProperties: ImagePropertiesConfig;
}

interface TooltipInfo {
  type?: string;
  queryName?: string;
  start?: number;
  end?: number;
  identity?: number;
  coverage?: number;
  position?: number;
  windowSize?: number;
  gc?: string;
  x: number;
  y: number;
}

export default function CircularPlot({ data, imageProperties }: CircularPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current || !data) return;

    const renderer = new CircularPlotRenderer({
      width: 1000,
      height: 1000,
      innerRadius: imageProperties.innerRadius,
      ringWidth: imageProperties.ringWidth,
      gcRingWidth: imageProperties.gcRingWidth,
      ringSpacing: imageProperties.ringSpacing,
      minIdentity: data.config.minIdentity,
      maxIdentity: 100,
      legendFontSize: imageProperties.legendFontSize,
      scaleFontSize: imageProperties.scaleFontSize,
      titleFontSize: imageProperties.titleFontSize,
      labelFontSize: imageProperties.labelFontSize,
      title: imageProperties.title
    });

    renderer.setTooltipCallback((info) => setTooltip(info));
    renderer.render(containerRef.current, data);

    const svg = containerRef.current.querySelector('svg');
    if (svg) {
      svgRef.current = svg;
    }
  }, [data, imageProperties]);

  // Apply zoom and pan transform
  useEffect(() => {
    if (svgRef.current) {
      const mainGroup = svgRef.current.querySelector('g.main-content');
      if (mainGroup) {
        const viewBox = svgRef.current.viewBox.baseVal;
        const cx = viewBox.width / 2;
        const cy = viewBox.height / 2;
        mainGroup.setAttribute(
          'transform',
          `translate(${cx + pan.x}, ${cy + pan.y}) scale(${zoom}) translate(${-cx}, ${-cy})`
        );
      }
    }
  }, [zoom, pan]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.3));
  const handleResetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Scroll to zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.3, Math.min(5, prev * delta)));
  }, []);

  return (
    <div className="relative h-full flex flex-col">
      {/* Toolbar - horizontal, always visible */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-t-lg" style={{ background: 'var(--gx-surface)', borderBottom: '1px solid var(--gx-border)' }}>
        <div className="flex items-center gap-1">
          <button type="button" onClick={handleZoomOut} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--gx-text)' }} title="Zoom out (or scroll down)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <div className="text-xs font-mono w-12 text-center" style={{ color: 'var(--gx-text-muted)' }}>
            {Math.round(zoom * 100)}%
          </div>
          <button type="button" onClick={handleZoomIn} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--gx-text)' }} title="Zoom in (or scroll up)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <button type="button" onClick={handleResetView} className="text-xs px-2 py-1 rounded hover:opacity-80" style={{ color: 'var(--gx-text-muted)' }} title="Reset zoom to 100% and centre the plot">
          Reset
        </button>
      </div>

      {/* Plot area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', background: 'white' }}
      />

      {tooltip && tooltip.x != null && tooltip.y != null && (
        <div
          className="fixed text-sm rounded px-3 py-2 pointer-events-none z-50"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y + 10,
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
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
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
    
    // Get the SVG element
    const svg = containerRef.current.querySelector('svg');
    if (svg) {
      svgRef.current = svg;
    }
  }, [data, imageProperties]);

  // Apply zoom and pan transform
  useEffect(() => {
    if (svgRef.current) {
      const content = svgRef.current.querySelector('g');
      if (content) {
        content.setAttribute('transform', `translate(${pan.x}, ${pan.y}) scale(${zoom})`);
      }
    }
  }, [zoom, pan]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newZoom = Math.min(Math.max(0.5, zoom + delta), 5);
    setZoom(newZoom);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.5));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="relative">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border border-gray-200 dark:border-gray-700">
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Zoom In"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Zoom Out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={handleResetView}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Reset View"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <div className="text-xs text-center text-gray-600 dark:text-gray-400 py-1 border-t border-gray-200 dark:border-gray-700">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      <div 
        ref={containerRef} 
        className="w-full overflow-hidden cursor-move"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />
      
      
      {tooltip && tooltip.x != null && tooltip.y != null && (
        <div
          className="fixed bg-black bg-opacity-90 text-white text-sm rounded px-3 py-2 pointer-events-none z-50"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y + 10
          }}
        >
          {tooltip.type === 'gc-content' ? (
            <>
              <div className="font-semibold">GC Content</div>
              <div>Position: {tooltip.position?.toLocaleString()}</div>
              <div>Window: {tooltip.windowSize?.toLocaleString()} bp</div>
              <div>GC: {tooltip.gc}%</div>
            </>
          ) : (
            <>
              <div className="font-semibold">{tooltip.queryName}</div>
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

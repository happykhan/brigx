'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import type { CircularPlotData } from '@/lib/types';
import { CircularPlotRenderer } from '@/lib/renderer';
import type { ImagePropertiesConfig } from './ImageProperties';

interface ExportPanelProps {
  plotData: CircularPlotData;
  imageProperties: ImagePropertiesConfig;
}

export default function ExportPanel({ plotData, imageProperties }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const exportSVG = () => {
    // Create temporary container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    const renderer = new CircularPlotRenderer({
      width: 1200,
      height: 1200,
      innerRadius: imageProperties.innerRadius,
      ringWidth: imageProperties.ringWidth,
      gcRingWidth: imageProperties.gcRingWidth,
      ringSpacing: imageProperties.ringSpacing,
      minIdentity: plotData.config.minIdentity,
      maxIdentity: 100,
      legendFontSize: imageProperties.legendFontSize,
      scaleFontSize: imageProperties.scaleFontSize,
      titleFontSize: imageProperties.titleFontSize,
      labelFontSize: imageProperties.labelFontSize,
      title: imageProperties.title
    });

    renderer.render(container, plotData);
    const svgString = renderer.exportSVG();

    // Download
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brig-plot-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);

    document.body.removeChild(container);
    toast.success('SVG exported successfully!');
  };

  const exportPNG = async () => {
    setIsExporting(true);
    try {
      // Create temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      const renderer = new CircularPlotRenderer({
        width: 1200,
        height: 1200,
        innerRadius: imageProperties.innerRadius,
        ringWidth: imageProperties.ringWidth,
        gcRingWidth: imageProperties.gcRingWidth,
        ringSpacing: imageProperties.ringSpacing,
        minIdentity: plotData.config.minIdentity,
        maxIdentity: 100,
        legendFontSize: imageProperties.legendFontSize,
        scaleFontSize: imageProperties.scaleFontSize,
        titleFontSize: imageProperties.titleFontSize,
        title: imageProperties.title
      });

      renderer.render(container, plotData);
      const svgString = renderer.exportSVG();

      // Convert SVG to PNG
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1200;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Fill white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Create image from SVG
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      await new Promise((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          resolve(undefined);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load SVG image'));
        };
        img.src = url;
      });

      // Convert canvas to PNG and download
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Failed to create PNG blob');
        }
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `brig-plot-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
        toast.success('PNG exported successfully!');
      }, 'image/png');

      document.body.removeChild(container);
    } catch (error) {
      console.error('PNG export error:', error);
      toast.error('Failed to export PNG');
    } finally {
      setIsExporting(false);
    }
  };

  const exportJSON = () => {
    const json = JSON.stringify(plotData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brig-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported successfully!');
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={exportSVG}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        SVG
      </button>
      <button
        onClick={exportPNG}
        disabled={isExporting}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExporting ? (
          <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Exporting...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            PNG
          </>
        )}
      </button>
      <button
        onClick={exportJSON}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Data
      </button>
    </div>
  );
}

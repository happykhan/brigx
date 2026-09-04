

import { useState, type RefObject } from 'react';
import toast from 'react-hot-toast';
import type { CircularPlotData, PlotViewState } from '@/lib/types';
import { CircularPlotRenderer } from '@/lib/renderer';
import type { ImagePropertiesConfig } from './ImageProperties';

interface ExportPanelProps {
  plotData: CircularPlotData;
  displayedPlotData: CircularPlotData;
  imageProperties: ImagePropertiesConfig;
  viewState?: PlotViewState | null;
  plotCanvasRef?: RefObject<HTMLCanvasElement | null>;
}

// The interactive canvas uses a fixed 1000x1000 logical coordinate system.
// SVG exports must use the same system so pan and dragged legend coordinates match exactly.
const PLOT_LOGICAL_SIZE = 1000;

function renderPlotSVG(
  plotData: CircularPlotData,
  imageProperties: ImagePropertiesConfig,
  viewState: PlotViewState | null | undefined,
): string {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  try {
    const renderer = new CircularPlotRenderer({
      width: PLOT_LOGICAL_SIZE,
      height: PLOT_LOGICAL_SIZE,
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
      title: imageProperties.title,
      showLegend: imageProperties.showLegend,
    });
    renderer.render(container, plotData, viewState ?? undefined);
    return renderer.exportSVG();
  } finally {
    container.remove();
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking synchronously can cancel downloads in Safari and embedded browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error(`Failed to create ${type} blob`));
    }, type);
  });
}

export default function ExportPanel({ plotData, displayedPlotData, imageProperties, viewState, plotCanvasRef }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const exportSVG = () => {
    const svgString = renderPlotSVG(displayedPlotData, imageProperties, viewState);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    downloadBlob(blob, `brig-plot-${Date.now()}.svg`);
    toast.success('SVG exported successfully!');
  };

  const exportPNG = async () => {
    setIsExporting(true);
    try {
      const sourceCanvas = plotCanvasRef?.current;
      if (!sourceCanvas) throw new Error('The plot canvas is not ready');

      // Rasterise the live interactive canvas so PNG output preserves the
      // exact current zoom, pan, labels and dragged legend positions.
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
      ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);

      const pngBlob = await canvasToBlob(canvas, 'image/png');
      downloadBlob(pngBlob, `brig-plot-${Date.now()}.png`);
      toast.success('PNG exported successfully!');
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
    downloadBlob(blob, `brig-data-${Date.now()}.json`);
    toast.success('Data exported successfully!');
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={exportSVG}
        className="btn-secondary text-xs px-3 py-1.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        SVG
      </button>
      <button
        onClick={exportPNG}
        disabled={isExporting}
        className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
        className="btn-secondary text-xs px-3 py-1.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Data
      </button>
    </div>
  );
}

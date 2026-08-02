import type { RingData } from '../types';
import { hexToRGB } from '../geometry';
import { roundedRectPath } from './canvasPrimitives';
import type { LegendBounds, Point, RenderConfig } from './types';

const BAR_WIDTH = 120;
const BAR_HEIGHT = 10;

function drawTitle(
  context: CanvasRenderingContext2D,
  title: string,
  x: number,
  y: number,
  fontSize: number,
): void {
  context.save();
  context.font = `bold ${fontSize}px sans-serif`;
  context.fillStyle = '#333';
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillText(title, x, y);
  context.restore();
}

function drawTicks(
  context: CanvasRenderingContext2D,
  ticks: ReadonlyArray<{ label: string; x: number }>,
  y: number,
  barHeight: number,
  fontSize: number,
): void {
  for (const tick of ticks) {
    context.save();
    context.strokeStyle = '#666';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(tick.x, y);
    context.lineTo(tick.x, y + barHeight + 3);
    context.stroke();
    context.restore();

    context.save();
    context.font = `${fontSize - 3}px sans-serif`;
    context.fillStyle = '#666';
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.fillText(tick.label, tick.x, y + barHeight + fontSize);
    context.restore();
  }
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillStyle: string | CanvasGradient,
  stroke = false,
): void {
  context.save();
  context.fillStyle = fillStyle;
  roundedRectPath(context, x, y, width, height, 2);
  context.fill();
  if (stroke) {
    context.strokeStyle = '#ccc';
    context.lineWidth = 0.5;
    context.stroke();
  }
  context.restore();
}

export function drawCanvasGCLegend(
  context: CanvasRenderingContext2D,
  config: RenderConfig,
  position: Point | null,
  hasGCContent: boolean,
  hasGCSkew: boolean,
): LegendBounds {
  const x = position?.x ?? 20;
  const startY = position?.y ?? 20;
  const fontSize = config.legendFontSize;
  let y = startY + fontSize;

  const sections = [
    hasGCContent && {
      title: 'GC Content',
      colors: ['rgb(255, 55, 50)', 'rgb(55, 255, 50)'],
      ticks: ['0%', '50%', '100%'],
    },
    hasGCSkew && {
      title: 'GC Skew',
      colors: ['#a855f7', '#22c55e'],
      ticks: ['-1', '0', '+1'],
    },
  ].filter((section): section is { title: string; colors: string[]; ticks: string[] } => Boolean(section));

  for (const section of sections) {
    drawTitle(context, section.title, x, y, fontSize);
    y += fontSize + 2;
    const gradient = context.createLinearGradient(x, y, x + BAR_WIDTH, y);
    gradient.addColorStop(0, section.colors[0]);
    gradient.addColorStop(1, section.colors[1]);
    fillRoundedRect(context, x, y, BAR_WIDTH, BAR_HEIGHT, gradient, true);
    drawTicks(context, [
      { label: section.ticks[0], x },
      { label: section.ticks[1], x: x + BAR_WIDTH / 2 },
      { label: section.ticks[2], x: x + BAR_WIDTH },
    ], y, BAR_HEIGHT, fontSize);
    y += BAR_HEIGHT + fontSize * 2 + 6;
  }

  return {
    x: x - 5,
    y: startY,
    width: BAR_WIDTH + 10,
    height: y - startY,
  };
}

export function drawCanvasRingLegend(
  context: CanvasRenderingContext2D,
  config: RenderConfig,
  position: Point | null,
  rings: readonly RingData[],
): LegendBounds {
  const x = position?.x ?? config.width - 200;
  const startY = position?.y ?? 20;
  const fontSize = config.legendFontSize;
  let y = startY + fontSize;

  for (const ring of rings.filter(candidate => candidate.visible)) {
    const hasHits = ring.hits.length > 0;
    if (!hasHits) {
      fillRoundedRect(context, x, y - fontSize + 3, 12, fontSize, ring.color);
      drawTitle(context, ring.queryName, x + 16, y, fontSize);
      y += fontSize * 2 + 2;
      continue;
    }

    drawTitle(context, ring.queryName, x, y, fontSize);
    y += fontSize + 2;
    const upper = ring.upperThreshold ?? config.maxIdentity;
    const lower = ring.lowerThreshold ?? config.minIdentity;
    const { r, g, b } = hexToRGB(ring.color);
    const gradient = context.createLinearGradient(x, 0, x + BAR_WIDTH, 0);
    gradient.addColorStop(0, `rgb(${Math.round(255 + (r - 255) * 0.15)}, ${Math.round(255 + (g - 255) * 0.15)}, ${Math.round(255 + (b - 255) * 0.15)})`);
    gradient.addColorStop(1, ring.color);
    const barY = y - BAR_HEIGHT + 2;
    fillRoundedRect(context, x, barY, BAR_WIDTH, BAR_HEIGHT, gradient, true);
    drawTicks(context, [
      { label: `${lower}%`, x },
      { label: `${Math.round((upper + lower) / 2)}%`, x: x + BAR_WIDTH / 2 },
      { label: `${upper}%`, x: x + BAR_WIDTH },
    ], barY, BAR_HEIGHT - 2, fontSize);
    y += fontSize + BAR_HEIGHT + 4 + fontSize;
  }

  return { x: x - 5, y: startY, width: 200, height: y - startY + 5 };
}

import {
  LEGEND_BAR_HEIGHT,
  LEGEND_BAR_WIDTH,
  type LegendScene,
} from './legendLayout';
import { roundedRectPath } from './canvasPrimitives';
import type { LegendBounds } from './types';

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

export function drawCanvasLegend(
  context: CanvasRenderingContext2D,
  scene: LegendScene,
): LegendBounds {
  for (const section of scene.sections) {
    drawTitle(context, section.title, section.titleX, section.titleY, scene.fontSize);

    if (section.kind === 'swatch' && section.swatch) {
      fillRoundedRect(
        context,
        section.swatch.x,
        section.swatch.y,
        section.swatch.width,
        section.swatch.height,
        section.swatch.fill,
      );
      continue;
    }

    if (
      section.kind !== 'gradient'
      || !section.colors
      || section.barY === undefined
      || !section.ticks
      || section.tickBottom === undefined
      || section.labelY === undefined
    ) continue;

    const gradient = context.createLinearGradient(
      scene.x,
      section.barY,
      scene.x + LEGEND_BAR_WIDTH,
      section.barY,
    );
    gradient.addColorStop(0, section.colors[0]);
    gradient.addColorStop(1, section.colors[1]);
    fillRoundedRect(
      context,
      scene.x,
      section.barY,
      LEGEND_BAR_WIDTH,
      LEGEND_BAR_HEIGHT,
      gradient,
      true,
    );

    for (const tick of section.ticks) {
      context.save();
      context.strokeStyle = '#666';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(tick.x, section.barY);
      context.lineTo(tick.x, section.tickBottom);
      context.stroke();
      context.restore();

      context.save();
      context.font = `${scene.fontSize - 3}px sans-serif`;
      context.fillStyle = '#666';
      context.textAlign = 'center';
      context.textBaseline = 'alphabetic';
      context.fillText(tick.label, tick.x, section.labelY);
      context.restore();
    }
  }

  return scene.bounds;
}

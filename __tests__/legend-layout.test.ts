import { describe, expect, it } from 'vitest';
import { CanvasPlotRenderer } from '@/lib/canvas-renderer';

const rendererConfig = {
  width: 1000,
  height: 1000,
  innerRadius: 200,
  ringWidth: 40,
  gcRingWidth: 40,
  ringSpacing: 4,
  minIdentity: 70,
  maxIdentity: 100,
  legendFontSize: 14,
  scaleFontSize: 12,
  titleFontSize: 22,
  labelFontSize: 14,
  title: '',
  showLegend: true,
};

describe('legend layout controls', () => {
  it('restores both draggable legends without changing the renderer view', () => {
    const renderer = new CanvasPlotRenderer(rendererConfig);
    renderer.moveLegend('gc', 250, 180, 1);
    renderer.moveLegend('ring', -320, 240, 1);

    expect(renderer.getLegendPositions()).toEqual({
      gcLegendPos: { x: 270, y: 200 },
      ringLegendPos: { x: 480, y: 260 },
    });

    renderer.resetLegendPositions();
    expect(renderer.getLegendPositions()).toEqual({
      gcLegendPos: null,
      ringLegendPos: null,
    });
  });
});

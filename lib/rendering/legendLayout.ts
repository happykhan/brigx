import type { RingData } from '../types';
import { hexToRGB } from '../geometry';
import type { LegendBounds, Point, RenderConfig } from './types';

export const LEGEND_BAR_WIDTH = 120;
export const LEGEND_BAR_HEIGHT = 10;

export interface LegendTickScene {
  x: number;
  label: string;
}

export interface LegendSectionScene {
  kind: 'gradient' | 'swatch';
  title: string;
  titleX: number;
  titleY: number;
  colors?: readonly [string, string];
  ticks?: readonly LegendTickScene[];
  barY?: number;
  tickBottom?: number;
  labelY?: number;
  gradientId?: string;
  swatch?: { x: number; y: number; width: number; height: number; fill: string };
}

export interface LegendScene {
  x: number;
  fontSize: number;
  bounds: LegendBounds;
  sections: readonly LegendSectionScene[];
}

function ticks(x: number, labels: readonly [string, string, string]): LegendTickScene[] {
  return [
    { label: labels[0], x },
    { label: labels[1], x: x + LEGEND_BAR_WIDTH / 2 },
    { label: labels[2], x: x + LEGEND_BAR_WIDTH },
  ];
}

export function buildGCLegendScene(
  config: RenderConfig,
  position: Point | null,
  hasGCContent: boolean,
  hasGCSkew: boolean,
): LegendScene {
  const x = position?.x ?? 20;
  const startY = position?.y ?? 20;
  const fontSize = config.legendFontSize;
  const sections: LegendSectionScene[] = [];
  let y = startY + fontSize;

  const addSection = (
    title: string,
    colors: readonly [string, string],
    labels: readonly [string, string, string],
    gradientId: string,
  ) => {
    const titleY = y;
    const barY = titleY + fontSize + 2;
    sections.push({
      kind: 'gradient',
      title,
      titleX: x,
      titleY,
      colors,
      ticks: ticks(x, labels),
      barY,
      tickBottom: barY + LEGEND_BAR_HEIGHT + 3,
      labelY: barY + LEGEND_BAR_HEIGHT + fontSize,
      gradientId,
    });
    y = barY + LEGEND_BAR_HEIGHT + fontSize * 2 + 6;
  };

  if (hasGCContent) {
    addSection('GC Content', ['rgb(255, 55, 50)', 'rgb(55, 255, 50)'], ['0%', '50%', '100%'], 'gc-content-grad');
  }
  if (hasGCSkew) {
    addSection('GC Skew', ['#a855f7', '#22c55e'], ['-1', '0', '+1'], 'gc-skew-grad');
  }

  return {
    x,
    fontSize,
    sections,
    bounds: { x: x - 5, y: startY, width: LEGEND_BAR_WIDTH + 10, height: y - startY },
  };
}

export function buildRingLegendScene(
  config: RenderConfig,
  position: Point | null,
  rings: readonly RingData[],
): LegendScene {
  const x = position?.x ?? config.width - 200;
  const startY = position?.y ?? 20;
  const fontSize = config.legendFontSize;
  const sections: LegendSectionScene[] = [];
  let y = startY + fontSize;

  for (const ring of rings.filter(candidate => candidate.visible)) {
    if (ring.hits.length === 0) {
      sections.push({
        kind: 'swatch',
        title: ring.queryName,
        titleX: x + 16,
        titleY: y,
        swatch: {
          x,
          y: y - fontSize + 3,
          width: 12,
          height: fontSize,
          fill: ring.color,
        },
      });
      y += fontSize * 2 + 2;
      continue;
    }

    const upper = ring.upperThreshold ?? config.maxIdentity;
    const lower = ring.lowerThreshold ?? config.minIdentity;
    const { r, g, b } = hexToRGB(ring.color);
    const titleY = y;
    const barY = titleY + fontSize - LEGEND_BAR_HEIGHT + 4;
    sections.push({
      kind: 'gradient',
      title: ring.queryName,
      titleX: x,
      titleY,
      colors: [
        `rgb(${Math.round(255 + (r - 255) * 0.15)}, ${Math.round(255 + (g - 255) * 0.15)}, ${Math.round(255 + (b - 255) * 0.15)})`,
        ring.color,
      ],
      ticks: ticks(x, [`${lower}%`, `${Math.round((upper + lower) / 2)}%`, `${upper}%`]),
      barY,
      tickBottom: barY + LEGEND_BAR_HEIGHT + 1,
      labelY: titleY + fontSize * 2 + 2,
      gradientId: `grad-${ring.queryId}`,
    });
    y += fontSize * 3 + LEGEND_BAR_HEIGHT + 6;
  }

  return {
    x,
    fontSize,
    sections,
    bounds: { x: x - 5, y: startY, width: 200, height: y - startY + 5 },
  };
}

export interface RenderConfig {
  width: number;
  height: number;
  innerRadius: number;
  ringWidth: number;
  gcRingWidth: number;
  ringSpacing: number;
  minIdentity: number;
  maxIdentity: number;
  legendFontSize: number;
  scaleFontSize: number;
  titleFontSize: number;
  labelFontSize: number;
  title: string;
  showLegend?: boolean;
}

export interface PlotTooltip {
  type?: string;
  queryName?: string;
  start?: number;
  end?: number;
  identity?: number;
  coverage?: number;
  position?: number;
  windowSize?: number;
  gc?: string;
  skew?: string;
  name?: string;
  length?: number;
  value?: string;
  label?: string;
  strand?: string;
  x?: number;
  y?: number;
}

export type TooltipCallback = (info: PlotTooltip | null) => void;

export type LegendKind = 'gc' | 'ring';

export interface Point {
  x: number;
  y: number;
}

export interface LegendPositions {
  gcLegendPos: Point | null;
  ringLegendPos: Point | null;
}

export interface LegendBounds extends Point {
  width: number;
  height: number;
}

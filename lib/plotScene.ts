import {
  calculateRingLayout,
  getColorIntensity,
  hexToRGB,
  positionToAngle,
  type RingLayout,
} from './geometry';
import { collectReferenceAnnotations } from './referenceAnnotations';
import type {
  Annotation,
  CircularPlotData,
  ContigBoundary,
  PlotViewState,
  PipelineParams,
  RingData,
} from './types';
import type { PlotTooltip, RenderConfig } from './rendering/types';
import {
  buildGCLegendScene,
  buildRingLegendScene,
  type LegendScene,
} from './rendering/legendLayout';

export interface ArcScene {
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
  fill: string;
  opacity: number;
  tooltip: PlotTooltip;
}

export interface MetricArcScene extends ArcScene {
  value: string;
}

export interface MetricRingScene {
  layout: RingLayout;
  baseRadius: number;
  arcs: readonly MetricArcScene[];
}

export interface AlignmentArcScene extends ArcScene {
  start: number;
  end: number;
  identity: number;
  alignmentLength: number;
}

export interface GraphArcScene extends ArcScene {
  start: number;
  end: number;
  value: number;
}

export interface ContigArcScene extends ArcScene {
  name: string;
  start: number;
  end: number;
  label: { x: number; y: number; text: string; fontSize: number } | null;
}

export interface PlotRingScene {
  ring: RingData;
  layout: RingLayout;
  annotations: readonly Annotation[];
  alignmentArcs: readonly AlignmentArcScene[];
  graphArcs: readonly GraphArcScene[];
}

export interface PlotScene {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  referenceLength: number;
  referenceAnnotations: readonly Annotation[];
  gcContent: MetricRingScene | null;
  gcSkew: MetricRingScene | null;
  rings: readonly PlotRingScene[];
  contigs: readonly ContigBoundary[];
  contigLayout: RingLayout | null;
  contigArcs: readonly ContigArcScene[];
  scaleMarkers: ReadonlyArray<{
    position: number;
    line: { x1: number; y1: number; x2: number; y2: number };
    label: { x: number; y: number; text: string };
  }>;
  gcLegend: LegendScene | null;
  ringLegend: LegendScene | null;
  viewState: PlotViewState;
}

const DEFAULT_VIEW_STATE: PlotViewState = {
  zoom: 1,
  panX: 0,
  panY: 0,
  gcLegendPos: null,
  ringLegendPos: null,
};

/** Apply presentation-only controls without discarding analysis data. */
export function selectDisplayedPlotData(
  data: CircularPlotData,
  params: Pick<PipelineParams, 'showGCContent' | 'showGCSkew'>,
): CircularPlotData {
  return {
    ...data,
    reference: {
      ...data.reference,
      gcContent: params.showGCContent !== false ? data.reference.gcContent : undefined,
      gcSkew: params.showGCSkew !== false ? data.reference.gcSkew : undefined,
    },
  };
}

function buildMetricRing(
  values: readonly number[] | undefined,
  layout: RingLayout | null,
  referenceLength: number,
  kind: 'gc-content' | 'gc-skew',
): MetricRingScene | null {
  if (!values || !layout) return null;
  const baseRadius = layout.radius + layout.width / 2;
  const maxBarHeight = layout.width / 2;
  const windowSize = referenceLength / values.length;
  const scaleValues = kind === 'gc-content'
    ? values.map(value => Math.abs(value - 0.5)).sort((left, right) => left - right)
    : values.map(Math.abs).sort((left, right) => left - right);
  const percentile95 = scaleValues[Math.floor(scaleValues.length * 0.95)] || 0.1;
  const scaleFactor = percentile95 > 0
    ? (kind === 'gc-content' ? 0.5 : 1) / percentile95
    : 1;

  const arcs = values.map((value, index): MetricArcScene => {
    const start = index * windowSize;
    const end = (index + 1) * windowSize;
    const signedValue = kind === 'gc-content' ? value - 0.5 : value;
    const barHeight = Math.min(maxBarHeight, Math.abs(signedValue) * scaleFactor * maxBarHeight);
    const innerRadius = signedValue >= 0 ? baseRadius : baseRadius - barHeight;
    const outerRadius = signedValue >= 0 ? baseRadius + barHeight : baseRadius;
    const formattedValue = kind === 'gc-content'
      ? (value * 100).toFixed(1)
      : value.toFixed(3);
    const fill = kind === 'gc-content'
      ? `rgb(${Math.floor((1 - value) * 200 + 55)}, ${Math.floor(value * 200 + 55)}, 50)`
      : value >= 0 ? '#22c55e' : '#a855f7';

    return {
      startAngle: positionToAngle(start, referenceLength),
      endAngle: positionToAngle(end, referenceLength),
      innerRadius,
      outerRadius,
      fill,
      opacity: 0.8,
      value: formattedValue,
      tooltip: {
        type: kind,
        [kind === 'gc-content' ? 'gc' : 'skew']: formattedValue,
        position: Math.floor(start),
        windowSize: Math.floor(windowSize),
      },
    };
  });

  return { layout, baseRadius, arcs };
}

function buildAlignmentArcs(
  ring: RingData,
  layout: RingLayout,
  referenceLength: number,
  config: RenderConfig,
): AlignmentArcScene[] {
  const sortedHits = [...ring.hits]
    .sort((left, right) => (right.refEnd - right.refStart) - (left.refEnd - left.refStart));
  const drawnRegions: Array<{ start: number; end: number }> = [];
  const arcs: AlignmentArcScene[] = [];

  for (const hit of sortedHits) {
    if (drawnRegions.some(region => hit.refStart >= region.start && hit.refEnd <= region.end)) continue;
    arcs.push({
      startAngle: positionToAngle(hit.refStart, referenceLength),
      endAngle: positionToAngle(hit.refEnd, referenceLength),
      innerRadius: layout.radius,
      outerRadius: layout.radius + layout.width,
      fill: getColorIntensity(
        ring.color,
        hit.percentIdentity,
        ring.lowerThreshold ?? config.minIdentity,
        ring.upperThreshold ?? config.maxIdentity,
      ),
      opacity: 1,
      start: hit.refStart,
      end: hit.refEnd,
      identity: hit.percentIdentity,
      alignmentLength: hit.alignmentLength,
      tooltip: {
        type: 'alignment',
        queryName: ring.queryName,
        start: hit.refStart,
        end: hit.refEnd,
        identity: hit.percentIdentity,
        coverage: 1,
      },
    });
    drawnRegions.push({ start: hit.refStart, end: hit.refEnd });
  }
  return arcs;
}

function buildGraphArcs(
  ring: RingData,
  layout: RingLayout,
  referenceLength: number,
): GraphArcScene[] {
  const capValue = ring.graphMaxCap || ring.graphMaxValue || 1;
  const { r, g, b } = hexToRGB(ring.color);
  return (ring.graphPoints ?? [])
    .filter(point => point.value > 0)
    .map((point): GraphArcScene => {
      const barHeight = Math.min(1, point.value / capValue) * layout.width;
      return {
        startAngle: positionToAngle(point.start, referenceLength),
        endAngle: positionToAngle(point.end, referenceLength),
        innerRadius: layout.radius,
        outerRadius: layout.radius + barHeight,
        fill: ring.graphMaxCap != null && point.value > capValue
          ? 'rgb(30, 100, 220)'
          : `rgb(${r}, ${g}, ${b})`,
        opacity: 0.8,
        start: point.start,
        end: point.end,
        value: point.value,
        tooltip: {
          type: 'graph',
          queryName: ring.queryName,
          start: point.start,
          end: point.end,
          value: point.value.toFixed(2),
        },
      };
    });
}

function buildContigArcs(
  contigs: readonly ContigBoundary[],
  layout: RingLayout | null,
  referenceLength: number,
  centerX: number,
  centerY: number,
  scaleFontSize: number,
): ContigArcScene[] {
  if (!layout) return [];
  const colors = ['#ef4444', '#3b82f6'];
  return contigs.map((contig): ContigArcScene => {
    const startAngle = positionToAngle(contig.start, referenceLength);
    const endAngle = positionToAngle(contig.end, referenceLength);
    const color = colors[contig.index % colors.length];
    const labelRadius = layout.radius + layout.width + 8;
    const midAngle = (startAngle + endAngle) / 2;
    const showLabel = (contig.end - contig.start) / referenceLength > 0.02;
    return {
      startAngle,
      endAngle,
      innerRadius: layout.radius,
      outerRadius: layout.radius + layout.width,
      fill: color,
      opacity: 0.6,
      name: contig.name,
      start: contig.start,
      end: contig.end,
      label: showLabel ? {
        x: centerX + labelRadius * Math.cos(midAngle),
        y: centerY + labelRadius * Math.sin(midAngle),
        text: contig.name.length > 15 ? `${contig.name.substring(0, 12)}...` : contig.name,
        fontSize: Math.max(7, scaleFontSize - 2),
      } : null,
      tooltip: {
        type: 'contig',
        name: contig.name,
        start: contig.start,
        end: contig.end,
        length: contig.end - contig.start,
      },
    };
  });
}

function buildScaleMarkers(
  centerX: number,
  centerY: number,
  referenceLength: number,
  radius: number,
): PlotScene['scaleMarkers'] {
  return Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * 2 * Math.PI - Math.PI / 2;
    const position = Math.floor((index / 12) * referenceLength);
    const tickLength = index === 3 || index === 9 ? 8 : 18;
    return {
      position,
      line: {
        x1: centerX + (radius - tickLength) * Math.cos(angle),
        y1: centerY + (radius - tickLength) * Math.sin(angle),
        x2: centerX + (radius + 3) * Math.cos(angle),
        y2: centerY + (radius + 3) * Math.sin(angle),
      },
      label: {
        x: centerX + (radius - 30) * Math.cos(angle),
        y: centerY + (radius - 30) * Math.sin(angle),
        text: `${(position / 1000).toFixed(0)}kb`,
      },
    };
  });
}

/**
 * Build the renderer-independent track plan for a plot.
 *
 * Canvas and SVG deliberately remain separate painting backends, but neither
 * backend should independently decide which tracks exist or where they sit.
 */
export function buildPlotScene(
  data: CircularPlotData,
  config: RenderConfig,
  viewState: PlotViewState = DEFAULT_VIEW_STATE,
): PlotScene {
  const visibleRings = (data.rings ?? []).filter(ring => ring.visible);
  const contigs = data.reference.contigs && data.reference.contigs.length > 1
    ? data.reference.contigs
    : [];
  const layouts = calculateRingLayout(
    {
      innerRadius: config.innerRadius,
      ringWidth: config.ringWidth,
      gcRingWidth: config.gcRingWidth,
      ringSpacing: config.ringSpacing,
    },
    {
      hasGCContent: Boolean(data.reference.gcContent),
      hasGCSkew: Boolean(data.reference.gcSkew),
      rings: visibleRings,
      hasContigs: contigs.length > 0,
    },
  );

  const layoutFor = (type: RingLayout['type']) => (
    layouts.find(layout => layout.type === type) ?? null
  );
  const gcContentLayout = layoutFor('gc-content');
  const gcSkewLayout = layoutFor('gc-skew');
  const centerX = config.width / 2;
  const centerY = config.height / 2;
  const referenceLength = data.reference.length;
  const contigLayout = layoutFor('contig');

  return {
    width: config.width,
    height: config.height,
    centerX,
    centerY,
    referenceLength,
    referenceAnnotations: collectReferenceAnnotations(
      data.reference.features,
      data.reference.annotations,
    ),
    gcContent: buildMetricRing(data.reference.gcContent, gcContentLayout, referenceLength, 'gc-content'),
    gcSkew: buildMetricRing(data.reference.gcSkew, gcSkewLayout, referenceLength, 'gc-skew'),
    rings: visibleRings.map(ring => {
      const layout = layouts.find(candidate => candidate.queryId === ring.queryId);
      if (!layout) throw new Error(`Missing layout for visible ring ${ring.queryId}`);
      return {
        ring,
        layout,
        annotations: ring.annotations ?? [],
        alignmentArcs: layout.type === 'alignment'
          ? buildAlignmentArcs(ring, layout, referenceLength, config)
          : [],
        graphArcs: layout.type === 'graph'
          ? buildGraphArcs(ring, layout, referenceLength)
          : [],
      };
    }),
    contigs,
    contigLayout,
    contigArcs: buildContigArcs(
      contigs,
      contigLayout,
      referenceLength,
      centerX,
      centerY,
      config.scaleFontSize,
    ),
    scaleMarkers: buildScaleMarkers(centerX, centerY, referenceLength, config.innerRadius),
    gcLegend: config.showLegend !== false && (data.reference.gcContent || data.reference.gcSkew)
      ? buildGCLegendScene(
          config,
          viewState.gcLegendPos,
          Boolean(data.reference.gcContent),
          Boolean(data.reference.gcSkew),
        )
      : null,
    ringLegend: config.showLegend !== false && visibleRings.length > 0
      ? buildRingLegendScene(config, viewState.ringLegendPos, visibleRings)
      : null,
    viewState,
  };
}

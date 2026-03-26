// Canvas 2D renderer for circular genome plot (display only; SVG renderer kept for export)

import type { CircularPlotData, RingData, Annotation, ContigBoundary } from './types';
import type { RenderConfig } from './renderer';
import { positionToAngle, hexToRGB, getColorIntensity, calculateRingLayout } from './geometry';

// ----- Hit region index for mouse interaction -----
interface HitRegion {
  innerR: number;
  outerR: number;
  startAngle: number;
  endAngle: number;
  tooltip: Record<string, unknown>;
}

// ----- Cached geometry for efficient redraw -----
interface CachedScene {
  data: CircularPlotData;
  config: RenderConfig;
  width: number;
  height: number;
}

// Legend bounding box for dragging
interface LegendBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CanvasPlotRenderer {
  private config: RenderConfig;
  private hitRegions: HitRegion[] = [];
  private cachedScene: CachedScene | null = null;
  private canvas: HTMLCanvasElement | null = null;

  // Draggable legend positions (null = use default)
  private gcLegendPos: { x: number; y: number } | null = null;
  private ringLegendPos: { x: number; y: number } | null = null;

  // Bounding boxes computed during last draw (for hit testing)
  private gcLegendBounds: LegendBounds | null = null;
  private ringLegendBounds: LegendBounds | null = null;

  constructor(config: RenderConfig) {
    this.config = config;
  }

  // ------- Public API -------

  /** Copy legend positions from another renderer instance (preserves user drag state). */
  copyLegendPositions(other: CanvasPlotRenderer): void {
    this.gcLegendPos = other.gcLegendPos;
    this.ringLegendPos = other.ringLegendPos;
  }

  render(canvas: HTMLCanvasElement, data: CircularPlotData, zoom: number = 1, panX: number = 0, panY: number = 0): void {
    this.canvas = canvas;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    // Size the canvas backing store for high-DPI
    canvas.width = this.config.width * dpr;
    canvas.height = this.config.height * dpr;

    // Don't set CSS size here - let the component control it

    this.cachedScene = { data, config: { ...this.config }, width: canvas.width, height: canvas.height };
    this.hitRegions = [];
    this.drawScene(canvas, data, zoom, panX, panY, dpr);
  }

  /**
   * Redraw with the given zoom / pan. Zoom and pan are in CSS-pixel space.
   */
  redraw(zoom: number, panX: number, panY: number): void {
    if (!this.canvas || !this.cachedScene) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.hitRegions = [];
    this.drawScene(this.canvas, this.cachedScene.data, zoom, panX, panY, dpr);
  }

  /**
   * Hit-test a CSS-pixel position on the canvas and return the tooltip payload, or null.
   */
  hitTest(canvasX: number, canvasY: number, zoom: number, panX: number, panY: number): Record<string, unknown> | null {
    // Convert CSS mouse coords to logical coords (undo zoom/pan)
    const cx = this.config.width / 2;
    const cy = this.config.height / 2;

    // The transform applied during drawing is:
    //   translate(cx + panX, cy + panY)  scale(zoom)  translate(-cx, -cy)
    // So to get logical coords from CSS coords:
    const logicalX = (canvasX - cx - panX) / zoom + cx;
    const logicalY = (canvasY - cy - panY) / zoom + cy;

    // Convert to polar from plot centre
    const dx = logicalX - cx;
    const dy = logicalY - cy;
    const r = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx); // -PI..PI

    // Search hit regions (reverse order so topmost drawn elements match first)
    for (let i = this.hitRegions.length - 1; i >= 0; i--) {
      const hr = this.hitRegions[i];
      if (r < hr.innerR || r > hr.outerR) continue;

      // Normalise angles for comparison
      let s = hr.startAngle;
      let e = hr.endAngle;
      let a = angle;
      // Bring all into 0..2PI
      while (s < 0) s += 2 * Math.PI;
      while (e < 0) e += 2 * Math.PI;
      while (a < 0) a += 2 * Math.PI;

      // Handle wrap-around
      if (s <= e) {
        if (a >= s && a <= e) return hr.tooltip;
      } else {
        if (a >= s || a <= e) return hr.tooltip;
      }
    }
    return null;
  }

  /**
   * Test if a logical coordinate is over a legend. Returns 'gc' | 'ring' | null.
   */
  legendHitTest(canvasX: number, canvasY: number, zoom: number, panX: number, panY: number): 'gc' | 'ring' | null {
    const cx = this.config.width / 2;
    const cy = this.config.height / 2;
    const logicalX = (canvasX - cx - panX) / zoom + cx;
    const logicalY = (canvasY - cy - panY) / zoom + cy;

    if (this.gcLegendBounds) {
      const b = this.gcLegendBounds;
      if (logicalX >= b.x && logicalX <= b.x + b.width && logicalY >= b.y && logicalY <= b.y + b.height) {
        return 'gc';
      }
    }
    if (this.ringLegendBounds) {
      const b = this.ringLegendBounds;
      if (logicalX >= b.x && logicalX <= b.x + b.width && logicalY >= b.y && logicalY <= b.y + b.height) {
        return 'ring';
      }
    }
    return null;
  }

  /**
   * Move a legend by a delta in logical coordinates.
   */
  moveLegend(which: 'gc' | 'ring', deltaX: number, deltaY: number, zoom: number): void {
    const dx = deltaX / zoom;
    const dy = deltaY / zoom;
    if (which === 'gc') {
      const cur = this.gcLegendPos || { x: 20, y: 20 };
      this.gcLegendPos = { x: cur.x + dx, y: cur.y + dy };
    } else {
      const cur = this.ringLegendPos || { x: this.config.width - 200, y: 20 };
      this.ringLegendPos = { x: cur.x + dx, y: cur.y + dy };
    }
  }

  // ------- Private drawing methods -------

  private drawScene(
    canvas: HTMLCanvasElement,
    data: CircularPlotData,
    zoom: number,
    panX: number,
    panY: number,
    dpr: number
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = this.config.width;
    const h = this.config.height;
    const cx = w / 2;
    const cy = h / 2;
    const refLength = data.reference.length;

    // Clear and fill white background
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, w, h);

    // Apply zoom/pan transform (same semantics as SVG main-content group)
    ctx.save();
    ctx.translate(cx + panX, cy + panY);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);

    // --- Reference ring ---
    this.drawCircle(ctx, cx, cy, this.config.innerRadius, '#333', 2);

    // --- Ring layout ---
    const layouts = calculateRingLayout(
      {
        innerRadius: this.config.innerRadius,
        ringWidth: this.config.ringWidth,
        gcRingWidth: this.config.gcRingWidth,
        ringSpacing: this.config.ringSpacing,
      },
      {
        hasGCContent: !!data.reference.gcContent,
        hasGCSkew: !!data.reference.gcSkew,
        rings: data.rings || [],
        hasContigs: !!(data.reference.contigs && data.reference.contigs.length > 1),
      }
    );

    // GC Content ring
    if (data.reference.gcContent) {
      const layout = layouts.find(l => l.type === 'gc-content')!;
      this.drawGCRing(ctx, cx, cy, refLength, data.reference.gcContent, layout.radius);
    }

    // GC Skew ring
    if (data.reference.gcSkew) {
      const layout = layouts.find(l => l.type === 'gc-skew')!;
      this.drawGCSkewRing(ctx, cx, cy, refLength, data.reference.gcSkew, layout.radius);
    }

    // Query rings (alignment + graph)
    const visibleRings = (data.rings || []).filter(r => r.visible);
    for (const ring of visibleRings) {
      const layout = layouts.find(l => l.queryId === ring.queryId);
      if (!layout) continue;
      const ringWidth = layout.width;
      const radius = layout.radius;

      if (ring.graphPoints && ring.graphPoints.length > 0) {
        this.drawGraphRing(ctx, cx, cy, refLength, ring, radius, ringWidth);
      } else {
        this.drawQueryRing(ctx, cx, cy, refLength, ring, radius, ringWidth);
      }

      if (ring.annotations && ring.annotations.length > 0) {
        this.drawAnnotations(ctx, cx, cy, refLength, ring.annotations, radius, radius + ringWidth, ring.showLabels !== false);
      }
    }

    // Contig boundaries
    if (data.reference.contigs && data.reference.contigs.length > 1) {
      const layout = layouts.find(l => l.type === 'contig')!;
      this.drawContigBoundaries(ctx, cx, cy, refLength, data.reference.contigs, layout.radius, layout.width);
    }

    // Scale markers
    this.drawScaleMarkers(ctx, cx, cy, refLength);

    // Title
    this.drawTitle(ctx, cx, cy, refLength);

    // Legends
    if (this.config.showLegend !== false) {
      if (data.reference.gcContent || data.reference.gcSkew) {
        this.drawGCLegend(ctx, !!data.reference.gcContent, !!data.reference.gcSkew);
      }
      if (visibleRings.length > 0) {
        this.drawRingLegend(ctx, visibleRings);
      }
    }

    ctx.restore();
  }

  // ------- Primitive helpers -------

  private drawCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, strokeColor: string, lineWidth: number, dash?: number[]): void {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  }

  private drawAnnularArc(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    innerR: number, outerR: number,
    startAngle: number, endAngle: number,
    fillStyle: string,
    opacity: number = 1,
    strokeStyle?: string,
    strokeWidth?: number
  ): void {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle, endAngle);
    ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = strokeWidth || 0.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  private addHitRegion(innerR: number, outerR: number, startAngle: number, endAngle: number, tooltip: Record<string, unknown>): void {
    this.hitRegions.push({ innerR, outerR, startAngle, endAngle, tooltip });
  }

  // ------- GC Content Ring -------

  private drawGCRing(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    refLength: number,
    gcContent: number[],
    ringRadius: number
  ): void {
    const ringWidth = this.config.gcRingWidth;
    const baseRadius = ringRadius + ringWidth / 2;
    const maxBarHeight = ringWidth / 2;
    const windowSize = refLength / gcContent.length;

    // 95th percentile scaling
    const deviations = gcContent.map(gc => Math.abs(gc - 0.5)).sort((a, b) => a - b);
    const p95 = deviations[Math.floor(deviations.length * 0.95)] || 0.1;
    const scaleFactor = p95 > 0 ? 0.5 / p95 : 1;

    // Ring boundaries
    this.drawCircle(ctx, cx, cy, ringRadius, '#ccc', 1);
    this.drawCircle(ctx, cx, cy, ringRadius + ringWidth, '#ccc', 1);
    // Baseline (dashed)
    this.drawCircle(ctx, cx, cy, baseRadius, '#999', 1, [3, 3]);

    for (let i = 0; i < gcContent.length; i++) {
      const gc = gcContent[i];
      const start = i * windowSize;
      const end = (i + 1) * windowSize;
      const startAngle = positionToAngle(start, refLength);
      const endAngle = positionToAngle(end, refLength);

      const deviation = gc - 0.5;
      const barHeight = Math.min(maxBarHeight, Math.abs(deviation) * scaleFactor * maxBarHeight);

      let innerR: number, outerR: number;
      if (deviation >= 0) {
        innerR = baseRadius;
        outerR = baseRadius + barHeight;
      } else {
        innerR = baseRadius - barHeight;
        outerR = baseRadius;
      }

      const r = Math.floor((1 - gc) * 200 + 55);
      const g = Math.floor(gc * 200 + 55);
      const b = 50;

      this.drawAnnularArc(ctx, cx, cy, innerR, outerR, startAngle, endAngle, `rgb(${r}, ${g}, ${b})`, 0.8);
      this.addHitRegion(innerR, outerR, startAngle, endAngle, {
        type: 'gc-content',
        gc: (gc * 100).toFixed(1),
        position: Math.floor(start),
        windowSize: Math.floor(windowSize),
      });
    }
  }

  // ------- GC Skew Ring -------

  private drawGCSkewRing(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    refLength: number,
    gcSkew: number[],
    ringRadius: number
  ): void {
    const ringWidth = this.config.gcRingWidth;
    const baseRadius = ringRadius + ringWidth / 2;
    const maxBarHeight = ringWidth / 2;
    const windowSize = refLength / gcSkew.length;

    const skewAbs = gcSkew.map(Math.abs).sort((a, b) => a - b);
    const p95Skew = skewAbs[Math.floor(skewAbs.length * 0.95)] || 0.1;
    const scaleFactor = p95Skew > 0 ? 1 / p95Skew : 1;

    this.drawCircle(ctx, cx, cy, ringRadius, '#ccc', 1);
    this.drawCircle(ctx, cx, cy, ringRadius + ringWidth, '#ccc', 1);
    this.drawCircle(ctx, cx, cy, baseRadius, '#999', 1, [3, 3]);

    for (let i = 0; i < gcSkew.length; i++) {
      const skew = gcSkew[i];
      const start = i * windowSize;
      const end = (i + 1) * windowSize;
      const startAngle = positionToAngle(start, refLength);
      const endAngle = positionToAngle(end, refLength);

      const barHeight = Math.min(maxBarHeight, Math.abs(skew) * scaleFactor * maxBarHeight);
      let innerR: number, outerR: number, color: string;

      if (skew >= 0) {
        innerR = baseRadius;
        outerR = baseRadius + barHeight;
        color = '#22c55e';
      } else {
        innerR = baseRadius - barHeight;
        outerR = baseRadius;
        color = '#a855f7';
      }

      this.drawAnnularArc(ctx, cx, cy, innerR, outerR, startAngle, endAngle, color, 0.8);
      this.addHitRegion(innerR, outerR, startAngle, endAngle, {
        type: 'gc-skew',
        skew: skew.toFixed(3),
        position: Math.floor(start),
        windowSize: Math.floor(windowSize),
      });
    }
  }

  // ------- Query (BLAST alignment) Ring -------

  private drawQueryRing(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    refLength: number,
    ring: RingData,
    radius: number,
    ringWidth: number
  ): void {
    if (!ring.hits || ring.hits.length === 0) return;

    // Sort hits largest first (smallest drawn last, on top)
    const sortedHits = [...ring.hits].sort((a, b) => (b.refEnd - b.refStart) - (a.refEnd - a.refStart));

    const drawnRegions: Array<{ start: number; end: number }> = [];

    for (const hit of sortedHits) {
      const isOccluded = drawnRegions.some(region => hit.refStart >= region.start && hit.refEnd <= region.end);
      if (isOccluded) continue;

      const startAngle = positionToAngle(hit.refStart, refLength);
      const endAngle = positionToAngle(hit.refEnd, refLength);

      const color = getColorIntensity(
        ring.color,
        hit.percentIdentity,
        ring.lowerThreshold ?? this.config.minIdentity,
        ring.upperThreshold ?? 100
      );

      this.drawAnnularArc(ctx, cx, cy, radius, radius + ringWidth, startAngle, endAngle, color);

      this.addHitRegion(radius, radius + ringWidth, startAngle, endAngle, {
        type: 'alignment',
        queryName: ring.queryName,
        start: hit.refStart,
        end: hit.refEnd,
        identity: hit.percentIdentity,
        coverage: 1.0,
      });

      drawnRegions.push({ start: hit.refStart, end: hit.refEnd });
    }
  }

  // ------- Graph Ring -------

  private drawGraphRing(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    refLength: number,
    ring: RingData,
    radius: number,
    ringWidth: number
  ): void {
    const points = ring.graphPoints!;
    const capValue = ring.graphMaxCap || ring.graphMaxValue || 1;
    const { r: cr, g: cg, b: cb } = hexToRGB(ring.color);

    // Ring boundaries
    this.drawCircle(ctx, cx, cy, radius, '#ccc', 0.5);
    this.drawCircle(ctx, cx, cy, radius + ringWidth, '#ccc', 0.5);

    for (const point of points) {
      if (point.value <= 0) continue;

      const startAngle = positionToAngle(point.start, refLength);
      const endAngle = positionToAngle(point.end, refLength);
      const isOverCap = ring.graphMaxCap != null && point.value > capValue;
      const fraction = Math.min(1, point.value / capValue);
      const barHeight = fraction * ringWidth;

      const fill = isOverCap ? 'rgb(30, 100, 220)' : `rgb(${cr}, ${cg}, ${cb})`;
      this.drawAnnularArc(ctx, cx, cy, radius, radius + barHeight, startAngle, endAngle, fill, 0.8);

      this.addHitRegion(radius, radius + barHeight, startAngle, endAngle, {
        type: 'graph',
        queryName: ring.queryName,
        start: point.start,
        end: point.end,
        value: point.value.toFixed(2),
      });
    }
  }

  // ------- Contig Boundaries -------

  private drawContigBoundaries(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    refLength: number,
    contigs: ContigBoundary[],
    radius: number,
    ringWidth: number
  ): void {
    const colors = ['#ef4444', '#3b82f6'];

    for (const contig of contigs) {
      const startAngle = positionToAngle(contig.start, refLength);
      const endAngle = positionToAngle(contig.end, refLength);
      const color = colors[contig.index % 2];

      this.drawAnnularArc(ctx, cx, cy, radius, radius + ringWidth, startAngle, endAngle, color, 0.6);

      this.addHitRegion(radius, radius + ringWidth, startAngle, endAngle, {
        type: 'contig',
        name: contig.name,
        start: contig.start,
        end: contig.end,
        length: contig.end - contig.start,
      });

      // Contig label
      const midAngle = (startAngle + endAngle) / 2;
      const labelRadius = radius + ringWidth + 8;
      const arcSpan = contig.end - contig.start;

      if (arcSpan / refLength > 0.02) {
        const lx = cx + labelRadius * Math.cos(midAngle);
        const ly = cy + labelRadius * Math.sin(midAngle);
        const fontSize = Math.max(7, this.config.scaleFontSize - 2);
        const displayName = contig.name.length > 15 ? contig.name.substring(0, 12) + '...' : contig.name;

        ctx.save();
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayName, lx, ly);
        ctx.restore();
      }
    }
  }

  // ------- Annotations -------

  private drawAnnotations(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    refLength: number,
    annotations: Annotation[],
    innerRadius: number,
    outerRadius: number,
    showLabels: boolean
  ): void {
    if (!annotations || annotations.length === 0) return;

    const MAX_LABELS = 200;
    if (showLabels && annotations.length > MAX_LABELS) {
      showLabels = false;
    }

    // --- Label collision detection (same algorithm as SVG renderer) ---
    interface LabelPosition {
      annotation: Annotation;
      midAngle: number;
      adjustedAngle: number;
      labelX: number;
      labelY: number;
      width: number;
      height: number;
    }

    const labelPositions: LabelPosition[] = [];
    const labelDistance = outerRadius + 30;

    if (showLabels) {
      for (const ann of annotations) {
        if (!ann.label || ann.label.trim() === '') continue;
        const start = Math.max(1, Math.min(ann.start, refLength));
        const end = Math.max(1, Math.min(ann.end, refLength));
        const startAngle = positionToAngle(start, refLength);
        const endAngle = positionToAngle(end, refLength);
        const midAngle = (startAngle + endAngle) / 2;
        const textWidth = ann.label.length * (this.config.labelFontSize * 0.6);
        const textHeight = this.config.labelFontSize + 4;
        labelPositions.push({ annotation: ann, midAngle, adjustedAngle: midAngle, labelX: 0, labelY: 0, width: textWidth, height: textHeight });
      }

      labelPositions.sort((a, b) => a.midAngle - b.midAngle);

      const getMinAngularSeparation = (lp1: LabelPosition, lp2: LabelPosition) => {
        const avgWidth = (lp1.width + lp2.width) / 2;
        const avgHeight = (lp1.height + lp2.height) / 2;
        const maxDimension = Math.max(avgWidth, avgHeight);
        return (maxDimension + 10) / labelDistance;
      };

      for (let iteration = 0; iteration < 15; iteration++) {
        let hasOverlap = false;
        for (let i = 0; i < labelPositions.length; i++) {
          for (let j = i + 1; j < labelPositions.length; j++) {
            const curr = labelPositions[i];
            const next = labelPositions[j];
            const minSeparation = getMinAngularSeparation(curr, next);
            let angleDiff = Math.abs(next.adjustedAngle - curr.adjustedAngle);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
            if (angleDiff < minSeparation) {
              hasOverlap = true;
              const adjustment = minSeparation - angleDiff;
              const direction = next.adjustedAngle > curr.adjustedAngle ? 1 : -1;
              curr.adjustedAngle -= adjustment * 0.8 * 0.5 * direction;
              next.adjustedAngle += adjustment * 0.8 * 0.5 * direction;
            }
          }
        }
        if (!hasOverlap) break;
      }

      for (const lp of labelPositions) {
        lp.labelX = cx + labelDistance * Math.cos(lp.adjustedAngle);
        lp.labelY = cy + labelDistance * Math.sin(lp.adjustedAngle);
      }
    }

    const labelMap = new Map<string, LabelPosition>();
    for (const lp of labelPositions) {
      labelMap.set(`${lp.annotation.start}-${lp.annotation.end}-${lp.annotation.label}`, lp);
    }

    // --- Render annotations ---
    for (const ann of annotations) {
      const start = Math.max(1, Math.min(ann.start, refLength));
      const end = Math.max(1, Math.min(ann.end, refLength));
      const startAngle = positionToAngle(start, refLength);
      const endAngle = positionToAngle(end, refLength);
      const color = ann.color || '#666666';
      const key = `${ann.start}-${ann.end}-${ann.label}`;
      const lp = labelMap.get(key);

      if (ann.shape === 'block') {
        this.drawAnnularArc(ctx, cx, cy, innerRadius, outerRadius, startAngle, endAngle, color, 0.7, '#000', 0.5);
        this.addHitRegion(innerRadius, outerRadius, startAngle, endAngle, { type: 'annotation', label: ann.label, start: ann.start, end: ann.end });

        if (showLabels && lp) {
          this.drawAnnotationLabel(ctx, cx, cy, innerRadius, outerRadius, startAngle, endAngle, lp);
        }
      } else if (ann.shape === 'arrow-forward' || ann.shape === 'arrow-reverse') {
        this.drawArrowAnnotation(ctx, cx, cy, innerRadius, outerRadius, startAngle, endAngle, color, ann.shape === 'arrow-forward');
        this.addHitRegion(innerRadius, outerRadius, startAngle, endAngle, {
          type: 'annotation', label: ann.label, start: ann.start, end: ann.end,
          strand: ann.shape === 'arrow-forward' ? '+' : '-',
        });

        if (showLabels && lp) {
          this.drawAnnotationLabel(ctx, cx, cy, innerRadius, outerRadius, startAngle, endAngle, lp);
        }
      }
      // 'arc' and 'hidden' shapes are not rendered visually (consistent with SVG renderer)
    }
  }

  private drawArrowAnnotation(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    innerRadius: number, outerRadius: number,
    startAngle: number, endAngle: number,
    color: string,
    isForward: boolean
  ): void {
    const totalAngleSpan = endAngle - startAngle;
    let arrowHeadAngle: number;
    let hasBody: boolean;

    if (totalAngleSpan < 0.05) {
      arrowHeadAngle = totalAngleSpan;
      hasBody = false;
    } else if (totalAngleSpan < 0.15) {
      arrowHeadAngle = totalAngleSpan * 0.6;
      hasBody = true;
    } else {
      arrowHeadAngle = Math.min(0.15, totalAngleSpan * 0.15);
      hasBody = true;
    }

    const bodyStartAngle = isForward ? startAngle : startAngle + arrowHeadAngle;
    const bodyEndAngle = isForward ? endAngle - arrowHeadAngle : endAngle;
    const headTipAngle = isForward ? endAngle : startAngle;
    const headBaseAngle = isForward ? bodyEndAngle : bodyStartAngle;

    const midRadius = (innerRadius + outerRadius) / 2;
    const tipX = cx + midRadius * Math.cos(headTipAngle);
    const tipY = cy + midRadius * Math.sin(headTipAngle);
    const innerBaseX = cx + innerRadius * Math.cos(headBaseAngle);
    const innerBaseY = cy + innerRadius * Math.sin(headBaseAngle);
    const outerBaseX = cx + outerRadius * Math.cos(headBaseAngle);
    const outerBaseY = cy + outerRadius * Math.sin(headBaseAngle);

    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.beginPath();

    if (hasBody) {
      const bodyStartInnerX = cx + innerRadius * Math.cos(bodyStartAngle);
      const bodyStartInnerY = cy + innerRadius * Math.sin(bodyStartAngle);

      ctx.moveTo(bodyStartInnerX, bodyStartInnerY);
      ctx.arc(cx, cy, innerRadius, bodyStartAngle, headBaseAngle, !isForward);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(outerBaseX, outerBaseY);
      ctx.arc(cx, cy, outerRadius, headBaseAngle, bodyStartAngle, isForward);
      ctx.closePath();
    } else {
      ctx.moveTo(innerBaseX, innerBaseY);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(outerBaseX, outerBaseY);
      ctx.closePath();
    }

    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();
  }

  private drawAnnotationLabel(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    innerRadius: number, outerRadius: number,
    startAngle: number, endAngle: number,
    lp: { labelX: number; labelY: number; width: number; height: number; annotation: Annotation }
  ): void {
    const midAngle = (startAngle + endAngle) / 2;
    const featureRadius = (innerRadius + outerRadius) / 2;
    const featureX = cx + featureRadius * Math.cos(midAngle);
    const featureY = cy + featureRadius * Math.sin(midAngle);

    // Leader line
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(featureX, featureY);
    ctx.lineTo(lp.labelX, lp.labelY);
    ctx.stroke();
    ctx.restore();

    // Label background
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    const rx = 3;
    this.roundRect(ctx, lp.labelX - lp.width / 2, lp.labelY - lp.height / 2, lp.width, lp.height, rx);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Label text
    ctx.save();
    ctx.font = `bold ${this.config.labelFontSize}px sans-serif`;
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lp.annotation.label, lp.labelX, lp.labelY);
    ctx.restore();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ------- Scale Markers -------

  private drawScaleMarkers(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    refLength: number
  ): void {
    const numMarkers = 12;
    const markerRadius = this.config.innerRadius;

    for (let i = 0; i < numMarkers; i++) {
      const angle = (i / numMarkers) * 2 * Math.PI - Math.PI / 2;
      const position = Math.floor((i / numMarkers) * refLength);

      const is3or9 = (i === 3 || i === 9);
      const tickLength = is3or9 ? 8 : 18;

      const x1 = cx + (markerRadius - tickLength) * Math.cos(angle);
      const y1 = cy + (markerRadius - tickLength) * Math.sin(angle);
      const x2 = cx + (markerRadius + 3) * Math.cos(angle);
      const y2 = cy + (markerRadius + 3) * Math.sin(angle);

      ctx.save();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();

      // Label
      const labelRadius = markerRadius - 30;
      const tx = cx + labelRadius * Math.cos(angle);
      const ty = cy + labelRadius * Math.sin(angle);

      ctx.save();
      ctx.font = `${this.config.scaleFontSize}px sans-serif`;
      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${(position / 1000).toFixed(0)}kb`, tx, ty);
      ctx.restore();
    }
  }

  // ------- Title -------

  private drawTitle(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    refLength: number
  ): void {
    if (this.config.title) {
      ctx.save();
      ctx.font = `bold ${this.config.titleFontSize}px sans-serif`;
      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.config.title, cx, cy - 10);
      ctx.restore();
    }

    ctx.save();
    ctx.font = `${this.config.titleFontSize * 0.6}px sans-serif`;
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${refLength.toLocaleString()} bp`, cx, cy + (this.config.title ? 15 : 0));
    ctx.restore();
  }

  // ------- GC Legend (top-left) -------

  private drawGCLegend(ctx: CanvasRenderingContext2D, hasGCContent: boolean, hasGCSkew: boolean): void {
    const legendX = this.gcLegendPos?.x ?? 20;
    const legendY = this.gcLegendPos?.y ?? 20;
    const fs = this.config.legendFontSize;
    const barW = 120;
    const barH = 10;
    let y = legendY + fs;

    if (hasGCContent) {
      // Title
      ctx.save();
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.fillStyle = '#333';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('GC Content', legendX, y);
      ctx.restore();
      y += fs + 2;

      // Gradient bar
      const grad = ctx.createLinearGradient(legendX, y, legendX + barW, y);
      grad.addColorStop(0, 'rgb(255, 55, 50)');
      grad.addColorStop(1, 'rgb(55, 255, 50)');
      ctx.save();
      ctx.fillStyle = grad;
      this.roundRect(ctx, legendX, y, barW, barH, 2);
      ctx.fill();
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();

      // Ticks
      const gcTicks = [
        { label: '0%', x: legendX },
        { label: '50%', x: legendX + barW / 2 },
        { label: '100%', x: legendX + barW },
      ];
      for (const tick of gcTicks) {
        ctx.save();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tick.x, y);
        ctx.lineTo(tick.x, y + barH + 3);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.font = `${fs - 3}px sans-serif`;
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(tick.label, tick.x, y + barH + fs);
        ctx.restore();
      }
      y += barH + fs * 2 + 6;
    }

    if (hasGCSkew) {
      ctx.save();
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.fillStyle = '#333';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('GC Skew', legendX, y);
      ctx.restore();
      y += fs + 2;

      const grad = ctx.createLinearGradient(legendX, y, legendX + barW, y);
      grad.addColorStop(0, '#a855f7');
      grad.addColorStop(1, '#22c55e');
      ctx.save();
      ctx.fillStyle = grad;
      this.roundRect(ctx, legendX, y, barW, barH, 2);
      ctx.fill();
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();

      const skewTicks = [
        { label: '-1', x: legendX },
        { label: '0', x: legendX + barW / 2 },
        { label: '+1', x: legendX + barW },
      ];
      for (const tick of skewTicks) {
        ctx.save();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tick.x, y);
        ctx.lineTo(tick.x, y + barH + 3);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.font = `${fs - 3}px sans-serif`;
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(tick.label, tick.x, y + barH + fs);
        ctx.restore();
      }
    }

    // Record bounds for dragging
    this.gcLegendBounds = { x: legendX - 5, y: legendY, width: barW + 10, height: y + barH + fs + 5 - legendY };
  }

  // ------- Ring Legend (top-right) -------

  private drawRingLegend(ctx: CanvasRenderingContext2D, rings: RingData[]): void {
    const legendX = this.ringLegendPos?.x ?? (this.config.width - 200);
    const legendY = this.ringLegendPos?.y ?? 20;
    const fs = this.config.legendFontSize;
    let y = legendY + fs;

    const hasBlastHits = (r: RingData) => r.hits && r.hits.length > 0;
    const isGraphRing = (r: RingData) => r.graphPoints && r.graphPoints.length > 0;

    for (const ring of rings.filter(r => r.visible)) {
      if (hasBlastHits(ring)) {
        // Ring name
        ctx.save();
        ctx.font = `bold ${fs}px sans-serif`;
        ctx.fillStyle = '#333';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(ring.queryName, legendX, y);
        ctx.restore();
        y += fs + 2;

        const upper = ring.upperThreshold ?? 100;
        const lower = ring.lowerThreshold ?? this.config.minIdentity;
        const barW = 120;
        const barH = 10;

        // Gradient bar (faded colour -> full colour)
        const { r: cr, g: cg, b: cb } = hexToRGB(ring.color);
        const grad = ctx.createLinearGradient(legendX, 0, legendX + barW, 0);
        grad.addColorStop(0, `rgb(${Math.round(255 + (cr - 255) * 0.15)}, ${Math.round(255 + (cg - 255) * 0.15)}, ${Math.round(255 + (cb - 255) * 0.15)})`);
        grad.addColorStop(1, ring.color);

        ctx.save();
        ctx.fillStyle = grad;
        this.roundRect(ctx, legendX, y - barH + 2, barW, barH, 2);
        ctx.fill();
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();

        // Tick marks
        const ticks = [
          { pct: lower, x: legendX },
          { pct: Math.round((upper + lower) / 2), x: legendX + barW / 2 },
          { pct: upper, x: legendX + barW },
        ];
        for (const tick of ticks) {
          ctx.save();
          ctx.strokeStyle = '#666';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(tick.x, y - barH + 2);
          ctx.lineTo(tick.x, y + 4);
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.font = `${fs - 3}px sans-serif`;
          ctx.fillStyle = '#666';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(`${tick.pct}%`, tick.x, y + fs);
          ctx.restore();
        }
        y += fs + barH + 4;
      } else if (isGraphRing(ring)) {
        // Colour swatch + name
        ctx.save();
        ctx.fillStyle = ring.color;
        this.roundRect(ctx, legendX, y - fs + 3, 12, fs, 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.font = `bold ${fs}px sans-serif`;
        ctx.fillStyle = '#333';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(ring.queryName, legendX + 16, y);
        ctx.restore();
        y += fs + 2;
      } else {
        // No data - colour swatch + name
        ctx.save();
        ctx.fillStyle = ring.color;
        this.roundRect(ctx, legendX, y - fs + 3, 12, fs, 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.font = `bold ${fs}px sans-serif`;
        ctx.fillStyle = '#333';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(ring.queryName, legendX + 16, y);
        ctx.restore();
        y += fs + 2;
      }

      y += fs; // gap between rings
    }

    // Record bounds for dragging
    this.ringLegendBounds = { x: legendX - 5, y: legendY, width: 200, height: y - legendY + 5 };
  }
}

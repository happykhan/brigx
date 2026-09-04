// Canvas 2D renderer for circular genome plot (display only; SVG renderer kept for export)

import type { CircularPlotData, Annotation } from './types';
import type { LegendBounds, PlotTooltip, RenderConfig } from './rendering/types';
import {
  buildPlotScene,
  type AlignmentArcScene,
  type ContigArcScene,
  type GraphArcScene,
  type MetricRingScene,
  type PlotScene,
} from './plotScene';
import { drawCanvasAnnotations } from './rendering/canvasAnnotations';
import { drawAnnularArc, drawCircle } from './rendering/canvasPrimitives';
import { drawCanvasLegend } from './rendering/canvasLegends';

interface HitRegion {
  innerR: number;
  outerR: number;
  startAngle: number;
  endAngle: number;
  tooltip: PlotTooltip;
}

// ----- Cached geometry for efficient redraw -----
interface CachedScene {
  data: CircularPlotData;
  config: RenderConfig;
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

  /** Return the current legend positions (for threading to the SVG export renderer). */
  getLegendPositions(): { gcLegendPos: { x: number; y: number } | null; ringLegendPos: { x: number; y: number } | null } {
    return { gcLegendPos: this.gcLegendPos, ringLegendPos: this.ringLegendPos };
  }

  /** Restore both draggable legends to their default corners. */
  resetLegendPositions(): void {
    this.gcLegendPos = null;
    this.ringLegendPos = null;
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
  hitTest(canvasX: number, canvasY: number, zoom: number, panX: number, panY: number): PlotTooltip | null {
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
    // Legends are screen-space overlays and are deliberately independent of
    // the plot zoom/pan transform.
    void zoom;
    void panX;
    void panY;
    const logicalX = canvasX;
    const logicalY = canvasY;

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
    void zoom;
    const dx = deltaX;
    const dy = deltaY;
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

    const scene = buildPlotScene(data, this.config, {
      zoom,
      panX,
      panY,
      gcLegendPos: this.gcLegendPos,
      ringLegendPos: this.ringLegendPos,
    });
    const w = scene.width;
    const h = scene.height;
    const cx = scene.centerX;
    const cy = scene.centerY;
    const refLength = scene.referenceLength;

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
    drawCircle(ctx, cx, cy, this.config.innerRadius, '#333', 2);

    // Reference features from GenBank/GBFF or a companion annotation file.
    if (scene.referenceAnnotations.length > 0) {
      const featureInner = Math.max(10, this.config.innerRadius - 30);
      const featureOuter = this.config.innerRadius;
      this.drawAnnotations(ctx, cx, cy, refLength, scene.referenceAnnotations, featureInner, featureOuter, true, true);
    }

    // GC Content ring
    if (scene.gcContent) {
      this.drawMetricRing(ctx, cx, cy, scene.gcContent);
    }

    // GC Skew ring
    if (scene.gcSkew) {
      this.drawMetricRing(ctx, cx, cy, scene.gcSkew);
    }

    // Query rings (alignment + graph)
    for (const track of scene.rings) {
      const { ring, layout, annotations } = track;
      const ringWidth = layout.width;
      const radius = layout.radius;

      if (ring.graphPoints && ring.graphPoints.length > 0) {
        this.drawGraphRing(ctx, cx, cy, layout, track.graphArcs);
      } else {
        this.drawQueryRing(ctx, cx, cy, track.alignmentArcs);
      }

      if (annotations.length > 0) {
        this.drawAnnotations(ctx, cx, cy, refLength, annotations, radius, radius + ringWidth, ring.showLabels !== false);
      }
    }

    // Contig boundaries
    if (scene.contigs.length > 0 && scene.contigLayout) {
      this.drawContigBoundaries(ctx, cx, cy, scene.contigArcs);
    }

    // Scale markers
    this.drawScaleMarkers(ctx, scene.scaleMarkers);

    // Title
    this.drawTitle(ctx, cx, cy, refLength);

    // Finish the transformed map before drawing screen-space legend overlays.
    ctx.restore();

    // Legends remain fixed while the map is panned or zoomed.
    this.gcLegendBounds = scene.gcLegend ? drawCanvasLegend(ctx, scene.gcLegend) : null;
    this.ringLegendBounds = scene.ringLegend ? drawCanvasLegend(ctx, scene.ringLegend) : null;

  }

 private addHitRegion(innerR: number, outerR: number, startAngle: number, endAngle: number, tooltip: PlotTooltip): void {
    this.hitRegions.push({ innerR, outerR, startAngle, endAngle, tooltip });
  }

  // ------- GC Content Ring -------

  private drawMetricRing(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    scene: MetricRingScene,
  ): void {
    drawCircle(ctx, cx, cy, scene.layout.radius, '#ccc', 1);
    drawCircle(ctx, cx, cy, scene.layout.radius + scene.layout.width, '#ccc', 1);
    drawCircle(ctx, cx, cy, scene.baseRadius, '#999', 1, [3, 3]);

    for (const arc of scene.arcs) {
      drawAnnularArc(
        ctx,
        cx,
        cy,
        arc.innerRadius,
        arc.outerRadius,
        arc.startAngle,
        arc.endAngle,
        arc.fill,
        arc.opacity,
      );
      this.addHitRegion(arc.innerRadius, arc.outerRadius, arc.startAngle, arc.endAngle, arc.tooltip);
    }
  }

  // ------- Query (BLAST alignment) Ring -------

  private drawQueryRing(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    arcs: readonly AlignmentArcScene[],
  ): void {
    for (const arc of arcs) {
      drawAnnularArc(ctx, cx, cy, arc.innerRadius, arc.outerRadius, arc.startAngle, arc.endAngle, arc.fill);
      this.addHitRegion(arc.innerRadius, arc.outerRadius, arc.startAngle, arc.endAngle, arc.tooltip);
    }
  }

  // ------- Graph Ring -------

  private drawGraphRing(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    layout: PlotScene['rings'][number]['layout'],
    arcs: readonly GraphArcScene[],
  ): void {
    // Ring boundaries
    drawCircle(ctx, cx, cy, layout.radius, '#ccc', 0.5);
    drawCircle(ctx, cx, cy, layout.radius + layout.width, '#ccc', 0.5);

    for (const arc of arcs) {
      drawAnnularArc(ctx, cx, cy, arc.innerRadius, arc.outerRadius, arc.startAngle, arc.endAngle, arc.fill, arc.opacity);
      this.addHitRegion(arc.innerRadius, arc.outerRadius, arc.startAngle, arc.endAngle, arc.tooltip);
    }
  }

  // ------- Contig Boundaries -------

  private drawContigBoundaries(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    arcs: readonly ContigArcScene[],
  ): void {
    for (const arc of arcs) {
      drawAnnularArc(ctx, cx, cy, arc.innerRadius, arc.outerRadius, arc.startAngle, arc.endAngle, arc.fill, arc.opacity);
      this.addHitRegion(arc.innerRadius, arc.outerRadius, arc.startAngle, arc.endAngle, arc.tooltip);

      if (arc.label) {
        ctx.save();
        ctx.font = `bold ${arc.label.fontSize}px sans-serif`;
        ctx.fillStyle = arc.fill;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(arc.label.text, arc.label.x, arc.label.y);
        ctx.restore();
      }
    }
  }

  // ------- Annotations -------

  private drawAnnotations(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    referenceLength: number,
    annotations: readonly Annotation[],
    innerRadius: number,
    outerRadius: number,
    showLabels: boolean,
    labelInward = false,
  ): void {
    drawCanvasAnnotations({
      context,
      centerX,
      centerY,
      referenceLength,
      annotations,
      innerRadius,
      outerRadius,
      showLabels,
      labelInward,
      labelFontSize: this.config.labelFontSize,
      addHitRegion: (startAngle, endAngle, tooltip) => {
        this.addHitRegion(innerRadius, outerRadius, startAngle, endAngle, tooltip);
      },
    });
  }

  // ------- Scale Markers -------

  private drawScaleMarkers(
    ctx: CanvasRenderingContext2D,
    markers: PlotScene['scaleMarkers'],
  ): void {
    for (const marker of markers) {
      ctx.save();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(marker.line.x1, marker.line.y1);
      ctx.lineTo(marker.line.x2, marker.line.y2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = `${this.config.scaleFontSize}px sans-serif`;
      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marker.label.text, marker.label.x, marker.label.y);
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

}

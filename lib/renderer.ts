// Circular Plot SVG Renderer
import type { CircularPlotData, Annotation, PlotViewState } from './types';
import { createArcPath as geometryCreateArcPath } from './geometry';
import {
  buildPlotScene,
  type ContigArcScene,
  type MetricRingScene,
  type PlotRingScene,
  type PlotScene,
} from './plotScene';
import type { RenderConfig } from './rendering/types';
import type { TooltipCallback } from './rendering/types';
import { renderSVGAnnotations } from './rendering/svgAnnotations';
import { renderSVGLegend } from './rendering/svgLegends';

export type { RenderConfig } from './rendering/types';

export class CircularPlotRenderer {
  private svg: SVGSVGElement | null = null;
  private config: RenderConfig;
  private tooltipCallback?: TooltipCallback;

  constructor(config: RenderConfig) {
    this.config = config;
  }


  private createArcPath(
    cx: number,
    cy: number,
    innerR: number,
    outerR: number,
    startAngle: number,
    endAngle: number
  ): string {
    return geometryCreateArcPath(cx, cy, innerR, outerR, startAngle, endAngle);
  }

  private renderReferenceRing(
    svg: SVGElement,
    cx: number,
    cy: number,
    _refLength: number
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', 'reference-ring');
    group.setAttribute('inkscape:label', 'Reference Ring');
    group.setAttribute('class', 'reference-ring');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(cx));
    circle.setAttribute('cy', String(cy));
    circle.setAttribute('r', String(this.config.innerRadius));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', '#333');
    circle.setAttribute('stroke-width', '2');
    
    group.appendChild(circle);
    svg.appendChild(group);
  }

  private renderMetricRing(
    svg: SVGElement,
    cx: number,
    cy: number,
    scene: MetricRingScene,
  ): void {
    const isGCContent = scene.layout.type === 'gc-content';
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', isGCContent ? 'gc-content-ring' : 'gc-skew-ring');
    group.setAttribute('inkscape:label', isGCContent ? 'GC Content' : 'GC Skew');
    group.setAttribute('class', isGCContent ? 'gc-ring' : 'gc-skew-ring');

    const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    baseline.setAttribute('cx', String(cx));
    baseline.setAttribute('cy', String(cy));
    baseline.setAttribute('r', String(scene.baseRadius));
    baseline.setAttribute('fill', 'none');
    baseline.setAttribute('stroke', '#999');
    baseline.setAttribute('stroke-width', '1');
    baseline.setAttribute('stroke-dasharray', '3,3');
    group.appendChild(baseline);

    for (const radius of [scene.layout.radius, scene.layout.radius + scene.layout.width]) {
      const boundary = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      boundary.setAttribute('cx', String(cx));
      boundary.setAttribute('cy', String(cy));
      boundary.setAttribute('r', String(radius));
      boundary.setAttribute('fill', 'none');
      boundary.setAttribute('stroke', '#ccc');
      boundary.setAttribute('stroke-width', '1');
      group.appendChild(boundary);
    }

    for (const arc of scene.arcs) {
      const arcElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arcElement.setAttribute('d', this.createArcPath(
        cx,
        cy,
        arc.innerRadius,
        arc.outerRadius,
        arc.startAngle,
        arc.endAngle,
      ));
      arcElement.setAttribute('fill', arc.fill);
      arcElement.setAttribute('stroke', 'none');
      arcElement.setAttribute('opacity', String(arc.opacity));
      arcElement.setAttribute(isGCContent ? 'data-gc' : 'data-gc-skew', arc.value);
      arcElement.style.cursor = 'pointer';
      arcElement.addEventListener('mouseenter', () => {
        arcElement.setAttribute('opacity', '1.0');
        this.tooltipCallback?.(arc.tooltip);
      });
      arcElement.addEventListener('mouseleave', () => {
        arcElement.setAttribute('opacity', String(arc.opacity));
        this.tooltipCallback?.(null);
      });
      group.appendChild(arcElement);
    }

    svg.appendChild(group);
  }
  private renderGraphRing(
    svg: SVGElement,
    cx: number,
    cy: number,
    track: PlotRingScene,
  ): void {
    const { ring, layout } = track;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', `ring-graph-${ring.queryId}`);
    group.setAttribute('inkscape:label', `Graph: ${ring.queryName}`);
    group.setAttribute('class', `ring ring-graph-${ring.queryId}`);
    group.setAttribute('data-query-id', ring.queryId);

    for (const radius of [layout.radius, layout.radius + layout.width]) {
      const boundary = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      boundary.setAttribute('cx', String(cx));
      boundary.setAttribute('cy', String(cy));
      boundary.setAttribute('r', String(radius));
      boundary.setAttribute('fill', 'none');
      boundary.setAttribute('stroke', '#ccc');
      boundary.setAttribute('stroke-width', '0.5');
      group.appendChild(boundary);
    }

    for (const arc of track.graphArcs) {
      const arcElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arcElement.setAttribute('d', this.createArcPath(
        cx,
        cy,
        arc.innerRadius,
        arc.outerRadius,
        arc.startAngle,
        arc.endAngle,
      ));
      arcElement.setAttribute('fill', arc.fill);
      arcElement.setAttribute('stroke', 'none');
      arcElement.setAttribute('opacity', String(arc.opacity));
      arcElement.style.cursor = 'pointer';
      arcElement.addEventListener('mouseenter', () => {
        arcElement.setAttribute('opacity', '1.0');
        this.tooltipCallback?.(arc.tooltip);
      });
      arcElement.addEventListener('mouseleave', () => {
        arcElement.setAttribute('opacity', String(arc.opacity));
        this.tooltipCallback?.(null);
      });
      group.appendChild(arcElement);
    }

    svg.appendChild(group);
  }
  private renderContigBoundaries(
    svg: SVGElement,
    cx: number,
    cy: number,
    arcs: readonly ContigArcScene[],
  ): void {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', 'contig-boundaries');
    group.setAttribute('inkscape:label', 'Contig Boundaries');
    group.setAttribute('class', 'contig-boundaries');

    for (const arc of arcs) {
      const arcElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arcElement.setAttribute('d', this.createArcPath(
        cx,
        cy,
        arc.innerRadius,
        arc.outerRadius,
        arc.startAngle,
        arc.endAngle,
      ));
      arcElement.setAttribute('fill', arc.fill);
      arcElement.setAttribute('stroke', 'none');
      arcElement.setAttribute('opacity', String(arc.opacity));
      arcElement.style.cursor = 'pointer';
      arcElement.addEventListener('mouseenter', () => {
        arcElement.setAttribute('opacity', '0.9');
        this.tooltipCallback?.(arc.tooltip);
      });
      arcElement.addEventListener('mouseleave', () => {
        arcElement.setAttribute('opacity', String(arc.opacity));
        this.tooltipCallback?.(null);
      });
      group.appendChild(arcElement);

      if (arc.label) {
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', String(arc.label.x));
        label.setAttribute('y', String(arc.label.y));
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'middle');
        label.setAttribute('font-size', String(arc.label.fontSize));
        label.setAttribute('fill', arc.fill);
        label.setAttribute('font-weight', 'bold');
        label.textContent = arc.label.text;
        group.appendChild(label);
      }
    }

    svg.appendChild(group);
  }
  private renderQueryRing(
    svg: SVGElement,
    cx: number,
    cy: number,
    track: PlotRingScene,
  ): void {
    const { ring } = track;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', `ring-${ring.queryId}`);
    group.setAttribute('inkscape:label', `Ring: ${ring.queryName}`);
    group.setAttribute('class', `ring ring-${ring.queryId}`);
    group.setAttribute('data-query-id', ring.queryId);

    for (const arc of track.alignmentArcs) {
      const arcElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arcElement.setAttribute('d', this.createArcPath(
        cx,
        cy,
        arc.innerRadius,
        arc.outerRadius,
        arc.startAngle,
        arc.endAngle,
      ));
      arcElement.setAttribute('fill', arc.fill);
      arcElement.setAttribute('stroke', 'none');
      arcElement.setAttribute('data-start', String(arc.start));
      arcElement.setAttribute('data-end', String(arc.end));
      arcElement.setAttribute('data-identity', arc.identity.toFixed(1));
      arcElement.setAttribute('data-length', String(arc.alignmentLength));
      arcElement.addEventListener('mouseenter', event => {
        arcElement.setAttribute('stroke', '#000');
        arcElement.setAttribute('stroke-width', '1');
        this.tooltipCallback?.({
          ...arc.tooltip,
          x: event.clientX,
          y: event.clientY,
        });
      });
      arcElement.addEventListener('mouseleave', () => {
        arcElement.setAttribute('stroke', 'none');
        this.tooltipCallback?.(null);
      });
      group.appendChild(arcElement);
    }

    svg.appendChild(group);
  }
  private renderAnnotations(
    parent: SVGElement,
    centerX: number,
    centerY: number,
    referenceLength: number,
    annotations: readonly Annotation[],
    innerRadius: number,
    outerRadius: number,
    showLabels = true,
    labelInward = false,
    groupId = `annotations-${innerRadius.toFixed(0)}`,
    groupLabel = 'Annotations',
  ): void {
    renderSVGAnnotations({
      parent,
      centerX,
      centerY,
      referenceLength,
      annotations,
      innerRadius,
      outerRadius,
      showLabels,
      labelInward,
      labelFontSize: this.config.labelFontSize,
      groupId,
      groupLabel,
      tooltipCallback: this.tooltipCallback,
    });
  }
  private renderScaleMarkers(
    svg: SVGElement,
    markers: PlotScene['scaleMarkers'],
  ): void {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', 'scale-markers');
    group.setAttribute('inkscape:label', 'Scale Markers');
    group.setAttribute('class', 'scale-markers');

    for (const marker of markers) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(marker.line.x1));
      line.setAttribute('y1', String(marker.line.y1));
      line.setAttribute('x2', String(marker.line.x2));
      line.setAttribute('y2', String(marker.line.y2));
      line.setAttribute('stroke', '#666');
      line.setAttribute('stroke-width', '2');
      group.appendChild(line);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(marker.label.x));
      text.setAttribute('y', String(marker.label.y));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-size', String(this.config.scaleFontSize));
      text.setAttribute('fill', '#333');
      text.textContent = marker.label.text;
      group.appendChild(text);
    }

    svg.appendChild(group);
  }
  render(container: HTMLElement, data: CircularPlotData, viewState?: PlotViewState): SVGSVGElement {
    const scene = buildPlotScene(data, this.config, viewState);

    // Create SVG with Inkscape namespace for layer/group compatibility
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttributeNS(
      'http://www.w3.org/2000/xmlns/',
      'xmlns:inkscape',
      'http://www.inkscape.org/namespaces/inkscape',
    );
    this.svg.setAttribute('viewBox', `0 0 ${this.config.width} ${this.config.height}`);
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');

    // Top-level defs for gradients (hoisted from legend groups for Inkscape compatibility)
    const topDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    topDefs.setAttribute('id', 'defs');
    this.svg.appendChild(topDefs);

    // Embed font-family style so exports use sans-serif
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = 'text { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }';
    this.svg.appendChild(style);

    // Add white background rect so exports also have white background
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('id', 'background');
    bgRect.setAttribute('width', String(this.config.width));
    bgRect.setAttribute('height', String(this.config.height));
    bgRect.setAttribute('fill', 'white');
    this.svg.appendChild(bgRect);

    // Create main content group for zoom/pan transforms
    const mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    mainGroup.setAttribute('id', 'main-content');
    mainGroup.setAttribute('inkscape:label', 'Plot Content');
    mainGroup.setAttribute('inkscape:groupmode', 'layer');
    mainGroup.setAttribute('transform-origin', 'center');

    // Apply zoom/pan transform if view state is provided (matches canvas renderer's transform)
    if (scene.viewState.zoom !== 1 || scene.viewState.panX !== 0 || scene.viewState.panY !== 0) {
      const cx = scene.centerX;
      const cy = scene.centerY;
      // Replicate the canvas transform: translate(cx + panX, cy + panY) scale(zoom) translate(-cx, -cy)
      mainGroup.setAttribute('transform',
        `translate(${cx + scene.viewState.panX}, ${cy + scene.viewState.panY}) scale(${scene.viewState.zoom}) translate(${-cx}, ${-cy})`
      );
    }

    this.svg.appendChild(mainGroup);
    
    const cx = scene.centerX;
    const cy = scene.centerY;
    const refLength = scene.referenceLength;
    
    // Render reference ring first
    this.renderReferenceRing(mainGroup, cx, cy, refLength);

    // Reference features sit inside the reference ring, matching the canvas preview.
    if (scene.referenceAnnotations.length > 0) {
      const featureInner = Math.max(10, this.config.innerRadius - 30);
      this.renderAnnotations(
        mainGroup,
        cx,
        cy,
        refLength,
        scene.referenceAnnotations,
        featureInner,
        this.config.innerRadius,
        true,
        true,
        'reference-annotations',
        'Reference Annotations',
      );
    }

    // Render GC Content ring
    if (scene.gcContent) {
      this.renderMetricRing(mainGroup, cx, cy, scene.gcContent);
    }

    // Render GC Skew ring (second ring outside reference)
    if (scene.gcSkew) {
      this.renderMetricRing(mainGroup, cx, cy, scene.gcSkew);
    }

    // Render query rings after GC rings
    scene.rings.forEach(track => {
      const { ring, layout, annotations } = track;
      const ringWidth = layout.width;
      const radius = layout.radius;

      // Render as graph ring if it has graph data, otherwise as alignment ring
      if (layout.type === 'graph') {
        this.renderGraphRing(mainGroup, cx, cy, track);
      } else {
        this.renderQueryRing(mainGroup, cx, cy, track);
      }

      if (annotations.length > 0) {
        this.renderAnnotations(
          mainGroup,
          cx, cy, refLength,
          annotations,
          radius,
          radius + ringWidth,
          ring.showLabels !== false,
          false,
          `annotations-${ring.queryId}`,
          `Annotations: ${ring.queryName}`,
        );
      }
    });

    // Render contig boundaries on the outermost ring (after all query rings)
    if (scene.contigs.length > 0 && scene.contigLayout) {
      this.renderContigBoundaries(mainGroup, cx, cy, scene.contigArcs);
    }

    this.renderScaleMarkers(mainGroup, scene.scaleMarkers);
    
    // Legends are a separate top-level Inkscape layer. They preserve their
    // dragged coordinates and do not inherit the map zoom/pan transform.
    if (this.config.showLegend !== false) {
      const legendsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      legendsGroup.setAttribute('id', 'legends');
      legendsGroup.setAttribute('inkscape:label', 'Legends');
      legendsGroup.setAttribute('inkscape:groupmode', 'layer');
      this.svg.appendChild(legendsGroup);
      if (scene.gcLegend) {
        renderSVGLegend(legendsGroup, topDefs, scene.gcLegend, {
          id: 'gc-legend',
          label: 'GC Legend',
        });
      }
      if (scene.ringLegend) {
        renderSVGLegend(legendsGroup, topDefs, scene.ringLegend, {
          id: 'ring-legend',
          label: 'Ring Legend',
        });
      }
    }
    
    // Render title and reference size in center
    this.renderTitle(mainGroup, cx, cy, refLength);
    
    // Clear and append to container
    container.innerHTML = '';
    container.appendChild(this.svg);
    
    return this.svg;
  }

  private renderTitle(svg: SVGElement, cx: number, cy: number, refLength: number) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', 'title-group');
    group.setAttribute('inkscape:label', 'Title');

    // Render title if provided
    if (this.config.title) {
      const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      titleText.setAttribute('x', String(cx));
      titleText.setAttribute('y', String(cy - 10));
      titleText.setAttribute('text-anchor', 'middle');
      titleText.setAttribute('dominant-baseline', 'middle');
      titleText.setAttribute('font-size', String(this.config.titleFontSize));
      titleText.setAttribute('font-weight', 'bold');
      titleText.setAttribute('fill', '#333');
      titleText.textContent = this.config.title;
      group.appendChild(titleText);
    }
    
    // Always render reference size below title
    const sizeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    sizeText.setAttribute('x', String(cx));
    sizeText.setAttribute('y', String(cy + (this.config.title ? 15 : 0)));
    sizeText.setAttribute('text-anchor', 'middle');
    sizeText.setAttribute('dominant-baseline', 'middle');
    sizeText.setAttribute('font-size', String(this.config.titleFontSize * 0.6));
    sizeText.setAttribute('fill', '#666');
    sizeText.textContent = `${refLength.toLocaleString()} bp`;
    group.appendChild(sizeText);
    svg.appendChild(group);
  }

  setTooltipCallback(callback: TooltipCallback) {
    this.tooltipCallback = callback;
  }

  exportSVG(): string {
    if (!this.svg) return '';
    
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(this.svg);
    
    // Add XML declaration and DOCTYPE
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
    
    return svgString;
  }
}

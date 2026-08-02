// Circular Plot SVG Renderer
import type { CircularPlotData, RingData, Annotation, ContigBoundary, PlotViewState } from './types';
import { referenceFeaturesToAnnotations } from './referenceAnnotations';
import { positionToAngle, createArcPath as geometryCreateArcPath, getColorIntensity as geometryGetColorIntensity } from './geometry';
import type { RenderConfig } from './rendering/types';
import type { TooltipCallback } from './rendering/types';
import { renderSVGAnnotations } from './rendering/svgAnnotations';
import { renderSVGGCLegend, renderSVGRingLegend } from './rendering/svgLegends';

export type { RenderConfig } from './rendering/types';

export class CircularPlotRenderer {
  private svg: SVGSVGElement | null = null;
  private config: RenderConfig;
  private tooltipCallback?: TooltipCallback;
  private gcLegendPos: { x: number; y: number } | null = null;
  private ringLegendPos: { x: number; y: number } | null = null;

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

  private renderGCSkewRing(
    svg: SVGElement,
    cx: number,
    cy: number,
    refLength: number,
    gcSkew: number[],
    ringRadius: number
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', 'gc-skew-ring');
    group.setAttribute('inkscape:label', 'GC Skew');
    group.setAttribute('class', 'gc-skew-ring');
    
    // Position GC skew as its own ring
    const ringWidth = this.config.gcRingWidth;
    const baseRadius = ringRadius + ringWidth / 2; // Middle of the ring
    const maxBarHeight = ringWidth / 2; // Maximum height is half the ring width
    const windowSize = refLength / gcSkew.length;
    
    // Use 95th percentile for scaling (avoids outliers)
    const skewAbs = gcSkew.map(Math.abs).sort((a, b) => a - b);
    const p95Skew = skewAbs[Math.floor(skewAbs.length * 0.95)] || 0.1;
    const scaleFactor = p95Skew > 0 ? 1 / p95Skew : 1;
    
    // Draw baseline circle (center of ring)
    const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    baseline.setAttribute('cx', String(cx));
    baseline.setAttribute('cy', String(cy));
    baseline.setAttribute('r', String(baseRadius));
    baseline.setAttribute('fill', 'none');
    baseline.setAttribute('stroke', '#999');
    baseline.setAttribute('stroke-width', '1');
    baseline.setAttribute('stroke-dasharray', '3,3');
    group.appendChild(baseline);
    
    // Draw ring boundaries
    const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    innerCircle.setAttribute('cx', String(cx));
    innerCircle.setAttribute('cy', String(cy));
    innerCircle.setAttribute('r', String(ringRadius));
    innerCircle.setAttribute('fill', 'none');
    innerCircle.setAttribute('stroke', '#ccc');
    innerCircle.setAttribute('stroke-width', '1');
    group.appendChild(innerCircle);
    
    const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outerCircle.setAttribute('cx', String(cx));
    outerCircle.setAttribute('cy', String(cy));
    outerCircle.setAttribute('r', String(ringRadius + ringWidth));
    outerCircle.setAttribute('fill', 'none');
    outerCircle.setAttribute('stroke', '#ccc');
    outerCircle.setAttribute('stroke-width', '1');
    group.appendChild(outerCircle);
    
    gcSkew.forEach((skew, i) => {
      const start = i * windowSize;
      const end = (i + 1) * windowSize;
      const startAngle = positionToAngle(start, refLength);
      const endAngle = positionToAngle(end, refLength);
      
      // Calculate bar height based on GC skew (ranges from -1 to +1)
      // Scale to use full ring height based on actual data range
      const barHeight = Math.min(maxBarHeight, Math.abs(skew) * scaleFactor * maxBarHeight);
      
      let innerRadius: number;
      let outerRadius: number;
      let color: string;
      
      if (skew >= 0) {
        // Positive skew (more G): Green, extends outward
        innerRadius = baseRadius;
        outerRadius = baseRadius + barHeight;
        color = '#22c55e'; // Green
      } else {
        // Negative skew (more C): Purple, extends inward
        innerRadius = baseRadius - barHeight;
        outerRadius = baseRadius;
        color = '#a855f7'; // Purple
      }
      
      const path = this.createArcPath(
        cx,
        cy,
        innerRadius,
        outerRadius,
        startAngle,
        endAngle
      );
      
      const arcElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arcElement.setAttribute('d', path);
      arcElement.setAttribute('fill', color);
      arcElement.setAttribute('stroke', 'none');
      arcElement.setAttribute('opacity', '0.8');
      
      // Add tooltip on hover
      const skewFormatted = skew.toFixed(3);
      arcElement.setAttribute('data-gc-skew', skewFormatted);
      arcElement.style.cursor = 'pointer';

      arcElement.addEventListener('mouseenter', (_e) => {
        arcElement.setAttribute('opacity', '1.0');
        if (this.tooltipCallback) {
          this.tooltipCallback({
            type: 'gc-skew',
            skew: skewFormatted,
            position: Math.floor(start),
            windowSize: Math.floor(windowSize)
          });
        }
      });
      
      arcElement.addEventListener('mouseleave', () => {
        arcElement.setAttribute('opacity', '0.8');
      });
      
      group.appendChild(arcElement);
    });
    
    svg.appendChild(group);
  }

  private renderGCRing(
    svg: SVGElement,
    cx: number,
    cy: number,
    refLength: number,
    gcContent: number[],
    ringRadius: number
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', 'gc-content-ring');
    group.setAttribute('inkscape:label', 'GC Content');
    group.setAttribute('class', 'gc-ring');
    
    // Position GC ring as its own ring outside reference
    const ringWidth = this.config.gcRingWidth;
    const baseRadius = ringRadius + ringWidth / 2; // Middle of the ring (50% baseline)
    const maxBarHeight = ringWidth / 2; // Maximum height is half the ring width
    const windowSize = refLength / gcContent.length;
    
    // Use 95th percentile deviation for scaling (avoids outliers like N-spacer windows)
    const deviations = gcContent.map(gc => Math.abs(gc - 0.5)).sort((a, b) => a - b);
    const p95 = deviations[Math.floor(deviations.length * 0.95)] || 0.1;
    const scaleFactor = p95 > 0 ? 0.5 / p95 : 1;
    
    // Draw baseline circle (center of ring - 50% GC)
    const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    baseline.setAttribute('cx', String(cx));
    baseline.setAttribute('cy', String(cy));
    baseline.setAttribute('r', String(baseRadius));
    baseline.setAttribute('fill', 'none');
    baseline.setAttribute('stroke', '#999');
    baseline.setAttribute('stroke-width', '1');
    baseline.setAttribute('stroke-dasharray', '3,3');
    group.appendChild(baseline);
    
    // Draw ring boundaries
    const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    innerCircle.setAttribute('cx', String(cx));
    innerCircle.setAttribute('cy', String(cy));
    innerCircle.setAttribute('r', String(ringRadius));
    innerCircle.setAttribute('fill', 'none');
    innerCircle.setAttribute('stroke', '#ccc');
    innerCircle.setAttribute('stroke-width', '1');
    group.appendChild(innerCircle);
    
    const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outerCircle.setAttribute('cx', String(cx));
    outerCircle.setAttribute('cy', String(cy));
    outerCircle.setAttribute('r', String(ringRadius + ringWidth));
    outerCircle.setAttribute('fill', 'none');
    outerCircle.setAttribute('stroke', '#ccc');
    outerCircle.setAttribute('stroke-width', '1');
    group.appendChild(outerCircle);
    
    gcContent.forEach((gc, i) => {
      const start = i * windowSize;
      const end = (i + 1) * windowSize;
      const startAngle = positionToAngle(start, refLength);
      const endAngle = positionToAngle(end, refLength);
      
      // Calculate bar height based on GC content deviation from 50%
      // Scale to use full ring height based on actual data range
      const deviation = gc - 0.5; // Range: -0.5 to +0.5
      const barHeight = Math.min(maxBarHeight, Math.abs(deviation) * scaleFactor * maxBarHeight);
      
      let innerRadius: number;
      let outerRadius: number;
      
      if (deviation >= 0) {
        // High GC (>50%): extends outward
        innerRadius = baseRadius;
        outerRadius = baseRadius + barHeight;
      } else {
        // Low GC (<50%): extends inward
        innerRadius = baseRadius - barHeight;
        outerRadius = baseRadius;
      }
      
      const path = this.createArcPath(
        cx,
        cy,
        innerRadius,
        outerRadius,
        startAngle,
        endAngle
      );
      
      const arcElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arcElement.setAttribute('d', path);
      
      // Color gradient: low GC (red) to high GC (green)
      const r = Math.floor((1 - gc) * 200 + 55);
      const g = Math.floor(gc * 200 + 55);
      const b = 50;
      arcElement.setAttribute('fill', `rgb(${r}, ${g}, ${b})`);
      arcElement.setAttribute('stroke', 'none');
      arcElement.setAttribute('opacity', '0.8');
      
      // Add tooltip on hover
      const gcPercent = (gc * 100).toFixed(1);
      arcElement.setAttribute('data-gc', gcPercent);
      arcElement.style.cursor = 'pointer';

      arcElement.addEventListener('mouseenter', (_e) => {
        arcElement.setAttribute('opacity', '1.0');
        if (this.tooltipCallback) {
          this.tooltipCallback({
            type: 'gc-content',
            gc: gcPercent,
            position: Math.floor(start),
            windowSize: Math.floor(windowSize)
          });
        }
      });
      
      arcElement.addEventListener('mouseleave', () => {
        arcElement.setAttribute('opacity', '0.8');
      });
      
      group.appendChild(arcElement);
    });
    
    svg.appendChild(group);
  }

  private renderGraphRing(
    svg: SVGElement,
    cx: number,
    cy: number,
    refLength: number,
    ring: RingData,
    radius: number,
    ringWidth?: number
  ) {
    const width = ringWidth || this.config.ringWidth;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', `ring-graph-${ring.queryId}`);
    group.setAttribute('inkscape:label', `Graph: ${ring.queryName}`);
    group.setAttribute('class', `ring ring-graph-${ring.queryId}`);
    group.setAttribute('data-query-id', ring.queryId);

    const points = ring.graphPoints!;
    // Use graphMaxCap if set, otherwise use data max
    const capValue = ring.graphMaxCap || ring.graphMaxValue || 1;

    // Draw ring boundary (outer)
    const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outerCircle.setAttribute('cx', String(cx));
    outerCircle.setAttribute('cy', String(cy));
    outerCircle.setAttribute('r', String(radius + width));
    outerCircle.setAttribute('fill', 'none');
    outerCircle.setAttribute('stroke', '#ccc');
    outerCircle.setAttribute('stroke-width', '0.5');
    group.appendChild(outerCircle);

    // Draw ring boundary (inner)
    const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    innerCircle.setAttribute('cx', String(cx));
    innerCircle.setAttribute('cy', String(cy));
    innerCircle.setAttribute('r', String(radius));
    innerCircle.setAttribute('fill', 'none');
    innerCircle.setAttribute('stroke', '#ccc');
    innerCircle.setAttribute('stroke-width', '0.5');
    group.appendChild(innerCircle);

    // Parse the ring color
    const hex = ring.color.replace('#', '');
    const cr = parseInt(hex.substring(0, 2), 16);
    const cg = parseInt(hex.substring(2, 4), 16);
    const cb = parseInt(hex.substring(4, 6), 16);

    // Render each point as a filled arc proportional to value/capValue
    // Values above cap are clamped to full height and shown in blue
    for (const point of points) {
      if (point.value <= 0) continue;

      const startAngle = positionToAngle(point.start, refLength);
      const endAngle = positionToAngle(point.end, refLength);

      const isOverCap = ring.graphMaxCap != null && point.value > capValue;
      const fraction = Math.min(1, point.value / capValue);
      const barHeight = fraction * width;

      const path = this.createArcPath(
        cx, cy,
        radius,
        radius + barHeight,
        startAngle,
        endAngle
      );

      const arcElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arcElement.setAttribute('d', path);
      // Blue for over-cap, ring colour for normal
      arcElement.setAttribute('fill', isOverCap ? 'rgb(30, 100, 220)' : `rgb(${cr}, ${cg}, ${cb})`);
      arcElement.setAttribute('stroke', 'none');
      arcElement.setAttribute('opacity', '0.8');

      // Tooltip
      arcElement.style.cursor = 'pointer';
      arcElement.addEventListener('mouseenter', () => {
        arcElement.setAttribute('opacity', '1.0');
        if (this.tooltipCallback) {
          this.tooltipCallback({
            type: 'graph',
            queryName: ring.queryName,
            start: point.start,
            end: point.end,
            value: point.value.toFixed(2)
          });
        }
      });
      arcElement.addEventListener('mouseleave', () => {
        arcElement.setAttribute('opacity', '0.8');
        if (this.tooltipCallback) {
          this.tooltipCallback(null);
        }
      });

      group.appendChild(arcElement);
    }

    svg.appendChild(group);
  }

  private renderContigBoundaries(
    svg: SVGElement,
    cx: number,
    cy: number,
    refLength: number,
    contigs: ContigBoundary[],
    radius: number,
    ringWidth: number
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', 'contig-boundaries');
    group.setAttribute('inkscape:label', 'Contig Boundaries');
    group.setAttribute('class', 'contig-boundaries');

    const colors = ['#ef4444', '#3b82f6']; // Alternating red/blue

    for (const contig of contigs) {
      const startAngle = positionToAngle(contig.start, refLength);
      const endAngle = positionToAngle(contig.end, refLength);
      const color = colors[contig.index % 2];

      const path = this.createArcPath(
        cx, cy,
        radius,
        radius + ringWidth,
        startAngle,
        endAngle
      );

      const arcElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arcElement.setAttribute('d', path);
      arcElement.setAttribute('fill', color);
      arcElement.setAttribute('stroke', 'none');
      arcElement.setAttribute('opacity', '0.6');

      arcElement.style.cursor = 'pointer';
      arcElement.addEventListener('mouseenter', () => {
        arcElement.setAttribute('opacity', '0.9');
        if (this.tooltipCallback) {
          this.tooltipCallback({
            type: 'contig',
            name: contig.name,
            start: contig.start,
            end: contig.end,
            length: contig.end - contig.start
          });
        }
      });
      arcElement.addEventListener('mouseleave', () => {
        arcElement.setAttribute('opacity', '0.6');
        if (this.tooltipCallback) {
          this.tooltipCallback(null);
        }
      });

      group.appendChild(arcElement);

      // Add contig label
      const midAngle = (startAngle + endAngle) / 2;
      const labelRadius = radius + ringWidth + 8;
      const lx = cx + labelRadius * Math.cos(midAngle);
      const ly = cy + labelRadius * Math.sin(midAngle);

      // Only add label if the arc is large enough
      const arcSpan = contig.end - contig.start;
      if (arcSpan / refLength > 0.02) {
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', String(lx));
        label.setAttribute('y', String(ly));
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'middle');
        label.setAttribute('font-size', String(Math.max(7, this.config.scaleFontSize - 2)));
        label.setAttribute('fill', color);
        label.setAttribute('font-weight', 'bold');

        // Truncate long names
        const displayName = contig.name.length > 15 ? contig.name.substring(0, 12) + '...' : contig.name;
        label.textContent = displayName;
        group.appendChild(label);
      }
    }

    svg.appendChild(group);
  }

  private renderQueryRing(
    svg: SVGElement,
    cx: number,
    cy: number,
    refLength: number,
    ring: RingData,
    radius: number,
    ringWidth?: number
  ) {
    const width = ringWidth || this.config.ringWidth;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', `ring-${ring.queryId}`);
    group.setAttribute('inkscape:label', `Ring: ${ring.queryName}`);
    group.setAttribute('class', `ring ring-${ring.queryId}`);
    group.setAttribute('data-query-id', ring.queryId);
    
    // Use direct hit rendering instead of windows
    if (ring.hits && ring.hits.length > 0) {
      // Sort hits by size (largest first, so smallest drawn last and appear on top)
      const sortedHits = [...ring.hits].sort((a, b) => {
        const sizeA = a.refEnd - a.refStart;
        const sizeB = b.refEnd - b.refStart;
        return sizeB - sizeA; // Descending order
      });
      
      // Track drawn regions for occlusion detection
      const drawnRegions: Array<{ start: number; end: number }> = [];
      
      sortedHits.forEach(hit => {
        // Check if this hit would be completely occluded
        const isOccluded = drawnRegions.some(region => 
          hit.refStart >= region.start && hit.refEnd <= region.end
        );
        
        if (isOccluded) {
          return; // Skip this hit
        }
        
        // Calculate angles for this hit
        const startAngle = positionToAngle(hit.refStart, refLength);
        const endAngle = positionToAngle(hit.refEnd, refLength);
        
        const path = this.createArcPath(
          cx,
          cy,
          radius,
          radius + width,
          startAngle,
          endAngle
        );
        
        // Get color intensity based on percent identity and thresholds
        const color = this.getColorIntensity(ring.color, hit.percentIdentity, ring.lowerThreshold, ring.upperThreshold);
        
        const arcElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arcElement.setAttribute('d', path);
        arcElement.setAttribute('fill', color);
        arcElement.setAttribute('stroke', 'none');
        arcElement.setAttribute('data-start', String(hit.refStart));
        arcElement.setAttribute('data-end', String(hit.refEnd));
        arcElement.setAttribute('data-identity', String(hit.percentIdentity.toFixed(1)));
        arcElement.setAttribute('data-length', String(hit.alignmentLength));
        
        // Add hover effect
        arcElement.addEventListener('mouseenter', (e) => {
          arcElement.setAttribute('stroke', '#000');
          arcElement.setAttribute('stroke-width', '1');
          
          if (this.tooltipCallback) {
            this.tooltipCallback({
              queryName: ring.queryName,
              start: hit.refStart,
              end: hit.refEnd,
              identity: hit.percentIdentity,
              coverage: 1.0,
              x: (e as MouseEvent).clientX,
              y: (e as MouseEvent).clientY
            });
          }
        });
        
        arcElement.addEventListener('mouseleave', () => {
          arcElement.setAttribute('stroke', 'none');
          if (this.tooltipCallback) {
            this.tooltipCallback(null);
          }
        });
        
        group.appendChild(arcElement);
        
        // Track this region as drawn
        drawnRegions.push({ start: hit.refStart, end: hit.refEnd });
      });
    }
    
    svg.appendChild(group);
  }

  private renderAnnotations(
    parent: SVGElement,
    centerX: number,
    centerY: number,
    referenceLength: number,
    annotations: Annotation[],
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
  // Color intensity scaling based on identity and thresholds (delegates to shared geometry utility)
  private getColorIntensity(baseColor: string, percentIdentity: number, lowerThreshold?: number, upperThreshold?: number): string {
    const lower = lowerThreshold ?? this.config.minIdentity;
    const upper = upperThreshold ?? 100;
    return geometryGetColorIntensity(baseColor, percentIdentity, lower, upper);
  }

  private renderGCLegend(parent: SVGElement, hasGCContent: boolean, hasGCSkew: boolean): void {
    const definitions = this.svg?.querySelector<SVGDefsElement>('#defs');
    if (!definitions) throw new Error('SVG definitions are unavailable');
    renderSVGGCLegend(
      parent,
      definitions,
      this.config,
      this.gcLegendPos,
      hasGCContent,
      hasGCSkew,
    );
  }
  private renderScaleMarkers(
    svg: SVGElement,
    cx: number,
    cy: number,
    refLength: number
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', 'scale-markers');
    group.setAttribute('inkscape:label', 'Scale Markers');
    group.setAttribute('class', 'scale-markers');
    
    const numMarkers = 12;
    const markerRadius = this.config.innerRadius;
    
    for (let i = 0; i < numMarkers; i++) {
      const angle = (i / numMarkers) * 2 * Math.PI - Math.PI / 2;
      const position = Math.floor((i / numMarkers) * refLength);
      
      // Check if this is 3 o'clock (i=3) or 9 o'clock (i=9) position
      const is3or9 = (i === 3 || i === 9);
      const tickLength = is3or9 ? 8 : 18; // Shorter ticks at 3 and 9 o'clock
      
      // Marker line (pointing inward)
      const x1 = cx + (markerRadius - tickLength) * Math.cos(angle);
      const y1 = cy + (markerRadius - tickLength) * Math.sin(angle);
      const x2 = cx + (markerRadius + 3) * Math.cos(angle);
      const y2 = cy + (markerRadius + 3) * Math.sin(angle);
      
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', '#666');
      line.setAttribute('stroke-width', '2');
      
      group.appendChild(line);
      
      // Label (positioned inward)
      const labelRadius = markerRadius - 30;
      const tx = cx + labelRadius * Math.cos(angle);
      const ty = cy + labelRadius * Math.sin(angle);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(tx));
      text.setAttribute('y', String(ty));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-size', String(this.config.scaleFontSize));
      text.setAttribute('fill', '#333');
      text.textContent = `${(position / 1000).toFixed(0)}kb`;
      
      group.appendChild(text);
    }
    
    svg.appendChild(group);
  }

  private renderRingLegend(parent: SVGElement, rings: RingData[]): void {
    const definitions = this.svg?.querySelector<SVGDefsElement>('#defs');
    if (!definitions) throw new Error('SVG definitions are unavailable');
    renderSVGRingLegend(
      parent,
      definitions,
      this.config,
      this.ringLegendPos,
      rings,
    );
  }
  render(container: HTMLElement, data: CircularPlotData, viewState?: PlotViewState): SVGSVGElement {
    // Apply legend positions from view state if provided
    if (viewState) {
      this.gcLegendPos = viewState.gcLegendPos;
      this.ringLegendPos = viewState.ringLegendPos;
    }

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
    mainGroup.setAttribute('transform-origin', 'center');

    // Apply zoom/pan transform if view state is provided (matches canvas renderer's transform)
    if (viewState && (viewState.zoom !== 1 || viewState.panX !== 0 || viewState.panY !== 0)) {
      const cx = this.config.width / 2;
      const cy = this.config.height / 2;
      // Replicate the canvas transform: translate(cx + panX, cy + panY) scale(zoom) translate(-cx, -cy)
      mainGroup.setAttribute('transform',
        `translate(${cx + viewState.panX}, ${cy + viewState.panY}) scale(${viewState.zoom}) translate(${-cx}, ${-cy})`
      );
    }

    this.svg.appendChild(mainGroup);
    
    const cx = this.config.width / 2;
    const cy = this.config.height / 2;
    const refLength = data.reference.length;
    
    // Render reference ring first
    this.renderReferenceRing(mainGroup, cx, cy, refLength);

    // GenBank reference features sit inside the reference ring, matching the canvas preview.
    if (data.reference.features && data.reference.features.length > 0) {
      const featureInner = Math.max(10, this.config.innerRadius - 30);
      const featureAnnotations = referenceFeaturesToAnnotations(data.reference.features);
      this.renderAnnotations(
        mainGroup,
        cx,
        cy,
        refLength,
        featureAnnotations,
        featureInner,
        this.config.innerRadius,
        true,
        true,
        'reference-annotations',
        'Reference Annotations',
      );
    }

    // Calculate ring positions - GC Content and GC Skew come first
    let currentRadius = this.config.innerRadius;

    // Render GC Content ring
    if (data.reference.gcContent) {
      currentRadius += this.config.ringSpacing; // Small spacing from reference
      this.renderGCRing(mainGroup, cx, cy, refLength, data.reference.gcContent, currentRadius);
      currentRadius += this.config.gcRingWidth + this.config.ringSpacing;
    }

    // Render GC Skew ring (second ring outside reference)
    if (data.reference.gcSkew) {
      this.renderGCSkewRing(mainGroup, cx, cy, refLength, data.reference.gcSkew, currentRadius);
      currentRadius += this.config.gcRingWidth + this.config.ringSpacing;
    }

    // Render query rings after GC rings
    const visibleRings = data.rings?.filter(r => r.visible) || [];
    visibleRings.forEach((ring) => {
      const ringWidth = ring.customWidth || this.config.ringWidth;
      const radius = currentRadius;

      // Render as graph ring if it has graph data, otherwise as alignment ring
      if (ring.graphPoints && ring.graphPoints.length > 0) {
        this.renderGraphRing(mainGroup, cx, cy, refLength, ring, radius, ringWidth);
      } else {
        this.renderQueryRing(mainGroup, cx, cy, refLength, ring, radius, ringWidth);
      }

      if (ring.annotations && ring.annotations.length > 0) {
        this.renderAnnotations(
          mainGroup,
          cx, cy, refLength,
          ring.annotations,
          radius,
          radius + ringWidth,
          ring.showLabels !== false,
          false,
          `annotations-${ring.queryId}`,
          `Annotations: ${ring.queryName}`,
        );
      }

      currentRadius += ringWidth + this.config.ringSpacing;
    });

    // Render contig boundaries on the outermost ring (after all query rings)
    if (data.reference.contigs && data.reference.contigs.length > 1) {
      const contigRingWidth = 6;
      this.renderContigBoundaries(mainGroup, cx, cy, refLength, data.reference.contigs, currentRadius, contigRingWidth);
      currentRadius += contigRingWidth + this.config.ringSpacing;
    }

    this.renderScaleMarkers(mainGroup, cx, cy, refLength);
    
    // Add legends if enabled
    if (this.config.showLegend !== false) {
      if (data.reference.gcContent || data.reference.gcSkew) {
        this.renderGCLegend(mainGroup, !!data.reference.gcContent, !!data.reference.gcSkew);
      }
      if (visibleRings.length > 0) {
        this.renderRingLegend(mainGroup, visibleRings);
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

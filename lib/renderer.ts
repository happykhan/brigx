// Circular Plot SVG Renderer
import type { CircularPlotData, RingData, Annotation, ContigBoundary } from './types';

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

export class CircularPlotRenderer {
  private svg: SVGSVGElement | null = null;
  private config: RenderConfig;
  private tooltipCallback?: (info: any) => void;

  constructor(config: RenderConfig) {
    this.config = config;
  }

  private getColorForIdentity(identity: number): string {
    const normalizedIdentity = 
      (identity - this.config.minIdentity) / 
      (this.config.maxIdentity - this.config.minIdentity);
    
    const clamped = Math.max(0, Math.min(1, normalizedIdentity));
    
    // Blue to Red gradient
    const r = Math.floor(clamped * 220 + 35);
    const g = Math.floor(100 * (1 - Math.abs(clamped - 0.5) * 2));
    const b = Math.floor((1 - clamped) * 220 + 35);
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  private createArcPath(
    cx: number,
    cy: number,
    innerR: number,
    outerR: number,
    startAngle: number,
    endAngle: number
  ): string {
    const x1 = cx + innerR * Math.cos(startAngle);
    const y1 = cy + innerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(startAngle);
    const y2 = cy + outerR * Math.sin(startAngle);
    const x3 = cx + outerR * Math.cos(endAngle);
    const y3 = cy + outerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(endAngle);
    const y4 = cy + innerR * Math.sin(endAngle);
    
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    
    return `
      M ${x1} ${y1}
      L ${x2} ${y2}
      A ${outerR} ${outerR} 0 ${largeArc} 1 ${x3} ${y3}
      L ${x4} ${y4}
      A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1} ${y1}
      Z
    `.replace(/\s+/g, ' ').trim();
  }

  private renderReferenceRing(
    svg: SVGSVGElement,
    cx: number,
    cy: number,
    _refLength: number
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
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
    svg: SVGSVGElement,
    cx: number,
    cy: number,
    refLength: number,
    gcSkew: number[],
    ringRadius: number
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
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
      const startAngle = (start / refLength) * 2 * Math.PI - Math.PI / 2;
      const endAngle = (end / refLength) * 2 * Math.PI - Math.PI / 2;
      
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
    svg: SVGSVGElement,
    cx: number,
    cy: number,
    refLength: number,
    gcContent: number[],
    ringRadius: number
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
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
      const startAngle = (start / refLength) * 2 * Math.PI - Math.PI / 2;
      const endAngle = (end / refLength) * 2 * Math.PI - Math.PI / 2;
      
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
    svg: SVGSVGElement,
    cx: number,
    cy: number,
    refLength: number,
    ring: RingData,
    radius: number,
    ringWidth?: number
  ) {
    const width = ringWidth || this.config.ringWidth;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
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

      const startAngle = (point.start / refLength) * 2 * Math.PI - Math.PI / 2;
      const endAngle = (point.end / refLength) * 2 * Math.PI - Math.PI / 2;

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
    svg: SVGSVGElement,
    cx: number,
    cy: number,
    refLength: number,
    contigs: ContigBoundary[],
    radius: number,
    ringWidth: number
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'contig-boundaries');

    const colors = ['#ef4444', '#3b82f6']; // Alternating red/blue

    for (const contig of contigs) {
      const startAngle = (contig.start / refLength) * 2 * Math.PI - Math.PI / 2;
      const endAngle = (contig.end / refLength) * 2 * Math.PI - Math.PI / 2;
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
    svg: SVGSVGElement,
    cx: number,
    cy: number,
    refLength: number,
    ring: RingData,
    radius: number,
    ringWidth?: number
  ) {
    const width = ringWidth || this.config.ringWidth;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
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
        const startAngle = (hit.refStart / refLength) * 2 * Math.PI - Math.PI / 2;
        const endAngle = (hit.refEnd / refLength) * 2 * Math.PI - Math.PI / 2;
        
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
    svg: SVGSVGElement,
    cx: number,
    cy: number,
    refLength: number,
    annotations: Annotation[],
    innerRadius: number,
    outerRadius: number,
    showLabels: boolean = true
  ) {
    if (!annotations || annotations.length === 0) return;

    // Failsafe: disable labels if too many annotations (prevents browser lockup)
    const MAX_LABELS = 200;
    if (showLabels && annotations.length > MAX_LABELS) {
      console.warn(`[Renderer] ${annotations.length} annotations exceeds label limit (${MAX_LABELS}), disabling labels`);
      showLabels = false;
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'annotations');

    // Collect label positions for collision detection
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
    
    // First pass: calculate initial positions (skip empty labels)
    annotations.forEach(ann => {
      // Skip annotations without labels
      if (!ann.label || ann.label.trim() === '') {
        return;
      }
      
      const start = Math.max(1, Math.min(ann.start, refLength));
      const end = Math.max(1, Math.min(ann.end, refLength));
      const startAngle = (start / refLength) * 2 * Math.PI - Math.PI / 2;
      const endAngle = (end / refLength) * 2 * Math.PI - Math.PI / 2;
      const midAngle = (startAngle + endAngle) / 2;
      
      const textWidth = ann.label.length * (this.config.labelFontSize * 0.6);
      const textHeight = this.config.labelFontSize + 4;
      
      labelPositions.push({
        annotation: ann,
        midAngle,
        adjustedAngle: midAngle,
        labelX: 0,
        labelY: 0,
        width: textWidth,
        height: textHeight
      });
    });
    
    // Adjust angles to avoid overlaps (move along arc)
    const labelDistance = outerRadius + 30;
    
    // Sort by angle for easier collision detection
    labelPositions.sort((a, b) => a.midAngle - b.midAngle);
    
    // Calculate minimum angular separation based on label widths
    // Convert label width to angular distance at labelDistance radius
    const getMinAngularSeparation = (lp1: LabelPosition, lp2: LabelPosition) => {
      const avgWidth = (lp1.width + lp2.width) / 2;
      const avgHeight = (lp1.height + lp2.height) / 2;
      // Account for both width and height, use the larger dimension
      const maxDimension = Math.max(avgWidth, avgHeight);
      // Add some padding
      const padding = 10;
      return (maxDimension + padding) / labelDistance;
    };
    
    // Iterative adjustment to spread out overlapping labels
    for (let iteration = 0; iteration < 15; iteration++) {
      let hasOverlap = false;
      
      // Check all pairs of labels for overlaps (not just adjacent)
      for (let i = 0; i < labelPositions.length; i++) {
        for (let j = i + 1; j < labelPositions.length; j++) {
          const curr = labelPositions[i];
          const next = labelPositions[j];
          
          const minSeparation = getMinAngularSeparation(curr, next);
          let angleDiff = Math.abs(next.adjustedAngle - curr.adjustedAngle);
          
          // Handle wrap-around at 2π
          if (angleDiff > Math.PI) {
            angleDiff = 2 * Math.PI - angleDiff;
          }
          
          if (angleDiff < minSeparation) {
            hasOverlap = true;
            // Push them apart with stronger force
            const adjustment = (minSeparation - angleDiff);
            const force = 0.8; // Higher force for stronger adjustment
            
            // Determine direction to push
            const direction = (next.adjustedAngle > curr.adjustedAngle) ? 1 : -1;
            
            curr.adjustedAngle -= adjustment * force * 0.5 * direction;
            next.adjustedAngle += adjustment * force * 0.5 * direction;
          }
        }
      }
      
      if (!hasOverlap) break;
    }
    
    // Calculate final label positions
    labelPositions.forEach(lp => {
      lp.labelX = cx + labelDistance * Math.cos(lp.adjustedAngle);
      lp.labelY = cy + labelDistance * Math.sin(lp.adjustedAngle);
    });
    
    // Create a lookup map for annotations with labels
    const labelMap = new Map<string, LabelPosition>();
    labelPositions.forEach(lp => {
      const key = `${lp.annotation.start}-${lp.annotation.end}-${lp.annotation.label}`;
      labelMap.set(key, lp);
    });
    
    // Second pass: render all annotations
    annotations.forEach(ann => {
      const start = Math.max(1, Math.min(ann.start, refLength));
      const end = Math.max(1, Math.min(ann.end, refLength));
      
      const startAngle = (start / refLength) * 2 * Math.PI - Math.PI / 2;
      const endAngle = (end / refLength) * 2 * Math.PI - Math.PI / 2;
      
      const color = ann.color || '#666666';
      
      // Check if this annotation has a label
      const key = `${ann.start}-${ann.end}-${ann.label}`;
      const lp = labelMap.get(key);
      
      if (ann.shape === 'block') {
        // Simple block arc
        const path = this.createArcPath(
          cx, cy,
          innerRadius, outerRadius,
          startAngle, endAngle
        );
        
        const arcElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arcElement.setAttribute('d', path);
        arcElement.setAttribute('fill', color);
        arcElement.setAttribute('stroke', '#000');
        arcElement.setAttribute('stroke-width', '0.5');
        arcElement.setAttribute('opacity', '0.7');
        
        // Tooltip
        arcElement.addEventListener('mouseenter', () => {
          arcElement.setAttribute('opacity', '0.9');
          if (this.tooltipCallback) {
            this.tooltipCallback({
              type: 'annotation',
              label: ann.label,
              start: ann.start,
              end: ann.end
            });
          }
        });
        
        arcElement.addEventListener('mouseleave', () => {
          arcElement.setAttribute('opacity', '0.7');
        });
        
        group.appendChild(arcElement);
        
        // Add text label with leader line only if showLabels is true
        if (showLabels && lp) {
          const midAngle = (startAngle + endAngle) / 2;
          const featureRadius = (innerRadius + outerRadius) / 2;
          const featureX = cx + featureRadius * Math.cos(midAngle);
          const featureY = cy + featureRadius * Math.sin(midAngle);
          const labelX = lp.labelX;
          const labelY = lp.labelY;

          const leaderLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          leaderLine.setAttribute('x1', String(featureX));
          leaderLine.setAttribute('y1', String(featureY));
          leaderLine.setAttribute('x2', String(labelX));
          leaderLine.setAttribute('y2', String(labelY));
          leaderLine.setAttribute('stroke', '#333');
          leaderLine.setAttribute('stroke-width', '1');
          leaderLine.setAttribute('opacity', '0.6');
          group.appendChild(leaderLine);

          const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          labelBg.setAttribute('x', String(labelX - lp.width / 2));
          labelBg.setAttribute('y', String(labelY - lp.height / 2));
          labelBg.setAttribute('width', String(lp.width));
          labelBg.setAttribute('height', String(lp.height));
          labelBg.setAttribute('fill', '#ffffff');
          labelBg.setAttribute('stroke', '#333');
          labelBg.setAttribute('stroke-width', '1');
          labelBg.setAttribute('rx', '3');
          labelBg.setAttribute('opacity', '0.9');
          group.appendChild(labelBg);

          const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          labelText.setAttribute('x', String(labelX));
          labelText.setAttribute('y', String(labelY));
          labelText.setAttribute('text-anchor', 'middle');
          labelText.setAttribute('dominant-baseline', 'middle');
          labelText.setAttribute('font-size', String(this.config.labelFontSize));
          labelText.setAttribute('font-weight', 'bold');
          labelText.setAttribute('fill', '#000');
          labelText.textContent = ann.label;
          group.appendChild(labelText);
        }

      } else if (ann.shape === 'arrow-forward' || ann.shape === 'arrow-reverse') {
        // Arrow shape (gene-like) - adaptive based on feature length
        const isForward = ann.shape === 'arrow-forward';
        
        // Calculate total angle span in radians
        const totalAngleSpan = endAngle - startAngle;
        
        // Adaptive rendering based on feature size:
        // Small features: just triangle
        // Medium features: triangle + some body
        // Large features: triangle (10-15%) + rectangular body
        
        let arrowHeadAngle: number;
        let hasBody: boolean;
        
        if (totalAngleSpan < 0.05) {
          // Very small feature: entire thing is arrow head
          arrowHeadAngle = totalAngleSpan;
          hasBody = false;
        } else if (totalAngleSpan < 0.15) {
          // Medium feature: arrow head takes 50-70%
          arrowHeadAngle = totalAngleSpan * 0.6;
          hasBody = true;
        } else {
          // Large feature: arrow head takes 10-15%
          arrowHeadAngle = Math.min(0.15, totalAngleSpan * 0.15);
          hasBody = true;
        }
        
        // Define body and head angles
        const bodyStartAngle = isForward ? startAngle : startAngle + arrowHeadAngle;
        const bodyEndAngle = isForward ? endAngle - arrowHeadAngle : endAngle;
        const headTipAngle = isForward ? endAngle : startAngle;
        const headBaseAngle = isForward ? bodyEndAngle : bodyStartAngle;
        
        // Calculate triangle points
        const midRadius = (innerRadius + outerRadius) / 2;
        const tipX = cx + midRadius * Math.cos(headTipAngle);
        const tipY = cy + midRadius * Math.sin(headTipAngle);
        
        const innerBaseX = cx + innerRadius * Math.cos(headBaseAngle);
        const innerBaseY = cy + innerRadius * Math.sin(headBaseAngle);
        const outerBaseX = cx + outerRadius * Math.cos(headBaseAngle);
        const outerBaseY = cy + outerRadius * Math.sin(headBaseAngle);
        
        let combinedPath: string;
        
        if (hasBody) {
          // Draw as one continuous shape: body + arrow head
          // Start at body start (inner), arc to body end (inner), 
          // line to arrow tip, line back to body end (outer), arc back to start (outer)
          
          const bodyStartInnerX = cx + innerRadius * Math.cos(bodyStartAngle);
          const bodyStartInnerY = cy + innerRadius * Math.sin(bodyStartAngle);
          const bodyStartOuterX = cx + outerRadius * Math.cos(bodyStartAngle);
          const bodyStartOuterY = cy + outerRadius * Math.sin(bodyStartAngle);
          
          const largeArcFlag = Math.abs(bodyEndAngle - bodyStartAngle) > Math.PI ? 1 : 0;
          
          combinedPath = `
            M ${bodyStartInnerX} ${bodyStartInnerY}
            A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} ${isForward ? 1 : 0} ${innerBaseX} ${innerBaseY}
            L ${tipX} ${tipY}
            L ${outerBaseX} ${outerBaseY}
            A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} ${isForward ? 0 : 1} ${bodyStartOuterX} ${bodyStartOuterY}
            Z
          `.replace(/\s+/g, ' ').trim();
        } else {
          // Just the triangle
          combinedPath = `
            M ${innerBaseX} ${innerBaseY}
            L ${tipX} ${tipY}
            L ${outerBaseX} ${outerBaseY}
            Z
          `.replace(/\s+/g, ' ').trim();
        }
        
        const arrowElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrowElement.setAttribute('d', combinedPath);
        arrowElement.setAttribute('fill', color);
        arrowElement.setAttribute('stroke', '#000');
        arrowElement.setAttribute('stroke-width', '0.5');
        arrowElement.setAttribute('opacity', '0.7');
        
        group.appendChild(arrowElement);
        
        // Add hover effects
        arrowElement.addEventListener('mouseenter', () => {
          arrowElement.setAttribute('opacity', '0.9');
          if (this.tooltipCallback) {
            this.tooltipCallback({
              type: 'annotation',
              label: ann.label,
              start: ann.start,
              end: ann.end,
              strand: isForward ? '+' : '-'
            });
          }
        });
        
        arrowElement.addEventListener('mouseleave', () => {
          arrowElement.setAttribute('opacity', '0.7');
        });
        
        // Add text label with leader line for arrow only if showLabels is true
        if (showLabels && lp) {
          const midAngle = (startAngle + endAngle) / 2;
          const featureRadius = (innerRadius + outerRadius) / 2;
          const featureX = cx + featureRadius * Math.cos(midAngle);
          const featureY = cy + featureRadius * Math.sin(midAngle);
          
          // Use adjusted label position from collision detection
          const labelX = lp.labelX;
          const labelY = lp.labelY;
          
          // Draw leader line
          const leaderLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          leaderLine.setAttribute('x1', String(featureX));
          leaderLine.setAttribute('y1', String(featureY));
          leaderLine.setAttribute('x2', String(labelX));
          leaderLine.setAttribute('y2', String(labelY));
          leaderLine.setAttribute('stroke', '#333');
          leaderLine.setAttribute('stroke-width', '1');
          leaderLine.setAttribute('opacity', '0.6');
          group.appendChild(leaderLine);
          
          // Draw label background
          const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          const textWidth = lp.width;
          const textHeight = lp.height;
          labelBg.setAttribute('x', String(labelX - textWidth / 2));
          labelBg.setAttribute('y', String(labelY - textHeight / 2));
          labelBg.setAttribute('width', String(textWidth));
          labelBg.setAttribute('height', String(textHeight));
          labelBg.setAttribute('fill', '#ffffff');
          labelBg.setAttribute('stroke', '#333');
          labelBg.setAttribute('stroke-width', '1');
          labelBg.setAttribute('rx', '3');
          labelBg.setAttribute('opacity', '0.9');
          group.appendChild(labelBg);
          
          // Draw label text
          const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          labelText.setAttribute('x', String(labelX));
          labelText.setAttribute('y', String(labelY));
          labelText.setAttribute('text-anchor', 'middle');
          labelText.setAttribute('dominant-baseline', 'middle');
          labelText.setAttribute('font-size', String(this.config.labelFontSize));
          labelText.setAttribute('font-weight', 'bold');
          labelText.setAttribute('fill', '#000');
          labelText.textContent = ann.label;
          group.appendChild(labelText);
        }
      }
    });
    
    svg.appendChild(group);
  }

  // Color intensity scaling based on identity and thresholds
  private getColorIntensity(baseColor: string, percentIdentity: number, lowerThreshold?: number, upperThreshold?: number): string {
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Use per-ring thresholds if provided, otherwise fall back to global config
    const minIdentity = lowerThreshold ?? this.config.minIdentity;
    const maxIdentity = upperThreshold ?? 100;
    
    // Normalize identity to 0-1 range
    const normalized = Math.max(0, Math.min(1, 
      (percentIdentity - minIdentity) / (maxIdentity - minIdentity)
    ));
    
    // Interpolate between white (255,255,255) and the base color
    const finalR = Math.round(255 + (r - 255) * normalized);
    const finalG = Math.round(255 + (g - 255) * normalized);
    const finalB = Math.round(255 + (b - 255) * normalized);
    
    return `rgb(${finalR}, ${finalG}, ${finalB})`;
  }

  private renderGCLegend(svg: SVGSVGElement, hasGCContent: boolean, hasGCSkew: boolean) {
    const legendX = 20;
    const legendY = 20;
    const fs = this.config.legendFontSize;
    const barW = 120;
    const barH = 10;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'gc-legend');

    // Defs for gradients
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    group.appendChild(defs);

    let y = legendY + fs;

    // --- GC Content gradient bar (red → green) ---
    if (hasGCContent) {
    const gcTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    gcTitle.setAttribute('x', String(legendX));
    gcTitle.setAttribute('y', String(y));
    gcTitle.setAttribute('font-size', String(fs));
    gcTitle.setAttribute('font-weight', 'bold');
    gcTitle.setAttribute('fill', '#333');
    gcTitle.textContent = 'GC Content';
    group.appendChild(gcTitle);
    y += fs + 2;

    const gcGrad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gcGrad.setAttribute('id', 'gc-content-grad');
    const gcStop0 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    gcStop0.setAttribute('offset', '0%');
    gcStop0.setAttribute('stop-color', 'rgb(255, 55, 50)');
    gcGrad.appendChild(gcStop0);
    const gcStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    gcStop1.setAttribute('offset', '100%');
    gcStop1.setAttribute('stop-color', 'rgb(55, 255, 50)');
    gcGrad.appendChild(gcStop1);
    defs.appendChild(gcGrad);

    const gcBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    gcBar.setAttribute('x', String(legendX));
    gcBar.setAttribute('y', String(y));
    gcBar.setAttribute('width', String(barW));
    gcBar.setAttribute('height', String(barH));
    gcBar.setAttribute('fill', 'url(#gc-content-grad)');
    gcBar.setAttribute('rx', '2');
    gcBar.setAttribute('stroke', '#ccc');
    gcBar.setAttribute('stroke-width', '0.5');
    group.appendChild(gcBar);

    // Ticks: Low / Average / High
    const gcTicks = [
      { label: '0%', x: legendX },
      { label: '50%', x: legendX + barW / 2 },
      { label: '100%', x: legendX + barW }
    ];
    gcTicks.forEach(tick => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(tick.x));
      line.setAttribute('y1', String(y));
      line.setAttribute('x2', String(tick.x));
      line.setAttribute('y2', String(y + barH + 3));
      line.setAttribute('stroke', '#666');
      line.setAttribute('stroke-width', '1');
      group.appendChild(line);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(tick.x));
      label.setAttribute('y', String(y + barH + fs));
      label.setAttribute('font-size', String(fs - 3));
      label.setAttribute('fill', '#666');
      label.setAttribute('text-anchor', 'middle');
      label.textContent = tick.label;
      group.appendChild(label);
    });
    y += barH + fs * 2 + 6;
    } // end hasGCContent

    // --- GC Skew gradient bar (purple → green) ---
    if (hasGCSkew) {
      const skewTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      skewTitle.setAttribute('x', String(legendX));
      skewTitle.setAttribute('y', String(y));
      skewTitle.setAttribute('font-size', String(fs));
      skewTitle.setAttribute('font-weight', 'bold');
      skewTitle.setAttribute('fill', '#333');
      skewTitle.textContent = 'GC Skew';
      group.appendChild(skewTitle);
      y += fs + 2;

      const skewGrad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      skewGrad.setAttribute('id', 'gc-skew-grad');
      const skStop0 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      skStop0.setAttribute('offset', '0%');
      skStop0.setAttribute('stop-color', '#a855f7');
      skewGrad.appendChild(skStop0);
      const skStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      skStop1.setAttribute('offset', '100%');
      skStop1.setAttribute('stop-color', '#22c55e');
      skewGrad.appendChild(skStop1);
      defs.appendChild(skewGrad);

      const skewBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      skewBar.setAttribute('x', String(legendX));
      skewBar.setAttribute('y', String(y));
      skewBar.setAttribute('width', String(barW));
      skewBar.setAttribute('height', String(barH));
      skewBar.setAttribute('fill', 'url(#gc-skew-grad)');
      skewBar.setAttribute('rx', '2');
      skewBar.setAttribute('stroke', '#ccc');
      skewBar.setAttribute('stroke-width', '0.5');
      group.appendChild(skewBar);

      const skewTicks = [
        { label: '-1', x: legendX },
        { label: '0', x: legendX + barW / 2 },
        { label: '+1', x: legendX + barW }
      ];
      skewTicks.forEach(tick => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(tick.x));
        line.setAttribute('y1', String(y));
        line.setAttribute('x2', String(tick.x));
        line.setAttribute('y2', String(y + barH + 3));
        line.setAttribute('stroke', '#666');
        line.setAttribute('stroke-width', '1');
        group.appendChild(line);

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', String(tick.x));
        label.setAttribute('y', String(y + barH + fs));
        label.setAttribute('font-size', String(fs - 3));
        label.setAttribute('fill', '#666');
        label.setAttribute('text-anchor', 'middle');
        label.textContent = tick.label;
        group.appendChild(label);
      });
    }

    svg.appendChild(group);
  }

  private renderScaleMarkers(
    svg: SVGSVGElement,
    cx: number,
    cy: number,
    refLength: number
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
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

  private renderRingLegend(svg: SVGSVGElement, rings: RingData[]) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'ring-legend');

    const legendX = this.config.width - 200;
    const legendY = 20;
    const fs = this.config.legendFontSize;
    const hasBlastHits = (r: RingData) => r.hits && r.hits.length > 0;
    const isGraphRing = (r: RingData) => r.graphPoints && r.graphPoints.length > 0;

    let y = legendY + fs;

    rings.filter(r => r.visible).forEach((ring) => {
      if (hasBlastHits(ring)) {
        // Ring name (bold, own line)
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(legendX));
        text.setAttribute('y', String(y));
        text.setAttribute('font-size', String(fs));
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', '#333');
        text.textContent = ring.queryName;
        group.appendChild(text);
        y += fs + 2;
        const upper = ring.upperThreshold ?? this.config.maxIdentity;
        const lower = ring.lowerThreshold ?? this.config.minIdentity;
        const barW = 120;
        const barH = 10;

        // Create a unique gradient definition for this ring
        const gradId = `grad-${ring.queryId}`;
        let defs = group.querySelector('defs');
        if (!defs) {
          defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          group.insertBefore(defs, group.firstChild);
        }
        const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        grad.setAttribute('id', gradId);
        // Gradient: left = low identity (faded), right = high identity (full colour)
        const hex = ring.color.replace('#', '');
        const cr = parseInt(hex.substring(0, 2), 16);
        const cg = parseInt(hex.substring(2, 4), 16);
        const cb = parseInt(hex.substring(4, 6), 16);
        const stop0 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop0.setAttribute('offset', '0%');
        stop0.setAttribute('stop-color', `rgb(${Math.round(255 + (cr - 255) * 0.15)}, ${Math.round(255 + (cg - 255) * 0.15)}, ${Math.round(255 + (cb - 255) * 0.15)})`);
        grad.appendChild(stop0);
        const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop1.setAttribute('offset', '100%');
        stop1.setAttribute('stop-color', ring.color);
        grad.appendChild(stop1);
        defs.appendChild(grad);

        // Draw gradient bar
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bar.setAttribute('x', String(legendX));
        bar.setAttribute('y', String(y - barH + 2));
        bar.setAttribute('width', String(barW));
        bar.setAttribute('height', String(barH));
        bar.setAttribute('fill', `url(#${gradId})`);
        bar.setAttribute('rx', '2');
        bar.setAttribute('stroke', '#ccc');
        bar.setAttribute('stroke-width', '0.5');
        group.appendChild(bar);

        // Tick marks and labels at lower, mid, upper
        const ticks = [
          { pct: lower, x: legendX },
          { pct: Math.round((upper + lower) / 2), x: legendX + barW / 2 },
          { pct: upper, x: legendX + barW }
        ];
        ticks.forEach(tick => {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', String(tick.x));
          line.setAttribute('y1', String(y - barH + 2));
          line.setAttribute('x2', String(tick.x));
          line.setAttribute('y2', String(y + 4));
          line.setAttribute('stroke', '#666');
          line.setAttribute('stroke-width', '1');
          group.appendChild(line);

          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.setAttribute('x', String(tick.x));
          label.setAttribute('y', String(y + fs));
          label.setAttribute('font-size', String(fs - 3));
          label.setAttribute('fill', '#666');
          label.setAttribute('text-anchor', 'middle');
          label.textContent = `${tick.pct}%`;
          group.appendChild(label);
        });
        y += fs + barH + 4;
      } else if (isGraphRing(ring)) {
        // Graph ring - colour swatch + name on same line
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(legendX));
        rect.setAttribute('y', String(y - fs + 3));
        rect.setAttribute('width', '12');
        rect.setAttribute('height', String(fs));
        rect.setAttribute('fill', ring.color);
        rect.setAttribute('rx', '2');
        group.appendChild(rect);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(legendX + 16));
        text.setAttribute('y', String(y));
        text.setAttribute('font-size', String(fs));
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', '#333');
        text.textContent = ring.queryName;
        group.appendChild(text);
        y += fs + 2;
      } else {
        // No data - colour swatch + name on same line
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(legendX));
        rect.setAttribute('y', String(y - fs + 3));
        rect.setAttribute('width', '12');
        rect.setAttribute('height', String(fs));
        rect.setAttribute('fill', ring.color);
        rect.setAttribute('rx', '2');
        group.appendChild(rect);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(legendX + 16));
        text.setAttribute('y', String(y));
        text.setAttribute('font-size', String(fs));
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', '#333');
        text.textContent = ring.queryName;
        group.appendChild(text);
        y += fs + 2;
      }

      y += fs; // gap between rings scales with font size
    });

    svg.appendChild(group);
  }

  render(container: HTMLElement, data: CircularPlotData): SVGSVGElement {
    // Create SVG
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', `0 0 ${this.config.width} ${this.config.height}`);
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    
    // Embed font-family style so exports use sans-serif
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = 'text { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }';
    this.svg.appendChild(style);

    // Add white background rect so exports also have white background
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', String(this.config.width));
    bgRect.setAttribute('height', String(this.config.height));
    bgRect.setAttribute('fill', 'white');
    this.svg.appendChild(bgRect);

    // Create main content group for zoom/pan transforms
    const mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    mainGroup.setAttribute('class', 'main-content');
    mainGroup.setAttribute('transform-origin', 'center');
    this.svg.appendChild(mainGroup);
    
    // Now render everything into mainGroup instead of svg
    const tempSvg = this.svg;
    this.svg = mainGroup as any; // Temporarily use mainGroup as target
    
    const cx = this.config.width / 2;
    const cy = this.config.height / 2;
    const refLength = data.reference.length;
    
    // Render reference ring first
    this.renderReferenceRing(mainGroup as any, cx, cy, refLength);

    // Calculate ring positions - GC Content and GC Skew come first
    let currentRadius = this.config.innerRadius;

    // Render GC Content ring
    if (data.reference.gcContent) {
      currentRadius += this.config.ringSpacing; // Small spacing from reference
      this.renderGCRing(mainGroup as any, cx, cy, refLength, data.reference.gcContent, currentRadius);
      currentRadius += this.config.gcRingWidth + this.config.ringSpacing;
    }

    // Render GC Skew ring (second ring outside reference)
    if (data.reference.gcSkew) {
      this.renderGCSkewRing(mainGroup as any, cx, cy, refLength, data.reference.gcSkew, currentRadius);
      currentRadius += this.config.gcRingWidth + this.config.ringSpacing;
    }

    // Render query rings after GC rings
    const visibleRings = data.rings?.filter(r => r.visible) || [];
    visibleRings.forEach((ring) => {
      const ringWidth = ring.customWidth || this.config.ringWidth;
      const radius = currentRadius;

      // Render as graph ring if it has graph data, otherwise as alignment ring
      if (ring.graphPoints && ring.graphPoints.length > 0) {
        this.renderGraphRing(mainGroup as any, cx, cy, refLength, ring, radius, ringWidth);
      } else {
        this.renderQueryRing(mainGroup as any, cx, cy, refLength, ring, radius, ringWidth);
      }

      if (ring.annotations && ring.annotations.length > 0) {
        this.renderAnnotations(
          mainGroup as any,
          cx, cy, refLength,
          ring.annotations,
          radius,
          radius + ringWidth,
          ring.showLabels !== false
        );
      }

      currentRadius += ringWidth + this.config.ringSpacing;
    });

    // Render contig boundaries on the outermost ring (after all query rings)
    if (data.reference.contigs && data.reference.contigs.length > 1) {
      const contigRingWidth = 6;
      this.renderContigBoundaries(mainGroup as any, cx, cy, refLength, data.reference.contigs, currentRadius, contigRingWidth);
      currentRadius += contigRingWidth + this.config.ringSpacing;
    }

    this.renderScaleMarkers(mainGroup as any, cx, cy, refLength);
    
    // Add GC analysis legend if present
    if (data.reference.gcContent || data.reference.gcSkew) {
      this.renderGCLegend(mainGroup as any, !!data.reference.gcContent, !!data.reference.gcSkew);
    }
    
    // Add ring legend
    if (visibleRings.length > 0) {
      this.renderRingLegend(mainGroup as any, visibleRings);
    }
    
    // Render title and reference size in center
    this.renderTitle(mainGroup as any, cx, cy, refLength);
    
    // Restore svg reference
    this.svg = tempSvg;
    
    // Clear and append to container
    container.innerHTML = '';
    container.appendChild(this.svg);
    
    return this.svg;
  }

  private renderTitle(svg: SVGSVGElement, cx: number, cy: number, refLength: number) {
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
      svg.appendChild(titleText);
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
    svg.appendChild(sizeText);
  }

  setTooltipCallback(callback: (info: any) => void) {
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

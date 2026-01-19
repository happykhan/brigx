// Circular Plot SVG Renderer
import type { CircularPlotData, RingData, WindowData, Feature, Annotation } from './types';

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
    refLength: number
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
    const maxBarHeight = ringWidth / 2; // Stay within ring boundaries
    const windowSize = refLength / gcSkew.length;
    
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
      const barHeight = Math.abs(skew) * maxBarHeight;
      
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
      
      arcElement.addEventListener('mouseenter', (e) => {
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
    const maxBarHeight = ringWidth / 2; // Stay within ring boundaries (50% baseline ± 50% of ring width)
    const windowSize = refLength / gcContent.length;
    
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
      // Map GC content (0-1) to deviation (-1 to +1) around 50% baseline
      // Use full maxBarHeight for any deviation to match GC Skew scaling
      const deviation = (gc - 0.5) * 2; // Range: -1 to +1
      const barHeight = Math.abs(deviation) * maxBarHeight;
      
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
      
      arcElement.addEventListener('mouseenter', (e) => {
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
        const color = this.getColorIntensity(ring.color, hit.percentIdentity);
        
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
    outerRadius: number
  ) {
    if (!annotations || annotations.length === 0) return;
    
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'annotations');
    
    annotations.forEach(ann => {
      // Wrap coordinates if needed
      const start = Math.max(1, Math.min(ann.start, refLength));
      const end = Math.max(1, Math.min(ann.end, refLength));
      
      const startAngle = (start / refLength) * 2 * Math.PI - Math.PI / 2;
      const endAngle = (end / refLength) * 2 * Math.PI - Math.PI / 2;
      
      const color = ann.color || '#666666';
      
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
        
        // Add text label with leader line
        const midAngle = (startAngle + endAngle) / 2;
        const featureRadius = (innerRadius + outerRadius) / 2;
        const featureX = cx + featureRadius * Math.cos(midAngle);
        const featureY = cy + featureRadius * Math.sin(midAngle);
        
        // Position label further out with offset to avoid overlap
        const labelDistance = outerRadius + 30;
        const labelX = cx + labelDistance * Math.cos(midAngle);
        const labelY = cy + labelDistance * Math.sin(midAngle);
        
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
        const textWidth = ann.label.length * (this.config.labelFontSize * 0.6);
        const textHeight = this.config.labelFontSize + 4;
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
        
      } else if (ann.shape === 'arrow-forward' || ann.shape === 'arrow-reverse') {
        // Arrow shape (gene-like)
        const midRadius = (innerRadius + outerRadius) / 2;
        const arrowHeadSize = (outerRadius - innerRadius) / 2;
        
        // Determine arrow direction
        const isForward = ann.shape === 'arrow-forward';
        const bodyEndAngle = isForward 
          ? endAngle - (0.02 * (endAngle - startAngle)) 
          : startAngle + (0.02 * (endAngle - startAngle));
        const arrowTipAngle = isForward ? endAngle : startAngle;
        
        // Create arrow body
        const bodyPath = this.createArcPath(
          cx, cy,
          innerRadius, outerRadius,
          isForward ? startAngle : bodyEndAngle,
          isForward ? bodyEndAngle : endAngle
        );
        
        const bodyElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        bodyElement.setAttribute('d', bodyPath);
        bodyElement.setAttribute('fill', color);
        bodyElement.setAttribute('stroke', '#000');
        bodyElement.setAttribute('stroke-width', '0.5');
        bodyElement.setAttribute('opacity', '0.7');
        
        group.appendChild(bodyElement);
        
        // Create arrow head
        const tipX = cx + midRadius * Math.cos(arrowTipAngle);
        const tipY = cy + midRadius * Math.sin(arrowTipAngle);
        
        const baseAngle = isForward ? bodyEndAngle : bodyEndAngle;
        const innerBaseX = cx + innerRadius * Math.cos(baseAngle);
        const innerBaseY = cy + innerRadius * Math.sin(baseAngle);
        const outerBaseX = cx + outerRadius * Math.cos(baseAngle);
        const outerBaseY = cy + outerRadius * Math.sin(baseAngle);
        
        // Add extensions for sharper arrow
        const extendRadius = midRadius + arrowHeadSize;
        const extendedTipX = cx + extendRadius * Math.cos(arrowTipAngle);
        const extendedTipY = cy + extendRadius * Math.sin(arrowTipAngle);
        
        const arrowPath = `
          M ${innerBaseX} ${innerBaseY}
          L ${extendedTipX} ${extendedTipY}
          L ${outerBaseX} ${outerBaseY}
          Z
        `.replace(/\s+/g, ' ').trim();
        
        const arrowElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrowElement.setAttribute('d', arrowPath);
        arrowElement.setAttribute('fill', color);
        arrowElement.setAttribute('stroke', '#000');
        arrowElement.setAttribute('stroke-width', '0.5');
        arrowElement.setAttribute('opacity', '0.7');
        
        group.appendChild(arrowElement);
        
        // Add hover effects to both elements
        [bodyElement, arrowElement].forEach(el => {
          el.addEventListener('mouseenter', () => {
            bodyElement.setAttribute('opacity', '0.9');
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
          
          el.addEventListener('mouseleave', () => {
            bodyElement.setAttribute('opacity', '0.7');
            arrowElement.setAttribute('opacity', '0.7');
          });
        });
        
        // Add text label with leader line for arrow
        const midAngle = (startAngle + endAngle) / 2;
        const featureRadius = (innerRadius + outerRadius) / 2;
        const featureX = cx + featureRadius * Math.cos(midAngle);
        const featureY = cy + featureRadius * Math.sin(midAngle);
        
        // Position label further out
        const labelDistance = outerRadius + 30;
        const labelX = cx + labelDistance * Math.cos(midAngle);
        const labelY = cy + labelDistance * Math.sin(midAngle);
        
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
        const textWidth = ann.label.length * (this.config.labelFontSize * 0.6);
        const textHeight = this.config.labelFontSize + 4;
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
    });
    
    svg.appendChild(group);
  }

  // Color intensity scaling based on identity and thresholds
  private getColorIntensity(baseColor: string, percentIdentity: number): string {
    // Parse the base color (assuming hex format like #e74c3c)
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Map identity to intensity (minIdentity = white, 100 = full color)
    // Using config.minIdentity as lower threshold
    const minIdentity = this.config.minIdentity;
    const maxIdentity = 100;
    
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

  private renderGCLegend(svg: SVGSVGElement, hasGCSkew: boolean) {
    const legendX = 20;
    const legendY = 20;
    const lineHeight = 22;
    
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'gc-legend');
    
    // Calculate legend height based on content
    const legendHeight = hasGCSkew ? 115 : 70;
    
    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', String(legendX - 5));
    bg.setAttribute('y', String(legendY - 5));
    bg.setAttribute('width', '120');
    bg.setAttribute('height', String(legendHeight));
    bg.setAttribute('fill', 'white');
    bg.setAttribute('stroke', '#ccc');
    bg.setAttribute('stroke-width', '1');
    bg.setAttribute('rx', '5');
    bg.setAttribute('opacity', '0.95');
    group.appendChild(bg);
    
    // Title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', String(legendX));
    title.setAttribute('y', String(legendY + 10));
    title.setAttribute('font-size', String(this.config.legendFontSize));
    title.setAttribute('font-weight', 'bold');
    title.setAttribute('fill', '#333');
    title.textContent = 'GC Analysis';
    group.appendChild(title);
    
    // Low GC indicator
    const lowRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    lowRect.setAttribute('x', String(legendX));
    lowRect.setAttribute('y', String(legendY + 20));
    lowRect.setAttribute('width', '15');
    lowRect.setAttribute('height', '15');
    lowRect.setAttribute('fill', 'rgb(255, 55, 50)');
    lowRect.setAttribute('rx', '2');
    group.appendChild(lowRect);
    
    const lowText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lowText.setAttribute('x', String(legendX + 20));
    lowText.setAttribute('y', String(legendY + 31));
    lowText.setAttribute('font-size', String(this.config.legendFontSize - 1));
    lowText.setAttribute('fill', '#333');
    lowText.textContent = 'Low GC';
    group.appendChild(lowText);
    
    // High GC indicator
    const highRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    highRect.setAttribute('x', String(legendX));
    highRect.setAttribute('y', String(legendY + 40));
    highRect.setAttribute('width', '15');
    highRect.setAttribute('height', '15');
    highRect.setAttribute('fill', 'rgb(55, 255, 50)');
    highRect.setAttribute('rx', '2');
    group.appendChild(highRect);
    
    const highText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    highText.setAttribute('x', String(legendX + 20));
    highText.setAttribute('y', String(legendY + 51));
    highText.setAttribute('font-size', String(this.config.legendFontSize - 1));
    highText.setAttribute('fill', '#333');
    highText.textContent = 'High GC';
    group.appendChild(highText);
    
    // GC Skew indicators (if present)
    if (hasGCSkew) {
      // Purple for negative (more C)
      const negSkewRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      negSkewRect.setAttribute('x', String(legendX));
      negSkewRect.setAttribute('y', String(legendY + 65));
      negSkewRect.setAttribute('width', '15');
      negSkewRect.setAttribute('height', '15');
      negSkewRect.setAttribute('fill', '#a855f7');
      negSkewRect.setAttribute('rx', '2');
      group.appendChild(negSkewRect);
      
      const negSkewText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      negSkewText.setAttribute('x', String(legendX + 20));
      negSkewText.setAttribute('y', String(legendY + 76));
      negSkewText.setAttribute('font-size', String(this.config.legendFontSize - 1));
      negSkewText.setAttribute('fill', '#333');
      negSkewText.textContent = 'GC- Skew';
      group.appendChild(negSkewText);
      
      // Green for positive (more G)
      const posSkewRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      posSkewRect.setAttribute('x', String(legendX));
      posSkewRect.setAttribute('y', String(legendY + 85));
      posSkewRect.setAttribute('width', '15');
      posSkewRect.setAttribute('height', '15');
      posSkewRect.setAttribute('fill', '#22c55e');
      posSkewRect.setAttribute('rx', '2');
      group.appendChild(posSkewRect);
      
      const posSkewText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      posSkewText.setAttribute('x', String(legendX + 20));
      posSkewText.setAttribute('y', String(legendY + 96));
      posSkewText.setAttribute('font-size', String(this.config.legendFontSize - 1));
      posSkewText.setAttribute('fill', '#333');
      posSkewText.textContent = 'GC+ Skew';
      group.appendChild(posSkewText);
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
    const lineHeight = 25;
    
    // Title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', String(legendX));
    title.setAttribute('y', String(legendY));
    title.setAttribute('font-size', String(this.config.legendFontSize + 2));
    title.setAttribute('font-weight', 'bold');
    title.setAttribute('fill', '#333');
    title.textContent = 'Rings';
    group.appendChild(title);
    
    // Legend items
    rings.filter(r => r.visible).forEach((ring, index) => {
      const y = legendY + 20 + index * lineHeight;
      
      // Color swatch
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(legendX));
      rect.setAttribute('y', String(y - 10));
      rect.setAttribute('width', '15');
      rect.setAttribute('height', '15');
      rect.setAttribute('fill', ring.color);
      rect.setAttribute('rx', '2');
      group.appendChild(rect);
      
      // Ring name
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(legendX + 20));
      text.setAttribute('y', String(y));
      text.setAttribute('font-size', String(this.config.legendFontSize));
      text.setAttribute('fill', '#333');
      text.textContent = ring.queryName;
      group.appendChild(text);
      
      // Coverage info
      const coverage = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      coverage.setAttribute('x', String(legendX + 20));
      coverage.setAttribute('y', String(y + 12));
      coverage.setAttribute('font-size', String(this.config.legendFontSize - 2));
      coverage.setAttribute('fill', '#666');
      coverage.textContent = `${ring.statistics.genomeCoverage.toFixed(1)}% coverage`;
      group.appendChild(coverage);
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
    this.renderReferenceRing(this.svg, cx, cy, refLength);
    
    // Calculate ring positions - GC Content and GC Skew come first as their own rings
    let currentRadius = this.config.innerRadius;
    
    // Render GC Content ring (first ring outside reference, no gap)
    if (data.reference.gcContent) {
      currentRadius += this.config.ringSpacing; // Small spacing from reference
      this.renderGCRing(this.svg, cx, cy, refLength, data.reference.gcContent, currentRadius);
      currentRadius += this.config.gcRingWidth + this.config.ringSpacing;
    }
    
    // Render GC Skew ring (second ring outside reference)
    if (data.reference.gcSkew) {
      this.renderGCSkewRing(this.svg, cx, cy, refLength, data.reference.gcSkew, currentRadius);
      currentRadius += this.config.gcRingWidth + this.config.ringSpacing;
    }
    
    // Render query rings after GC rings
    const visibleRings = data.rings?.filter(r => r.visible) || [];
    visibleRings.forEach((ring, index) => {
      // Use custom width if specified, otherwise use default
      const ringWidth = ring.customWidth || this.config.ringWidth;
      const radius = currentRadius + (index * (ringWidth + this.config.ringSpacing));
      
      this.renderQueryRing(this.svg!, cx, cy, refLength, ring, radius, ringWidth);
      
      // Render annotations for this ring if any
      if (ring.annotations && ring.annotations.length > 0) {
        this.renderAnnotations(
          this.svg!,
          cx, cy, refLength,
          ring.annotations,
          radius,
          radius + ringWidth
        );
      }
      
      // Update currentRadius for next ring
      currentRadius = radius + ringWidth + this.config.ringSpacing;
    });
    
    this.renderScaleMarkers(this.svg, cx, cy, refLength);
    
    // Add GC analysis legend if present
    if (data.reference.gcContent || data.reference.gcSkew) {
      this.renderGCLegend(this.svg, !!data.reference.gcSkew);
    }
    
    // Add ring legend
    if (visibleRings.length > 0) {
      this.renderRingLegend(this.svg, visibleRings);
    }
    
    // Render title and reference size in center
    this.renderTitle(this.svg, cx, cy, refLength);
    
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

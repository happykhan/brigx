// Pure geometry functions shared between Canvas and SVG renderers

/**
 * Convert a genome position to radians, with -PI/2 offset so 0bp is at 12 o'clock.
 */
export function positionToAngle(position: number, refLength: number): number {
  return (position / refLength) * 2 * Math.PI - Math.PI / 2;
}

/**
 * Compute the four corner points of an annular arc segment.
 */
export interface ArcCoords {
  innerStart: { x: number; y: number };
  outerStart: { x: number; y: number };
  outerEnd: { x: number; y: number };
  innerEnd: { x: number; y: number };
  largeArc: boolean;
}

export function createArcCoords(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
): ArcCoords {
  return {
    innerStart: { x: cx + innerR * Math.cos(startAngle), y: cy + innerR * Math.sin(startAngle) },
    outerStart: { x: cx + outerR * Math.cos(startAngle), y: cy + outerR * Math.sin(startAngle) },
    outerEnd: { x: cx + outerR * Math.cos(endAngle), y: cy + outerR * Math.sin(endAngle) },
    innerEnd: { x: cx + innerR * Math.cos(endAngle), y: cy + innerR * Math.sin(endAngle) },
    largeArc: endAngle - startAngle > Math.PI,
  };
}

/**
 * Convert hex colour string to RGB components.
 */
export function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/**
 * Interpolate between white and a base colour based on percent identity and thresholds.
 * Returns an "rgb(r,g,b)" string.
 */
export function getColorIntensity(
  baseColor: string,
  percentIdentity: number,
  lowerThreshold: number,
  upperThreshold: number
): string {
  const { r, g, b } = hexToRGB(baseColor);
  const normalized = Math.max(0, Math.min(1,
    (percentIdentity - lowerThreshold) / (upperThreshold - lowerThreshold)
  ));
  const finalR = Math.round(255 + (r - 255) * normalized);
  const finalG = Math.round(255 + (g - 255) * normalized);
  const finalB = Math.round(255 + (b - 255) * normalized);
  return `rgb(${finalR}, ${finalG}, ${finalB})`;
}

export interface RingLayout {
  type: 'gc-content' | 'gc-skew' | 'alignment' | 'graph' | 'annotation' | 'contig';
  radius: number;
  width: number;
  ringIndex: number;
  queryId?: string;
}

export interface RingLayoutConfig {
  innerRadius: number;
  ringWidth: number;
  gcRingWidth: number;
  ringSpacing: number;
}

export interface RingLayoutInput {
  hasGCContent: boolean;
  hasGCSkew: boolean;
  rings: Array<{
    queryId: string;
    visible: boolean;
    customWidth?: number;
    graphPoints?: unknown[];
    annotations?: unknown[];
  }>;
  hasContigs: boolean;
}

/**
 * Calculate the radius and width of each ring in order.
 * Returns an array of RingLayout objects describing each ring's position.
 */
export function calculateRingLayout(
  config: RingLayoutConfig,
  data: RingLayoutInput
): RingLayout[] {
  const layouts: RingLayout[] = [];
  let currentRadius = config.innerRadius;
  let idx = 0;

  if (data.hasGCContent) {
    currentRadius += config.ringSpacing;
    layouts.push({ type: 'gc-content', radius: currentRadius, width: config.gcRingWidth, ringIndex: idx++ });
    currentRadius += config.gcRingWidth + config.ringSpacing;
  }

  if (data.hasGCSkew) {
    layouts.push({ type: 'gc-skew', radius: currentRadius, width: config.gcRingWidth, ringIndex: idx++ });
    currentRadius += config.gcRingWidth + config.ringSpacing;
  }

  const visibleRings = data.rings.filter(r => r.visible);
  for (const ring of visibleRings) {
    const ringWidth = ring.customWidth || config.ringWidth;
    const isGraph = ring.graphPoints && ring.graphPoints.length > 0;

    layouts.push({
      type: isGraph ? 'graph' : 'alignment',
      radius: currentRadius,
      width: ringWidth,
      ringIndex: idx++,
      queryId: ring.queryId,
    });

    currentRadius += ringWidth + config.ringSpacing;
  }

  if (data.hasContigs) {
    const contigRingWidth = 6;
    layouts.push({ type: 'contig', radius: currentRadius, width: contigRingWidth, ringIndex: idx++ });
    currentRadius += contigRingWidth + config.ringSpacing;
  }

  return layouts;
}

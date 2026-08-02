import type { RingData } from '../types';
import { hexToRGB } from '../geometry';
import type { Point, RenderConfig } from './types';

const BAR_WIDTH = 120;
const BAR_HEIGHT = 10;

function svgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}

function appendText(
  parent: SVGElement,
  textContent: string,
  x: number,
  y: number,
  fontSize: number,
  options: { bold?: boolean; anchor?: 'start' | 'middle' } = {},
): void {
  const text = svgElement('text');
  text.setAttribute('x', String(x));
  text.setAttribute('y', String(y));
  text.setAttribute('font-size', String(fontSize));
  text.setAttribute('fill', '#333');
  if (options.bold) text.setAttribute('font-weight', 'bold');
  if (options.anchor) text.setAttribute('text-anchor', options.anchor);
  text.textContent = textContent;
  parent.appendChild(text);
}

function appendGradient(
  definitions: SVGDefsElement,
  id: string,
  startColor: string,
  endColor: string,
): void {
  const gradient = svgElement('linearGradient');
  gradient.setAttribute('id', id);
  for (const [offset, color] of [['0%', startColor], ['100%', endColor]]) {
    const stop = svgElement('stop');
    stop.setAttribute('offset', offset);
    stop.setAttribute('stop-color', color);
    gradient.appendChild(stop);
  }
  definitions.appendChild(gradient);
}

function appendBar(parent: SVGElement, x: number, y: number, fill: string): void {
  const bar = svgElement('rect');
  bar.setAttribute('x', String(x));
  bar.setAttribute('y', String(y));
  bar.setAttribute('width', String(BAR_WIDTH));
  bar.setAttribute('height', String(BAR_HEIGHT));
  bar.setAttribute('fill', fill);
  bar.setAttribute('rx', '2');
  bar.setAttribute('stroke', '#ccc');
  bar.setAttribute('stroke-width', '0.5');
  parent.appendChild(bar);
}

function appendTicks(
  parent: SVGElement,
  ticks: ReadonlyArray<{ label: string; x: number }>,
  y: number,
  tickBottom: number,
  labelY: number,
  fontSize: number,
): void {
  for (const tick of ticks) {
    const line = svgElement('line');
    line.setAttribute('x1', String(tick.x));
    line.setAttribute('y1', String(y));
    line.setAttribute('x2', String(tick.x));
    line.setAttribute('y2', String(tickBottom));
    line.setAttribute('stroke', '#666');
    line.setAttribute('stroke-width', '1');
    parent.appendChild(line);
    appendText(parent, tick.label, tick.x, labelY, fontSize - 3, { anchor: 'middle' });
  }
}

function prependTransparentBounds(
  group: SVGGElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const background = svgElement('rect');
  background.setAttribute('x', String(x));
  background.setAttribute('y', String(y));
  background.setAttribute('width', String(width));
  background.setAttribute('height', String(height));
  background.setAttribute('fill', '#fff');
  background.setAttribute('fill-opacity', '0');
  group.insertBefore(background, group.firstChild);
}

export function renderSVGGCLegend(
  parent: SVGElement,
  definitions: SVGDefsElement,
  config: RenderConfig,
  position: Point | null,
  hasGCContent: boolean,
  hasGCSkew: boolean,
): void {
  const x = position?.x ?? 20;
  const startY = position?.y ?? 20;
  const fontSize = config.legendFontSize;
  const group = svgElement('g');
  group.setAttribute('id', 'gc-legend');
  group.setAttribute('inkscape:label', 'GC Legend');
  group.setAttribute('class', 'gc-legend');
  let y = startY + fontSize;

  if (hasGCContent) {
    appendText(group, 'GC Content', x, y, fontSize, { bold: true });
    y += fontSize + 2;
    appendGradient(definitions, 'gc-content-grad', 'rgb(255, 55, 50)', 'rgb(55, 255, 50)');
    appendBar(group, x, y, 'url(#gc-content-grad)');
    appendTicks(group, [
      { label: '0%', x },
      { label: '50%', x: x + BAR_WIDTH / 2 },
      { label: '100%', x: x + BAR_WIDTH },
    ], y, y + BAR_HEIGHT + 3, y + BAR_HEIGHT + fontSize, fontSize);
    y += BAR_HEIGHT + fontSize * 2 + 6;
  }

  if (hasGCSkew) {
    appendText(group, 'GC Skew', x, y, fontSize, { bold: true });
    y += fontSize + 2;
    appendGradient(definitions, 'gc-skew-grad', '#a855f7', '#22c55e');
    appendBar(group, x, y, 'url(#gc-skew-grad)');
    appendTicks(group, [
      { label: '-1', x },
      { label: '0', x: x + BAR_WIDTH / 2 },
      { label: '+1', x: x + BAR_WIDTH },
    ], y, y + BAR_HEIGHT + 3, y + BAR_HEIGHT + fontSize, fontSize);
  }

  prependTransparentBounds(group, x - 5, startY, BAR_WIDTH + 10, y + BAR_HEIGHT + fontSize + 5 - startY);
  parent.appendChild(group);
}

export function renderSVGRingLegend(
  parent: SVGElement,
  definitions: SVGDefsElement,
  config: RenderConfig,
  position: Point | null,
  rings: readonly RingData[],
): void {
  const x = position?.x ?? config.width - 200;
  const startY = position?.y ?? 20;
  const fontSize = config.legendFontSize;
  const group = svgElement('g');
  group.setAttribute('id', 'ring-legend');
  group.setAttribute('inkscape:label', 'Ring Legend');
  group.setAttribute('class', 'ring-legend');
  let y = startY + fontSize;

  for (const ring of rings.filter(candidate => candidate.visible)) {
    if (ring.hits.length === 0) {
      const swatch = svgElement('rect');
      swatch.setAttribute('x', String(x));
      swatch.setAttribute('y', String(y - fontSize + 3));
      swatch.setAttribute('width', '12');
      swatch.setAttribute('height', String(fontSize));
      swatch.setAttribute('fill', ring.color);
      swatch.setAttribute('rx', '2');
      group.appendChild(swatch);
      appendText(group, ring.queryName, x + 16, y, fontSize, { bold: true });
      y += fontSize * 2 + 2;
      continue;
    }

    appendText(group, ring.queryName, x, y, fontSize, { bold: true });
    y += fontSize + 2;
    const upper = ring.upperThreshold ?? config.maxIdentity;
    const lower = ring.lowerThreshold ?? config.minIdentity;
    const gradientId = `grad-${ring.queryId}`;
    const { r, g, b } = hexToRGB(ring.color);
    appendGradient(
      definitions,
      gradientId,
      `rgb(${Math.round(255 + (r - 255) * 0.15)}, ${Math.round(255 + (g - 255) * 0.15)}, ${Math.round(255 + (b - 255) * 0.15)})`,
      ring.color,
    );
    const barY = y - BAR_HEIGHT + 2;
    appendBar(group, x, barY, `url(#${gradientId})`);
    appendTicks(group, [
      { label: `${lower}%`, x },
      { label: `${Math.round((upper + lower) / 2)}%`, x: x + BAR_WIDTH / 2 },
      { label: `${upper}%`, x: x + BAR_WIDTH },
    ], barY, y + 4, y + fontSize, fontSize);
    y += fontSize * 2 + BAR_HEIGHT + 4;
  }

  prependTransparentBounds(group, x - 5, startY, 200, y - startY + 5);
  parent.appendChild(group);
}

import {
  LEGEND_BAR_HEIGHT,
  LEGEND_BAR_WIDTH,
  type LegendScene,
} from './legendLayout';

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
  text.setAttribute('fill', options.bold ? '#333' : '#666');
  if (options.bold) text.setAttribute('font-weight', 'bold');
  if (options.anchor) text.setAttribute('text-anchor', options.anchor);
  text.textContent = textContent;
  parent.appendChild(text);
}

function appendGradient(
  definitions: SVGDefsElement,
  id: string,
  colors: readonly [string, string],
): void {
  const gradient = svgElement('linearGradient');
  gradient.setAttribute('id', id);
  for (const [offset, color] of [['0%', colors[0]], ['100%', colors[1]]]) {
    const stop = svgElement('stop');
    stop.setAttribute('offset', offset);
    stop.setAttribute('stop-color', color);
    gradient.appendChild(stop);
  }
  definitions.appendChild(gradient);
}

function appendRoundedRect(
  parent: SVGElement,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke = false,
): SVGRectElement {
  const rect = svgElement('rect');
  rect.setAttribute('x', String(x));
  rect.setAttribute('y', String(y));
  rect.setAttribute('width', String(width));
  rect.setAttribute('height', String(height));
  rect.setAttribute('fill', fill);
  rect.setAttribute('rx', '2');
  if (stroke) {
    rect.setAttribute('stroke', '#ccc');
    rect.setAttribute('stroke-width', '0.5');
  }
  parent.appendChild(rect);
  return rect;
}

export function renderSVGLegend(
  parent: SVGElement,
  definitions: SVGDefsElement,
  scene: LegendScene,
  options: { id: string; label: string },
): void {
  const group = svgElement('g');
  group.setAttribute('id', options.id);
  group.setAttribute('inkscape:label', options.label);
  group.setAttribute('class', options.id);

  const bounds = appendRoundedRect(
    group,
    scene.bounds.x,
    scene.bounds.y,
    scene.bounds.width,
    scene.bounds.height,
    '#fff',
  );
  bounds.setAttribute('fill-opacity', '0');

  for (const section of scene.sections) {
    if (section.kind === 'swatch' && section.swatch) {
      appendRoundedRect(
        group,
        section.swatch.x,
        section.swatch.y,
        section.swatch.width,
        section.swatch.height,
        section.swatch.fill,
      );
    }

    appendText(
      group,
      section.title,
      section.titleX,
      section.titleY,
      scene.fontSize,
      { bold: true },
    );

    if (
      section.kind !== 'gradient'
      || !section.colors
      || !section.gradientId
      || section.barY === undefined
      || !section.ticks
      || section.tickBottom === undefined
      || section.labelY === undefined
    ) continue;

    appendGradient(definitions, section.gradientId, section.colors);
    appendRoundedRect(
      group,
      scene.x,
      section.barY,
      LEGEND_BAR_WIDTH,
      LEGEND_BAR_HEIGHT,
      `url(#${section.gradientId})`,
      true,
    );

    for (const tick of section.ticks) {
      const line = svgElement('line');
      line.setAttribute('x1', String(tick.x));
      line.setAttribute('y1', String(section.barY));
      line.setAttribute('x2', String(tick.x));
      line.setAttribute('y2', String(section.tickBottom));
      line.setAttribute('stroke', '#666');
      line.setAttribute('stroke-width', '1');
      group.appendChild(line);
      appendText(
        group,
        tick.label,
        tick.x,
        section.labelY,
        scene.fontSize - 3,
        { anchor: 'middle' },
      );
    }
  }

  parent.appendChild(group);
}

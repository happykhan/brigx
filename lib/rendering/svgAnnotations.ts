import type { Annotation } from '../types';
import { createArcPath } from '../geometry';
import {
  annotationAngles,
  calculateArrowGeometry,
  layoutAnnotationLabels,
  MAX_ANNOTATION_LABELS,
  type AnnotationLabelLayout,
} from './annotationGeometry';
import type { TooltipCallback } from './types';

interface SVGAnnotationOptions {
  parent: SVGElement;
  centerX: number;
  centerY: number;
  referenceLength: number;
  annotations: readonly Annotation[];
  innerRadius: number;
  outerRadius: number;
  showLabels?: boolean;
  labelInward?: boolean;
  labelFontSize: number;
  groupId?: string;
  groupLabel?: string;
  tooltipCallback?: TooltipCallback;
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}

function renderLabel(
  group: SVGGElement,
  layout: AnnotationLabelLayout,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  fontSize: number,
): void {
  const midAngle = (startAngle + endAngle) / 2;
  const featureRadius = (innerRadius + outerRadius) / 2;
  const featureX = centerX + featureRadius * Math.cos(midAngle);
  const featureY = centerY + featureRadius * Math.sin(midAngle);
  const labelRadius = Math.hypot(layout.labelX - centerX, layout.labelY - centerY);
  const elbowRadius = labelRadius >= featureRadius
    ? outerRadius + 10
    : Math.max(0, innerRadius - 10);
  const elbowX = centerX + elbowRadius * Math.cos(midAngle);
  const elbowY = centerY + elbowRadius * Math.sin(midAngle);

  const leader = svgElement('polyline');
  leader.setAttribute('points', `${featureX},${featureY} ${elbowX},${elbowY} ${layout.labelX},${layout.labelY}`);
  leader.setAttribute('fill', 'none');
  leader.setAttribute('stroke', '#333');
  leader.setAttribute('stroke-width', '1');
  leader.setAttribute('opacity', '0.6');
  group.appendChild(leader);

  const background = svgElement('rect');
  background.setAttribute('x', String(layout.labelX - layout.width / 2));
  background.setAttribute('y', String(layout.labelY - layout.height / 2));
  background.setAttribute('width', String(layout.width));
  background.setAttribute('height', String(layout.height));
  background.setAttribute('fill', '#fff');
  background.setAttribute('stroke', '#333');
  background.setAttribute('stroke-width', '1');
  background.setAttribute('rx', '3');
  background.setAttribute('opacity', '0.9');
  group.appendChild(background);

  const text = svgElement('text');
  text.setAttribute('x', String(layout.labelX));
  text.setAttribute('y', String(layout.labelY));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('font-size', String(fontSize));
  text.setAttribute('font-weight', 'bold');
  text.setAttribute('fill', '#000');
  text.textContent = layout.annotation.label;
  group.appendChild(text);
}

function createArrowPath(
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  isForward: boolean,
): string {
  const geometry = calculateArrowGeometry(
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    isForward,
  );
  if (!geometry.hasBody) {
    return `M ${geometry.innerBaseX} ${geometry.innerBaseY} L ${geometry.tipX} ${geometry.tipY} L ${geometry.outerBaseX} ${geometry.outerBaseY} Z`;
  }

  const bodyStartInnerX = centerX + innerRadius * Math.cos(geometry.bodyStartAngle);
  const bodyStartInnerY = centerY + innerRadius * Math.sin(geometry.bodyStartAngle);
  const bodyStartOuterX = centerX + outerRadius * Math.cos(geometry.bodyStartAngle);
  const bodyStartOuterY = centerY + outerRadius * Math.sin(geometry.bodyStartAngle);
  const largeArc = Math.abs(geometry.headBaseAngle - geometry.bodyStartAngle) > Math.PI ? 1 : 0;
  return [
    `M ${bodyStartInnerX} ${bodyStartInnerY}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} ${isForward ? 1 : 0} ${geometry.innerBaseX} ${geometry.innerBaseY}`,
    `L ${geometry.tipX} ${geometry.tipY}`,
    `L ${geometry.outerBaseX} ${geometry.outerBaseY}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} ${isForward ? 0 : 1} ${bodyStartOuterX} ${bodyStartOuterY}`,
    'Z',
  ].join(' ');
}

export function renderSVGAnnotations(options: SVGAnnotationOptions): void {
  if (options.annotations.length === 0) return;
  const showLabels = (options.showLabels ?? true)
    && options.annotations.length <= MAX_ANNOTATION_LABELS;
  if ((options.showLabels ?? true) && !showLabels) {
    console.warn(`[Renderer] ${options.annotations.length} annotations exceeds label limit (${MAX_ANNOTATION_LABELS}), disabling labels`);
  }

  const group = svgElement('g');
  group.setAttribute('id', options.groupId ?? `annotations-${options.innerRadius.toFixed(0)}`);
  group.setAttribute('inkscape:label', options.groupLabel ?? 'Annotations');
  group.setAttribute('class', 'annotations');
  const labelDistance = options.labelInward
    ? Math.max(20, options.innerRadius - 30)
    : options.outerRadius + 30;
  const labelLayouts = showLabels
    ? layoutAnnotationLabels(
      options.annotations,
      options.referenceLength,
      options.centerX,
      options.centerY,
      labelDistance,
      options.labelFontSize,
    )
    : new Map<string, AnnotationLabelLayout>();

  for (const annotation of options.annotations) {
    const { startAngle, endAngle } = annotationAngles(annotation, options.referenceLength);
    const color = annotation.color || '#666666';
    const isArrow = annotation.shape === 'arrow-forward' || annotation.shape === 'arrow-reverse';
    if (annotation.shape !== 'block' && !isArrow) continue;

    const path = svgElement('path');
    path.setAttribute('d', annotation.shape === 'block'
      ? createArcPath(
        options.centerX,
        options.centerY,
        options.innerRadius,
        options.outerRadius,
        startAngle,
        endAngle,
      )
      : createArrowPath(
        options.centerX,
        options.centerY,
        options.innerRadius,
        options.outerRadius,
        startAngle,
        endAngle,
        annotation.shape === 'arrow-forward',
      ));
    path.setAttribute('fill', color);
    path.setAttribute('stroke', '#000');
    path.setAttribute('stroke-width', '0.5');
    path.setAttribute('opacity', '0.7');
    path.addEventListener('mouseenter', () => {
      path.setAttribute('opacity', '0.9');
      options.tooltipCallback?.({
        type: 'annotation',
        label: annotation.label,
        start: annotation.start,
        end: annotation.end,
        strand: annotation.shape === 'arrow-forward'
          ? '+'
          : annotation.shape === 'arrow-reverse'
            ? '-'
            : undefined,
      });
    });
    path.addEventListener('mouseleave', () => path.setAttribute('opacity', '0.7'));
    group.appendChild(path);

    const labelLayout = labelLayouts.get(annotation.id);
    if (showLabels && labelLayout) {
      renderLabel(
        group,
        labelLayout,
        options.centerX,
        options.centerY,
        options.innerRadius,
        options.outerRadius,
        startAngle,
        endAngle,
        options.labelFontSize,
      );
    }
  }
  options.parent.appendChild(group);
}

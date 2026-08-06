import type { Annotation } from '../types';
import { positionToAngle } from '../geometry';

export const MAX_ANNOTATION_LABELS = 200;

export interface AnnotationAngles {
  startAngle: number;
  endAngle: number;
}

export interface AnnotationLabelLayout {
  annotation: Annotation;
  midAngle: number;
  adjustedAngle: number;
  labelX: number;
  labelY: number;
  width: number;
  height: number;
}

export interface ArrowGeometry {
  bodyStartAngle: number;
  headBaseAngle: number;
  innerBaseX: number;
  innerBaseY: number;
  outerBaseX: number;
  outerBaseY: number;
  tipX: number;
  tipY: number;
  hasBody: boolean;
  isForward: boolean;
}

const TWO_PI = Math.PI * 2;
const LABEL_GAP = 8;

function normaliseAngle(angle: number): number {
  const normalised = angle % TWO_PI;
  return normalised < 0 ? normalised + TWO_PI : normalised;
}

function selectEvenly<T>(items: readonly T[], maximum: number): T[] {
  if (items.length <= maximum) return [...items];
  if (maximum <= 1) return [items[Math.floor(items.length / 2)]];

  return Array.from({ length: maximum }, (_, index) => (
    items[Math.round(index * (items.length - 1) / (maximum - 1))]
  ));
}

function layoutHalfCircle(
  layouts: readonly AnnotationLabelLayout[],
  minimumAngle: number,
  maximumAngle: number,
  labelDistance: number,
): AnnotationLabelLayout[] {
  if (layouts.length === 0) return [];

  const widestLabel = Math.max(...layouts.map(layout => layout.width));
  const tallestLabel = Math.max(...layouts.map(layout => layout.height));
  const angularSeparation = (Math.max(widestLabel, tallestLabel) + LABEL_GAP) / labelDistance;
  const halfSpan = (maximumAngle - minimumAngle) / 2;
  const boundaryPadding = Math.min(
    (widestLabel / 2 + LABEL_GAP) / labelDistance,
    halfSpan - 0.01,
  );
  const usableSpan = Math.max(0, maximumAngle - minimumAngle - boundaryPadding * 2);
  const capacity = Math.max(1, Math.floor(usableSpan / angularSeparation) + 1);
  const selected = selectEvenly(layouts, capacity);
  const lowerBound = minimumAngle + boundaryPadding;
  const upperBound = maximumAngle - boundaryPadding;

  selected[0].adjustedAngle = Math.max(lowerBound, selected[0].adjustedAngle);
  for (let index = 1; index < selected.length; index++) {
    selected[index].adjustedAngle = Math.max(
      selected[index].adjustedAngle,
      selected[index - 1].adjustedAngle + angularSeparation,
    );
  }

  if (selected[selected.length - 1].adjustedAngle > upperBound) {
    selected[selected.length - 1].adjustedAngle = upperBound;
    for (let index = selected.length - 2; index >= 0; index--) {
      selected[index].adjustedAngle = Math.min(
        selected[index].adjustedAngle,
        selected[index + 1].adjustedAngle - angularSeparation,
      );
    }
  }

  return selected;
}

export function annotationAngles(annotation: Annotation, referenceLength: number): AnnotationAngles {
  const start = Math.max(1, Math.min(annotation.start, referenceLength));
  const end = Math.max(1, Math.min(annotation.end, referenceLength));
  return {
    startAngle: positionToAngle(start, referenceLength),
    endAngle: positionToAngle(end, referenceLength),
  };
}

export function layoutAnnotationLabels(
  annotations: readonly Annotation[],
  referenceLength: number,
  centerX: number,
  centerY: number,
  labelDistance: number,
  fontSize: number,
): Map<string, AnnotationLabelLayout> {
  const layouts = annotations
    .filter(annotation => annotation.label.trim() !== '')
    .map((annotation): AnnotationLabelLayout => {
      const { startAngle, endAngle } = annotationAngles(annotation, referenceLength);
      const midAngle = (startAngle + endAngle) / 2;
      return {
        annotation,
        midAngle,
        adjustedAngle: midAngle,
        labelX: 0,
        labelY: 0,
        width: annotation.label.length * fontSize * 0.6 + 8,
        height: fontSize + 6,
      };
    });

  const right = layouts
    .filter(layout => Math.cos(layout.midAngle) >= 0)
    .map(layout => {
      const angle = normaliseAngle(layout.midAngle);
      layout.adjustedAngle = angle > Math.PI ? angle - TWO_PI : angle;
      return layout;
    })
    .sort((left, rightLayout) => left.adjustedAngle - rightLayout.adjustedAngle);
  const left = layouts
    .filter(layout => Math.cos(layout.midAngle) < 0)
    .map(layout => {
      layout.adjustedAngle = normaliseAngle(layout.midAngle);
      return layout;
    })
    .sort((left, rightLayout) => left.adjustedAngle - rightLayout.adjustedAngle);

  const placed = [
    ...layoutHalfCircle(right, -Math.PI / 2, Math.PI / 2, labelDistance),
    ...layoutHalfCircle(left, Math.PI / 2, Math.PI * 1.5, labelDistance),
  ];

  return new Map(placed.map(layout => {
    layout.labelX = centerX + labelDistance * Math.cos(layout.adjustedAngle);
    layout.labelY = centerY + labelDistance * Math.sin(layout.adjustedAngle);
    return [layout.annotation.id, layout];
  }));
}

export function calculateArrowGeometry(
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  isForward: boolean,
): ArrowGeometry {
  const angleSpan = endAngle - startAngle;
  const arrowHeadAngle = angleSpan < 0.05
    ? angleSpan
    : angleSpan < 0.15
      ? angleSpan * 0.6
      : Math.min(0.15, angleSpan * 0.15);
  const hasBody = angleSpan >= 0.05;
  const bodyStartAngle = isForward ? startAngle : startAngle + arrowHeadAngle;
  const bodyEndAngle = isForward ? endAngle - arrowHeadAngle : endAngle;
  const tipAngle = isForward ? endAngle : startAngle;
  const headBaseAngle = isForward ? bodyEndAngle : bodyStartAngle;
  const middleRadius = (innerRadius + outerRadius) / 2;

  return {
    bodyStartAngle,
    headBaseAngle,
    innerBaseX: centerX + innerRadius * Math.cos(headBaseAngle),
    innerBaseY: centerY + innerRadius * Math.sin(headBaseAngle),
    outerBaseX: centerX + outerRadius * Math.cos(headBaseAngle),
    outerBaseY: centerY + outerRadius * Math.sin(headBaseAngle),
    tipX: centerX + middleRadius * Math.cos(tipAngle),
    tipY: centerY + middleRadius * Math.sin(tipAngle),
    hasBody,
    isForward,
  };
}

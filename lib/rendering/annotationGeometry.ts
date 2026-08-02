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
        width: annotation.label.length * fontSize * 0.6,
        height: fontSize + 4,
      };
    })
    .sort((left, right) => left.midAngle - right.midAngle);

  for (let iteration = 0; iteration < 15; iteration++) {
    let hasOverlap = false;
    for (let i = 0; i < layouts.length; i++) {
      for (let j = i + 1; j < layouts.length; j++) {
        const current = layouts[i];
        const next = layouts[j];
        const averageWidth = (current.width + next.width) / 2;
        const averageHeight = (current.height + next.height) / 2;
        const minimumSeparation = (Math.max(averageWidth, averageHeight) + 10) / labelDistance;
        let angleDifference = Math.abs(next.adjustedAngle - current.adjustedAngle);
        if (angleDifference > Math.PI) angleDifference = 2 * Math.PI - angleDifference;

        if (angleDifference < minimumSeparation) {
          hasOverlap = true;
          const adjustment = minimumSeparation - angleDifference;
          const direction = next.adjustedAngle > current.adjustedAngle ? 1 : -1;
          current.adjustedAngle -= adjustment * 0.4 * direction;
          next.adjustedAngle += adjustment * 0.4 * direction;
        }
      }
    }
    if (!hasOverlap) break;
  }

  return new Map(layouts.map(layout => {
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

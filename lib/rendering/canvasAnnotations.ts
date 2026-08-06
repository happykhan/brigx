import type { Annotation } from '../types';
import type { PlotTooltip } from './types';
import {
  annotationAngles,
  calculateArrowGeometry,
  layoutAnnotationLabels,
  MAX_ANNOTATION_LABELS,
  type AnnotationLabelLayout,
} from './annotationGeometry';
import { drawAnnularArc, roundedRectPath } from './canvasPrimitives';

interface CanvasAnnotationOptions {
  context: CanvasRenderingContext2D;
  centerX: number;
  centerY: number;
  referenceLength: number;
  annotations: readonly Annotation[];
  innerRadius: number;
  outerRadius: number;
  showLabels: boolean;
  labelInward?: boolean;
  labelFontSize: number;
  addHitRegion: (
    startAngle: number,
    endAngle: number,
    tooltip: PlotTooltip,
  ) => void;
}

function drawArrow(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  color: string,
  isForward: boolean,
): void {
  const geometry = calculateArrowGeometry(
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    isForward,
  );

  context.save();
  context.globalAlpha = 0.7;
  context.beginPath();
  if (geometry.hasBody) {
    const bodyStartInnerX = centerX + innerRadius * Math.cos(geometry.bodyStartAngle);
    const bodyStartInnerY = centerY + innerRadius * Math.sin(geometry.bodyStartAngle);
    context.moveTo(bodyStartInnerX, bodyStartInnerY);
    context.arc(
      centerX,
      centerY,
      innerRadius,
      geometry.bodyStartAngle,
      geometry.headBaseAngle,
      !geometry.isForward,
    );
    context.lineTo(geometry.tipX, geometry.tipY);
    context.lineTo(geometry.outerBaseX, geometry.outerBaseY);
    context.arc(
      centerX,
      centerY,
      outerRadius,
      geometry.headBaseAngle,
      geometry.bodyStartAngle,
      geometry.isForward,
    );
  } else {
    context.moveTo(geometry.innerBaseX, geometry.innerBaseY);
    context.lineTo(geometry.tipX, geometry.tipY);
    context.lineTo(geometry.outerBaseX, geometry.outerBaseY);
  }
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = '#000';
  context.lineWidth = 0.5;
  context.stroke();
  context.restore();
}

function drawLabel(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  layout: AnnotationLabelLayout,
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

  context.save();
  context.globalAlpha = 0.6;
  context.strokeStyle = '#333';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(featureX, featureY);
  context.lineTo(elbowX, elbowY);
  context.lineTo(layout.labelX, layout.labelY);
  context.stroke();
  context.restore();

  context.save();
  context.globalAlpha = 0.9;
  context.fillStyle = '#fff';
  context.strokeStyle = '#333';
  context.lineWidth = 1;
  roundedRectPath(
    context,
    layout.labelX - layout.width / 2,
    layout.labelY - layout.height / 2,
    layout.width,
    layout.height,
    3,
  );
  context.fill();
  context.stroke();
  context.restore();

  context.save();
  context.font = `bold ${fontSize}px sans-serif`;
  context.fillStyle = '#000';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(layout.annotation.label, layout.labelX, layout.labelY);
  context.restore();
}

export function drawCanvasAnnotations(options: CanvasAnnotationOptions): void {
  const {
    context,
    centerX,
    centerY,
    referenceLength,
    annotations,
    innerRadius,
    outerRadius,
    labelFontSize,
    addHitRegion,
  } = options;
  if (annotations.length === 0) return;

  const showLabels = options.showLabels && annotations.length <= MAX_ANNOTATION_LABELS;
  const labelDistance = options.labelInward ? Math.max(20, innerRadius - 30) : outerRadius + 30;
  const labelLayouts = showLabels
    ? layoutAnnotationLabels(annotations, referenceLength, centerX, centerY, labelDistance, labelFontSize)
    : new Map<string, AnnotationLabelLayout>();

  for (const annotation of annotations) {
    const { startAngle, endAngle } = annotationAngles(annotation, referenceLength);
    const color = annotation.color || '#666666';
    const labelLayout = labelLayouts.get(annotation.id);

    if (annotation.shape === 'block') {
      drawAnnularArc(
        context,
        centerX,
        centerY,
        innerRadius,
        outerRadius,
        startAngle,
        endAngle,
        color,
        0.7,
        '#000',
      );
    } else if (annotation.shape === 'arrow-forward' || annotation.shape === 'arrow-reverse') {
      drawArrow(
        context,
        centerX,
        centerY,
        innerRadius,
        outerRadius,
        startAngle,
        endAngle,
        color,
        annotation.shape === 'arrow-forward',
      );
    } else {
      continue;
    }

    addHitRegion(startAngle, endAngle, {
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

    if (showLabels && labelLayout) {
      drawLabel(
        context,
        centerX,
        centerY,
        innerRadius,
        outerRadius,
        startAngle,
        endAngle,
        labelLayout,
        labelFontSize,
      );
    }
  }
}

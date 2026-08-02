export function drawCircle(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  strokeColor: string,
  lineWidth: number,
  dash?: number[],
): void {
  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.strokeStyle = strokeColor;
  context.lineWidth = lineWidth;
  if (dash) context.setLineDash(dash);
  context.stroke();
  context.restore();
}

export function drawAnnularArc(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  fillStyle: string,
  opacity = 1,
  strokeStyle?: string,
  strokeWidth = 0.5,
): void {
  context.save();
  context.globalAlpha = opacity;
  context.beginPath();
  context.arc(centerX, centerY, outerRadius, startAngle, endAngle);
  context.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
  context.closePath();
  context.fillStyle = fillStyle;
  context.fill();
  if (strokeStyle) {
    context.strokeStyle = strokeStyle;
    context.lineWidth = strokeWidth;
    context.stroke();
  }
  context.restore();
}

export function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

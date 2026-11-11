import type { Line, Point } from './types'

/** Live MTS rendering uses the same midpoint quadratics and sampling bounds. */
export const CURVE_TOLERANCE = 0.25
export const WIDTH_STEP = 0.5
export const MAX_CURVE_STEPS = 64

export interface StrokePoint {
  x: number
  y: number
  width: number
}
export interface StrokeCurve {
  from: StrokePoint
  control: StrokePoint
  to: StrokePoint
}
export interface StrokeSegment {
  from: StrokePoint
  to: StrokePoint
  width: number
}

function strokePoint(point: Point, line: Line): StrokePoint {
  return { x: point.x, y: point.y, width: line.isPressure ? point.lineWidth || line.width : line.width }
}
function midpoint(a: StrokePoint, b: StrokePoint): StrokePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, width: (a.width + b.width) / 2 }
}

/** One new stable curve per input point; the unfinished half is a separate tip. */
export function getStrokeCurve(line: Line, index: number): StrokeCurve {
  const previous = strokePoint(line.points[index - 1], line)
  const current = strokePoint(line.points[index], line)
  return {
    from: index === 1 ? previous : midpoint(strokePoint(line.points[index - 2], line), previous),
    control: previous,
    to: midpoint(previous, current)
  }
}

export function getStrokeTipCurve(line: Line): StrokeCurve | undefined {
  if (line.points.length < 2) return undefined
  const last = strokePoint(line.points[line.points.length - 1], line)
  return { from: getStrokeCurve(line, line.points.length - 1).to, control: last, to: last }
}

export function getStrokeCurves(line: Line): StrokeCurve[] {
  if (line.points.length < 2) return []
  const curves = line.points.slice(1).map((_, index) => getStrokeCurve(line, index + 1))
  const last = strokePoint(line.points[line.points.length - 1], line)
  curves.push({ from: curves[curves.length - 1].to, control: last, to: last })
  return curves
}

/** Subpixel chord error, smooth width changes, and no needless subdivision of straight lines. */
export function getCurveSteps(curve: StrokeCurve): number {
  const { from, control, to } = curve
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy
  const projection = (control.x - from.x) * dx + (control.y - from.y) * dy
  const cross = (control.x - from.x) * dy - (control.y - from.y) * dx
  const straight = lengthSquared > 0 && Math.abs(cross) < 0.000001 && projection >= 0 && projection <= lengthSquared
  const acceleration = Math.hypot(from.x - 2 * control.x + to.x, from.y - 2 * control.y + to.y)
  const shapeSteps = straight ? 1 : Math.ceil(Math.sqrt(acceleration / (4 * CURVE_TOLERANCE)))
  const widthSteps = Math.ceil((Math.abs(control.width - from.width) + Math.abs(to.width - control.width)) / WIDTH_STEP)
  return Math.min(MAX_CURVE_STEPS, Math.max(1, shapeSteps, widthSteps))
}

export function sampleCurve(curve: StrokeCurve): StrokeSegment[] {
  const { from, control, to } = curve
  const steps = getCurveSteps(curve)
  const segments: StrokeSegment[] = []
  let previous = from
  for (let index = 1; index <= steps; index++) {
    const t = index / steps
    const inverse = 1 - t
    const point = {
      x: inverse * inverse * from.x + 2 * inverse * t * control.x + t * t * to.x,
      y: inverse * inverse * from.y + 2 * inverse * t * control.y + t * t * to.y,
      width: inverse * inverse * from.width + 2 * inverse * t * control.width + t * t * to.width
    }
    segments.push({ from: previous, to: point, width: (previous.width + point.width) / 2 })
    previous = point
  }
  return segments
}

export function getStrokeSegments(line: Line): StrokeSegment[] {
  if (!line.points.length) return []
  if (line.points.length === 1) {
    const point = strokePoint(line.points[0], line)
    return [{ from: point, to: point, width: point.width }]
  }
  return getStrokeCurves(line).flatMap(sampleCurve)
}

export function segmentStyle(segment: StrokeSegment, color: string): Record<string, string> {
  const { from, to, width } = segment
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  // A CSS capsule's caps are inside its box. Extend by the full pen width so
  // their centres, not their outer tips, meet the sampled curve endpoints.
  const length = distance + width
  return {
    position: 'absolute',
    left: `${(from.x + to.x - length) / 2}px`,
    top: `${(from.y + to.y - width) / 2}px`,
    width: `${length}px`,
    height: `${width}px`,
    'border-radius': `${width / 2}px`,
    'background-color': color,
    transform: `rotate(${Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI}deg)`,
    'pointer-events': 'none'
  }
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Export a real quadratic path, not the original touch-point polyline. */
export function strokeSvg(line: Line): string {
  if (!line.points.length) return ''
  const color = escapeAttribute(line.color)
  if (line.points.length === 1) {
    const point = strokePoint(line.points[0], line)
    return `<circle cx="${point.x}" cy="${point.y}" r="${point.width / 2}" fill="${color}"/>`
  }
  if (line.isPressure) {
    return getStrokeSegments(line).map(({ from, to, width }) =>
      `<path d="M ${from.x} ${from.y} L ${to.x} ${to.y}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`
    ).join('')
  }
  const start = line.points[0]
  const path = `M ${start.x} ${start.y} ` + getStrokeCurves(line).map(({ control, to }) =>
    `Q ${control.x} ${control.y} ${to.x} ${to.y}`
  ).join(' ')
  return `<path d="${path}" fill="none" stroke="${color}" stroke-width="${line.width}" stroke-linecap="round" stroke-linejoin="round"/>`
}

/** Support both the existing host facade and a standard CanvasRenderingContext2D. */
export function setCanvasProperty(ctx: any, setter: string, property: string, value: string | number): void {
  if (typeof ctx[setter] === 'function') ctx[setter](value)
  else ctx[property] = value
}

export function paintStroke(ctx: any, line: Line): void {
  if (!line.points.length) return
  setCanvasProperty(ctx, 'setStrokeStyle', 'strokeStyle', line.color)
  setCanvasProperty(ctx, 'setLineWidth', 'lineWidth', line.width)
  if (line.points.length === 1) {
    const point = strokePoint(line.points[0], line)
    ctx.beginPath()
    if (typeof ctx.arc === 'function' && typeof ctx.fill === 'function') {
      setCanvasProperty(ctx, 'setFillStyle', 'fillStyle', line.color)
      ctx.arc(point.x, point.y, point.width / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.moveTo(point.x, point.y)
      ctx.lineTo(point.x + 0.001, point.y)
      ctx.stroke()
    }
    return
  }
  if (line.isPressure) {
    getStrokeSegments(line).forEach(({ from, to, width }) => {
      setCanvasProperty(ctx, 'setLineWidth', 'lineWidth', width)
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    })
    return
  }
  ctx.beginPath()
  ctx.moveTo(line.points[0].x, line.points[0].y)
  getStrokeCurves(line).forEach(curve => {
    if (typeof ctx.quadraticCurveTo === 'function') {
      ctx.quadraticCurveTo(curve.control.x, curve.control.y, curve.to.x, curve.to.y)
    } else {
      sampleCurve(curve).forEach(({ to }) => ctx.lineTo(to.x, to.y))
    }
  })
  ctx.stroke()
}

export function svgAttribute(value: string): string {
  return escapeAttribute(value)
}

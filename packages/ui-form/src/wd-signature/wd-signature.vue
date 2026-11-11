/*
 * wd-signature — 连续手写签名
 *
 * Lynx 没有内置 Canvas 2D 元素。跟手使用声明式 MTS，将中点二次贝塞尔
 * 自适应细分成完整圆头的原生 view 笔迹；已提交笔迹也使用相同的原生绘制面，
 * 不在松手时切换到 Web 的异步 SVG 图片，因此不依赖图片解码来保留签名。
 * SVG / 可选宿主 Canvas 2D 仅负责导出，并复用同一曲线与压感采样。
 *
 * MT move 与父容器 BG move 分工保留；局部 consume-slide-event / touch-action
 * 仲裁滚动。度量只在挂载、布局、尺寸变化和起笔执行，move 只读每笔几何缓存。
 * 当前池由 MTS 持有，提交的原生层 layoutchange 以 stroke key 确认接棒，
 * 旧笔的确认不能清掉新笔。清空 / 历史操作以版本失效旧度量和主线程笔迹。
 * 超过池容量的长笔持续更新后台原生曲线层，不会停止绘制或截断导出。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, useMainThreadRef, watch, withModifiers } from 'vue-lynx'
import WdButton from '@wot-lynx/primitives/wd-button'
import { signatureProps, type SignatureEmits, type SignatureExpose, type Point, type Line } from './types'
import { getCurveSteps, getStrokeCurve, getStrokeTipCurve, sampleCurve, getStrokeSegments, segmentStyle, strokeSvg, svgAttribute, paintStroke, setCanvasProperty } from './stroke'
import { useTranslate } from '@wot-lynx/core/composables/useTranslate'
import { useAlive } from '@wot-lynx/core/composables/useAlive'
import { getPlatform } from '@wot-lynx/core/common/platform'
import { createCanvasContext, canvasToTempFilePath } from '@wot-lynx/core/common/canvasHelper'
import { getRect, uuid, isDef, addUnit, parseStyle } from '@wot-lynx/core/common/util'
import { createStyleResolver } from '@wot-lynx/core/common/style'

const props = defineProps(signatureProps)
const emit = defineEmits<SignatureEmits>()
const { translate } = useTranslate('signature')
const isAlive = useAlive()
const { proxy } = getCurrentInstance() as any
const POOL_SIZE = 512
const TIP_SIZE = 64
const CURVE_TOLERANCE = 0.25
const WIDTH_STEP = 0.5
const MAX_CURVE_STEPS = 64
let disposed = false
let strokeRequest = 0
const strokeSerial = ref(0)
let measureRequest = 0
let exportRequest = 0
let exporting = false
const drawVersion = ref(0)
const canvasId = `wd-signature-${uuid()}`
const canvasWidth = ref(300)
const canvasHeight = ref(200)
const canvasOffset = ref({ left: 0, top: 0 })
const canvasInited = ref(false)
const drawing = ref(false)

interface StrokeLine extends Line {
  key: number
  request: number
  version: string
  offset: { left: number; top: number }
  ready: boolean
  pending: boolean
  materialized: boolean
  fallback: boolean
  sampleCount: number
  minWidth: number
  maxWidth: number
  minSpeed: number
}
const lines = ref<StrokeLine[]>([])
const redoLines = ref<StrokeLine[]>([])
const currentLine = ref<StrokeLine>()
const currentStep = ref(0)
const strokeMeasurements = new WeakMap<StrokeLine, Promise<void>>()

const resolveCanvasStyle = createStyleResolver({ width: '', height: '', 'background-color': '', 'touch-action': 'auto' })
const canvasStyle = computed(() => resolveCanvasStyle({
  width: isDef(props.width) ? addUnit(props.width) : '',
  height: isDef(props.height) ? addUnit(props.height) : '',
  'background-color': props.backgroundColor || '',
  'touch-action': props.disableScroll && !props.disabled ? 'none' : 'auto'
}, parseStyle(props.customStyle)))
const rootStyle = computed(() => parseStyle(props.customStyle))
const consumeSlideEvent = computed(() => props.disableScroll && !props.disabled ? [[-180, 180]] : [])
const enableHistory = computed(() => props.enableHistory)
const reservedSamples = computed(() => lines.value.reduce((count, line) => {
  if (line.materialized || line.version !== String(drawVersion.value)) return count
  const tip = getStrokeTipCurve(line)
  return count + line.sampleCount + (tip ? getCurveSteps(tip) : 1)
}, 0))
// Reserve up to TIP_SIZE slots to seal an unmaterialised stroke before the next
// start. Latch the request even while geometry is pending, but never render it
// in page coordinates or switch it off halfway through a stroke.
const wantsFallback = computed(() => !!currentLine.value && currentLine.value.sampleCount >= Math.max(0, POOL_SIZE - TIP_SIZE - reservedSamples.value))
watch(wantsFallback, wanted => { if (wanted && currentLine.value) currentLine.value.fallback = true }, { flush: 'sync' })
const useFallback = computed(() => !!currentLine.value && currentLine.value.fallback && currentLine.value.ready && !currentLine.value.pending)

/** Current points are not a render dependency until the bounded MTS pool fills. */
const emptyFallbackCache = () => ({ line: undefined as StrokeLine | undefined, points: undefined as Point[] | undefined, count: 0, styles: [] as Record<string, string>[] })
let fallbackCache = emptyFallbackCache()
const fallbackSegments = computed(() => {
  const line = currentLine.value
  if (!useFallback.value || !line) return []
  if (fallbackCache.line !== line || fallbackCache.points !== line.points) {
    fallbackCache = { ...emptyFallbackCache(), line, points: line.points }
  }
  for (let index = fallbackCache.count + 1; index < line.points.length; index++) {
    fallbackCache.styles.push(...sampleCurve(getStrokeCurve(line, index)).map(segment => segmentStyle(segment, line.color)))
  }
  fallbackCache.count = line.points.length - 1
  const tip = getStrokeTipCurve(line)
  return tip ? [...fallbackCache.styles, ...sampleCurve(tip).map(segment => segmentStyle(segment, line.color))]
    : getStrokeSegments(line).map(segment => segmentStyle(segment, line.color))
})
const fallbackLines = computed(() => useFallback.value && currentLine.value ? [{ line: currentLine.value, segments: fallbackSegments.value }] : [])
function markMaterialized(line: StrokeLine) {
  void nextTick().then(() => {
    if (!disposed && isAlive() && ownsStroke(line)) line.materialized = true
  })
}
const renderedLines = computed(() => lines.value.filter(line => line.ready && !line.pending).map(line => ({
  line,
  segments: getStrokeSegments(line).map(segment => segmentStyle(segment, line.color))
})))

/** Stable while MTS owns the pool; explicit cancellation alone replaces it. */
const segmentResetStyle = ref<Record<string, string>>({ position: 'absolute', left: '0px', top: '0px', width: '0px', height: '0px', 'pointer-events': 'none' })
function resetSegmentPool() {
  segmentResetStyle.value = { position: 'absolute', left: '0px', top: '0px', width: '0px', height: '0px', 'pointer-events': 'none' }
}

function eventTime(event: any, previous?: number): number {
  const raw = event?.timestamp ?? event?.timeStamp
  return raw != null && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : previous == null ? 0 : previous + 16
}
function touchPoint(event: any, terminal = false): any | undefined {
  const touch = terminal ? event?.changedTouches?.[0] || event?.touches?.[0] : event?.touches?.[0]
  return touch && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY) ? touch : undefined
}
function validRect(rect: any): boolean {
  return Number.isFinite(Number(rect?.left)) && Number.isFinite(Number(rect?.top)) &&
    Number(rect?.width) > 0 && Number.isFinite(Number(rect.width)) && Number(rect?.height) > 0 && Number.isFinite(Number(rect.height))
}
function applyCanvasRect(rect: any) {
  if (!validRect(rect)) return
  canvasOffset.value = { left: Number(rect.left), top: Number(rect.top) }
  canvasWidth.value = Number(rect.width)
  canvasHeight.value = Number(rect.height)
  canvasInited.value = true
}
function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}
function calculateLineWidth(speed: number, line: StrokeLine): number {
  const limitedSpeed = Math.min(line.minSpeed * 10, Math.max(line.minSpeed, speed))
  const addWidth = ((line.maxWidth - line.minWidth) * (limitedSpeed - line.minSpeed)) / line.minSpeed
  return Math.min(line.maxWidth, Math.max(line.minWidth, line.maxWidth - addWidth))
}

/** Rebase this stroke, even after a quick end; never revive it or touch another stroke. */
function ownsStroke(line: StrokeLine): boolean {
  return (currentLine.value === line && line.version === String(drawVersion.value)) || lines.value.includes(line) || redoLines.value.includes(line)
}
function measureStroke(line: StrokeLine) {
  const request = line.request
  const measurement = nextTick().then(() => {
    if (disposed || !isAlive() || !ownsStroke(line)) return undefined
    return getRect(`#${canvasId}`)
  }).then(rect => {
    if (disposed || !isAlive() || !ownsStroke(line)) return
    if (validRect(rect)) {
      const offset = { left: Number(rect.left), top: Number(rect.top) }
      const dx = line.offset.left - offset.left
      const dy = line.offset.top - offset.top
      // Replacing the array invalidates this stroke's memo, not every old stroke.
      line.points = line.points.map(point => ({ ...point, x: point.x + dx, y: point.y + dy }))
      line.offset = offset
      line.ready = true
      if (request === strokeRequest) applyCanvasRect(rect)
    }
    line.pending = false
  })
  strokeMeasurements.set(line, measurement)
}

const startDrawing = (event: any) => {
  const touch = touchPoint(event)
  if (disposed || !isAlive() || props.disabled || event?.touches?.length !== 1 || !touch) return
  if (drawing.value) stopDrawing({ touches: [], changedTouches: [] })
  exportRequest++; exporting = false
  const minWidth = positive(props.minWidth, 2)
  const maxWidth = Math.max(minWidth, positive(props.maxWidth, 6))
  const width = props.pressure ? (minWidth + maxWidth) / 2 : positive(props.lineWidth, 3)
  const offset = { ...canvasOffset.value }
  currentLine.value = {
    key: ++strokeSerial.value, request: ++strokeRequest, version: String(drawVersion.value), offset,
    ready: canvasInited.value, pending: true, materialized: false, fallback: false, sampleCount: 0,
    minWidth, maxWidth, minSpeed: positive(props.minSpeed, 1.5),
    points: [{ x: touch.clientX - offset.left, y: touch.clientY - offset.top, t: eventTime(event), lineWidth: width }],
    color: props.penColor, width, backgroundColor: props.backgroundColor, isPressure: props.pressure
  }
  drawing.value = true
  redoLines.value = []
  measureStroke(currentLine.value)
  emit('start', event)
}

function appendPoint(event: any, terminal = false): boolean {
  const line = currentLine.value
  const touch = touchPoint(event, terminal)
  if (!line || !touch) return false
  const previous = line.points[line.points.length - 1]
  const x = touch.clientX - line.offset.left
  const y = touch.clientY - line.offset.top
  const t = eventTime(event, previous.t)
  // Same timestamp is not the same point. Batched/coalesced movement is retained.
  if (t < previous.t || (previous.x === x && previous.y === y)) return false
  const distance = Math.hypot(x - previous.x, y - previous.y)
  const speed = distance / Math.max(1, t - previous.t)
  const point: Point = { x, y, t, distance, speed, lineWidth: line.width }
  if (line.isPressure) {
    const previousWidth = previous.lineWidth || line.width
    point.lineWidth = Math.min(previousWidth * 1.2, Math.max(previousWidth * 0.8, calculateLineWidth(speed, line)))
  }
  line.points.push(point)
  line.sampleCount += getCurveSteps(getStrokeCurve(line, line.points.length - 1))
  return true
}
const stopDrawing = (event: any) => {
  if (!drawing.value) return
  appendPoint(event, true)
  drawing.value = false
  const line = currentLine.value
  if (line) {
    line.points = line.points.map(point => ({ ...point }))
    lines.value.push(line)
    currentStep.value = lines.value.length
  }
  currentLine.value = undefined
  fallbackCache = emptyFallbackCache()
  // Do not zero MTS ink here: the matching native stroke acknowledges handoff.
  emit('end', event)
}
const draw = (event: any) => {
  if (!drawing.value || props.disabled || !currentLine.value) return
  if (event?.touches?.length > 1) { stopDrawing({ ...event, touches: [], changedTouches: [] }); return }
  if (appendPoint(event)) emit('signing', event)
}
const lockedDraw = withModifiers(draw, ['stop'])
const onDrawMoveBg = computed(() => props.disableScroll && !props.disabled ? lockedDraw : draw)

function measureCanvas() {
  const request = ++measureRequest
  void nextTick().then(() => {
    if (disposed || !isAlive() || request !== measureRequest) return undefined
    return getRect(`#${canvasId}`)
  }).then(rect => {
    if (disposed || !isAlive() || request !== measureRequest) return
    // Failed/zero queries must not erase a known offset or mark init successful.
    applyCanvasRect(rect)
  })
}
const init = (forceUpdate = false) => {
  if (!forceUpdate && canvasInited.value) return
  measureCanvas()
}
function onCanvasLayoutChange(event: any) {
  const rect = event?.detail?.layout ?? event?.detail
  if (!rect || disposed) return
  const width = Number(rect.width), height = Number(rect.height)
  if (width > 0 && height > 0 && (width !== canvasWidth.value || height !== canvasHeight.value)) measureCanvas()
}
function cancelDrawing() {
  strokeRequest++; exportRequest++; exporting = false; drawVersion.value++
  drawing.value = false
  currentLine.value = undefined
  fallbackCache = emptyFallbackCache()
  resetSegmentPool()
}
const clear = () => {
  cancelDrawing()
  lines.value = []
  redoLines.value = []
  currentStep.value = 0
  emit('clear')
}
const revoke = () => {
  cancelDrawing()
  const step = Math.min(Math.max(1, Math.floor(props.step) || 1), lines.value.length)
  if (step) redoLines.value.push(...lines.value.splice(lines.value.length - step))
  currentStep.value = lines.value.length
}
const restore = () => {
  cancelDrawing()
  const step = Math.min(Math.max(1, Math.floor(props.step) || 1), redoLines.value.length)
  if (step) lines.value.push(...redoLines.value.splice(redoLines.value.length - step))
  currentStep.value = lines.value.length
}

function isTransparentColor(color?: string): boolean {
  if (!color) return true
  const value = color.trim().toLowerCase()
  if (['transparent', '#0000', '#00000000'].includes(value)) return true
  if (/^#[\da-f]{4}$/.test(value)) return value.endsWith('0')
  if (/^#[\da-f]{8}$/.test(value)) return value.endsWith('00')
  const alpha = /^(?:rgba|hsla)\([^)]*,\s*([\d.]+)\s*\)$/.exec(value)
  return !!alpha && Number(alpha[1]) === 0
}
function buildSvgMarkup(strokeLines: Line[], scale = 1): string {
  const background = isTransparentColor(props.backgroundColor) ? ''
    : `<rect width="${canvasWidth.value}" height="${canvasHeight.value}" fill="${svgAttribute(props.backgroundColor!)}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth.value} ${canvasHeight.value}" width="${canvasWidth.value * scale}" height="${canvasHeight.value * scale}">${background}${strokeLines.map(strokeSvg).join('')}</svg>`
}
function exportSignature(request: number, strokeLines: StrokeLine[]) {
  if (disposed || !isAlive() || request !== exportRequest) return
  const width = canvasWidth.value, height = canvasHeight.value
  const base = { width: width * props.exportScale, height: height * props.exportScale }
  if (strokeLines.some(line => !line.ready || line.pending)) {
    exporting = false
    emit('confirm', { ...base, tempFilePath: '', success: false })
    return
  }
  const snapshot = strokeLines.map(line => ({ ...line, points: line.points.map(point => ({ ...point })) }))
  if (!getPlatform().capabilities.canvas2d) {
    exporting = false
    emit('confirm', { ...base, tempFilePath: 'data:image/svg+xml;utf8,' + encodeURIComponent(buildSvgMarkup(snapshot, props.exportScale)), success: true })
    return
  }
  exporting = true
  const valid = () => !disposed && isAlive() && request === exportRequest
  const fail = () => {
    if (!valid()) return
    exporting = false
    emit('confirm', { ...base, tempFilePath: '', success: false })
  }
  try {
    const ctx = createCanvasContext(canvasId, proxy)
    ctx.clearRect(0, 0, width, height)
    if (!isTransparentColor(props.backgroundColor)) {
      setCanvasProperty(ctx, 'setFillStyle', 'fillStyle', props.backgroundColor!)
      ctx.fillRect(0, 0, width, height)
    }
    setCanvasProperty(ctx, 'setLineJoin', 'lineJoin', 'round')
    setCanvasProperty(ctx, 'setLineCap', 'lineCap', 'round')
    snapshot.forEach(line => paintStroke(ctx, line))
    const exportImage = () => {
      if (!valid()) return
      canvasToTempFilePath({
        canvasId, width, height, destWidth: base.width, destHeight: base.height,
        fileType: props.fileType, quality: props.quality,
        success: (result: any) => {
          if (!valid()) return
          const tempFilePath = result.tempFilePath || result.filePath
          if (!tempFilePath) { fail(); return }
          exporting = false
          emit('confirm', { ...base, tempFilePath, success: true })
        }, fail
      }, proxy)
    }
    if (typeof ctx.draw === 'function') ctx.draw(false, exportImage)
    else exportImage()
  } catch { fail() }
}

const confirmSignature = () => {
  if (disposed || !isAlive() || exporting) return
  const request = ++exportRequest
  exporting = true
  const snapshot = lines.value.slice()
  const pending = snapshot.filter(line => line.pending).map(line => strokeMeasurements.get(line)).filter(Boolean)
  if (pending.length) void Promise.all(pending).then(() => exportSignature(request, snapshot))
  else exportSignature(request, snapshot)
}

onMounted(() => init())
watch([() => props.width, () => props.height], () => { exportRequest++; exporting = false; measureCanvas() })
watch(() => props.disabled, disabled => { if (disabled) cancelDrawing() }, { flush: 'sync' })
watch([() => props.fileType, () => props.quality, () => props.exportScale], () => { exportRequest++; exporting = false }, { flush: 'sync' })
onBeforeUnmount(() => { disposed = true; strokeRequest++; measureRequest++; exportRequest++ })
defineExpose<SignatureExpose>({ init, clear, confirm: confirmSignature, restore, revoke })

// ---------- 声明式主线程绘制 ----------
interface MtElement {
  setStyleProperty(name: string, value: string): void
  setStyleProperties?(style: Record<string, string>): void
  getAttribute(name: string): string | null
  invoke(method: string, params?: any): Promise<any>
}
interface MtPoint { x: number; y: number; width: number; t: number }
interface DrawState {
  key: number
  version: string | null
  active: boolean
  ready: boolean
  painted: boolean
  hiddenForFallback: boolean
  offset: { left: number; top: number }
  last: MtPoint
  boundary: MtPoint
  index: number
  slots: number[]
  poolReleased: boolean
  tipOwned: boolean
  sealed: boolean
  tipCount: number
  pending: Array<{ x: number; y: number; t: number }>
  write(x: number, y: number, t: number): void
  hide(): void
  seal(): boolean
}
interface InkBank { version: string | null; strokes: DrawState[]; free: number[] }
const canvasRef = useMainThreadRef<MtElement | null>(null)
const segmentRefs = Array.from({ length: POOL_SIZE }, () => useMainThreadRef<MtElement | null>(null))
const tipRefs = Array.from({ length: TIP_SIZE }, () => useMainThreadRef<MtElement | null>(null))
const geomRef = useMainThreadRef<{ left: number; top: number; width: number; height: number } | null>(null)
const serialRef = useMainThreadRef(0)
const drawRef = useMainThreadRef<DrawState | null>(null)
const inkRef = useMainThreadRef<InkBank | null>(null)

const onDrawStartMt = (event: any) => {
  'main thread'
  const canvas = canvasRef.current
  const touch = event.touches && event.touches[0]
  if (!canvas || canvas.getAttribute('gesture-disabled') === 'true' || !touch || event.touches.length !== 1 ||
    !Number.isFinite(touch.clientX) || !Number.isFinite(touch.clientY)) return
  const version = canvas.getAttribute('gesture-version')
  let bank = inkRef.current
  if (!bank || bank.version !== version) {
    if (bank) bank.strokes.forEach(stroke => stroke.hide())
    bank = { version, strokes: [], free: Array.from({ length: POOL_SIZE }, (_, index) => POOL_SIZE - 1 - index) }
    inkRef.current = bank
    // External cancellation may have rejected a start on only one thread.
    // Reconcile with the next background physical stroke at this boundary.
    serialRef.current = Math.max(0, (Number(canvas.getAttribute('gesture-next-stroke')) || 1) - 1)
  }
  const ink = bank
  const previous = drawRef.current
  if (previous && previous.version === version && !previous.poolReleased) {
    previous.active = false
    if (!previous.ready || previous.painted) previous.hide()
    else previous.seal()
  }
  ink.strokes = ink.strokes.filter(stroke => !stroke.poolReleased)
  const tipAvailable = !ink.strokes.some(stroke => stroke.tipOwned)
  const pressure = canvas.getAttribute('gesture-pressure') === 'true'
  const positive = (value: number, fallback: number) => Number.isFinite(value) && value > 0 ? value : fallback
  const cfgWidth = positive(Number(canvas.getAttribute('gesture-line-width')), 3)
  const minWidth = positive(Number(canvas.getAttribute('gesture-min-width')), 2)
  const maxWidth = Math.max(minWidth, positive(Number(canvas.getAttribute('gesture-max-width')), 6))
  const minSpeed = positive(Number(canvas.getAttribute('gesture-min-speed')), 1.5)
  const color = canvas.getAttribute('gesture-pen-color') || '#000'
  const width = pressure ? (minWidth + maxWidth) / 2 : cfgWidth
  const rawTime = event.timestamp ?? event.timeStamp
  const startTime = rawTime != null && rawTime !== '' && Number.isFinite(Number(rawTime)) ? Number(rawTime) : 0
  const key = (serialRef.current || 0) + 1
  serialRef.current = key
  const start = { x: touch.clientX, y: touch.clientY, width, t: startTime }
  const state: DrawState = {
    key, version, active: true, ready: false, painted: false,
    hiddenForFallback: false, offset: { left: 0, top: 0 }, last: start, boundary: start,
    index: 0, slots: [], poolReleased: false, tipOwned: tipAvailable, sealed: false,
    tipCount: 0, pending: [], write: () => {}, hide: () => {}, seal: () => true
  }
  drawRef.current = state
  ink.strokes.push(state)
  const hideElement = (element: MtElement | null) => {
    if (!element) return
    element.setStyleProperty('width', '0px')
    element.setStyleProperty('height', '0px')
  }
  const hide = () => {
    if (!state.poolReleased) {
      state.slots.forEach(index => { hideElement(segmentRefs[index].current); ink.free.push(index) })
      state.slots = []
      state.poolReleased = true
    }
    if (state.tipOwned) {
      for (let index = 0; index < state.tipCount; index++) hideElement(tipRefs[index].current)
      state.tipCount = 0
      state.tipOwned = false
    }
  }
  state.hide = hide
  const capsule = (element: MtElement | null, from: MtPoint, to: MtPoint, penWidth: number) => {
    if (!element) return
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const length = distance + penWidth
    const style = {
      left: `${(from.x + to.x - length) / 2}px`, top: `${(from.y + to.y - penWidth) / 2}px`,
      width: `${length}px`, height: `${penWidth}px`, 'border-radius': `${penWidth / 2}px`,
      'background-color': color, transform: `rotate(${Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI}deg)`
    }
    if (typeof element.setStyleProperties === 'function') element.setStyleProperties(style)
    else Object.keys(style).forEach(name => element.setStyleProperty(name, style[name as keyof typeof style]))
  }
  // Inlined in the entry worklet: no worklet-to-worklet capture / TDZ.
  const sample = (from: MtPoint, control: MtPoint, to: MtPoint, tip: boolean, sealing = false) => {
    const dx = to.x - from.x, dy = to.y - from.y
    const lengthSquared = dx * dx + dy * dy
    const projection = (control.x - from.x) * dx + (control.y - from.y) * dy
    const cross = (control.x - from.x) * dy - (control.y - from.y) * dx
    const straight = lengthSquared > 0 && Math.abs(cross) < 0.000001 && projection >= 0 && projection <= lengthSquared
    const acceleration = Math.hypot(from.x - 2 * control.x + to.x, from.y - 2 * control.y + to.y)
    const shapeSteps = straight ? 1 : Math.ceil(Math.sqrt(acceleration / (4 * CURVE_TOLERANCE)))
    const widthSteps = Math.ceil((Math.abs(control.width - from.width) + Math.abs(to.width - control.width)) / WIDTH_STEP)
    const steps = Math.min(MAX_CURVE_STEPS, Math.max(1, shapeSteps, widthSteps))
    let previous = from
    const fallback = state.hiddenForFallback || state.poolReleased
    if (sealing && ink.free.length < steps) return false
    for (let index = 1; index <= steps; index++) {
      const t = index / steps, inverse = 1 - t
      const point = {
        x: inverse * inverse * from.x + 2 * inverse * t * control.x + t * t * to.x,
        y: inverse * inverse * from.y + 2 * inverse * t * control.y + t * t * to.y,
        width: inverse * inverse * from.width + 2 * inverse * t * control.width + t * t * to.width,
        t: to.t
      }
      if (!fallback) {
        if (tip && state.tipOwned) capsule(tipRefs[index - 1].current, previous, point, (previous.width + point.width) / 2)
        else if (!tip && (sealing || ink.free.length > TIP_SIZE)) {
          const slot = ink.free.pop()
          if (slot !== undefined) {
            state.slots.push(slot)
            capsule(segmentRefs[slot].current, previous, point, (previous.width + point.width) / 2)
          }
        }
      }
      previous = point
    }
    if (tip) {
      if (state.tipOwned) for (let index = steps; index < state.tipCount; index++) hideElement(tipRefs[index].current)
      state.tipCount = fallback || !state.tipOwned ? 0 : steps
    } else state.index += steps
    return true
  }
  state.seal = () => {
    if (state.sealed || state.poolReleased || state.hiddenForFallback || !state.tipOwned) return true
    if (!sample(state.boundary, state.last, state.last, false, true)) return false
    for (let index = 0; index < state.tipCount; index++) hideElement(tipRefs[index].current)
    state.tipCount = 0
    state.tipOwned = false
    state.sealed = true
    return true
  }
  const write = (x: number, y: number, time: number) => {
    if (state.version !== canvas.getAttribute('gesture-version') || canvas.getAttribute('gesture-disabled') === 'true') return
    const previous = state.last
    if (time < previous.t || (x === previous.x && y === previous.y)) return
    const distance = Math.hypot(x - previous.x, y - previous.y)
    let penWidth = cfgWidth
    if (pressure) {
      const speed = distance / Math.max(1, time - previous.t)
      const limitedSpeed = Math.min(minSpeed * 10, Math.max(minSpeed, speed))
      const addWidth = ((maxWidth - minWidth) * (limitedSpeed - minSpeed)) / minSpeed
      penWidth = Math.min(maxWidth, Math.max(minWidth, maxWidth - addWidth))
      penWidth = Math.min(previous.width * 1.2, Math.max(previous.width * 0.8, penWidth))
    }
    const point = { x, y, t: time, width: penWidth }
    const midpoint = { x: (previous.x + x) / 2, y: (previous.y + y) / 2, width: (previous.width + penWidth) / 2, t: time }
    if (!state.tipOwned && !state.poolReleased && !state.hiddenForFallback && !ink.strokes.some(stroke => stroke.tipOwned)) state.tipOwned = true
    sample(state.boundary, previous, midpoint, false)
    sample(midpoint, point, point, true)
    state.last = point
    state.boundary = midpoint
  }
  state.write = write
  const ready = (rect: any) => {
    if (canvasRef.current !== canvas || drawRef.current !== state || state.version !== canvas.getAttribute('gesture-version') || canvas.getAttribute('gesture-disabled') === 'true') return
    if (!rect || !(Number(rect.width) > 0) || !(Number(rect.height) > 0) || !Number.isFinite(Number(rect.left)) || !Number.isFinite(Number(rect.top))) return
    const geometry = { left: Number(rect.left), top: Number(rect.top), width: Number(rect.width), height: Number(rect.height) }
    geomRef.current = geometry
    state.offset = { left: geometry.left, top: geometry.top }
    const point = { x: start.x - geometry.left, y: start.y - geometry.top, width, t: startTime }
    state.last = point
    state.boundary = point
    state.ready = true
    if (state.tipOwned && !state.hiddenForFallback && !state.poolReleased) {
      capsule(tipRefs[0].current, point, point, width)
      state.tipCount = 1
    }
    const pending = state.pending
    state.pending = []
    pending.forEach(point => write(point.x - geometry.left, point.y - geometry.top, point.t))
    if (state.painted && !state.active) hide()
  }
  const fallbackGeometry = () => {
    if (canvas.getAttribute('gesture-measured') === 'true') ready({
      left: Number(canvas.getAttribute('gesture-left')), top: Number(canvas.getAttribute('gesture-top')),
      width: Number(canvas.getAttribute('gesture-width')), height: Number(canvas.getAttribute('gesture-height'))
    })
    else ready(geomRef.current)
  }
  try {
    if (typeof canvas.invoke !== 'function') { fallbackGeometry(); return }
    const measurement = canvas.invoke('boundingClientRect')
    if (!measurement || typeof measurement.then !== 'function') { fallbackGeometry(); return }
    measurement.then(rect => {
      if (rect && Number(rect.width) > 0 && Number(rect.height) > 0) ready(rect)
      else fallbackGeometry()
    }, fallbackGeometry)
  } catch { fallbackGeometry() }
}

const onDrawMoveMt = (event: any) => {
  'main thread'
  const state = drawRef.current
  if (!state || !state.active) return
  if (event.touches && event.touches.length > 1) { state.active = false; return }
  const touch = event.touches && event.touches[0]
  if (!touch || !Number.isFinite(touch.clientX) || !Number.isFinite(touch.clientY)) return
  const rawTime = event.timestamp ?? event.timeStamp
  const previousTime = state.pending.length ? state.pending[state.pending.length - 1].t : state.last.t
  const time = rawTime != null && rawTime !== '' && Number.isFinite(Number(rawTime)) ? Number(rawTime) : previousTime + 16
  if (!state.ready) state.pending.push({ x: touch.clientX, y: touch.clientY, t: time })
  else state.write(touch.clientX - state.offset.left, touch.clientY - state.offset.top, time)
}
const onDrawEndMt = (event: any) => {
  'main thread'
  const state = drawRef.current
  if (!state || !state.active) return
  const touch = event.changedTouches && event.changedTouches[0]
  if (touch && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
    const rawTime = event.timestamp ?? event.timeStamp
    const previousTime = state.pending.length ? state.pending[state.pending.length - 1].t : state.last.t
    const time = rawTime != null && rawTime !== '' && Number.isFinite(Number(rawTime)) ? Number(rawTime) : previousTime + 16
    if (!state.ready) state.pending.push({ x: touch.clientX, y: touch.clientY, t: time })
    else state.write(touch.clientX - state.offset.left, touch.clientY - state.offset.top, time)
  }
  state.active = false
  if (state.painted) state.hide()
}
const onStrokeMaterializedMt = (event: any) => {
  'main thread'
  const bank = inkRef.current
  const element = event.currentTarget
  if (!bank || !element || typeof element.getAttribute !== 'function') return
  const key = element.getAttribute('stroke-key')
  const version = element.getAttribute('stroke-version')
  const state = bank.strokes.find(stroke => String(stroke.key) === key && stroke.version === version)
  if (!state) return
  state.painted = true
  if (!state.active) state.hide()
}
const onFallbackMaterializedMt = (event: any) => {
  'main thread'
  const bank = inkRef.current
  const element = event.currentTarget
  if (!bank || !element || typeof element.getAttribute !== 'function') return
  const key = element.getAttribute('stroke-key')
  const version = element.getAttribute('stroke-version')
  const state = bank.strokes.find(stroke => String(stroke.key) === key && stroke.version === version)
  if (!state || state.poolReleased) return
  state.hiddenForFallback = true
  state.hide()
}
</script>

<template>
  <view :class="['wd-signature', customClass]" :style="rootStyle">
    <view
      class="wd-signature__content"
      :main-thread-bindtouchstart="onDrawStartMt"
      :main-thread-bindtouchend="onDrawEndMt"
      :main-thread-bindtouchcancel="onDrawEndMt"
      @touchmove="onDrawMoveBg"
    >
      <view
        :id="canvasId"
        class="wd-signature__content-canvas"
        :style="canvasStyle"
        :main-thread-ref="canvasRef"
        :flatten="false"
        :consume-slide-event="consumeSlideEvent"
        :gesture-disabled="String(disabled)"
        :gesture-version="String(drawVersion)"
        :gesture-next-stroke="String(strokeSerial + 1)"
        :gesture-pressure="String(pressure)"
        :gesture-pen-color="penColor"
        :gesture-line-width="String(lineWidth)"
        :gesture-min-width="String(minWidth)"
        :gesture-max-width="String(maxWidth)"
        :gesture-min-speed="String(minSpeed)"
        :gesture-fallback="String(useFallback)"
        :gesture-measured="String(canvasInited)"
        :gesture-left="String(canvasOffset.left)"
        :gesture-top="String(canvasOffset.top)"
        :gesture-width="String(canvasWidth)"
        :gesture-height="String(canvasHeight)"
        @layoutchange="onCanvasLayoutChange"
        @touchstart="startDrawing"
        :main-thread-bindtouchmove="onDrawMoveMt"
        @touchend="stopDrawing"
        @touchcancel="stopDrawing"
      >
        <view
          v-for="stroke in renderedLines"
          :key="stroke.line.key"
          v-memo="[stroke.line.points]"
          class="wd-signature__stroke"
          :stroke-key="String(stroke.line.key)"
          :stroke-version="stroke.line.version"
          :user-interaction-enabled="false"
          :main-thread-bindlayoutchange="onStrokeMaterializedMt"
        >
          <view class="wd-signature__materialized" :user-interaction-enabled="false" @layoutchange="markMaterialized(stroke.line)">
            <view v-for="(style, index) in stroke.segments" :key="index" class="wd-signature__segment" :style="style" :user-interaction-enabled="false" />
          </view>
        </view>
        <view
          v-for="stroke in fallbackLines"
          :key="`fallback-${stroke.line.key}`"
          class="wd-signature__stroke wd-signature__fallback"
          :stroke-key="String(stroke.line.key)"
          :stroke-version="stroke.line.version"
          :user-interaction-enabled="false"
          :main-thread-bindlayoutchange="onFallbackMaterializedMt"
        >
          <view class="wd-signature__materialized" :user-interaction-enabled="false" @layoutchange="markMaterialized(stroke.line)">
            <view v-for="(style, index) in stroke.segments" :key="index" v-memo="[style]" class="wd-signature__segment" :style="style" :user-interaction-enabled="false" />
          </view>
        </view>
        <view v-for="index in POOL_SIZE" :key="`pool-${index}`" v-memo="[segmentResetStyle]" class="wd-signature__live-segment" :main-thread-ref="segmentRefs[index - 1]" :style="segmentResetStyle" :user-interaction-enabled="false" />
        <view v-for="index in TIP_SIZE" :key="`tip-${index}`" v-memo="[segmentResetStyle]" class="wd-signature__tip-segment" :main-thread-ref="tipRefs[index - 1]" :style="segmentResetStyle" :user-interaction-enabled="false" />
      </view>
    </view>
    <view class="wd-signature__footer">
      <slot
        name="footer"
        :clear="clear"
        :confirm="confirmSignature"
        :current-step="currentStep"
        :revoke="revoke"
        :restore="restore"
        :can-undo="lines.length > 0"
        :can-redo="redoLines.length > 0"
        :history-list="lines"
      >
        <template v-if="enableHistory">
          <WdButton custom-class="wd-signature__button" size="small" variant="plain" :text="revokeText || undoText || translate('revokeText')" @tap="revoke" :disabled="lines.length <= 0" />
          <WdButton custom-class="wd-signature__button" size="small" variant="plain" :text="restoreText || redoText || translate('restoreText')" @tap="restore" :disabled="redoLines.length <= 0" />
        </template>
        <WdButton custom-class="wd-signature__button" size="small" variant="plain" :text="clearText || translate('clearText')" @tap="clear" />
        <WdButton custom-class="wd-signature__button" size="small" variant="base" :text="confirmText || translate('confirmText')" @tap="confirmSignature" />
      </slot>
    </view>
  </view>
</template>

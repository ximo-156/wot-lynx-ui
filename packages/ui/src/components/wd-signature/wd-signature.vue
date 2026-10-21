/*
 * wd-signature — 签名（原生优先重写版）
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - Lynx 无 canvas 2D API（CONVENTIONS §12）：签名板用 SVG 折线实现
 *   ——已提交笔迹每笔一条 polyline（非压感）或逐段 path（压感，
 *   stroke-width 取该段终点线宽），元素均在 SVG content 白名单内
 *   （CONVENTIONS §8）；
 * - **跟手走主线程（声明式 MTS）**：正在绘制的当前笔迹由主线程
 *   worklet 直改「线段池」渲染——每个 touchmove 把上一触点到当前
 *   触点的一段直线经 setStyleProperty 直改池中下一个 view 元素
 *   （left / top / width / height / border-radius / background-color /
 *   transform: rotate），零线程跨越、笔画进行中零重渲染（原实现每帧
 *   重绘整幅 SVG，O(总点数)）；线段几何与 SVG 导出的逐段 path 同构
 *   （段宽取终点线宽），视觉与导出一致；
 * - **跨元素分工（真机冒泡语义）**：画布（__content-canvas）绑后台
 *   touchstart / touchend（起笔记录与落笔提交）与主线程
 *   main-thread-bindtouchmove（跟手渲染）；父容器 __content 绑主线程
 *   touchstart / touchend / touchcancel（度量画布几何、起笔登记、
 *   清尾）与后台 @touchmove.stop.prevent（累积笔迹数据 + 防滚动接管，
 *   替代 uni-app canvas 的 disable-scroll——vue-lynx 修饰符仅 .stop
 *   有副作用，catch 语义由后台处理器承担）。真机上画布触摸事件冒泡到
 *   __content 即触发；**jsdom 不模拟冒泡**，测试中需向两个元素分别
 *   派发验证（与 slider-mts.test.ts 同法）；
 * - **几何一次性度量**：画布页面偏移由主线程 worklet 在起笔时经
 *   `MainThread.Element.invoke('boundingClientRect')` 获取（CONVENTIONS
 *   §16），后台起笔处理器同步经 getRect 刷新同一偏移——两侧同源，
 *   保证跟手渲染与导出 SVG 的坐标系一致；
 * - **线段池重置（Style Funnel §20）**：池内联样式的「隐藏态」由
 *   segmentResetStyle ref 持有，落笔 / 清空 / 撤销 / 恢复时赋新引用，
 *   池宽高随该帧 SVG 重绘一并清零（同一帧无闪烁）；笔画进行中引用
 *   不变，重渲染不冲刷 worklet 直改值；
 * - **池容量降级**：池容量 POOL_SIZE 条线段，单笔超过时超出部分不
 *   跟手渲染，落笔后由 SVG 全量重绘补齐（笔迹数据以后台累积为准，
 *   导出不受影响）；
 * - 注册 createCanvasContext / canvasToTempFilePath 宿主能力时导出真实
 *   fileType / quality 指定位图；缺少能力则返回真实 SVG MIME data URI，
 *   不能当作 PNG/JPG，该平台差异由返回前缀明确标识；
 * - 触摸坐标为页面坐标（Lynx touches[].clientX/clientY），需减去画布
 *   偏移换算为画布坐标（uni-app canvas 事件坐标即以画布为原点）；
 * - customClass / customStyle 绑定到根节点（参考源根节点未绑定二者，
 *   Lynx 端口按库内统一约定绑定，见 PORTING §3.5）；
 * - 度量回调晚于卸载落地时经 useAlive 守卫丢弃（真机 9902 家族）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, useMainThreadRef, watch } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import { signatureProps, type SignatureEmits, type SignatureExpose, type SignatureResult, type Point, type Line } from './types'
import { useTranslate } from '../../composables/useTranslate'
import { useAlive } from '../../composables/useAlive'
import { hasUniAdapter } from '../../common/uni'
import { createCanvasContext, canvasToTempFilePath } from '../../common/canvasHelper'
import { getRect, uuid, isDef, addUnit, sanitizeSvgContent, filterStyle, parseStyle, type CSSProperties } from '../../common/util'

const props = defineProps(signatureProps)
const emit = defineEmits<SignatureEmits>()
const { translate } = useTranslate('signature')
const isAlive = useAlive()
const { proxy } = getCurrentInstance() as any
let strokeRequest = 0
let measureRequest = 0
let exportRequest = 0
let exporting = false
const drawVersion = ref(0)
onBeforeUnmount(() => { strokeRequest++; measureRequest++; exportRequest++ })

const canvasId = ref<string>(`wd-signature-${uuid()}`) // 画布节点的唯一标识符
// 画布尺寸：实测值，度量不可用（零矩形）时保留默认兜底
const canvasWidth = ref<number>(300)
const canvasHeight = ref<number>(200)
// 画布页面偏移：触摸坐标（页面坐标系）换算为画布坐标用
const canvasOffset = ref<{ left: number; top: number }>({ left: 0, top: 0 })
// 是否已完成过一次度量（init 的幂等判断，对齐参考源 canvasState 语义）
const canvasInited = ref<boolean>(false)

const drawing = ref<boolean>(false) // 是否正在绘制

/**
 * 判断颜色是否为透明色
 * @param {string} color 颜色值（支持 rgba/hsla/hex/transparent）
 * @returns {boolean} 是否为透明
 */
function isTransparentColor(color: string | undefined): boolean {
  if (!color) return true
  const transparentKeywords = ['transparent', '#0000', '#00000000']

  // 标准透明关键字
  if (transparentKeywords.includes(color.toLowerCase())) {
    return true
  }

  // 匹配 rgba(r, g, b, a)
  const rgbaMatch = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+))?\)$/i)
  if (rgbaMatch) {
    const alpha = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
    return alpha === 0
  }

  // 匹配 hsla(h, s, l, a)
  const hslaMatch = color.match(/^hsla?\(\s*(\d+)(?:deg)?\s*,\s*(\d+)%\s*,\s*(\d+)%\s*,\s*(\d*\.?\d+)\)$/i)
  if (hslaMatch) {
    const alpha = hslaMatch[4] ? parseFloat(hslaMatch[4]) : 1
    return alpha === 0
  }

  // 匹配 #RRGGBBAA 或 #RGBA
  const hexMatch = color.match(/^#([0-9a-f]{8}|[0-9a-f]{4})$/i)
  if (hexMatch) {
    const hex = hexMatch[1]
    const alphaHex = hex.length === 8 ? hex.slice(6, 8) : hex.slice(3, 4).repeat(2)
    const alpha = parseInt(alphaHex, 16)
    return alpha === 0
  }

  return false
}

const canvasStyle = computed(() => {
  const style: CSSProperties = {}
  if (isDef(props.width)) {
    style.width = addUnit(props.width)
  }

  if (isDef(props.height)) {
    style.height = addUnit(props.height)
  }

  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

/**
 * 根节点样式：customStyle 经 parseStyle 归一为对象（CONVENTIONS §19）。
 * 经 computed 暴露给模板——不在模板中直接调用导入的 parseStyle。
 */
const rootStyle = computed(() => parseStyle(props.customStyle))

const enableHistory = computed(() => props.enableHistory)

const lines = ref<Line[]>([]) // 保存所有线条
const redoLines = ref<Line[]>([]) // 保存撤销的线条
const currentLine = ref<Line>() // 当前正在绘制的线
const currentStep = ref(0) // 当前步骤

/**
 * 计算笔画宽度 (压感模式)
 * @param {number} speed 当前绘制速度
 * @returns {number} 转换后的笔触宽度
 */
function calculateLineWidth(speed: number): number {
  if (!props.pressure) return props.lineWidth

  const minSpeed = props.minSpeed || 1.5
  const limitedSpeed = Math.min(minSpeed * 10, Math.max(minSpeed, speed))
  const addWidth = ((props.maxWidth - props.minWidth) * (limitedSpeed - minSpeed)) / minSpeed
  const lineWidth = Math.max(props.maxWidth - addWidth, props.minWidth)
  return Math.min(lineWidth, props.maxWidth)
}

/**
 * 获取默认笔画宽度
 */
const getDefaultLineWidth = () => {
  if (props.pressure) {
    // 在压感模式下，使用最大和最小宽度的平均值作为默认值
    return (props.maxWidth + props.minWidth) / 2
  }
  return props.lineWidth
}

/**
 * 触点坐标换算为画布坐标（Lynx 触摸坐标为页面坐标，需减去画布偏移）
 */
function getPoint(event: any): { x: number; y: number } {
  const touch = event.touches?.[0] || event.changedTouches?.[0] || { clientX: 0, clientY: 0 }
  return {
    x: touch.clientX - canvasOffset.value.left,
    y: touch.clientY - canvasOffset.value.top
  }
}

/**
 * 触摸开始绘制
 * @param event 触摸事件
 */
const startDrawing = (e: any) => {
  if (!isAlive() || props.disabled || !e.touches?.length) return
  const request = ++strokeRequest
  drawing.value = true
  const { x, y } = getPoint(e)
  currentLine.value = {
    points: [{ x, y, t: Date.now() }], color: props.penColor, width: getDefaultLineWidth(),
    backgroundColor: props.backgroundColor, isPressure: props.pressure
  }
  redoLines.value = []
  emit('start', e)
  // Start synchronously: a quick end must not be followed by a late ghost stroke.
  const previous = { ...canvasOffset.value }
  getRect('#' + canvasId.value, false, proxy).then((rect) => {
    if (!isAlive() || props.disabled || !drawing.value || request !== strokeRequest) return
    const offset = { left: Number(rect.left) || 0, top: Number(rect.top) || 0 }
    const current = currentLine.value
    if (current) current.points.forEach((point) => {
      point.x += previous.left - offset.left
      point.y += previous.top - offset.top
    })
    canvasOffset.value = offset
  })
}

/**
 * 结束绘制
 * @param {TouchEvent} e 触摸事件
 */
const stopDrawing = (e: any) => {
  if (!drawing.value) return
  strokeRequest++
  drawing.value = false
  if (currentLine.value) {
    // 保存完整的线条信息，包括所有点的参数
    lines.value.push({
      ...currentLine.value,
      points: currentLine.value.points.map((point) => ({
        ...point,
        t: point.t,
        speed: point.speed,
        distance: point.distance,
        lineWidth: point.lineWidth,
        lastX1: point.lastX1,
        lastY1: point.lastY1,
        lastX2: point.lastX2,
        lastY2: point.lastY2,
        isFirstPoint: point.isFirstPoint
      }))
    })
    currentStep.value = lines.value.length
  }
  currentLine.value = undefined
  // 线段池随该帧 SVG 重绘一并重置（见 segmentResetStyle 注释）
  resetSegmentPool()
  emit('end', e)
}

/**
 * 初始化签名板（对齐参考源 initCanvas：已初始化且非强制更新时跳过）
 * @param forceUpdate 是否强制更新
 */
const init = (forceUpdate: boolean = false) => {
  if (!forceUpdate && canvasInited.value) {
    return
  }
  measureCanvas()
}

/**
 * 度量画布尺寸与页面偏移（挂载后 / 尺寸 props 变化时一次性执行，
 * touchmove 热路径只读缓存，CONVENTIONS §16）
 */
function measureCanvas() {
  const request = ++measureRequest
  getRect(`#${canvasId.value}`, false, proxy).then((data) => {
    // 回调晚于卸载落地时丢弃：在已销毁树上写 ref 会触发 vue-lynx 继续
    // patch，产生晚到的 remove/insert（真机 9902 removeNode 家族）
    if (!isAlive() || request !== measureRequest) return
    canvasOffset.value = { left: Number(data.left) || 0, top: Number(data.top) || 0 }
    const width = Number(data.width) || 0
    const height = Number(data.height) || 0
    if (width > 0) canvasWidth.value = width
    if (height > 0) canvasHeight.value = height
    canvasInited.value = true
  })
}

/**
 * 清除签名内容，清空历史记录
 */
const clear = () => {
  strokeRequest++; exportRequest++; exporting = false; drawVersion.value++
  drawing.value = false; currentLine.value = undefined
  lines.value = []
  redoLines.value = []
  currentStep.value = 0
  resetSegmentPool()
  emit('clear')
}

/**
 * 确认签名并导出图片
 */
const confirmSignature = () => {
  if (!isAlive() || exporting) return
  const request = ++exportRequest
  const width = canvasWidth.value
  const height = canvasHeight.value
  const exportScale = props.exportScale
  const snapshot = lines.value.map((line) => ({ ...line, points: line.points.map((point) => ({ ...point })) }))
  const base = { width: width * exportScale, height: height * exportScale }
  if (!hasUniAdapter('createCanvasContext') || !hasUniAdapter('canvasToTempFilePath')) {
    // A real SVG URI, explicitly not the PNG/JPG requested by fileType.
    emit('confirm', { ...base, tempFilePath: 'data:image/svg+xml;utf8,' + encodeURIComponent(buildSvgMarkup(snapshot, exportScale)), success: true })
    return
  }
  exporting = true
  const valid = () => isAlive() && request === exportRequest
  const fail = () => {
    if (!valid()) return
    exporting = false
    emit('confirm', { ...base, tempFilePath: '', success: false })
  }
  try {
    const ctx = createCanvasContext(canvasId.value, proxy)
    ctx.clearRect(0, 0, width, height)
    if (!isTransparentColor(props.backgroundColor)) {
      ctx.setFillStyle(props.backgroundColor)
      ctx.fillRect(0, 0, width, height)
    }
    ctx.setLineJoin('round')
    ctx.setLineCap('round')
    snapshot.forEach((line) => {
      ctx.setStrokeStyle(line.color)
      line.points.slice(1).forEach((point, index) => {
        const previous = line.points[index]
        ctx.setLineWidth(point.lineWidth || line.width)
        ctx.beginPath()
        ctx.moveTo(previous.x, previous.y)
        ctx.lineTo(point.x, point.y)
        ctx.stroke()
      })
    })
    const exportImage = () => {
      if (!valid()) return
      canvasToTempFilePath({
        canvasId: canvasId.value, width, height, destWidth: base.width, destHeight: base.height,
        fileType: props.fileType, quality: props.quality,
        success: (res: any) => {
          if (!valid()) return
          const tempFilePath = res.tempFilePath || res.filePath
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

/**
 * 画布 touchmove（后台）：累积笔迹数据（不渲染——渲染在主线程
 * worklet），并经 catch 语义阻止签名期间页面滚动接管
 * （uni-app canvas 的 disable-scroll 等价物）。
 */
const draw = (e: any) => {
  if (!drawing.value || props.disabled || !currentLine.value) return
  const { x, y } = getPoint(e)

  const point: Point = {
    x,
    y,
    t: Date.now()
  }

  if (currentLine.value) {
    const points = currentLine.value.points
    const prePoint = points[points.length - 1]

    if (prePoint.t === point.t || (prePoint.x === x && prePoint.y === y)) {
      return
    }

    // 计算点的速度和距离
    point.distance = Math.sqrt(Math.pow(point.x - prePoint.x, 2) + Math.pow(point.y - prePoint.y, 2))
    point.speed = point.distance / (point.t - prePoint.t || 0.1)

    if (props.pressure) {
      point.lineWidth = calculateLineWidth(point.speed)
      // 处理线宽变化率限制
      if (points.length >= 2) {
        const prePoint2 = points[points.length - 2]
        if (prePoint2.lineWidth && prePoint.lineWidth) {
          const rate = (point.lineWidth - prePoint.lineWidth) / prePoint.lineWidth
          const maxRate = 0.2 // 最大变化率20%
          if (Math.abs(rate) > maxRate) {
            const per = rate > 0 ? maxRate : -maxRate
            point.lineWidth = prePoint.lineWidth * (1 + per)
          }
        }
      }
    }

    points.push(point)
  }

  emit('signing', e)
}

/**
 * 撤销上一笔记录
 */
const revoke = () => {
  strokeRequest++; exportRequest++; exporting = false; drawVersion.value++
  drawing.value = false; currentLine.value = undefined
  if (!lines.value.length) return
  const step = Math.min(props.step, lines.value.length)
  const removedLines = lines.value.splice(lines.value.length - step)
  redoLines.value.push(...removedLines)
  currentStep.value = Math.max(0, currentStep.value - step)
  resetSegmentPool()
}

/**
 * 恢复上一笔记录
 */
const restore = () => {
  strokeRequest++; exportRequest++; exporting = false; drawVersion.value++
  drawing.value = false; currentLine.value = undefined
  if (!redoLines.value.length) return
  const step = Math.min(props.step, redoLines.value.length)
  const restoredLines = redoLines.value.splice(redoLines.value.length - step)
  lines.value.push(...restoredLines)
  currentStep.value = Math.min(lines.value.length, currentStep.value + step)
  resetSegmentPool()
}

/**
 * 生成笔迹的 SVG 标记（白名单元素：rect / polyline / path）
 * @param strokeLines 参与渲染的线条（渲染路径仅含已提交线条，当前笔迹
 * 由主线程线段池跟手渲染；导出路径同）
 * @param scale 导出缩放倍数（viewBox 不变，宽高属性按倍数放大）
 */
function buildSvgMarkup(strokeLines: Line[], scale: number = 1): string {
  const bg = isTransparentColor(props.backgroundColor)
    ? ''
    : `<rect width="${canvasWidth.value}" height="${canvasHeight.value}" fill="${props.backgroundColor}"/>`
  const body = strokeLines
    .map((line) => {
      if (!line.points.length) return ''
      if (line.isPressure) {
        // 压感模式：逐段 path，stroke-width 取该段终点线宽（贝塞尔控制点
        // 为 canvas 专有，端口以线段近似，圆头线帽保证衔接平滑）
        return line.points
          .slice(1)
          .map((point, index) => {
            const prePoint = line.points[index]
            const width = point.lineWidth || line.width
            return `<path d="M ${prePoint.x} ${prePoint.y} L ${point.x} ${point.y}" fill="none" stroke="${line.color}" stroke-width="${width}" stroke-linecap="round"/>`
          })
          .join('')
      }
      const points = line.points.map((point) => `${point.x},${point.y}`).join(' ')
      return `<polyline points="${points}" fill="none" stroke="${line.color}" stroke-width="${line.width}" stroke-linecap="round" stroke-linejoin="round"/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth.value} ${canvasHeight.value}" width="${canvasWidth.value * scale}" height="${canvasHeight.value * scale}">${bg}${body}</svg>`
}

/** SVG content：仅含已提交笔迹（当前笔迹由主线程线段池渲染） */
const svgContent = computed(() => {
  return sanitizeSvgContent(buildSvgMarkup(lines.value))
})

/**
 * 线段池重置样式（Vue 侧「隐藏态」）。
 *
 * 跟手渲染期间线段宽高由主线程 worklet 直改（绕过 Vue）；落笔 / 清空 /
 * 撤销 / 恢复时经 resetSegmentPool 赋新引用，池内联样式随该帧 SVG
 * 重绘一并重置为 0×0（同一帧，无闪烁）。笔画进行中引用不变——computed
 * / 重渲染不触碰该 prop，worklet 直改值不被冲刷（CONVENTIONS §20）。
 */
const segmentResetStyle = ref<Record<string, string>>({ position: 'absolute', left: '0px', top: '0px', width: '0px', height: '0px' })

function resetSegmentPool() {
  segmentResetStyle.value = { position: 'absolute', left: '0px', top: '0px', width: '0px', height: '0px' }
}

onMounted(() => {
  init()
})

watch([() => props.width, () => props.height], () => {
  exportRequest++; exporting = false
  // 画布视图尺寸变化时重新度量，保证 viewBox 与可见区域一致
  measureCanvas()
})

watch(() => props.disabled, (disabled) => {
  strokeRequest++; exportRequest++; exporting = false; drawVersion.value++
  if (disabled) { drawing.value = false; currentLine.value = undefined; resetSegmentPool() }
}, { flush: 'sync' })
watch([() => props.fileType, () => props.quality, () => props.exportScale], () => { exportRequest++; exporting = false }, { flush: 'sync' })

defineExpose<SignatureExpose>({
  init,
  clear,
  confirm: confirmSignature,
  restore,
  revoke
})

// ---------- 主线程 worklet（当前笔迹跟手渲染，零线程跨越） ----------

/** 线段池容量：单笔线段数上限，超出部分落笔后由 SVG 全量重绘补齐 */
const POOL_SIZE = 512

/**
 * 主线程元素桩类型（worklet 内经 .current 取用）。
 * 与 @lynx-js/types 的 MainThread.Element 对齐的常用子集。
 */
interface MtElement {
  setStyleProperty(name: string, value: string): void
  getAttribute(name: string): string | null
  invoke(method: string, params?: any): Promise<any>
}

/** 画布元素：worklet 起笔时一次性度量页面偏移 */
const canvasRef = useMainThreadRef<MtElement | null>(null)
/** 线段池元素引用数组：worklet 跟手直改（数组在 setup 期建定，元素随渲染挂载） */
const segmentRefs = Array.from({ length: POOL_SIZE }, () => useMainThreadRef<MtElement | null>(null))

/** 画布页面偏移快照（worklet 内 .current 活值） */
const geomRef = useMainThreadRef<{ left: number; top: number } | null>(null)
/**
 * 当前笔迹主线程状态（worklet 内 .current 活值）：
 * rawX / rawY 起笔触点（页面坐标），offX / offY 画布偏移，
 * lastX / lastY / lastT / lastW / prevW 上一触点状态（压感与去重），
 * index 已用线段数，ready 几何是否已落地。
 */
interface DrawState {
  rawX: number
  rawY: number
  offX: number
  offY: number
  lastX: number
  lastY: number
  lastT: number
  lastW: number
  prevW: number
  index: number
  ready: boolean
  version: string | null
  pendingX: number | null
  pendingY: number | null
  /** 写入一段（起笔 worklet 内定义，避免 worklet 交叉引用） */
  write: (x: number, y: number) => void
}
const drawRef = useMainThreadRef<DrawState | null>(null)

/**
 * 起笔（主线程）：一次性度量画布页面偏移并登记笔迹状态。
 *
 * 绑在 __content（画布父元素）上：画布的 touchstart 是后台绑定
 * （起笔记录与 emit），同名事件不能同时挂主线程与后台两个处理器；
 * 真机上画布触摸冒泡到 __content 即触发此处（slider 范本同款分工）。
 */
const onDrawStartMt = (event: any) => {
  'main thread'
  const canvas = canvasRef.current
  if (!canvas || canvas.getAttribute('gesture-disabled') === 'true') return
  const pressure = canvas.getAttribute('gesture-pressure') === 'true'
  const lineWidth = Number(canvas.getAttribute('gesture-line-width')) || 3
  const maxWidth = Number(canvas.getAttribute('gesture-max-width')) || 6
  const minWidth = Number(canvas.getAttribute('gesture-min-width')) || 2
  const touch0 = event.touches && event.touches[0]
  if (!touch0) return
  drawRef.current = {
    rawX: touch0.clientX,
    rawY: touch0.clientY,
    offX: 0,
    offY: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    lastW: pressure ? (maxWidth + minWidth) / 2 : lineWidth,
    prevW: 0,
    index: 0,
    ready: false,
    version: canvas.getAttribute('gesture-version'),
    pendingX: null,
    pendingY: null,
    write: () => {}
  }
  const state = drawRef.current
  // 与 SVG 导出的逐段 path 同构：段宽取终点线宽、圆头线帽，中心定位 + rotate
  const write = (x: number, y: number) => {
    if (state.index >= POOL_SIZE) return
    if (canvas.getAttribute('gesture-disabled') === 'true' || state.version !== canvas.getAttribute('gesture-version')) return
    const cfgLineWidth = Number(canvas.getAttribute('gesture-line-width')) || 3
    const cfgPressure = canvas.getAttribute('gesture-pressure') === 'true'
    const cfgMaxWidth = Number(canvas.getAttribute('gesture-max-width')) || 6
    const cfgMinWidth = Number(canvas.getAttribute('gesture-min-width')) || 2
    const cfgMinSpeed = Number(canvas.getAttribute('gesture-min-speed')) || 1.5
    const cfgPenColor = canvas.getAttribute('gesture-pen-color') || '#000'
    const t = Date.now()

    // 与后台 draw() 同一去重：同毫秒或同位置不建段
    if (state.lastT === t || (state.lastX === x && state.lastY === y)) return

    const distance = Math.sqrt(Math.pow(x - state.lastX, 2) + Math.pow(y - state.lastY, 2))
    const speed = distance / (t - state.lastT || 0.1)

    let width = cfgLineWidth
    if (cfgPressure) {
      const limitedSpeed = Math.min(cfgMinSpeed * 10, Math.max(cfgMinSpeed, speed))
      const addWidth = ((cfgMaxWidth - cfgMinWidth) * (limitedSpeed - cfgMinSpeed)) / cfgMinSpeed
      width = Math.min(Math.max(cfgMaxWidth - addWidth, cfgMinWidth), cfgMaxWidth)
      // 线宽变化率限制（与后台 draw() 一致）
      if (state.prevW && state.lastW) {
        const rate = (width - state.lastW) / state.lastW
        const maxRate = 0.2
        if (Math.abs(rate) > maxRate) {
          width = state.lastW * (1 + (rate > 0 ? maxRate : -maxRate))
        }
      }
    }

    const seg = segmentRefs[state.index] && segmentRefs[state.index].current
    if (seg && distance > 0) {
      const angle = (Math.atan2(y - state.lastY, x - state.lastX) * 180) / Math.PI
      seg.setStyleProperty('left', `${(state.lastX + x) / 2 - distance / 2}px`)
      seg.setStyleProperty('top', `${(state.lastY + y) / 2 - width / 2}px`)
      seg.setStyleProperty('width', `${distance}px`)
      seg.setStyleProperty('height', `${width}px`)
      seg.setStyleProperty('background-color', cfgPenColor)
      seg.setStyleProperty('border-radius', `${width / 2}px`)
      seg.setStyleProperty('transform', `rotate(${angle}deg)`)
    }

    state.prevW = state.lastW
    state.lastW = width
    state.lastX = x
    state.lastY = y
    state.lastT = t
    state.index = state.index + 1
  }
  state.write = write
  if (typeof canvas.invoke !== 'function') return
  canvas.invoke('boundingClientRect').then((rect: any) => {
    const d = drawRef.current
    if (!d || d !== state || d.ready) return
    d.offX = Number(rect.left) || 0
    d.offY = Number(rect.top) || 0
    d.lastX = d.rawX - d.offX
    d.lastY = d.rawY - d.offY
    d.lastT = Date.now()
    d.ready = true
    if (d.pendingX !== null && d.pendingY !== null) {
      // 暂存的是页面坐标，就绪后按真实偏移换算（不能用 0 偏移的近似值）
      const px = d.pendingX - d.offX
      const py = d.pendingY - d.offY
      d.pendingX = null
      d.pendingY = null
      d.write(px, py)
    }
  })
}

/**
 * 跟手（主线程）：当前触点与上一触点的一段直线直改线段池下一元素。
 *
 * 段几何与 SVG 导出的逐段 path 同构（段宽取终点线宽、圆头线帽），
 * 元素中心定位 + rotate，无需 transform-origin。与后台 draw() 同一
 * 套去重 / 压感公式，保证跟手渲染与导出笔迹一致。
 */
const onDrawMoveMt = (event: any) => {
  'main thread'
  const d = drawRef.current
  const canvas = canvasRef.current
  if (!d || d.index >= POOL_SIZE || !canvas || canvas.getAttribute('gesture-disabled') === 'true' || d.version !== canvas.getAttribute('gesture-version')) return
  const touch0 = event.touches && event.touches[0]
  if (!touch0) return
  // 首次度量（boundingClientRect）未返回时暂存页面坐标：就绪后补画首段，
  // 避免真机上快速起笔丢掉第一段（与低端机同款竞态）
  if (!d.ready) { d.pendingX = touch0.clientX; d.pendingY = touch0.clientY; return }
  d.write(touch0.clientX - d.offX, touch0.clientY - d.offY)
}

/**
 * 收笔 / 取消（主线程）：清空笔迹状态。
 *
 * 线段池的隐藏重置由 Vue 侧 segmentResetStyle 承担（与 SVG 重绘同帧）；
 * 此处仅清主线程状态，防上一笔起点残留导致跳变。
 */
const onDrawEndMt = () => {
  'main thread'
  drawRef.current = null
}
</script>

<template>
  <view :class="['wd-signature', customClass]" :style="rootStyle">
    <!-- 主线程 worklet 宿主：起笔度量 / 收笔清尾（画布触摸冒泡至此），
         后台 touchmove 承担笔迹累积与防滚动接管 -->
    <view
      class="wd-signature__content"
      :main-thread-bindtouchstart="onDrawStartMt"
      :main-thread-bindtouchend="onDrawEndMt"
      :main-thread-bindtouchcancel="onDrawEndMt"
      @touchmove.stop.prevent="draw"
    >
      <view
        :id="canvasId"
        class="wd-signature__content-canvas"
        :style="canvasStyle"
        :main-thread-ref="canvasRef"
        :gesture-disabled="String(disabled)"
        :gesture-version="String(drawVersion)"
        :gesture-pressure="String(pressure)"
        :gesture-pen-color="penColor"
        :gesture-line-width="String(lineWidth)"
        :gesture-min-width="String(minWidth)"
        :gesture-max-width="String(maxWidth)"
        :gesture-min-speed="String(minSpeed)"
        @touchstart="startDrawing"
        :main-thread-bindtouchmove="onDrawMoveMt"
        @touchend="stopDrawing"
        @touchcancel="stopDrawing"
      >
        <!-- 已提交笔迹（SVG，仅落笔时重绘） -->
        <svg :content="svgContent" />
        <!-- 线段池：当前笔迹的跟手渲染元素（主线程 worklet 直改样式；
             隐藏态由 segmentResetStyle 驱动，随 SVG 重绘同帧重置） -->
        <view v-for="index in POOL_SIZE" :key="index" :main-thread-ref="segmentRefs[index - 1]" :style="segmentResetStyle" />
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
          <WdButton custom-class="wd-signature__button" size="small" plain @tap="revoke" :disabled="lines.length <= 0">
            {{ revokeText || translate('revokeText') }}
          </WdButton>
          <WdButton custom-class="wd-signature__button" size="small" plain @tap="restore" :disabled="redoLines.length <= 0">
            {{ restoreText || translate('restoreText') }}
          </WdButton>
        </template>
        <WdButton custom-class="wd-signature__button" size="small" plain @tap="clear">{{ clearText || translate('clearText') }}</WdButton>
        <WdButton custom-class="wd-signature__button" size="small" @tap="confirmSignature">
          {{ confirmText || translate('confirmText') }}
        </WdButton>
      </slot>
    </view>
  </view>
</template>

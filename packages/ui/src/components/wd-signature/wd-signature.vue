/*
 * wd-signature — 手写签名
 *
 * Lynx 适配说明：
 * - wot-ui 基于 canvas 元素 + uni.createCanvasContext / uni.canvasToTempFilePath 实现，
 *   Lynx 不具备 canvas 2D 能力，故改为原生 svg 元素绘制：背景为一个 rect，
 *   每条笔画一个 polyline（fill="none" + stroke + stroke-linecap/linejoin="round"），
 *   完整 SVG 标记经 svg 元素的 content 属性承载，与 wd-icon 的 SVG 范式一致。
 * - 坐标系：Lynx touch 事件给出的是视口坐标（clientX/clientY），起笔时经 getRect 测量
 *   svg 元素的 boundingClientRect，绘制时减去其左上角偏移得到画布坐标；画布宽高同样
 *   来自实测，未实测到时回退到 width/height props，再回退到平台对画布元素的默认尺寸
 *   （300 x 150），SVG 的 viewBox 与该尺寸保持一致，实现坐标 1:1 映射。
 * - confirm()：原实现导出 canvas 临时文件路径，Lynx 无文件导出能力，改为返回 SVG data
 *   URI（data:image/svg+xml;utf8, + encodeURIComponent(svg)），字段名 tempFilePath 保持
 *   不变（值为 data URI），width/height 为导出尺寸（画布尺寸 * exportScale，与 wot-ui 的
 *   destWidth/destHeight 缩放语义一致）；fileType/quality 是位图概念，矢量方案下无意义，
 *   仅保留 props 兼容。
 * - 压感模式：canvas 方案用贝塞尔曲线逐段变速变宽，单条 polyline 无法变宽，改为按量化
 *   线宽（0.1px）把连续线段合并为多个 polyline，配合 round 线帽与折角保证视觉连续，
 *   因此不再需要贝塞尔控制点（lastX1 等字段）。
 * - 性能：touchmove 中只变更点数据，同一帧内的多次 move 经 microtask 合并为一次重绘，
 *   SVG 字符串整体重建只发生在重绘时，避免逐 move 重建。
 * - disableScroll 是小程序 canvas 元素的专有属性，Lynx 无对应能力，保留 prop 但不生效。
 * - 未指定 height 时给 svg 元素一个默认高度（与平台对 canvas 元素的默认高度一致），
 *   保证不传 height 时签名板依然可见可用。
 * - 模板中的 block 元素为小程序专有语法，Lynx 下改用 template 元素承载条件分组。
 */
<script setup lang="ts">
import './index.css'

import { computed, getCurrentInstance, onMounted, ref } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import { addUnit, getRect, isDef, isFunction, isNumber, sanitizeSvgContent, uuid, type CSSProperties } from '../../common/util'
import { signatureProps, type Line, type Point, type SignatureExpose, type SignatureResult } from './types'
import { useTranslate } from '../../composables/useTranslate'

/** 实测尺寸缺失时的画布回退宽度（与平台对 canvas 元素的默认宽度一致） */
const DEFAULT_CANVAS_WIDTH = 300
/** 实测尺寸缺失时的画布回退高度，同时作为未指定 height 时 svg 元素的默认高度 */
const DEFAULT_CANVAS_HEIGHT = 150

const props = defineProps(signatureProps)
const emit = defineEmits(['start', 'end', 'signing', 'confirm', 'clear'])
const { translate } = useTranslate('signature')
const { proxy } = getCurrentInstance() as any

const canvasId = ref<string>(`signature${uuid()}`) // 签名板（svg 元素）的唯一标识符，用于 SelectorQuery 测量
const drawing = ref<boolean>(false) // 是否正在绘制

const measuredWidth = ref<number>(0) // 实测画布宽度
const measuredHeight = ref<number>(0) // 实测画布高度
const offsetLeft = ref<number>(0) // 画布左上角的视口横坐标
const offsetTop = ref<number>(0) // 画布左上角的视口纵坐标

const lines = ref<Line[]>([]) // 保存所有线条
const redoLines = ref<Line[]>([]) // 保存撤销的线条
const currentLine = ref<Line>() // 当前正在绘制的线
const currentStep = ref(0) // 当前步骤
const svgContent = ref<string>('') // svg 元素的 content（完整 SVG 标记）

/** 渲染路径过白名单安全网（导出走 buildSvg → data URI，不受约束） */
const safeSvgContent = computed(() => sanitizeSvgContent(svgContent.value))

/** 画布宽度：实测优先，其次 width props，最后回退默认值 */
const canvasWidth = computed(() => {
  if (measuredWidth.value > 0) return measuredWidth.value
  return toPositiveNumber(props.width) || DEFAULT_CANVAS_WIDTH
})

/** 画布高度：实测优先，其次 height props，最后回退默认值 */
const canvasHeight = computed(() => {
  if (measuredHeight.value > 0) return measuredHeight.value
  return toPositiveNumber(props.height) || DEFAULT_CANVAS_HEIGHT
})

/** svg 元素样式：与 wot-ui 的 canvas 样式逻辑一致，未指定高度时补默认高度 */
const canvasStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {}
  if (isDef(props.width)) {
    style.width = addUnit(props.width)
  }
  style.height = isDef(props.height) ? addUnit(props.height) : `${DEFAULT_CANVAS_HEIGHT}px`
  return style
})

const enableHistory = computed(() => props.enableHistory)

/**
 * 把可能带单位的尺寸 prop 转为正数，非有效正数返回 0
 * @param value 尺寸值
 */
function toPositiveNumber(value: number | string | undefined): number {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : 0
}

/**
 * 判断颜色是否为透明色
 * @param color 颜色值（支持 rgba/hsla/hex/transparent）
 * @returns 是否为透明
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
  const hslaMatch = color.match(/^hsla?\(\s*(\d+)(?:deg)?\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*(\d*\.?\d+))?\)$/i)
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

/**
 * 计算笔画宽度 (压感模式)
 * @param speed 当前绘制速度
 * @returns 转换后的笔触宽度
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
function getDefaultLineWidth(): number {
  if (props.pressure) {
    // 在压感模式下，使用最大和最小宽度的平均值作为默认值
    return (props.maxWidth + props.minWidth) / 2
  }
  return props.lineWidth
}

/**
 * 读取点的线宽：压感模式下为逐点计算值，否则为笔画默认宽度
 * @param point 点位
 * @param line 所属笔画
 */
function getPointWidth(point: Point, line: Line): number {
  const width = point.lineWidth
  return isNumber(width) && width > 0 ? width : line.width
}

/**
 * 线宽量化：以 0.1px 为精度，相邻线段量化后宽度相同时合并为同一条 polyline
 * @param width 线宽
 */
function quantizeWidth(width: number): number {
  return Math.round(width * 10)
}

/**
 * 拼接 polyline 的 points 属性，坐标保留 1 位小数以压缩字符串长度
 * @param points 点位序列
 */
function buildPointsAttr(points: Point[]): string {
  let attr = ''
  for (let index = 0; index < points.length; index++) {
    if (index > 0) attr += ' '
    const point = points[index]
    attr += `${formatCoord(point.x)},${formatCoord(point.y)}`
  }
  return attr
}

/**
 * 坐标格式化：保留 1 位小数
 * @param value 坐标值
 */
function formatCoord(value: number): string {
  return String(Math.round(value * 10) / 10)
}

/**
 * 生成单条 polyline 标记
 * @param points 点位序列
 * @param color 线条颜色
 * @param width 线条宽度
 */
function polylineMarkup(points: Point[], color: string, width: number): string {
  return `<polyline points="${buildPointsAttr(points)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
}

/**
 * 生成单条笔画的 polyline 标记
 * @param line 笔画
 */
function buildStroke(line: Line): string {
  const points = line.points
  if (!points || points.length < 2) return ''

  // 压感模式：线宽逐点变化，按量化线宽把连续线段分组，每组一条 polyline
  if (line.isPressure && props.pressure) {
    let markup = ''
    let groupPoints: Point[] = [points[0]]
    let groupWidth = quantizeWidth(getPointWidth(points[0], line))

    for (let index = 1; index < points.length; index++) {
      const width = quantizeWidth(getPointWidth(points[index], line))
      if (width !== groupWidth) {
        if (groupPoints.length > 1) {
          markup += polylineMarkup(groupPoints, line.color, groupWidth / 10)
        }
        groupPoints = [points[index - 1]] // 新分组重复上一点，保证笔画连续
        groupWidth = width
      }
      groupPoints.push(points[index])
    }

    if (groupPoints.length > 1) {
      markup += polylineMarkup(groupPoints, line.color, groupWidth / 10)
    }
    return markup
  }

  // 非压感模式：整条笔画一条 polyline
  return polylineMarkup(points, line.color, line.width)
}

/**
 * 生成完整 SVG 标记：背景 rect + 已完成笔画 + 正在绘制的笔画
 * @param exportWidth 导出宽度（confirm 时按 exportScale 放大），不传则为画布宽度
 * @param exportHeight 导出高度，不传则为画布高度
 */
function buildSvg(exportWidth?: number, exportHeight?: number): string {
  const width = canvasWidth.value
  const height = canvasHeight.value
  const sizeAttr = isDef(exportWidth) && isDef(exportHeight) ? ` width="${exportWidth}" height="${exportHeight}"` : ''

  let svg = `<svg xmlns="http://www.w3.org/2000/svg"${sizeAttr} viewBox="0 0 ${width} ${height}">`

  // 背景
  if (!isTransparentColor(props.backgroundColor)) {
    svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="${props.backgroundColor}"/>`
  }

  // 已完成的笔画
  for (let index = 0; index < lines.value.length; index++) {
    svg += buildStroke(lines.value[index])
  }

  // 正在绘制的笔画
  if (currentLine.value) {
    svg += buildStroke(currentLine.value)
  }

  return `${svg}</svg>`
}

let repaintScheduled = false // 是否已有合并中的重绘

/** 立即重绘：整体重建 SVG 标记 */
function repaint() {
  repaintScheduled = false
  svgContent.value = buildSvg()
}

/** 同一帧内的多次 touchmove 合并为一次重绘（Lynx 后台线程 microtask 合并） */
function scheduleRepaint() {
  if (repaintScheduled) return
  repaintScheduled = true
  Promise.resolve().then(() => {
    if (repaintScheduled) repaint()
  })
}

/**
 * 测量画布尺寸与视口偏移（用于坐标换算与 viewBox）
 */
async function measureCanvas() {
  try {
    const rect = await getRect(`#${canvasId.value}`, false, proxy)
    measuredWidth.value = rect.width || 0
    measuredHeight.value = rect.height || 0
    offsetLeft.value = rect.left || 0
    offsetTop.value = rect.top || 0
  } catch {
    // 测量失败时保留上一次的测量结果
  }
}

/**
 * 根据触摸点创建画布坐标点（视口坐标减去画布偏移）
 * @param touch 触摸点
 */
function createPoint(touch: any): Point {
  const clientX = isNumber(touch.clientX) ? touch.clientX : isNumber(touch.x) ? touch.x : 0
  const clientY = isNumber(touch.clientY) ? touch.clientY : isNumber(touch.y) ? touch.y : 0
  return {
    x: clientX - offsetLeft.value,
    y: clientY - offsetTop.value,
    t: Date.now() // 使用 t 记录时间戳，用于速度计算
  }
}

/**
 * 触摸开始绘制
 * @param event 触摸事件
 */
const startDrawing = async (e: any) => {
  if (props.disabled) return

  if (isFunction(e.preventDefault)) e.preventDefault()

  drawing.value = true
  emit('start', e)

  // 每次起笔前重新测量，规避页面滚动 / 布局变化带来的坐标偏移
  await measureCanvas()

  // 测量期间可能已经结束绘制（如快速点触），此时不再起笔
  if (!drawing.value) return

  const touch = e.touches && e.touches[0]
  if (!touch) {
    drawing.value = false
    return
  }

  // 创建新线条，同时保存当前的所有绘制参数
  currentLine.value = {
    points: [createPoint(touch)],
    color: props.penColor,
    width: getDefaultLineWidth(),
    backgroundColor: props.backgroundColor,
    isPressure: props.pressure // 添加笔锋模式标记
  }

  // 清空重做记录
  redoLines.value = []
  repaint()
}

/**
 * 触摸移动绘制
 * @param event 触摸事件
 */
const draw = (e: any) => {
  if (isFunction(e.preventDefault)) e.preventDefault()

  if (!drawing.value || props.disabled || !currentLine.value) return

  const touch = e.touches && e.touches[0]
  if (!touch) return

  const point = createPoint(touch)
  const points = currentLine.value.points
  const prePoint = points[points.length - 1]

  if (prePoint.t === point.t || (prePoint.x === point.x && prePoint.y === point.y)) {
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

  // 合并同一帧内的多次 touchmove，统一重绘
  scheduleRepaint()

  emit('signing', e)
}

/**
 * 结束绘制
 * @param event 触摸事件
 */
const stopDrawing = (e: TouchEvent) => {
  if (isFunction(e.preventDefault)) e.preventDefault()

  drawing.value = false
  if (currentLine.value) {
    // 保存完整的线条信息，包括所有点的参数
    lines.value.push({
      ...currentLine.value,
      points: currentLine.value.points.map((point) => ({ ...point }))
    })
    currentStep.value = lines.value.length
  }
  currentLine.value = undefined

  // 立即重绘，保证松手后立即可见
  repaint()
  emit('end', e)
}

/**
 * 初始化签名板
 * @param forceUpdate 是否强制重新测量 dom 节点计算尺寸，默认 false
 */
const init = async (forceUpdate: boolean = false) => {
  // 如果不是强制更新，且已经测量过尺寸，则不再重复初始化
  if (!forceUpdate && measuredWidth.value > 0 && measuredHeight.value > 0) return
  await measureCanvas()
  repaint()
}

/**
 * 清除画布内容，清空历史记录
 */
const clear = () => {
  lines.value = []
  redoLines.value = []
  currentStep.value = 0
  repaint()
  emit('clear')
}

/**
 * 确认签名并导出 SVG data URI
 */
const confirmSignature = () => {
  const { exportScale } = props
  const width = canvasWidth.value * exportScale
  const height = canvasHeight.value * exportScale
  const result: SignatureResult = {
    tempFilePath: `data:image/svg+xml;utf8,${encodeURIComponent(buildSvg(width, height))}`,
    width,
    height,
    success: true
  }
  emit('confirm', result)
}

/**
 * 撤销上一笔记录
 */
const revoke = () => {
  if (!lines.value.length) return
  const step = Math.min(props.step, lines.value.length)
  const removedLines = lines.value.splice(lines.value.length - step)
  redoLines.value.push(...removedLines)
  currentStep.value = Math.max(0, currentStep.value - step)
  repaint()
}

/**
 * 恢复上一笔记录
 */
const restore = () => {
  if (!redoLines.value.length) return
  const step = Math.min(props.step, redoLines.value.length)
  const restoredLines = redoLines.value.splice(redoLines.value.length - step)
  lines.value.push(...restoredLines)
  currentStep.value = Math.min(lines.value.length, currentStep.value + step)
  repaint()
}

onMounted(() => {
  init()
})

// 初始渲染一次，保证背景立即可见（尺寸以实测为准，实测完成后由 init 重绘）
repaint()

defineExpose<SignatureExpose>({
  init,
  clear,
  confirm: confirmSignature,
  restore,
  revoke
})
</script>

<template>
  <view class="wd-signature">
    <view class="wd-signature__content" @touchstart="startDrawing" @touchmove="draw" @touchend="stopDrawing">
      <svg :id="canvasId" class="wd-signature__content-canvas" :style="canvasStyle" :content="safeSvgContent" />
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
          <WdButton custom-class="wd-signature__button is-first" size="small" plain @click="revoke" :disabled="lines.length <= 0">
            <text>{{ revokeText || translate('revokeText') }}</text>
          </WdButton>
          <WdButton custom-class="wd-signature__button" size="small" plain @click="restore" :disabled="redoLines.length <= 0">
            <text>{{ restoreText || translate('restoreText') }}</text>
          </WdButton>
        </template>
        <WdButton :custom-class="`wd-signature__button${enableHistory ? '' : ' is-first'}`" size="small" plain @click="clear">
          <text>{{ clearText || translate('clearText') }}</text>
        </WdButton>
        <WdButton custom-class="wd-signature__button" size="small" @click="confirmSignature">
          <text>{{ confirmText || translate('confirmText') }}</text>
        </WdButton>
      </slot>
    </view>
  </view>
</template>

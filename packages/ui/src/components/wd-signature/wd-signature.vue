/*
 * wd-signature — 签名
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - Lynx 无 canvas 2D API（CONVENTIONS §12）：签名板用 SVG 折线实现
 *   ——每笔一条 polyline（非压感）或逐段 path（压感，stroke-width 取
 *   该段终点线宽），元素均在 SVG content 白名单内（CONVENTIONS §8）；
 * - 确认导出为标准 SVG data URI（不经过引擎 SVG 解析器，可安全携带
 *   完整属性），SignatureResult.tempFilePath 即该 data URI；
 *   fileType / quality 为 canvas 导出专有 props，对 SVG 导出不生效
 *   （保留声明仅为 API 对齐）；
 * - 参考源在触摸处理器内调用 e.preventDefault()：vue-lynx 的修饰符
 *   仅实现 .stop（stopPropagation），.prevent 无副作用，故改由模板
 *   @touchmove.stop.prevent 承担（等价 uni-app canvas 的
 *   disable-scroll：签名期间阻止页面滚动，disableScroll 恒按 true
 *   生效，见 types.ts 该 prop 注释）；
 * - 触摸坐标为页面坐标（Lynx touches[].clientX/clientY），需减去画布
 *   偏移换算为画布坐标（uni-app canvas 事件坐标即以画布为原点）；
 * - 参考源的 ctx 相关内部实现（getContext / setcanvasState / setLine /
 *   redrawCanvas / drawSmoothLine / canvasToImage）由 svgContent
 *   computed 的响应式重算替代：笔迹数据（lines/redoLines/currentLine）
 *   变化即自动重绘，无需手动 redraw；watch penColor / lineWidth 因此
 *   省略（computed 直接读取 props）；
 * - customClass / customStyle 绑定到根节点（参考源根节点未绑定二者，
 *   Lynx 端口按库内统一约定绑定，见 PORTING §3.5）；
 * - 度量回调晚于卸载落地时经 useAlive 守卫丢弃（真机 9902 家族）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import { signatureProps, type SignatureEmits, type SignatureExpose, type SignatureResult, type Point, type Line } from './types'
import { useTranslate } from '../../composables/useTranslate'
import { useAlive } from '../../composables/useAlive'
import { getRect, uuid, isDef, addUnit, sanitizeSvgContent, filterStyle, parseStyle, type CSSProperties } from '../../common/util'

const props = defineProps(signatureProps)
const emit = defineEmits<SignatureEmits>()
const { translate } = useTranslate('signature')
const isAlive = useAlive()
const { proxy } = getCurrentInstance() as any

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
  drawing.value = true
  emit('start', e)

  // 创建新线条，同时保存当前的所有绘制参数
  const { x, y } = getPoint(e)
  currentLine.value = {
    points: [
      {
        x,
        y,
        t: Date.now() // 使用 t 记录时间戳，用于速度计算
      }
    ],
    color: props.penColor,
    width: getDefaultLineWidth(),
    backgroundColor: props.backgroundColor,
    isPressure: props.pressure // 添加笔锋模式标记
  }

  // 清空重做记录
  redoLines.value = []
  draw(e)
}

/**
 * 结束绘制
 * @param {TouchEvent} e 触摸事件
 */
const stopDrawing = (e: any) => {
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
  getRect(`#${canvasId.value}`, false, proxy).then((data) => {
    // 回调晚于卸载落地时丢弃：在已销毁树上写 ref 会触发 vue-lynx 继续
    // patch，产生晚到的 remove/insert（真机 9902 removeNode 家族）
    if (!isAlive()) return
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
  lines.value = []
  redoLines.value = []
  currentStep.value = 0
  emit('clear')
}

/**
 * 确认签名并导出图片
 */
const confirmSignature = () => {
  const result: SignatureResult = {
    tempFilePath: `data:image/svg+xml;utf8,${encodeURIComponent(buildSvgMarkup(lines.value, props.exportScale))}`,
    success: true,
    width: canvasWidth.value * props.exportScale,
    height: canvasHeight.value * props.exportScale
  }
  emit('confirm', result)
}

//canvas划线
const draw = (e: any) => {
  if (!drawing.value || props.disabled) return
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
  if (!lines.value.length) return
  const step = Math.min(props.step, lines.value.length)
  const removedLines = lines.value.splice(lines.value.length - step)
  redoLines.value.push(...removedLines)
  currentStep.value = Math.max(0, currentStep.value - step)
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
}

/**
 * 生成笔迹的 SVG 标记（白名单元素：rect / polyline / path）
 * @param strokeLines 参与渲染的线条（渲染路径含在绘制的当前线，导出路径仅含已提交线条）
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

/** SVG content：渲染路径含正在绘制的当前线 */
const svgContent = computed(() => {
  const strokeLines: Line[] = currentLine.value ? [...lines.value, currentLine.value] : [...lines.value]
  return sanitizeSvgContent(buildSvgMarkup(strokeLines))
})

onMounted(() => {
  init()
})

watch([() => props.width, () => props.height], () => {
  // 画布视图尺寸变化时重新度量，保证 viewBox 与可见区域一致
  measureCanvas()
})

defineExpose<SignatureExpose>({
  init,
  clear,
  confirm: confirmSignature,
  restore,
  revoke
})
</script>

<template>
  <view :class="['wd-signature', customClass]" :style="parseStyle(customStyle)">
    <view class="wd-signature__content">
      <view
        :id="canvasId"
        class="wd-signature__content-canvas"
        :style="canvasStyle"
        @touchstart="startDrawing"
        @touchmove.stop.prevent="draw"
        @touchend="stopDrawing"
      >
        <svg :content="svgContent" />
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

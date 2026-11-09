/*
 * wd-circle — 环形进度条
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 平台降级：参考源经 uni-app canvas 2d 绘制（含 MP-WEIXIN / MP-ALIPAY
 *   条件编译与 pixelRatio 适配），Lynx 无 canvas API（CONVENTIONS §12），
 *   改用 SVG 双 circle + stroke-dasharray/dashoffset 绘制；SVG content 仅
 *   使用白名单元素（svg / circle，CONVENTIONS §8），并过 sanitizeSvgContent
 *   安全网；
 * - 几何与参考源 presetCanvas 逐段对齐：进度弧与（无 fill 时）轨道的线宽
 *   均取 strokeWidth/2、半径取 size/2 - strokeWidth/4；传入 fill 时轨道
 *   线宽取 strokeWidth、半径取 size/2 - strokeWidth/2 并填充内部；
 *   进度为 0 时按参考源 renderDot 在顶部绘制直径 strokeWidth/2 的圆点；
 * - 渐变降级：参考源 color 为对象时经 canvas createLinearGradient 生成
 *   横向渐变，Lynx SVG content 不支持 linearGradient（白名单外元素，
 *   真机 9902 致命异常，CONVENTIONS §8），按规范降级为纯色——取参考源
 *   同样排序规则（按 parseFloat 数值序）的首个色标；
 * - 方向：clockwise 为 false 时参考源以 arc 的 anticlockwise 参数反向，
 *   SVG 无对应参数，改用镜像变换 translate(c c) rotate(90) scale(-1 1)
 *   translate(-c -c) 反转绕向（起点仍为 12 点方向，与参考源一致）；
 * - 动画：参考源经 setTimeout 链以 1000/speed 毫秒步进 1%（speed 非法时
 *   直接落位），本地按相同时序驱动 currentValue，SVG content 为 computed
 *   响应式重算（无需手动 draw）；
 * - 内联样式：参考源 rootStyle 为 objToStyle 字符串 + customStyle 拼接，
 *   Lynx 的字符串 style 会被静默丢弃（CONVENTIONS §19），改为对象语法并
 *   经 parseStyle 归一 customStyle；
 * - 文案居中：根节点按 size 定宽高，四边 0 的 view 成对 flex 居中；
 *   text 不能靠自身 display:flex 垂直居中字形，字号/行高在独立文字出口上。
 *   text 属性与普通文字插槽共用 WdTextSlot，自定义布局插槽保持原结构；
 * - 半径兜底：strokeWidth 超过 2 倍 size 时参考源 canvas 不绘制，本地
 *   负半径下 SVG 整环不渲染，故钳为 0 保持行为一致；
 * - 文本节点：参考源 view 内的裸文本已包 text，插槽内容由消费方保证。
 * - 轨道颜色默认值按主题在 JS 侧解析（SVG content 不继承 CSS 变量）：
 *   亮色 #F2F3F5 / 深色 #4E5369，见 trackColor。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onBeforeUnmount, ref, watch } from 'vue-lynx'
import { circleProps } from './types'
import { isObj, parseStyle, sanitizeSvgContent } from '../../common/util'
import { createStyleResolver, defineStyleKeys, resolveStyle } from '../../common/style'
import { WdTextSlot } from '../../common/textSlot'
import { useGlobalConfig } from '../../composables/useGlobalConfig'
import { COOLGREY } from '../../common/theme'

// 保留官方 0–100 范围；非法数值归零，不生成 NaN SVG 或无限动画。
function format(rate: number) {
  const value = Number(rate)
  return Number.isNaN(value) ? 0 : Math.min(Math.max(value, 0), 100)
}
// 结束角度（整圆）
const PERIMETER = 2 * Math.PI
const STEP = 1

const props = defineProps(circleProps)

const globalConfig = useGlobalConfig()

/**
 * 轨道颜色：官方默认字面量 '#F2F3F5' 是亮色值，而 SVG content 不继承 CSS
 * 变量 / currentColor，暗色下会原样画出一条亮灰轨道（亮色残留，2026-11-05
 * 真机截图反馈）。组件内把该默认字面量按 theme 解析（亮色 coolgrey-2 /
 * 深色 coolgrey-8，与 filled-bottom / filled-strong 的明暗关系一致）；
 * 显式传入其它值原样使用，prop 默认值与官方保持一致。
 */
const OFFICIAL_LAYER_COLOR = '#F2F3F5'
const trackColor = computed<string>(() => {
  const raw = props.layerColor
  if (!raw || raw.toLowerCase() === OFFICIAL_LAYER_COLOR) {
    return globalConfig.value.theme === 'dark' ? COOLGREY[8] : COOLGREY[2]
  }
  return raw
})

// 进度条颜色（对象配置时取首档，渐变降级）
const progressColor = computed<string>(() => {
  if (isObj(props.color)) {
    const keys = Object.keys(props.color as Record<string, string>).sort((a, b) => parseFloat(a) - parseFloat(b))
    const first = keys[0]
    return first ? String((props.color as Record<string, string>)[first]) : ''
  }
  return (props.color as string) || ''
})

const currentValue = ref<number>(format(props.modelValue))
let interval: ReturnType<typeof setTimeout> | undefined
let animationRevision = 0
let disposed = false
const canvasSize = computed(() => Number.isFinite(Number(props.size)) ? Math.max(0, Number(props.size)) : 100)
const resolveRootStyle = createStyleResolver({ color: '', width: '', height: '' })
const rootStyle = computed(() => resolveRootStyle({
  color: isObj(props.color) ? 'var(--wot-text-main)' : props.color,
  width: `${canvasSize.value}px`,
  height: `${canvasSize.value}px`
}, parseStyle(props.customStyle)))
// 新的 view 居中层直接获得前景色，text 的 currentColor 不再跨多层继承；
// --wot-circle-text-color 仍由文字节点自身的 CSS 优先覆盖。
const TEXT_CONTAINER_STYLE = defineStyleKeys({ color: '' })
const textContainerStyle = computed(() => resolveStyle(TEXT_CONTAINER_STYLE, { color: rootStyle.value.color }))
const sWidth = computed(() => Number.isFinite(Number(props.strokeWidth)) ? Math.max(0, Number(props.strokeWidth)) : 0)

/**
 * 进度弧几何：参考源 presetCanvas 在无 fill 时线宽取 strokeWidth/2，
 * 半径取 size/2 - strokeWidth/4（轨道同几何，故进度弧与轨道重合）
 */
const ringWidth = computed(() => sWidth.value / 2)
const ringRadius = computed(() => Math.max(canvasSize.value / 2 - ringWidth.value / 2, 0))
const ringCircumference = computed(() => PERIMETER * ringRadius.value)

/**
 * 轨道几何：参考源 renderLayerCircle 传入 fill 时线宽取 strokeWidth、
 * 半径取 size/2 - strokeWidth/2，并填充内部
 */
const trackWidth = computed(() => (props.fill ? sWidth.value : ringWidth.value))
const trackRadius = computed(() => Math.max(canvasSize.value / 2 - trackWidth.value / 2, 0))

// Circle 样式
const canvasStyle = computed(() => ({
  width: `${canvasSize.value}px`, height: `${canvasSize.value}px`
}))

// 监听目标数值变化
watch(
  [() => props.modelValue, () => props.speed],
  () => {
    reRender()
  },
  { immediate: true }
)

// 监听Circle大小变化
watch(
  () => props.size,
  () => {
    // Lynx 适配：参考源在此以 50ms 定时器等 canvas 元素尺寸生效后重绘；
    // SVG content 为 computed，尺寸变化当帧反映，无需延迟。
    drawCircle()
  },
  { immediate: false }
)

// 监听进度条颜色变化
watch(
  () => props.color,
  () => {
    drawCircle()
  },
  { immediate: false, deep: true }
)

onBeforeUnmount(() => {
  disposed = true
  clearTimeInterval()
})

/**
 * 画圆（Lynx 适配：SVG content 为 computed 响应式重算，参考源中手动触发的
 * 重绘在此自动发生；保留函数与调用点以对齐参考源的触发时序）
 */
function drawCircle() {
  // 渲染管道见 renderLayerCircle / renderHoverCircle / renderDot，
  // 由 svgContent computed 汇总，无需手动触发。
}

/**
 * 渲染管道（Lynx 适配：轨道圆 + 填充，几何见 trackWidth / trackRadius）
 */
function renderLayerCircle() {
  const c = canvasSize.value / 2
  const fill = props.fill ? ` fill="${props.fill}"` : ' fill="none"'
  return `<circle cx="${c}" cy="${c}" r="${trackRadius.value}"${fill} stroke="${trackColor.value}" stroke-width="${trackWidth.value}"/>`
}

/**
 * 渲染进度条
 */
function renderHoverCircle(formatValue: number) {
  // 结束角度
  const progress = PERIMETER * (formatValue / 100)
  const c = canvasSize.value / 2
  const circumference = ringCircumference.value
  const dashOffset = circumference * (1 - formatValue / 100)
  // Lynx 适配：参考源以 arc 的 anticlockwise 参数反向，SVG 改用镜像变换
  // 反转绕向；起点与参考源 BEGIN_ANGLE(-Math.PI/2，即 12 点方向) 一致，
  // 故顺时针对应 rotate(-90)，逆时针对应镜像变换。
  const transform = props.clockwise
    ? `rotate(-90 ${c} ${c})`
    : `translate(${c} ${c}) rotate(90) scale(-1 1) translate(${-c} ${-c})`
  return (
    `<circle cx="${c}" cy="${c}" r="${ringRadius.value}" fill="none" stroke="${progressColor.value}" ` +
    `stroke-width="${ringWidth.value}" stroke-linecap="${props.strokeLinecap}" ` +
    `stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" transform="${transform}"/>`
  )
}

/**
 * 渲染圆点
 * 进度值为0时渲染一个圆点
 */
function renderDot() {
  const strokeWidth = sWidth.value // 管道宽度=小圆点直径
  const position = canvasSize.value / 2 // 坐标
  return `<circle cx="${position}" cy="${strokeWidth / 4}" r="${strokeWidth / 4}" fill="${progressColor.value}"/>`
}

/**
 * 画圆（Lynx 适配：汇总各渲染管道为 SVG content）
 */
const svgContent = computed(() => {
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasSize.value} ${canvasSize.value}">` +
    renderLayerCircle() +
    (format(currentValue.value) !== 0 ? renderHoverCircle(format(currentValue.value)) : renderDot()) +
    `</svg>`
  return sanitizeSvgContent(markup)
})

/**
 * Circle组件渲染
 * 当前进度值变化时重新渲染Circle组件
 */
function reRender() {
  clearTimeInterval()
  const target = format(props.modelValue)
  const speed = Number(props.speed)
  if (!Number.isFinite(speed) || speed <= 0 || speed > 1000) {
    currentValue.value = target
    return
  }
  currentValue.value = format(currentValue.value)
  if (currentValue.value === target || disposed) return
  const revision = animationRevision
  const run = () => {
    interval = setTimeout(() => {
      interval = undefined
      if (disposed || revision !== animationRevision) return
      const distance = target - currentValue.value
      currentValue.value = Math.abs(distance) <= STEP ? target : currentValue.value + Math.sign(distance) * STEP
      if (currentValue.value !== target) run()
    }, 1000 / speed)
  }
  run()
}
function clearTimeInterval() {
  animationRevision++
  if (interval !== undefined) clearTimeout(interval)
  interval = undefined
}
</script>

<template>
  <view :class="`wd-circle ${customClass}`" :style="rootStyle">
    <svg :content="svgContent" :style="canvasStyle" />

    <view class="wd-circle__text" :style="textContainerStyle">
      <WdTextSlot text-class="wd-circle__label">
        <template v-if="text">{{ text }}</template>
        <slot v-else />
      </WdTextSlot>
    </view>
  </view>
</template>

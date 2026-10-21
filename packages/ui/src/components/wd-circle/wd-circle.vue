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
 * - 文案居中（NATIVE-REWRITE §3.2）：参考源 __text 用 top: 50% +
 *   translateY(-50%) 垂直居中，改为四边 0 撑满 + flex 成对居中（禁
 *   top/left: 50% + translate，四边定位 + flex 居中不依赖 transform），
 *   文本元素另加 text-align: center（Lynx text 不依赖继承）；
 * - 半径兜底：strokeWidth 超过 2 倍 size 时参考源 canvas 不绘制，本地
 *   负半径下 SVG 整环不渲染，故钳为 0 保持行为一致；
 * - 文本节点：参考源 view 内的裸文本已包 text，插槽内容由消费方保证。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, onUnmounted, ref, watch } from 'vue-lynx'
import { circleProps } from './types'
import { filterStyle, isObj, parseStyle, sanitizeSvgContent } from '../../common/util'

// 大于等于0且小于等于100
function format(rate: number) {
  return Math.min(Math.max(rate, 0), 100)
}
// 结束角度（整圆）
const PERIMETER = 2 * Math.PI
const STEP = 1

const props = defineProps(circleProps)

// 进度条颜色（对象配置时取首档，渐变降级）
const progressColor = computed<string>(() => {
  if (isObj(props.color)) {
    const keys = Object.keys(props.color as Record<string, string>).sort((a, b) => parseFloat(a) - parseFloat(b))
    const first = keys[0]
    return first ? String((props.color as Record<string, string>)[first]) : ''
  }
  return (props.color as string) || ''
})

const currentValue = ref<number>(0) // 当前值
const interval = ref<any>(null) // 定时器

const rootStyle = computed(() => {
  const style: Record<string, string> = {
    color: isObj(props.color) ? 'var(--wot-text-main)' : props.color
  }

  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

// canvas渲染大小（Lynx 以 SVG 矢量绘制，无需 pixelRatio 适配）
const canvasSize = computed(() => {
  return props.size
})

// 进度条宽度
const sWidth = computed(() => {
  return props.strokeWidth
})

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
const canvasStyle = computed(() => {
  return {
    width: `${props.size}px`,
    height: `${props.size}px`
  }
})

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

onMounted(() => {
  currentValue.value = props.modelValue
  drawCircle()
})

onUnmounted(() => {
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
  return `<circle cx="${c}" cy="${c}" r="${trackRadius.value}"${fill} stroke="${props.layerColor}" stroke-width="${trackWidth.value}"/>`
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
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${props.size} ${props.size}">` +
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
  if (!Number.isFinite(props.speed) || props.speed <= 0 || props.speed > 1000) {
    currentValue.value = props.modelValue
    drawCircle()
    return
  }
  currentValue.value = currentValue.value || 0
  const run = () => {
    interval.value = setTimeout(() => {
      if (currentValue.value !== props.modelValue) {
        if (Math.abs(currentValue.value - props.modelValue) < STEP) {
          currentValue.value = props.modelValue
        } else if (currentValue.value < props.modelValue) {
          currentValue.value += STEP
        } else {
          currentValue.value -= STEP
        }
        drawCircle()
        run()
      } else {
        clearTimeInterval()
      }
    }, 1000 / props.speed)
  }
  run()
}
/**
 * 清除定时器
 */
function clearTimeInterval() {
  interval.value && clearTimeout(interval.value)
}
</script>

<template>
  <view :class="`wd-circle ${customClass}`" :style="rootStyle">
    <svg :content="svgContent" :style="canvasStyle" />

    <view v-if="!text" class="wd-circle__text">
      <!-- 自定义提示内容 -->
      <slot></slot>
    </view>

    <text v-else class="wd-circle__text">
      {{ text }}
    </text>
  </view>
</template>

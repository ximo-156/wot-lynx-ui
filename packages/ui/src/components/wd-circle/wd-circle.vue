/*
 * wd-circle — 环形进度
 *
 * Lynx 实现说明：
 * - Lynx 无 canvas 2D API，圆环用 SVG 双 circle + stroke-dasharray
 *   实现（白名单元素，CONVENTIONS §8）；渐变降级为纯色（取配置首档）；
 * - Lynx 的 svg content 属性无法被 CSS transition 过渡，进度变化改经
 *   rAF 逐帧补间（speed 语义与 wot-ui 一致：帧/秒，每帧步进 1%，
 *   即 duration = |Δ| × 1000 / speed 毫秒；speed 非法时直接落位）；
 * - counterClockwise 经 transform="rotate(-90 c c) scale(-1,1)" 镜像
 *   实现（SVG content 白名单元素，CONVENTIONS §8）；
 * - strokeWidth > size 时半径兜底为 0，避免负半径导致整环不渲染。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import { circleProps } from './types'
import { sanitizeSvgContent, uuid, filterStyle, parseStyle } from '../../common/util'
import { PURPLE } from '../../common/theme'
import { isObj } from '../../common/util'
import { useRaf } from '../../composables/useRaf'

const props = defineProps(circleProps)

const canvasId = ref<string>(`wd-circle-${uuid()}`)
const canvasSize = computed(() => props.size)

const canvasStyle = computed(() => {
  return { width: `${props.size}px`, height: `${props.size}px` }
})

/** 当前进度颜色（对象配置时取首档，渐变降级） */
const currentColor = computed(() => {
  if (isObj(props.color)) {
    const entries = Object.entries(props.color as Record<string, string | number>)
    const first = entries[0]
    return first ? String(first[1]) : PURPLE[6]
  }
  return (props.color as string) || PURPLE[6]
})

/** 半径兜底：strokeWidth 超过 size 时为负，负半径下整环不渲染 */
const radius = computed(() => Math.max((props.size - props.strokeWidth) / 2, 0))
const circumference = computed(() => 2 * Math.PI * radius.value)

const clampPercent = (value: number) => Math.min(Math.max(Number(value) || 0, 0), 100)

/** 展示中的进度（补间动画的当前值，初始直接落位） */
const displayValue = ref<number>(clampPercent(props.modelValue))

const { start: startRaf, cancel: cancelRaf } = useRaf(tweenTick)

let tweenStart = 0
let tweenFrom = 0
let tweenTo = 0
let tweenDuration = 0

function tweenTick(now: number) {
  if (!tweenStart) tweenStart = now
  const progress = tweenDuration > 0 ? Math.min((now - tweenStart) / tweenDuration, 1) : 1
  displayValue.value = tweenFrom + (tweenTo - tweenFrom) * progress
  if (progress < 1) {
    startRaf()
  } else {
    displayValue.value = tweenTo
  }
}

/** 补间到目标进度：speed 为帧/秒（每帧步进 1%），非法值直接落位 */
function tweenToValue(target: number) {
  cancelRaf()
  const speed = props.speed
  if (!(speed > 0) || speed > 1000) {
    displayValue.value = target
    return
  }
  tweenFrom = displayValue.value
  tweenTo = target
  tweenDuration = Math.abs(target - tweenFrom) * (1000 / speed)
  if (tweenDuration <= 0) {
    displayValue.value = target
    return
  }
  tweenStart = 0
  startRaf()
}

// modelValue 变化时重启动画（无 transition 依赖，纯 JS 补间）
watch(
  () => props.modelValue,
  (value) => tweenToValue(clampPercent(value))
)

const progress = computed(() => displayValue.value)

const dashOffset = computed(() => {
  return circumference.value * (1 - progress.value / 100)
})

const svgContent = computed(() => {
  const r = radius.value
  const c = props.size / 2
  const progressTransform = props.counterClockwise ? `rotate(-90 ${c} ${c}) scale(-1,1)` : `rotate(-90 ${c} ${c})`
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${props.size} ${props.size}">` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${props.layerColor}" stroke-width="${props.strokeWidth}"/>` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${currentColor.value}" stroke-width="${props.strokeWidth}" stroke-linecap="round" stroke-dasharray="${circumference.value}" stroke-dashoffset="${dashOffset.value}" transform="${progressTransform}"/>` +
    `</svg>`
  return sanitizeSvgContent(markup)
})

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.fill) style['background-color'] = props.fill
  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})
</script>

<template>
  <view :class="`wd-circle ${customClass}`" :style="rootStyle">
    <svg :content="svgContent" :style="canvasStyle" />
    <view v-if="!text" class="wd-circle__text">
      <slot />
    </view>
    <text v-else class="wd-circle__text">{{ text }}</text>
  </view>
</template>

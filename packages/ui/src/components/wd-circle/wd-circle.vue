/*
 * wd-circle — 环形进度
 *
 * Lynx 实现说明：
 * - Lynx 无 canvas 2D API，圆环用 SVG 双 circle + stroke-dasharray
 *   实现（白名单元素，CONVENTIONS §8）；渐变降级为纯色（取配置首档）；
 * - 进度变化经 stroke-dashoffset 过渡。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import { circleProps } from './types'
import { sanitizeSvgContent, uuid } from '../../common/util'
import { ORANGE } from '../../common/theme'
import { isObj } from '../../common/util'

const props = defineProps(circleProps)

const canvasId = ref<string>(`wd-circle-${uuid()}`)
const canvasSize = computed(() => props.size)

const canvasStyle = computed(() => {
  return `width: ${props.size}px; height: ${props.size}px;`
})

/** 当前进度颜色（对象配置时取首档，渐变降级） */
const currentColor = computed(() => {
  if (isObj(props.color)) {
    const entries = Object.entries(props.color as Record<string, string | number>)
    const first = entries[0]
    return first ? String(first[1]) : ORANGE[6]
  }
  return (props.color as string) || ORANGE[6]
})

const radius = computed(() => (props.size - props.strokeWidth) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

const progress = computed(() => Math.min(Math.max(props.modelValue, 0), 100))

const dashOffset = computed(() => {
  return circumference.value * (1 - progress.value / 100)
})

const svgContent = computed(() => {
  const r = radius.value
  const c = props.size / 2
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${props.size} ${props.size}">` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${props.layerColor}" stroke-width="${props.strokeWidth}"/>` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${currentColor.value}" stroke-width="${props.strokeWidth}" stroke-linecap="round" stroke-dasharray="${circumference.value}" stroke-dashoffset="${dashOffset.value}" transform="rotate(-90 ${c} ${c})"/>` +
    `</svg>`
  return sanitizeSvgContent(markup)
})

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.fill) style['background-color'] = props.fill
  return Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; ') + (props.customStyle ? `; ${props.customStyle}` : '')
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

/*
 * wd-grid — 宫格
 *
 * Lynx 实现说明：列数经 CSS 变量 --wd-grid-column 下发，
 * grid-item 用 flex-basis 百分比换算（24 制不适用于可变列数）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { gridProps } from './types'

const props = defineProps(gridProps)

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.bgColor) style['background-color'] = props.bgColor
  if (props.gutter) style.gap = `${props.gutter}px`
  const base = Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; ')
  const vars = props.column ? `--wd-grid-column: ${props.column};` : ''
  return `${vars}${base}${props.customStyle ? `; ${props.customStyle}` : ''}`
})
</script>

<template>
  <view :class="`wd-grid ${customClass}`" :style="rootStyle">
    <slot />
  </view>
</template>

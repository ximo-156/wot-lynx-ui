/*
 * wd-grid — 宫格
 *
 * Lynx 实现说明：列数经 CSS 变量 --wd-grid-column 下发，
 * grid-item 用 flex-basis 百分比换算（24 制不适用于可变列数）。
 * square / border / clickable 经 provide 下发给 grid-item
 * （Lynx 无属性选择器继承，CSS 变量无法驱动条件类名）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, provide } from 'vue-lynx'
import { gridProps, GRID_CONFIG_KEY } from './types'
import { filterStyle, parseStyle } from '../../common/util'

const props = defineProps(gridProps)

const rootClass = computed(() => {
  const classes = ['wd-grid']
  if (props.clickable) classes.push('is-clickable')
  if (props.square) classes.push('is-square')
  if (props.border) classes.push('is-border')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

// 对象语法：字符串 :style 会被 vue-lynx patchProp 静默丢弃（CONVENTIONS §19）
const rootStyle = computed(() => {
  return filterStyle({
    ...(props.column ? { '--wd-grid-column': String(props.column) } : {}),
    ...(props.gutter ? { gap: `${props.gutter}px` } : {}),
    ...(props.bgColor ? { 'background-color': props.bgColor } : {}),
    ...parseStyle(props.customStyle)
  })
})

provide(
  GRID_CONFIG_KEY,
  computed(() => ({
    square: props.square,
    border: props.border,
    clickable: props.clickable
  }))
)
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <slot />
  </view>
</template>

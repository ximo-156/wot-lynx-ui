/*
 * wd-row — 行布局
 *
 * Lynx 实现说明：gutter 经 CSS 变量 --wd-row-gutter 下发给子 col
 * （col 用其计算左右内边距，避免负外边距方案在 Lynx 的限制）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { rowProps } from './types'

const props = defineProps(rowProps)

const rootClass = computed(() => {
  const classes = ['wd-row', `is-justify-${props.justify}`, `is-align-${props.align}`]
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const rootStyle = computed(() => {
  return `${props.customStyle || ''}${props.gutter ? `--wd-row-gutter: ${props.gutter / 2}px;` : ''}`
})
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <slot />
  </view>
</template>

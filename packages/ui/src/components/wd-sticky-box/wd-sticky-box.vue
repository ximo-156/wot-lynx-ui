/*
 * wd-sticky-box — 粘性容器
 *
 * Lynx 实现说明：为 wd-sticky 提供滚动容器上下文，
 * 内含 scroll-view 承载粘性子项。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { stickyBoxProps } from './types'

const props = defineProps(stickyBoxProps)

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.containerHeight) style.height = `${props.containerHeight}px`
  const base = Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; ')
  return `${base}${props.customStyle ? `; ${props.customStyle}` : ''}`
})
</script>

<template>
  <scroll-view scroll-orientation="vertical" :class="`wd-sticky-box ${customClass}`" :style="rootStyle">
    <slot />
  </scroll-view>
</template>

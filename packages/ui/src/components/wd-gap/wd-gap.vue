/*
 * wd-gap — 间隔槽
 *
 * Lynx 实现说明：无交互的占位 view，高度/背景可配；
 * 底部安全区经 env(safe-area-inset-bottom) 叠加（Lynx 安全区数据
 * 由宿主注入，未注入时为 0，行为不变）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { gapProps } from './types'
import { addUnit, isDef, objToStyle } from '../../common/util'

const props = defineProps(gapProps)

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (isDef(props.bgColor)) {
    style['background-color'] = props.bgColor
  }
  if (isDef(props.height)) {
    style['height'] = addUnit(props.height)
  }
  return `${objToStyle(style)}${props.customStyle}`
})

const rootClass = computed(() => {
  return `wd-gap${props.safeAreaBottom ? ' wd-gap--safe' : ''}${props.customClass ? ' ' + props.customClass : ''}`
})
</script>

<template>
  <view :class="rootClass" :style="rootStyle" />
</template>

/*
 * wd-sticky-box — 粘性容器
 *
 * Lynx 实现说明：为 wd-sticky 提供滚动容器上下文，
 * 内含 scroll-view 承载粘性子项（子项的吸顶由 position:sticky
 * 在滚动容器内原生处理，见 wd-sticky）。
 * offsetTop 经 provide 下发给子 wd-sticky 作为默认吸顶偏移。
 */
<script lang="ts" setup>
import './index.css'

import { computed, provide } from 'vue-lynx'
import { stickyBoxProps, STICKY_BOX_OFFSET_KEY } from './types'
import { filterStyle, parseStyle } from '../../common/util'

const props = defineProps(stickyBoxProps)

const rootClass = computed(() => {
  const classes = ['wd-sticky-box']
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

// 对象语法：字符串 :style 会被 vue-lynx patchProp 静默丢弃（CONVENTIONS §19）
const rootStyle = computed(() => {
  return filterStyle({
    ...(props.containerHeight ? { height: `${props.containerHeight}px` } : {}),
    ...parseStyle(props.customStyle)
  })
})

provide(STICKY_BOX_OFFSET_KEY, computed(() => props.offsetTop))
</script>

<template>
  <scroll-view scroll-orientation="vertical" :class="rootClass" :style="rootStyle">
    <slot />
  </scroll-view>
</template>

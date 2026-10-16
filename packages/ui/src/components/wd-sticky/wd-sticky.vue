/*
 * wd-sticky — 粘性布局
 *
 * Lynx 实现说明：
 * - 采用 Lynx 渲染器原生支持的 position: sticky（与 wd-index-anchor
 *   同一方案）：吸顶元素保持在文档流内，滚动容器滚动到阈值位置时
 *   由渲染器原生贴住 offsetTop 处，无需 JS 滚动联动；
 * - 历史实现（fixed + 滚动联动）因 Lynx 的 scroll 事件不向子组件
 *   冒泡、fixed 永假而完全不工作，已移除；
 * - customStyle 经 parseStyle 归一后与内置样式合并（对象语法，
 *   CONVENTIONS §19：字符串 :style 会被 vue-lynx 静默丢弃）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject } from 'vue-lynx'
import { stickyProps } from './types'
import { filterStyle, isDef, parseStyle } from '../../common/util'
import { STICKY_BOX_OFFSET_KEY } from '../wd-sticky-box/types'

const props = defineProps(stickyProps)

/** 父级 sticky-box 下发的默认吸顶偏移（未显式传 offsetTop 时使用） */
const boxOffset = inject(STICKY_BOX_OFFSET_KEY, computed(() => 0))
// 用 isDef 而非真值判断：offsetTop=0 是合法值（贴顶），不得被当作未传
const resolvedOffsetTop = computed(() => (isDef(props.offsetTop) ? props.offsetTop : boxOffset.value))

const rootClass = computed(() => {
  const classes = ['wd-sticky']
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const rootStyle = computed(() => {
  return filterStyle({
    position: 'sticky',
    top: `${resolvedOffsetTop.value}px`,
    'z-index': String(props.zIndex),
    ...parseStyle(props.customStyle)
  })
})
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <slot />
  </view>
</template>

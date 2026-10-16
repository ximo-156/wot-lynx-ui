/*
 * wd-col — 列布局
 *
 * Lynx 实现说明：span/offset 经 flex-basis 百分比换算；
 * gutter 内边距读取父级 row 下发的 --wd-row-gutter。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { colProps } from './types'
import { filterStyle, parseStyle } from '../../common/util'

const props = defineProps(colProps)

const rootClass = computed(() => {
  const classes = ['wd-col']
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

// 对象语法：字符串 :style 会被 vue-lynx patchProp 静默丢弃（CONVENTIONS §19）
const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  style['flex-basis'] = `${(props.span / 24) * 100}%`
  if (props.offset > 0) {
    style['margin-left'] = `${(props.offset / 24) * 100}%`
  }
  return filterStyle({ ...style, ...parseStyle(props.customStyle) })
})
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <slot />
  </view>
</template>

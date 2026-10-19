/*
 * wd-grid — 宫格
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 经 useChildren(GRID_KEY) 向子级 wd-grid-item 注入 props（列数、间距、
 *   边框、点击反馈等配置由子项自行计算边框类名与宽度），与参考源一致；
 * - rootStyle 由参考源的「objToStyle 拼字符串 + customStyle 拼接」改为对象语法
 *   （parseStyle 归一，CONVENTIONS §19）；
 * - 无交互、无事件。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { useChildren } from '../../composables/useChildren'
import { GRID_KEY, gridProps } from './types'
import { addUnit, isDef, parseStyle, type CSSProperties } from '../../common/util'

const props = defineProps(gridProps)

const { linkChildren } = useChildren(GRID_KEY)
linkChildren({ props })

const rootStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {}
  if (isDef(props.gutter)) {
    style.paddingLeft = addUnit(props.gutter)
    if (props.square) {
      style.marginBottom = addUnit(-props.gutter)
    }
  }

  return { ...style, ...parseStyle(props.customStyle) }
})
</script>

<template>
  <view :class="`wd-grid ${customClass}`" :style="rootStyle">
    <slot />
  </view>
</template>

/*
 * wd-grid — 宫格
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 经 useChildren(GRID_KEY) 向子级 wd-grid-item 注入 props（列数、间距、
 *   边框、点击反馈等配置由子项自行计算边框类名与宽度），与参考源一致；
 * - rootStyle 由参考源的「objToStyle 拼字符串 + customStyle 拼接」改为对象语法
 *   （parseStyle 归一，CONVENTIONS §19）；
 * - **根节点三件套**（NATIVE-REWRITE §3.1）：display: flex + flex-direction: row
 *   + flex-wrap 在 index.scss 显式声明——linear 默认布局下 flex-wrap 会被
 *   静默丢弃，宫格退化成纵向单列；
 * - **Style Funnel**（CONVENTIONS §20）：rootStyle 的两个可切换键
 *   （gutter 左内边距 / square 负底边距）经 defineStyleKeys + resolveStyle
 *   每帧输出完整键集；
 * - 无交互、无事件。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { useChildren } from '../../composables/useChildren'
import { GRID_KEY, gridProps } from './types'
import { addUnit, isDef, parseStyle, type CSSProperties } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(gridProps)

const { linkChildren } = useChildren(GRID_KEY)
linkChildren({ props })

/**
 * 可切换样式键 + 中性值（CONVENTIONS §20：每帧输出完整键集）。
 * 中性值取「视觉上等同于不设置」：无 gutter 即无左内边距；
 * 非 square 即无负底边距。
 */
const GRID_STYLE = defineStyleKeys({
  paddingLeft: '0px',
  marginBottom: '0px'
})

const rootStyle = computed<CSSProperties>(() => {
  return {
    ...resolveStyle(GRID_STYLE, {
      // gutter 由根节点左内边距 + 子项右内边距共同构成（对齐 wot-ui）
      paddingLeft: isDef(props.gutter) ? addUnit(props.gutter) : '',
      // square 模式下子项以 padding-top 百分比撑高，容器以负底边距回收
      marginBottom: isDef(props.gutter) && props.square ? addUnit(-props.gutter) : ''
    }),
    ...parseStyle(props.customStyle)
  }
})
</script>

<template>
  <view :class="`wd-grid ${customClass}`" :style="rootStyle">
    <slot />
  </view>
</template>

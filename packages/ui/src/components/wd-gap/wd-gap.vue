/*
 * wd-gap — 间隔槽
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - rootStyle 由参考源的「objToStyle 拼字符串 + customStyle 拼接」改为对象语法：
 *   customStyle 经 parseStyle() 归一后合并（CONVENTIONS §19，字符串 :style
 *   会被 vue-lynx 静默丢弃）；
 * - **根节点三件套**（NATIVE-REWRITE §3.1）：display: flex +
 *   flex-direction: column 在 index.scss 显式声明；
 * - **Style Funnel**（CONVENTIONS §20）：rootStyle 的两个可切换键
 *   （背景色 / 高度）经 defineStyleKeys + resolveStyle 每帧输出完整键集，
 *   避免 bgColor 由有值变 transparent 时旧背景残留；
 * - 参考源 safe 变体的 constant(safe-area-inset-bottom) 为旧版 iOS Web 专有
 *   回写，Lynx 不支持 constant()，仅保留 env()（本地弹层组件同款写法）；
 * - 无交互、无事件；安全区数据 Lynx 不提供（未注入 env 时为 0）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { gapProps } from './types'
import { addUnit, isDef, parseStyle, type CSSProperties } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(gapProps)

/**
 * 可切换样式键 + 中性值（CONVENTIONS §20：每帧输出完整键集）。
 * 中性值取「视觉上等同于不设置」：transparent 即无背景；
 * 高度中性值取 prop 默认值（14px）。
 */
const GAP_STYLE = defineStyleKeys({
  'background-color': 'transparent',
  height: '14px'
})

const rootStyle = computed<CSSProperties>(() => {
  return {
    ...resolveStyle(GAP_STYLE, {
      'background-color': isDef(props.bgColor) ? props.bgColor : '',
      height: isDef(props.height) ? addUnit(props.height) : ''
    }),
    ...parseStyle(props.customStyle)
  }
})
</script>

<template>
  <view :class="`wd-gap ${safeAreaBottom ? 'wd-gap--safe' : ''} ${customClass}`" :style="rootStyle"></view>
</template>

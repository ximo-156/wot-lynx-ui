/*
 * wd-gap — 间隔槽
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - rootStyle 由参考源的「objToStyle 拼字符串 + customStyle 拼接」改为对象语法：
 *   customStyle 经 parseStyle() 归一后合并（CONVENTIONS §19，字符串 :style
 *   会被 vue-lynx 静默丢弃）；
 * - **根节点三件套**（NATIVE-REWRITE §3.1）：display: flex +
 *   flex-direction: column 在 index.scss 显式声明；
 * - **Style Funnel**（CONVENTIONS §20）：背景色 / 高度 / 安全区 padding 与
 *   customStyle 经每元素独立的 createStyleResolver 合并，切换和移除显式复位；
 * - 安全区来自 useSafeArea：优先宿主窗口 insets（包括 0），未知时才用原生 env()；
 * - 无交互、无事件；height / bgColor 与 safeAreaBottom 的默认值保持不变。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { gapProps } from './types'
import { addUnit, isDef, parseStyle, type CSSProperties } from '@wot-lynx/core/common/util'
import { createStyleResolver } from '@wot-lynx/core/common/style'
import { useSafeArea } from '@wot-lynx/core/composables/useSafeArea'

const props = defineProps(gapProps)

/**
 * 可切换样式键 + 中性值（CONVENTIONS §20：每帧输出完整键集）。
 * 中性值取「视觉上等同于不设置」：transparent 即无背景；
 * 高度中性值取 prop 默认值（14px）。
 */
const safeArea = useSafeArea()
const resolveRootStyle = createStyleResolver({
  'background-color': 'transparent',
  height: '14px',
  'padding-bottom': '0px'
})

const rootStyle = computed<CSSProperties>(() => resolveRootStyle({
  'background-color': isDef(props.bgColor) ? props.bgColor : '',
  height: isDef(props.height) ? addUnit(props.height) : '',
  'padding-bottom': props.safeAreaBottom ? safeArea.inset('bottom') : '0px'
}, parseStyle(props.customStyle)))
</script>

<template>
  <view :class="`wd-gap ${safeAreaBottom ? 'wd-gap--safe' : ''} ${customClass}`" :style="rootStyle"></view>
</template>

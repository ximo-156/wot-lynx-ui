/*
 * wd-row — 行布局
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - rootStyle 由参考源的「对象拼字符串 + customStyle 字符串拼接」改为对象语法：
 *   customStyle 经 parseStyle() 归一后与计算样式合并（CONVENTIONS §19，
 *   字符串 :style 会被 vue-lynx 静默丢弃）；
 * - gutter 负外边距、justifyMap / alignMap 的 flex 值映射与边界处理
 *   （gutter < 0 控制台告警）与参考源逐行一致；
 * - 经 useChildren(ROW_KEY) 向子级 wd-col 注入 props，与参考源一致；
 * - **根节点三件套**（NATIVE-REWRITE §3.1）：display: flex + flex-direction: row
 *   在 index.scss 显式声明——Lynx 3.x 默认 linear 布局，缺一行即静默丢
 *   flex-wrap，表现为「一行一个、还没有间距」；
 * - **Style Funnel**（CONVENTIONS §20）：rootStyle 的四个可切换键
 *   （gutter 负外边距 / 主轴 / 交叉轴对齐）经 defineStyleKeys + resolveStyle
 *   每帧输出完整键集，避免「条件写样式」在 gutter 由有值变 0 时残留旧负边距。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { useChildren } from '../../composables/useChildren'
import { ROW_KEY, rowProps } from './types'
import { addUnit, parseStyle, type CSSProperties } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(rowProps)

const { linkChildren } = useChildren(ROW_KEY)

linkChildren({ props })

/**
 * justify 值映射到 CSS flex justify-content
 */
const justifyMap: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-between': 'space-between',
  'space-around': 'space-around',
  'space-evenly': 'space-evenly'
}

/**
 * align 值映射到 CSS flex align-items
 */
const alignMap: Record<string, string> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end'
}

/**
 * 可切换样式键 + 中性值（CONVENTIONS §20：每帧输出完整键集）。
 * 中性值取「视觉上等同于不设置」：无 gutter 即无负外边距；
 * justify=start / align=top 即 flex 主轴起点。
 */
const ROW_STYLE = defineStyleKeys({
  marginLeft: '0px',
  marginRight: '0px',
  justifyContent: 'flex-start',
  alignItems: 'flex-start'
})

const rootClass = computed(() => {
  return `wd-row ${props.customClass}`
})

const rootStyle = computed<CSSProperties>(() => {
  const { gutter, justify, align } = props

  if (gutter < 0) {
    console.error('[wot ui] warning(wd-row): attribute gutter must be greater than or equal to 0')
  }

  return {
    ...resolveStyle(ROW_STYLE, {
      // gutter > 0 时两侧负外边距抵消子列 padding，形成列间距
      marginLeft: gutter > 0 ? addUnit(-gutter / 2) : '',
      marginRight: gutter > 0 ? addUnit(-gutter / 2) : '',
      justifyContent: justify && justify !== 'start' ? justifyMap[justify] || justify : '',
      alignItems: align && align !== 'top' ? alignMap[align] || align : ''
    }),
    ...parseStyle(props.customStyle)
  }
})
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <!-- 每一行 -->
    <slot />
  </view>
</template>

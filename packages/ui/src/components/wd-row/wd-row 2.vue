/*
 * wd-row — 行布局
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - rootStyle 由参考源的「对象拼字符串 + customStyle 字符串拼接」改为对象语法：
 *   customStyle 经 parseStyle() 归一后与计算样式合并（CONVENTIONS §19，
 *   字符串 :style 会被 vue-lynx 静默丢弃）；
 * - gutter 负外边距、justifyMap / alignMap 的 flex 值映射与边界处理
 *   （gutter < 0 控制台告警）与参考源逐行一致；
 * - 经 useChildren(ROW_KEY) 向子级 wd-col 注入 props，与参考源一致。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { useChildren } from '../../composables/useChildren'
import { ROW_KEY, rowProps } from './types'
import { addUnit, parseStyle, type CSSProperties } from '../../common/util'

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

const rootClass = computed(() => {
  return `wd-row ${props.customClass}`
})

const rootStyle = computed(() => {
  const style: CSSProperties = {}
  const { gutter, justify, align } = props

  if (gutter < 0) {
    console.error('[wot ui] warning(wd-row): attribute gutter must be greater than or equal to 0')
  } else if (gutter) {
    style.marginLeft = addUnit(-gutter / 2)
    style.marginRight = addUnit(-gutter / 2)
  }

  if (justify && justify !== 'start') {
    style.justifyContent = justifyMap[justify] || justify
  }

  if (align && align !== 'top') {
    style.alignItems = alignMap[align] || align
  }

  return { ...style, ...parseStyle(props.customStyle) }
})
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <!-- 每一行 -->
    <slot />
  </view>
</template>

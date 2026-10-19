/*
 * wd-gap — 间隔槽
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - rootStyle 由参考源的「objToStyle 拼字符串 + customStyle 拼接」改为对象语法：
 *   customStyle 经 parseStyle() 归一后合并（CONVENTIONS §19，字符串 :style
 *   会被 vue-lynx 静默丢弃）；
 * - 参考源 safe 变体的 constant(safe-area-inset-bottom) 为旧版 iOS Web 专有
 *   回写，Lynx 不支持 constant()，仅保留 env()（本地弹层组件同款写法）；
 * - 无交互、无事件；安全区数据 Lynx 不提供（未注入 env 时为 0）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { gapProps } from './types'
import { addUnit, isDef, parseStyle, type CSSProperties } from '../../common/util'

const props = defineProps(gapProps)

const rootStyle = computed(() => {
  const style: CSSProperties = {}
  if (isDef(props.bgColor)) {
    style.background = props.bgColor
  }
  if (isDef(props.height)) {
    style.height = addUnit(props.height)
  }
  return { ...style, ...parseStyle(props.customStyle) }
})
</script>

<template>
  <view :class="`wd-gap ${safeAreaBottom ? 'wd-gap--safe' : ''} ${customClass}`" :style="rootStyle"></view>
</template>

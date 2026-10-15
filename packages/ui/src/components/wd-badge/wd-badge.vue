/*
 * wd-badge — 徽标
 *
 * Lynx 实现说明：
 * - 角标经绝对定位叠加在插槽内容右上角（position: absolute）；
 * - 支持数字（max 截断）/ 圆点 /  ribbon 形状；
 * - 文本必须位于 text 元素内。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { badgeProps, type BadgeType } from './types'
import { isDef, parseStyle, filterStyle } from '../../common/util'

const props = defineProps(badgeProps)

const content = computed(() => {
  const { value, max, isDot } = props
  if (isDot) return ''
  if (!isDef(value)) return ''
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  if (isDef(max) && num > max) return `${max}+`
  return String(num)
})

const shouldShowBadge = computed(() => {
  if (props.hidden) return false
  if (props.isDot) return true
  if (!isDef(props.value)) return false
  if (Number(props.value) === 0 && !props.showZero) return false
  return true
})

const contentStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.bgColor) style['background-color'] = props.bgColor
  if (isDef(props.top)) style.top = typeof props.top === 'number' ? `${props.top}px` : String(props.top)
  if (isDef(props.right)) style.right = typeof props.right === 'number' ? `${props.right}px` : String(props.right)
  return filterStyle(style)
})
</script>

<template>
  <view :class="['wd-badge', customClass]" :style="parseStyle(customStyle)">
    <slot />
    <text
      v-if="shouldShowBadge"
      :class="[
        'wd-badge__content',
        props.border ? 'is-border' : '',
        'wd-badge__content--fixed',
        type ? `wd-badge__content--${type}` : '',
        isDot ? 'wd-badge__content--dot' : '',
        shape ? `wd-badge__content--${shape}` : ''
      ]"
      :style="contentStyle"
      >{{ content }}</text
    >
  </view>
</template>

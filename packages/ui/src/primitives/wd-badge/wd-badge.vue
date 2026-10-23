/*
 * wd-badge — 徽标
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 角标定位与参考源一致：is-fixed 绝对定位于包裹内容右上角，transform 经
 *   --wot-badge-transform 令牌偏移，top / right prop 可覆盖；
 * - 根节点与角标的 :style 参考源为字符串拼接（customStyle / objToStyle），
 *   Lynx 的字符串 style 会被静默丢弃（CONVENTIONS §19），统一改为对象语法
 *   并经 parseStyle 归一 customStyle；
 * - 参考源角标内为裸文本（view 内 {{ content }}），Lynx 要求所有文本包在
 *   text 元素中（CONVENTIONS §4），故内容包一层 text；
 * - 描边用绝对定位的真实覆盖层替代官方伪元素，不参与徽标内容排版；
 * - 组件无根 view 事件绑定，不涉及 CONVENTIONS §14 的 tap 转发。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { badgeProps } from './types'
import { addUnit, isDef, isNumber, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(badgeProps)

/**
 * 计算徽标显示内容
 */
const content = computed(() => {
  const { value, max, isDot } = props
  if (isDot) return ''
  if (value && max && isNumber(value) && !Number.isNaN(value) && !Number.isNaN(max)) {
    return max < value ? `${max}+` : value
  }
  return value
})

/**
 * 计算徽标样式
 */
const BADGE_STYLE = defineStyleKeys({ 'background-color': '', top: '', right: '' })
const contentStyle = computed(() => {
  const style: Record<string, string> = { ...BADGE_STYLE }
  if (isDef(props.bgColor)) {
    style['background-color'] = props.bgColor
  }

  if (isDef(props.top)) {
    style.top = addUnit(props.top)
  }

  if (isDef(props.right)) {
    style.right = addUnit(props.right)
  }
  return resolveStyle(BADGE_STYLE, style)
})

/**
 * 是否展示徽标
 */
const shouldShowBadge = computed(() => !props.hidden && (content.value || (content.value === 0 && props.showZero) || props.isDot))
</script>

<template>
  <view :class="['wd-badge', customClass]" :style="parseStyle(customStyle)">
    <slot></slot>
    <view
      v-if="shouldShowBadge"
      :class="[
        'wd-badge__content',
        props.border ? 'is-border' : '',
        'is-fixed',
        type ? 'wd-badge__content--' + type : '',
        isDot ? 'is-dot' : '',
        shape ? 'is-' + shape : ''
      ]"
      :style="contentStyle"
    >
      <text class="wd-badge__text" text-maxline="1">{{ content }}</text>
      <view v-if="border" class="wd-badge__border" />
    </view>
  </view>
</template>

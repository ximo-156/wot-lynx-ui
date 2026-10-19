/*
 * wd-divider — 分割线
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - Lynx 无伪元素：参考源用 ::before/::after 绘制的左右线段，改为模板中的
 *   真实 view 元素 .wd-divider__line（first/last），边框声明与参考源
 *   伪元素规则一致（border-style/border-color/border-width）；
 * - hairline 细线：参考源以 3px 边框 + transform: scaleY(0.5) 实现，
 *   Lynx 改用 1ppx 物理像素边框（本地 halfPixelBorder 约定，PORTING §4.4）；
 * - 参考源 display: inline-block（vertical 模式）在 Lynx 不识别，
 *   改为 display: flex + flex-direction: column（CONVENTIONS §15）；
 * - rootStyle 由参考源的「objToStyle 拼字符串 + customStyle 拼接」改为对象语法
 *   （parseStyle 归一，CONVENTIONS §19）；
 * - 左右内容位置：参考源以 ::before/::after 的 max-width 缩短对应侧线段，
 *   此处由模板按位置给线段挂 --short 修饰类（左对齐缩首线、右对齐缩末线），
 *   不用结构性伪类选择器。
 */
<script lang="ts" setup>
import './index.css'

import { computed, useSlots } from 'vue-lynx'
import { dividerProps } from './types'
import { parseStyle, type CSSProperties } from '../../common/util'

const props = defineProps(dividerProps)
const slots = useSlots()

const rootStyle = computed(() => {
  const { color, customStyle } = props
  const style: CSSProperties = {}
  if (color) {
    style.color = color
  }
  return { ...style, ...parseStyle(customStyle) }
})

const rootClass = computed(() => {
  const prefixCls = 'wd-divider'
  const classes: Record<string, boolean> = {
    [prefixCls]: true,
    ['is-dashed']: props.dashed,
    ['is-hairline']: props.hairline,
    [`${prefixCls}--vertical`]: props.vertical,
    [`${prefixCls}--center`]: !props.vertical && props.contentPosition === 'center' && !!slots.default,
    [`${prefixCls}--left`]: !props.vertical && props.contentPosition === 'left',
    [`${prefixCls}--right`]: !props.vertical && props.contentPosition === 'right',
    [props.customClass]: !!props.customClass
  }
  return classes
})

/**
 * 线段类名：左对齐时首线段（参考源 ::before）限宽，
 * 右对齐时末线段（参考源 ::after）限宽。
 */
function lineClass(position: 'first' | 'last'): string {
  const short =
    (position === 'first' && props.contentPosition === 'left') ||
    (position === 'last' && props.contentPosition === 'right')
  return short ? 'wd-divider__line wd-divider__line--short' : 'wd-divider__line'
}
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <template v-if="!vertical">
      <!-- 参考源 ::before：无内容时唯一线段，有内容时为首线段 -->
      <view :class="lineClass('first')" />
      <text v-if="$slots.default" class="wd-divider__content">
        <slot />
      </text>
      <!-- 参考源 ::after：仅内容模式（center/left/right）渲染 -->
      <view v-if="$slots.default" :class="lineClass('last')" />
    </template>
    <!-- 垂直模式：参考源仅渲染 ::before，::after 为 display:none -->
    <view v-else class="wd-divider__line" />
  </view>
</template>

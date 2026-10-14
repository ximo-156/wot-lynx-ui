/*
 * wd-divider — 分割线
 *
 * Lynx 实现说明：
 * - Lynx 无伪元素，分割线用模板内的真实 view 元素（__line）绘制；
 * - 细线用原生 border + 1ppx 物理像素；虚线用 border-style: dashed；
 * - 有内容时 线-内容-线 三栏布局，内容位置由 content-position 控制
 *   （左右位置用显式 --short 修饰类，不用结构性伪类选择器）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, useSlots } from 'vue-lynx'
import { dividerProps } from './types'
import { objToStyle } from '../../common/util'

const props = defineProps(dividerProps)
const slots = useSlots()

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.color) {
    style.color = props.color
  }
  return `${objToStyle(style)}${props.customStyle}`
})

const rootClass = computed(() => {
  const classes: Record<string, boolean> = {
    'wd-divider': true,
    'is-dashed': props.dashed,
    'is-hairline': props.hairline,
    'wd-divider--vertical': props.vertical,
    'wd-divider--center': !props.vertical && props.contentPosition === 'center' && !!slots.default,
    'wd-divider--left': !props.vertical && props.contentPosition === 'left',
    'wd-divider--right': !props.vertical && props.contentPosition === 'right'
  }
  if (props.customClass) {
    classes[props.customClass] = true
  }
  return classes
})

/** 内容左右侧线段：左对齐时右侧线缩短，右对齐时左侧线缩短 */
function lineClass(position: 'first' | 'last'): string {
  const short =
    (position === 'first' && props.contentPosition === 'right') ||
    (position === 'last' && props.contentPosition === 'left')
  return short ? 'wd-divider__line wd-divider__line--short' : 'wd-divider__line'
}
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <template v-if="!vertical">
      <view v-if="$slots.default" :class="lineClass('first')" />
      <text v-if="$slots.default" class="wd-divider__content">
        <slot />
      </text>
      <view v-if="$slots.default" :class="lineClass('last')" />
      <view v-else class="wd-divider__line" />
    </template>
    <view v-else class="wd-divider__line" />
  </view>
</template>

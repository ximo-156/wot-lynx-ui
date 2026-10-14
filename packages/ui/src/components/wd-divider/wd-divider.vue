<template>
  <view :class="rootClass" :style="styleToObject(rootStyle)">
    <!-- Lynx 适配：wot-ui 的分割线由 ::before/::after 伪元素绘制，Lynx 无伪元素，
         改为模板中的真实线段元素（__line--before / __line--after）。 -->
    <template v-if="!vertical">
      <view class="wd-divider__line wd-divider__line--before" />
      <text v-if="$slots.default" class="wd-divider__content"><slot /></text>
      <view class="wd-divider__line wd-divider__line--after" />
    </template>
    <view v-else class="wd-divider__line wd-divider__line--before" />
  </view>
</template>
<script setup lang="ts">
import './index.css'
import {computed, useSlots} from 'vue-lynx'
import { dividerProps } from './types'
import { styleToObject, type CSSProperties, objToStyle } from '../../common/util'

const props = defineProps(dividerProps)
const slots = useSlots()

const rootStyle = computed(() => {
  const { color, customStyle } = props
  const style: CSSProperties = {}
  if (color) {
    style.color = color
  }
  return `${objToStyle(style)}${customStyle}`
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
</script>

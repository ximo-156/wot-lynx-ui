/*
 * wd-avatar — 头像
 *
 * Lynx 实现说明：插槽 > 图片（wd-img）> 文本 > 图标 的优先级；
 * 形状经 border-radius；尺寸经 width/height。
 */
<script lang="ts" setup>
import './index.css'

import { computed, useSlots } from 'vue-lynx'
import WdImg from '../wd-img/wd-img.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { avatarProps, type AvatarShape } from './types'
import { addUnit, isDef, filterStyle, parseStyle } from '../../common/util'

const props = defineProps(avatarProps)
const slots = useSlots()
const emit = defineEmits(['click', 'error', 'tap'])

const hasDefaultSlot = computed(() => Boolean(slots.default))
const hasIcon = computed(() => Boolean(props.icon || props.cssIcon))

const isShow = computed(() => {
  return hasDefaultSlot.value || props.src || props.text || hasIcon.value
})

const rootClass = computed(() => {
  const classes = ['wd-avatar']
  if (props.shape) classes.push(`wd-avatar--${props.shape}`)
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (isDef(props.size)) {
    style.width = addUnit(props.size)
    style.height = addUnit(props.size)
  }
  if (props.bgColor) style['background-color'] = props.bgColor
  if (props.color) style.color = props.color
  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

function handleClick(event: any) {
  emit('click', event)
  emit('tap', event)
}

function handleError(event: any) {
  emit('error', event)
}
</script>

<template>
  <view v-if="isShow" :class="rootClass" :style="rootStyle" @tap="handleClick">
    <slot v-if="hasDefaultSlot" />
    <wd-img v-else-if="src" :src="src" mode="aspectFill" custom-class="wd-avatar__img" @error="handleError" />
    <text v-else-if="text" class="wd-avatar__text">{{ text }}</text>
    <wd-icon v-else-if="hasIcon" :name="icon" :class-prefix="iconPrefix" :css-icon="cssIcon" custom-class="wd-avatar__icon" />
  </view>
</template>

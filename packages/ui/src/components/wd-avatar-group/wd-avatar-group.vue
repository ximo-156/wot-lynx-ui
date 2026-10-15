/*
 * wd-avatar-group — 头像组
 *
 * Lynx 实现说明：
 * - 层叠展示（overlap）：子头像负外边距叠加；
 * - maxCount 限制展示个数，超出部分折叠为 "+N" 头像。
 */
<script lang="ts" setup>
import './index.css'

import { computed, useSlots } from 'vue-lynx'
import WdAvatar from '../wd-avatar/wd-avatar.vue'
import { avatarGroupProps } from './types'
import { addUnit, isDef } from '../../common/util'

const props = defineProps(avatarGroupProps)
const slots = useSlots()

const showCollapse = computed(() => props.maxCount > 0)

const collapseStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.overlap) {
    style['margin-left'] = '-8px'
  }
  return Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; ')
})

const rootClass = computed(() => {
  const classes = ['wd-avatar-group', `wd-avatar-group--${props.direction}`]
  if (props.overlap) classes.push('is-overlap')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})
</script>

<template>
  <view :class="rootClass" :style="customStyle">
    <slot />
    <wd-avatar
      v-if="showCollapse"
      :custom-style="collapseStyle"
      :text="collapseText"
      :shape="shape"
      :size="size"
      bg-color="#D3D7E0"
      color="#FFFFFF"
    />
  </view>
</template>

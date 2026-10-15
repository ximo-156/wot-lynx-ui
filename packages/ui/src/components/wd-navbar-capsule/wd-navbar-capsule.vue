/*
 * wd-navbar-capsule — 导航胶囊
 *
 * Lynx 实现说明：小程序风格「返回 + 分隔线 + 主页」胶囊按钮，
 * 供 navbar capsule 插槽使用。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { navbarCapsuleProps } from './types'

const props = defineProps(navbarCapsuleProps)
const emit = defineEmits(['back', 'home', 'click'])

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.bgColor) style['background-color'] = props.bgColor
  if (props.color) style.color = props.color
  return Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; ') + (props.customStyle ? `; ${props.customStyle}` : '')
})

function handleBack() {
  emit('back')
  emit('click', { type: 'back' })
}

function handleHome() {
  emit('home')
  emit('click', { type: 'home' })
}
</script>

<template>
  <view :class="`wd-navbar-capsule ${border ? 'is-border' : ''} ${customClass}`" :style="rootStyle">
    <view v-if="showBack" class="wd-navbar-capsule__item" @tap="handleBack">
      <wd-icon name="left" custom-class="wd-navbar-capsule__icon" />
    </view>
    <view v-if="showBack && showHome" class="wd-navbar-capsule__divider" />
    <view v-if="showHome" class="wd-navbar-capsule__item" @tap="handleHome">
      <wd-icon name="home" custom-class="wd-navbar-capsule__icon" />
    </view>
  </view>
</template>

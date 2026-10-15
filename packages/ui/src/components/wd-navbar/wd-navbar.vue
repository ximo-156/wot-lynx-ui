/*
 * wd-navbar — 导航栏
 *
 * Lynx 实现说明：左（箭头/文字/插槽）+ 中（标题）+ 右（文字/插槽）
 * 三段式；fixed 时 position: fixed 由引擎提升；安全区经 env() 叠加。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { navbarProps } from './types'
import { addUnit, isDef, filterStyle, parseStyle } from '../../common/util'

const props = defineProps(navbarProps)
const emit = defineEmits(['click-left', 'click-right'])

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.fixed) style['z-index'] = String(props.zIndex)
  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

function handleClickLeft() {
  if (!props.leftDisabled) emit('click-left')
}

function handleClickRight() {
  if (!props.rightDisabled) emit('click-right')
}
</script>

<template>
  <view :style="{ height: addUnit(isDef(height) ? height : 44) }">
    <view :class="`wd-navbar ${customClass} ${fixed ? 'is-fixed' : ''} ${bordered ? 'is-border' : ''} ${safeAreaInsetTop ? 'is-safe-top' : ''}`" :style="rootStyle">
      <view class="wd-navbar__content">
        <view v-if="$slots.capsule" class="wd-navbar__capsule">
          <slot name="capsule" />
        </view>
        <view v-else-if="!$slots.left" :class="`wd-navbar__left ${leftDisabled ? 'is-disabled' : ''}`" @tap="handleClickLeft">
          <wd-icon v-if="leftArrow" name="left" custom-class="wd-navbar__arrow" />
          <text v-if="leftText" class="wd-navbar__text">{{ leftText }}</text>
        </view>
        <view v-else :class="`wd-navbar__left ${leftDisabled ? 'is-disabled' : ''}`" @tap="handleClickLeft">
          <slot name="left" />
        </view>

        <view class="wd-navbar__title">
          <slot name="title" />
          <text v-if="!$slots.title && title" class="wd-navbar__title-text">{{ title }}</text>
        </view>

        <view v-if="$slots.right || rightText" :class="`wd-navbar__right ${rightDisabled ? 'is-disabled' : ''}`" @tap="handleClickRight">
          <slot name="right" />
          <text v-if="!$slots.right && rightText" class="wd-navbar__text">{{ rightText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

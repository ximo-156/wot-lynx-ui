/*
 * wd-password-input — 密码输入框
 *
 * Lynx 实现说明：
 * - 纯展示组件：N 个格子 + 光标 + 掩码圆点，聚焦事件经 touch  emit；
 * - 通常与 wd-keyboard 搭配使用（键盘输入密码）。
 */
<script lang="ts" setup>
import './index.css'

import { addUnit, parseStyle } from '../../common/util'
import { passwordInputProps } from './types'

defineProps(passwordInputProps)

const emit = defineEmits(['focus'])

function onTouchStart(event: any) {
  emit('focus', event)
}
</script>

<template>
  <view :class="`wd-password-input ${customClass}`" :style="parseStyle(customStyle)">
    <view class="wd-password-input__security" @touchstart="onTouchStart">
      <view
        v-for="(_, index) in length"
        :key="index"
        :class="[
          'wd-password-input__item',
          gutter ? '' : 'is-border',
          !gutter && index === 0 ? 'is-first' : '',
          !gutter && index === length - 1 ? 'is-last' : ''
        ]"
        :style="{ marginLeft: index !== 0 && gutter ? addUnit(gutter) : 0 }"
      >
        <view v-if="focused && index === modelValue.length" class="wd-password-input__cursor" />
        <view v-else class="wd-password-input__value">
          <view :style="{ visibility: mask && modelValue[index] ? 'visible' : 'hidden' }" class="wd-password-input__mask" />
          <text v-if="!mask && modelValue[index]">{{ modelValue[index] }}</text>
        </view>
      </view>
    </view>
    <view v-if="info || errorInfo" :class="`wd-password-input__info ${errorInfo ? 'is-error' : ''}`">
      <text>{{ errorInfo || info }}</text>
    </view>
  </view>
</template>

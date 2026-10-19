/*
 * wd-password-input — 密码输入框
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 纯展示组件：N 个格子 + 光标 + 掩码圆点，点击经 touchstart emit 'focus'；
 * - wot-ui 用 `:not(:last-child) { border-right: none }` 与 `:first-child` /
 *   `:last-child` 控制相邻格子的单线边框与端部圆角，Lynx 不支持结构伪类，
 *   改为模板按索引下发的 is-first / is-last 索引类名（见 index.scss）；
 * - customStyle 为字符串，经 parseStyle 归一为对象后绑定（CONVENTIONS §19）；
 * - modelValue 显式传入 null 时 Vue 不套用默认值，直接读 length / 索引会在
 *   渲染期崩溃，统一归一为字符串（空值 → ''）。
 */
<script lang="ts" setup>
import './index.css'

import { addUnit, parseStyle } from '../../common/util'
import { computed } from 'vue-lynx'
import { passwordInputProps } from './types'

const props = defineProps(passwordInputProps)

const emit = defineEmits(['focus'])

// Vue 只对 undefined 应用 prop 默认值，显式传入的 null 不套用：
// 模板直接读 modelValue.length / modelValue[index] 会在渲染期崩溃，
// 统一归一为字符串（空值 → ''）。
const value = computed(() => String(props.modelValue ?? ''))

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
        <view v-if="focused && index === value.length" class="wd-password-input__cursor" />
        <view v-else class="wd-password-input__value">
          <view :style="{ visibility: mask && value[index] ? 'visible' : 'hidden' }" class="wd-password-input__mask" />
          <text v-if="!mask && value[index]">{{ value[index] }}</text>
        </view>
      </view>
    </view>
    <view v-if="info || errorInfo" :class="`wd-password-input__info ${errorInfo ? 'is-error' : ''}`">
      <text>{{ errorInfo || info }}</text>
    </view>
  </view>
</template>

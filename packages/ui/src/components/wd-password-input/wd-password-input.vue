<template>
  <view :class="`wd-password-input ${customClass}`" :style="styleToObject(customStyle)">
    <view @touchstart="onTouchStart" class="wd-password-input__security">
      <view
        v-for="(_, index) in length"
        :key="index"
        :class="`wd-password-input__item ${gutter ? '' : 'is-border'} ${index === 0 ? 'is-first' : ''} ${
          index === length - 1 ? 'is-last' : ''
        }`"
        :style="{ marginLeft: index !== 0 && gutter ? addUnit(gutter) : 0 }"
      >
        <view v-if="focused && index === safeValue.length" class="wd-password-input__cursor"></view>
        <view v-else :class="`wd-password-input__value`">
          <view :style="{ visibility: mask && safeValue[index] ? 'visible' : 'hidden' }" class="wd-password-input__mask"></view>
          <text v-if="!mask && safeValue[index]"><text>{{ safeValue[index] }}</text></text>
        </view>
      </view>
    </view>
    <view v-if="info || errorInfo" :class="`wd-password-input__info ${errorInfo ? 'is-error' : ''}`">
      <text>{{ errorInfo || info }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import { computed } from 'vue-lynx'
import { styleToObject, addUnit } from '../../common/util'
import { passwordInputProps } from './types'

const props = defineProps(passwordInputProps)

const emit = defineEmits(['focus'])

/**
 * 安全取值：modelValue 可能被显式传 null（父级状态尚未初始化），
 * 模板中 modelValue.length / modelValue[index] 会抛 TypeError 并崩掉渲染路径。
 */
const safeValue = computed(() => (props.modelValue == null ? '' : String(props.modelValue)))

function onTouchStart(event: Event) {
  emit('focus', event)
}
</script>


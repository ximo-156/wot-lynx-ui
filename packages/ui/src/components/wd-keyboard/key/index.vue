/*
 * wd-key — 键盘按键
 *
 * Lynx 实现说明：
 * - 按压态用 :active（按键自身 active class 由 touch 驱动，滑动取消）；
 * - delete / extra 无文本时用内置 SVG 图标（del / keyboard）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import WdLoading from '../../wd-loading/wd-loading.vue'
import WdIcon from '../../wd-icon/wd-icon.vue'
import { useTouch } from '../../../composables/useTouch'
import { keyProps, type NumberKeyType } from './types'

const props = defineProps(keyProps)
const emit = defineEmits(['press'])

const touch = useTouch()
const active = ref<boolean>(false)

const keyClass = computed(() => {
  const classes = ['wd-key']
  if (props.large) classes.push('wd-key--large')
  if (props.type === 'delete') classes.push('wd-key--delete')
  if (props.type === 'close') classes.push('wd-key--close')
  if (props.isCar) classes.push('is-car')
  if (active.value) classes.push('wd-key--active')
  return classes.join(' ')
})

function onTouchStart(event: any) {
  touch.touchStart(event)
  active.value = true
}

function onTouchMove(event: any) {
  touch.touchMove(event)
  if (touch.direction.value) {
    active.value = false
  }
}

function onTouchEnd() {
  if (active.value) {
    active.value = false
    emit('press', props.text, props.type)
  }
}
</script>

<template>
  <view :class="`wd-key-wrapper ${wider ? 'wd-key-wrapper--wider' : ''}`" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
    <view :class="keyClass">
      <wd-loading custom-class="wd-key__loading-icon" v-if="loading" />
      <template v-if="type === 'delete'">
        <text v-if="text">{{ text }}</text>
        <wd-icon v-else custom-class="wd-key__icon" name="del" size="22px" />
      </template>
      <template v-else-if="type === 'extra'">
        <text v-if="text">{{ text }}</text>
        <wd-icon v-else custom-class="wd-key__icon" name="keyboard" size="22px" />
      </template>
      <text v-else>{{ text }}</text>
    </view>
  </view>
</template>

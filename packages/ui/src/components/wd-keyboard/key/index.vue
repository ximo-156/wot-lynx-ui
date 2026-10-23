/*
 * wd-key — 键盘按键
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 按压态由 touch 事件驱动的 wd-key--active 类切换（滑动取消），
 *   与 wot-ui 一致，不用 CSS :active（跟手态需可取消）；
 * - delete / extra 无文本时使用官方 del / keyboard 图标；
 * - 按键文本一律包在 text 元素中（Lynx 要求）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdLoading from '../../../primitives/wd-loading/wd-loading.vue'
import WdIcon from '../../../primitives/wd-icon/wd-icon.vue'
import { useTouch } from '../../../composables/useTouch'
import { keyProps, type NumberKeyType } from './types'

const props = defineProps(keyProps)
const emit = defineEmits(['press'])

const touch = useTouch()
const active = ref<boolean>(false)
watch([() => props.loading, () => props.text, () => props.type], () => { active.value = false }, { flush: 'sync' })

const keyClass = computed(() => {
  return `wd-key ${props.large ? 'wd-key--large' : ''} ${props.type === 'delete' ? 'wd-key--delete' : ''} ${
    props.type === 'close' ? 'wd-key--close' : ''
  } ${props.isCar ? 'is-car' : ''} ${active.value ? 'wd-key--active' : ''}`
})

/**
 * 触摸开始事件处理
 * @param {TouchEvent} event 触摸事件对象
 */
function onTouchStart(event: any) {
  if (props.loading) return
  touch.touchStart(event)
  active.value = true
}

/**
 * 触摸移动事件处理
 * @param {TouchEvent} event 触摸事件对象
 */
function onTouchMove(event: any) {
  touch.touchMove(event)
  if (touch.direction.value) {
    active.value = false
  }
}

/**
 * 触摸结束事件处理
 */
function onTouchEnd() {
  if (active.value && !props.loading) {
    active.value = false
    emit('press', props.text, props.type)
  }
}
</script>

<template>
  <view :class="`wd-key-wrapper ${wider ? 'wd-key-wrapper--wider' : ''}`" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="active = false">
    <view :class="keyClass">
      <WdLoading custom-class="wd-key__loading-icon" v-if="loading" />
      <template v-if="type === 'delete'">
        <text v-if="text">{{ text }}</text>
        <WdIcon v-else custom-class="wd-key__icon" name="del" size="22px" />
      </template>
      <template v-else-if="type === 'extra'">
        <text v-if="text">{{ text }}</text>
        <WdIcon v-else custom-class="wd-key__icon" name="keyboard" size="22px" />
      </template>
      <text v-else>{{ text }}</text>
    </view>
  </view>
</template>

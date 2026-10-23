/*
 * wd-overlay — 遮罩层
 *
 * Lynx 实现说明：
 * - 基于 WdTransition 的 fade 过渡，锁滚经 disable-touch-move 下发；
 *   不在包裹组件上重复绑定原生 touchmove（CONVENTIONS §14）。
 * - fixed 全屏定位；customStyle 的字符串和对象均经 parseStyle 归一。
 * - 引擎 tap 双轨转发为 click / tap，保留官方 API 并防止监听透传合并。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdTransition from '../wd-transition/wd-transition.vue'
import { overlayProps } from './types'
import { parseStyle } from '../../common/util'

const props = defineProps(overlayProps)
const emit = defineEmits([
  'click',
  'tap',
  'before-enter',
  'enter',
  'after-enter',
  'before-leave',
  'leave',
  'after-leave'
])

const transitionStyle = computed(() => ({ 'z-index': String(props.zIndex), ...parseStyle(props.customStyle) }))

function handleClick(event?: any) {
  emit('click')
  emit('tap', event)
}
</script>

<template>
  <WdTransition
    :show="show"
    name="fade"
    :custom-class="`wd-overlay ${customClass}`"
    :duration="duration"
    :custom-style="transitionStyle"
    :disable-touch-move="lockScroll"
    @before-enter="emit('before-enter')"
    @enter="emit('enter')"
    @after-enter="emit('after-enter')"
    @before-leave="emit('before-leave')"
    @leave="emit('leave')"
    @after-leave="emit('after-leave')"
    @tap="handleClick"
  >
    <slot />
  </WdTransition>
</template>

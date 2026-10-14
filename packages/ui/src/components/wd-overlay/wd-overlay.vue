/*
 * wd-overlay — 遮罩层
 *
 * Lynx 实现说明：
 * - 基于 wd-transition 的 fade 过渡，锁滚经 disable-touch-move 链路
 *   下发（CONVENTIONS §14：禁止在包裹层上补绑裸 @touchmove="noop"）；
 * - 定位用 position: fixed 全屏贴边，由引擎提升至页面根节点。
 */
<script lang="ts" setup>
import './index.css'

import WdTransition from '../wd-transition/wd-transition.vue'
import { overlayProps } from './types'

const props = defineProps(overlayProps)
const emit = defineEmits([
  'click',
  'before-enter',
  'enter',
  'after-enter',
  'before-leave',
  'leave',
  'after-leave'
])

function handleClick() {
  emit('click')
}
</script>

<template>
  <wd-transition
    :show="show"
    name="fade"
    :custom-class="`wd-overlay ${customClass}`"
    :duration="duration"
    :custom-style="`z-index: ${zIndex}; ${customStyle}`"
    :disable-touch-move="lockScroll"
    @before-enter="emit('before-enter')"
    @enter="emit('enter')"
    @after-enter="emit('after-enter')"
    @before-leave="emit('before-leave')"
    @leave="emit('leave')"
    @after-leave="emit('after-leave')"
    @click="handleClick"
  >
    <slot />
  </wd-transition>
</template>

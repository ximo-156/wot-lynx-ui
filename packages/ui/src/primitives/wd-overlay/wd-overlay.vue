/*
 * wd-overlay — 遮罩层
 *
 * Lynx 实现说明：
 * - 基于 WdTransition 的 fade 过渡；disable-touch-move 只建立冒泡 catch 边界，
 *   原生默认滚动由 useLockScroll + 宿主 scroll-enable 通道关闭。
 *   不在包裹组件上重复绑定原生 touchmove（CONVENTIONS §14）。
 * - Popup 与其遮罩共享 owner，独立遮罩自己持有 lease；leave 完成/卸载才释放。
 * - fixed 全屏定位；customStyle 的字符串和对象均经 parseStyle 归一。
 * - 引擎 tap 双轨转发为 click / tap，保留官方 API 并防止监听透传合并。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject, ref, watch } from 'vue-lynx'
import WdTransition from '../wd-transition/wd-transition.vue'
import { overlayProps } from './types'
import { parseStyle } from '../../common/util'
import { createStyleResolver } from '../../common/style'
import { SCROLL_LOCK_OWNER_KEY, useLockScroll } from '../../composables/useLockScroll'

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

// show=false 只是开始 leave；仍在场时继续占用 lease，最后一层离场后才解锁。
const inPlace = ref(props.show)
watch(() => props.show, (show) => { if (show) inPlace.value = true }, { flush: 'sync' })
useLockScroll(() => props.lockScroll && inPlace.value, inject(SCROLL_LOCK_OWNER_KEY, undefined))

const resolveTransitionStyle = createStyleResolver({ 'z-index': '1' })
const transitionStyle = computed(() => resolveTransitionStyle(
  { 'z-index': String(props.zIndex) }, parseStyle(props.customStyle)
))

function handleAfterLeave() {
  // 重开会取消 leave；即使宿主晚到一条旧回调，也不能释放新一轮展示的锁。
  if (!props.show) inPlace.value = false
  emit('after-leave')
}

function handleClick(event?: any) {
  // click 与 tap 同源同载荷：wot-ui 的 @click 消费方常读事件对象，
  // 丢载荷会让两条轨行为不对称。
  emit('click', event)
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
    @after-leave="handleAfterLeave"
    @tap="handleClick"
  >
    <slot />
  </WdTransition>
</template>

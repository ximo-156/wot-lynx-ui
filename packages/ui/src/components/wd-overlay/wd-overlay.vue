/*
 * wd-overlay — 遮罩层
 *
 * Lynx 实现说明：
 * - 基于 wd-transition 的 fade 过渡，锁滚经 disable-touch-move 链路
 *   下发（CONVENTIONS §14：禁止在包裹层上补绑裸 @touchmove="noop"）；
 * - 定位用 position: fixed 全屏贴边，由引擎提升至页面根节点；
 * - 点击事件双轨 emit：transition 根 view 派发的是引擎原生 tap（Lynx
 *   view 不派发 click，e2931b8 的 @click 方案曾致遮罩点击全端失效，
 *   2026-10-16 真机核实），此处重新 emit 为 click（与 wot-ui API 对齐）
 *   与 tap（Lynx 惯用法，同 wd-button / wd-cell）；两者均在 emits 声明，
 *   消费方绑定不会穿透到根元素与内部 @tap 合并（§14 注册表崩溃）。
 */
<script lang="ts" setup>
import './index.css'

import WdTransition from '../wd-transition/wd-transition.vue'
import { overlayProps } from './types'

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

function handleClick(e?: any) {
  emit('click', e)
  emit('tap', e)
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
    @tap="handleClick"
  >
    <slot />
  </wd-transition>
</template>

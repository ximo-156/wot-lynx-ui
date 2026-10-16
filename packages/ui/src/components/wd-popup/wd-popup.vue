/*
 * wd-popup — 弹出层
 *
 * Lynx 实现说明：
 * - 结构：wd-root-portal（可选）> wd-popup-wrapper > [wd-overlay + wd-transition]；
 * - position: fixed 由引擎提升至页面根节点，无需 teleport；
 * - 锁滚经 overlay 的 disable-touch-move 链路，禁止在包裹层补绑
 *   @touchmove="noop"（CONVENTIONS §14 事件注册表崩溃）。
 * - 遮罩点击关闭绑 @click / @tap 均可：WdOverlay 把 transition 根 view 的
 *   引擎原生 tap 重新 emit 为 click 与 tap（Lynx view 不派发 click，只派发
 *   tap，CONVENTIONS §14）。e2931b8 一度要求只绑 @click，但 click 在全端
 *   都不会派发，遮罩点击是死链——2026-10-16 真机核实后已订正。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
import WdRootPortal from '../wd-root-portal/wd-root-portal.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { popupProps, type PopupType } from './types'
import type { TransitionName } from '../wd-transition/types'
import { parseStyle } from '../../common/util'

const props = defineProps(popupProps)
const emit = defineEmits([
  'update:modelValue',
  'before-enter',
  'enter',
  'after-enter',
  'before-leave',
  'leave',
  'after-leave'
])

const transitionName = computed<TransitionName>(() => {
  if (props.transition) return props.transition
  const map: Record<PopupType, TransitionName> = {
    center: 'zoom-out',
    top: 'slide-down',
    bottom: 'slide-up',
    left: 'slide-left',
    right: 'slide-right'
  }
  return map[props.position]
})

const rootClass = computed(() => {
  const classes = ['wd-popup', `wd-popup--${props.position}`]
  if (props.round) classes.push('is-round')
  if (props.safeAreaInsetBottom) classes.push('is-safe-area')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const style = computed<Record<string, string>>(() => {
  return { 'z-index': String(props.zIndex), ...parseStyle(props.customStyle) }
})

function handleClickModal() {
  if (props.closeOnClickModal) {
    emit('update:modelValue', false)
  }
}

function close() {
  emit('update:modelValue', false)
}

function noop() {}
</script>

<template>
  <wd-root-portal v-if="rootPortal">
    <view class="wd-popup-wrapper">
      <wd-overlay
        v-if="modal"
        :show="modelValue"
        :z-index="zIndex"
        :lock-scroll="lockScroll"
        :duration="duration"
        :custom-style="modalStyle"
        @click="handleClickModal"
      />
      <wd-transition
        :lazy-render="lazyRender"
        :custom-class="rootClass"
        :custom-style="style"
        :duration="duration"
        :show="modelValue"
        :name="transitionName"
        :destroy="hideWhenClose"
        @before-enter="emit('before-enter')"
        @enter="emit('enter')"
        @after-enter="emit('after-enter')"
        @before-leave="emit('before-leave')"
        @leave="emit('leave')"
        @after-leave="emit('after-leave')"
      >
        <slot />
        <wd-icon v-if="closable" custom-class="wd-popup__close" name="close" @tap="close" />
      </wd-transition>
    </view>
  </wd-root-portal>

  <view v-else class="wd-popup-wrapper">
    <wd-overlay
      v-if="modal"
      :show="modelValue"
      :z-index="zIndex"
      :lock-scroll="lockScroll"
      :duration="duration"
      :custom-style="modalStyle"
      @click="handleClickModal"
    />
    <wd-transition
      :lazy-render="lazyRender"
      :custom-class="rootClass"
      :custom-style="style"
      :duration="duration"
      :show="modelValue"
      :name="transitionName"
      :destroy="hideWhenClose"
      @before-enter="emit('before-enter')"
      @enter="emit('enter')"
      @after-enter="emit('after-enter')"
      @before-leave="emit('before-leave')"
      @leave="emit('leave')"
      @after-leave="emit('after-leave')"
    >
      <slot />
      <wd-icon v-if="closable" custom-class="wd-popup__close" name="close" @tap="close" />
    </wd-transition>
  </view>
</template>

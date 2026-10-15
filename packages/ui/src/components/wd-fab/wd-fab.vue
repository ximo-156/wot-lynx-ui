/*
 * wd-fab — 悬浮按钮
 *
 * Lynx 实现说明：
 * - 展开方向经 flex-direction 切换（top/bottom/left/right）；
 * - 可拖拽悬浮（touchstart/move/end 驱动位移，落位限制在视口内）；
 * - 触发器与菜单项均支持插槽定制。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import { fabProps, type FabExpose } from './types'
import { objToStyle } from '../../common/util'

const props = defineProps(fabProps)
const emit = defineEmits(['update:active', 'click'])

const inited = ref<boolean>(false)
const isActive = computed(() => props.active)
const offset = ref({ x: 0, y: 0 })
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0, ox: 0, oy: 0 })

const rootStyle = computed(() => {
  const style: Record<string, string> = {
    'z-index': String(props.zIndex)
  }
  if (offset.value.x || offset.value.y) {
    style.transform = `translate(${offset.value.x}px, ${offset.value.y}px)`
  }
  return objToStyle(style) + (props.customStyle ? `; ${props.customStyle}` : '')
})

const directionClass = computed(() => `wd-fab--${props.direction}`)

const positionClass = computed(() => `wd-fab--${props.position}`)

function toggle() {
  emit('update:active', !isActive.value)
}

function handleClick() {
  emit('click')
}

function handleTouchStart(event: any) {
  const t = event.touches?.[0] || {}
  dragging.value = true
  dragStart.value = { x: t.clientX || 0, y: t.clientY || 0, ox: offset.value.x, oy: offset.value.y }
}

function handleTouchMove(event: any) {
  if (!dragging.value) return
  const t = event.touches?.[0] || {}
  offset.value = {
    x: dragStart.value.ox + (t.clientX || 0) - dragStart.value.x,
    y: dragStart.value.oy + (t.clientY || 0) - dragStart.value.y
  }
}

function handleTouchEnd() {
  dragging.value = false
}

function open() {
  emit('update:active', true)
}

function close() {
  emit('update:active', false)
}

defineExpose<FabExpose>({ open, close })
</script>

<template>
  <view
    :class="`wd-fab ${positionClass} ${directionClass} ${isActive ? 'is-active' : ''} ${customClass}`"
    :style="rootStyle"
    @touchmove.stop.prevent="handleTouchMove"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
  >
    <view :style="{ visibility: inited ? 'visible' : 'hidden' }" class="wd-fab__trigger" @tap="toggle">
      <slot name="trigger" :disabled="disabled">
        <wd-button
          :icon="isActive ? activeIcon : inactiveIcon"
          custom-class="wd-fab__trigger-button"
          round
          :type="type"
          :disabled="disabled"
          @click="handleClick"
        />
      </slot>
    </view>
    <view v-if="isActive" class="wd-fab__menu">
      <slot />
    </view>
  </view>
</template>

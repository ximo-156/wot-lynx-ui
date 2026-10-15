/*
 * wd-floating-panel — 浮动面板
 *
 * Lynx 实现说明：拖拽手柄 + 多锚点吸附；
 * 拖动状态在后台线程 ref 中维护，落位吸附用 transition
 * （不用 MTS，CONVENTIONS §10）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import { floatingPanelProps } from './types'

const props = defineProps(floatingPanelProps)
const emit = defineEmits(['heightChange', 'anchorChange'])

const currentHeight = ref(props.height)
const dragging = ref(false)
const startY = ref(0)
const startHeight = ref(0)

const anchors = computed(() => {
  const list = props.anchors.length > 0 ? props.anchors : [props.height]
  return [...list].sort((a, b) => a - b)
})

const panelStyle = computed(() => {
  return `height: ${currentHeight.value}px;${dragging.value ? '' : `transition: height ${props.duration}ms cubic-bezier(0.645, 0.045, 0.355, 1);`}${props.customStyle || ''}`
})

function onTouchStart(event: any) {
  dragging.value = true
  startY.value = Number(event.touches?.[0]?.clientY || 0)
  startHeight.value = currentHeight.value
}

function onTouchMove(event: any) {
  if (!dragging.value) return
  const y = Number(event.touches?.[0]?.clientY || 0)
  const delta = startY.value - y
  const next = Math.min(Math.max(startHeight.value + delta, 0), 9999)
  currentHeight.value = next
}

function onTouchEnd() {
  if (!dragging.value) return
  dragging.value = false
  // 吸附到最近锚点
  const target = anchors.value.reduce((prev, curr) =>
    Math.abs(curr - currentHeight.value) < Math.abs(prev - currentHeight.value) ? curr : prev
  )
  currentHeight.value = target
  emit('heightChange', { height: target })
  emit('anchorChange', { anchor: target })
}
</script>

<template>
  <view :class="`wd-floating-panel ${safeAreaInsetBottom ? 'is-safe-area' : ''} ${customClass}`" :style="panelStyle">
    <view class="wd-floating-panel__header" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd">
      <view class="wd-floating-panel__handle" />
    </view>
    <scroll-view scroll-y class="wd-floating-panel__content" :show-scrollbar="showScrollbar">
      <slot />
    </scroll-view>
  </view>
</template>

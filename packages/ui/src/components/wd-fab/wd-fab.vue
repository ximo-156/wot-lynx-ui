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

import { computed, onMounted, ref } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import { fabProps, type FabExpose } from './types'
import { filterStyle, getRect, parseStyle, uuid } from '../../common/util'
import { useDeviceInfo } from '../../composables/useDeviceInfo'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(fabProps)
const emit = defineEmits(['update:active', 'click', 'touchstart', 'touchmove', 'touchend'])

/** 实例唯一类名（视口钳制度量用） */
const instanceId = `wd-fab-${uuid()}`

const isAlive = useAlive()

const inited = ref<boolean>(false)
const isActive = computed(() => props.active)
const offset = ref({ x: 0, y: 0 })
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0, ox: 0, oy: 0 })

const { windowWidth, windowHeight } = useDeviceInfo()

// 首帧后展示触发器：避免度量/定位完成前的闪烁（对齐 wot-ui 的 inited 语义）
onMounted(() => {
  inited.value = true
})

const rootStyle = computed(() => {
  const style: Record<string, string> = {
    'z-index': String(props.zIndex)
  }
  // transform 必须**无条件**写入（含位移归零态）：Lynx 的 SetStyle 是逐属性合并
  // 语义，省略该键不会清除已应用的内联位移。旧实现在 offset 为 (0,0) 时省略
  // transform，而 clampToViewport 会在 maxX/maxY 为 0（按钮尺寸大于视口）时把
  // offset 归零 → 视觉位移残留、与模型不一致。
  style.transform = `translate(${offset.value.x}px, ${offset.value.y}px)`
  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

const directionClass = computed(() => `wd-fab--${props.direction}`)

const positionClass = computed(() => `wd-fab--${props.position}`)

function toggle() {
  if (props.disabled) return
  emit('update:active', !isActive.value)
}

function handleClick() {
  emit('click')
}

function handleTouchStart(event: any) {
  emit('touchstart', event)
  // 禁用态不参与拖拽（仍转发原生 touchstart）
  if (props.disabled) return
  const t = event.touches?.[0] || {}
  dragging.value = true
  dragStart.value = { x: t.clientX || 0, y: t.clientY || 0, ox: offset.value.x, oy: offset.value.y }
}

function handleTouchMove(event: any) {
  emit('touchmove', event)
  if (props.disabled || !dragging.value) return
  const t = event.touches?.[0] || {}
  offset.value = {
    x: dragStart.value.ox + (t.clientX || 0) - dragStart.value.x,
    y: dragStart.value.oy + (t.clientY || 0) - dragStart.value.y
  }
}

function handleTouchEnd(event?: any) {
  emit('touchend', event)
  dragging.value = false
  clampToViewport()
}

/** 松手后把悬浮按钮钳制在视口内（对齐 wot-ui 的落位限制，防止拖出屏幕无法拖回） */
function clampToViewport() {
  if (!offset.value.x && !offset.value.y) return
  // getRect 契约是「永不 reject」（util.ts），无需 .catch；回调晚于卸载落地时
  // 丢弃——在已销毁树上写 ref 会触发晚到 patch（真机 9902 家族）。
  getRect(`.${instanceId}`).then((rect) => {
    if (!isAlive()) return
    const w = Number(rect?.width) || 0
    const h = Number(rect?.height) || 0
    if (!w || !h) return
    const maxX = Math.max(windowWidth.value - w - props.gap * 2, 0)
    const maxY = Math.max(windowHeight.value - h - props.gap * 2, 0)
    offset.value = {
      x: Math.min(Math.max(offset.value.x, -maxX), maxX),
      y: Math.min(Math.max(offset.value.y, -maxY), maxY)
    }
  })
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
    <view :style="{ visibility: inited ? 'visible' : 'hidden' }" :class="`wd-fab__trigger ${instanceId}`" @tap="toggle">
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

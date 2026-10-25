/*
 * wd-fab — 悬浮按钮
 *
 * 拖拽为后台 touchmove 状态驱动（2026-10-25 真机巡检回归）：起点在
 * touchstart 记录（触点 + 当时 left/top），move 按触点差量直写 left/top
 * （跟手期 transition 显式 none），结束/取消的后台度量按手势代次提交，
 * 旧起点、旧落定位或卸载后的回调不能污染新手势。此前版本的
 * main-thread-bindtouch* worklet 跟手在真机与触发器 tap 合成互扰（展开 /
 * 收起点击无响应），与 wot-ui 对齐退回纯后台拖拽。gap/布局重新缓存边界，
 * draggable 实时下发。页面空白关闭仍依赖宿主 useQueue 点击链路。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue-lynx'
import WdButton from '../../primitives/wd-button/wd-button.vue'
import WdTransition from '../../primitives/wd-transition/wd-transition.vue'
import { fabProps, type FabExpose } from './types'
import { getRect, getSystemInfo, parseStyle, uuid } from '../../common/util'
import { useRaf } from '../../composables/useRaf'
import { closeOther, pushToQueue, removeFromQueue } from '../../common/clickoutside'
import { type Queue, queueKey } from '../../composables/useQueue'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(fabProps)
const emit = defineEmits(['update:active', 'click', 'tap', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'layoutchange'])
const triggerId = `wd-fab-trigger-${uuid()}`
const queue = inject<Queue | null>(queueKey, null)
const { proxy } = getCurrentInstance() as any
const disposed = ref(false)
const mounted = ref(false)
const inited = ref(false)
const isActive = ref(props.active)
const fabDirection = ref(props.direction)
const top = ref(0)
const left = ref(0)
const screen = reactive({ width: 0, height: 0 })
const fabSize = reactive({ width: 60, height: 60 })
const bounding = reactive({ minTop: 0, minLeft: 0, maxTop: 0, maxLeft: 0 })
const attractTransition = ref(false)
const dragging = ref(false)
const geometryRevision = ref(0)
const gestureRevision = ref(0)
const configEpoch = ref(0)
const commitTick = ref(0)
const manuallyPositioned = ref(false)

watch(() => props.active, (value) => { isActive.value = value })
watch(isActive, (value) => {
  if (!value) return
  if (queue?.closeOther) queue.closeOther(proxy)
  else closeOther(proxy)
})
watch(() => props.direction, (value) => { fabDirection.value = value })
function numericGap(value: number | undefined) {
  return value !== undefined && Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 16
}
function updateBounds() {
  const sys = getSystemInfo()
  screen.width = sys.windowWidth
  screen.height = sys.windowHeight
  bounding.minTop = Math.min(numericGap(props.gap.top), Math.max(0, screen.height - fabSize.height))
  bounding.minLeft = Math.min(numericGap(props.gap.left), Math.max(0, screen.width - fabSize.width))
  bounding.maxLeft = Math.max(bounding.minLeft, screen.width - fabSize.width - numericGap(props.gap.right))
  bounding.maxTop = Math.max(bounding.minTop, screen.height - fabSize.height - numericGap(props.gap.bottom))
}
function initPosition() {
  const pos = props.position
  const centerY = (bounding.maxTop + bounding.minTop) / 2
  const centerX = (bounding.maxLeft + bounding.minLeft) / 2
  left.value = pos.startsWith('left-') ? bounding.minLeft : pos.startsWith('right-') ? bounding.maxLeft : centerX
  top.value = pos.endsWith('-top') || pos === 'top-center' ? bounding.minTop
    : pos.endsWith('-bottom') || pos === 'bottom-center' ? bounding.maxTop : centerY
  commitTick.value++
}
function clampPosition() {
  left.value = Math.min(Math.max(left.value, bounding.minLeft), bounding.maxLeft)
  top.value = Math.min(Math.max(top.value, bounding.minTop), bounding.maxTop)
  commitTick.value++
}
async function measureGeometry() {
  if (!mounted.value || disposed.value) return
  const revision = ++geometryRevision.value
  await nextTick()
  if (disposed.value || revision !== geometryRevision.value) return
  const rect = await getRect(`.${triggerId}`, false, proxy)
  if (disposed.value || revision !== geometryRevision.value) return
  fabSize.width = Number(rect.width) > 0 ? Number(rect.width) : fabSize.width
  fabSize.height = Number(rect.height) > 0 ? Number(rect.height) : fabSize.height
  updateBounds()
  if (!dragging.value) {
    if (!manuallyPositioned.value) initPosition()
    else clampPosition()
  }
  inited.value = true
}
function invalidateGesture() {
  gestureRevision.value++
  configEpoch.value++
  dragging.value = false
  attractTransition.value = false
  commitTick.value++
}
watch(() => props.position, () => {
  invalidateGesture()
  manuallyPositioned.value = false
  updateBounds()
  initPosition()
  void measureGeometry()
})
watch(() => props.gap, () => {
  invalidateGesture()
  updateBounds()
  if (!manuallyPositioned.value) initPosition()
  else clampPosition()
  void measureGeometry()
}, { deep: true })
watch(() => props.draggable, () => { invalidateGesture() })
watch(() => props.customStyle, () => {
  invalidateGesture()
  void measureGeometry()
}, { deep: true })
function handleLayoutChange(event: any) {
  emit('layoutchange', event)
  void measureGeometry()
}

const ROOT_STYLE = defineStyleKeys({ top: '0px', left: '0px', transition: 'none', 'z-index': '' })
const rootStyle = computed(() => {
  void commitTick.value
  return {
    ...resolveStyle(ROOT_STYLE, {
      top: `${top.value}px`, left: `${left.value}px`,
      transition: attractTransition.value ? 'all ease 0.3s' : 'none',
      'z-index': props.zIndex
    }),
    ...parseStyle(props.customStyle)
  }
})
/** 拖拽起点（触点 + 当时 left/top）：touchstart 写、touchmove 读、touchend 清 */
const dragStartRef: { current: { x: number; y: number; left: number; top: number } | null } = { current: null }
function handleTouchStart(event: any) {
  emit('touchstart', event)
  gestureRevision.value++ // 作废上一手势仍在等待的落定查询。
  dragging.value = props.draggable && inited.value
  if (dragging.value) {
    const touch = event.touches && event.touches[0]
    if (touch) {
      dragStartRef.current = {
        x: Number(touch.clientX), y: Number(touch.clientY),
        left: left.value, top: top.value
      }
    }
  }
}
/** 后台跟手：触点差量直写 left/top（transition 由 attractTransition=false 保证为 none） */
function handleTouchMove(event: any) {
  emit('touchmove', event)
  const start = dragStartRef.current
  if (!dragging.value || !start) return
  const touch = event.touches && event.touches[0]
  if (!touch) return
  const x = Number(touch.clientX)
  const y = Number(touch.clientY)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  left.value = Math.min(Math.max(start.left + (x - start.x), bounding.minLeft), bounding.maxLeft)
  top.value = Math.min(Math.max(start.top + (y - start.y), bounding.minTop), bounding.maxTop)
  commitTick.value++
}
async function finishGesture(event: any, canceled: boolean) {
  emit(canceled ? 'touchcancel' : 'touchend', event)
  dragging.value = false
  dragStartRef.current = null
  if (!props.draggable || !inited.value) return
  const revision = ++gestureRevision.value
  const epoch = configEpoch.value
  const rect = await getRect(`.${triggerId}`, false, proxy)
  if (disposed.value || revision !== gestureRevision.value || epoch !== configEpoch.value || !props.draggable) return
  const rectTop = Number(rect.top)
  const rectLeft = Number(rect.left)
  top.value = Math.min(Math.max(Number.isFinite(rectTop) ? rectTop : top.value, bounding.minTop), bounding.maxTop)
  const center = (Number.isFinite(rectLeft) ? rectLeft : left.value) + (Number(rect.width) > 0 ? Number(rect.width) : fabSize.width) / 2
  if (center < screen.width / 2) {
    left.value = bounding.minLeft
    fabDirection.value = 'right'
  } else {
    left.value = bounding.maxLeft
    fabDirection.value = 'left'
  }
  manuallyPositioned.value = true
  attractTransition.value = true
  commitTick.value++
}
function handleTouchEnd(event: any) { void finishGesture(event, false) }
function handleTouchCancel(event: any) { void finishGesture(event, true) }

const { start: startInit, cancel: cancelInit } = useRaf(() => measureGeometry())
onMounted(() => {
  mounted.value = true
  if (queue?.pushToQueue) queue.pushToQueue(proxy)
  else pushToQueue(proxy)
  updateBounds()
  startInit()
})
onBeforeUnmount(() => {
  disposed.value = true
  geometryRevision.value++
  gestureRevision.value++
  cancelInit()
  if (queue?.removeFromQueue) queue.removeFromQueue(proxy)
  else removeFromQueue(proxy)
})
function handleClick() {
  if (props.disabled) return
  if (!props.expandable) { emit('click'); return }
  isActive.value = !isActive.value
  emit('update:active', isActive.value)
}
function open() { isActive.value = true; emit('update:active', true) }
function close() { isActive.value = false; emit('update:active', false) }
defineExpose<FabExpose>({ open, close })
</script>

<template>
  <view
    @touchmove.stop.prevent="handleTouchMove"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel"
    :class="`wd-fab ${customClass}`"
    :style="rootStyle"
    @tap.stop="emit('tap', $event)"
  >
    <view
      @tap.stop=""
      :style="{ visibility: inited ? 'visible' : 'hidden' }"
      :class="triggerId"
      @layoutchange="handleLayoutChange"
    >
      <slot name="trigger" :disabled="disabled">
        <WdButton
          @click="handleClick"
          :icon="isActive ? activeIcon : inactiveIcon"
          custom-class="wd-fab__trigger"
          round
          :type="type"
          :disabled="disabled"
        />
      </slot>
    </view>
    <WdTransition
      v-if="expandable"
      :enter-class="`wd-fab__transition-enter--${fabDirection}`"
      enter-active-class="wd-fab__transition-enter-active"
      :leave-to-class="`wd-fab__transition-leave-to--${fabDirection}`"
      leave-active-class="wd-fab__transition-leave-active"
      :custom-class="`wd-fab__actions wd-fab__actions--${fabDirection}`"
      :show="isActive"
      :duration="300"
    >
      <slot />
    </WdTransition>
  </view>
</template>

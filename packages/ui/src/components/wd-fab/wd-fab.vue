/*
 * wd-fab — 悬浮按钮
 *
 * 触发器声明式 MTS 跟手：起点用已提交坐标缓存立即响应，并在 touchstart
 * 度量一次校正；move 仅读缓存与实时属性。结束/取消的后台度量按手势代次
 * 提交，旧起点、旧落定位或卸载后的回调不能污染新手势。gap/布局重新缓存
 * 边界，draggable 实时下发。页面空白关闭仍依赖宿主 useQueue 点击链路。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, useMainThreadRef } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
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
function handleTouchStart(event: any) {
  emit('touchstart', event)
  gestureRevision.value++ // 作废上一手势仍在等待的落定查询。
  dragging.value = props.draggable && inited.value
  // transition 由 worklet 切换；此处不重写旧 top/left，避免跟手回跳。
}
function handleTouchMove(event: any) { emit('touchmove', event) }
async function finishGesture(event: any, canceled: boolean) {
  emit(canceled ? 'touchcancel' : 'touchend', event)
  dragging.value = false
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

interface MtElement {
  setStyleProperty(name: string, value: string): void
  getAttribute(name: string): string | null
  invoke(method: string, params?: any): Promise<any>
}
const fabRef = useMainThreadRef<MtElement | null>(null)
const geomRef = useMainThreadRef<{ offsetX: number; offsetY: number; epoch: string | null; moved: boolean } | null>(null)
const onTriggerTouchStart = (event: any) => {
  'main thread'
  geomRef.current = null
  const fab = fabRef.current
  const touch = event.touches && event.touches[0]
  if (!fab || !touch || fab.getAttribute('drag-enabled') !== 'true') return
  const x = Number(touch.clientX)
  const y = Number(touch.clientY)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  const geom = {
    offsetX: x - Number(fab.getAttribute('origin-left')),
    offsetY: y - Number(fab.getAttribute('origin-top')),
    epoch: fab.getAttribute('geometry-epoch'),
    moved: false
  }
  geomRef.current = geom
  fab.setStyleProperty('transition', 'none')
  if (typeof fab.invoke !== 'function') return
  fab.invoke('boundingClientRect').then((rect: any) => {
    if (fabRef.current !== fab || geomRef.current !== geom || geom.moved || fab.getAttribute('drag-enabled') !== 'true' || geom.epoch !== fab.getAttribute('geometry-epoch')) return
    const rectLeft = Number(rect?.left)
    const rectTop = Number(rect?.top)
    if (Number(rect?.width) > 0 && Number.isFinite(rectLeft) && Number.isFinite(rectTop)) {
      geom.offsetX = x - rectLeft
      geom.offsetY = y - rectTop
    }
  }, () => {})
}
const onTriggerTouchMove = (event: any) => {
  'main thread'
  const fab = fabRef.current
  const geom = geomRef.current
  const touch = event.touches && event.touches[0]
  if (!fab || !geom || !touch || fab.getAttribute('drag-enabled') !== 'true' || geom.epoch !== fab.getAttribute('geometry-epoch')) return
  const minLeft = Number(fab.getAttribute('drag-min-left'))
  const maxLeft = Number(fab.getAttribute('drag-max-left'))
  const minTop = Number(fab.getAttribute('drag-min-top'))
  const maxTop = Number(fab.getAttribute('drag-max-top'))
  const x = Number(touch.clientX) - geom.offsetX
  const y = Number(touch.clientY) - geom.offsetY
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(minLeft) || !Number.isFinite(minTop) || maxLeft < minLeft || maxTop < minTop) return
  geom.moved = true
  fab.setStyleProperty('transition', 'none')
  fab.setStyleProperty('left', `${Math.min(Math.max(x, minLeft), maxLeft)}px`)
  fab.setStyleProperty('top', `${Math.min(Math.max(y, minTop), maxTop)}px`)
}
const onTriggerTouchFinish = () => {
  'main thread'
  geomRef.current = null
}
const dragBoundAttrs = computed(() => ({
  'drag-min-left': String(bounding.minLeft), 'drag-max-left': String(bounding.maxLeft),
  'drag-min-top': String(bounding.minTop), 'drag-max-top': String(bounding.maxTop),
  'origin-left': String(left.value), 'origin-top': String(top.value),
  'drag-enabled': String(props.draggable && inited.value), 'geometry-epoch': String(configEpoch.value)
}))
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
    :main-thread-ref="fabRef"
    v-bind="dragBoundAttrs"
  >
    <view
      @tap.stop=""
      :style="{ visibility: inited ? 'visible' : 'hidden' }"
      :class="triggerId"
      :main-thread-bindtouchstart="onTriggerTouchStart"
      :main-thread-bindtouchmove="onTriggerTouchMove"
      :main-thread-bindtouchend="onTriggerTouchFinish"
      :main-thread-bindtouchcancel="onTriggerTouchFinish"
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

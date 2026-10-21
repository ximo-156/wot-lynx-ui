/*
 * wd-swipe-action — 滑动操作
 *
 * 声明式 MTS 在根节点记录触点/跟手，后台 wrapper 仅记录落定所需坐标、
 * 转发事件和提交。操作区按实例缓存度量；挂载、布局、配置和手势开始刷新，
 * touchmove 不查询节点。异步度量与 beforeClose 都有卸载/代次守卫。
 * Lynx 无按方向动态 catch，纵向手势保持可滚动，横向滚动仲裁需宿主验证。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, watch, useMainThreadRef } from 'vue-lynx'
import { swipeActionProps, type SwipeActionEmits, type SwipeActionExpose, type SwipeActionPosition, type SwipeActionReason, type SwipeActionStatus } from './types'
import { closeOther, pushToQueue, removeFromQueue } from '../../common/clickoutside'
import { callInterceptor } from '../../common/interceptor'
import { getRect, parseStyle, uuid } from '../../common/util'
import { type Queue, queueKey } from '../../composables/useQueue'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(swipeActionProps)
const emit = defineEmits<SwipeActionEmits & { tap: [event: any]; touchstart: [event: any]; touchmove: [event: any]; touchend: [event?: any]; touchcancel: [event?: any]; layoutchange: [event: any] }>()
const { proxy } = getCurrentInstance() as any
const queue = inject<Queue | null>(queueKey, null)
const instanceId = `wd-swipe-action-${uuid()}`
const disposed = ref(false)
const mounted = ref(false)
const measureRevision = ref(0)
const stateRevision = ref(0)
const commitTick = ref(0)
const settled = ref<SwipeActionStatus>(props.modelValue)
const originOffset = ref(0)
const wrapperOffset = ref(0)
const touching = ref(false)
const gestureStart = ref<{ clientX: number; clientY: number; lastX: number; lastY: number } | null>(null)
const leftWidth = ref(0)
const rightWidth = ref(0)
const rootStyle = computed(() => parseStyle(props.customStyle))
const WRAPPER_STYLE = defineStyleKeys({ transform: 'translateX(0px)', transition: 'none' })
const wrapperStyle = computed(() => {
  void commitTick.value
  return resolveStyle(WRAPPER_STYLE, {
    transform: `translateX(${wrapperOffset.value}px)`,
    transition: 'transform 0.6s cubic-bezier(0.18, 0.89, 0.32, 1)'
  })
})
function offsetFor(value: SwipeActionStatus) {
  return value === 'left' ? leftWidth.value : value === 'right' ? -rightWidth.value : 0
}
function swipeMove(offset = 0) {
  wrapperOffset.value = offset
  commitTick.value++ // 同值落定也必须覆盖 worklet 直改值并恢复 transition。
}
function clampOffset(offset: number) {
  return Math.min(Math.max(offset, -rightWidth.value), leftWidth.value)
}

async function measureWidths() {
  if (!mounted.value || disposed.value) return
  const revision = ++measureRevision.value
  await nextTick()
  if (disposed.value || revision !== measureRevision.value) return
  const [left, right] = await Promise.all([
    getRect(`.${instanceId}__left`, false, proxy),
    getRect(`.${instanceId}__right`, false, proxy)
  ])
  if (disposed.value || revision !== measureRevision.value) return
  leftWidth.value = Math.max(0, Number(left.width) || 0)
  rightWidth.value = Math.max(0, Number(right.width) || 0)
  if (!touching.value && !props.disabled) swipeMove(offsetFor(settled.value))
}
function handleLayoutChange(event: any) {
  emit('layoutchange', event)
  void measureWidths()
}

onBeforeMount(() => {
  if (queue?.pushToQueue) queue.pushToQueue(proxy)
  else pushToQueue(proxy)
})
onMounted(() => {
  mounted.value = true
  void measureWidths()
})
onBeforeUnmount(() => {
  disposed.value = true
  measureRevision.value++
  stateRevision.value++
  if (queue?.removeFromQueue) queue.removeFromQueue(proxy)
  else removeFromQueue(proxy)
})
watch(() => props.modelValue, (value, old) => {
  if (props.disabled) return
  stateRevision.value++
  gestureStart.value = null
  touching.value = false
  if (value === 'close') close('value', old)
  else {
    settled.value = value
    swipeMove(offsetFor(value))
  }
  void measureWidths()
})
watch(() => props.customStyle, () => { void measureWidths() }, { deep: true })
watch(() => props.disabled, (disabled) => {
  stateRevision.value++
  gestureStart.value = null
  touching.value = false
  swipeMove(offsetFor(settled.value))
  if (!disabled) {
    settled.value = props.modelValue
    swipeMove(offsetFor(settled.value))
    void measureWidths()
  }
})

function startDrag(event: any) {
  emit('touchstart', event)
  gestureStart.value = null
  if (props.disabled) return
  const touch = event?.touches?.[0]
  const x = Number(touch?.clientX)
  const y = Number(touch?.clientY)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  stateRevision.value++
  originOffset.value = wrapperOffset.value
  gestureStart.value = { clientX: x, clientY: y, lastX: x, lastY: y }
  touching.value = true
  void measureWidths()
  if (queue?.closeOther) queue.closeOther(proxy)
  else closeOther(proxy)
}
function onDrag(event: any) {
  emit('touchmove', event)
  const start = gestureStart.value
  const touch = event?.touches?.[0]
  if (!start || !touch) return
  const x = Number(touch.clientX)
  const y = Number(touch.clientY)
  if (Number.isFinite(x) && Number.isFinite(y)) {
    start.lastX = x
    start.lastY = y
  }
}
function endDrag(event: any) {
  emit('touchend', event)
  finishDrag(event)
}
function cancelDrag(event: any) {
  emit('touchcancel', event)
  finishDrag(event)
}
function finishDrag(event?: any) {
  const start = gestureStart.value
  gestureStart.value = null
  touching.value = false
  if (props.disabled || !start) {
    swipeMove(offsetFor(settled.value))
    return
  }
  const touch = event?.changedTouches?.[0] || event?.touches?.[0]
  const deltaX = Number(touch?.clientX ?? start.lastX) - start.clientX
  const deltaY = Number(touch?.clientY ?? start.lastY) - start.clientY
  const offset = Number.isFinite(deltaX) && Number.isFinite(deltaY) && Math.abs(deltaY) <= Math.abs(deltaX)
    ? clampOffset(originOffset.value + deltaX) : originOffset.value
  const threshold = 0.3
  let target: SwipeActionStatus = 'close'
  if (originOffset.value < 0 && offset < 0 && offset - originOffset.value < rightWidth.value * threshold) target = 'right'
  else if (originOffset.value > 0 && offset > 0 && originOffset.value - offset < leftWidth.value * threshold) target = 'left'
  else if (originOffset.value >= 0 && offset < 0 && Math.abs(offset) > rightWidth.value * threshold) target = 'right'
  else if (originOffset.value <= 0 && offset > 0 && Math.abs(offset) > leftWidth.value * threshold) target = 'left'
  if (target === 'close') close('swipe')
  else {
    settled.value = target
    swipeMove(offsetFor(target))
    emit('update:modelValue', target)
  }
}

function close(reason: SwipeActionReason = 'value', position?: SwipeActionPosition, afterClose?: () => void) {
  const revision = ++stateRevision.value
  let closePosition = position
  if (reason === 'swipe') {
    if (originOffset.value === 0) {
      settled.value = 'close'
      swipeMove(0)
      return
    }
    closePosition = originOffset.value > 0 ? 'left' : 'right'
  }
  const doClose = () => {
    if (disposed.value || revision !== stateRevision.value) return
    gestureStart.value = null
    touching.value = false
    settled.value = 'close'
    swipeMove(0)
    if (props.modelValue !== 'close') emit('update:modelValue', 'close')
    afterClose?.()
  }
  const restore = () => {
    if (!disposed.value && revision === stateRevision.value) swipeMove(offsetFor(settled.value))
  }
  if (reason && closePosition) callInterceptor(props.beforeClose, { args: [reason, closePosition], done: doClose, canceled: restore, error: restore })
  else doClose()
}
defineExpose<SwipeActionExpose>({ close })
function handleClick(position?: SwipeActionPosition) {
  if (props.disabled || wrapperOffset.value === 0) return
  const clickPosition = position || 'inside'
  close('click', clickPosition, () => emit('click', { value: clickPosition }))
}
function handleRootTap(event: any) {
  emit('tap', event)
  handleClick()
}

interface MtElement {
  setStyleProperty(name: string, value: string): void
  getAttribute(name: string): string | null
}
const wrapperRef = useMainThreadRef<MtElement | null>(null)
const dragRef = useMainThreadRef<{ startX: number; startY: number; origin: number; epoch: string | null } | null>(null)
const onTouchStartMt = (event: any) => {
  'main thread'
  dragRef.current = null
  const el = wrapperRef.current
  const touch = event.touches && event.touches[0]
  if (!el || !touch || el.getAttribute('drag-disabled') === 'true') return
  const x = Number(touch.clientX)
  const y = Number(touch.clientY)
  const origin = Number(el.getAttribute('origin-offset'))
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  dragRef.current = { startX: x, startY: y, origin: Number.isFinite(origin) ? origin : 0, epoch: el.getAttribute('gesture-epoch') }
}
const onTouchMoveMt = (event: any) => {
  'main thread'
  const el = wrapperRef.current
  const drag = dragRef.current
  const touch = event.touches && event.touches[0]
  if (!el || !drag || !touch || el.getAttribute('drag-disabled') === 'true' || drag.epoch !== el.getAttribute('gesture-epoch')) return
  const dx = Number(touch.clientX) - drag.startX
  const dy = Number(touch.clientY) - drag.startY
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dy) > Math.abs(dx)) return
  const left = Math.max(0, Number(el.getAttribute('left-width')) || 0)
  const right = Math.max(0, Number(el.getAttribute('right-width')) || 0)
  const offset = Math.min(Math.max(drag.origin + dx, -right), left)
  el.setStyleProperty('transition', 'none')
  el.setStyleProperty('transform', `translateX(${offset}px)`)
}
const onTouchFinishMt = () => {
  'main thread'
  dragRef.current = null
}
</script>

<template>
  <view
    :class="`wd-swipe-action ${customClass}`"
    :style="rootStyle"
    :main-thread-bindtouchstart="onTouchStartMt"
    :main-thread-bindtouchmove="onTouchMoveMt"
    :main-thread-bindtouchend="onTouchFinishMt"
    :main-thread-bindtouchcancel="onTouchFinishMt"
    @tap.stop="handleRootTap"
  >
    <view
      class="wd-swipe-action__wrapper"
      :style="wrapperStyle"
      :main-thread-ref="wrapperRef"
      :origin-offset="String(wrapperOffset)"
      :left-width="String(leftWidth)"
      :right-width="String(rightWidth)"
      :drag-disabled="String(disabled)"
      :gesture-epoch="String(commitTick)"
      @touchstart="startDrag"
      @touchmove="onDrag"
      @touchend="endDrag"
      @touchcancel="cancelDrag"
    >
      <view :class="`wd-swipe-action__left ${instanceId}__left`" @tap.stop="handleClick('left')" @layoutchange="handleLayoutChange">
        <slot name="left" />
      </view>
      <slot />
      <view :class="`wd-swipe-action__right ${instanceId}__right`" @tap.stop="handleClick('right')" @layoutchange="handleLayoutChange">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>

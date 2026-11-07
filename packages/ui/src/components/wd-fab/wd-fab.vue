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
 *
 * 动作菜单布局（2026-11 真机叠按钮缺陷修复）：根节点显式按度量尺寸定盒
 * （ROOT_STYLE 的 width/height），菜单容器的百分比定位（bottom: 100% 等）
 * 才有稳定基准；菜单内部防重叠契约（flex-start 排列、动作项 margin 间距、
 * flex-shrink: 0 + min-width 防 CJK 折行）见 index.scss。
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
import { useLockScroll } from '../../composables/useLockScroll'

const props = defineProps(fabProps)
const emit = defineEmits(['update:active', 'click', 'tap', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'layoutchange'])
const triggerId = `wd-fab-trigger-${uuid()}`
const queue = inject<Queue | null>(queueKey, null)
const { proxy } = getCurrentInstance() as any
const disposed = ref(false)
const mounted = ref(false)
const inited = ref(true)
const isActive = ref(props.active)
const fabDirection = ref(props.direction)
const top = ref(0)
const left = ref(0)
const screen = reactive({ width: 0, height: 0 })
const fabSize = reactive({ width: 60, height: 60 })
const bounding = reactive({ minTop: 0, minLeft: 0, maxTop: 0, maxLeft: 0 })
const attractTransition = ref(false)
const dragging = ref(false)
useLockScroll(() => dragging.value)
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
  const rect = await getRect(`.${triggerId}`)
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
watch([() => props.draggable, () => props.disabled], () => { invalidateGesture() })
watch(() => props.customStyle, () => {
  invalidateGesture()
  void measureGeometry()
}, { deep: true })
function handleLayoutChange(event: any) {
  emit('layoutchange', event)
  if (!dragging.value) void measureGeometry()
}

const ROOT_STYLE = defineStyleKeys({ top: '0px', left: '0px', width: '0px', height: '0px', transition: 'none', 'z-index': '' })
const rootStyle = computed(() => {
  void commitTick.value
  return {
    ...resolveStyle(ROOT_STYLE, {
      top: `${top.value}px`, left: `${left.value}px`,
      // 根节点按度量到的触发器尺寸显式定盒：动作菜单的 bottom/top/left/
      // right: 100% 与四边 gap 都基于这个盒结算，auto 盒在部分引擎下
      // 结算不稳定（真机菜单整体压住触发器）。首帧用文档约定的 60px
      // 回退几何，度量回来后由 measureGeometry 刷新。
      width: `${fabSize.width}px`, height: `${fabSize.height}px`,
      transition: attractTransition.value ? 'all ease 0.3s' : 'none',
      'z-index': props.zIndex
    }),
    ...parseStyle(props.customStyle)
  }
})
/** 触点和位置都保留在原组件内；新手势不复用上一次起点。 */
const dragStartRef: { current: { x: number; y: number; left: number; top: number; identifier?: string; moved: boolean } | null } = { current: null }
let dragTapAt = 0
function touchPoint(event: any, ended = false) {
  const list = ended ? event?.changedTouches?.length ? event.changedTouches : event?.touches
    : event?.touches?.length ? event.touches : event?.changedTouches
  const id = dragStartRef.current?.identifier
  const touch = id === undefined ? list?.[0] : Array.from(list || []).find((item: any) => String(item.identifier ?? item.id) === id) as any
  if (id !== undefined && !touch) return null
  const rawX = touch?.clientX ?? touch?.pageX ?? touch?.x ?? event?.detail?.x
  const rawY = touch?.clientY ?? touch?.pageY ?? touch?.y ?? event?.detail?.y
  if (rawX == null || rawY == null) return null
  const x = Number(rawX), y = Number(rawY)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const touchId = touch?.identifier ?? touch?.id
  return { x, y, identifier: touchId == null ? undefined : String(touchId) }
}
function applyDragPoint(point: { x: number; y: number }) {
  const start = dragStartRef.current
  if (!start) return
  start.moved ||= Math.abs(point.x - start.x) > 4 || Math.abs(point.y - start.y) > 4
  left.value = Math.min(Math.max(start.left + point.x - start.x, bounding.minLeft), bounding.maxLeft)
  top.value = Math.min(Math.max(start.top + point.y - start.y, bounding.minTop), bounding.maxTop)
  commitTick.value++
}
function handleTouchStart(event: any) {
  emit('touchstart', event)
  gestureRevision.value++
  geometryRevision.value++ // 初始或旧布局的查询不得在拖动期间改写边界。
  dragStartRef.current = null
  dragTapAt = 0
  const point = touchPoint(event)
  dragging.value = Boolean(props.draggable && !props.disabled && inited.value && point)
  if (!dragging.value || !point) return
  attractTransition.value = false
  dragStartRef.current = { ...point, left: left.value, top: top.value, moved: false }
}
/** 跟手仅写缓存位置；不在 move 中测量、不把缺失坐标当 0。 */
function handleTouchMove(event: any) {
  emit('touchmove', event)
  if (!dragging.value || !dragStartRef.current) return
  const point = touchPoint(event)
  if (point) applyDragPoint(point)
}
async function finishGesture(event: any, canceled: boolean) {
  emit(canceled ? 'touchcancel' : 'touchend', event)
  const hadGesture = Boolean(dragging.value && dragStartRef.current)
  const endpoint = touchPoint(event, true)
  if (hadGesture && !canceled && endpoint) applyDragPoint(endpoint)
  const moved = Boolean(dragStartRef.current?.moved)
  if (moved) dragTapAt = Date.now()
  const finalPosition = { left: left.value, top: top.value }
  dragging.value = false
  dragStartRef.current = null
  if (!props.draggable || props.disabled || !inited.value) return
  const revision = ++gestureRevision.value
  const epoch = configEpoch.value
  const rect = await getRect(`.${triggerId}`)
  if (disposed.value || revision !== gestureRevision.value || epoch !== configEpoch.value || !props.draggable || props.disabled) return
  if (hadGesture && !moved) return
  // getRect 的失败兜底是全零矩形；0 坐标有限并不代表度量有效。
  // 实际拖动使用已经接受的终点，避免异步查询上一帧的坐标造成松手回跳。
  const validRect = Number(rect.width) > 0 && Number(rect.height) > 0 && Number.isFinite(Number(rect.top)) && Number.isFinite(Number(rect.left))
  const endTop = hadGesture || !validRect ? finalPosition.top : Number(rect.top)
  const endLeft = hadGesture || !validRect ? finalPosition.left : Number(rect.left)
  top.value = Math.min(Math.max(endTop, bounding.minTop), bounding.maxTop)
  const center = endLeft + (validRect ? Number(rect.width) : fabSize.width) / 2
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

// A native visibility:hidden trigger still paints. Start from the documented
// 60px fallback geometry before the first render; measurement only refines it.
updateBounds()
initPosition()

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
function handleClick(event?: any) {
  if (props.disabled) return
  // 原生结束手势可能补发带坐标的 tap；新的 touchstart 会清掉该标记。
  if (dragTapAt && Date.now() - dragTapAt <= 350 && touchPoint(event, true)) {
    dragTapAt = 0
    return
  }
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
      :class="`${triggerId} wd-fab__anchor`"
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
      :lazy-render="true"
      :destroy="true"
    >
      <slot />
    </WdTransition>
  </view>
</template>

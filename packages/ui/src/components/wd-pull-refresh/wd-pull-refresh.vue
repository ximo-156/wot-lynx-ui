/*
 * wd-pull-refresh — 本地扩展：wot-ui 2.3.2 无此组件。
 *
 * 提示区绝对定位在内容上方，空闲时不占位；在 scrollTop 为零时由真实触摸
 * 下拉触发，不依赖宿主提供负滚动量。跟手与提示切换走声明式 MTS，后台只
 * 记录手势、转发事件和提交刷新。滚动位置/阈值经属性缓存，无逐帧节点查询。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onBeforeUnmount, ref, useMainThreadRef, watch } from 'vue-lynx'
import WdLoading from '../wd-loading/wd-loading.vue'
import { pullRefreshProps } from './types'
import { parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(pullRefreshProps)
const emit = defineEmits(['refresh', 'update:modelValue', 'scroll', 'touchstart', 'touchmove', 'touchend', 'touchcancel'])
type RefreshStatus = 'normal' | 'loading' | 'success'
const status = ref<RefreshStatus>('normal')
const pullDistance = ref(0)
const scrollTop = ref(0)
const gesture = ref<{ x: number; y: number; lastX: number; lastY: number } | null>(null)
const commitTick = ref(0)
const disposed = ref(false)
const successTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const successSince = ref(0)
function duration(value: number, fallback: number) {
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback
}
const headSize = computed(() => Number.isFinite(props.headHeight) && props.headHeight > 0 ? props.headHeight : 50)
const animationMs = computed(() => duration(props.animationDuration, 300))
const blocked = computed(() => props.disabled || props.modelValue || status.value !== 'normal')
const rootStyle = computed(() => parseStyle(props.customStyle))
const TRACK_STYLE = defineStyleKeys({ transform: 'translateY(0px)', transition: 'none' })
const trackStyle = computed(() => {
  void commitTick.value
  return resolveStyle(TRACK_STYLE, {
    transform: `translateY(${pullDistance.value}px)`, transition: `transform ${animationMs.value}ms ease`
  })
})
const headStyle = computed(() => ({ height: `${headSize.value}px`, top: `${-headSize.value}px` }))
const pullingStyle = computed(() => { void commitTick.value; return { display: 'flex' } })
const loosingStyle = computed(() => { void commitTick.value; return { display: 'none' } })
function clearSuccessTimer() {
  if (successTimer.value !== null) clearTimeout(successTimer.value)
  successTimer.value = null
}
function reset() {
  gesture.value = null
  status.value = 'normal'
  pullDistance.value = 0
  commitTick.value++
}
function scheduleSuccess() {
  clearSuccessTimer()
  const remaining = Math.max(0, duration(props.successDuration, 500) - (Date.now() - successSince.value))
  if (remaining === 0 || !props.successText) { reset(); return }
  successTimer.value = setTimeout(() => {
    successTimer.value = null
    if (disposed.value || status.value !== 'success' || props.modelValue) return
    reset()
  }, remaining)
}
watch(() => props.modelValue, (loading) => {
  clearSuccessTimer()
  gesture.value = null
  commitTick.value++
  if (loading) {
    status.value = 'loading'
    pullDistance.value = headSize.value
  } else if (status.value === 'loading') {
    status.value = 'success'
    pullDistance.value = headSize.value
    successSince.value = Date.now()
    scheduleSuccess()
  } else if (status.value !== 'success') reset()
}, { immediate: true })
watch(() => [props.successDuration, props.successText], () => {
  if (status.value === 'success') scheduleSuccess()
})
watch(headSize, () => {
  gesture.value = null
  pullDistance.value = status.value === 'normal' ? 0 : headSize.value
  commitTick.value++
})
watch(() => props.disabled, (disabled) => {
  if (disabled && status.value === 'normal') reset()
})
function onScroll(event: any) {
  const value = Number(event?.detail?.scrollTop ?? event?.detail?.scrollY)
  if (Number.isFinite(value)) scrollTop.value = Math.max(0, value)
  emit('scroll', event)
}
function onTouchStart(event: any) {
  emit('touchstart', event)
  const touch = event?.touches?.[0]
  const x = Number(touch?.clientX), y = Number(touch?.clientY)
  gesture.value = !blocked.value && scrollTop.value <= 0 && Number.isFinite(x) && Number.isFinite(y)
    ? { x, y, lastX: x, lastY: y } : null
}
function onTouchMove(event: any) {
  emit('touchmove', event)
  const start = gesture.value, touch = event?.touches?.[0]
  if (!start || !touch) return
  const x = Number(touch.clientX), y = Number(touch.clientY)
  if (Number.isFinite(x) && Number.isFinite(y)) { start.lastX = x; start.lastY = y }
}
function finish(event: any, canceled: boolean) {
  emit(canceled ? 'touchcancel' : 'touchend', event)
  const start = gesture.value
  gesture.value = null
  if (blocked.value) return
  const touch = event?.changedTouches?.[0] || event?.touches?.[0]
  const x = Number(touch?.clientX ?? start?.lastX), y = Number(touch?.clientY ?? start?.lastY)
  const dx = start ? x - start.x : 0, dy = start ? y - start.y : 0
  if (!canceled && start && Number.isFinite(dy) && dy >= headSize.value && dy >= Math.abs(dx)) {
    status.value = 'loading'
    pullDistance.value = headSize.value
    commitTick.value++
    emit('update:modelValue', true)
    emit('refresh')
  } else reset()
}
function onTouchEnd(event: any) { finish(event, false) }
function onTouchCancel(event: any) { finish(event, true) }
onBeforeUnmount(() => {
  disposed.value = true
  clearSuccessTimer()
  gesture.value = null
})

interface MtElement {
  setStyleProperty(name: string, value: string): void
  getAttribute(name: string): string | null
}
const trackRef = useMainThreadRef<MtElement | null>(null)
const pullingRef = useMainThreadRef<MtElement | null>(null)
const loosingRef = useMainThreadRef<MtElement | null>(null)
const dragRef = useMainThreadRef<{ x: number; y: number; epoch: string | null } | null>(null)
const onTouchStartMt = (event: any) => {
  'main thread'
  dragRef.current = null
  const el = trackRef.current
  const touch = event.touches && event.touches[0]
  if (!el || !touch || el.getAttribute('refresh-blocked') === 'true' || Number(el.getAttribute('scroll-offset')) > 0) return
  const x = Number(touch.clientX), y = Number(touch.clientY)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  dragRef.current = { x, y, epoch: el.getAttribute('gesture-epoch') }
}
const onTouchMoveMt = (event: any) => {
  'main thread'
  const el = trackRef.current, start = dragRef.current
  const touch = event.touches && event.touches[0]
  if (!el || !start || !touch || el.getAttribute('refresh-blocked') === 'true' || start.epoch !== el.getAttribute('gesture-epoch')) return
  const dx = Number(touch.clientX) - start.x, dy = Number(touch.clientY) - start.y
  const head = Number(el.getAttribute('head-height'))
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !(head > 0)) return
  const raw = dy >= Math.abs(dx) ? Math.max(0, dy) : 0
  const distance = Math.min(head * 2, raw <= head ? raw : head + (raw - head) * 0.5)
  el.setStyleProperty('transition', 'none')
  el.setStyleProperty('transform', `translateY(${distance}px)`)
  const pulling = pullingRef.current, loosing = loosingRef.current
  if (pulling) pulling.setStyleProperty('display', distance >= head ? 'none' : 'flex')
  if (loosing) loosing.setStyleProperty('display', distance >= head ? 'flex' : 'none')
}
const onTouchFinishMt = () => {
  'main thread'
  dragRef.current = null
}
</script>

<template>
  <view class="wd-pull-refresh" :class="customClass" :style="rootStyle">
    <view
      class="wd-pull-refresh__track"
      :style="trackStyle"
      :main-thread-ref="trackRef"
      :refresh-blocked="String(blocked)"
      :scroll-offset="String(scrollTop)"
      :head-height="String(headSize)"
      :gesture-epoch="String(commitTick)"
      :main-thread-bindtouchstart="onTouchStartMt"
      :main-thread-bindtouchmove="onTouchMoveMt"
      :main-thread-bindtouchend="onTouchFinishMt"
      :main-thread-bindtouchcancel="onTouchFinishMt"
    >
      <view class="wd-pull-refresh__head" :style="headStyle">
        <view v-if="status === 'loading'" class="wd-pull-refresh__loading">
          <WdLoading size="16px" />
          <text class="wd-pull-refresh__text">{{ loadingText }}</text>
        </view>
        <text v-else-if="status === 'success'" class="wd-pull-refresh__text">{{ successText }}</text>
        <template v-else>
          <text class="wd-pull-refresh__text wd-pull-refresh__pulling" :main-thread-ref="pullingRef" :style="pullingStyle">{{ pullingText }}</text>
          <text class="wd-pull-refresh__text wd-pull-refresh__loosing" :main-thread-ref="loosingRef" :style="loosingStyle">{{ loosingText }}</text>
        </template>
      </view>
      <scroll-view
        class="wd-pull-refresh__scroll"
        :scroll-y="true"
        @scroll="onScroll"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchCancel"
      >
        <slot />
      </scroll-view>
    </view>
  </view>
</template>

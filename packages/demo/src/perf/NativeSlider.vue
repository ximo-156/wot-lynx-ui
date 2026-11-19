<script lang="ts" setup>
import { computed, ref, useMainThreadRef } from 'vue-lynx'

const props = defineProps<{ modelValue: number }>()
const emit = defineEmits<{ 'update:modelValue': [number]; dragmove: [{ value: number }]; change: [number] }>()
const track = useMainThreadRef<any>(null)
const fill = useMainThreadRef<any>(null)
const thumb = useMainThreadRef<any>(null)
const gesture = useMainThreadRef<any>(null)
const dragging = ref(false)
let startX = 0
let startValue = 0
let finalValue = 50
const pose = computed(() => dragging.value ? {} : { width: `${props.modelValue}%` })
const thumbPose = computed(() => dragging.value ? {} : { left: `${props.modelValue}%` })
const onStartMt = (event: any) => {
  'main thread'
  const x = Number(event.touches?.[0]?.clientX)
  if (!track.current || !Number.isFinite(x)) return
  gesture.current = { x, value: Number(track.current.getAttribute('gesture-value')) || 0 }
}
const onMoveMt = (event: any) => {
  'main thread'
  const state = gesture.current
  const x = Number(event.touches?.[0]?.clientX)
  if (!state || !Number.isFinite(x)) return
  const value = Math.max(0, Math.min(100, Math.round(state.value + (x - state.x) / 280 * 100)))
  fill.current?.setStyleProperty('width', `${value}%`)
  thumb.current?.setStyleProperty('left', `${value}%`)
}
function start(event: any) {
  const x = Number(event.touches?.[0]?.clientX)
  if (!Number.isFinite(x)) return
  startX = x
  startValue = finalValue = props.modelValue
  dragging.value = true
}
function move(event: any) {
  if (!dragging.value) return
  const x = Number(event.touches?.[0]?.clientX)
  if (!Number.isFinite(x)) return
  const value = Math.max(0, Math.min(100, Math.round(startValue + (x - startX) / 280 * 100)))
  if (value !== finalValue) { finalValue = value; emit('update:modelValue', value) }
  emit('dragmove', { value })
}
function end(event: any) {
  if (!dragging.value) return
  const x = Number(event.changedTouches?.[0]?.clientX)
  if (Number.isFinite(x)) {
    const value = Math.max(0, Math.min(100, Math.round(startValue + (x - startX) / 280 * 100)))
    if (value !== finalValue) { finalValue = value; emit('update:modelValue', value) }
  }
  dragging.value = false
  emit('change', finalValue)
}
</script>

<template>
  <view class="native-slider" :main-thread-ref="track" :gesture-value="String(modelValue)" @touchstart="start" @touchmove="move" @touchend="end" @touchcancel="end">
    <view class="native-slider__track" />
    <view class="native-slider__fill" :main-thread-ref="fill" :style="pose" />
    <view class="native-slider__thumb" :main-thread-ref="thumb" :style="thumbPose" :main-thread-bindtouchstart="onStartMt" :main-thread-bindtouchmove="onMoveMt" />
  </view>
</template>

<style>
.native-slider { display: flex; position: relative; width: 280px; height: 24px; z-index: 0; }
.native-slider__track { position: absolute; left: 0; top: 11px; width: 280px; height: 2px; background-color: #dddddd; }
.native-slider__fill { position: absolute; left: 0; top: 11px; height: 2px; background-color: #8268de; }
.native-slider__thumb { position: absolute; top: 0; width: 24px; height: 24px; margin-left: -12px; border-radius: 12px; background-color: #ffffff; border: 1px solid #cccccc; }
</style>

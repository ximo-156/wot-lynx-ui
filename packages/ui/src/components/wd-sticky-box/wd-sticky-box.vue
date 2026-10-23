/*
 * wd-sticky-box — 粘性容器
 *
 * 原生 sticky 的包含块；真实宿主 observer 可按官方父子契约在底边限制 fixed 子项。
 * 容器、子项尺寸变化重建监听，缓存的容器位置协调回调先后，卸载/移除立即清理。
 * 未注入 IntersectionObserver 时不调用降级空对象、不声称 JS 状态跟踪可用。
 */
<script lang="ts" setup>
import './index.css'

import { getCurrentInstance, nextTick, onBeforeUnmount, onMounted, reactive, watch } from 'vue-lynx'
import { getRect, parseStyle, uuid } from '../../common/util'
import { uni } from '../../common/uni'
import { getPlatform } from '../../common/platform'
import { useChildren } from '../../composables/useChildren'
import { useAlive } from '../../composables/useAlive'
import { STICKY_BOX_KEY, stickyBoxProps } from './types'

const props = defineProps(stickyBoxProps)
const emit = defineEmits(['layoutchange'])
const instance = getCurrentInstance()!
const isAlive = useAlive()
const boxId = `wd-sticky-box-${uuid()}`
const boxStyle = reactive({ height: 0, width: 0 })
const { children, linkChildren } = useChildren(STICKY_BOX_KEY)
const observers = new Map<number, any>()
let measureVersion = 0
let boxRect: any = null
linkChildren({ boxStyle, observerForChild, updateChildPosition, unobserveChild })

function exposedOf(child: any) { return (child?.$ || child)?.exposed }
function uidOf(child: any): number | undefined { return (child?.$ || child)?.uid }
function removeObserver(uid: number) {
  observers.get(uid)?.disconnect?.()
  observers.delete(uid)
}
function unobserveChild(child: any) {
  const uid = uidOf(child)
  if (uid !== undefined) removeObserver(uid)
}
function updateChildPosition(child: any) {
  if (!isAlive()) return
  const exposed = exposedOf(child)
  const rect = boxRect
  if (!exposed?.stickyState || !rect || !Number.isFinite(Number(rect.bottom))) return
  const state = exposed.stickyState
  const offsetTop = Number(exposed.offsetTop?.value ?? exposed.offsetTop) || 0
  const offset = state.height + offsetTop
  if (boxStyle.height <= state.height) {
    exposed.setPosition(false, 'absolute', 0)
  } else if (Number(rect.bottom) <= offset) {
    exposed.setPosition(true, 'absolute', Math.max(0, boxStyle.height - state.height))
  } else if (Number(rect.top) <= offset && state.state !== 'normal') {
    exposed.setPosition(false, 'fixed', offsetTop)
  }
}
function handleRelativeTo(child: any, result: any) {
  if (!isAlive()) return
  if (result?.boundingClientRect) boxRect = result.boundingClientRect
  updateChildPosition(child)
}
function observerForChild(child: any) {
  const uid = uidOf(child)
  const exposed = exposedOf(child)
  if (uid === undefined) return
  removeObserver(uid)
  if (!getPlatform().capabilities.intersectionObserver || !exposed?.stickyState || boxStyle.height <= 0 || exposed.stickyState.height <= 0) return
  updateChildPosition(child)
  const observer = uni.createIntersectionObserver(instance.proxy, { thresholds: [0, 0.5] })
  if (!observer) return
  observers.set(uid, observer)
  const offset = exposed.stickyState.height + (Number(exposed.offsetTop?.value ?? exposed.offsetTop) || 0)
  observer.relativeToViewport?.({ top: -offset })
  observer.observe?.(`#${boxId}`, (result: any) => {
    if (isAlive() && observers.get(uid) === observer) handleRelativeTo(child, result)
  })
}
async function measure() {
  const version = ++measureVersion
  const rect = await getRect(`#${boxId}`)
  if (!isAlive() || version !== measureVersion) return
  boxStyle.width = Math.max(0, Number(rect?.width) || 0)
  boxStyle.height = Math.max(0, Number(rect?.height) || 0)
  boxRect = boxStyle.width > 0 || boxStyle.height > 0 ? rect : null
  children.forEach(observerForChild)
}
function requestMeasure() {
  measureVersion++
  for (const uid of observers.keys()) removeObserver(uid)
  void nextTick(measure)
}
function handleLayoutChange(event: any) {
  emit('layoutchange', event)
  const width = Number(event?.detail?.width)
  const height = Number(event?.detail?.height)
  if (width === boxStyle.width && height === boxStyle.height) return
  requestMeasure()
}
watch(() => children.map((child) => child.$.uid), (uids) => {
  for (const uid of observers.keys()) if (!uids.includes(uid)) removeObserver(uid)
  requestMeasure()
})
onMounted(measure)
onBeforeUnmount(() => {
  measureVersion++
  for (const uid of observers.keys()) removeObserver(uid)
})
</script>

<template>
  <view :style="{ position: 'relative' }">
    <view :id="boxId" :class="`wd-sticky-box ${props.customClass}`" :style="parseStyle(customStyle)" @layoutchange="handleLayoutChange"><slot /></view>
  </view>
</template>

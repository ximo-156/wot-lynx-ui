/*
 * wd-index-bar — 索引栏
 *
 * 原生 scroll-view；侧边栏缓存实测矩形，scrollIntoView 跳转。去重条目保留实际
 * child，动态 index 显式通知父级（不在父渲染路径追踪子 props）。同值锚点有唯一 id，
 * 只有真正激活的 child 吸顶。布局变化重新度量所有锚点；触摸/滚动热路径无 getRect。
 * 无度量时不伪造滚动联动，侧边栏保留确定性的 300px 命中兜底。官方无公开 change
 * 事件；这里转发 layoutchange 仅为 Lynx 原生监听安全，不添加虚假的官方事件。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch } from 'vue-lynx'
import { indexBarInjectionKey, indexBarProps, type AnchorIndex } from './types'
import { useChildren } from '../../composables/useChildren'
import { getRect, scrollIntoViewById, uuid } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(indexBarProps)
const emit = defineEmits(['layoutchange'])
const isAlive = useAlive()
const indexBarId = `wd-index-bar-${uuid()}`
const scrollState = reactive({ prevScrollTop: 0, touching: false })
const state = reactive({ activeIndex: null as AnchorIndex | null })
const activeUid = ref<number | null>(null)
const { linkChildren, children } = useChildren(indexBarInjectionKey)
const childRevision = ref(0)
const offsetTop = ref(0)
let measureVersion = 0
let endTimer: ReturnType<typeof setTimeout> | undefined
const sidebarRect = ref<{ top: number; height: number } | null>(null)
const DEFAULT_SIDEBAR_RECT = { top: 0, height: 300 }

function childIndex(child: any): AnchorIndex | undefined {
  const rawProps = child?.$?.props
  return rawProps ? toRaw(rawProps).index : undefined
}
function onAnchorChange() { childRevision.value++ }
function getAnchorId(uid: number, index: AnchorIndex) {
  void childRevision.value
  const first = children.find((child) => String(childIndex(child)) === String(index))
  const suffix = first?.$?.uid === uid ? '' : `-${uid}`
  return `${indexBarId}-anchor-${encodeURIComponent(String(index))}${suffix}`
}
linkChildren({
  props, anchorState: state, id: indexBarId, onAnchorChange, getAnchorId,
  getScrollTop: () => scrollState.prevScrollTop, getOffsetTop: () => offsetTop.value, getActiveUid: () => activeUid.value
})
const sidebarEntries = computed(() => {
  void childRevision.value
  const seen = new Set<AnchorIndex>()
  return children.flatMap((child) => {
    const index = childIndex(child)
    if (index === undefined || seen.has(index)) return []
    seen.add(index)
    return [{ index, child, key: `${typeof index}:${index}` }]
  })
})
function activate(child: any) {
  state.activeIndex = childIndex(child) ?? null
  activeUid.value = child?.$?.uid ?? null
}
watch(sidebarEntries, (entries) => {
  const active = children.find((child) => child.$.uid === activeUid.value)
  const entry = active && entries.find((entry) => entry.index === childIndex(active)) || entries.find((entry) => entry.index === state.activeIndex) || entries[0]
  activate(active && entry?.index === childIndex(active) ? active : entry?.child)
  requestMeasure()
}, { immediate: true })

async function measure() {
  const version = ++measureVersion
  const [bar, sidebar] = await Promise.all([getRect(`#${indexBarId}`), getRect(`#${indexBarId}-sidebar`)])
  if (!isAlive() || version !== measureVersion) return
  offsetTop.value = Number(bar?.top) || 0
  const height = Number(sidebar?.height) || 0
  sidebarRect.value = height > 0 ? { top: Number(sidebar.top) || 0, height } : null
  await Promise.all(children.map((child) => child?.$?.exposed?.refresh?.()))
  if (isAlive() && version === measureVersion && !scrollState.touching) updateActiveByScroll(scrollState.prevScrollTop)
}
function requestMeasure() {
  measureVersion++
  void nextTick(measure)
}
function handleLayoutChange(event: any) {
  emit('layoutchange', event)
  requestMeasure()
}
onMounted(measure)
onBeforeUnmount(() => {
  measureVersion++
  clearTimeout(endTimer)
})
function anchorTop(child: any): number | null {
  const exposed = child?.$?.exposed
  if (!exposed || (exposed.measured?.value ?? exposed.measured) === false) return null
  const top = Number(exposed.top?.value ?? exposed.top)
  return Number.isFinite(top) ? top : null
}
function updateActiveByScroll(scrollTop: number) {
  const entries = children.map((child) => ({ child, top: anchorTop(child) })).filter((entry) => entry.top !== null)
  if (!entries.length) return
  let active = entries[0].child
  for (const entry of entries) {
    if (entry.top! - offsetTop.value > scrollTop) break
    active = entry.child
  }
  activate(active)
}
function handleScroll(event: any) {
  const raw = event?.detail?.scrollTop
  const scrollTop = Number(raw)
  if (raw === undefined || !Number.isFinite(scrollTop)) return
  scrollState.prevScrollTop = Math.max(0, Math.floor(scrollTop))
  if (!scrollState.touching) updateActiveByScroll(scrollState.prevScrollTop)
}
function getAnchorByPageY(pageY: number) {
  if (!Number.isFinite(pageY) || !sidebarEntries.value.length) return undefined
  const rect = sidebarRect.value || DEFAULT_SIDEBAR_RECT
  const index = Math.floor((pageY - rect.top) / rect.height * sidebarEntries.value.length)
  return sidebarEntries.value[Math.max(0, Math.min(index, sidebarEntries.value.length - 1))]
}
function touchY(event: any, ended = false): number {
  const touch = ended ? event?.changedTouches?.[0] || event?.touches?.[0] : event?.touches?.[0] || event?.changedTouches?.[0]
  return Number(touch?.pageY ?? touch?.clientY ?? NaN)
}
function setScrollTop(entry: { index: AnchorIndex; child: any }) {
  const exposed = entry.child?.$?.exposed
  const id = exposed?.id?.value ?? exposed?.id ?? getAnchorId(entry.child.$.uid, entry.index)
  scrollIntoViewById(`#${id}`, 'start')
}
function handleTouchStart() {
  clearTimeout(endTimer)
  scrollState.touching = sidebarEntries.value.length > 0
}
function handleTouchMove(event: any) {
  const target = getAnchorByPageY(touchY(event))
  if (!target || activeUid.value === target.child.$.uid) return
  activate(target.child)
  setScrollTop(target)
}
function handleTouchEnd(event: any) {
  const target = getAnchorByPageY(touchY(event, true))
  if (target) {
    activate(target.child)
    setScrollTop(target)
  }
  clearTimeout(endTimer)
  endTimer = setTimeout(() => { if (isAlive()) scrollState.touching = false }, 30)
}
</script>

<template>
  <view class="wd-index-bar" :id="indexBarId" @layoutchange="handleLayoutChange">
    <scroll-view :scroll-y="true" class="wd-index-bar__content" @scroll="handleScroll"><slot /></scroll-view>
    <view v-if="scrollState.touching" class="wd-index-bar__current-index"><text class="wd-index-bar__current-index-text">{{ state.activeIndex }}</text></view>
    <view
      :id="`${indexBarId}-sidebar`"
      class="wd-index-bar__sidebar"
      @touchstart.stop.prevent="handleTouchStart"
      @touchmove.stop.prevent="handleTouchMove"
      @touchend.stop.prevent="handleTouchEnd"
      @touchcancel.stop.prevent="handleTouchEnd"
    >
      <view v-for="entry in sidebarEntries" :key="entry.key" class="wd-index-bar__index" :class="{ 'is-active': entry.index === state.activeIndex }"><text class="wd-index-bar__index-text">{{ entry.index }}</text></view>
    </view>
  </view>
</template>

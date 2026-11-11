/*
 * wd-index-bar — 索引栏
 *
 * 原生 scroll-view；侧边栏缓存实测矩形，官方 scrollTo 方法跳转。去重条目保留实际
 * child，动态 index 显式通知父级（不在父渲染路径追踪子 props）。同值锚点有唯一 id，
 * 只有真正激活的 child 吸顶。布局变化重新度量所有锚点；触摸/滚动热路径无 getRect。
 * 无度量时不伪造滚动联动，侧边栏保留确定性的 300px 命中兜底。官方无公开 change
 * 事件；这里转发 layoutchange 仅为 Lynx 原生监听安全，不添加虚假的官方事件。
 *
 * 触摸跳转（2026-11-05 真机修复）：曾只走 SelectorQuery.invoke 的 scrollIntoView，
 * 部分引擎上静默不滚动——索引条高亮跳动、列表不动，表现为「点右侧没反应」。现改用
 * Lynx scroll-view 程序化滚动的官方 API scrollTo（common/util 的 scrollViewTo，
 * 与 wd-swiper 同源设备验证口径）：web-elements 与真机引擎均已实现，smooth 参数
 * 提供平滑滚动。目标偏移取锚点内容坐标（实测 top − 索引条页面偏移，与滚动联动的
 * 激活判定同一坐标口径）；跟手（touchmove）瞬时滚动贴合手指，落定（touchend）
 * 平滑收尾。度量缺失无偏移可算时，退回 scrollIntoView 按锚点 id 定位。
 * 触点纵坐标取 client/page 优先、宿主 x/y 与事件 detail 兜底（wd-slider
 * readPointer 同源口径：真机 changedTouches 可能只带部分字段）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch } from 'vue-lynx'
import { indexBarInjectionKey, indexBarProps, type AnchorIndex } from './types'
import { useChildren } from '@wot-lynx/core/composables/useChildren'
import { getRect, scrollIntoViewById, scrollViewTo, uuid } from '@wot-lynx/core/common/util'
import { useAlive } from '@wot-lynx/core/composables/useAlive'

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
let scrollTimer: ReturnType<typeof setTimeout> | undefined
let scrollTargetUid: number | null = null
let touchTargetUid: number | null = null
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
  if (isAlive() && version === measureVersion && !scrollState.touching && scrollTargetUid === null) updateActiveByScroll(scrollState.prevScrollTop)
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
  clearTimeout(scrollTimer)
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
function clearScrollTarget() {
  clearTimeout(scrollTimer)
  scrollTargetUid = null
}
function handleScroll(event: any) {
  const raw = event?.detail?.scrollTop
  const scrollTop = Number(raw)
  if (raw === undefined || !Number.isFinite(scrollTop)) return
  scrollState.prevScrollTop = Math.max(0, Math.floor(scrollTop))
  if (!scrollState.touching && scrollTargetUid === null) updateActiveByScroll(scrollState.prevScrollTop)
}
function getAnchorByPageY(pageY: number) {
  if (!Number.isFinite(pageY) || !sidebarEntries.value.length) return undefined
  const rect = sidebarRect.value || DEFAULT_SIDEBAR_RECT
  const index = Math.floor((pageY - rect.top) / rect.height * sidebarEntries.value.length)
  return sidebarEntries.value[Math.max(0, Math.min(index, sidebarEntries.value.length - 1))]
}
/**
 * 触点纵坐标：client/page 优先，宿主兼容的 x/y 与事件 detail 兜底。
 *
 * 真机 touch 事件的 changedTouches 字段并不齐全（wd-slider 2026-11-05 真机
 * 修复：end 的 changedTouches 不带 identifier；部分宿主只给 x/y 或 detail.y），
 * 只读 pageY/clientY 会在这些运行时上得到 NaN——点击索引条静默无反应。
 * 候选口径与 wd-slider 的 readPointer 对齐；缺失/非有限数不能转成 0。
 */
function touchY(event: any, ended = false): number {
  const touch = ended ? event?.changedTouches?.[0] || event?.touches?.[0] : event?.touches?.[0] || event?.changedTouches?.[0]
  const candidates = [touch?.clientY, touch?.pageY, touch?.y, event?.detail?.y, event?.clientY, event?.pageY, event?.y]
  for (const raw of candidates) {
    if (raw == null || raw === '') continue
    const value = Number(raw)
    if (Number.isFinite(value)) return value
  }
  return NaN
}
/**
 * 把目标锚点滚入可见区（原生方法：SelectorQuery.invoke('scrollTo')）。
 *
 * Lynx scroll-view 程序化滚动的官方 API（common/util scrollViewTo 注释口径）：
 * web-elements 与真机引擎均已实现，smooth 参数提供平滑滚动——wd-swiper 同源
 * 设备验证路径。目标偏移 = 锚点实测 top（页面坐标 + 度量时滚动量）− 索引条
 * 页面偏移，即锚点的内容坐标，与 updateActiveByScroll 的激活判定同一口径。
 * 跟手传 smooth=false 瞬时贴合手指，落定传 smooth=true 平滑收尾。
 * 度量缺失时无内容偏移可算，退回官方 scrollIntoView 按锚点 id 定位。
 */
function setScrollTop(entry: { index: AnchorIndex; child: any }, smooth = true) {
  scrollTargetUid = entry.child.$.uid
  clearTimeout(scrollTimer)
  // scrollend 只解除保护，不按钳制后的偏移重新选字母；内容手势立即解除。
  // 同一偏移可能没有 scrollend，旧宿主也可能不派发它，故等待必须有上限。
  scrollTimer = setTimeout(() => { if (isAlive()) clearScrollTarget() }, 1000)
  const exposed = entry.child?.$?.exposed
  const rawTop = Number(exposed?.top?.value ?? exposed?.top ?? NaN)
  const measured = (exposed?.measured?.value ?? exposed?.measured) !== false
  if (measured && Number.isFinite(rawTop)) {
    scrollViewTo(`#${indexBarId}-content`, Math.max(0, Math.floor(rawTop - offsetTop.value)), smooth)
    return
  }
  const id = exposed?.id?.value ?? exposed?.id ?? getAnchorId(entry.child.$.uid, entry.index)
  scrollIntoViewById(`#${id}`, 'start')
}
// Web 鼠标 click 只映射为 tap，不产生 touch 序列。按已知条目跳转，
// 也避免外层页面滚动后用过期的 sidebarRect 将点击命中为别的字母。
function handleIndexTap(entry: { index: AnchorIndex; child: any }) {
  if (scrollState.touching && touchTargetUid === entry.child.$.uid) return
  activate(entry.child)
  setScrollTop(entry)
}
function handleTouchStart() {
  clearTimeout(endTimer)
  touchTargetUid = null
  scrollState.touching = sidebarEntries.value.length > 0
}
function handleTouchMove(event: any) {
  const target = getAnchorByPageY(touchY(event))
  if (!target || activeUid.value === target.child.$.uid) return
  activate(target.child)
  setScrollTop(target, false)
  touchTargetUid = target.child.$.uid
}
function handleTouchEnd(event: any) {
  const target = getAnchorByPageY(touchY(event, true))
  if (target) {
    activate(target.child)
    setScrollTop(target)
    touchTargetUid = target.child.$.uid
  }
  clearTimeout(endTimer)
  endTimer = setTimeout(() => { if (isAlive()) scrollState.touching = false }, 30)
}
</script>

<template>
  <view class="wd-index-bar" :id="indexBarId" @layoutchange="handleLayoutChange">
    <scroll-view :id="`${indexBarId}-content`" :scroll-y="true" class="wd-index-bar__content" @scroll="handleScroll" @scrollend="clearScrollTarget" @touchstart="clearScrollTarget"><slot /></scroll-view>
    <view v-if="scrollState.touching" class="wd-index-bar__current-index"><text class="wd-index-bar__current-index-text">{{ state.activeIndex }}</text></view>
    <view
      :id="`${indexBarId}-sidebar`"
      class="wd-index-bar__sidebar"
      @touchstart.stop.prevent="handleTouchStart"
      @touchmove.stop.prevent="handleTouchMove"
      @touchend.stop.prevent="handleTouchEnd"
      @touchcancel.stop.prevent="handleTouchEnd"
    >
      <view v-for="entry in sidebarEntries" :key="entry.key" class="wd-index-bar__index" :class="{ 'is-active': entry.index === state.activeIndex }" @tap.stop="handleIndexTap(entry)"><text class="wd-index-bar__index-text">{{ entry.index }}</text></view>
    </view>
  </view>
</template>

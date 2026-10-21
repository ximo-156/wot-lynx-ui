/*
 * wd-swiper — 轮播图
 *
 * 使用引擎内置 scroll-view，手势跟手由原生滚动完成，后台线程仅提交分页状态。
 * 程序翻页/收尾吸附经 scrollViewTo 的 smooth 参数，不传无效 scroll-with-animation。
 * duration=0 可关闭平滑滚动；正数时长与 easingFunction 没有原生等价参数，无法精确
 * 复现。loop 的首尾程序翻页瞬移；scroll-view 不支持跨首尾的连续 circular 手势。
 * snapToEdge 在非循环模式去除首尾留白并钳制偏移；所有尺寸在挂载/布局变化时缓存。
 * adjustHeight/adjustVerticalHeight 是支付宝 swiper 能力，Lynx 不模拟自动高度。
 * 视频命令仅在宿主注入 createVideoContext 时调用；默认降级对象不视为真实播放器。
 * Lynx 没有小程序码长按菜单；保留 API 与 long-press 通知，不承诺平台菜单。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue-lynx'
import WdSwiperNav from '../wd-swiper-nav/wd-swiper-nav.vue'
import { swiperProps, type SwiperItem } from './types'
import type { SwiperNavProps } from '../wd-swiper-nav/types'
import { addUnit, getRect, isObj, isVideoUrl, parseStyle, scrollViewTo, uuid } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { hasUniAdapter, uni } from '../../common/uni'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(swiperProps)
const emit = defineEmits(['click', 'tap', 'change', 'animationfinish', 'update:current', 'long-press', 'layoutchange'])
const slots = useSlots()
const instance = getCurrentInstance()!
const isAlive = useAlive()
const uid = uuid()
const swiperId = `wd-swiper-${uid}`
const currentValue = ref(normalizeCurrent(props.current))
const containerWidth = ref(0)
const containerHeight = ref(0)
const playingVideos = ref(new Set<number>())
const userScrolling = ref(false)
let playTimer: ReturnType<typeof setInterval> | undefined
let measureVersion = 0
let navigationVersion = 0
let lastOffset = 0
let hasScroll = false
let pendingNavigation: { version: number; current: number; source: string; offset: number } | null = null

const isVertical = computed(() => props.direction === 'vertical')
const itemCount = computed(() => props.list.length)
const displayCount = computed(() => Math.max(1, Math.min(itemCount.value || 1, Math.trunc(Number(props.displayMultipleItems)) || 1)))
const viewportSize = computed(() => isVertical.value ? containerHeight.value : containerWidth.value)
const previousMarginPx = computed(() => toPixel(props.previousMargin))
const nextMarginPx = computed(() => toPixel(props.nextMargin))
const edgePadding = computed(() => !props.loop && props.snapToEdge ? { previous: 0, next: 0 } : { previous: previousMarginPx.value, next: nextMarginPx.value })
const itemSize = computed(() => Math.max(0, (viewportSize.value - previousMarginPx.value - nextMarginPx.value) / displayCount.value))
const contentSize = computed(() => itemSize.value * itemCount.value + edgePadding.value.previous + edgePadding.value.next)
const maxOffset = computed(() => Math.max(0, contentSize.value - viewportSize.value))
const videoPlaying = computed(() => props.stopAutoplayWhenVideoPlay && playingVideos.value.has(currentValue.value))
const shouldAutoplay = computed(() => props.autoplay && !videoPlaying.value && props.interval > 0 && itemCount.value > 1 && itemSize.value > 0 && (props.loop || currentValue.value < itemCount.value - 1))

function normalizeCurrent(value: number): number {
  const count = props.list.length
  if (!count || !Number.isFinite(value)) return 0
  const index = Math.trunc(value)
  if (index < 0) return props.loop ? count - 1 : 0
  if (index >= count) return props.loop ? 0 : count - 1
  return index
}
function toPixel(value: number | string): number {
  const pixels = parseFloat(addUnit(value))
  return Number.isFinite(pixels) ? Math.max(0, pixels) : 0
}
function pageOffset(index: number): number {
  return Math.max(0, Math.min(maxOffset.value, edgePadding.value.previous + index * itemSize.value - previousMarginPx.value))
}
function indexAtOffset(offset: number): number {
  if (offset <= 0.5) return 0
  return Math.max(0, Math.min(itemCount.value - 1, Math.round((offset + previousMarginPx.value - edgePadding.value.previous) / itemSize.value)))
}
function eventOffset(event: any): number | undefined {
  const raw = isVertical.value ? event?.detail?.scrollTop : event?.detail?.scrollLeft
  if (raw === undefined || raw === null) return undefined
  const offset = Number(raw)
  return Number.isFinite(offset) ? Math.max(0, Math.min(maxOffset.value, offset)) : undefined
}

const SWIPER_STYLE = defineStyleKeys({ height: '', borderRadius: '' })
const swiperStyle = computed(() => resolveStyle(SWIPER_STYLE, { height: addUnit(props.height), borderRadius: props.radius === undefined ? '' : addUnit(props.radius) }))
const TRACK_STYLE = defineStyleKeys({ width: '100%', height: '100%', flexDirection: 'row', paddingLeft: '0px', paddingRight: '0px', paddingTop: '0px', paddingBottom: '0px' })
const trackInnerStyle = computed(() => resolveStyle(TRACK_STYLE, {
  width: isVertical.value || itemSize.value <= 0 ? '100%' : addUnit(contentSize.value),
  height: !isVertical.value || itemSize.value <= 0 ? '100%' : addUnit(contentSize.value),
  flexDirection: isVertical.value ? 'column' : 'row',
  paddingLeft: isVertical.value ? '0px' : addUnit(edgePadding.value.previous),
  paddingRight: isVertical.value ? '0px' : addUnit(edgePadding.value.next),
  paddingTop: isVertical.value ? addUnit(edgePadding.value.previous) : '0px',
  paddingBottom: isVertical.value ? addUnit(edgePadding.value.next) : '0px'
}))
const ITEM_STYLE = defineStyleKeys({ width: '100%', height: '100%' })
const itemStyle = computed(() => {
  const size = itemSize.value > 0 ? addUnit(itemSize.value) : `${100 / displayCount.value}%`
  return resolveStyle(ITEM_STYLE, { width: isVertical.value ? '100%' : size, height: isVertical.value ? size : '100%' })
})
const mediaStyle = computed(() => ({ height: addUnit(props.height) }))
const swiperItemClass = computed(() => `wd-swiper__item ${slots.default ? 'wd-swiper__item--slot' : ''}`)
const swiperIndicator = computed<Partial<SwiperNavProps>>(() => {
  const indicator = isObj(props.indicator) ? props.indicator as Partial<SwiperNavProps> : {}
  return {
    current: currentValue.value, total: itemCount.value, direction: props.direction, indicatorPosition: props.indicatorPosition,
    type: indicator.type || 'dots', minShowNum: indicator.minShowNum ?? 2, showControls: indicator.showControls || false
  }
})

function isVideo(item: string | SwiperItem): boolean {
  if (isObj(item)) {
    const media = item as SwiperItem
    return media.type === 'video' || (media.type !== 'image' && isVideoUrl(media[props.valueKey]))
  }
  return isVideoUrl(item)
}
function getCustomItemClass(current: number, index: number, list: string[] | SwiperItem[]) {
  let customClass = ''
  if ((current - 1 + list.length) % list.length === index) customClass = props.customPrevClass || props.customPrevImageClass
  if ((current + 1) % list.length === index) customClass = props.customNextClass || props.customNextImageClass
  return customClass
}
function recordVideo(index: number, playing: boolean) {
  if (!isAlive()) return
  const next = new Set(playingVideos.value)
  if (playing) next.add(index)
  else next.delete(index)
  playingVideos.value = next
}
function handleVideoChange(previous: number, current: number) {
  if (!hasUniAdapter('createVideoContext')) return
  if (props.stopPreviousVideo && props.list[previous] !== undefined && isVideo(props.list[previous])) {
    uni.createVideoContext(`video-${previous}-${uid}`, instance.proxy)?.pause?.()
    recordVideo(previous, false)
  }
  if (props.autoplayVideo && props.list[current] !== undefined && isVideo(props.list[current])) {
    uni.createVideoContext(`video-${current}-${uid}`, instance.proxy)?.play?.()
  }
}
function updateCurrent(index: number, source: string) {
  const previous = currentValue.value
  if (index === previous) return false
  currentValue.value = index
  emit('update:current', index)
  emit('change', { current: index, source })
  handleVideoChange(previous, index)
  return true
}
function scrollToPage(index: number, source: string, smooth: boolean) {
  if (itemSize.value <= 0 || !itemCount.value) return
  const version = ++navigationVersion
  const offset = pageOffset(index)
  pendingNavigation = { version, current: index, source, offset }
  // 先提交轨道布局，再调用原生方法；不同时改 scroll-left/top 瞬时属性抢占动画。
  void nextTick(() => {
    if (isAlive() && pendingNavigation?.version === version) scrollViewTo(`#${swiperId}`, offset, smooth)
  })
}
function navTo(index: number, source = '', wrap = false) {
  index = normalizeCurrent(index)
  if (!itemCount.value || index === currentValue.value) return
  userScrolling.value = false
  hasScroll = false
  updateCurrent(index, source)
  scrollToPage(index, source, !wrap && props.duration > 0)
}
function handleIndicatorChange({ dir }: { dir: 'prev' | 'next' }) {
  const next = currentValue.value + (dir === 'next' ? 1 : -1)
  if (!props.loop && (next < 0 || next >= itemCount.value)) return
  navTo(next, '', props.loop && (next < 0 || next >= itemCount.value))
}
function autoNext() {
  if (userScrolling.value || pendingNavigation) return
  const next = currentValue.value + 1
  navTo(next, 'autoplay', props.loop && next >= itemCount.value)
}
function stopAutoplay() {
  clearInterval(playTimer)
  playTimer = undefined
}
function startAutoplay() {
  stopAutoplay()
  if (shouldAutoplay.value) playTimer = setInterval(() => { if (isAlive()) autoNext() }, props.interval)
}
watch([shouldAutoplay, () => props.interval], startAutoplay)
watch(() => props.current, (value) => navTo(value))
watch(itemCount, () => {
  const next = normalizeCurrent(currentValue.value)
  if (next !== currentValue.value) updateCurrent(next, '')
  navigationVersion++
  pendingNavigation = null
  userScrolling.value = false
})
watch(() => props.list.map((item) => isVideo(item) ? isObj(item) ? (item as SwiperItem)[props.valueKey] : item : null), (next, previous) => {
  playingVideos.value = new Set([...playingVideos.value].filter((index) => next[index] !== null && next[index] !== undefined && next[index] === previous[index]))
})

async function measure() {
  const version = ++measureVersion
  const rect = await getRect(`#${swiperId}`)
  if (!isAlive() || version !== measureVersion) return
  containerWidth.value = Math.max(0, Number(rect?.width) || 0)
  containerHeight.value = Math.max(0, Number(rect?.height) || 0)
  // 尺寸变化/初始非零 current 都真实定位；不制造一次假的 touch/change。
  navigationVersion++
  pendingNavigation = null
  lastOffset = pageOffset(currentValue.value)
  hasScroll = false
  void nextTick(() => {
    if (isAlive() && version === measureVersion && itemSize.value > 0) scrollViewTo(`#${swiperId}`, lastOffset, false)
  })
  startAutoplay()
}
function requestMeasure() {
  measureVersion++
  void nextTick(measure)
}
function handleLayoutChange(event: any) {
  emit('layoutchange', event)
  const width = Number(event?.detail?.width)
  const height = Number(event?.detail?.height)
  if (width === containerWidth.value && height === containerHeight.value) return
  requestMeasure()
}
watch([() => props.height, () => props.direction, () => props.displayMultipleItems, () => props.previousMargin, () => props.nextMargin, () => props.loop, () => props.snapToEdge, itemCount], requestMeasure)
onMounted(measure)
onBeforeUnmount(() => {
  measureVersion++
  navigationVersion++
  pendingNavigation = null
  stopAutoplay()
})

function handleTouchStart() {
  navigationVersion++
  pendingNavigation = null
  hasScroll = false
  userScrolling.value = true
}
function handleTouchEnd() {
  if (!hasScroll) userScrolling.value = false
}
function handleScroll(event: any) {
  const offset = eventOffset(event)
  if (offset === undefined || itemSize.value <= 0 || !itemCount.value) return
  lastOffset = offset
  if (!pendingNavigation && !userScrolling.value && !hasScroll && Math.abs(offset - pageOffset(currentValue.value)) <= 0.5) return
  if (event?.detail?.isDragging === true && pendingNavigation) handleTouchStart()
  hasScroll = true
  if (pendingNavigation) return // 程序动画中的中间 scroll 不是 touch 换页。
  userScrolling.value = true
  updateCurrent(indexAtOffset(offset), 'touch')
}
function handleScrollEnd(event: any) {
  if (itemSize.value <= 0 || !itemCount.value) return
  const offset = eventOffset(event)
  if (offset !== undefined) lastOffset = offset
  if (pendingNavigation) {
    // 旧动画的收尾不能结束较新的定位请求。
    if (offset !== undefined && Math.abs(offset - pendingNavigation.offset) > 0.5) return
    const { current, source } = pendingNavigation
    pendingNavigation = null
    userScrolling.value = false
    hasScroll = false
    emit('animationfinish', { current, source })
    return
  }
  if (!hasScroll && !userScrolling.value) return
  if (offset !== undefined) updateCurrent(indexAtOffset(offset), 'touch')
  const target = pageOffset(currentValue.value)
  if (Math.abs(lastOffset - target) > 0.5) {
    scrollToPage(currentValue.value, 'touch', props.duration > 0)
    return
  }
  userScrolling.value = false
  hasScroll = false
  emit('animationfinish', { current: currentValue.value, source: 'touch' })
}
function handleClick(index: number, item: string | SwiperItem, event: any) {
  emit('click', { index, item })
  emit('tap', event)
}
function handleLongPress(index: number, item: string | SwiperItem) {
  emit('long-press', { index, item })
}
</script>

<template>
  <view :class="`wd-swiper ${customClass}`" :style="parseStyle(customStyle)">
    <scroll-view
      :id="swiperId"
      class="wd-swiper__track"
      :style="swiperStyle"
      :scroll-x="!isVertical"
      :scroll-y="isVertical"
      @layoutchange="handleLayoutChange"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
      @touchcancel="handleTouchEnd"
      @scroll="handleScroll"
      @scrollend="handleScrollEnd"
    >
      <view class="wd-swiper__track-inner" :style="trackInnerStyle">
        <view v-for="(item, index) in list" :key="index" :class="swiperItemClass" :style="itemStyle">
          <slot :item="item" :index="index">
            <video
              v-if="isVideo(item)"
              :id="`video-${index}-${uid}`"
              :style="mediaStyle"
              :src="isObj(item) ? item[valueKey] : item"
              :poster="isObj(item) ? item.poster : ''"
              :class="`wd-swiper__video ${customItemClass} ${getCustomItemClass(currentValue, index, list)}`"
              @play="recordVideo(index, true)"
              @pause="recordVideo(index, false)"
              @ended="recordVideo(index, false)"
              :loop="videoLoop"
              :muted="muted"
              :autoplay="autoplayVideo"
              object-fit="cover"
              @tap="handleClick(index, item, $event)"
              @longpress="handleLongPress(index, item)"
            />
            <image
              v-else
              :src="isObj(item) ? item[valueKey] : item"
              :class="`wd-swiper__image ${customImageClass} ${customItemClass} ${getCustomItemClass(currentValue, index, list)}`"
              :style="mediaStyle"
              :mode="imageMode"
              :show-menu-by-longpress="showMenuByLongpress"
              @tap="handleClick(index, item, $event)"
              @longpress="handleLongPress(index, item)"
            />
            <text v-if="isObj(item) && item[textKey]" :class="`wd-swiper__text ${customTextClass}`" :style="parseStyle(customTextStyle)">{{ item[textKey] }}</text>
          </slot>
        </view>
      </view>
    </scroll-view>
    <template v-if="indicator">
      <slot name="indicator" :current="currentValue" :total="list.length" />
      <WdSwiperNav
        v-if="!slots.indicator"
        :custom-class="customIndicatorClass"
        :type="swiperIndicator.type"
        :current="swiperIndicator.current"
        :total="swiperIndicator.total"
        :direction="swiperIndicator.direction"
        :indicator-position="swiperIndicator.indicatorPosition"
        :min-show-num="swiperIndicator.minShowNum"
        :show-controls="swiperIndicator.showControls"
        @change="handleIndicatorChange"
      />
    </template>
  </view>
</template>

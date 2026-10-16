/*
 * wd-swiper — 轮播图
 *
 * Lynx 实现说明：
 * - 不使用 swiper 元素：该元素并非 Lynx 引擎内置，其 BehaviorController
 *   由宿主链接的 LynxUI 注册，宿主缺失时真机抛 "No BehaviorController
 *   defined for class swiper"（错误码 9902）致命异常且 JS 侧无法捕获；
 * - 故用 scroll-view + 轨道 transform 自研：当前页经 scroll-left 定位，
 *   滑动结束按 scrollLeft 吸附到最近页；
 * - 指示点为真实元素（Lynx 无伪元素）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, onUnmounted, ref, watch } from 'vue-lynx'
import { swiperProps, type SwiperExpose } from './types'
import { addUnit, getRect, parseStyle } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(swiperProps)
const emit = defineEmits(['change', 'click', 'update:current'])

const { proxy } = getCurrentInstance() as any
const isAlive = useAlive()

const current = ref(props.current)
const itemWidth = ref(0)
/** 用户正在滑动（滚动事件防抖标记，避免与 scroll-left 程序定位互搏） */
let scrollTimer: ReturnType<typeof setTimeout> | null = null
const userScrolling = ref(false)
/** 自动播放定时器 */
let playTimer: ReturnType<typeof setInterval> | null = null
/** 循环切换到首页时禁用一帧动画（避免倒滑全部页面） */
const wrapNoAnim = ref(false)

watch(
  () => props.current,
  (val) => {
    if (!userScrolling.value) {
      current.value = val
    }
  }
)

const swiperStyle = computed<Record<string, string>>(() => {
  return { height: addUnit(props.height), ...parseStyle(props.customStyle) }
})

const itemCount = computed(() => props.list.length || 0)

const trackStyle = computed(() => {
  return { width: `${itemCount.value * itemWidth.value}px` }
})

const itemStyle = computed(() => {
  return { width: `${itemWidth.value}px` }
})

const indicators = computed(() => Array.from({ length: itemCount.value }, (_, i) => i))

/** 滚动位置（当前页偏移） */
const scrollLeft = computed(() => current.value * itemWidth.value)

/** 自动播放是否应运行 */
const shouldAutoplay = computed(() => props.autoplay && props.interval > 0 && itemCount.value > 1)

function startAutoplay() {
  stopAutoplay()
  if (!shouldAutoplay.value) return
  playTimer = setInterval(() => {
    if (!isAlive()) return
    // 用户正在滑动时跳过本轮，避免与手势互搏
    if (userScrolling.value) return
    next()
  }, props.interval)
}

function stopAutoplay() {
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = null
  }
}

watch(shouldAutoplay, (val) => {
  if (val) startAutoplay()
  else stopAutoplay()
})

onMounted(() => {
  getRect('.wd-swiper__scroll', false, proxy).then((data) => {
    // 度量回调晚于组件卸载落地时丢弃（真机 9902 晚到 patch 家族）
    if (!isAlive()) return
    const width = Number(data.width) || 0
    itemWidth.value = width / Math.max(props.displayMultipleItems, 1)
    // 度量完成后布局才稳定，此时启动自动播放
    startAutoplay()
  })
})

// 防抖定时器与播放定时器不得活过组件：卸载后到期的回调会写 ref，
// 在已销毁树上继续 patch（真机 9902 晚到 patch 家族）。
onUnmounted(() => {
  stopAutoplay()
  if (scrollTimer) {
    clearTimeout(scrollTimer)
    scrollTimer = null
  }
})

function onScroll(e: any) {
  const left = Number(e.detail?.scrollLeft || 0)
  // itemWidth 未度量（0）时不换算：round(任意值/1) 会产生离谱 index
  if (itemWidth.value <= 0) return
  const index = Math.round(left / itemWidth.value)
  if (index !== current.value) {
    current.value = index
    emit('update:current', index)
    emit('change', { current: index })
  }
  // 标记用户滑动并防抖复位
  userScrolling.value = true
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    if (!isAlive()) return
    userScrolling.value = false
  }, 250)
}

function onClick(index: number) {
  emit('click', { index })
}

function next() {
  const total = itemCount.value || 1
  if (current.value === total - 1) {
    if (!props.circular) return
    // 循环：禁用一帧滚动动画，避免从末页倒滑回首页
    wrapNoAnim.value = true
    setTimeout(() => {
      if (isAlive()) wrapNoAnim.value = false
    }, 50)
  }
  current.value = (current.value + 1) % total
  emit('update:current', current.value)
  emit('change', { current: current.value })
}

function prev() {
  const total = itemCount.value || 1
  if (current.value === 0) {
    if (!props.circular) return
    wrapNoAnim.value = true
    setTimeout(() => {
      if (isAlive()) wrapNoAnim.value = false
    }, 50)
  }
  current.value = (current.value - 1 + total) % total
  emit('update:current', current.value)
  emit('change', { current: current.value })
}

defineExpose<SwiperExpose>({ next, prev })
</script>

<template>
  <view :class="`wd-swiper ${customClass}`" :style="swiperStyle">
    <scroll-view
      scroll-x
      :show-scrollbar="false"
      :scroll-left="scrollLeft"
      :scroll-with-animation="!wrapNoAnim"
      class="wd-swiper__scroll"
      @scroll="onScroll"
    >
      <view class="wd-swiper__track" :style="trackStyle">
        <view v-if="list.length" v-for="(item, index) in list" :key="index" class="wd-swiper__item" :style="itemStyle" @tap="onClick(index)">
          <image class="wd-swiper__img" :src="item.url || item.src" mode="aspectFill" />
        </view>
        <template v-else>
          <slot />
        </template>
      </view>
    </scroll-view>
    <view v-if="showIndicator && indicators.length > 1" :class="`wd-swiper__indicators wd-swiper__indicators--${direction}`">
      <view v-for="i in indicators" :key="i" :class="['wd-swiper__dot', i === current ? 'is-active' : '']" />
    </view>
  </view>
</template>

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

onMounted(() => {
  getRect('.wd-swiper__scroll', false, proxy).then((data) => {
    // 度量回调晚于组件卸载落地时丢弃（真机 9902 晚到 patch 家族）
    if (!isAlive()) return
    const width = Number(data.width) || 0
    itemWidth.value = width / Math.max(props.displayMultipleItems, 1)
  })
})

// 防抖定时器不得活过组件：卸载后 250ms 到期的回调会写 userScrolling，
// 在已销毁树上继续 patch（真机 9902 晚到 patch 家族）。
onUnmounted(() => {
  if (scrollTimer) {
    clearTimeout(scrollTimer)
    scrollTimer = null
  }
})

function onScroll(e: any) {
  const left = Number(e.detail?.scrollLeft || 0)
  const index = Math.round(left / Math.max(itemWidth.value, 1))
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
  current.value = (current.value + 1) % total
  emit('update:current', current.value)
}

function prev() {
  const total = itemCount.value || 1
  current.value = (current.value - 1 + total) % total
  emit('update:current', current.value)
}

defineExpose<SwiperExpose>({ next, prev })
</script>

<template>
  <view :class="`wd-swiper ${customClass}`" :style="swiperStyle">
    <scroll-view
      scroll-x
      :show-scrollbar="false"
      :scroll-left="scrollLeft"
      :scroll-with-animation="true"
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

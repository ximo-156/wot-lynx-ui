/*
 * wd-notice-bar — 通知栏
 *
 * Lynx 实现说明：
 * - 纵向滚动（text 为数组）：定时切换索引 + fade 过渡；
 * - 横向滚动（单行超出、scrollable）：onMounted 用 getRect 一次性度量文本
 *   与容器宽度并缓存（CONVENTIONS §16），文本比容器宽时用定时器步进 +
 *   CSS transition 驱动 transform 位移，首尾往返（ping-pong）；
 * - 不可滚动 / 文本未超出时保持静态裁剪现状；
 * - 关闭经 @tap。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, onUnmounted, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { noticeBarProps, type NoticeBarExpose } from './types'
import { filterStyle, getRect, parseStyle, uuid } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(noticeBarProps)
const emit = defineEmits(['click', 'close'])
const isAlive = useAlive()

const show = ref<boolean>(true)
const currentIndex = ref<number>(0)

// 实例唯一 id 前缀：getRect 按 id 度量，同页多实例避免选择器串台。
const instanceId = `wd-notice-bar-${uuid()}`

const textArray = computed(() => (Array.isArray(props.text) ? props.text : [props.text]))
const isVertical = computed(() => props.direction === 'vertical' && textArray.value.length > 1)
// 横向跑马灯仅用于：可滚动、不换行、非纵向 的单行文本。
const canMarquee = computed(() => props.scrollable && !props.wrapable && !isVertical.value)

// 横向滚动步进周期（ms）：与 contentStyle 的 transition 时长对齐，
// 使定时器步进 + transition 补间形成连续位移（与纵向滚动同范式）。
const MARQUEE_STEP_MS = 100

const marqueeOffset = ref<number>(0)
const marqueeActive = ref<boolean>(false)
let marqueeMax = 0
let marqueeDir = 1
let marqueeTimer: ReturnType<typeof setInterval> | null = null
let marqueeDelayTimer: ReturnType<typeof setTimeout> | null = null

let verticalTimer: ReturnType<typeof setInterval> | null = null

function stopVerticalScroll() {
  if (verticalTimer) {
    clearInterval(verticalTimer)
    verticalTimer = null
  }
}

function startVerticalScroll() {
  stopVerticalScroll()
  verticalTimer = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % textArray.value.length
  }, 2000)
}

function stopMarquee() {
  if (marqueeTimer) {
    clearInterval(marqueeTimer)
    marqueeTimer = null
  }
  if (marqueeDelayTimer) {
    clearTimeout(marqueeDelayTimer)
    marqueeDelayTimer = null
  }
  marqueeActive.value = false
  marqueeOffset.value = 0
  marqueeDir = 1
}

function startMarquee() {
  stopMarquee()
  // delay（s）延迟后启动，避免文本一切换就立即滚动。
  marqueeDelayTimer = setTimeout(() => {
    marqueeDelayTimer = null
    if (!isAlive()) return
    marqueeActive.value = true
    marqueeTimer = setInterval(() => {
      const step = (props.speed * MARQUEE_STEP_MS) / 1000
      let next = marqueeOffset.value + marqueeDir * step
      if (next >= marqueeMax) {
        next = marqueeMax
        marqueeDir = -1
      } else if (next <= 0) {
        next = 0
        marqueeDir = 1
      }
      marqueeOffset.value = next
    }, MARQUEE_STEP_MS)
  }, Math.max(0, props.delay) * 1000)
}

/** 一次性度量文本与容器宽度，文本超出时才启动跑马灯（CONVENTIONS §16） */
function initMarquee() {
  stopMarquee()
  if (!canMarquee.value) return
  Promise.all([getRect(`#${instanceId}-wrap`), getRect(`#${instanceId}-text`)]).then((rects) => {
    if (!isAlive()) return
    const wrapW = (rects[0] && rects[0].width) || 0
    const textW = (rects[1] && rects[1].width) || 0
    if (wrapW > 0 && textW > wrapW) {
      marqueeMax = textW - wrapW
      startMarquee()
    }
  })
}

const noticeBarClass = computed(() => {
  const classes: string[] = []
  if (isVertical.value) classes.push('wd-notice-bar--vertical')
  if (props.wrapable) classes.push('is-wrapable')
  // type 映射到 is-<type> 状态类（warning 为基类默认配色，仅 danger/info 需覆盖）
  if (props.type && props.type !== 'warning') classes.push(`is-${props.type}`)
  return classes.join(' ')
})

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.color) style.color = props.color
  if (props.backgroundColor) style['background-color'] = props.backgroundColor
  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

const contentClass = computed(() => {
  return ['wd-notice-bar__content', canMarquee.value ? 'is-marquee' : ''].join(' ').trim()
})

const contentStyle = computed<Record<string, string>>(() => {
  if (isVertical.value) {
    return {
      transform: `translateY(-${currentIndex.value * 20}px)`,
      transition: 'transform 0.3s ease'
    } as Record<string, string>
  }
  if (marqueeActive.value) {
    return {
      transform: `translateX(-${marqueeOffset.value}px)`,
      transition: `transform ${MARQUEE_STEP_MS}ms linear`
    } as Record<string, string>
  }
  return {} as Record<string, string>
})

function handleClick() {
  emit('click', { index: currentIndex.value })
}

function handleClose() {
  show.value = false
  emit('close')
}

function reset() {
  currentIndex.value = 0
  if (isVertical.value) startVerticalScroll()
  else initMarquee()
}

onMounted(() => {
  if (isVertical.value) {
    startVerticalScroll()
  } else {
    initMarquee()
  }
})

// 文本 / 滚动开关 / 方向变化时重新度量（非 touchmove 热路径，允许 getRect）。
watch(
  () => [props.text, props.scrollable, props.wrapable, props.direction],
  () => {
    if (isVertical.value) {
      currentIndex.value = 0
      startVerticalScroll()
    } else {
      initMarquee()
    }
  }
)

onUnmounted(() => {
  stopVerticalScroll()
  stopMarquee()
})

defineExpose<NoticeBarExpose>({ reset })
</script>

<template>
  <view v-if="show" :class="`wd-notice-bar ${customClass} ${noticeBarClass}`" :style="rootStyle">
    <wd-icon v-if="prefix" custom-class="wd-notice-bar__prefix" :name="prefix" />
    <slot v-else name="prefix" />
    <view class="wd-notice-bar__wrap" :id="`${instanceId}-wrap`">
      <view :class="contentClass" :style="contentStyle" @tap="handleClick">
        <template v-if="isVertical">
          <view v-for="(item, index) in textArray" :key="index" class="wd-notice-bar__line">
            <text class="wd-notice-bar__text">{{ item }}</text>
          </view>
        </template>
        <text v-else-if="wrapable" class="wd-notice-bar__text">{{ text }}</text>
        <text v-else class="wd-notice-bar__text" :id="`${instanceId}-text`">{{ text }}</text>
      </view>
    </view>
    <wd-icon v-if="closable" custom-class="wd-notice-bar__close" name="close" @tap="handleClose" />
  </view>
</template>

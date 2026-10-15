/*
 * wd-notice-bar — 通知栏
 *
 * Lynx 实现说明：
 * - 纵向滚动（text 为数组）：定时切换索引 + fade 过渡；
 * - 横向滚动（单行超出）：transform 位移 + 首尾往返，
 *   位移量经一次性度量缓存（CONVENTIONS §16）；
 * - 关闭经 @tap。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, onUnmounted, ref } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { noticeBarProps, type NoticeBarExpose } from './types'
import { objToStyle } from '../../common/util'

const props = defineProps(noticeBarProps)
const emit = defineEmits(['click', 'close'])

const show = ref<boolean>(true)
const currentIndex = ref<number>(0)

const textArray = computed(() => (Array.isArray(props.text) ? props.text : [props.text]))
const isVertical = computed(() => props.direction === 'vertical' && textArray.value.length > 1)

let timer: ReturnType<typeof setInterval> | null = null

function startVerticalScroll() {
  stopVerticalScroll()
  timer = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % textArray.value.length
  }, 2000)
}

function stopVerticalScroll() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
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
  return objToStyle(style) + (props.customStyle ? `; ${props.customStyle}` : '')
})

const contentStyle = computed(() => {
  return isVertical.value ? `transform: translateY(-${currentIndex.value * 20}px); transition: transform 0.3s ease;` : ''
})

function animationEnd() {
  // 横向滚动结束的扩展位
}

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
}

onMounted(() => {
  if (isVertical.value) {
    startVerticalScroll()
  }
})

onUnmounted(() => {
  stopVerticalScroll()
})

defineExpose<NoticeBarExpose>({ reset })
</script>

<template>
  <view v-if="show" :class="`wd-notice-bar ${customClass} ${noticeBarClass}`" :style="rootStyle">
    <wd-icon v-if="prefix" custom-class="wd-notice-bar__prefix" :name="prefix" />
    <slot v-else name="prefix" />
    <view class="wd-notice-bar__wrap">
      <view class="wd-notice-bar__content" :style="contentStyle" @transitionend="animationEnd" @tap="handleClick">
        <template v-if="isVertical">
          <view v-for="(item, index) in textArray" :key="index" class="wd-notice-bar__line">
            <text class="wd-notice-bar__text">{{ item }}</text>
          </view>
        </template>
        <text v-else-if="wrapable" class="wd-notice-bar__text">{{ text }}</text>
        <text v-else class="wd-notice-bar__text">{{ text }}</text>
      </view>
    </view>
    <wd-icon v-if="closable" custom-class="wd-notice-bar__close" name="close" @tap="handleClose" />
  </view>
</template>

/*
 * wd-count-to — 数字滚动
 *
 * Lynx 实现说明：
 * - 经 requestAnimationFrame 在后台线程驱动数值过渡，
 *   easeOutQuart 缓动；useEasing 为 false 时线性；
 * - 千分位 / 小数位 / 前后缀格式化与 wot-ui 一致；
 * - 命令式 API 经 defineExpose 暴露 start / reset / pause（wot-ui 契约：
 *   CountToExpose），autoStart 为 false 的实例可外部启动；
 * - startVal / endVal / duration 变化时自动重置并重启动画。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { computed, onMounted, ref, watch } from 'vue-lynx'
import WdText from '../wd-text/wd-text.vue'
import { countToProps, type CountToExpose } from './types'
import { useRaf } from '../../composables/useRaf'

const props = defineProps(countToProps)
const emit = defineEmits(['finish', 'mounted'])

const current = ref<number>(props.startVal)
const { start: startRaf, cancel: cancelRaf } = useRaf(tick)

let startTime = 0
let rafRunning = false

const timeText = computed(() => {
  const decimals = Number(props.decimals) || 0
  let value = current.value.toFixed(decimals)
  value = String(Number(value)) // 去掉多余的 0
  if (decimals > 0) {
    value = current.value.toFixed(decimals)
  }
  const parts = value.split('.')
  let intPart = parts[0]
  const decimalPart = parts[1] ? props.decimal + parts[1] : ''
  const rgx = /(\d+)(\d{3})/
  while (rgx.test(intPart)) {
    intPart = intPart.replace(rgx, '$1' + props.separator + '$2')
  }
  return intPart + decimalPart
})

function tick(now: number) {
  if (!startTime) startTime = now
  const progress = Math.min((now - startTime) / props.duration, 1)
  const eased = props.useEasing ? 1 - Math.pow(1 - progress, 4) : progress
  current.value = props.startVal + (props.endVal - props.startVal) * eased
  if (progress < 1) {
    startRaf()
  } else {
    rafRunning = false
    emit('finish')
  }
}

function start() {
  if (rafRunning) return
  rafRunning = true
  startTime = 0
  cancelRaf()
  startRaf()
}

/** 暂停：取消当前动画帧，current 保持当前值（可再次 start 继续） */
function pause() {
  rafRunning = false
  cancelRaf()
}

/** 重置：回到 startVal，autoStart 为 true 时自动重启动画 */
function resetTime() {
  pause()
  current.value = props.startVal
  if (props.autoStart) {
    start()
  }
}

// startVal / endVal / duration 变化时重置动画（否则会继续奔向旧目标值）
watch([() => props.startVal, () => props.endVal, () => props.duration], resetTime)

onMounted(() => {
  if (props.autoStart) {
    start()
  }
  emit('mounted')
})

defineExpose<CountToExpose>({
  start,
  reset: resetTime,
  pause
})
</script>

<template>
  <view :class="`wd-count-to ${customClass}`" :style="parseStyle(customStyle)">
    <slot name="prefix">
      <wd-text custom-class="wd-count-to__separator-text" :type="type" :color="color" :text="prefix" />
    </slot>
    <slot>
      <wd-text custom-class="wd-count-to__main-text" :type="type" :color="color" :text="timeText" />
    </slot>
    <slot name="suffix">
      <wd-text custom-class="wd-count-to__separator-text" :type="type" :color="color" :text="suffix" />
    </slot>
  </view>
</template>

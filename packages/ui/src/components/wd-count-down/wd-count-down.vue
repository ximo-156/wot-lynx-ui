/*
 * wd-count-down — 倒计时
 *
 * Lynx 实现说明：
 * - 经 useCountDown composable 驱动（requestAnimationFrame），
 *   毫秒级 / 秒级两种刷新策略；
 * - format 支持 DD/HH/mm/ss/SS 占位符；
 * - autoStart 控制挂载后是否自动开始。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted } from 'vue-lynx'
import { countDownProps, type CountDownExpose } from './types'
import { useCountDown } from '../../composables/useCountDown'
import { padZero, parseStyle } from '../../common/util'

const props = defineProps(countDownProps)
const emit = defineEmits(['finish', 'change'])

const { current, start, pause, reset } = useCountDown({
  time: props.time,
  millisecond: props.millisecond,
  // change 载荷与 wot-ui 一致：直接发 CurrentTime 对象（不再外包一层 current）
  onChange: (value) => emit('change', value),
  onFinish: () => emit('finish')
})

const timeText = computed(() => {
  const { format } = props
  const { days, hours, minutes, seconds, milliseconds } = current.value
  return format
    .replace(/DD/g, padZero(days))
    .replace(/HH/g, padZero(hours))
    .replace(/mm/g, padZero(minutes))
    .replace(/ss/g, padZero(seconds))
    .replace(/SS/g, padZero(Math.floor(milliseconds / 10)))
})

onMounted(() => {
  if (props.autoStart) {
    start()
  }
})

defineExpose<CountDownExpose>({ start, pause, reset })
</script>

<template>
  <view :class="`wd-count-down ${customClass}`" :style="parseStyle(customStyle)">
    <slot :current="current" v-if="$slots.default" />
    <text v-else class="wd-count-down__text">{{ timeText }}</text>
  </view>
</template>

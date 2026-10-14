<template>
  <view :class="`wd-count-down ${customClass}`" :style="styleToObject(customStyle)">
    <slot :current="current" v-if="$slots.default" />
    <!-- Lynx 适配：数字与分隔符拆分渲染，分别应用 600 字重与辅助色（样式见 index.scss）。 -->
    <text v-else class="wd-count-down__text">
      <text
        v-for="(segment, index) in timeSegments"
        :key="index"
        :class="segment.isNumber ? 'wd-count-down__num' : 'wd-count-down__separator'"
      ><text>{{ segment.text }}</text></text>
    </text>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import { styleToObject } from '../../common/util'
import { watch, computed, onMounted } from 'vue-lynx'
import { parseFormat } from './utils'
import { useCountDown } from '../../composables/useCountDown'
import { countDownProps, type CountDownExpose } from './types'

const props = defineProps(countDownProps)

const emit = defineEmits(['change', 'finish'])

const { start, pause, reset, current } = useCountDown({
  time: props.time,
  millisecond: props.millisecond,
  onChange: (current) => emit('change', current),
  onFinish: () => emit('finish')
})

const timeText = computed(() => parseFormat(props.format, current.value))

/** 将时间文本按「数字段 / 分隔符段」拆分，便于分别应用字重与颜色 */
const timeSegments = computed(() => {
  return timeText.value
    .split(/([^\d]+)/)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, isNumber: /^\d+$/.test(part) }))
})

const resetTime = () => {
  reset(props.time)
  if (props.autoStart) {
    start()
  }
}

watch(() => props.time, resetTime, { immediate: false })

onMounted(() => {
  resetTime()
})

defineExpose<CountDownExpose>({
  start,
  pause,
  reset: resetTime
})
</script>


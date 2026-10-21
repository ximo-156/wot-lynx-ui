/*
 * wd-count-down — 倒计时。
 * 保留官方格式/插槽/命令式方法；时间与精度通过 getter 保持实时，change 为独立快照。
 * 原生 text 显式继承根 typography；customStyle 经逐元素 Style Funnel 清除旧键。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, watch } from 'vue-lynx'
import { countDownProps, type CountDownExpose } from './types'
import { useCountDown } from '../../composables/useCountDown'
import { parseFormat } from './utils'
import { parseStyle } from '../../common/util'
import { createStyleResolver } from '../../common/style'

const props = defineProps(countDownProps)
const emit = defineEmits(['change', 'finish'])
const { start, pause, reset, current } = useCountDown({
  get time() { return props.time },
  get millisecond() { return props.millisecond },
  onChange: (current) => emit('change', current),
  onFinish: () => emit('finish')
})
const resolveRootStyle = createStyleResolver()
const rootStyle = computed(() => resolveRootStyle(parseStyle(props.customStyle)))
const timeText = computed(() => parseFormat(props.format, current.value))
function resetTime() {
  reset(props.time)
  if (props.autoStart) start()
}
watch(() => props.time, resetTime)
onMounted(resetTime)
defineExpose<CountDownExpose>({ start, pause, reset: resetTime })
</script>

<template>
  <view :class="`wd-count-down ${customClass}`" :style="rootStyle">
    <slot :current="current" v-if="$slots.default" />
    <text v-else class="wd-count-down__text">{{ timeText }}</text>
  </view>
</template>

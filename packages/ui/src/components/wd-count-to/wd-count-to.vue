/*
 * wd-count-to — 数字滚动。
 * 保留官方 easing、线性/反向计数与三插槽；零时长直接显示终值。
 * 正确性修复：elapsed/decimals 有界、分隔符按字面值插入，避免数字分隔符无限循环。
 * 官方声明却漏绑的 customStyle 在 Lynx 可用，并通过逐元素 Style Funnel 清理。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, watch } from 'vue-lynx'
import WdText from '../wd-text/wd-text.vue'
import { countToProps, type CountToExpose } from './types'
import { easingFn, parseStyle } from '../../common/util'
import { createStyleResolver } from '../../common/style'
import { useCountDown } from '../../composables/useCountDown'

const props = defineProps(countToProps)
const emit = defineEmits(['mounted', 'finish'])
const { start, pause, reset, current } = useCountDown({
  get time() { return props.duration },
  millisecond: true,
  onFinish: () => emit('finish')
})
const rootClass = computed(() => `wd-count-to ${props.customClass}`)
const resolveRootStyle = createStyleResolver()
const rootStyle = computed(() => resolveRootStyle(parseStyle(props.customStyle)))
const precision = computed(() => {
  const value = props.decimals
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.trunc(value))) : 0
})
watch(() => props.decimals, (value) => {
  if (value !== precision.value) console.warn('[wd-count-to] decimals must be an integer between 0 and 100; using', precision.value)
}, { immediate: true })
const timeText = computed(() => {
  const startVal = Number.isFinite(props.startVal) ? props.startVal : 0
  const endVal = Number.isFinite(props.endVal) ? props.endVal : 0
  const duration = props.duration
  if (!Number.isFinite(duration) || duration <= 0) return formatNumber(endVal)
  const elapsed = Math.max(0, Math.min(duration, duration - current.value.total))
  const value = props.useEasing
    ? easingFn(elapsed, startVal, endVal - startVal, duration)
    : startVal + (endVal - startVal) * (elapsed / duration)
  return formatNumber(Math.max(Math.min(startVal, endVal), Math.min(Math.max(startVal, endVal), value)))
})
function formatNumber(value: number): string {
  const [integer, fraction] = value.toFixed(precision.value).split('.')
  const grouped = props.separator ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, () => props.separator) : integer
  return grouped + (fraction === undefined ? '' : props.decimal + fraction)
}
function resetTime() {
  reset(props.duration)
  if (props.autoStart) start()
}
watch([() => props.startVal, () => props.endVal, () => props.duration], resetTime)
onMounted(() => { resetTime(); emit('mounted') })
defineExpose<CountToExpose>({ start, reset: resetTime, pause })
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <slot name="prefix"><WdText custom-class="wd-count-to__separator-text" :type="type" :color="color" :text="prefix" /></slot>
    <slot><WdText custom-class="wd-count-to__main-text" :type="type" :color="color" :text="timeText" /></slot>
    <slot name="suffix"><WdText custom-class="wd-count-to__separator-text" :type="type" :color="color" :text="suffix" /></slot>
  </view>
</template>

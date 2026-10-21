/*
 * wd-count-to — 数字滚动
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 数值过渡经共享 composable useCountDown（millisecond 模式，rAF 逐帧刷新）
 *   驱动：remaining 时间经 easingFn（useEasing）或线性插值换算当前值，
 *   startVal > endVal 时反向递减并 clamp，与参考源 parseFormat 逐行一致；
 * - 参考源根 view 只绑 :class（未绑定 customStyle，与 wot-ui 行为对齐），
 *   文本经 wd-text 子组件渲染（前缀 / 主体 / 后缀三槽位，custom-class 挂
 *   wd-count-to__separator-text / wd-count-to__main-text）；
 * - startVal / endVal / duration 变化时走 resetTime（reset + autoStart 重启），
 *   挂载时先 resetTime 再 emit mounted，与参考源一致；
 * - 参考源 options 块的 virtualHost / addGlobalClass / styleIsolation 为
 *   uni-app 小程序专有能力，Lynx 无需声明，已移除；
 * - 原生优先重写（NATIVE-REWRITE §3）：本组件为纯展示（rAF 数值过渡由后台
 *   线程 composable 驱动，无跟手手势，不涉及 MTS），根 view 经 SCSS 显式
 *   补全三件套（display: flex + flex-direction: row + align-items:
 *   flex-end）——「前缀 + 主体 + 后缀」横向文本组合，底边对齐等价承担参考源
 *   vertical-align: bottom 的视觉语义（该 Web 专有声明 Lynx 不识别，已移除）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, watch } from 'vue-lynx'
import WdText from '../wd-text/wd-text.vue'
import { countToProps, type CountToExpose } from './types'
import { easingFn, isNumber } from '../../common/util'
import { useCountDown } from '../../composables/useCountDown'

const props = defineProps(countToProps)
const emit = defineEmits(['mounted', 'finish'])

const { start, pause, reset, current } = useCountDown({
  time: props.duration,
  millisecond: true,
  onFinish: () => emit('finish')
})

// 计算根元素的类名
const rootClass = computed(() => {
  return `wd-count-to ${props.customClass}`
})

const timeText = computed(() => {
  return parseFormat(current.value.total)
})

watch([() => props.startVal, () => props.endVal, () => props.duration], resetTime, { immediate: false })

onMounted(() => {
  resetTime()
  emit('mounted')
})

// 重置动画
function resetTime() {
  reset(props.duration)
  if (props.autoStart) {
    start()
  }
}

function parseFormat(remain: number) {
  const { startVal, endVal, duration, useEasing } = props
  if (duration <= 0) return formatNumber(endVal)
  const progress = duration - remain // 已经进行的时间
  const isPositive = startVal > endVal // 判断startVal是否大于endVal
  const progressRatio = progress / duration // 计算进度比例

  let currentVal: number

  if (useEasing) {
    // 使用缓动函数计算currentVal
    if (isPositive) {
      currentVal = startVal - easingFn(progress, 0, startVal - endVal, duration) || 0
    } else {
      currentVal = easingFn(progress, startVal, endVal - startVal, duration)
    }
  } else {
    // 不使用缓动函数时的计算方式
    if (isPositive) {
      currentVal = startVal - (startVal - endVal) * progressRatio
    } else {
      currentVal = startVal + (endVal - startVal) * progressRatio
    }
  }
  // 确保currentVal在startVal和endVal之间
  currentVal = isPositive ? Math.max(endVal, currentVal) : Math.min(endVal, currentVal)
  return formatNumber(currentVal)
}

// 格式化数字
function formatNumber(num: any): string {
  if (typeof num !== 'number') {
    num = parseFloat(num)
    if (isNaN(num)) {
      return '0'
    }
  }
  num = num.toFixed(props.decimals)
  const parts = num.split('.')
  let integerPart = parts[0]
  const decimalPart = parts.length > 1 ? props.decimal + parts[1] : ''
  const rgx = /(\d+)(\d{3})/

  if (props.separator && !isNumber(props.separator)) {
    while (rgx.test(integerPart)) {
      integerPart = integerPart.replace(rgx, '$1' + props.separator + '$2')
    }
  }
  return integerPart + decimalPart
}

defineExpose<CountToExpose>({ start, reset: resetTime, pause })
</script>

<template>
  <view :class="rootClass">
    <!-- 前缀插槽 -->
    <slot name="prefix">
      <WdText custom-class="wd-count-to__separator-text" :type="type" :color="color" :text="prefix"></WdText>
    </slot>
    <!-- 默认文本插槽 -->
    <slot>
      <WdText custom-class="wd-count-to__main-text" :type="type" :color="color" :text="timeText"></WdText>
    </slot>
    <!-- 后缀插槽 -->
    <slot name="suffix">
      <WdText custom-class="wd-count-to__separator-text" :type="type" :color="color" :text="suffix"></WdText>
    </slot>
  </view>
</template>

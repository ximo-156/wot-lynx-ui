/*
 * wd-count-down — 倒计时
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 参考源默认分支以 block 元素承载裸文本 {{ timeText }}；Lynx 无 block 元素，
 *   且 view 内裸文本不渲染（CONVENTIONS §4 / PORTING §3.2），改为 text 元素
 *   包裹并挂 wd-count-down__text 类名（本地测试按该类名断言格式化结果）；
 * - 参考源根 view 直接绑定 customStyle 字符串，改为 parseStyle(customStyle)
 *   归一的对象语法（CONVENTIONS §19：字符串 style 被静默丢弃）；
 * - 计时逻辑经共享 composable useCountDown（requestAnimationFrame 驱动，
 *   毫秒 / 秒两级刷新策略）实现，与参考源一致；time 变化时走 resetTime
 *   （reset + autoStart 重启），挂载时同样先 resetTime；
 * - format 占位符解析（DD / HH / mm / ss / S / SS / SSS，未出现的单位向上
 *   进位）落在 utils.ts 的 parseFormat，与参考源逐行一致；
 * - 参考源 options 块的 virtualHost / addGlobalClass / styleIsolation 为
 *   uni-app 小程序专有能力，Lynx 无需声明，已移除。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, watch } from 'vue-lynx'
import { countDownProps, type CountDownExpose } from './types'
import { useCountDown } from '../../composables/useCountDown'
import { parseFormat } from './utils'
import { parseStyle } from '../../common/util'

const props = defineProps(countDownProps)

const emit = defineEmits(['change', 'finish'])

const { start, pause, reset, current } = useCountDown({
  time: props.time,
  millisecond: props.millisecond,
  onChange: (current) => emit('change', current),
  onFinish: () => emit('finish')
})

const timeText = computed(() => parseFormat(props.format, current.value))

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

<template>
  <view :class="`wd-count-down ${customClass}`" :style="parseStyle(customStyle)">
    <slot :current="current" v-if="$slots.default" />
    <text v-else class="wd-count-down__text">{{ timeText }}</text>
  </view>
</template>

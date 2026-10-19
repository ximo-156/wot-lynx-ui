/*
 * wd-calendar-view — 日历视图
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 按 wot-ui 的 year-panel / month-panel 双层结构组织：month / monthrange
 *   走 year-panel（年份网格），其余类型走 month-panel（月份滚动 + 周表头
 *   + datetime 时间选择器）；
 * - customStyle 为字符串，经 parseStyle 归一为对象后绑定（CONVENTIONS §19）；
 * - 内部子组件（month / year / year-panel / month-panel）的样式分别在各自
 *   目录的 index.scss 中，组件私有令牌统一定义在本目录的 index.scss
 *   （与 wot-ui 的变量拆分一致）。
 */
<script lang="ts" setup>
import './index.css'

import { ref, watch } from 'vue-lynx'
import { getDefaultTime } from './utils'
import YearPanel from './yearPanel/year-panel.vue'
import MonthPanel from './monthPanel/month-panel.vue'
import { calendarViewProps, type CalendarViewExpose } from './types'
import { parseStyle } from '../../common/util'

const props = defineProps(calendarViewProps)
const emit = defineEmits(['change', 'update:modelValue', 'pickstart', 'pickend'])
const formatDefauleTime = ref<number[][]>([])

const yearPanelRef = ref()
const monthPanelRef = ref()

watch(
  () => props.defaultTime,
  (newValue) => {
    formatDefauleTime.value = getDefaultTime(newValue)
  },
  {
    deep: true,
    immediate: true
  }
)

/**
 * 使当前日期或者选中日期滚动到可视区域
 */
function scrollIntoView() {
  const panel = getPanel()
  panel.scrollIntoView && panel.scrollIntoView()
}

function getPanel() {
  return props.type.indexOf('month') > -1 ? yearPanelRef.value : monthPanelRef.value
}

function handleChange({ value }: { value: number | number[] | null }) {
  emit('update:modelValue', value)
  emit('change', {
    value
  })
}
function handlePickStart() {
  emit('pickstart')
}
function handlePickEnd() {
  emit('pickend')
}

defineExpose<CalendarViewExpose>({
  scrollIntoView
})
</script>

<template>
  <view :class="`wd-calendar-view ${customClass}`" :style="parseStyle(customStyle)">
    <YearPanel
      v-if="type === 'month' || type === 'monthrange'"
      ref="yearPanelRef"
      :type="type"
      :value="modelValue"
      :min-date="minDate"
      :max-date="maxDate"
      :formatter="formatter"
      :max-range="maxRange"
      :range-prompt="rangePrompt"
      :allow-same-day="allowSameDay"
      :show-panel-title="showPanelTitle"
      :default-time="formatDefauleTime"
      :panel-height="panelHeight"
      :switch-mode="switchMode"
      @change="handleChange"
    />
    <MonthPanel
      v-else
      ref="monthPanelRef"
      :type="type"
      :value="modelValue"
      :min-date="minDate"
      :max-date="maxDate"
      :first-day-of-week="firstDayOfWeek"
      :formatter="formatter"
      :max-range="maxRange"
      :range-prompt="rangePrompt"
      :allow-same-day="allowSameDay"
      :show-panel-title="showPanelTitle"
      :default-time="formatDefauleTime"
      :panel-height="panelHeight"
      :immediate-change="immediateChange"
      :time-filter="timeFilter"
      :hide-second="hideSecond"
      :item-height="timeItemHeight"
      :visible-item-count="timeVisibleItemCount"
      :switch-mode="switchMode"
      @change="handleChange"
      @pickstart="handlePickStart"
      @pickend="handlePickEnd"
    />
  </view>
</template>

/*
 * wd-calendar-view — 日历视图
 *
 * Lynx 实现说明：
 * - 整合式实现：周表头 + 月历网格（6×7）+ 时间面板（datetime 类型）
 *   合并在单一组件内，省去 wot-ui 的 year-panel/month-panel 多层嵌套；
 * - 支持 date / dates / datetime / week / daterange / datetimerange /
 *   weekrange 类型；范围选择带 maxRange 限制与 rangePrompt；
 * - formatter 钩子可改写每个日期格子的展示与禁用态。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdPickerView from '../wd-picker-view/wd-picker-view.vue'
import { calendarViewProps, type CalendarDayItem, type CalendarDayType, type CalendarType } from './types'
import { padZero } from '../../common/util'
import { useTranslate } from '../../composables/useTranslate'

const { translate } = useTranslate('calendar-view')

const props = defineProps(calendarViewProps)
const emit = defineEmits(['change', 'update:modelValue', 'pickstart', 'pickend'])

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

/** 当前展示的年月 */
const displayYear = ref<number>(0)
const displayMonth = ref<number>(0)

/** 内部选中值 */
const innerValue = ref<number | number[] | null>(null)

const isRangeType = computed(() => props.type === 'daterange' || props.type === 'datetimerange' || props.type === 'weekrange')
const isMultipleType = computed(() => props.type === 'dates')
const hasTime = computed(() => props.type === 'datetime' || props.type === 'datetimerange')

/** 初始化 */
watch(
  () => props.modelValue,
  (val) => {
    innerValue.value = val
    const base = getBaseTime(val)
    displayYear.value = base.getFullYear()
    displayMonth.value = base.getMonth() + 1
  },
  { immediate: true, deep: true }
)

function getBaseTime(val: number | number[] | null): Date {
  if (typeof val === 'number') return new Date(val)
  if (Array.isArray(val) && val.length > 0) return new Date(val[0])
  return new Date()
}

/** 周表头（按 firstDayOfWeek 偏移） */
const weeks = computed(() => {
  const result: string[] = []
  for (let i = 0; i < 7; i++) {
    result.push(WEEK_LABELS[(i + props.firstDayOfWeek) % 7])
  }
  return result
})

/** 月历网格 42 格 */
const days = computed<CalendarDayItem[]>(() => {
  const year = displayYear.value
  const month = displayMonth.value
  const firstDay = new Date(year, month - 1, 1)
  const startOffset = (firstDay.getDay() - props.firstDayOfWeek + 7) % 7
  const gridStart = new Date(year, month - 1, startOffset + 1).getTime()

  const result: CalendarDayItem[] = []
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart + i * 24 * 60 * 60 * 1000)
    const item: CalendarDayItem = {
      date: date.getTime(),
      text: date.getDate(),
      type: getDayType(date.getTime())
    }
    if (date.getMonth() + 1 !== month) {
      item.type = ''
    }
    result.push(props.formatter ? props.formatter(item) : item)
  }
  return result
})

/** 日期类型判定 */
function getDayType(time: number): CalendarDayType {
  const value = innerValue.value
  if (value === null || value === undefined) return ''

  if (isMultipleType.value && Array.isArray(value)) {
    return value.some((v) => isSameDay(v, time)) ? 'multiple-selected' : ''
  }

  if (isRangeType.value && Array.isArray(value)) {
    const [start, end] = value
    if (!start) return ''
    if (isSameDay(start, time) && (!end || props.allowSameDay)) return end ? 'start' : 'start'
    if (end && isSameDay(end, time)) return 'end'
    if (end && time > start && time < end) return 'middle'
    return ''
  }

  if (typeof value === 'number') {
    return isSameDay(value, time) ? 'selected' : ''
  }
  return ''
}

function isSameDay(a: number, b: number): boolean {
  const d1 = new Date(a)
  const d2 = new Date(b)
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

function isDisabled(time: number): boolean {
  return time < props.minDate || time > props.maxDate
}

/** 周序号（同周判定用） */
function isSameWeek(time: number, target: number): boolean {
  const d = new Date(time)
  const t = new Date(target)
  const weekStart = (d.getDay() - props.firstDayOfWeek + 7) % 7
  const targetWeekStart = (t.getDay() - props.firstDayOfWeek + 7) % 7
  return time - weekStart * 86400000 === target - targetWeekStart * 86400000
}

/** 点击日期 */
function onDayClick(item: CalendarDayItem) {
  if (item.disabled || isDisabled(item.date)) return
  const type = props.type as CalendarType
  const value = innerValue.value

  if (isRangeType.value) {
    const arr = Array.isArray(value) ? [...value] : []
    if (arr.length === 0 || arr.length === 2) {
      innerValue.value = [item.date, 0]
    } else {
      let start = arr[0]
      let end = item.date
      if (end < start) {
        ;[start, end] = [end, start]
      }
      if (props.maxRange && (end - start) / 86400000 + 1 > props.maxRange) {
        emit('change', { value: innerValue.value, error: 'max-range' })
        return
      }
      innerValue.value = [start, withDefaultTime(end)]
    }
  } else if (isMultipleType.value) {
    const arr = Array.isArray(value) ? [...value] : []
    const index = arr.findIndex((v) => isSameDay(v, item.date))
    if (index > -1) {
      arr.splice(index, 1)
    } else {
      arr.push(item.date)
    }
    innerValue.value = arr.sort((a, b) => a - b)
  } else if (type === 'week' || type === 'weekrange') {
    const weekStart = getWeekStart(item.date)
    if (type === 'week') {
      innerValue.value = weekStart
    } else {
      const arr = Array.isArray(value) ? [...value] : []
      if (arr.length === 0 || arr.length === 2) {
        innerValue.value = [weekStart, 0]
      } else {
        let start = arr[0]
        let end = weekStart
        if (end < start) [start, end] = [end, start]
        innerValue.value = [start, end]
      }
    }
  } else {
    innerValue.value = withDefaultTime(item.date)
  }

  emitChange()
}

function getWeekStart(time: number): number {
  const d = new Date(time)
  const offset = (d.getDay() - props.firstDayOfWeek + 7) % 7
  return time - offset * 86400000
}

/** datetime 类型补默认时分秒 */
function withDefaultTime(time: number): number {
  if (!hasTime.value) return time
  const d = new Date(time)
  d.setHours(props.defaultTime.hour || 0, props.defaultTime.minute || 0, props.defaultTime.second || 0, 0)
  return d.getTime()
}

function emitChange() {
  emit('update:modelValue', innerValue.value)
  emit('change', { value: innerValue.value })
}

/** 上/下月 */
function prevMonth() {
  if (displayMonth.value === 1) {
    displayMonth.value = 12
    displayYear.value -= 1
  } else {
    displayMonth.value -= 1
  }
}

function nextMonth() {
  if (displayMonth.value === 12) {
    displayMonth.value = 1
    displayYear.value += 1
  } else {
    displayMonth.value += 1
  }
}

const panelTitle = computed(() => `${displayYear.value}年${padZero(displayMonth.value)}月`)

/** 时间面板值（datetime 类型） */
const timeValue = computed(() => {
  const base = Array.isArray(innerValue.value) ? innerValue.value[0] : innerValue.value
  if (!base) return []
  const d = new Date(base)
  return [d.getHours(), d.getMinutes(), ...(props.hideSecond ? [] : [d.getSeconds()])]
})

function onTimeChange({ selectedValues }: any) {
  const base = Array.isArray(innerValue.value) ? innerValue.value[0] : innerValue.value
  if (!base) return
  const d = new Date(base)
  d.setHours(Number(selectedValues[0]), Number(selectedValues[1]), props.hideSecond ? 0 : Number(selectedValues[2] || 0), 0)
  const next = d.getTime()
  if (Array.isArray(innerValue.value)) {
    const arr = [...innerValue.value]
    arr[arr.length - 1] = next
    innerValue.value = arr
  } else {
    innerValue.value = next
  }
  emitChange()
}

function onPickStart() {
  emit('pickstart')
}

function onPickEnd() {
  emit('pickend')
}
</script>

<template>
  <view :class="`wd-calendar-view ${customClass}`" :style="customStyle">
    <!-- 周表头 -->
    <view class="wd-calendar-view__weeks">
      <text v-for="(week, index) in weeks" :key="index" class="wd-calendar-view__week">{{ week }}</text>
    </view>

    <!-- 月历网格 -->
    <view class="wd-calendar-view__grid">
      <view
        v-for="(item, index) in days"
        :key="index"
        :class="['wd-calendar-view__day', `is-${item.type || 'normal'}`, { 'is-disabled': item.disabled || isDisabled(item.date) }]"
        @tap="onDayClick(item)"
      >
        <text class="wd-calendar-view__day-text">{{ item.text }}</text>
        <text v-if="item.topInfo" class="wd-calendar-view__day-top">{{ item.topInfo }}</text>
        <text v-if="item.bottomInfo" class="wd-calendar-view__day-bottom">{{ item.bottomInfo }}</text>
      </view>
    </view>

    <!-- 面板标题 -->
    <view v-if="showPanelTitle" class="wd-calendar-view__panel-title">
      <view class="wd-calendar-view__panel-arrow" @tap="prevMonth"><text>&lt;</text></view>
      <text class="wd-calendar-view__panel-title-text">{{ panelTitle }}</text>
      <view class="wd-calendar-view__panel-arrow" @tap="nextMonth"><text>&gt;</text></view>
    </view>

    <!-- 时间面板（datetime 类型） -->
    <view v-if="hasTime" class="wd-calendar-view__time">
      <wd-picker-view
        :columns="[
          Array.from({ length: 24 }, (_, i) => ({ label: padZero(i), value: i })),
          Array.from({ length: 60 }, (_, i) => ({ label: padZero(i), value: i })),
          ...(hideSecond ? [] : [Array.from({ length: 60 }, (_, i) => ({ label: padZero(i), value: i }))])
        ]"
        :model-value="timeValue"
        :item-height="timeItemHeight"
        :visible-item-count="timeVisibleItemCount"
        @change="onTimeChange"
        @pickstart="onPickStart"
        @pickend="onPickEnd"
      />
    </view>
  </view>
</template>

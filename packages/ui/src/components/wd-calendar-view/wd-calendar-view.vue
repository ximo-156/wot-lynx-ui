/*
 * wd-calendar-view — 日历视图
 *
 * Lynx 实现说明：
 * - 整合式实现：周表头 + 月历网格（6×7）+ 时间面板（datetime 类型）
 *   合并在单一组件内，省去 wot-ui 的 year-panel/month-panel 多层嵌套；
 * - 支持 date / dates / datetime / week / daterange / datetimerange /
 *   weekrange 类型；范围选择带 maxRange 限制与 rangePrompt；
 * - formatter 钩子可改写每个日期格子的展示与禁用态；
 * - 网格用显式「行容器 × 7 列」结构而非 flex-wrap：Lynx 新 CSS 引擎下
 *   wrap 容器的 flex line 会被拉伸（行高从 52px 涨到 ~150px，真机可见），
 *   显式行 + 定高彻底规避（CONVENTICES §15）；
 * - 内联样式一律对象语法（CONVENTICES §19）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdPickerView from '../wd-picker-view/wd-picker-view.vue'
import { calendarViewProps, type CalendarDayItem, type CalendarDayType, type CalendarType } from './types'
import { isDef, padZero, parseStyle } from '../../common/util'
import { useTranslate } from '../../composables/useTranslate'

const { translate } = useTranslate('calendar-view')

const props = defineProps(calendarViewProps)
const emit = defineEmits(['change', 'update:modelValue', 'pickstart', 'pickend'])

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

/** 行高（显式行 + 内联定高，不依赖 flex-wrap，见文件头说明） */
const ROW_HEIGHT = 52

/** 当前展示的年月 */
const displayYear = ref<number>(0)
const displayMonth = ref<number>(0)

/** 内部选中值 */
const innerValue = ref<number | number[] | null>(null)

/**
 * 是否区间类型。
 * 注意：month / monthrange 的"按月粒度"选择尚未实现（wot-ui 有独立
 * month-panel），当前回落为按日粒度处理，见 onDayClick 分支注释。
 */
const isRangeType = computed(() => props.type === 'daterange' || props.type === 'datetimerange' || props.type === 'weekrange' || props.type === 'monthrange')
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
  // 网格起点 = 本月 1 号往回退 startOffset 天（如 10 月 1 日是周四、
  // firstDayOfWeek=0 时起点为 9 月 27 日周日）。曾误写成本月 1 号加上
  // startOffset，导致每月前 startOffset 天整体消失、整月偏移。
  const gridStart = new Date(year, month - 1, 1 - startOffset).getTime()

  const result: CalendarDayItem[] = []
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart + i * 24 * 60 * 60 * 1000)
    const item: CalendarDayItem = {
      date: date.getTime(),
      text: date.getDate(),
      type: getDayType(date.getTime())
    }
    result.push(props.formatter ? props.formatter(item) : item)
  }
  return result
})

/** 是否为本月之外的补位日（上月末 / 下月初）——模板据此加 is-adjacent 置灰 */
function isAdjacentMonth(item: CalendarDayItem): boolean {
  return new Date(item.date).getMonth() + 1 !== displayMonth.value
}

/** 网格按 7 列切分为显式行（不用 flex-wrap，见文件头说明） */
const dayRows = computed<CalendarDayItem[][]>(() => {
  const rows: CalendarDayItem[][] = []
  for (let i = 0; i < days.value.length; i += 7) {
    rows.push(days.value.slice(i, i + 7))
  }
  return rows
})

/** 今天判定（is-current 高亮用） */
function isToday(time: number): boolean {
  const d = new Date(time)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

/** 无选中态时回退：今天返回 'current' */
function fallbackCurrent(time: number): CalendarDayType {
  return isToday(time) ? 'current' : ''
}

/** 日期类型判定 */
function getDayType(time: number): CalendarDayType {
  const value = innerValue.value
  if (value === null || value === undefined) return fallbackCurrent(time)

  if (isMultipleType.value && Array.isArray(value)) {
    return value.some((v) => isSameDay(v, time)) ? 'multiple-selected' : fallbackCurrent(time)
  }

  if (isRangeType.value && Array.isArray(value)) {
    const [start, end] = value
    if (!start) return fallbackCurrent(time)
    if (isSameDay(start, time) && (!end || props.allowSameDay)) return 'start'
    if (end && isSameDay(end, time)) return 'end'
    if (end && time > start && time < end) return 'middle'
    return fallbackCurrent(time)
  }

  if (typeof value === 'number') {
    return isSameDay(value, time) ? 'selected' : fallbackCurrent(time)
  }
  return fallbackCurrent(time)
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
    // 区间选择状态机：innerValue 为 [start, 0] 表示"已选起点、未选终点"
    // （pending 哨兵），[start, end] 为已完成区间。
    // 判定必须是"尚未形成可完成区间才重新开始"——曾用 arr.length === 2
    // 判定，pending 的 [start, 0] 长度同样为 2，被误判为已完成区间，
    // 第二次点击永远重新开始，确认按钮永远置灰。
    // （month / monthrange 暂按日粒度回落，见 isRangeType 注释。）
    const arr = Array.isArray(value) ? [...value] : []
    if (arr.length === 0 || !isDef(arr[1])) {
      innerValue.value = [item.date, 0]
    } else {
      let start = arr[0]
      let end = item.date
      if (end < start) {
        ;[start, end] = [end, start]
      }
      if (props.maxRange && (end - start) / 86400000 + 1 > props.maxRange) {
        // 超出最大可选天数：只重置为新的起点并提示，不发出半截区间
        //（change 只发完整值；pending 状态经 update:modelValue 同步视图）
        console.warn(translate('rangePrompt', props.maxRange))
        innerValue.value = [item.date, 0]
        emit('update:modelValue', innerValue.value)
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
      // weekrange 与 daterange 同一套状态机（pending 哨兵 [start, 0]），
      // 判定同步修正：只有未形成可完成区间时才重新开始。
      const arr = Array.isArray(value) ? [...value] : []
      if (arr.length === 0 || !isDef(arr[1])) {
        innerValue.value = [weekStart, 0]
      } else {
        let start = arr[0]
        let end = weekStart
        if (end < start) [start, end] = [end, start]
        if (props.maxRange && (end - start) / 86400000 / 7 + 1 > props.maxRange) {
          // 超出最大可选周数：只重置为新的起点并提示，不发出半截区间
          console.warn(translate('rangePromptWeek', props.maxRange))
          innerValue.value = [weekStart, 0]
          emit('update:modelValue', innerValue.value)
          return
        }
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
  <view :class="`wd-calendar-view ${customClass}`" :style="parseStyle(customStyle)">
    <!-- 周表头 -->
    <view class="wd-calendar-view__weeks">
      <text v-for="(week, index) in weeks" :key="index" class="wd-calendar-view__week">{{ week }}</text>
    </view>

    <!-- 月历网格：显式行结构（row > day × 7），不依赖 flex-wrap；
         行高内联定高（对象语法，CONVENTIONS §19） -->
    <view class="wd-calendar-view__grid">
      <view
        v-for="(row, rowIndex) in dayRows"
        :key="rowIndex"
        class="wd-calendar-view__row"
        :style="{ height: `${ROW_HEIGHT}px` }"
      >
        <view
          v-for="(item, colIndex) in row"
          :key="colIndex"
          :class="[
            'wd-calendar-view__day',
            item.type ? `is-${item.type}` : '',
            { 'is-adjacent': isAdjacentMonth(item), 'is-disabled': item.disabled || isDisabled(item.date) }
          ]"
          @tap="onDayClick(item)"
        >
          <text class="wd-calendar-view__day-text">{{ item.text }}</text>
          <text v-if="item.topInfo" class="wd-calendar-view__day-top">{{ item.topInfo }}</text>
          <text v-if="item.bottomInfo" class="wd-calendar-view__day-bottom">{{ item.bottomInfo }}</text>
        </view>
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

/*
 * wd-datetime-picker-view — 日期时间选择器视图
 *
 * Lynx 实现说明：
 * - 基于 wd-picker-view（自研滚动选择器），列数据由当前值 + 边界
 *   （minDate/maxDate/minHour...）动态计算；
 * - 边界收缩：当选中的年/月/日/时/分到达边界时，后续列范围随之收紧；
 * - formatter / filter / columnFormatter 三个自定义钩子与 wot-ui 一致。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onBeforeMount, ref, watch } from 'vue-lynx'
import WdPickerView from '../wd-picker-view/wd-picker-view.vue'
import { isArray, isDef, isString, padZero, range } from '../../common/util'
import { datetimePickerViewProps, type DatetimePickerViewColumnType, type DatetimePickerViewExpose } from './types'
import type { PickerViewExpose } from '../wd-picker-view/types'
import { getPickerValue } from './util'
import type { Numeric } from '../../common/props'

const isValidDate = (date: string | number | Date) => isDef(date) && !Number.isNaN(date)

const times = (n: number, iteratee: (index: number) => number): number[] => {
  let index = -1
  const length = n < 0 ? 0 : n
  const result: number[] = Array(length)
  while (++index < n) {
    result[index] = iteratee(index)
  }
  return result
}

const getMonthEndDay = (year: number, month: number) => {
  return 32 - new Date(year, month - 1, 32).getDate()
}

const props = defineProps(datetimePickerViewProps)
const emit = defineEmits(['change', 'pickstart', 'pickend', 'update:modelValue'])

const datePickerview = ref<PickerViewExpose>()
const innerValue = ref<string | number | null>(null)
const pickerValue = ref<Array<Numeric>>([])

/** 列数据：依赖 innerValue */
const columns = computed(() => {
  const { formatter, columnFormatter } = props
  // 原始列（type/values 形式）先过 columnFormatter，再映射为 label/value 形式
  let rawColumns = getOriginColumns()
  if (columnFormatter) {
    rawColumns = columnFormatter(rawColumns)
  }
  return rawColumns.map((column) => {
    return column.values.map((value) => {
      return {
        label: formatter ? formatter(column.type, padZero(value)) : padZero(value),
        value
      }
    })
  })
})

watch(
  () => props.modelValue,
  (val) => {
    const value = correctValue(val)
    if (value === innerValue.value) return
    updateColumnValue(value)
  },
  { deep: true, immediate: true }
)

watch(
  () => props.type,
  (target) => {
    const type = ['date', 'year-month', 'time', 'datetime', 'year']
    if (type.indexOf(target) === -1) {
      console.error(`type must be one of ${type}`)
    }
  },
  { deep: true, immediate: true }
)

onBeforeMount(() => {
  const inner = correctValue(props.modelValue)
  updateColumnValue(inner)
})

function onChange({ selectedValues }: { selectedValues: Array<string | number> }) {
  pickerValue.value = selectedValues
  const result = updateInnerValue(selectedValues)
  updateColumnValue(result)
}

function getOriginColumns() {
  const { filter } = props
  return getRanges().map(({ type, range: r }) => {
    let values = times(r[1] - r[0] + 1, (index: number) => r[0] + index)
    if (filter) {
      values = filter({ type, values })
    }
    return { type, values }
  })
}

function getRanges(): Array<{ type: DatetimePickerViewColumnType; range: number[] }> {
  if (props.type === 'time') {
    const result: Array<{ type: DatetimePickerViewColumnType; range: number[] }> = [
      { type: 'hour', range: [props.minHour, props.maxHour] },
      { type: 'minute', range: [props.minMinute, props.maxMinute] }
    ]
    if (props.useSecond) {
      result.push({ type: 'second', range: [props.minSecond, props.maxSecond] })
    }
    return result
  }

  const value = new Date((innerValue.value as number) || Date.now())
  const maxBoundary = new Date(props.maxDate)
  const minBoundary = new Date(props.minDate)

  const maxYear = maxBoundary.getFullYear()
  const maxMonth = maxBoundary.getMonth() + 1
  const maxDate = maxBoundary.getDate()
  const maxHour = maxBoundary.getHours()
  const maxMinute = maxBoundary.getMinutes()
  const maxSecond = maxBoundary.getSeconds()

  const minYear = minBoundary.getFullYear()
  const minMonth = minBoundary.getMonth() + 1
  const minDate = minBoundary.getDate()
  const minHour = minBoundary.getHours()
  const minMinute = minBoundary.getMinutes()
  const minSecond = minBoundary.getSeconds()

  const result: Array<{ type: DatetimePickerViewColumnType; range: number[] }> = [
    { type: 'year', range: [minYear, maxYear] },
    { type: 'month', range: [1, 12] }
  ]

  if (props.type === 'year') {
    return result.slice(0, 1)
  }

  result.push({ type: 'date', range: [1, getMonthEndDay(value.getFullYear(), value.getMonth() + 1)] })

  if (props.type === 'date') {
    return result
  }

  result.push({ type: 'hour', range: [0, 23] })
  result.push({ type: 'minute', range: [0, 59] })
  if (props.useSecond) {
    result.push({ type: 'second', range: [0, 59] })
  }
  return result
}

function updateColumnValue(value: string | number) {
  const values = getPickerValue(value, props.type, props.useSecond)
  if (props.modelValue !== value) {
    emit('update:modelValue', value)
    emit('change', {
      value,
      columns: getOriginColumns()
    })
  }
  innerValue.value = value
  pickerValue.value = values
}

function updateInnerValue(indexes: Array<string | number>): string | number {
  const { type, useSecond } = props
  let result: string | number = ''
  const values = indexes

  if (type === 'time') {
    if (useSecond) {
      result = `${padZero(values[0])}:${padZero(values[1])}:${padZero(values[2])}`
    } else {
      result = `${padZero(values[0])}:${padZero(values[1])}`
    }
    return result
  }

  const year = values[0] && parseInt(String(values[0]))
  const month = type === 'year' ? 1 : values[1] && parseInt(String(values[1]))
  const maxDate = getMonthEndDay(Number(year), Number(month))

  let date: string | number = 1
  if (type !== 'year-month' && type !== 'year') {
    date = Number(values[2]) && parseInt(String(values[2])) > maxDate ? maxDate : values[2] && parseInt(String(values[2]))
  }

  let hour = 0
  let minute = 0
  let second = 0
  if (type === 'datetime') {
    hour = Number(values[3]) && parseInt(String(values[3]))
    minute = Number(values[4]) && parseInt(String(values[4]))
    if (useSecond) {
      second = Number(values[5]) && parseInt(String(values[5]))
    }
  }
  const value = new Date(Number(year), Number(month) - 1, Number(date), hour, minute, second).getTime()
  result = correctValue(value)
  return result
}

function correctValue(value: string | number | Date): string | number {
  const isDateType = props.type !== 'time'
  if (isDateType && !isValidDate(value)) {
    value = props.minDate
  } else if (!isDateType && !value) {
    value = props.useSecond ? `${padZero(props.minHour)}:00:00` : `${padZero(props.minHour)}:00`
  }

  if (!isDateType) {
    let [hour, minute, second = '00'] = (isString(value) ? value : value.toString()).split(':')
    hour = padZero(range(Number(hour), props.minHour, props.maxHour))
    minute = padZero(range(Number(minute), props.minMinute, props.maxMinute))
    second = padZero(range(Number(second), props.minSecond, props.maxSecond))
    return props.useSecond ? `${hour}:${minute}:${second}` : `${hour}:${minute}`
  }

  if (isDateType) {
    const date = new Date(value)
    const max = new Date(props.maxDate)
    const min = new Date(props.minDate)
    if (date.getTime() > max.getTime()) return props.maxDate
    if (date.getTime() < min.getTime()) return props.minDate
  }
  return value as string | number
}

function onPickStart() {
  emit('pickstart')
}

function onPickEnd() {
  emit('pickend')
}

function getSelectedOptions(): any[] {
  return datePickerview.value?.getSelectedOptions() || []
}

defineExpose<DatetimePickerViewExpose>({
  getSelectedOptions
})
</script>

<template>
  <wd-picker-view
    ref="datePickerview"
    :custom-class="customClass"
    :custom-style="customStyle"
    :immediate-change="immediateChange"
    v-model="pickerValue"
    :columns="columns"
    :item-height="itemHeight"
    :visible-item-count="visibleItemCount"
    :value-key="valueKey"
    :label-key="labelKey"
    @change="onChange"
    @pickstart="onPickStart"
    @pickend="onPickEnd"
  />
</template>

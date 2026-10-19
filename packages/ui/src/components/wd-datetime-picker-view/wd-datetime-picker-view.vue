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
  // 先映射为 label/value 列，再交给 columnFormatter——与 wot-ui 一致：
  // columnFormatter 收到的是映射后的列数组（PickerOption[][]），
  // 而非原始 {type, values} 形式（此前传原始列，钩子拿不到 label）。
  const mappedColumns = getOriginColumns().map((column) => {
    return column.values.map((value) => {
      return {
        label: formatter ? formatter(column.type, padZero(value)) : padZero(value),
        value
      }
    })
  })
  return columnFormatter ? columnFormatter(mappedColumns) : mappedColumns
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

/**
 * 根据 getBoundary 得到的范围计算所有的列的数据（对齐 wot-ui 2.3.2）：
 * 当选中的年/月/日/时/分到达 min/max 边界时，后续列范围随之收紧。
 */
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

  const { maxYear, maxDate, maxMonth, maxHour, maxMinute, maxSecond } = getBoundary('max', innerValue.value as number)
  const { minYear, minDate, minMonth, minHour, minMinute, minSecond } = getBoundary('min', innerValue.value as number)

  const result: Array<{ type: DatetimePickerViewColumnType; range: number[] }> = [
    { type: 'year', range: [minYear, maxYear] },
    { type: 'month', range: [minMonth, maxMonth] },
    { type: 'date', range: [minDate, maxDate] },
    { type: 'hour', range: [minHour, maxHour] },
    { type: 'minute', range: [minMinute, maxMinute] }
  ]

  if (props.type === 'datetime' && props.useSecond) {
    result.push({ type: 'second', range: [minSecond, maxSecond] })
  }

  if (props.type === 'date') result.splice(3, 2)
  if (props.type === 'year-month') result.splice(2, 3)
  if (props.type === 'year') result.splice(1, 4)
  return result
}

/**
 * 根据时间戳，计算所有选项的边界范围（对齐 wot-ui 2.3.2 getBoundary）。
 * @param {'min' | 'max'} type 类型
 * @param {number} innerValue 时间戳
 */
function getBoundary(type: 'min' | 'max', innerValue: number) {
  const value = new Date(innerValue)
  const boundary = new Date(props[`${type}Date`])
  const year = boundary.getFullYear()
  let month: number = 1
  let date: number = 1
  let hour: number = 0
  let minute: number = 0
  let second: number = 0

  if (type === 'max') {
    month = 12
    date = getMonthEndDay(value.getFullYear(), value.getMonth() + 1)
    hour = 23
    minute = 59
    second = 59
  }

  if (value.getFullYear() === year) {
    month = boundary.getMonth() + 1
    if (value.getMonth() + 1 === month) {
      date = boundary.getDate()
      if (value.getDate() === date) {
        hour = boundary.getHours()
        if (value.getHours() === hour) {
          minute = boundary.getMinutes()
          if (value.getMinutes() === minute) {
            second = boundary.getSeconds()
          }
        }
      }
    }
  }
  return {
    [`${type}Year`]: year,
    [`${type}Month`]: month,
    [`${type}Date`]: date,
    [`${type}Hour`]: hour,
    [`${type}Minute`]: minute,
    [`${type}Second`]: second
  }
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
    // 是Date类型，但入参不可用，使用最小时间戳代替
    value = props.minDate
  } else if (!isDateType && !value) {
    // 非Date类型，无入参，使用最小小时代替
    value = props.useSecond ? `${padZero(props.minHour)}:00:00` : `${padZero(props.minHour)}:00`
  }

  // 当type为time时
  if (!isDateType) {
    // 非Date类型，直接走此逻辑
    let [hour, minute, second = '00'] = (isString(value) ? value : value.toString()).split(':')
    hour = padZero(range(Number(hour), props.minHour, props.maxHour))
    minute = padZero(range(Number(minute), props.minMinute, props.maxMinute))
    second = padZero(range(Number(second), props.minSecond, props.maxSecond))
    return props.useSecond ? `${hour}:${minute}:${second}` : `${hour}:${minute}`
  }

  // date type：钳制到 [minDate, maxDate]。
  //
  // 不能用 isValidDate + new Date(value) 的组合：Number.isNaN(字符串) 恒为
  // false，isValidDate 会放过数字字符串（types.ts 允许 [String, Number]），
  // 而 new Date("1700000000000") 是 Invalid Date，year 取到 NaN 后
  // times(NaN) 的 Array(NaN) 直接抛 RangeError: Invalid array length
  // （挂载即崩）。
  //
  // 也不能像参考实现那样直接 Number(value)：日期字符串（"2024-01-01"）会被
  // Number() 归一为 NaN 而丢失。这里先按 Date 解析（覆盖时间戳 / 日期字符串
  // / Date 实例），解析失败再按数值兜底（覆盖数字字符串），都失败回落 minDate。
  const parsed = new Date(value as any)
  let timestamp = parsed.getTime()
  if (Number.isNaN(timestamp)) {
    timestamp = Number(value)
    if (Number.isNaN(timestamp)) {
      return props.minDate
    }
  }
  return Math.min(Math.max(timestamp, props.minDate), props.maxDate)
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

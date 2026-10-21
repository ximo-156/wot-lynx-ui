/*
 * wd-datetime-picker — 日期时间选择器
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2）：
 * - 结构：wd-popup（bottom）+ toolbar + 两个 wd-datetime-picker-view（start/end），
 *   经 __show/__hidden 切换可见性（与 wot-ui 一致）；
 * - 区间模式（modelValue 为数组）展示 start/end tab，两端经 columnFormatter
 *   （isOutOfBoundary）做跨边界禁用，保证 start <= end；
 * - 事件：@click→@tap；裸文本包 text 元素；customStyle 经 parseStyle 归一为对象
 *   （CONVENTIONS §19）；标题容器的 @touchmove="noop" 按 §14 省略（锁滚走
 *   overlay/transition 的 disable-touch-move 链路）；
 * - 滑动未结束点确认时挂起，pickend 后自动确认（含 beforeConfirm 拦截）；
 * - beforeConfirm 可返回未决 Promise：done 落地时经 useAlive 守卫，避免在已销毁
 *   树上写 ref（真机 9902 晚到 patch 家族）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, onMounted, ref, watch } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdDatetimePickerView from '../wd-datetime-picker-view/wd-datetime-picker-view.vue'
import { deepClone, isArray, isDef, isEqual, padZero, parseStyle } from '../../common/util'
import { callInterceptor } from '../../common/interceptor'
import { useAlive } from '../../composables/useAlive'
import type { DatetimePickerViewColumn, DatetimePickerViewColumnType, DatetimePickerViewOption } from '../wd-datetime-picker-view/types'
import { useTranslate } from '../../composables/useTranslate'
import { datetimePickerProps, type DatetimePickerExpose } from './types'
import { formatDate } from '../../common/formatDate'
import { getPickerValue } from '../wd-datetime-picker-view/util'

const { translate } = useTranslate('datetimePicker')

const props = defineProps(datetimePickerProps)
const isAlive = useAlive()
const emit = defineEmits(['change', 'open', 'toggle', 'cancel', 'confirm', 'update:modelValue', 'update:visible'])

const popupShow = ref<boolean>(false)
const showStart = ref<boolean>(true)
const region = ref<boolean>(false)
const innerValue = ref<string | number>('')
const endInnerValue = ref<string | number>('')

const showTabLabel = computed(() => {
  if (region.value) {
    const items = (innerValue.value && getPickerSelectedItems('before')) || []
    const endItems = (endInnerValue.value && getPickerSelectedItems('after')) || []
    return [defaultDisplayFormat(items as Record<string, any>[], true), defaultDisplayFormat(endItems as Record<string, any>[], true)]
  }
  return []
})

const isPicking = ref<boolean>(false) // 判断pickview是否还在滑动中
const hasConfirmed = ref<boolean>(false) // 判断用户是否点击了确认按钮
let confirmRequest = 0
watch([() => props.modelValue, () => props.type, () => props.useSecond, () => props.minDate, () => props.maxDate, () => props.minHour, () => props.maxHour, () => props.minMinute, () => props.maxMinute, () => props.minSecond, () => props.maxSecond, () => props.filter, () => props.formatter, () => props.valueKey, () => props.labelKey], () => { confirmRequest++ }, { deep: true, flush: 'sync' })

function resetPendingConfirm() {
  confirmRequest++
  hasConfirmed.value = false
  isPicking.value = false
}

watch(
  () => props.modelValue,
  (val, oldVal) => {
    if (isEqual(val, oldVal)) return
    resetInnerValue()
  },
  { deep: true, immediate: true }
)

watch(
  () => props.visible,
  (val) => {
    if (val) {
      showPopup()
    } else {
      resetPendingConfirm()
      popupShow.value = false
    }
  }
)

watch(popupShow, (val) => {
  emit('update:visible', val)
})

function resetInnerValue() {
  const { modelValue } = props
  if (isArray(modelValue)) {
    region.value = true
    innerValue.value = deepClone(getDefaultInnerValue(true))
    endInnerValue.value = deepClone(getDefaultInnerValue(true, true))
  } else {
    region.value = false
    showStart.value = true
    // 每次value更新时都需要刷新整个列表
    innerValue.value = deepClone(getDefaultInnerValue())
  }
}

/**
 * 处理时间边界值判断：当前列之前的所有列都在边界上时，start 不能超过 / end 不能低于边界值。
 */
function isOutOfBoundary(isStart: boolean, columnType: DatetimePickerViewColumnType, value: number, currentArray: number[], boundary: number[]): boolean {
  const { type, useSecond } = props

  // 定义各类型的列顺序
  const typeColumns: Record<string, DatetimePickerViewColumnType[]> = {
    datetime: useSecond ? ['year', 'month', 'date', 'hour', 'minute', 'second'] : ['year', 'month', 'date', 'hour', 'minute'],
    'year-month': ['year', 'month'],
    year: ['year'],
    date: ['year', 'month', 'date'],
    time: useSecond ? ['hour', 'minute', 'second'] : ['hour', 'minute']
  }

  const columns = typeColumns[type]
  const columnIndex = columns.indexOf(columnType)

  // 如果当前列不在类型定义中，直接返回 false
  if (columnIndex === -1) return false

  // 检查当前列之前的所有列是否都在边界上
  const isPreColumnsBoundary = columns.slice(0, columnIndex).every((col, index) => {
    return currentArray[index] === boundary[index]
  })

  if (isPreColumnsBoundary) {
    const boundaryValue = boundary[columnIndex]
    return isStart ? value > boundaryValue : value < boundaryValue
  }

  return false
}

/** 开始时间列格式化 */
function startColumnFormatter(columns: DatetimePickerViewOption[][]) {
  return customColumnFormatter(columns, 'start')
}

/** 结束时间列格式化 */
function endColumnFormatter(columns: DatetimePickerViewOption[][]) {
  return customColumnFormatter(columns, 'end')
}

/** 自定义列项筛选规则：区间模式下对超出对端边界的选项置 disabled */
const customColumnFormatter = (columns: DatetimePickerViewOption[][], pickerType: 'start' | 'end') => {
  const { type } = props
  const startSymbol = pickerType === 'start'

  const start = innerValue.value
  const end = endInnerValue.value

  const currentValue = startSymbol ? getPickerValue(start, type, props.useSecond) : getPickerValue(end, type, props.useSecond)
  const boundary = startSymbol ? getPickerValue(end, type, props.useSecond) : getPickerValue(start, type, props.useSecond)

  const typeColumns: Record<string, DatetimePickerViewColumnType[]> = {
    datetime: props.useSecond ? ['year', 'month', 'date', 'hour', 'minute', 'second'] : ['year', 'month', 'date', 'hour', 'minute'],
    'year-month': ['year', 'month'],
    year: ['year'],
    date: ['year', 'month', 'date'],
    time: props.useSecond ? ['hour', 'minute', 'second'] : ['hour', 'minute']
  }
  const currentColumnTypes = typeColumns[type]

  return columns.map((column, index) => {
    const columnType = currentColumnTypes[index]
    return column.map((option) => {
      const disabled = isOutOfBoundary(startSymbol, columnType, option.value, currentValue, boundary)
      return {
        ...option,
        disabled
      }
    })
  })
}

onMounted(() => {
  if (props.visible) {
    showPopup()
  }
})

/** 根据传入的 picker 获取当前 cell 展示值（选中项 {label,value} 数组） */
function getPickerSelectedItems(picker: 'before' | 'after') {
  let value = picker === 'before' ? innerValue.value : endInnerValue.value
  let selected: number[] = []
  if (value) {
    selected = getPickerValue(value, props.type, props.useSecond)
  }

  const typeColumns: Record<string, DatetimePickerViewColumnType[]> = {
    datetime: props.useSecond ? ['year', 'month', 'date', 'hour', 'minute', 'second'] : ['year', 'month', 'date', 'hour', 'minute'],
    'year-month': ['year', 'month'],
    year: ['year'],
    date: ['year', 'month', 'date'],
    time: props.useSecond ? ['hour', 'minute', 'second'] : ['hour', 'minute']
  }
  const currentColumnTypes = typeColumns[props.type]

  return selected.map((value, index) => {
    const type = currentColumnTypes[index]
    return {
      [props.labelKey]: props.formatter ? props.formatter(type, padZero(value)) : padZero(value),
      [props.valueKey]: value
    }
  })
}

/** 获取默认内部值 */
function getDefaultInnerValue(isRegion?: boolean, isEnd?: boolean): string | number {
  const { modelValue: value, maxDate, minDate, type } = props
  if (isRegion) {
    const index = isEnd ? 1 : 0
    const targetValue = isArray(value) ? (value[index] as string) : ''
    const maxValue = type === 'time' ? formatDate(maxDate, 'HH:mm') : maxDate
    const minValue = type === 'time' ? formatDate(minDate, 'HH:mm') : minDate
    return targetValue || (isEnd ? maxValue : minValue)
  } else {
    return isDef(value) ? (value as string) : ''
  }
}

/** 对外暴露接口，打开弹框 */
function open() {
  showPopup()
}

/** 对外暴露接口，关闭弹框 */
function close() {
  onCancel()
}

/** 显示弹窗 */
function showPopup() {
  if (popupShow.value) return
  resetPendingConfirm()
  emit('open')
  resetInnerValue()
  popupShow.value = true
  showStart.value = true
}

/** 区域选择时 tab 标签切换 */
function onTabChange(tab: 'start' | 'end') {
  const isStart = tab === 'start'
  if (showStart.value === isStart) return
  showStart.value = isStart
  emit('toggle', showStart.value ? innerValue.value : endInnerValue.value)
}

/** 开始时间 datetimePickerView change 事件 */
function onChangeStart({ value, columns }: { value: number | string; columns: DatetimePickerViewColumn[] }) {
  if (!isAlive()) return
  confirmRequest++
  if (region.value) {
    const currentArray = getPickerValue(value, props.type, props.useSecond)
    const boundaryArray = getPickerValue(endInnerValue.value, props.type, props.useSecond)

    const needsAdjust = columns.some((column, index) => {
      return isOutOfBoundary(true, column.type, currentArray[index], currentArray, boundaryArray)
    })

    innerValue.value = deepClone(needsAdjust ? endInnerValue.value : value)

    nextTick(() => {
      if (!isAlive()) return
      emit('change', {
        value: [innerValue.value, endInnerValue.value]
      })
    })
  } else {
    // 非区间选择直接设置值即可
    innerValue.value = deepClone(value)
    emit('change', {
      value: innerValue.value
    })
  }
}

/** 结束时间 datetimePickerView change 事件 */
function onChangeEnd({ value, columns }: { value: number | string; columns: DatetimePickerViewColumn[] }) {
  if (!isAlive()) return
  confirmRequest++
  const currentArray = getPickerValue(value, props.type, props.useSecond)
  const boundaryArray = getPickerValue(innerValue.value, props.type, props.useSecond)

  const needsAdjust = columns.some((column, index) => {
    return isOutOfBoundary(false, column.type, currentArray[index], currentArray, boundaryArray)
  })

  endInnerValue.value = deepClone(needsAdjust ? innerValue.value : value)

  nextTick(() => {
    if (!isAlive()) return
    emit('change', {
      value: [innerValue.value, endInnerValue.value]
    })
  })
}

/** 点击取消按钮触发。关闭popup，触发cancel事件。 */
function onCancel() {
  resetPendingConfirm()
  popupShow.value = false
  emit('cancel')
}

/** 点击确定按钮触发 */
function onConfirm() {
  if (!popupShow.value) return
  // 如果当前还在滑动且未停止下来，则锁住先不确认，等滑完再自动确认
  if (isPicking.value) {
    hasConfirmed.value = true
    return
  }

  const { beforeConfirm } = props
  const request = ++confirmRequest
  callInterceptor(beforeConfirm, {
    args: [region.value ? [innerValue.value, endInnerValue.value] : innerValue.value],
    done: () => {
      // beforeConfirm 可返回未决 Promise：done 落地时组件可能已卸载
      if (!isAlive() || request !== confirmRequest || !popupShow.value) return
      handleConfirm()
    }
  })
}

function onPickStart() {
  if (!popupShow.value) return
  confirmRequest++
  isPicking.value = true
}

function onPickEnd() {
  isPicking.value = false

  // 延迟一会，因为组件层级嵌套过多，日期的计算时间也较长
  const request = confirmRequest
  setTimeout(() => {
    if (!isAlive() || request !== confirmRequest || !popupShow.value) return
    if (hasConfirmed.value) {
      hasConfirmed.value = false
      onConfirm()
    }
  }, 50)
}

function handleConfirm() {
  resetPendingConfirm()
  const value = region.value ? [innerValue.value, endInnerValue.value] : innerValue.value
  popupShow.value = false
  emit('update:modelValue', value)
  emit('confirm', {
    value
  })
}

/** 设置展示值 / tab 标签 */
function defaultDisplayFormat(items: Record<string, any>[], tabLabel: boolean = false) {
  if (items.length === 0) return ''

  if (tabLabel && props.displayFormatTabLabel) {
    return props.displayFormatTabLabel(items)
  }

  switch (props.type) {
    case 'year':
      return items[0][props.labelKey]
    case 'date':
      return `${items[0][props.labelKey]}-${items[1][props.labelKey]}-${items[2][props.labelKey]}`
    case 'year-month':
      return `${items[0][props.labelKey]}-${items[1][props.labelKey]}`
    case 'time':
      return props.useSecond ? `${items[0][props.labelKey]}:${items[1][props.labelKey]}:${items[2][props.labelKey]}` : `${items[0][props.labelKey]}:${items[1][props.labelKey]}`
    case 'datetime':
      return props.useSecond
        ? `${items[0][props.labelKey]}-${items[1][props.labelKey]}-${items[2][props.labelKey]} ${items[3][props.labelKey]}:${items[4][props.labelKey]}:${items[5][props.labelKey]}`
        : `${items[0][props.labelKey]}-${items[1][props.labelKey]}-${items[2][props.labelKey]} ${items[3][props.labelKey]}:${items[4][props.labelKey]}`
  }
}

defineExpose<DatetimePickerExpose>({
  open,
  close
})
</script>

<template>
  <view :class="`wd-datetime-picker ${customClass}`" :style="parseStyle(customStyle)">
    <WdPopup
      v-model="popupShow"
      position="bottom"
      :hide-when-close="false"
      :close-on-click-modal="closeOnClickModal"
      :safe-area-inset-bottom="safeAreaInsetBottom"
      :z-index="zIndex"
      :root-portal="rootPortal"
      custom-class="wd-datetime-picker__popup"
      @close="onCancel"
    >
      <view class="wd-datetime-picker__wraper">
        <view class="wd-datetime-picker__title">
          <view class="wd-datetime-picker__action" @tap="onCancel">
            <text>{{ cancelButtonText || translate('cancel') }}</text>
          </view>
          <view v-if="title" class="wd-datetime-picker__title-text">
            <text>{{ title }}</text>
          </view>
          <view class="wd-datetime-picker__action" @tap="onConfirm">
            <text>{{ confirmButtonText || translate('confirm') }}</text>
          </view>
        </view>
        <view v-if="region" class="wd-datetime-picker__range">
          <view :class="`wd-datetime-picker__range-item ${showStart ? 'is-active' : ''}`" @tap="onTabChange('start')">
            <text>{{ showTabLabel[0] || translate('start') }}</text>
          </view>
          <view class="wd-datetime-picker__range-separator" />
          <view :class="`wd-datetime-picker__range-item ${!showStart ? 'is-active' : ''}`" @tap="onTabChange('end')">
            <text>{{ showTabLabel[1] || translate('end') }}</text>
          </view>
        </view>
        <view :class="showStart ? 'wd-datetime-picker__show' : 'wd-datetime-picker__hidden'">
          <WdDatetimePickerView
            :custom-class="customViewClass"
            :type="type"
            v-model="innerValue"
            :item-height="itemHeight"
            :visible-item-count="visibleItemCount"
            :value-key="valueKey"
            :label-key="labelKey"
            :formatter="formatter"
            :filter="filter"
            :column-formatter="isArray(modelValue) ? startColumnFormatter : undefined"
            :max-hour="maxHour"
            :min-hour="minHour"
            :max-date="maxDate"
            :min-date="minDate"
            :max-minute="maxMinute"
            :min-minute="minMinute"
            :use-second="useSecond"
            :min-second="minSecond"
            :max-second="maxSecond"
            :immediate-change="immediateChange"
            @change="onChangeStart"
            @pickstart="onPickStart"
            @pickend="onPickEnd"
          />
        </view>
        <view :class="showStart ? 'wd-datetime-picker__hidden' : 'wd-datetime-picker__show'">
          <WdDatetimePickerView
            :custom-class="customViewClass"
            :type="type"
            v-model="endInnerValue"
            :item-height="itemHeight"
            :visible-item-count="visibleItemCount"
            :value-key="valueKey"
            :label-key="labelKey"
            :formatter="formatter"
            :filter="filter"
            :column-formatter="isArray(modelValue) ? endColumnFormatter : undefined"
            :max-hour="maxHour"
            :min-hour="minHour"
            :max-date="maxDate"
            :min-date="minDate"
            :max-minute="maxMinute"
            :min-minute="minMinute"
            :use-second="useSecond"
            :min-second="minSecond"
            :max-second="maxSecond"
            :immediate-change="immediateChange"
            @change="onChangeEnd"
            @pickstart="onPickStart"
            @pickend="onPickEnd"
          />
        </view>
      </view>
    </WdPopup>
  </view>
</template>

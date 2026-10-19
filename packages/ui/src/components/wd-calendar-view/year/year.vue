/*
 * wd-year — 日历面板的年份网格（wd-calendar-view 子组件）
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - @click → @tap（CONVENTIONS §6）；文本一律包在 text 元素中；
 * - wot-ui 的范围态背景用 ::after 伪元素绘制（起点的右半格、终点的左半格），
 *   Lynx 无伪元素，改为模板中的真实元素 wd-year__month-range（排在内容节点
 *   之后、z-index 低于内容，两个平台都不遮字）；
 * - __month-top / __month-bottom 为绝对定位 + flex 居中的文本容器，用
 *   「view + 内部 text」承载（Lynx 的 text 不保证按 flex 容器布局）；
 * - 布局居中（NATIVE-REWRITE §3）：wd-year 根节点显式 display: flex +
 *   flex-direction: column；__month 补 justify-content + align-items
 *   成对 flex 居中（原 margin: 0 auto 单独不保证生效），__month-container
 *   同样补成对 flex 居中承载月份文本。
 */
<script lang="ts" setup>
import './index.css'

import WdToast from '../../wd-toast/wd-toast.vue'
import { computed, ref, watch } from 'vue-lynx'
import { deepClone, isArray, isFunction } from '../../../common/util'
import { compareMonth, formatYearTitle, getDateByDefaultTime, getItemClass, getMonthByOffset, getMonthOffset } from '../utils'
import { useToast } from '../../wd-toast'
import { useTranslate } from '../../../composables/useTranslate'
import { formatDate } from '../../../common/formatDate'
import { yearProps } from './types'
import type { CalendarDayItem, CalendarDayType } from '../types'

const props = defineProps(yearProps)
const emit = defineEmits(['change'])

const toast = useToast('wd-year')
const { translate } = useTranslate('calendar-view')

const months = ref<CalendarDayItem[]>([])

const monthTypeClass = computed(() => {
  return (monthType: CalendarDayType) => {
    return getItemClass(monthType, props.value, props.type)
  }
})

const yearTitle = computed(() => {
  return (date: number) => {
    return formatYearTitle(date)
  }
})

watch(
  [() => props.type, () => props.date, () => props.value, () => props.minDate, () => props.maxDate, () => props.formatter],
  () => {
    setMonths()
  },
  {
    deep: true,
    immediate: true
  }
)

function getMonthLabel(date: number) {
  return formatDate(date, translate('month', date))
}

function setMonths() {
  const monthList: CalendarDayItem[] = []
  const date = new Date(props.date)
  const year = date.getFullYear()
  const value = props.value

  if (props.type.indexOf('range') > -1 && value && !isArray(value)) {
    console.error('[wot-design] value should be array when type is range')
    return
  }

  for (let month = 0; month < 12; month++) {
    const date = new Date(year, month, 1).getTime()
    let type: CalendarDayType = getMonthType(date)
    if (!type && compareMonth(date, Date.now()) === 0) {
      type = 'current'
    }
    const monthObj = getFormatterDate(date, month, type)
    monthList.push(monthObj)
  }

  months.value = deepClone(monthList)
}
function getMonthType(date: number) {
  if (props.type === 'monthrange' && isArray(props.value)) {
    const [startDate, endDate] = props.value || []

    if (startDate && compareMonth(date, startDate) === 0) {
      if (endDate && compareMonth(startDate, endDate) === 0) {
        return 'same'
      }
      return 'start'
    } else if (endDate && compareMonth(date, endDate) === 0) {
      return 'end'
    } else if (startDate && endDate && compareMonth(date, startDate) === 1 && compareMonth(date, endDate) === -1) {
      return 'middle'
    } else {
      return ''
    }
  } else {
    if (props.value && compareMonth(date, props.value as number) === 0) {
      return 'selected'
    } else {
      return ''
    }
  }
}
function handleDateClick(index: number) {
  const date = months.value[index]

  if (date.disabled) return

  switch (props.type) {
    case 'month':
      handleMonthChange(date)
      break
    case 'monthrange':
      handleMonthRangeChange(date)
      break
    default:
      handleMonthChange(date)
  }
}
function getDate(date: number) {
  return props.defaultTime && props.defaultTime.length > 0 ? getDateByDefaultTime(date, props.defaultTime[0]) : date
}
function handleMonthChange(date: CalendarDayItem) {
  if (date.type !== 'selected') {
    emit('change', {
      value: getDate(date.date)
    })
  }
}
function handleMonthRangeChange(date: CalendarDayItem) {
  let value: (number | null)[] = []
  const [startDate, endDate] = isArray(props.value) ? props.value || [] : []
  const compare = compareMonth(date.date, startDate!)

  // 禁止选择同个日期
  if (!props.allowSameDay && !endDate && compare === 0) return

  if (startDate && !endDate && compare > -1) {
    if (props.maxRange && getMonthOffset(date.date, startDate) > props.maxRange) {
      const maxEndDate = getMonthByOffset(startDate, props.maxRange - 1)
      value = [startDate, getDate(maxEndDate)]
      toast.show({
        msg: props.rangePrompt || translate('rangePromptMonth', props.maxRange)
      })
    } else {
      value = [startDate, getDate(date.date)]
    }
  } else {
    value = [getDate(date.date), null]
  }
  emit('change', {
    value
  })
}

function getFormatterDate(date: number, month: number, type?: CalendarDayType) {
  let monthObj: CalendarDayItem = {
    date: date,
    text: month + 1,
    topInfo: '',
    bottomInfo: '',
    type,
    disabled: compareMonth(date, props.minDate) === -1 || compareMonth(date, props.maxDate) === 1,
    isLastRow: month >= 8
  }

  if (props.formatter) {
    if (isFunction(props.formatter)) {
      monthObj = props.formatter(monthObj)
    } else {
      console.error('[wot-design] error(wd-calendar-view): the formatter prop of wd-calendar-view should be a function')
    }
  }

  return monthObj
}
</script>

<template>
  <wd-toast selector="wd-year" />

  <view class="wd-year year">
    <text v-if="showTitle" class="wd-year__title">{{ yearTitle(date) }}</text>
    <view class="wd-year__months">
      <view
        v-for="(item, index) in months"
        :key="index"
        :class="`wd-year__month ${item.disabled ? 'is-disabled' : ''} ${item.isLastRow ? 'is-last-row' : ''} ${
          item.type ? monthTypeClass(item.type) : ''
        } ${item.customClass || ''}`"
        @tap="handleDateClick(index)"
      >
        <view class="wd-year__month-container">
          <!-- Lynx 适配：__month-top / __month-bottom 为绝对定位 + flex 居中的
               文本容器，沿用「view 承载布局 + 内部 text 放字形」写法；
               __month-text 仅设字重，直接用 text 元素 -->
          <view class="wd-year__month-top">
            <text>{{ item.topInfo }}</text>
          </view>
          <text class="wd-year__month-text">{{ getMonthLabel(item.date) }}</text>
          <view class="wd-year__month-bottom">
            <text>{{ item.bottomInfo }}</text>
          </view>
        </view>
        <!-- Lynx 适配：wot-ui 用 ::after 绘制范围态背景，此处为真实元素 -->
        <view v-if="item.type === 'start' || item.type === 'end'" class="wd-year__month-range" />
      </view>
    </view>
  </view>
</template>

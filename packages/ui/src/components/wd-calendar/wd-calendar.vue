/*
 * wd-calendar — 日历
 *
 * Lynx 实现说明：
 * - 结构：wd-popup（bottom）+ 头部（标题/类型切换/快捷选项）+ wd-calendar-view
 *   + 确认按钮；
 * - 区间模式展示起止标签；确认前可经 beforeConfirm 拦截；
 * - 类型切换用内置 tab（日/周/月），不依赖 wd-tabs。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import WdCalendarView from '../wd-calendar-view/wd-calendar-view.vue'
import WdPopup from '../wd-popup/wd-popup.vue'
import { callInterceptor } from '../../common/interceptor'
import { useAlive } from '../../composables/useAlive'
import { formatDate } from '../../common/formatDate'
import { deepClone, isArray, isEqual, parseStyle } from '../../common/util'
import { useTranslate } from '../../composables/useTranslate'
import { calendarProps, type CalendarExpose } from './types'
import type { CalendarType } from '../wd-calendar-view/types'

const props = defineProps(calendarProps)
const isAlive = useAlive()
const emit = defineEmits(['cancel', 'change', 'update:modelValue', 'confirm', 'open', 'update:visible'])
const { translate } = useTranslate('calendar')

const pickerShow = ref<boolean>(false)
const calendarValue = ref<null | number | number[]>(null)
/** 打开时的值快照：非确认关闭时回滚（取消不回滚到旧值） */
const lastCalendarValue = ref<null | number | number[]>(null)
const confirmBtnDisabled = ref<boolean>(true)
const currentTab = ref<number>(0)
const currentType = ref<CalendarType>('date')
const activeShortcutIndex = ref<number>(-1)
/** 确认路径标记：确认关闭时不派发 cancel、不回滚未提交值 */
const isConfirming = ref<boolean>(false)

const isRangeType = computed(() => currentType.value.indexOf('range') > -1)

const TABS: Array<{ type: CalendarType; label: string }> = [
  { type: 'date', label: '日' },
  { type: 'week', label: '周' },
  { type: 'month', label: '月' }
]

const RANGE_TABS: Array<{ type: CalendarType; label: string }> = [
  { type: 'daterange', label: '日' },
  { type: 'weekrange', label: '周' },
  { type: 'monthrange', label: '月' }
]

function formatRange(value: number, rangeType: 'start' | 'end', type: CalendarType): string {
  switch (type) {
    case 'daterange':
      if (!value) return rangeType === 'end' ? translate('endTime') : translate('startTime')
      return formatDate(value, translate('dateFormat'))
    case 'datetimerange':
      if (!value) return rangeType === 'end' ? translate('endTime') : translate('startTime')
      return formatDate(value, translate('timeFormat'))
    case 'weekrange':
      if (!value) return rangeType === 'end' ? translate('endWeek') : translate('startWeek')
      return formatDate(value, translate('dateFormat'))
    case 'monthrange':
      if (!value) return rangeType === 'end' ? translate('endMonth') : translate('startMonth')
      return formatDate(value, translate('monthFormat'))
    default:
      return ''
  }
}

const rangeLabel = computed(() => {
  const [start, end] = deepClone(isArray(calendarValue.value) ? calendarValue.value : [])
  return [start, end].map((item, index) => {
    return (props.innerDisplayFormat || formatRange)(item, index === 0 ? 'start' : 'end', currentType.value)
  })
})

watch(
  () => props.modelValue,
  (val, oldVal) => {
    if (isEqual(val, oldVal)) return
    calendarValue.value = deepClone(val)
    confirmBtnDisabled.value = getConfirmBtnStatus(val)
  },
  { immediate: true }
)

watch(
  () => props.type,
  (newValue) => {
    if (props.showTypeSwitch) {
      const tabs = isRangeType.value ? RANGE_TABS : TABS
      const index = tabs.findIndex((t) => t.type === newValue)
      currentTab.value = index > -1 ? index : 0
    }
    currentType.value = deepClone(newValue)
  },
  { deep: true, immediate: true }
)

watch(
  () => props.visible,
  (val) => {
    pickerShow.value = val
  },
  { immediate: true }
)

watch(pickerShow, (val) => {
  emit('update:visible', val)
  if (val) {
    // 打开时快照当前值：非确认关闭时回滚到此快照；
    // 同时复位确认标记（beforeConfirm 未决期间用户已取消时防止残留）
    isConfirming.value = false
    lastCalendarValue.value = deepClone(calendarValue.value)
    emit('open')
  } else if (isConfirming.value) {
    // 确认路径：不清标志位外的任何状态，由 onConfirm 负责复位
    isConfirming.value = false
  } else {
    // 取消 / 点遮罩关闭：恢复快照，丢弃未提交的选择（参考实现 handleClosed）
    calendarValue.value = deepClone(lastCalendarValue.value)
    confirmBtnDisabled.value = getConfirmBtnStatus(calendarValue.value)
    emit('cancel')
  }
})

function getConfirmBtnStatus(value: number | number[] | null): boolean {
  if (isArray(value)) {
    return value.length === 0 || (isRangeType.value && value.filter((v) => !!v).length < 2)
  }
  return !isDef(value)
}

function isDef(value: any): boolean {
  return value !== undefined && value !== null
}

function handleTypeChange(tab: { type: CalendarType; label: string }) {
  currentType.value = tab.type
  emit('change', { value: calendarValue.value, type: tab.type })
}

function handleShortcutClick(index: number) {
  // 设置激活的快捷选项
  activeShortcutIndex.value = index

  if (props.onShortcutsClick && typeof props.onShortcutsClick === 'function') {
    // 参考实现的入参形状为 { item, index }，返回值即新的选中值
    calendarValue.value = deepClone(
      props.onShortcutsClick({
        item: props.shortcuts[index],
        index
      })
    )
    confirmBtnDisabled.value = getConfirmBtnStatus(calendarValue.value)
  }

  // showConfirm=false 时无确认入口，选完即自动确认
  if (!props.showConfirm) {
    onConfirm()
  }
}

function handleChange({ value }: any) {
  calendarValue.value = value
  confirmBtnDisabled.value = getConfirmBtnStatus(value)
  // 用户手动切换日期时重置快捷选项激活状态
  activeShortcutIndex.value = -1
  emit('change', { value })

  // showConfirm=false 时无确认入口，选完即自动确认
  if (!props.showConfirm && !confirmBtnDisabled.value) {
    onConfirm()
  }
}

function onConfirm() {
  callInterceptor(props.beforeConfirm, {
    args: [calendarValue.value],
    done: () => {
      // beforeConfirm 可返回未决 Promise：期间组件/页面可能已卸载，
      // done 落地时不得在已销毁树上写 ref（真机 9902 晚到 patch 家族）。
      if (!isAlive()) return
      // 先打确认标记再关：watch(pickerShow) 据此跳过 cancel 与回滚
      //（此前确认时 cancel 与 confirm 会同时触发）
      isConfirming.value = true
      pickerShow.value = false
      emit('update:modelValue', calendarValue.value)
      emit('confirm', { value: calendarValue.value })
    }
  })
}

function open() {
  pickerShow.value = true
  emit('open')
}

function close() {
  pickerShow.value = false
}

defineExpose<CalendarExpose>({
  open,
  close
})
</script>

<template>
  <view :class="`wd-calendar ${customClass}`" :style="parseStyle(customStyle)">
    <wd-popup
      v-model="pickerShow"
      position="bottom"
      :close-on-click-modal="closeOnClickModal"
      :safe-area-inset-bottom="safeAreaInsetBottom"
      :z-index="zIndex"
      :root-portal="rootPortal"
      custom-class="wd-calendar__popup"
      @close="close"
    >
      <view class="wd-calendar__header">
        <!-- 弹层标题（title prop 此前从未渲染） -->
        <text v-if="title" class="wd-calendar__title">{{ title }}</text>
        <!-- 类型切换 -->
        <view v-if="showTypeSwitch" class="wd-calendar__tabs">
          <view
            v-for="(tab, index) in (isRangeType ? RANGE_TABS : TABS)"
            :key="index"
            :class="`wd-calendar__tab ${currentTab === index ? 'is-active' : ''}`"
            @tap="handleTypeChange(tab)"
          >
            <text>{{ tab.label }}</text>
          </view>
        </view>
        <!-- 快捷选项 -->
        <view v-if="shortcuts.length > 0" class="wd-calendar__shortcuts">
          <view
            v-for="(item, index) in shortcuts"
            :key="index"
            :class="`wd-calendar__tag ${index === shortcuts.length - 1 ? 'wd-calendar__tag--last-tag' : ''} ${
              activeShortcutIndex === index ? 'is-active' : ''
            }`"
            @tap="handleShortcutClick(index)"
          >
            <text>{{ item.text }}</text>
          </view>
        </view>
      </view>

      <view :class="`wd-calendar__view ${isRangeType ? 'is-range' : ''} ${showConfirm ? 'is-show-confirm' : ''}`">
        <!-- 区间标签 -->
        <view v-if="isRangeType" class="wd-calendar__range">
          <view :class="`wd-calendar__range-item ${!isArray(calendarValue) || !calendarValue[0] ? 'is-placeholder' : ''}`">
            <text>{{ rangeLabel[0] }}</text>
          </view>
          <view class="wd-calendar__range-separator" />
          <view :class="`wd-calendar__range-item ${!isArray(calendarValue) || !calendarValue[1] ? 'is-placeholder' : ''}`">
            <text>{{ rangeLabel[1] }}</text>
          </view>
        </view>

        <wd-calendar-view
          v-model="calendarValue"
          :type="currentType"
          :min-date="minDate"
          :max-date="maxDate"
          :first-day-of-week="firstDayOfWeek"
          :formatter="formatter"
          :panel-height="panelHeight"
          :max-range="maxRange"
          :range-prompt="rangePrompt"
          :allow-same-day="allowSameDay"
          :default-time="defaultTime"
          :time-filter="timeFilter"
          :hide-second="hideSecond"
          :immediate-change="immediateChange"
          :custom-class="customViewClass"
          @change="handleChange"
        />
      </view>

      <view v-if="showConfirm" class="wd-calendar__footer">
        <wd-button type="primary" block :disabled="confirmBtnDisabled" @tap="onConfirm">
          {{ confirmText || translate('confirm') }}
        </wd-button>
      </view>
    </wd-popup>
  </view>
</template>

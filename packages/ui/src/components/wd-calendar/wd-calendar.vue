/*
 * wd-calendar — 日历
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 弹层用 wd-action-sheet（bottom）承载，与 wot-ui 一致；内部按
 *   header（类型切换 tabs + 快捷选项）+ wd-calendar-view + 确认按钮组织；
 * - 交互为 tab 切换 / 标签点选 / 按钮确认，无拖动/滑动/缩放手势，
 *   不涉及 MTS 跟手（NATIVE-REWRITE §2 仅约束跟手交互类组件）；
 * - 布局居中（NATIVE-REWRITE §3）：根节点、__header、__view 均显式
 *   display: flex + flex-direction: column（纵向组合）；__range 为
 *   justify-content + align-items 成对的居中行；__range-item 在
 *   text-align: center 之外补 flex 居中对（文本容器不依赖继承）；
 *   __shortcuts 为 wrap + justify-content: center 的标签行；
 * - @click → @tap（CONVENTIONS §6）；hover-class 按压态由 wd-tag /
 *   wd-button 自身承担；
 * - customStyle 为字符串，经 parseStyle 归一为对象后绑定（CONVENTIONS §19）；
 * - handleOpened 里对 wd-tabs 的 scrollIntoView / updateLineStyle 做存在性
 *   守卫：本地 wd-tabs 尚未对外暴露这两个方法（共享层缺口，调用即 no-op）；
 * - onConfirm 落地前经 useAlive 判活：beforeConfirm 可返回未决 Promise，
 *   期间组件/页面可能已卸载，晚到的 ref 写入会触发真机 9902 晚到 patch。
 */
<script lang="ts" setup>
import './index.css'

import { ref, computed, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdCalendarView from '../wd-calendar-view/wd-calendar-view.vue'
import WdActionSheet from '../wd-action-sheet/wd-action-sheet.vue'
import WdButton from '../wd-button/wd-button.vue'
import WdTabs from '../wd-tabs/wd-tabs.vue'
import WdTab from '../wd-tab/wd-tab.vue'
import WdTag from '../wd-tag/wd-tag.vue'
import { callInterceptor } from '../../common/interceptor'
import { formatDate } from '../../common/formatDate'
import { deepClone, isArray, isEqual, padZero, pause, parseStyle } from '../../common/util'
import { getWeekNumber, isRange } from '../wd-calendar-view/utils'
import { useTranslate } from '../../composables/useTranslate'
import { useAlive } from '../../composables/useAlive'
import { calendarProps, type CalendarExpose } from './types'
import type { CalendarType } from '../wd-calendar-view/types'

const props = defineProps(calendarProps)
const isAlive = useAlive()
const emit = defineEmits(['cancel', 'change', 'update:modelValue', 'confirm', 'open', 'update:visible'])
const { translate } = useTranslate('calendar')

const pickerShow = ref<boolean>(false)
const calendarValue = ref<null | number | number[]>(null)
const lastCalendarValue = ref<null | number | number[]>(null)
const confirmBtnDisabled = ref<boolean>(true)
const currentTab = ref<number>(0)
const lastTab = ref<number>(0)
const currentType = ref<CalendarType>(props.type)
const lastCurrentType = ref<CalendarType>()
const inited = ref<boolean>(false)
const calendarViewRef = ref()
const calendarTabs = ref()
const isConfirming = ref<boolean>(false)
let confirmRequest = 0
/** 当前激活的快捷选项索引，-1 表示无激活项 */
const activeShortcutIndex = ref<number>(-1)

const formatRange = (value: number, rangeType: 'start' | 'end', type: CalendarType) => {
  switch (type) {
    case 'daterange':
      if (!value) {
        return rangeType === 'end' ? translate('endTime') : translate('startTime')
      }
      return formatDate(value, translate('dateFormat'))
    case 'datetimerange':
      if (!value) {
        return rangeType === 'end' ? translate('endTime') : translate('startTime')
      }
      return formatDate(value, translate('timeFormat'))
    case 'weekrange': {
      if (!value) {
        return rangeType === 'end' ? translate('endWeek') : translate('startWeek')
      }
      const date = new Date(value)
      const year = date.getFullYear()
      const week = getWeekNumber(value)
      return translate('weekFormat', year, padZero(week))
    }
    case 'monthrange':
      if (!value) {
        return rangeType === 'end' ? translate('endMonth') : translate('startMonth')
      }
      return formatDate(value, translate('monthFormat'))
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
  {
    immediate: true
  }
)

watch(
  () => props.type,
  (newValue) => {
    if (props.showTypeSwitch) {
      const tabs = ['date', 'week', 'month']
      const rangeTabs = ['daterange', 'weekrange', 'monthrange']

      const index = Math.max(0, newValue.indexOf('range') > -1 ? rangeTabs.indexOf(newValue) : tabs.indexOf(newValue))
      currentTab.value = index
    }
    currentType.value = deepClone(newValue)
  },
  {
    deep: true,
    immediate: true
  }
)

watch(
  () => props.visible,
  (val) => {
    if (!val) confirmRequest++
    pickerShow.value = val
  },
  {
    immediate: true
  }
)

function handleOpened() {
  if (props.showTypeSwitch) {
    calendarTabs.value && calendarTabs.value.scrollIntoView && calendarTabs.value.scrollIntoView()
    calendarTabs.value && calendarTabs.value.updateLineStyle && calendarTabs.value.updateLineStyle(false)
  }
}

function handleClosed() {
  if (pickerShow.value) return
  if (isConfirming.value) {
    isConfirming.value = false
  } else {
    calendarValue.value = deepClone(lastCalendarValue.value)
    currentTab.value = lastTab.value
    currentType.value = lastCurrentType.value || 'date'
    confirmBtnDisabled.value = getConfirmBtnStatus(lastCalendarValue.value)
  }
}

watch(pickerShow, async (val) => {
  confirmRequest++
  emit('update:visible', val)
  if (val) {
    inited.value = true
    lastCalendarValue.value = deepClone(calendarValue.value)
    lastTab.value = currentTab.value
    lastCurrentType.value = currentType.value

    await pause()
    if (!isAlive() || !pickerShow.value) return
    scrollIntoView()
    emit('open')
  } else {
    if (!isConfirming.value) {
      emit('cancel')
    }
  }
}, { immediate: props.visible })

function scrollIntoView() {
  calendarViewRef.value && calendarViewRef.value.scrollIntoView()
}

// 对外暴露方法
function open() {
  pickerShow.value = true
}

// 对外暴露方法
function close() {
  confirmRequest++
  pickerShow.value = false
}

function handleTypeChange({ index }: { index: number }) {
  const tabs = ['date', 'week', 'month']
  const rangeTabs = ['daterange', 'weekrange', 'monthrange']
  const type = props.type.indexOf('range') > -1 ? rangeTabs[index] : tabs[index]
  currentTab.value = index
  currentType.value = type as CalendarType
}

function getConfirmBtnStatus(value: number | number[] | null) {
  if (value == null) return true
  if (isRange(currentType.value)) return !isArray(value) || value.length < 2 || value[0] == null || value[1] == null
  if (currentType.value === 'dates') return !isArray(value) || value.length === 0
  return false
}

function handleChange({ value }: { value: number | number[] | null }) {
  calendarValue.value = deepClone(value)
  confirmBtnDisabled.value = getConfirmBtnStatus(value)
  // 用户手动切换日期时重置快捷选项激活状态
  activeShortcutIndex.value = -1

  emit('change', {
    value
  })

  if (!props.showConfirm && !confirmBtnDisabled.value) {
    handleConfirm()
  }
}

function handleConfirm() {
  if (!pickerShow.value || getConfirmBtnStatus(calendarValue.value)) return
  const request = ++confirmRequest
  callInterceptor(props.beforeConfirm, {
    args: [calendarValue.value],
    done: () => {
      if (!isAlive() || request !== confirmRequest || !pickerShow.value) return
      onConfirm()
    }
  })
}

function onConfirm() {
  // beforeConfirm 可返回未决 Promise：期间组件/页面可能已卸载，
  // done 落地时不得在已销毁树上写 ref（真机 9902 晚到 patch 家族）。
  if (!isAlive()) return
  isConfirming.value = true
  pickerShow.value = false
  lastCurrentType.value = currentType.value
  emit('update:modelValue', calendarValue.value)
  emit('confirm', {
    value: calendarValue.value,
    type: currentType.value
  })
}

function handleShortcutClick(index: number) {
  // 设置激活的快捷选项
  activeShortcutIndex.value = index

  if (props.onShortcutsClick && typeof props.onShortcutsClick === 'function') {
    calendarValue.value = deepClone(
      props.onShortcutsClick({
        item: props.shortcuts[index],
        index
      })
    )
    confirmBtnDisabled.value = getConfirmBtnStatus(calendarValue.value)
  }

  if (!props.showConfirm) {
    handleConfirm()
  }
}

defineExpose<CalendarExpose>({
  close,
  open
})
</script>

<template>
  <view :class="`wd-calendar ${customClass}`" :style="parseStyle(customStyle)">
    <WdActionSheet
      v-model="pickerShow"
      :duration="duration"
      :close-on-click-modal="closeOnClickModal"
      :safe-area-inset-bottom="safeAreaInsetBottom"
      :z-index="zIndex"
      :root-portal="rootPortal"
      :title="title || translate('title')"
      custom-class="wd-calendar__popup"
      @close="close"
      @after-enter="handleOpened"
      @after-leave="handleClosed"
    >
      <view class="wd-calendar__header">
        <view v-if="showTypeSwitch" class="wd-calendar__tabs">
          <WdTabs ref="calendarTabs" v-model="currentTab" @change="handleTypeChange">
            <WdTab :title="translate('day')" :name="translate('day')" />
            <WdTab :title="translate('week')" :name="translate('week')" />
            <WdTab :title="translate('month')" :name="translate('month')" />
          </WdTabs>
        </view>
        <view v-if="shortcuts.length > 0" class="wd-calendar__shortcuts">
          <WdTag
            v-for="(item, index) in shortcuts"
            :key="index"
            :custom-class="`wd-calendar__tag ${index === shortcuts.length - 1 ? 'is-last-tag' : ''}`"
            :type="activeShortcutIndex === index ? 'primary' : 'default'"
            :variant="activeShortcutIndex === index ? 'dark' : 'light'"
            @click="handleShortcutClick(index)"
          >
            <text>{{ item.text }}</text>
          </WdTag>
        </view>
      </view>
      <view
        v-if="inited"
        :class="`wd-calendar__view ${currentType.indexOf('range') > -1 ? 'is-range' : ''} ${showConfirm ? 'is-show-confirm' : ''}`"
      >
        <view v-if="isRange(currentType)" class="wd-calendar__range">
          <view :class="`wd-calendar__range-item ${!calendarValue || !isArray(calendarValue) || !calendarValue[0] ? 'is-placeholder' : ''}`">
            <text>{{ rangeLabel[0] }}</text>
          </view>
          <view class="wd-calendar__range-separator" />
          <view :class="`wd-calendar__range-item ${!calendarValue || !isArray(calendarValue) || !calendarValue[1] ? 'is-placeholder' : ''}`">
            <text>{{ rangeLabel[1] }}</text>
          </view>
        </view>
        <WdCalendarView
          ref="calendarViewRef"
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
          :show-panel-title="showPanelTitle"
          :immediate-change="immediateChange"
          :switch-mode="switchMode"
          @change="handleChange"
        />
      </view>
      <view v-if="showConfirm" class="wd-calendar__confirm">
        <slot name="confirm-left" />
        <view class="wd-calendar__confirm-btn-wrapper">
          <WdButton size="large" block :disabled="confirmBtnDisabled" @tap="handleConfirm">
            <text>{{ confirmText || translate('confirm') }}</text>
          </WdButton>
        </view>
        <slot name="confirm-right" />
      </view>
    </WdActionSheet>
  </view>
</template>

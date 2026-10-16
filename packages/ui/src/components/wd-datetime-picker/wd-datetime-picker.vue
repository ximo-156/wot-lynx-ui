/*
 * wd-datetime-picker — 日期时间选择器
 *
 * Lynx 实现说明：
 * - 结构：wd-popup（bottom）+ toolbar + wd-datetime-picker-view；
 * - 区间模式（modelValue 为数组）展示 start/end tab，分别编辑两端；
 * - 滑动未结束点确认时挂起，pickend 后自动确认。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onBeforeMount, onMounted, ref, watch } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdDatetimePickerView from '../wd-datetime-picker-view/wd-datetime-picker-view.vue'
import { callInterceptor } from '../../common/interceptor'
import { isArray, parseStyle } from '../../common/util'
import { useTranslate } from '../../composables/useTranslate'
import { datetimePickerProps, type DatetimePickerExpose } from './types'

const { translate } = useTranslate('datetimePicker')

const props = defineProps(datetimePickerProps)
const emit = defineEmits(['confirm', 'open', 'cancel', 'update:modelValue', 'update:visible'])

const popupShow = ref<boolean>(false)
const pickerValue = ref<string | number>('')
const startValue = ref<string | number>('')
const endValue = ref<string | number>('')
const showStart = ref<boolean>(true)
const isPicking = ref<boolean>(false)
const hasConfirmed = ref<boolean>(false)

const region = computed(() => isArray(props.modelValue))

const showTabLabel = computed(() => {
  const format = props.displayFormatTabLabel
  if (!format) return [startValue.value, endValue.value]
  return [format(startValue.value), format(endValue.value)]
})

watch(
  () => props.modelValue,
  (val) => {
    if (isArray(val)) {
      startValue.value = val[0]
      endValue.value = val[1]
      pickerValue.value = showStart.value ? val[0] : val[1]
    } else {
      pickerValue.value = val
    }
  },
  { deep: true, immediate: true }
)

watch(
  () => props.visible,
  (val) => {
    if (val) {
      showPopup()
    } else {
      popupShow.value = false
    }
  }
)

watch(popupShow, (val) => {
  emit('update:visible', val)
})

onMounted(() => {
  if (props.visible) {
    showPopup()
  }
})

onBeforeMount(() => {
  if (isArray(props.modelValue)) {
    startValue.value = props.modelValue[0]
    endValue.value = props.modelValue[1]
    pickerValue.value = props.modelValue[0]
  } else {
    pickerValue.value = props.modelValue
  }
})

function open() {
  showPopup()
}

function close() {
  onCancel()
}

function showPopup() {
  emit('open')
  // 从 props.modelValue 重置内部未提交值：此前只置 popupShow，取消后
  // 重开仍显示上次拖到一半的旧值（pickerValue 未回滚）。
  if (isArray(props.modelValue)) {
    startValue.value = props.modelValue[0]
    endValue.value = props.modelValue[1]
    showStart.value = true
    pickerValue.value = startValue.value
  } else {
    pickerValue.value = props.modelValue
  }
  popupShow.value = true
}

function onCancel() {
  popupShow.value = false
  emit('cancel')
}

function onTabChange(tab: 'start' | 'end') {
  showStart.value = tab === 'start'
  pickerValue.value = showStart.value ? startValue.value : endValue.value
}

function onConfirm() {
  if (isPicking.value) {
    hasConfirmed.value = true
    return
  }
  callInterceptor(props.beforeConfirm, {
    args: [region.value ? [startValue.value, endValue.value] : pickerValue.value],
    done: () => {
      handleConfirm()
    }
  })
}

function handleConfirm() {
  const value = region.value ? [startValue.value, endValue.value] : pickerValue.value
  popupShow.value = false
  emit('update:modelValue', value)
  emit('confirm', { value })
}

function onPickerChange({ value }: any) {
  pickerValue.value = value
  if (region.value) {
    if (showStart.value) {
      startValue.value = value
    } else {
      endValue.value = value
    }
  }
}

function onPickStart() {
  isPicking.value = true
}

function onPickEnd() {
  isPicking.value = false
  if (hasConfirmed.value) {
    hasConfirmed.value = false
    onConfirm()
  }
}

defineExpose<DatetimePickerExpose>({
  close,
  open
})
</script>

<template>
  <view :class="`wd-datetime-picker ${customClass}`" :style="parseStyle(customStyle)">
    <wd-popup
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
        <wd-datetime-picker-view
          :custom-class="customViewClass"
          :type="type"
          :item-height="itemHeight"
          :visible-item-count="visibleItemCount"
          :value-key="valueKey"
          :label-key="labelKey"
          :min-date="minDate"
          :max-date="maxDate"
          :min-hour="minHour"
          :max-hour="maxHour"
          :min-minute="minMinute"
          :max-minute="maxMinute"
          :use-second="useSecond"
          :min-second="minSecond"
          :max-second="maxSecond"
          :filter="filter"
          :formatter="formatter"
          v-model="pickerValue"
          @change="onPickerChange"
          @pickstart="onPickStart"
          @pickend="onPickEnd"
        />
      </view>
    </wd-popup>
  </view>
</template>

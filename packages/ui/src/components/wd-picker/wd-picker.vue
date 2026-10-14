/*
 * wd-picker — 选择器
 *
 * Lynx 实现说明：
 * - 结构：wd-popup（bottom）+ toolbar + wd-picker-view；
 * - 滑动未结束点确认时挂起，pickend 后自动确认（避免取到旧值）；
 * - beforeConfirm 拦截器经 common/interceptor 下发。
 */
<script lang="ts" setup>
import './index.css'

import { getCurrentInstance, onBeforeMount, onMounted, ref, watch } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdPickerView from '../wd-picker-view/wd-picker-view.vue'
import { deepClone } from '../../common/util'
import { callInterceptor } from '../../common/interceptor'
import type { PickerOption, PickerViewExpose } from '../wd-picker-view/types'
import { useTranslate } from '../../composables/useTranslate'
import { pickerProps, type PickerExpose } from './types'
import type { Numeric } from '../../common/props'

const { translate } = useTranslate('picker')

const props = defineProps(pickerProps)
const emit = defineEmits(['confirm', 'open', 'cancel', 'update:modelValue', 'update:visible'])

const popupShow = ref<boolean>(false)
const pickerValue = ref<Numeric[]>([])
const pickerSelectedOptions = ref<PickerOption[]>([])
const pickerViewRef = ref<PickerViewExpose>()
const displayColumns = ref<Array<PickerOption | Array<PickerOption>>>([])
const isPicking = ref<boolean>(false)
const hasConfirmed = ref<boolean>(false)

watch(
  () => props.modelValue,
  (newValue) => {
    pickerValue.value = newValue as Numeric[]
  },
  { deep: true, immediate: true }
)

watch(
  () => props.columns,
  (newValue) => {
    displayColumns.value = deepClone(newValue)
    if (newValue.length === 0) {
      pickerValue.value = []
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
  displayColumns.value = deepClone(props.columns)
})

function open() {
  showPopup()
}

function close() {
  onCancel()
}

function showPopup() {
  emit('open')
  popupShow.value = true
  pickerValue.value = props.modelValue
  displayColumns.value = deepClone(props.columns)
}

function onCancel() {
  popupShow.value = false
  emit('cancel')
}

function onConfirm() {
  // 滑动未结束：挂起确认，pickend 后自动继续
  if (isPicking.value) {
    hasConfirmed.value = true
    return
  }
  const { beforeConfirm } = props
  callInterceptor(beforeConfirm, {
    args: [pickerValue.value],
    done: () => {
      handleConfirm()
    }
  })
}

function handleConfirm() {
  const values = pickerViewRef.value?.getSelectedValues() || pickerValue.value
  const selects = pickerViewRef.value?.getSelectedOptions() || pickerSelectedOptions.value
  popupShow.value = false
  emit('update:modelValue', values)
  emit('confirm', {
    value: values,
    selectedItems: selects
  })
}

function pickerViewChange({ selectedValues, selectedOptions }: any) {
  pickerValue.value = selectedValues
  pickerSelectedOptions.value = selectedOptions
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

defineExpose<PickerExpose>({
  close,
  open
})
</script>

<template>
  <view :class="`wd-picker ${customClass}`" :style="customStyle">
    <wd-popup
      v-model="popupShow"
      position="bottom"
      :hide-when-close="false"
      :close-on-click-modal="closeOnClickModal"
      :z-index="zIndex"
      :safe-area-inset-bottom="safeAreaInsetBottom"
      :root-portal="rootPortal"
      custom-class="wd-picker__popup"
      @cancel="onCancel"
    >
      <view class="wd-picker__wraper">
        <view class="wd-picker__toolbar">
          <view class="wd-picker__action wd-picker__action--cancel" @tap="onCancel">
            <text>{{ cancelButtonText || translate('cancel') }}</text>
          </view>
          <view v-if="title" class="wd-picker__title">
            <text>{{ title }}</text>
          </view>
          <view class="wd-picker__action wd-picker__action--confirm" @tap="onConfirm">
            <text>{{ confirmButtonText || translate('done') }}</text>
          </view>
        </view>
        <wd-picker-view
          ref="pickerViewRef"
          :custom-class="customViewClass"
          v-model="pickerValue"
          :columns="displayColumns"
          :item-height="itemHeight"
          :visible-item-count="visibleItemCount"
          :value-key="valueKey"
          :label-key="labelKey"
          :cascade="cascade"
          :children-key="childrenKey"
          :immediate-change="immediateChange"
          @change="pickerViewChange"
          @pickstart="onPickStart"
          @pickend="onPickEnd"
        />
      </view>
    </wd-popup>
  </view>
</template>

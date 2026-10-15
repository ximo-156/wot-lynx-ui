/*
 * wd-cascader — 级联选择
 *
 * Lynx 实现说明：
 * - 基于 wd-picker-view 的级联模式（cascade + childrenKey），
 *   选中某一级后动态展开下一列；
 * - checkStrictly 时允许选择任意一级（非叶子），确认按钮收集全路径；
 * - lazyLoad 支持异步加载子级。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { computed, ref, watch } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdPickerView from '../wd-picker-view/wd-picker-view.vue'
import WdButton from '../wd-button/wd-button.vue'
import { cascaderProps, type CascaderExpose, type CascaderOption } from './types'
import { callInterceptor } from '../../common/interceptor'
import { useTranslate } from '../../composables/useTranslate'

const { translate } = useTranslate('cascader')

const props = defineProps(cascaderProps)
const emit = defineEmits(['change', 'cancel', 'confirm', 'update:modelValue', 'open', 'close', 'update:visible'])

const pickerShow = ref<boolean>(false)
const pickerValue = ref<Array<string | number>>([])
const selectedPath = ref<CascaderOption[]>([])

/** 当前选中的值数组（兼容单值） */
const currentValue = computed<Array<string | number>>(() => {
  return Array.isArray(props.modelValue) ? props.modelValue : isDef(props.modelValue) ? [props.modelValue] : []
})

function isDef(value: any): boolean {
  return value !== undefined && value !== null
}

watch(
  () => props.modelValue,
  (val) => {
    const arr = Array.isArray(val) ? val : isDef(val) ? [val] : []
    pickerValue.value = arr
  },
  { deep: true, immediate: true }
)

watch(
  () => props.visible,
  (val) => {
    if (val) {
      open()
    } else {
      pickerShow.value = false
    }
  }
)

watch(pickerShow, (val) => {
  emit('update:visible', val)
})

function open() {
  emit('open')
  pickerShow.value = true
  pickerValue.value = currentValue.value
}

function close() {
  pickerShow.value = false
  emit('close')
  emit('cancel')
}

/** picker-view change：同步值 */
function onPickerChange({ selectedValues, selectedOptions }: any) {
  pickerValue.value = selectedValues
  selectedPath.value = selectedOptions || []
  emit('change', { value: selectedValues, selectedOptions })
}

function onConfirm() {
  callInterceptor(props.beforeConfirm, {
    args: [pickerValue.value, selectedPath.value],
    done: () => {
      pickerShow.value = false
      const value = Array.isArray(props.modelValue) ? pickerValue.value : pickerValue.value[pickerValue.value.length - 1]
      emit('update:modelValue', value)
      emit('confirm', { value, selectedOptions: selectedPath.value })
    }
  })
}

defineExpose<CascaderExpose>({
  open,
  close
})
</script>

<template>
  <view :class="['wd-cascader', customClass]" :style="parseStyle(customStyle)">
    <wd-popup
      v-model="pickerShow"
      position="bottom"
      :close-on-click-modal="closeOnClickModal"
      :z-index="zIndex"
      :safe-area-inset-bottom="safeAreaInsetBottom"
      :root-portal="rootPortal"
      custom-class="wd-cascader__popup"
      @cancel="close"
    >
      <view class="wd-cascader__wraper">
        <view class="wd-cascader__header">
          <view class="wd-cascader__action" @tap="close">
            <text>{{ translate('cancel') }}</text>
          </view>
          <text v-if="title" class="wd-cascader__title">{{ title }}</text>
          <view class="wd-cascader__action" @tap="onConfirm">
            <text>{{ confirmText || translate('confirm') }}</text>
          </view>
        </view>
        <wd-picker-view
          v-model="pickerValue"
          :columns="options"
          cascade
          :value-key="valueKey"
          :label-key="textKey"
          :children-key="childrenKey"
          @change="onPickerChange"
        />
      </view>
    </wd-popup>
  </view>
</template>

/*
 * wd-cascader — 级联选择
 *
 * Lynx 实现说明：
 * - 基于 wd-picker-view 的级联模式（cascade + childrenKey），
 *   选中某一级后动态展开下一列；
 * - checkStrictly / lazyLoad / isLeafKey / tipKey 暂未支持
 *   （详见 types.ts 中各 prop 注释）。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { useAlive } from '../../composables/useAlive'
import { computed, ref, watch } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdPickerView from '../wd-picker-view/wd-picker-view.vue'
import WdButton from '../wd-button/wd-button.vue'
import { cascaderProps, type CascaderExpose, type CascaderOption } from './types'
import { callInterceptor } from '../../common/interceptor'
import { useTranslate } from '../../composables/useTranslate'

const { translate } = useTranslate('cascader')

const props = defineProps(cascaderProps)
const isAlive = useAlive()
const emit = defineEmits(['change', 'cancel', 'confirm', 'update:modelValue', 'open', 'close', 'update:visible'])

const pickerShow = ref<boolean>(false)
const pickerValue = ref<Array<string | number>>([])
const selectedPath = ref<CascaderOption[]>([])

/** 当前选中的值数组（兼容单值；空串视作未选） */
const currentValue = computed<Array<string | number>>(() => toValueArray(props.modelValue))

/** itemHeight 透传给 picker-view（numericProp → number，缺省走 picker-view 默认 44） */
const pickerItemHeight = computed(() => (isDef(props.itemHeight) ? Number(props.itemHeight) : undefined))

function isDef(value: any): boolean {
  return value !== undefined && value !== null
}

/** 归一化 modelValue 为值数组（空串视作未选，避免 [''] 伪装成已选） */
function toValueArray(val: string | number | Array<string | number>): Array<string | number> {
  if (Array.isArray(val)) return val
  return isDef(val) && val !== '' ? [val] : []
}

watch(
  () => props.modelValue,
  (val) => {
    pickerValue.value = toValueArray(val)
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
      // beforeConfirm 可返回未决 Promise：期间组件/页面可能已卸载，
      // done 落地时不得在已销毁树上写 ref（真机 9902 晚到 patch 家族）。
      if (!isAlive()) return
      pickerShow.value = false
      // 空值守卫：未选任何一级时单值模式会 emit undefined，直接关闭不确认
      if (pickerValue.value.length === 0) {
        return
      }
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
      @close="close"
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
          :item-height="pickerItemHeight"
          :value-key="valueKey"
          :label-key="textKey"
          :children-key="childrenKey"
          @change="onPickerChange"
        />
      </view>
    </wd-popup>
  </view>
</template>

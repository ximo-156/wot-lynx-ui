/*
 * wd-select-picker — 下拉选择
 *
 * Lynx 实现说明：
 * - 结构：wd-popup（bottom）+ 可选 wd-search 过滤 + 选项列表
 *   （radio 单选 / checkbox 多选）+ 确认按钮；
 * - 打开时可滚动到首个选中项（scrollIntoView）；
 * - filterable 时按 label 过滤，命中片段高亮。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, ref, watch } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdSearch from '../wd-search/wd-search.vue'
import WdRadio from '../wd-radio/wd-radio.vue'
import WdRadioGroup from '../wd-radio-group/wd-radio-group.vue'
import WdCheckbox from '../wd-checkbox/wd-checkbox.vue'
import WdCheckboxGroup from '../wd-checkbox-group/wd-checkbox-group.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import WdButton from '../wd-button/wd-button.vue'
import { selectPickerProps, type SelectPickerExpose } from './types'
import { callInterceptor } from '../../common/interceptor'
import { isArray, isDef, parseStyle } from '../../common/util'
import { useTranslate } from '../../composables/useTranslate'

const { translate } = useTranslate('select-picker')

const props = defineProps(selectPickerProps)
const emit = defineEmits(['change', 'cancel', 'confirm', 'update:modelValue', 'open', 'close', 'update:visible'])

const pickerShow = ref<boolean>(false)
const selectList = ref<Array<string | number | boolean> | string | number | boolean>([])
const isConfirm = ref<boolean>(false)
const filterVal = ref<string>('')
const filterColumns = ref<Array<Record<string, any>>>([])
const scrollTop = ref<number>(0)

const isCheckbox = computed(() => props.type === 'checkbox')

/** checkbox 模式值（数组视图） */
const checkboxValue = computed<any[]>({
  get: () => (isArray(selectList.value) ? selectList.value : []),
  set: (val) => {
    selectList.value = val
    emit('change', { value: val })
  }
})

/** radio 模式值（单值视图） */
const radioValue = computed<string | number | boolean>({
  get: () => (isArray(selectList.value) ? (selectList.value[0] ?? '') : selectList.value),
  set: (val) => {
    selectList.value = val
    emit('change', { value: val })
  }
})

/** 过滤 + 高亮 */
filterColumns.value = props.columns.map((item) => ({ ...item }))

watch(
  () => props.columns,
  (val) => {
    filterColumns.value = (val as Record<string, any>[]).map((item) => ({ ...item }))
    applyFilter()
  },
  { deep: true, immediate: true }
)

watch(
  () => props.modelValue,
  (val) => {
    selectList.value = isArray(val) ? [...val] : val
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

function applyFilter() {
  const keyword = filterVal.value.trim()
  if (!keyword) {
    filterColumns.value = props.columns.map((item) => ({ ...item }))
    return
  }
  filterColumns.value = props.columns
    .filter((item) => String(item[props.labelKey] || '').includes(keyword))
    .map((item) => ({ ...item }))
}

function handleFilterChange() {
  applyFilter()
}

function handleChange(value: any) {
  selectList.value = value
  emit('change', { value })
}

async function open() {
  emit('open')
  pickerShow.value = true
  selectList.value = isArray(props.modelValue) ? [...props.modelValue] : props.modelValue
  await nextTick()
  if (props.scrollIntoView) {
    setScrollIntoView()
  }
}

function setScrollIntoView() {
  const list = isArray(selectList.value) ? selectList.value : [selectList.value]
  const index = filterColumns.value.findIndex((item) => list.some((v) => String(v) === String(item[props.valueKey])))
  if (index > 0) {
    scrollTop.value = index * 44
  }
}

function close() {
  pickerShow.value = false
  emit('close')
  emit('cancel')
}

function onConfirm() {
  callInterceptor(props.beforeConfirm, {
    args: [selectList.value],
    done: () => {
      isConfirm.value = true
      pickerShow.value = false
      emit('update:modelValue', selectList.value)
      emit('confirm', { value: selectList.value, selectedItems: getSelectedItems() })
    }
  })
}

function getSelectedItems(): Record<string, any>[] {
  const list = isArray(selectList.value) ? selectList.value : [selectList.value]
  return props.columns.filter((item) => list.some((v) => String(v) === String(item[props.valueKey])))
}

defineExpose<SelectPickerExpose>({
  open,
  close
})
</script>

<template>
  <view :class="`wd-select-picker ${customClass}`" :style="parseStyle(customStyle)">
    <wd-popup
      v-model="pickerShow"
      position="bottom"
      :title="title || translate('title')"
      :close-on-click-modal="closeOnClickModal"
      :z-index="zIndex"
      :safe-area-inset-bottom="safeAreaInsetBottom"
      :root-portal="rootPortal"
      custom-class="wd-select-picker__popup"
      @cancel="close"
    >
      <view class="wd-select-picker__wraper">
        <view class="wd-select-picker__header">
          <text class="wd-select-picker__title">{{ title || translate('title') }}</text>
        </view>
        <wd-search
          v-if="filterable"
          v-model="filterVal"
          :placeholder="filterPlaceholder || translate('filterPlaceholder')"
          hide-cancel
          placeholder-left
          @change="handleFilterChange"
        />
        <scroll-view
          :class="`wd-select-picker__wrapper ${loading ? 'is-loading' : ''} ${customContentClass}`"
          :scroll-y="!loading"
          :scroll-top="scrollTop"
          :scroll-with-animation="true"
        >
          <view v-if="loading" class="wd-select-picker__loading">
            <wd-loading :color="loadingColor" />
          </view>
          <block v-else>
            <!-- 多选 -->
            <view v-if="isCheckbox" class="wd-select-picker__checkbox">
              <wd-checkbox-group
                v-model="checkboxValue"
                :size="selectSize"
                :checked-color="checkedColor"
                :min="min"
                :max="max"
                type="square"
                placement="right"
                @change="handleChange"
              >
                <view v-for="(item, index) in filterColumns" :key="index" class="wd-select-picker__checkbox-item">
                  <wd-checkbox :name="item[valueKey]" :disabled="item.disabled" custom-label-class="wd-select-picker__checkbox-label">
                    <text>{{ item[labelKey] }}</text>
                  </wd-checkbox>
                </view>
              </wd-checkbox-group>
            </view>
            <!-- 单选 -->
            <view v-else class="wd-select-picker__radio">
              <wd-radio-group v-model="radioValue" :checked-color="checkedColor" @change="handleChange">
                <view v-for="(item, index) in filterColumns" :key="index" class="wd-select-picker__radio-item">
                  <wd-radio :value="item[valueKey]" :disabled="item.disabled" placement="right">
                    <text>{{ item[labelKey] }}</text>
                  </wd-radio>
                </view>
              </wd-radio-group>
            </view>
          </block>
        </scroll-view>
        <view v-if="showConfirm" class="wd-select-picker__footer">
          <wd-button type="primary" block @tap="onConfirm">
            {{ confirmButtonText || translate('confirm') }}
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

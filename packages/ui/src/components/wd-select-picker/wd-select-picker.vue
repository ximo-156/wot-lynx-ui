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
import { useAlive } from '../../composables/useAlive'
import { isArray, isDef, parseStyle } from '../../common/util'
import { useTranslate } from '../../composables/useTranslate'

const { translate } = useTranslate('select-picker')

const props = defineProps(selectPickerProps)
const isAlive = useAlive()
const emit = defineEmits(['change', 'cancel', 'confirm', 'update:modelValue', 'open', 'close', 'update:visible'])

const pickerShow = ref<boolean>(false)
const selectList = ref<Array<string | number | boolean> | string | number | boolean>([])
const isConfirm = ref<boolean>(false)
const filterVal = ref<string>('')
const filterColumns = ref<Array<Record<string, any>>>([])
const scrollTop = ref<number>(0)

const isCheckbox = computed(() => props.type === 'checkbox')

/**
 * checkbox 模式值（数组视图）。
 *
 * setter 只同步状态、不发 change：change 统一经模板上 wd-checkbox-group 的
 * @change 派发一次（setter 与 @change 处理器各 emit 一次会导致每次勾选
 * 触发双倍 change）。
 */
const checkboxValue = computed<any[]>({
  get: () => (isArray(selectList.value) ? selectList.value : []),
  set: (val) => {
    selectList.value = val
  }
})

/** radio 模式值（单值视图）；同样只同步状态，change 经 @change 单发 */
const radioValue = computed<string | number | boolean>({
  get: () => (isArray(selectList.value) ? (selectList.value[0] ?? '') : selectList.value),
  set: (val) => {
    selectList.value = val
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

// 过滤关键字变化即应用过滤（含清空按钮）：wd-search 只 emit
// update:modelValue/clear/cancel/focus/blur/confirm，从不 emit 'change'，
// 此前 @change="handleFilterChange" 是死监听，filterable 搜索完全失效。
watch(
  () => filterVal.value,
  () => {
    applyFilter()
  }
)

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

function handleChange({ value }: any) {
  selectList.value = value
  emit('change', { value })
}

async function open() {
  emit('open')
  pickerShow.value = true
  selectList.value = isArray(props.modelValue) ? [...props.modelValue] : props.modelValue
  await nextTick()
  // nextTick 刷新前组件可能已卸载（打开后立刻摘除）
  if (!isAlive()) return
  if (props.scrollIntoView) {
    setScrollIntoView()
  }
}

function setScrollIntoView() {
  const list = isArray(selectList.value) ? selectList.value : [selectList.value]
  const index = filterColumns.value.findIndex((item) => list.some((v) => String(v) === String(item[props.valueKey])))
  if (index > 0) {
    // 行高按默认选项行高 44px 估算（组件未暴露 itemHeight prop，
    // 与默认样式中的行高保持一致；低优先，暂不加 prop）
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
      // beforeConfirm 可返回未决 Promise：期间组件/页面可能已卸载，
      // done 落地时不得在已销毁树上写 ref（真机 9902 晚到 patch 家族）。
      if (!isAlive()) return
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
      @close="close"
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
          <!-- 无渲染占位：uni-app 的 block 标签不是 Lynx 内置元素，编译后会走
               __CreateElement('block')，真机报 603 sub_code 60301
               "Can't find ui tag" 并崩掉整张卡片。这里用 Vue 的 template v-else
               （编译为 Fragment，不产生元素）。注释中禁止出现尖括号形式的
               template 字面量：会干扰 tag-transform loader 的模板块扫描。 -->
          <template v-else>
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
          </template>
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

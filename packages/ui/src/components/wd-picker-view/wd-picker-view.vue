/*
 * wd-picker-view — 选择器视图
 *
 * Lynx 实现说明：
 * - Lynx 无 picker-view 元素，本组件用 view + 手动触摸 + transform
 *   自研：内容平移、边缘阻尼、落位吸附（transition），与 slider 同范式
 *   （后台线程 ref 驱动，不用 Main Thread Script，CONVENTIONS §10）；
 * - 数据逻辑（列格式化 / 选中索引 / 级联构建）在 composables/useSelection，
 *   本组件只负责触摸与渲染；
 * - 禁用项自动就近迁移（correctSelectedIndex）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, ref, watch } from 'vue-lynx'
import { pickerViewProps, type PickerOption, type PickerViewExpose } from './types'
import { useSelection } from '../../composables/useSelection'
import { addUnit, isArray, isDef, isEqual, isObj } from '../../common/util'

const props = defineProps(pickerViewProps)
const emit = defineEmits(['change', 'pickstart', 'pickend', 'update:modelValue'])

const {
  formatColumns,
  selectedIndex,
  selectedOptions,
  selectedValues,
  selectedLabels,
  selectWithValue,
  correctSelected,
  getChangeColumnIndex,
  getColumnIndex,
  getColumnData,
  getColumnsData,
  buildCascadeColumns,
  updateCascadeColumns,
  resetColumns
} = useSelection({
  valueKey: props.valueKey,
  labelKey: props.labelKey,
  childrenKey: props.childrenKey,
  cascade: props.cascade
})

watch(
  [() => props.modelValue, () => props.columns, () => props.cascade],
  (newValue, oldValue) => {
    const [newModelValue, newColumns, newCascade] = newValue
    const [, oldColumns] = oldValue

    if (!isEqual(oldColumns, newColumns)) {
      resetColumns(newColumns)
      if (newCascade && isDef(newModelValue) && (newModelValue as any[]).length > 0 && (newColumns as any[]).length > 0) {
        formatColumns.value = buildCascadeColumns(newColumns as PickerOption[], newModelValue as any[])
      }
    }
    if (isDef(newModelValue)) {
      selectWithValue(newModelValue)
    }
  },
  { immediate: true, deep: true }
)

/** 单列几何 */
const padHeight = computed(() => ((props.visibleItemCount - 1) / 2) * props.itemHeight)
const containerHeight = computed(() => props.itemHeight * props.visibleItemCount)

/** 每列当前位移（px）与过渡开关 */
const offsets = ref<number[]>([])
const transitions = ref<boolean[]>([])

watch(
  selectedIndex,
  (indexes) => {
    indexes.forEach((idx, col) => {
      if (offsets.value[col] === undefined || Math.abs(offsets.value[col] - idx * props.itemHeight) > 0.5) {
        if (!dragging.value[col]) {
          offsets.value[col] = idx * props.itemHeight
        }
      }
    })
  },
  { immediate: true, deep: true }
)

/** 每列拖动状态 */
const dragging = ref<boolean[]>([])
const dragStart = ref<Array<{ y: number; offset: number }>>([])

const pickerViewStyle = computed(() => `height: ${addUnit(containerHeight.value)};`)

function columnTransform(colIndex: number): string {
  const offset = offsets.value[colIndex] || 0
  return `transform: translateY(${-offset}px);${transitions.value[colIndex] ? 'transition: transform 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);' : ''}`
}

function getItemClass(disabled: boolean | undefined, colIndex: number, rowIndex: number): string {
  const classes = ['wd-picker-view__column-item']
  if (disabled) classes.push('wd-picker-view__column-item--disabled')
  if (selectedIndex.value[colIndex] === rowIndex) classes.push('wd-picker-view__column-item--active')
  return classes.join(' ')
}

/** 列内容最大位移 */
function maxOffset(colIndex: number): number {
  const count = formatColumns.value[colIndex]?.length || 0
  return Math.max(0, (count - 1) * props.itemHeight)
}

/** 由位移反推索引（含禁用项修正） */
function offsetToIndex(colIndex: number, offset: number): number {
  const count = formatColumns.value[colIndex]?.length || 0
  if (count === 0) return 0
  let index = Math.round(offset / props.itemHeight)
  index = Math.min(Math.max(index, 0), count - 1)
  return index
}

function onTouchStart(event: any, colIndex: number) {
  dragging.value[colIndex] = true
  transitions.value[colIndex] = false
  const y = Number(event.touches?.[0]?.clientY ?? event.detail?.y ?? 0)
  dragStart.value[colIndex] = { y, offset: offsets.value[colIndex] || 0 }
  emit('pickstart')
}

function onTouchMove(event: any, colIndex: number) {
  if (!dragging.value[colIndex]) return
  const y = Number(event.touches?.[0]?.clientY ?? event.detail?.y ?? 0)
  const start = dragStart.value[colIndex]
  if (!start) return
  let offset = start.offset - (y - start.y)
  const max = maxOffset(colIndex)
  // 边缘阻尼
  if (offset < 0) offset = offset * 0.3
  if (offset > max) offset = max + (offset - max) * 0.3
  offsets.value[colIndex] = offset

  if (props.immediateChange) {
    const index = offsetToIndex(colIndex, Math.min(Math.max(offset, 0), max))
    if (selectedIndex.value[colIndex] !== index) {
      const next = [...selectedIndex.value]
      next[colIndex] = index
      selectedIndex.value = correctSelected(next)
      emitChange(getChangeColumnIndex(selectedIndex.value, next))
    }
  }
}

function onTouchEnd(colIndex: number) {
  if (!dragging.value[colIndex]) return
  dragging.value[colIndex] = false
  transitions.value[colIndex] = true
  const max = maxOffset(colIndex)
  const offset = Math.min(Math.max(offsets.value[colIndex] || 0, 0), max)
  const index = offsetToIndex(colIndex, offset)
  offsets.value[colIndex] = index * props.itemHeight

  const origin = [...selectedIndex.value]
  const next = [...selectedIndex.value]
  next[colIndex] = index
  selectedIndex.value = correctSelected(next)
  // 禁用项迁移后位移跟随
  offsets.value[colIndex] = selectedIndex.value[colIndex] * props.itemHeight
  emit('pickend')
  emitChange(getChangeColumnIndex(selectedIndex.value, origin))
}

function emitChange(columnIndex: number) {
  if (isEqual(selectedValues.value, props.modelValue)) return
  emit('update:modelValue', selectedValues.value)
  nextTick(() => {
    emit('change', {
      selectedValues: selectedValues.value,
      selectedOptions: selectedOptions.value,
      selectedLabels: selectedLabels.value,
      selectedIndexes: selectedIndex.value,
      columnIndex
    })
  })
}

/** 级联：外部 columns 为树形时由使用方驱动，此处仅保留数据出口 */
function getSelectedIndex(): number[] {
  return selectedIndex.value
}

defineExpose<PickerViewExpose>({
  getSelectedOptions: () => selectedOptions.value as PickerOption[],
  getSelectedValues: () => selectedValues.value,
  getColumnsData,
  getColumnData,
  getColumnIndex,
  getSelectedLabels: () => selectedLabels.value,
  getSelectedIndex
})
</script>

<template>
  <view :class="`wd-picker-view ${customClass}`" :style="customStyle">
    <view class="wd-picker-view__main" :style="pickerViewStyle">
      <!-- 选中指示带 -->
      <view class="wd-picker-view__indicator" :style="`top: ${padHeight}px; height: ${itemHeight}px;`" />
      <!-- 上下遮罩 -->
      <view class="wd-picker-view__mask wd-picker-view__mask--top" :style="`height: ${padHeight}px;`" />
      <view class="wd-picker-view__mask wd-picker-view__mask--bottom" :style="`height: ${padHeight}px;`" />

      <view
        v-for="(col, colIndex) in formatColumns"
        :key="colIndex"
        class="wd-picker-view__column"
        @touchstart="onTouchStart($event, colIndex)"
        @touchmove="onTouchMove($event, colIndex)"
        @touchend="onTouchEnd(colIndex)"
        @touchcancel="onTouchEnd(colIndex)"
      >
        <view class="wd-picker-view__column-content" :style="columnTransform(colIndex)">
          <view class="wd-picker-view__column-pad" :style="`height: ${padHeight}px;`" />
          <view
            v-for="(row, rowIndex) in col"
            :key="rowIndex"
            :class="getItemClass(row['disabled'], colIndex, rowIndex)"
            :style="`height: ${itemHeight}px;`"
          >
            <text class="wd-picker-view__column-label">{{ row[labelKey] }}</text>
          </view>
          <view class="wd-picker-view__column-pad" :style="`height: ${padHeight}px;`" />
        </view>
      </view>
    </view>
  </view>
</template>

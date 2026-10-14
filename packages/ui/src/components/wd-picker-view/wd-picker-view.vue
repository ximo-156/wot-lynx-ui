/*
 * wd-picker-view — 选择器视图
 *
 * Lynx 适配说明：
 * 1. Lynx 无 picker-view / picker-view-column 元素，滚轮改用 view + scroll-view 自研：
 *    - 每列一个 scroll-view（class wd-picker-view__column，固定高度 itemHeight * visibleItemCount，
 *      隐藏滚动条），列内选项等高（高度与行高均取 itemHeight）；
 *    - 列内容上下各占位 (visibleItemCount - 1) / 2 * itemHeight 的内边距，
 *      因此 scroll-top = index * itemHeight 时选中项恰好落在中部指示条内；
 *    - 滚动过程中监听 scroll 事件记录 scrollTop；滚动结束（scrollend）时按 scrollTop
 *      取最近下标，通过 scroll-top + scroll-with-animation 滚动吸附到该项。
 * 2. 中部指示条（wd-picker-view__roller）与顶部/底部渐变遮罩（wd-picker-view__mask）
 *    均为绝对定位 view。原实现按首末列给指示条分段设置圆角（依赖 :first-child / :last-child，
 *    Lynx 不支持），自研实现将指示条合并为一条满幅 view，由单条满幅圆角等价呈现，
 *    详见 index.scss 中的适配注释。层级：roller(0) < column(1) < mask(2)。
 * 3. 禁用项跳过：吸附时若最近下标为禁用项，先用 useSelection 的 correctSelectedIndex
 *    修正到最近可用项，再滚动吸附到修正后的位置（与 wot-ui 行为一致）。
 * 4. pickstart / pickend 无原生对应事件：用 scroll 事件的首次触发模拟 pickstart，
 *    scrollend（滚动完全停止）时发 pickend；immediate-change 用 touchend 近似
 *    "手指松开立即触发 change"（Lynx 无原生 pickend 时机，若 touch 事件不可用则
 *    自动降级为滚动结束后触发，功能不受影响）。另设看门定时器：scrollend 因异常
 *    （滚动中弹层关闭、节点销毁）未触发时强制补发 pickend，避免消费组件确认逻辑卡死。
 * 5. data-no-touch-simulate 为小程序专有属性（Lynx __SetAttribute 不支持），已移除。
 */
<template>
  <view :class="`wd-picker-view ${customClass}`" :style="styleToObject(customStyle)">
    <view class="wd-picker-view__main" :style="styleToObject(mainStyle)">
      <!-- 中部指示条：置于列之下，避免遮挡滚动内容 -->
      <view class="wd-picker-view__roller" :style="styleToObject(rollerStyle)" />
      <scroll-view
        v-for="(col, colIndex) in formatColumns"
        :key="colIndex"
        class="wd-picker-view__column"
        :style="styleToObject(getColumnStyle())"
        :scroll-y="true"
        :show-scrollbar="false"
        :scroll-top="scrollTops[colIndex]"
        :scroll-with-animation="scrollAnimating[colIndex]"
        @scroll="onScroll(colIndex, $event)"
        @scrollend="onScrollEnd(colIndex, $event)"
        @touchend="onColumnTouchEnd(colIndex)"
        @touchcancel="onColumnTouchEnd(colIndex)"
      >
        <!-- 上下占位 padding 保证首末项可滚动至中部 -->
        <view :style="styleToObject(getColumnContentStyle())">
          <view
            v-for="(row, rowIndex) in col"
            :key="rowIndex"
            :class="getItemClass(row['disabled'], colIndex, rowIndex)"
            :style="styleToObject(getItemStyle())"
          >
            <text>{{ row[labelKey] }}</text>
          </view>
        </view>
      </scroll-view>
    </view>
    <!-- 顶部/底部渐变遮罩 -->
    <view class="wd-picker-view__mask" :style="styleToObject(maskStyle)" />
  </view>
</template>

<script setup lang="ts">
import './index.css'
import { watch, nextTick, computed, ref, onBeforeUnmount } from 'vue-lynx'
import { styleToObject, addUnit, isDef, isEqual, isArray, isObj, range } from '../../common/util'
import { pickerViewProps, type PickerViewExpose, type PickerOption } from './types'

import { useSelection } from './useSelection'
import { type Numeric } from '../../common/props'

const props = defineProps(pickerViewProps)
const emit = defineEmits(['change', 'pickstart', 'pickend', 'update:modelValue'])

// 使用 selection hooks 管理数据处理逻辑
const {
  formatColumns,
  selectedIndex,
  selectedOptions,
  selectedValues,
  selectedLabels,
  selectWithValue,
  correctSelectedIndex,
  getChangeColumnIndex,
  getColumnIndex,
  getColumnData,
  getColumnsData,
  resetColumns,
  buildCascadeColumns,
  updateCascadeColumns
} = useSelection(props.valueKey, props.labelKey, props.childrenKey, props.cascade)

/**
 * 每列滚动位置（scroll-top，单位 px）
 */
const scrollTops = ref<number[]>([])
/**
 * 每列下一次 scroll-top 变化是否带动画
 */
const scrollAnimating = ref<boolean[]>([])
/**
 * 每列最近一次滚动到的位置（scroll 事件可能被节流，scrollend 时以此为准）
 */
const lastScrollTops = ref<number[]>([])
/**
 * 每列是否正在滚动（用于 pickstart / pickend 模拟）
 */
const isScrolling = ref<boolean[]>([])
/**
 * 正在滚动的列数
 */
const scrollingCount = ref<number>(0)
/**
 * 已同步过滚动位置的选中下标，避免自洽更新重复触发滚动
 */
const syncedIndex = ref<number[]>([])

watch(
  [() => props.modelValue, () => props.columns, () => props.cascade],
  (newValue, oldValue) => {
    const [newModelValue, newColumns, newCascade] = newValue
    const [, oldColumns] = oldValue

    // 列数据变化时重置
    if (!isEqual(oldColumns, newColumns)) {
      resetColumns(newColumns)

      // 级联模式且有选中值：构建多列数据
      if (newCascade && isDef(newModelValue) && (newModelValue as any[]).length > 0 && newColumns.length > 0) {
        const cascadeColumns = buildCascadeColumns(newColumns as PickerOption[], newModelValue as any[])
        formatColumns.value = cascadeColumns
      }
    }

    // modelValue 变化时更新选中
    if (isDef(newModelValue)) {
      selectWithValue(newModelValue)
    }
  },
  {
    immediate: true,
    deep: true
  }
)

// 选中下标变化时同步各列滚动位置（外部修改 modelValue / 列数据变化时无动画直达）
watch(
  selectedIndex,
  (value) => {
    value.forEach((index, colIndex) => {
      if (syncedIndex.value[colIndex] !== index) {
        scrollToColumn(colIndex, index, false)
      }
    })
  },
  {
    immediate: true,
    deep: true
  }
)

// 选项高度 / 可见数量变化时重新计算各列位置
watch(
  [() => props.itemHeight, () => props.visibleItemCount],
  () => {
    syncedIndex.value = []
    selectedIndex.value.forEach((index, colIndex) => {
      scrollToColumn(colIndex, index, false)
    })
  }
)

/**
 * 中部内容区高度（与 wot-ui pickerViewStyle 一致）
 */
const mainStyle = computed(() => {
  return {
    display: 'flex',
    'flex-direction': 'row',
    position: 'relative',
    height: addUnit(props.itemHeight * props.visibleItemCount)
  }
})

/**
 * 列内容上下占位高度：使选中项可滚动至中部
 */
const getColumnPadding = () => {
  return (props.itemHeight * props.visibleItemCount - props.itemHeight) / 2
}

/**
 * 获取列的样式
 */
function getColumnStyle() {
  return {
    height: addUnit(props.itemHeight * props.visibleItemCount),
    position: 'relative',
    // z-index 使用字符串，避免运行时按数值自动补 px 单位
    'z-index': '1'
  }
}

/**
 * 获取列内容（占位 + 选项）的样式
 */
function getColumnContentStyle() {
  const padding = addUnit(getColumnPadding())
  return {
    'padding-top': padding,
    'padding-bottom': padding
  }
}

/**
 * 获取选项的样式
 */
function getItemStyle() {
  return {
    height: addUnit(props.itemHeight),
    'line-height': addUnit(props.itemHeight)
  }
}

/**
 * 中部指示条样式：垂直居中、高度为一项
 */
const rollerStyle = computed(() => {
  return {
    position: 'absolute',
    top: addUnit(getColumnPadding()),
    left: '0',
    right: '0',
    height: addUnit(props.itemHeight),
    'z-index': '0'
  }
})

/**
 * 遮罩样式：覆盖整个选择器，位于最上层但不拦截触摸
 */
const maskStyle = computed(() => {
  return {
    // z-index 使用字符串，避免运行时按数值自动补 px 单位
    'z-index': '2'
  }
})

/**
 * 获取 column item 的类名
 * @param disabled 是否禁用
 * @param colIndex 列索引
 * @param rowIndex 行索引
 */
function getItemClass(disabled: boolean | undefined, colIndex: number, rowIndex: number) {
  const classes = ['wd-picker-view__column-item']
  if (disabled) {
    classes.push('wd-picker-view__column-item--disabled')
  }
  if (selectedIndex.value[colIndex] === rowIndex) {
    classes.push('wd-picker-view__column-item--active')
  }
  return classes.join(' ')
}

/**
 * 将指定列滚动到指定下标处
 * @param colIndex 列索引
 * @param index 目标下标
 * @param animated 是否带动画
 */
function scrollToColumn(colIndex: number, index: number, animated: boolean) {
  const top = index * props.itemHeight
  scrollAnimating.value[colIndex] = animated
  scrollTops.value[colIndex] = top
  lastScrollTops.value[colIndex] = top
  syncedIndex.value[colIndex] = index
}

/**
 * 滚动过程中记录位置；首次滚动模拟 pickstart
 * @param colIndex 列索引
 * @param event 滚动事件
 */
function onScroll(colIndex: number, event: any) {
  const scrollTop = event && event.detail && event.detail.scrollTop
  if (isDef(scrollTop)) {
    lastScrollTops.value[colIndex] = Number(scrollTop)
  }
  if (!isScrolling.value[colIndex]) {
    isScrolling.value[colIndex] = true
    scrollingCount.value++
    emitPickStart()
  }
}

/**
 * 滚动结束：吸附到最近项并触发 change
 * @param colIndex 列索引
 * @param event 滚动结束事件
 */
function onScrollEnd(colIndex: number, event: any) {
  const scrollTop = event && event.detail && event.detail.scrollTop
  if (isDef(scrollTop)) {
    lastScrollTops.value[colIndex] = Number(scrollTop)
  }
  if (isScrolling.value[colIndex]) {
    isScrolling.value[colIndex] = false
    scrollingCount.value = Math.max(0, scrollingCount.value - 1)
  }
  settleColumn(colIndex)
  if (scrollingCount.value === 0) {
    emitPickEnd()
  }
}

/**
 * 触摸结束（Lynx 无原生 pickend 时机，用于 immediate-change 与纯点击场景）
 * @param colIndex 列索引
 */
function onColumnTouchEnd(colIndex: number) {
  // immediate-change：手指松开立即触发 change
  if (props.immediateChange) {
    settleColumn(colIndex)
  }
  // 未产生滚动（纯点击）时补发 pickend，scrollend 不会触发
  if (scrollingCount.value === 0) {
    emitPickEnd()
  }
}

/**
 * 滚动停止后的选中逻辑：取最近下标 -> 禁用项修正 -> 吸附 -> 触发 change
 * @param colIndex 列索引
 */
function settleColumn(colIndex: number) {
  const col = formatColumns.value[colIndex]
  if (!col || col.length === 0) return

  // 取最近的下标（列内容有占位 padding，scrollTop 与下标呈线性关系）
  const rawIndex = range(Math.round((lastScrollTops.value[colIndex] || 0) / props.itemHeight), 0, col.length - 1)

  const origin = [...selectedIndex.value]
  // 修正选中项：越界已钳制，禁用项交由 correctSelectedIndex 跳到最近可用项
  const corrected = correctSelectedIndex(colIndex, rawIndex, origin)
  const columnIndex = getChangeColumnIndex(corrected, origin)
  const needsSnap = Math.abs((lastScrollTops.value[colIndex] || 0) - corrected[colIndex] * props.itemHeight) > 0.5

  // 无选中变化且位置已就位，无需处理（如程序触发 scroll-top 后的 scrollend）
  if (columnIndex === -1 && !needsSnap) return

  selectedIndex.value = corrected

  // 级联模式：自动更新后续列
  if (props.cascade && columnIndex !== -1 && props.columns.length > 0) {
    // 判断是否为树形数据
    const firstColumn = props.columns[0]
    if (!isArray(firstColumn) && isObj(firstColumn)) {
      updateCascadeColumns(props.columns as PickerOption[], columnIndex, corrected)
    }
  }

  // 吸附到修正后的位置
  scrollToColumn(colIndex, corrected[colIndex], needsSnap)

  if (columnIndex !== -1) {
    handleChange(columnIndex)
  }
}

/**
 * 触发 change 事件
 * @param columnIndex 列索引
 */
function handleChange(columnIndex: number) {
  // 避免多次触发change
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

let picking = false
/**
 * pickstart 后的看门定时器：若 scrollend 因异常未触发（如滚动中弹层关闭、
 * 节点被销毁），超时后强制结束 picking，避免消费组件的确认逻辑被卡死。
 */
let pickWatchdog: ReturnType<typeof setTimeout> | null = null

/**
 * 滚动开始（模拟 pickstart，避免重复触发）
 */
function emitPickStart() {
  if (picking) return
  picking = true
  if (pickWatchdog) clearTimeout(pickWatchdog)
  pickWatchdog = setTimeout(() => {
    pickWatchdog = null
    if (!picking) return
    isScrolling.value = []
    scrollingCount.value = 0
    emitPickEnd()
  }, 1200)
  emit('pickstart')
}

/**
 * 滚动结束（模拟 pickend，避免重复触发）
 */
function emitPickEnd() {
  if (pickWatchdog) {
    clearTimeout(pickWatchdog)
    pickWatchdog = null
  }
  if (!picking) return
  picking = false
  emit('pickend')
}

/**
 * 获取选中数据
 * @returns {number[]} 选中值索引数组
 */
function getSelectedIndex(): number[] {
  return selectedIndex.value
}

/**
 * 获取所有列选中项
 * @returns {PickerOption[]} 选中项
 */
function getSelectedOptions(): PickerOption[] {
  return selectedOptions.value
}

/**
 * 获取所有列的选中值
 * @returns {Numeric[]} 选中值
 */
function getSelectedValues(): Numeric[] {
  return selectedValues.value
}

/**
 * 获取所有列选中项的label，返回值为一个数组
 * @returns {string[]} label数组
 */
function getSelectedLabels(): string[] {
  return selectedLabels.value
}

defineExpose<PickerViewExpose>({
  getSelectedOptions,
  getSelectedValues,
  getColumnsData,
  getColumnData,
  getColumnIndex,
  getSelectedLabels,
  getSelectedIndex,
  resetColumns
})

onBeforeUnmount(() => {
  if (pickWatchdog) {
    clearTimeout(pickWatchdog)
    pickWatchdog = null
  }
})
</script>

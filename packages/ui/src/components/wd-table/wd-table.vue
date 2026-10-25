/*
 * wd-table — 表格
 *
 * Lynx 无 CSS Grid/display:contents：表头为 flex 行，列保留组件实例，
 * 单元格按父表共享行轨道定位。自然行高由内容度量同步，合并格不挤压下一行。
 * 子列用原始 props 快照注册，避免父渲染追踪子 props 造成递归更新；排序状态
 * 仍使用子列官方 expose 的 sortDirection ref，不在表内自动排序业务数据。
 * scroll-view 负责原生滚动；热路径仅更新滚动偏移，不测量节点。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onBeforeUnmount, reactive, shallowReactive, toRaw, watch, type Ref } from 'vue-lynx'
import WdSortButton from '../wd-sort-button/wd-sort-button.vue'
import WdTableColumn from '../wd-table-column/wd-table-column.vue'
import { addUnit, isDef, isObj, parseStyle, throttle, uuid } from '../../common/util'
import { useChildren } from '../../composables/useChildren'
import { useTranslate } from '../../composables/useTranslate'
import type { SortDirection, TableColumnInstance, TableColumnProps } from '../wd-table-column/types'
import { TABLE_KEY, tableProps, type TableProvide } from './types'
import { normalizeTableSpan, resolveTableRows, type TableCellMeasure } from './layout'

const props = defineProps(tableProps)
const emit = defineEmits(['sort-method', 'row-click'])
const { translate } = useTranslate('tableCol')
const state = reactive({ scrollLeft: 0, scrollTop: 0 })
const { linkChildren, children, internalChildren } = useChildren<TableColumnInstance, TableProvide>(TABLE_KEY)
const registrations = shallowReactive(new Map<number, { props: TableColumnProps; direction: Ref<SortDirection> }>())
const measurements = shallowReactive(new Map<string, TableCellMeasure>())
const columns = computed(() => internalChildren.map((child) => {
  const raw = toRaw(child)
  const registered = registrations.get(raw.uid)
  // 注册在 useParent.link 后完成；空列不参与计算，避免首次渲染读未完成的 expose。
  return registered ? { uid: raw.uid, ...registered.props, direction: registered.direction } : null
}).filter((column): column is NonNullable<typeof column> => column !== null))
function registerColumn(uid: number, column: TableColumnProps, direction: Ref<SortDirection>) {
  const old = registrations.get(uid)
  if (old && Object.keys(column).every((key) => old.props[key as keyof TableColumnProps] === column[key as keyof TableColumnProps])) return
  registrations.set(uid, { props: { ...column }, direction })
}
function unregisterColumn(uid: number) {
  registrations.delete(uid)
  for (const key of measurements.keys()) if (key.startsWith(`${uid}:`)) measurements.delete(key)
}
const rowHeight = computed(() => {
  const height = Number(addUnit(props.rowHeight).replace(/px$/, ''))
  return Number.isFinite(height) && height > 0 ? height : 44
})
const visibleRange = computed(() => {
  const count = Array.isArray(props.data) ? props.data.length : 0
  if (!props.virtual || count === 0) return { start: 0, end: count - 1 }
  const numericHeight = isDef(props.height) ? Number(addUnit(props.height).replace(/px$/, '')) : NaN
  const viewport = Number.isFinite(numericHeight) && numericHeight >= 0 ? numericHeight : 400
  // 与官方公式兼容（buffer=0 官方仍回落 5）；非法负值防止越界。
  const buffer = Math.max(0, Number(props.buffer) || 5)
  const start = Math.min(count - 1, Math.max(0, Math.floor(state.scrollTop / rowHeight.value) - buffer))
  const end = Math.min(count - 1, Math.ceil((state.scrollTop + viewport) / rowHeight.value) + buffer)
  return { start, end: Math.max(start, end) }
})
const tracks = computed(() => resolveTableRows(Array.isArray(props.data) ? props.data.length : 0, rowHeight.value, props.virtual, [...measurements.values()]))
const bodyHeight = computed(() => tracks.value.total)
const getRowTop = (rowIndex: number) => tracks.value.offsets[rowIndex] || 0
function getCellHeight(rowIndex: number, rowspan: number) {
  const offsets = tracks.value.offsets
  const end = Math.min(offsets.length - 1, rowIndex + Math.max(1, rowspan))
  return (offsets[end] || 0) - (offsets[rowIndex] || 0)
}
function reportCellHeight(uid: number, rowIndex: number, rowspan: number, height: number) {
  if (props.virtual || !registrations.has(uid) || !Number.isFinite(height) || height <= 0) return
  const key = `${uid}:${rowIndex}`
  const old = measurements.get(key)
  if (!old || old.rowspan !== rowspan || Math.abs(old.height - height) > 0.5) measurements.set(key, { rowIndex, rowspan, height })
}
watch([() => props.data, () => props.ellipsis, () => props.spanMethod, () => props.virtual], () => measurements.clear(), { deep: true })
const widths = computed(() => columns.value.map((column) => addUnit(column.width)))
const widthSum = (parts: string[]) => parts.length === 0 ? '0px' : parts.length === 1 ? parts[0] : `calc(${parts.join(' + ')})`
const contentStyle = computed(() => ({ width: widthSum(widths.value) }))
const getFixedLeft = (index: number) => index <= 0 ? '0px' : widthSum(widths.value.slice(0, index))
const getSpanWidth = (index: number, colspan: number) => widthSum(widths.value.slice(index, index + colspan))
const lastFixedProp = computed(() => {
  const fixed = columns.value.filter((column) => column.fixed)
  return fixed[fixed.length - 1]?.prop
})
const getIsLastFixed = (column: { fixed: boolean; prop: string }) => column.fixed && column.prop === lastFixedProp.value
function getSpan(rowIndex: number, columnIndex: number) {
  const column = columns.value[columnIndex]
  if (!column || !props.data[rowIndex] || typeof props.spanMethod !== 'function') return { rowspan: 1, colspan: 1 }
  return normalizeTableSpan(props.spanMethod({ row: props.data[rowIndex], column: { prop: column.prop, label: column.label }, rowIndex, columnIndex }))
}
function rowClick(index: number) { emit('row-click', { rowIndex: index }) }
linkChildren({ props, state, visibleRange, rowClick, getIsLastFixed, getFixedLeft, getSpan, registerColumn, unregisterColumn, bodyHeight, getRowTop, getCellHeight, getSpanWidth, reportCellHeight })
const indexUUID = uuid()
const indexColumn = computed<TableColumnProps>(() => ({ label: translate('indexLabel'), width: '100rpx', sortable: false, fixed: false, align: 'left', ...(isObj(props.index) ? props.index : {}), prop: indexUUID }))
const showIndex = computed(() => props.index !== false)
const scrollY = computed(() => isDef(props.height))
const scrollStyle = computed(() => ({ maxHeight: isDef(props.height) ? addUnit(props.height) : 'none' }))
function handleScroll(event: any) {
  const detail = event?.detail || {}
  if (Number.isFinite(Number(detail.scrollLeft))) state.scrollLeft = Number(detail.scrollLeft)
  if (props.virtual && Number.isFinite(Number(detail.scrollTop))) state.scrollTop = Math.max(0, Number(detail.scrollTop))
}
const handleScrollThrottled = throttle(handleScroll, 16) as ((event: any) => void) & { cancel?: () => void }
onBeforeUnmount(() => handleScrollThrottled.cancel?.())
function headerStyle(index: number) {
  const column = columns.value[index]
  return { width: widths.value[index], left: column?.fixed ? getFixedLeft(index) : 'auto' }
}
function handleSortChange(value: SortDirection, uid: number) {
  const current = columns.value.find((column) => column.uid === uid)
  if (!current || !current.sortable) return
  for (const column of columns.value) column.direction.value = column.uid === uid ? value : 0
  const { prop, label, width, sortable, fixed, align } = current
  emit('sort-method', { prop, label, width, sortable, align, sortDirection: value, fixed })
}
</script>

<template>
  <view :class="['wd-table', { 'is-border': border }, customClass]" :style="parseStyle(customStyle)">
    <scroll-view :scroll-x="true" :scroll-y="scrollY" :style="scrollStyle" @scroll="handleScrollThrottled">
      <view class="wd-table__content" :style="contentStyle">
        <view v-if="showHeader" :class="['wd-table__header', { 'is-sticky': fixedHeader }]">
          <!-- 斑马纹按参考源语义只作用于数据行；表头误挂 is-stripe 会让
               表头永远渲染成斑马纹灰底（stripe 默认 true） -->
          <view v-for="(column, index) in columns" :key="column.uid"
            :class="['wd-table__cell', 'wd-table__cell--header', { 'is-border': border, 'is-fixed': column.fixed, 'is-shadow': getIsLastFixed(column) && state.scrollLeft, 'is-last': index === columns.length - 1 }, `is-${column.align}`]"
            :style="headerStyle(index)">
            <WdSortButton v-if="column.sortable" :model-value="column.direction.value" allow-reset :line="false" :title="column.label" @change="({ value }) => handleSortChange(value, column.uid)" />
            <text v-else :class="['wd-table__value', { 'is-ellipsis': ellipsis }]" :text-maxline="ellipsis ? 2 : undefined">{{ column.label }}</text>
            <view v-if="getIsLastFixed(column) && state.scrollLeft" class="wd-table__shadow" />
          </view>
        </view>
        <view class="wd-table__body" :style="{ height: `${bodyHeight}px` }">
          <WdTableColumn v-if="showIndex" v-bind="indexColumn">
            <template #value="{ index }"><text>{{ index + 1 }}</text></template>
          </WdTableColumn>
          <slot />
        </view>
      </view>
    </scroll-view>
  </view>
</template>

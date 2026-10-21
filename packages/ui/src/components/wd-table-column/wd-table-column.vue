/*
 * wd-table-column — 表格列
 *
 * 官方 #value 插槽传完整 row 与数据索引，sortDirection ref 保持 expose。
 * Lynx 无 Grid：列根为共享行轨道的定位容器，合并格按真实起始行及跨度定位；
 * 跳过隐藏格仍保留后续行位置。自然内容度量不在 scroll 热路径执行。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, onUpdated, ref, watch } from 'vue-lynx'
import { addUnit, getRect, isOdd } from '../../common/util'
import { tableColumnProps, type SortDirection } from './types'
import { useParent } from '../../composables/useParent'
import { TABLE_KEY } from '../wd-table/types'

const props = defineProps(tableColumnProps)
const emit = defineEmits(['layoutchange'])
const uid = getCurrentInstance()!.uid
const contentClass = `wd-table-column-${uid}-content`
const { parent: table, index: columnIndex } = useParent(TABLE_KEY)
const sortDirection = ref<SortDirection>(0)
watch(() => [props.prop, props.label, props.width, props.sortable, props.fixed, props.align], () => {
  table.value?.registerColumn?.(uid, { prop: props.prop, label: props.label, width: props.width, sortable: props.sortable, fixed: props.fixed, align: props.align }, sortDirection)
}, { immediate: true, flush: 'sync' })
const isVirtual = computed(() => Boolean(table.value?.props.virtual))
const ellipsis = computed(() => Boolean(table.value?.props.ellipsis))
const columnStyle = computed(() => ({ width: addUnit(props.width), height: `${table.value?.bodyHeight?.value || 0}px`, left: props.fixed ? table.value?.getFixedLeft(columnIndex.value) || '0px' : 'auto' }))
const cellConfigs = computed(() => {
  const parent = table.value
  const data = parent?.props.data || []
  const range = parent?.visibleRange.value || { start: 0, end: -1 }
  const configs = []
  for (let rowIndex = range.start; rowIndex <= range.end && rowIndex < data.length; rowIndex++) {
    const span = parent?.getSpan(rowIndex, columnIndex.value) || { rowspan: 1, colspan: 1 }
    if (!span.rowspan || !span.colspan) continue
    const shadow = Boolean(props.fixed && parent?.getIsLastFixed(props) && parent.state.scrollLeft)
    const height = parent?.getCellHeight?.(rowIndex, span.rowspan)
    configs.push({
      rowIndex, rowspan: span.rowspan, colspan: span.colspan, value: data[rowIndex]?.[props.prop], shadow,
      class: ['wd-table__cell', { 'is-stripe': parent?.props.stripe && isOdd(rowIndex), 'is-border': parent?.props.border, 'is-fixed': props.fixed, 'is-shadow': shadow, 'is-last': columnIndex.value + span.colspan >= (parent?.children.length || 0), 'is-last-row': rowIndex + span.rowspan >= data.length }, `is-${props.align}`],
      style: { width: parent?.getSpanWidth?.(columnIndex.value, span.colspan) || addUnit(props.width), top: `${parent?.getRowTop?.(rowIndex) || 0}px`, height: height == null ? 'auto' : `${height}px`, left: '0px', zIndex: span.colspan > 1 ? '1' : 'auto' }
    })
  }
  return configs
})
function rowScope(index: number) { return table.value?.props.data[index] || {} }
function rowClick(index: number) { table.value?.rowClick(index) }
function onContentLayout(config: { rowIndex: number; rowspan: number }, event: any) {
  if (!alive || isVirtual.value) return
  const height = Number(event?.detail?.height ?? event?.detail?.layout?.height)
  if (height > 0) table.value?.reportCellHeight?.(uid, config.rowIndex, config.rowspan, height)
  emit('layoutchange', event)
}
let alive = true
let request = 0
let queued = false
function queueMeasure() {
  if (queued || !alive || isVirtual.value) return
  queued = true
  const token = ++request
  nextTick(async () => {
    queued = false
    if (!alive || token !== request || isVirtual.value) return
    const configs = cellConfigs.value
    const rects = await getRect(`.${contentClass}`, true)
    if (!alive || token !== request || isVirtual.value) return
    if (Array.isArray(rects)) configs.forEach((config, index) => {
      const height = Number(rects[index]?.height)
      if (height > 0) table.value?.reportCellHeight?.(uid, config.rowIndex, config.rowspan, height)
    })
  })
}
watch([() => props.prop, () => props.width, () => table.value?.props.data, () => table.value?.props.ellipsis, () => table.value?.props.spanMethod, () => table.value?.props.virtual], queueMeasure, { deep: true, flush: 'post' })
let lastScrollLeft = 0
let lastScrollTop = 0
onMounted(queueMeasure)
onUpdated(() => {
  // scroll 驱动的阴影/可视窗口更新不用发 SelectorQuery。
  const left = table.value?.state.scrollLeft || 0
  const top = (table.value?.state as { scrollTop?: number })?.scrollTop || 0
  if (left === lastScrollLeft && top === lastScrollTop) queueMeasure()
  lastScrollLeft = left
  lastScrollTop = top
})
onBeforeUnmount(() => { alive = false; request++; table.value?.unregisterColumn?.(uid) })
defineExpose({ sortDirection })
</script>

<template>
  <view class="wd-table-column" :class="{ 'is-fixed': fixed }" :style="columnStyle">
    <view v-for="config in cellConfigs" :key="config.rowIndex" :class="config.class" :style="config.style" @tap="rowClick(config.rowIndex)">
      <view :class="['wd-table__cell-content', contentClass, `is-${align}`]" @layoutchange="onContentLayout(config, $event)">
        <slot v-if="$slots.value" name="value" :row="rowScope(config.rowIndex)" :index="config.rowIndex" />
        <text v-else :class="['wd-table__value', { 'is-ellipsis': ellipsis }]" :text-maxline="ellipsis ? 2 : undefined">{{ config.value }}</text>
      </view>
      <view v-if="config.shadow" class="wd-table__shadow" />
    </view>
  </view>
</template>

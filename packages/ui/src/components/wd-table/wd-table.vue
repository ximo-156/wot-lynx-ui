/*
 * wd-table — 表格
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 布局：参考源的表头与表体都是 CSS Grid（grid-template-columns 定义列宽，
 *   单元格 grid-column / grid-row 定位，列根 display:contents）。Lynx 无
 *   Grid、也无 display:contents，故表头改为 flex 行（单元格显式定宽 +
 *   flex-shrink:0），表体改为「列主」flex 行（每个 wd-table-column 是纵向
 *   容器，详见 wd-table-column 头部注释）；列宽之和经 calc 下发给内容容器，
 *   与参考源的 contentWidthStyle 一致；
 * - 固定列：表头单元格的 sticky 保留（包含块是表头行，有位移空间）；表体
 *   固定列的 sticky 挂在列根上（见 wd-table-column）；
 * - is-border 的 ::before 边框（伪元素）改为单元格真实 border-right /
 *   border-bottom；is-shadow 的 ::after 渐变阴影改为真实元素
 *   wd-table__shadow（PORTING §4.4）；
 * - 虚拟滚动：参考源用 grid-template-rows: repeat(n, rowH) 撑出总滚动高度，
 *   Lynx 无 Grid，改由列内的上下占位视图（wd-table__spacer）撑高，单元格
 *   按 rowHeight 定高，跨列行对齐；
 * - scroll-view 的 enable-flex / throttle 为 uni-app 专有属性（Lynx 不支持，
 *   已移除）；scrollViewStyle 的 overflow:auto 一并移除（scroll-view 自行
 *   管理滚动裁剪）；
 * - 索引列宽度：参考源为 100rpx（小程序专有单位），Lynx 取 100px；
 * - @click → @tap；customStyle 经 parseStyle 归一为对象语法（CONVENTIONS
 *   §19）；ellipsis 的两行省略由 text-maxline 承担（CONVENTIONS §5.6）；
 * - 参考源模板中 MP-DINGTALK 条件编译的包裹 view 已移除。
 */
<script lang="ts" setup>
import './index.css'

import { computed, reactive, ref } from 'vue-lynx'
import WdSortButton from '../wd-sort-button/wd-sort-button.vue'
import { addUnit, isDef, isObj, parseStyle, throttle, uuid } from '../../common/util'
import type { SortDirection, TableColumn, TableColumnInstance, TableColumnProps } from '../wd-table-column/types'
import { TABLE_KEY, tableProps, type SpanMethodResult, type TableProvide } from './types'
import WdTableColumn from '../wd-table-column/wd-table-column.vue'
import { useTranslate } from '../../composables/useTranslate'
import { useChildren } from '../../composables/useChildren'

const { translate } = useTranslate('tableCol')

const props = defineProps(tableProps)
const emit = defineEmits(['sort-method', 'row-click'])

/** 滚动状态 */
const state = reactive({
  scrollLeft: 0,
  scrollTop: 0
})

const { linkChildren, children } = useChildren<TableColumnInstance, TableProvide>(TABLE_KEY)

/**
 * 当前可视行范围
 * @returns { start, end } 可视区域的行索引范围（含 buffer）
 */
const visibleRange = computed(() => {
  const total = props.data.length
  if (!props.virtual || total === 0) {
    return { start: 0, end: Math.max(0, total - 1) }
  }
  const rowH = Number(props.rowHeight) || 44
  const bufferSize = Number(props.buffer) || 5
  const viewportHeight = Number(props.height) || 400
  const start = Math.max(0, Math.floor(state.scrollTop / rowH) - bufferSize)
  const end = Math.min(total - 1, Math.ceil((state.scrollTop + viewportHeight) / rowH) + bufferSize)
  return { start, end }
})

linkChildren({ props, state, visibleRange, rowClick, getIsLastFixed, getFixedLeft, getSpan })

/** 索引列唯一标识 */
const indexUUID = uuid()

/** 索引列配置（Lynx 适配：宽度由参考源的 100rpx 取 100px） */
const indexColumn = ref<TableColumnProps>({
  prop: indexUUID,
  label: translate('indexLabel'),
  width: '100px',
  sortable: false,
  fixed: false,
  align: 'left',
  ...(isObj(props.index) ? props.index : {})
})

/** 是否显示索引列 */
const showIndex = computed(() => props.index !== false)

/** 是否开启纵向滚动（设置了 height 时启用） */
const scrollY = computed(() => isDef(props.height))

/** 滚动事件处理（节流 16ms ≈ 60fps） */
const handleScrollThrottled = throttle(handleScroll, 16) as (event: any) => void

/** 外层容器样式 */
const tableStyle = computed(() => {
  return parseStyle(props.customStyle)
})

/**
 * scroll-view 容器样式
 * @returns 包含 max-height 的样式对象（当设置了 height 时）
 */
const scrollViewStyle = computed<Record<string, string>>(() => {
  // max-height 键恒写（CONVENTIONS §20）：未设置 height 时置 none
  return { 'max-height': isDef(props.height) ? addUnit(props.height) : 'none' }
})

/**
 * 所有列宽度数组
 * @returns 列宽字符串数组，如 ['100px', '150px', '200px']
 */
const columnWidths = computed(() => {
  return children.map((child) => addUnit(child.width))
})

/**
 * 内容总宽度样式，确保水平滚动时内容不被压缩
 * @returns 所有列宽之和的 calc() 表达式
 */
const contentWidthStyle = computed<Record<string, string>>(() => {
  return { width: `calc(${columnWidths.value.join(' + ')})` }
})

/**
 * 最后一个固定列的 prop 值
 * @returns 最后一个 fixed=true 列的 prop，无固定列时返回 null
 */
const lastFixedProp = computed(() => {
  const fixedCols = children.filter((c) => c.fixed)
  return fixedCols.length ? fixedCols[fixedCols.length - 1].prop : null
})

/**
 * 预计算每列的 left 偏移量
 * @returns Map<列索引, CSS left 值>
 */
const fixedLeftMap = computed(() => {
  const map = new Map<number, string>()
  const leftParts: string[] = []

  children.forEach((_col, i) => {
    if (leftParts.length === 0) {
      map.set(i, '0')
    } else {
      map.set(i, `calc(${leftParts.join(' + ')})`)
    }
    leftParts.push(addUnit(children[i].width))
  })
  return map
})

/**
 * 判断指定索引的列是否为最后一个固定列（内部使用，用于表头渲染）
 * @param colIndex - 列索引
 * @returns 是否为最后一个固定列
 */
function isLastFixed(colIndex: number): boolean {
  return children[colIndex] && children[colIndex].fixed && children[colIndex].prop === lastFixedProp.value
}

/**
 * 判断指定列是否为最后一个固定列
 * @param column - 列配置
 * @returns 是否为最后一个固定列
 */
function getIsLastFixed(column: { fixed: boolean; prop: string }): boolean {
  return column.fixed && column.prop === lastFixedProp.value
}

/**
 * 获取指定列的固定 left 偏移量
 * @param columnIndex - 列索引
 * @returns CSS left 值字符串
 */
function getFixedLeft(columnIndex: number): string {
  return fixedLeftMap.value.get(columnIndex) || '0'
}

/**
 * 获取指定单元格的合并信息
 * @param rowIndex - 行索引
 * @param columnIndex - 列索引
 * @returns 合并配置 { rowspan, colspan }
 */
function getSpan(rowIndex: number, columnIndex: number): SpanMethodResult {
  if (typeof props.spanMethod !== 'function') {
    return { rowspan: 1, colspan: 1 }
  }
  const result = props.spanMethod({
    row: props.data[rowIndex],
    column: { prop: children[columnIndex].prop, label: children[columnIndex].label },
    rowIndex,
    columnIndex
  })
  return result || { rowspan: 1, colspan: 1 }
}

/**
 * 获取表头单元格的内联样式（列宽 + 固定列 left 偏移）
 * @param columnIndex - 列索引
 * @returns 样式对象
 */
function getHeaderCellStyle(columnIndex: number): Record<string, string> {
  // left 键恒写（CONVENTIONS §20）：非固定列置 auto
  return {
    width: addUnit(children[columnIndex].width),
    left: children[columnIndex].fixed ? fixedLeftMap.value.get(columnIndex) || '0' : 'auto'
  }
}

/**
 * 处理排序状态变更，重置其他列的排序方向并触发 sort-method 事件
 * @param value - 新的排序方向
 * @param index - 触发排序的列索引
 */
function handleSortChange(value: SortDirection, index: number) {
  children[index].$.exposed!.sortDirection.value = value
  children.forEach((col, i) => {
    if (index != i) {
      col.$.exposed!.sortDirection.value = 0
    }
  })
  const column: TableColumn = {
    prop: children[index].prop,
    label: children[index].label,
    width: children[index].width,
    sortable: children[index].sortable,
    align: children[index].align,
    sortDirection: value,
    fixed: children[index].fixed
  }
  emit('sort-method', column)
}

/**
 * 处理滚动事件，更新水平和垂直滚动偏移量
 * @param event - scroll-view 的滚动事件对象
 */
function handleScroll(event: any) {
  state.scrollLeft = event.detail.scrollLeft
  if (props.virtual) {
    state.scrollTop = event.detail.scrollTop
  }
}

/**
 * 触发行点击事件
 * @param index - 被点击行的索引
 */
function rowClick(index: number) {
  emit('row-click', { rowIndex: index })
}
</script>

<template>
  <view :class="['wd-table', { 'is-border': border }, customClass]" :style="tableStyle">
    <scroll-view :scroll-x="true" :scroll-y="scrollY" :style="scrollViewStyle" @scroll="handleScrollThrottled">
      <view :style="contentWidthStyle">
        <!-- 表头 -->
        <view v-if="showHeader" :class="['wd-table__header', { 'is-sticky': fixedHeader }]">
          <view
            v-for="(column, index) in children"
            :key="index"
            :class="[
              'wd-table__cell',
              'wd-table__cell--header',
              {
                'is-border': border,
                'is-fixed': column.fixed,
                'is-stripe': stripe,
                'is-shadow': isLastFixed(index) && state.scrollLeft,
                'is-last': index === children.length - 1
              },
              `is-${column.align}`
            ]"
            :style="getHeaderCellStyle(index)"
          >
            <wd-sort-button
              v-if="column.sortable"
              v-model="column.$.exposed!.sortDirection.value"
              allow-reset
              :line="false"
              :title="column.label"
              @change="({ value }) => handleSortChange(value, index)"
            />
            <text v-else :class="['wd-table__value', { 'is-ellipsis': ellipsis }]" :text-maxline="ellipsis ? 2 : undefined">{{ column.label }}</text>
          </view>
        </view>

        <!-- 表体（列主布局，虚拟滚动时列内以占位视图撑高） -->
        <view class="wd-table__body">
          <wd-table-column
            v-if="showIndex"
            :prop="indexColumn.prop"
            :label="indexColumn.label"
            :width="indexColumn.width"
            :sortable="indexColumn.sortable"
            :fixed="indexColumn.fixed"
            :align="indexColumn.align"
          >
            <template #value="{ index }">
              <text>{{ index + 1 }}</text>
            </template>
          </wd-table-column>
          <slot></slot>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

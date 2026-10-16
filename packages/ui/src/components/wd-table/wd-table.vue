/*
 * wd-table — 表格
 *
 * Lynx 实现说明：scroll-view 横向滚动 + 固定列；
 * 单元格支持默认渲染与作用域插槽定制；
 * 列宽经 addUnit 归一（'100px' 直接透传、数字补 px、'20%' 原样保留，
 * 避免字符串拼接产出 '100pxpx' 这类非法值被静默丢弃）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdEmpty from '../wd-empty/wd-empty.vue'
import { tableProps, type TableColumn } from './types'
import { addUnit, isDef, parseStyle } from '../../common/util'

const props = defineProps(tableProps)
// 事件名与 wot-ui 对齐：row-click（payload { rowIndex }；原 click-row 无消费方）
const emit = defineEmits(['row-click'])

const hasData = computed(() => props.data.length > 0)

const columns = computed<TableColumn[]>(() => props.columns as TableColumn[])

/** 列宽归一：'100px' / 100 / '20%' 统一经 addUnit 转合法值，未配置回退 100 */
function colWidth(col: TableColumn): string {
  return addUnit(isDef(col.width) && col.width !== '' ? (col.width as string | number) : 100)
}

/** 列宽数值（用于总宽计算）：非数字回退 100 */
function colWidthValue(col: TableColumn): number {
  const width = parseFloat(String(col.width))
  return Number.isNaN(width) ? 100 : width
}

const totalWidth = computed(() => {
  return columns.value.reduce((sum, col) => sum + colWidthValue(col), 0)
})

const tableStyle = computed(() => {
  return { width: `${totalWidth.value}px` }
})

function cellAlign(col: TableColumn): string {
  return col.align || 'left'
}
</script>

<template>
  <view :class="`wd-table ${customClass}`" :style="parseStyle(customStyle)">
    <scroll-view scroll-x class="wd-table__scroll">
      <view v-if="hasData" class="wd-table__inner" :style="tableStyle">
        <!-- 表头 -->
        <view class="wd-table__header">
          <view
            v-for="(col, colIndex) in columns"
            :key="colIndex"
            :class="['wd-table__th', col.fixed ? 'wd-table__th--fixed' : '']"
            :style="{ width: colWidth(col), 'justify-content': cellAlign(col) === 'center' ? 'center' : cellAlign(col) === 'right' ? 'flex-end' : 'flex-start' }"
          >
            <text class="wd-table__th-text">{{ col.label }}</text>
          </view>
        </view>
        <!-- 数据行 -->
        <view
          v-for="(row, rowIndex) in data"
          :key="rowIndex"
          :class="['wd-table__row', stripe && rowIndex % 2 === 1 ? 'is-stripe' : '']"
          @tap="emit('row-click', { rowIndex })"
        >
          <view
            v-for="(col, colIndex) in columns"
            :key="colIndex"
            :class="['wd-table__td', col.fixed ? 'wd-table__td--fixed' : '']"
            :style="{ width: colWidth(col), 'justify-content': cellAlign(col) === 'center' ? 'center' : cellAlign(col) === 'right' ? 'flex-end' : 'flex-start' }"
          >
            <slot :row="row" :column="col" :row-index="rowIndex" :column-index="colIndex" :rowspan="1" :colspan="1">
              <text class="wd-table__td-text">{{ row[col.prop] }}</text>
            </slot>
          </view>
        </view>
      </view>
      <wd-empty v-else :tip="emptyText" />
    </scroll-view>
  </view>
</template>

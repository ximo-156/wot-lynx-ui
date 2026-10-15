/*
 * wd-table — 表格
 *
 * Lynx 实现说明：scroll-view 横向滚动 + 固定列；
 * 单元格支持默认渲染与作用域插槽定制。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdEmpty from '../wd-empty/wd-empty.vue'
import { tableProps, type TableColumn } from './types'
import { parseStyle } from '../../common/util'

const props = defineProps(tableProps)
const emit = defineEmits(['click-row'])

const hasData = computed(() => props.data.length > 0)

const columns = computed<TableColumn[]>(() => props.columns as TableColumn[])

const totalWidth = computed(() => {
  return columns.value.reduce((sum, col) => sum + (Number(col.width) || 100), 0)
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
            :style="{ width: `${col.width || 100}px`, 'justify-content': cellAlign(col) === 'center' ? 'center' : cellAlign(col) === 'right' ? 'flex-end' : 'flex-start' }"
          >
            <text class="wd-table__th-text">{{ col.label }}</text>
          </view>
        </view>
        <!-- 数据行 -->
        <view
          v-for="(row, rowIndex) in data"
          :key="rowIndex"
          :class="['wd-table__row', stripe && rowIndex % 2 === 1 ? 'is-stripe' : '']"
          @tap="emit('click-row', { row, rowIndex })"
        >
          <view
            v-for="(col, colIndex) in columns"
            :key="colIndex"
            :class="['wd-table__td', col.fixed ? 'wd-table__td--fixed' : '']"
            :style="{ width: `${col.width || 100}px`, 'justify-content': cellAlign(col) === 'center' ? 'center' : cellAlign(col) === 'right' ? 'flex-end' : 'flex-start' }"
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

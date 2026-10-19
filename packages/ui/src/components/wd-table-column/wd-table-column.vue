/*
 * wd-table-column — 表格列
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 布局：参考源依赖 CSS Grid（表体 display:grid + grid-template-columns，
 *   单元格 grid-column / grid-row，列根 display:contents）。Lynx 无 Grid、
 *   也无 display:contents，故表体改为「列主」flex 布局：列根为纵向容器
 *   （显式 display:flex + flex-direction:column，CONVENTIONS §15），单元格
 *   在列内纵向堆叠，列根与单元格均显式定宽（flex-shrink:0 防压缩）；
 * - 固定列：参考源把 is-fixed（position:sticky + left）下发给单元格，但
 *   单元格的包含块是列根（宽度等于单元格），sticky 无位移空间会失效；故
 *   列根同步 is-fixed 类 + left 内联（sticky 挂在列根上，位移范围为整个
 *   表体），单元格的 is-fixed 保留（z-index 层叠，与参考源一致）；
 * - rowspan/colspan：colspan 由单元格宽度取所跨列宽之和（calc）实现；
 *   rowspan 仅跳过被合并隐藏的单元格（参考源同样 continue），合并区域的
 *   高度填充弱于 grid（行高由内容决定）；
 * - 末行边框：参考源用 .wd-table__cell:last-child 去除末行下边框
 *   （Lynx 不支持结构伪类），改为按行索引推 is-last-row 类名，且以数据
 *   真末行为准（虚拟滚动下参考源的「最后一个渲染单元格」会在表中部
 *   留下缺线）；
 * - is-shadow 的 ::after 渐变阴影（Lynx 无伪元素）改为模板真实元素
 *   wd-table__shadow（PORTING §4.4），pointer-events:none 放行触摸；
 * - is-border 的 ::before 边框（伪元素）改为单元格真实 border-right /
 *   border-bottom（halfPixelBorder 系 mixin 已适配为原生 border）；
 * - @click → @tap；ellipsis 的 -webkit-line-clamp 两行省略（Web 盒模型）
 *   由 text-maxline 属性承担（CONVENTIONS §5.6）；
 * - config.style 由参考源的 objToStyle 字符串改为对象语法（CONVENTIONS §19）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import { isDef, isFunction, isOdd } from '../../common/util'
import { tableColumnProps, type SortDirection } from './types'
import { useParent } from '../../composables/useParent'
import { TABLE_KEY } from '../wd-table/types'
import type { SpanMethodResult } from '../wd-table/types'

const props = defineProps(tableColumnProps)

const { parent: table, index: columnIndex } = useParent(TABLE_KEY)

/** 当前列的排序方向 */
const sortDirection = ref<SortDirection>(0)

/** 是否开启斑马纹（从父级 table 继承） */
const stripe = computed(() => {
  return isDef(table.value) ? table.value.props.stripe : false
})

/** 是否显示边框（从父级 table 继承） */
const border = computed(() => {
  return isDef(table.value) ? table.value.props.border : false
})

/** 是否超出省略（从父级 table 继承） */
const ellipsis = computed(() => {
  return isDef(table.value) ? table.value.props.ellipsis : false
})

/** 当前列是否为最后一个固定列（用于显示右侧阴影） */
const isLastFixed = computed(() => {
  if (props.fixed && isDef(table.value)) {
    return table.value.getIsLastFixed(props)
  }
  return false
})

/**
 * 当前列的数据数组，从父级 table 的 data 中按 prop 提取
 * @returns 当前列 prop 对应的数据值数组
 */
const column = computed(() => {
  if (!isDef(table.value) || !isDef(table.value.props.data) || !Array.isArray(table.value.props.data)) {
    return []
  }
  return table.value.props.data.map((item) => item[props.prop])
})

/**
 * 固定列的 left 偏移值（缓存，避免每个单元格重复调用 getFixedLeft）
 * @returns CSS left 值字符串，非固定列返回空字符串
 */
const fixedLeft = computed(() => {
  if (props.fixed && isDef(table.value) && isFunction(table.value.getFixedLeft)) {
    return table.value.getFixedLeft(columnIndex.value)
  }
  return ''
})

/**
 * 是否为最后一列（用于去除外边框）
 */
const isLastColumn = computed(() => {
  return isDef(table.value) ? columnIndex.value === table.value.children.length - 1 : false
})

/**
 * 列根内联样式：显式定宽（ Lynx flex 子项需防压缩）+ 固定列 left 偏移。
 * 键集合恒定（CONVENTIONS §20）。
 */
const columnStyle = computed<Record<string, string>>(() => {
  return {
    width: props.width as string,
    left: props.fixed ? fixedLeft.value || '0' : 'auto'
  }
})

/** 是否开启虚拟滚动（从父级 table 继承） */
const isVirtual = computed(() => {
  return isDef(table.value) ? Boolean(table.value.props.virtual) : false
})

/** 虚拟滚动行高（px） */
const rowHeightPx = computed(() => {
  return Number(isDef(table.value) ? table.value.props.rowHeight : 44) || 44
})

/**
 * 虚拟滚动：可见区域之前的占位高度（替代参考源 grid-template-rows 撑出的
 * 总滚动高度，Lynx 无 Grid）
 */
const spacerBeforeHeight = computed(() => {
  if (!isVirtual.value || !isDef(table.value)) return '0px'
  const range = table.value.visibleRange.value
  return `${range.start * rowHeightPx.value}px`
})

/**
 * 虚拟滚动：可见区域之后的占位高度
 */
const spacerAfterHeight = computed(() => {
  if (!isVirtual.value || !isDef(table.value)) return '0px'
  const data = Array.isArray(table.value.props.data) ? table.value.props.data : []
  const range = table.value.visibleRange.value
  return `${Math.max(0, data.length - 1 - range.end) * rowHeightPx.value}px`
})

/**
 * 预计算可视区域单元格的 class、style、visible 配置
 * 虚拟滚动时只生成 visibleRange 范围内的单元格
 * @returns 每行单元格的渲染配置数组
 */
const cellConfigs = computed(() => {
  const configs: Array<{ rowIndex: number; value: any; class: any; style: Record<string, string>; shadow: boolean }> = []
  const data = isDef(table.value) && Array.isArray(table.value.props.data) ? table.value.props.data : []
  if (data.length === 0) return configs

  const range = isDef(table.value) ? table.value.visibleRange.value : { start: 0, end: data.length - 1 }
  const colIdx = columnIndex.value
  const hasScrollLeft = isDef(table.value) && table.value.state.scrollLeft
  const isFixed = props.fixed
  const isLast = isLastFixed.value
  const isLastCol = isLastColumn.value
  const align = props.align
  const stripeVal = stripe.value
  const borderVal = border.value
  const propKey = props.prop
  const virtual = isVirtual.value

  for (let rowIndex = range.start; rowIndex <= range.end; rowIndex++) {
    const span = getSpanResult(rowIndex)
    const isHidden = span.rowspan === 0 || span.colspan === 0
    if (isHidden) continue

    const cls = [
      'wd-table__cell',
      {
        'is-stripe': stripeVal && isOdd(rowIndex),
        'is-border': borderVal,
        'is-fixed': isFixed,
        'is-shadow': isLast && hasScrollLeft,
        'is-last': isLastCol,
        // Lynx 适配：结构伪类 :last-child 改为索引类名（数据真末行）
        'is-last-row': rowIndex === data.length - 1
      },
      `is-${align}`
    ]

    const style: Record<string, string> = {}
    // Lynx 适配：grid-column 跨度由单元格宽度（所跨列宽之和）表达
    style.width = span.colspan > 1 ? calcSpanWidth(span.colspan) : (props.width as string)
    // Lynx 适配：grid-row 定高由虚拟滚动的固定行高表达（键恒写，CONVENTIONS §20）
    style.height = virtual ? `${rowHeightPx.value}px` : 'auto'
    // left 键恒写（CONVENTIONS §20）：非固定列置 auto（无定位上下文时被忽略），
    // 避免 fixed 由真转假时旧偏移残留
    style.left = isFixed && fixedLeft.value ? fixedLeft.value : 'auto'

    configs.push({
      rowIndex,
      value: data[rowIndex] ? data[rowIndex][propKey] : undefined,
      class: cls,
      style,
      shadow: Boolean(isLast && hasScrollLeft)
    })
  }
  return configs
})

/**
 * 计算横向合并（colspan）的单元格宽度：所跨列宽之和的 calc 表达式
 */
function calcSpanWidth(colspan: number): string {
  const children = table.value ? table.value.children : []
  const widths: string[] = []
  for (let i = columnIndex.value; i < columnIndex.value + colspan && i < children.length; i++) {
    widths.push(`${(children[i] as any).width}px`)
  }
  return `calc(${widths.join(' + ')})`
}

/**
 * 获取指定行的单元格合并信息
 * @param rowIndex - 行索引
 * @returns 合并配置 { rowspan, colspan }
 */
function getSpanResult(rowIndex: number): SpanMethodResult {
  if (!isDef(table.value) || !isFunction(table.value.getSpan)) {
    return { rowspan: 1, colspan: 1 }
  }
  return table.value.getSpan(rowIndex, columnIndex.value)
}

/**
 * 处理单元格点击事件，转发给父级 table 的 rowClick
 * @param index - 行索引
 */
function handleRowClick(index: number) {
  if (!isDef(table.value)) return
  isFunction(table.value.rowClick) && table.value.rowClick(index)
}

/**
 * 获取指定行的完整数据对象，用于 #value 插槽的 row 参数
 * @param index - 行索引
 * @returns 该行的数据对象
 */
function getScope(index: number) {
  if (!isDef(table.value) || !isDef(table.value.props.data) || !Array.isArray(table.value.props.data)) {
    return {}
  }
  return table.value.props.data[index] || {}
}

defineExpose({ sortDirection })
</script>

<template>
  <view class="wd-table-column" :class="{ 'is-fixed': fixed }" :style="columnStyle">
    <!-- Lynx 适配：虚拟滚动的上下占位视图（替代 grid-template-rows 的总高） -->
    <view v-if="isVirtual" class="wd-table__spacer" :style="{ height: spacerBeforeHeight }" />
    <view v-for="config in cellConfigs" :key="config.rowIndex" :class="config.class" :style="config.style" @tap="handleRowClick(config.rowIndex)">
      <slot name="value" v-if="$slots.value" :row="getScope(config.rowIndex)" :index="config.rowIndex"></slot>
      <text v-else :class="['wd-table__value', { 'is-ellipsis': ellipsis }]" :text-maxline="ellipsis ? 2 : undefined">{{ config.value }}</text>
      <!-- Lynx 适配：参考源 is-shadow 的 ::after 渐变阴影改为真实元素 -->
      <view v-if="config.shadow" class="wd-table__shadow" />
    </view>
    <view v-if="isVirtual" class="wd-table__spacer" :style="{ height: spacerAfterHeight }" />
  </view>
</template>

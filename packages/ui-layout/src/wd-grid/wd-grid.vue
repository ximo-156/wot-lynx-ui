/*
 * wd-grid — 宫格
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 经 useChildren(GRID_KEY) 向子级 wd-grid-item 注入 props（列数、间距、
 *   边框、点击反馈等配置由子项自行计算边框类名与宽度），与参考源一致；
 * - rootStyle 由参考源的「objToStyle 拼字符串 + customStyle 拼接」改为对象语义
 *   （parseStyle 归一，CONVENTIONS §19）；
 * - **显式行结构（真机 2026-11-04 修复，本轮核心）**：参考源用
 *   `display:flex + flex-direction:row + flex-wrap:wrap` 让子项自动换行。
 *   真机引擎对**多行 wrap 容器只按前两行结算高度**（CONVENTIONS §19 差异 #6），
 *   5 列 × 4 行的图标宫格在真机上只画出前两行，后两行越界后被 `overflow:hidden`
 *   裁掉 —— 表现就是「宫格少了三分之二」。改为：渲染时按 column 把默认插槽的
 *   VNode 切成行，每行一个 `__row`（flex row），容器自身改为**纵向** flex ——
 *   高度由行数逐行累加，不再依赖 wrap 的高度结算（同 wd-keyboard /
 *   wd-calendar-view month 的修法）。column = 0（自动）时全部子项排一行，
 *   与参考源一致。
 * - **Style Funnel**（CONVENTIONS §20）：rootStyle 的两个可切换键
 *   （gutter 左内边距 / square 负底边距）经 defineStyleKeys + resolveStyle
 *   每帧输出完整键集；
 * - 无交互、无事件。
 *
 * @slot default 宫格子项（一般放 wd-grid-item）——本组件用渲染函数切行，
 *   没有模板块（SFC 里不能出现 template 起始标签，否则插件会当成模板）；
 *   插槽名靠这行注释供 gen-meta / 文档识别。
 */
<script lang="ts">
import './index.css'

import { Fragment, Text, computed, defineComponent, h } from 'vue-lynx'
import { useChildren } from '@wot-lynx/core/composables/useChildren'
import { GRID_KEY, gridProps } from './types'
import { addUnit, isDef, parseStyle, type CSSProperties } from '@wot-lynx/core/common/util'
import { defineStyleKeys, createStyleResolver } from '@wot-lynx/core/common/style'

/**
 * 可切换样式键 + 中性值（CONVENTIONS §20：每帧输出完整键集）。
 * 中性值取「视觉上等同于不设置」：无 gutter 即无左内边距，
 * 非 square 即无负底边距。
 */
const GRID_STYLE = defineStyleKeys({
  paddingLeft: '0px',
  marginBottom: '0px'
})

/**
 * 摊平插槽节点：`v-for` 产出的 Fragment 需要展开成真实子项，
 * 注释节点与纯空白文本节点要丢掉 —— 否则按 column 切行会错位。
 * @param {any[]} nodes 插槽 VNode 列表
 * @returns {any[]} 可参与分行计算的真实子项
 */
function flattenSlotNodes(nodes: any[]): any[] {
  const out: any[] = []
  for (const node of nodes) {
    if (!node) continue
    if (node.type === Fragment) {
      out.push(...flattenSlotNodes(Array.isArray(node.children) ? node.children : []))
      continue
    }
    if (node.type === Text) {
      if (String(node.children ?? '').trim() === '') continue
      out.push(node)
      continue
    }
    // Static / 注释等：vnode.type 为 symbol，不产生元素
    if (typeof node.type === 'symbol') continue
    out.push(node)
  }
  return out
}

export default defineComponent({
  name: 'wd-grid',
  props: gridProps,
  setup(props, { slots }) {
    const { linkChildren } = useChildren(GRID_KEY)
    linkChildren({ props })

    const resolveRootStyle = createStyleResolver(GRID_STYLE)
    const rootStyle = computed<CSSProperties>(() => resolveRootStyle({
      // gutter 由根节点左内边距 + 子项右内边距共同构成（对齐 wot-ui）
      paddingLeft: isDef(props.gutter) ? addUnit(props.gutter) : '',
      // square 模式下子项以 padding-top 百分比撑高，容器以负底边距回收
      marginBottom: isDef(props.gutter) && props.square ? addUnit(-props.gutter) : ''
    }, parseStyle(props.customStyle)))

    return () => {
      const items = flattenSlotNodes(slots.default ? slots.default() : [])
      // column <= 0 / 未设置表示自动：全部排一行（对齐 wot-ui 的 auto 语义）
      const configured = Number(props.column) || 0
      const column: number = configured > 0 ? configured : Math.max(items.length, 1)
      const rows: any[][] = []
      for (let i = 0; i < items.length; i += column) {
        rows.push(items.slice(i, i + column))
      }

      return h(
        'view',
        { class: `wd-grid ${props.customClass || ''}`.trim(), style: rootStyle.value },
        rows.map((row, index) => h('view', { key: `row-${index}`, class: 'wd-grid__row' }, row))
      )
    }
  }
})
</script>

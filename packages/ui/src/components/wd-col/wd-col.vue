/*
 * wd-col — 列布局
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - rootStyle 由参考源的「字符串数组 join」改为对象语法：customStyle 经
 *   parseStyle() 归一后合并（CONVENTIONS §19，字符串 :style 会被静默丢弃）；
 * - gutter 内边距、span 宽度百分比、offset 位移的计算式与 watch 校验
 *   （span/offset < 0 控制台告警）与参考源逐行一致；
 * - gutter 读取父级 wd-row 经 ROW_KEY 注入的 props（useParent），与参考源一致；
 * - **根节点三件套**（NATIVE-REWRITE §3.1）：display: flex + flex-direction: column
 *   在 index.scss 显式声明；
 * - background-clip: content-box 为 Web 专有声明（PORTING §4.5 删除清单），
 *   Lynx 引擎不识别，已移除——gutter 间距语义由左右 padding 完整承担；
 * - **Style Funnel**（CONVENTIONS §20）：rootStyle 的四个可切换键
 *   （gutter 左右内边距 / span 宽度 / offset 位移）经 defineStyleKeys +
 *   resolveStyle 每帧输出完整键集，避免「条件写样式」在 span 由具体值变 24
 *   时残留旧宽度。
 */
<script lang="ts" setup>
import './index.css'

import { computed, watch } from 'vue-lynx'
import { useParent } from '../../composables/useParent'
import { ROW_KEY } from '../wd-row/types'
import { colProps } from './types'
import { addUnit, isDef, parseStyle, type CSSProperties } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(colProps)
const { parent: row } = useParent(ROW_KEY)

const rootClass = computed(() => {
  return `wd-col ${props.customClass}`
})

/**
 * 可切换样式键 + 中性值（CONVENTIONS §20：每帧输出完整键集）。
 * 中性值取「视觉上等同于不设置」：无 gutter 即无左右内边距；
 * span 不落在 (0,24] 区间即不约束宽度；无 offset 即无位移。
 */
const COL_STYLE = defineStyleKeys({
  paddingLeft: '0px',
  paddingRight: '0px',
  width: 'auto',
  marginLeft: '0px'
})

const rootStyle = computed<CSSProperties>(() => {
  const gutter = isDef(row.value) ? row.value.props.gutter || 0 : 0
  const { span, offset } = props

  // 栅格宽度：span 落在 (0,24) 为百分比，24 为整行
  let width = ''
  if (span > 0 && span < 24) {
    width = `${(span / 24) * 100}%`
  } else if (span === 24) {
    width = '100%'
  }

  return {
    ...resolveStyle(COL_STYLE, {
      // gutter 间距：左右 padding
      paddingLeft: gutter > 0 ? addUnit(gutter / 2) : '',
      paddingRight: gutter > 0 ? addUnit(gutter / 2) : '',
      width,
      // 栅格偏移
      marginLeft: offset > 0 ? `${(offset / 24) * 100}%` : ''
    }),
    ...parseStyle(props.customStyle)
  }
})

watch([() => props.span, () => props.offset], () => {
  check()
})

function check() {
  const { span, offset } = props
  if (span < 0 || offset < 0) {
    console.error('[wot-design] warning(wd-col): attribute span/offset must be greater than or equal to 0')
  }
}
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <!-- 每一列 -->
    <slot />
  </view>
</template>

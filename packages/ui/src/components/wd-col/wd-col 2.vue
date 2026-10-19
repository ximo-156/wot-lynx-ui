/*
 * wd-col — 列布局
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - rootStyle 由参考源的「字符串数组 join」改为对象语法：customStyle 经
 *   parseStyle() 归一后合并（CONVENTIONS §19，字符串 :style 会被静默丢弃）；
 * - gutter 内边距、span 宽度百分比、offset 位移的计算式与 watch 校验
 *   （span/offset < 0 控制台告警）与参考源逐行一致；
 * - gutter 读取父级 wd-row 经 ROW_KEY 注入的 props（useParent），与参考源一致；
 * - background-clip: content-box 为 Web 专有声明，Lynx 引擎忽略该属性
 *   （仅影响背景绘制范围， gutter 间距语义由 padding 保证），保留以对齐
 *   参考源声明集合。
 */
<script lang="ts" setup>
import './index.css'

import { computed, watch } from 'vue-lynx'
import { useParent } from '../../composables/useParent'
import { ROW_KEY } from '../wd-row/types'
import { colProps } from './types'
import { addUnit, isDef, parseStyle, type CSSProperties } from '../../common/util'

const props = defineProps(colProps)
const { parent: row } = useParent(ROW_KEY)

const rootClass = computed(() => {
  return `wd-col ${props.customClass}`
})

const rootStyle = computed(() => {
  const gutter = isDef(row.value) ? row.value.props.gutter || 0 : 0
  const { span, offset } = props
  const style: CSSProperties = {}

  // gutter 间距：左右 padding
  if (gutter > 0) {
    const padding = addUnit(gutter / 2)
    style.paddingLeft = padding
    style.paddingRight = padding
    style.backgroundClip = 'content-box'
  }

  // 栅格宽度
  if (span > 0 && span < 24) {
    const width = `${(span / 24) * 100}%`
    style.width = width
  } else if (span === 24) {
    style.width = '100%'
  }

  // 栅格偏移
  if (offset > 0) {
    const marginLeft = `${(offset / 24) * 100}%`
    style.marginLeft = marginLeft
  }

  return { ...style, ...parseStyle(props.customStyle) }
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

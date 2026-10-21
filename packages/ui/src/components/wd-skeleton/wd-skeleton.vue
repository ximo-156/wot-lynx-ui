/*
 * wd-skeleton — 骨架屏
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 参考源渐变动画以 col 的 ::after 伪元素承载（absolute + linear-gradient
 *   扫描 + translateX/skewX 关键帧）；Lynx 无伪元素（PORTING §4.4），改为
 *   模板真实元素 wd-skeleton__gradient（animation=gradient 时渲染），位移动画
 *   与关键帧名称/参数保持不变；
 * - 参考源 __row 的 :only-child / :last-child、__col 的 :first-child:last-child /
 *   :last-child 伪类选择器 Lynx 不支持（PORTING §4.5）：末行 margin-bottom
 *   归零改由模板 v-for 索引类名 is-last 承担；col 的 margin-right: 0 规则在
 *   参考源中即无对应基础声明（行内 marginRight 优先级更高），为无效规则，未移植；
 * - 参考源根 view 直接绑定 customStyle（对象），经 parseStyle(customStyle)
 *   归一（CONVENTIONS §19，字符串形式同样支持）；
 * - col 尺寸样式（size/width/height/margin/background/borderRadius 等）由
 *   getColItemStyle 生成对象后经 :style 对象语法下发；
 * - themeMap（avatar/image/text/paragraph 默认行列）、rowCol 解析、
 *   getColItemClass/getColItemStyle 与参考源逐行一致；
 * - 参考源 options 块的 virtualHost / addGlobalClass / styleIsolation 为
 *   uni-app 小程序专有能力，Lynx 无需声明，已移除；
 * - 原生优先重写（NATIVE-REWRITE §3）：本组件为纯展示（无跟手交互，不涉及
 *   MTS），根 / __row / __col 三处容器均经 SCSS 显式补全三件套——根与
 *   __row 为纵向堆叠、__row 内占位块为横向排列（flex-direction 必须显式
 *   挂在 display: flex 上，否则 Lynx 3.x linear 布局下被静默丢弃）；
 *   __col 的 justify-content + align-items 成对居中承载渐变扫描层；
 * - col 尺寸样式经 defineStyleKeys + resolveStyle 输出完整键集
 *   （CONVENTIONS §20 Style Funnel 迁移）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import type { SkeletonRowCol, SkeletonRowColObj } from './types'
import { skeletonProps } from './types'
import { isNumber, addUnit, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const themeMap = {
  avatar: [{ type: 'circle', height: '64px', width: '64px' }],
  image: [{ type: 'rect', height: '64px', width: '64px' }],
  text: [
    1,
    [
      { width: '24%', height: '16px', marginRight: '16px' },
      { width: '76%', height: '16px' }
    ]
  ],
  paragraph: [1, 1, 1, { width: '55%' }]
}
const props = defineProps(skeletonProps)
const rowCols = computed<SkeletonRowCol[]>(() =>
  props.rowCol.length ? props.rowCol : themeMap[props.theme]
)

const parsedRowCols = computed(() => {
  return rowCols.value.map((item) => {
    if (isNumber(item)) {
      return [
        {
          class: getColItemClass({ type: 'text' }),
          style: getColItemStyle({})
        }
      ]
    }
    if (Array.isArray(item)) {
      return item.map((col) => {
        return {
          ...col,
          class: getColItemClass(col),
          style: getColItemStyle(col)
        }
      })
    }
    const nItem = item as SkeletonRowColObj

    return [
      {
        ...nItem,
        class: getColItemClass(nItem),
        style: getColItemStyle(nItem)
      }
    ]
  })
})

function getColItemClass(rowCol: SkeletonRowColObj) {
  return ['wd-skeleton__col', `wd-skeleton--type-${rowCol.type || 'text'}`, { [`wd-skeleton--animation-${props.animation}`]: props.animation }]
}
/**
 * 占位块可切换样式键 + 中性值（CONVENTIONS §20：每帧输出完整键集）。
 * 中性值取 ''（未设置）——宽高圆角由 wd-skeleton--type-* 类承担，
 * 解除内联覆盖并恢复类型类上的尺寸（size 展开为 width + height）。
 */
const COL_STYLE_KEYS = defineStyleKeys({
  width: '',
  height: '',
  margin: '',
  background: '',
  marginLeft: '',
  marginRight: '',
  borderRadius: '',
  backgroundColor: ''
})

function getColItemStyle(rowCol: SkeletonRowColObj) {
  const source: Record<string, string> = {}
  const styleName = ['size', 'width', 'height', 'margin', 'background', 'marginLeft', 'marginRight', 'borderRadius', 'backgroundColor']

  for (const name of styleName) {
    if (Object.prototype.hasOwnProperty.call(rowCol, name)) {
      const px = addUnit(rowCol[name])

      if (name === 'size') {
        source.width = px
        source.height = px
      } else {
        source[name] = px
      }
    }
  }
  return resolveStyle(COL_STYLE_KEYS, source)
}

const show = computed(() => props.loading == undefined || props.loading === true)
</script>

<template>
  <view :class="`wd-skeleton ${customClass}`" :style="parseStyle(customStyle)">
    <view class="wd-skeleton__content" v-if="show">
      <view
        v-for="(row, index) of parsedRowCols"
        :key="`row-${index}`"
        :class="`wd-skeleton__row ${index === parsedRowCols.length - 1 ? 'is-last' : ''}`"
      >
        <view v-for="(col, idx) of row" :key="`col-${idx}`" :class="col.class" :style="col.style">
          <!-- Lynx 适配：参考源的渐变扫描层为 ::after 伪元素，此处为真实元素 -->
          <view v-if="animation === 'gradient'" class="wd-skeleton__gradient" />
        </view>
      </view>
    </view>
    <view v-else>
      <slot />
    </view>
  </view>
</template>

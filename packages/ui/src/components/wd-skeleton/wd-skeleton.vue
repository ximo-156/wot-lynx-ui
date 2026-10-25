/*
 * wd-skeleton — 骨架屏
 * 保留官方 2.3.2 行列/尺寸与动画契约；渐变伪元素改为真实装饰层。
 * 空/非数组 rowCol 回退主题，主题响应式更新；动态根样式显式清除旧键。
 */
<script lang="ts" setup>
import './index.css'

import { computed, normalizeClass } from 'vue-lynx'
import type { SkeletonRowCol, SkeletonRowColObj } from './types'
import { skeletonProps } from './types'
import { isNumber, addUnit, parseStyle } from '../../common/util'
import { createStyleResolver, defineStyleKeys, resolveStyle } from '../../common/style'

const themeMap = {
  avatar: [{ type: 'circle', height: '64px', width: '64px' }],
  image: [{ type: 'rect', height: '64px', width: '64px' }],
  text: [1, [{ width: '24%', height: '16px', marginRight: '16px' }, { width: '76%', height: '16px' }]],
  paragraph: [1, 1, 1, { width: '55%' }]
}
const props = defineProps(skeletonProps)
const resolveRootStyle = createStyleResolver()
const rootClass = computed(() => normalizeClass(['wd-skeleton', props.customClass]))
const rootStyle = computed(() => resolveRootStyle(parseStyle(props.customStyle)))
const rowCols = computed<SkeletonRowCol[]>(() =>
  Array.isArray(props.rowCol) && props.rowCol.length ? props.rowCol : themeMap[props.theme]
)
const COL_STYLE_KEYS = defineStyleKeys({
  width: '', height: '', margin: '', 'background-color': '', 'margin-left': '', 'margin-right': '', 'border-radius': ''
})

function getColItemClass(rowCol: SkeletonRowColObj) {
  return ['wd-skeleton__col', `wd-skeleton--type-${rowCol.type || 'text'}`, { [`wd-skeleton--animation-${props.animation}`]: props.animation }]
}
function getColItemStyle(rowCol: SkeletonRowColObj) {
  const source: Record<string, string> = {}
  const styleNames = ['size', 'width', 'height', 'margin', 'background', 'marginLeft', 'marginRight', 'borderRadius', 'backgroundColor']
  for (const name of styleNames) {
    if (Object.prototype.hasOwnProperty.call(rowCol, name)) {
      const px = addUnit(rowCol[name])
      if (name === 'size') {
        source.width = px
        source.height = px
      } else if (name === 'background' || name === 'backgroundColor') {
        // 内联通道不保证展开 background 简写，统一按 background-color 下发
        source['background-color'] = px
      } else {
        source[name] = px
      }
    }
  }
  return resolveStyle(COL_STYLE_KEYS, source)
}
const parsedRowCols = computed(() => rowCols.value.map((item) => {
  const cols = isNumber(item) ? [{}] : Array.isArray(item) ? item : [item as SkeletonRowColObj]
  // 官方数字项代表一个默认 text 块，而非数字对应的列数。
  return cols.map((col) => ({ ...col, class: getColItemClass(col), style: getColItemStyle(col) }))
}))
const show = computed(() => props.loading == undefined || props.loading === true)
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <view class="wd-skeleton__content" v-if="show">
      <view
        v-for="(row, index) of parsedRowCols"
        :key="`row-${index}`"
        :class="`wd-skeleton__row ${index === parsedRowCols.length - 1 ? 'is-last' : ''}`"
      >
        <view v-for="(col, idx) of row" :key="`col-${idx}`" :class="col.class" :style="col.style">
          <view v-if="animation === 'gradient'" class="wd-skeleton__gradient" />
        </view>
      </view>
    </view>
    <view v-else><slot /></view>
  </view>
</template>

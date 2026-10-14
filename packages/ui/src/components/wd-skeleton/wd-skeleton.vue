<template>
  <view :class="`wd-skeleton ${customClass}`" :style="styleToObject(customStyle)">
    <view class="wd-skeleton__content" v-if="show">
      <!-- Lynx 适配：:last-child 等不受支持（CONVENTIONS §4.3），
           is-last / is-first 由 v-for 索引生成。 -->
      <view
        :class="`wd-skeleton__row${index === parsedRowCols.length - 1 ? ' is-last' : ''}`"
        v-for="(row, index) of parsedRowCols"
        :key="`row-${index}`"
      >
        <view
          v-for="(col, idx) of row"
          :key="`col-${idx}`"
          :class="[col.class, idx === row.length - 1 ? 'is-last' : '']"
          :style="styleToObject(col.style)"
        >
          <!-- Lynx 适配：wot-ui 用 ::after 绘制渐变高亮层，Lynx 无伪元素，
               改为真实元素（样式见 index.scss 的 .wd-skeleton__gradient）。 -->
          <view v-if="props.animation === 'gradient'" class="wd-skeleton__gradient" />
        </view>
      </view>
    </view>
    <view v-else>
      <slot />
    </view>
  </view>
</template>
<script setup lang="ts">
import './index.css'
import {ref, computed, watch} from 'vue-lynx'
import type { SkeletonRowCol, SkeletonRowColObj } from './types'
import { skeletonProps } from './types'
import { styleToObject, type CSSProperties, isNumber, addUnit } from '../../common/util'

const themeMap = {
  avatar: [{ type: 'circle', height: '64px', width: '64px' }],
  image: [{ type: 'rect', height: '64px', width: '64px' }],
  text: [
    1,
    [
      { width: '24%', height: '14px', marginRight: '16px' },
      { width: '76%', height: '14px' }
    ]
  ],
  paragraph: [1, 1, 1, { width: '55%' }]
}
const props = defineProps(skeletonProps)
const rowCols = ref<SkeletonRowCol[]>([])

const parsedRowCols = computed(() => {
  return rowCols.value.map((item) => {
    if (isNumber(item)) {
      return [
        {
          class: getColItemClass({ type: 'text' }),
          style: {}
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
function getColItemStyle(rowCol: SkeletonRowColObj) {
  const style: CSSProperties = {}
  const styleName = ['size', 'width', 'height', 'margin', 'background', 'marginLeft', 'marginRight', 'borderRadius', 'backgroundColor']

  for (const name of styleName) {
    if (Object.prototype.hasOwnProperty.call(rowCol, name)) {
      const px = addUnit(rowCol[name])

      if (name === 'size') {
        style.width = px
        style.height = px
      } else {
        ;(style as any)[name] = px
      }
    }
  }
  return style
}

watch(
  () => props.rowCol,
  (rowCol) => {
    // theme 非法时 themeMap[theme] 为 undefined，展开 undefined 会抛 TypeError；
    // 本 watch 带 immediate，抛错发生在 setup 阶段即崩卡片。降级为空数组。
    const themeRowCol = themeMap[props.theme] || []
    rowCols.value = [...(Array.isArray(rowCol) && rowCol.length ? props.rowCol : themeRowCol)]
  },
  { immediate: true }
)

const show = computed(() => props.loading == undefined || props.loading === true)
</script>


/*
 * wd-skeleton — 骨架屏
 *
 * Lynx 实现说明：
 * - 行列结构由 rowCol 配置驱动（数字或 { width, height, shape }）；
 * - 动画经 opacity 呼吸实现（flashing / pulse；gradient 在 Lynx 下
 *   降级为 flashing，渐变背景支持有限）；
 * - loading 为 false 时展示真实内容插槽。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { skeletonProps, type SkeletonRowCol } from './types'
import { isNumber, isObj, parseStyle } from '../../common/util'

const props = defineProps(skeletonProps)

const DEFAULT_ROWS = 4

/** 解析 rowCol 为二维结构（统一归一化为 { class, style }） */
const parsedRowCols = computed(() => {
  const rows: SkeletonRowCol[] = props.rowCol.length > 0 ? (props.rowCol as SkeletonRowCol[]) : [DEFAULT_ROWS]
  return rows.map((row: SkeletonRowCol) => {
    if (isNumber(row)) {
      // 数字：一行 N 个默认块
      return Array.from({ length: row }, () => ({ class: 'wd-skeleton__col', style: {} as Record<string, string> }))
    }
    // 对象配置：宽度/高度/形状
    if (isObj(row)) {
      const config = row as Record<string, any>
      // 尺寸配置 → 对象样式（字符串 :style 会被丢弃，CONVENTIONS §19）
      const style: Record<string, string> = {}
      Object.entries(config)
        .filter(([k]) => ['width', 'height', 'size'].includes(k))
        .forEach(([k, v]) => {
          style[k === 'size' ? 'width' : k] = typeof v === 'number' ? `${v}px` : String(v)
        })
      return [{ class: 'wd-skeleton__col', style }]
    }
    return [{ class: 'wd-skeleton__col', style: {} as Record<string, string> }]
  })
})

const animationClass = computed(() => {
  return props.animation && props.animation !== 'none' ? `wd-skeleton--${props.animation}` : ''
})
</script>

<template>
  <view :class="`wd-skeleton ${animationClass} ${round ? 'is-round' : ''} ${customClass}`" :style="parseStyle(customStyle)">
    <view v-if="loading" class="wd-skeleton__content">
      <view v-for="(row, index) of parsedRowCols" :key="`row-${index}`" class="wd-skeleton__row">
        <view v-for="(col, idx) of row" :key="`col-${idx}`" :class="col.class" :style="col.style" />
      </view>
    </view>
    <slot v-else />
  </view>
</template>

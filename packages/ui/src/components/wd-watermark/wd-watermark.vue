/*
 * wd-watermark — 水印
 *
 * Lynx 实现说明：平铺层由重复的水印单元组成（position: absolute
 * 网格布局），文字/图片两种模式；pointer-events 不拦截交互。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { watermarkProps } from './types'
import { objToStyle } from '../../common/util'

const props = defineProps(watermarkProps)

/** 平铺网格：按容器 100% 重复排布 */
const tiles = computed(() => {
  // 简化：固定 3×4 平铺单元，水印层 absolute 覆盖
  const cols = 3
  const rows = 4
  const result: Array<{ col: number; row: number }> = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result.push({ col: c, row: r })
    }
  }
  return result
})

const unitStyle = computed(() => {
  const style: Record<string, string> = {
    width: `${props.width}px`,
    height: `${props.height}px`
  }
  if (props.image) {
    style['background-image'] = `url(${props.image})`
    style['background-size'] = `${props.imageWidth}px ${props.imageHeight}px`
  }
  return objToStyle(style)
})

const textStyle = computed(() => {
  return objToStyle({
    'font-size': `${props.fontSize}px`,
    color: props.color,
    opacity: String(props.opacity),
    transform: `rotate(${props.rotate}deg)`
  })
})
</script>

<template>
  <view :class="`wd-watermark ${customClass}`" :style="customStyle">
    <slot />
    <view class="wd-watermark__layer">
      <view
        v-for="(tile, index) in tiles"
        :key="index"
        class="wd-watermark__unit"
        :style="unitStyle"
      >
        <text v-if="content && !image" class="wd-watermark__text" :style="textStyle">{{ content }}</text>
      </view>
    </view>
  </view>
</template>

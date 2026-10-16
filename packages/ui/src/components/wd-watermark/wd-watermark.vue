/*
 * wd-watermark — 水印
 *
 * Lynx 实现说明：
 * - 平铺层由重复的水印单元组成（position: absolute 网格布局），
 *   文字/图片两种模式；pointer-events 不拦截交互；
 * - gutterX/gutterY 纳入单元宽高计算（单元占位 = 内容 + 间距）；
 * - 平铺行列数按容器尺寸动态计算：挂载后经 getRect 一次性度量容器
 *   （CONVENTIONS §16：不在热路径度量），度量不可用时回退常见屏幕
 *   尺寸（375×667）；props 变化时随 computed 重算。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, ref } from 'vue-lynx'
import { watermarkProps } from './types'
import { getRect, parseStyle, filterStyle } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(watermarkProps)
const isAlive = useAlive()
const { proxy } = getCurrentInstance() as any

/** 容器尺寸（度量失败 / 未度量时回退常见手机屏幕尺寸） */
const FALLBACK_WIDTH = 375
const FALLBACK_HEIGHT = 667
const containerSize = ref({ width: 0, height: 0 })

onMounted(() => {
  getRect('.wd-watermark', false, proxy).then((rect: any) => {
    // 度量回调晚于卸载落地时丢弃（真机 9902 晚到 patch 家族）
    if (!isAlive()) return
    const width = Number(rect && rect.width) || 0
    const height = Number(rect && rect.height) || 0
    if (width > 0 || height > 0) {
      containerSize.value = { width, height }
    }
  })
})

/** 平铺网格：单元占位含 gutter，按容器尺寸算行列数铺满整个容器 */
const tiles = computed(() => {
  const unitWidth = Math.max(props.width + props.gutterX, 1)
  const unitHeight = Math.max(props.height + props.gutterY, 1)
  const containerWidth = containerSize.value.width || FALLBACK_WIDTH
  const containerHeight = containerSize.value.height || FALLBACK_HEIGHT
  const cols = Math.max(1, Math.ceil(containerWidth / unitWidth))
  const rows = Math.max(1, Math.ceil(containerHeight / unitHeight))
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
    width: `${props.width + props.gutterX}px`,
    height: `${props.height + props.gutterY}px`
  }
  if (props.image) {
    style['background-image'] = `url(${props.image})`
    style['background-size'] = `${props.imageWidth}px ${props.imageHeight}px`
  }
  return filterStyle(style)
})

const textStyle = computed(() => {
  return {
    'font-size': `${props.fontSize}px`,
    color: props.color,
    opacity: String(props.opacity),
    transform: `rotate(${props.rotate}deg)`
  }
})
</script>

<template>
  <view :class="`wd-watermark ${customClass}`" :style="parseStyle(customStyle)">
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

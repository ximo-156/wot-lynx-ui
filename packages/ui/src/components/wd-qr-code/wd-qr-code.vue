/*
 * wd-qr-code — 二维码
 *
 * Lynx 实现说明：
 * - Lynx 无 canvas 2D API，二维码用 SVG rect 平铺实现（白名单元素，
 *   CONVENTIONS §8）；
 * - 编码由 qr-encoder.ts 在后台线程完成（Byte 模式 / 版本自适应 /
 *   Reed-Solomon 纠错 / 掩码评估）；
 * - 渐变降级为纯色（SVG 元素白名单外元素）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { qrCodeProps } from './types'
import { encodeQr } from './qr-encoder'
import { parseStyle, sanitizeSvgContent } from '../../common/util'

const props = defineProps(qrCodeProps)

const qrSize = computed(() => Number(props.size) || 200)

const matrix = computed(() => {
  if (!props.text) return null
  try {
    return encodeQr(props.text)
  } catch (error) {
    console.warn('[wd-qr-code] encode failed:', error)
    return null
  }
})

const svgContent = computed(() => {
  const m = matrix.value
  if (!m) return ''
  const cell = qrSize.value / m.size
  let rects = ''
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (m.rows[r][c]) {
        rects += `<rect x="${(c * cell).toFixed(2)}" y="${(r * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`
      }
    }
  }
  return sanitizeSvgContent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qrSize.value} ${qrSize.value}" width="${qrSize.value}" height="${qrSize.value}">` +
      `<rect width="${qrSize.value}" height="${qrSize.value}" fill="${props.background}"/>` +
      `<g fill="${props.color}">${rects}</g>` +
      `</svg>`
  )
})
</script>

<template>
  <view :class="`wd-qr-code ${customClass}`" :style="parseStyle(customStyle)">
    <svg v-if="svgContent" :content="svgContent" :style="{ width: `${qrSize}px`, height: `${qrSize}px` }" />
    <view v-else class="wd-qr-code__empty" :style="{ width: `${qrSize}px`, height: `${qrSize}px` }">
      <text class="wd-qr-code__empty-text">内容过长</text>
    </view>
  </view>
</template>

/*
 * wd-bar-code — 条形码
 *
 * Lynx 实现说明：
 * - Lynx 无 canvas 2D API，条码用 SVG rect 平铺实现（白名单元素，
 *   CONVENTIONS §8）；
 * - 编码采用 Code128（B 模式 + 校验位），码表与编码逻辑在 ./code128.ts
 *   （与 wd-qr-code 的 qr-encoder.ts 同分工，整表可在单测中对照规范）；
 * - 显示文本经原生 text 元素叠加。
 */
<script lang="ts" setup>
import './index.css'

import { computed, watch } from 'vue-lynx'
import { barCodeProps } from './types'
import { addUnit, parseStyle, sanitizeSvgContent } from '../../common/util'
import { createStyleResolver } from '../../common/style'
import { encodeCode128B } from './code128'

const props = defineProps(barCodeProps)

function dimension(value: number | string | undefined, fallback: number): number {
  const pixels = value === undefined ? fallback : parseFloat(addUnit(value))
  return Number.isFinite(pixels) && pixels > 0 ? pixels : fallback
}
const barWidth = computed(() => dimension(props.width, 300))
const barHeight = computed(() => dimension(props.height, 80))
const validText = computed(() => !/[^\x20-\x7e]/.test(props.text))
watch(() => props.text, () => {
  if (!validText.value) console.warn('[wd-bar-code] Code128 B supports printable ASCII (32-126) only; barcode omitted instead of changing the supplied text')
}, { immediate: true })
const resolveRootStyle = createStyleResolver()
const rootStyle = computed(() => resolveRootStyle(parseStyle(props.customStyle)))
function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 生成条带矩形 */
const bars = computed(() => {
  const text = props.text || ''
  if (!text || !validText.value) return []

  const bits = encodeCode128B(text)
  const totalModules = bits.length
  const moduleWidth = barWidth.value / totalModules
  const rects: Array<{ x: number; w: number }> = []
  let i = 0
  while (i < bits.length) {
    if (bits[i] === '1') {
      let j = i
      while (j < bits.length && bits[j] === '1') j++
      rects.push({ x: i * moduleWidth, w: (j - i) * moduleWidth })
      i = j
    } else {
      i++
    }
  }
  return rects
})

const svgContent = computed(() => {
  const rects = bars.value
    .map((r) => `<rect x="${r.x.toFixed(2)}" y="0" width="${r.w.toFixed(2)}" height="${barHeight.value}" fill="${escapeAttribute(props.color)}"/>`)
    .join('')
  return sanitizeSvgContent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${barWidth.value} ${barHeight.value}" width="${barWidth.value}" height="${barHeight.value}">` +
      `<rect width="${barWidth.value}" height="${barHeight.value}" fill="${escapeAttribute(props.background)}"/>` +
      rects +
      `</svg>`
  )
})
</script>

<template>
  <view :class="`wd-bar-code ${customClass}`" :style="rootStyle">
    <svg v-if="validText" :content="svgContent" :style="{ width: `${barWidth}px`, height: `${barHeight}px` }" />
    <text v-if="showText" class="wd-bar-code__text" :style="{ 'font-size': `${fontSize}px`, color }">{{ text }}</text>
  </view>
</template>

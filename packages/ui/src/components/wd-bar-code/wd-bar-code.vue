/*
 * wd-bar-code — 条形码
 *
 * Lynx 实现说明：
 * - Lynx 无 canvas 2D API，条码用 SVG rect 平铺实现（白名单元素，
 *   CONVENTIONS §8）；
 * - 编码采用 Code128（B 模式 + 校验位）；
 * - 显示文本经原生 text 元素叠加。
 */
<script lang="ts" setup>
import './index.css'

import { computed, watch } from 'vue-lynx'
import { barCodeProps } from './types'
import { addUnit, parseStyle, sanitizeSvgContent } from '../../common/util'
import { createStyleResolver } from '../../common/style'

const props = defineProps(barCodeProps)

/**
 * Code128 码表（ISO/IEC 15417，value 0-102 → 11 模块位流）。
 * value = 字符码 - 32（Code128 B 模式，可打印 ASCII 32-126）。
 * 历史版本从 value 30 起整体错误且缺失 89-102，导致条码不可扫
 * （ZXing 实证：12345/ABC123/HELLO 全部解码失败），已整体替换为标准表。
 */
const CODE_PATTERNS: string[] = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110'
]
const START_B = '11010010000' // value 104
const STOP = '1100011101011' // value 106（13 模块）

/** 计算 Code128 校验位 */
function checksum(values: number[]): number {
  let sum = values[0]
  for (let i = 1; i < values.length; i++) {
    sum += values[i] * i
  }
  return sum % 103
}

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

  const values: number[] = [104] // START B
  for (const ch of text) values.push(ch.charCodeAt(0) - 32)
  values.push(checksum(values))

  let bits = START_B
  for (const v of values.slice(1)) {
    const pattern = CODE_PATTERNS[v]
    if (!pattern) {
      // 越界 value（正常路径不会出现）：告警而非静默回退成空格图案
      console.warn('[wd-bar-code] Code128 校验位越界:', v)
    }
    bits += pattern || CODE_PATTERNS[0]
  }
  bits += STOP

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

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

import { computed } from 'vue-lynx'
import { barCodeProps } from './types'
import { parseStyle, sanitizeSvgContent } from '../../common/util'

const props = defineProps(barCodeProps)

/** Code128 B 模式码表（value 0-94 → 位流） */
const CODE_PATTERNS: string[] = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11110010100', '11100111000', '11101000110', '11100011010', '11101111010',
  '11010000110', '11000011010', '11001010010', '11100010010', '11101011000',
  '11100101010', '11100010110', '11100010010', '11100001000', '11100001010',
  '11100011000', '11100100100', '11100100010', '11100100010', '11100010000',
  '11100000100', '11100000100', '11010001000', '11001001000', '11001010000',
  '11010010000', '11010011000', '11000101000', '11010100000', '11010001000',
  '11000110000', '11101001000', '11100001000', '11100011000', '11100010000',
  '11100001000', '11100101000', '11100100100', '11100100010', '11100010000',
  '11100000100', '11100000100', '11010000100', '11010001000', '11010010000',
  '11010011000', '11000101000', '11010100000', '11010001000', '11000110000',
  '11101001000', '11100001000', '11100011000', '11100010000', '11100001000',
  '11100101000', '11100100100', '11100100010', '11100010000'
]
const START_B = '11010010000'
const STOP = '1100011101011'

/** 计算 Code128 校验位 */
function checksum(values: number[]): number {
  let sum = values[0]
  for (let i = 1; i < values.length; i++) {
    sum += values[i] * i
  }
  return sum % 103
}

const barWidth = computed(() => Number(props.width) || 300)
const barHeight = computed(() => Number(props.height) || 80)

/** 生成条带矩形 */
const bars = computed(() => {
  const text = props.text || ''
  if (!text) return []

  const values: number[] = [104] // START B
  for (const ch of text) {
    values.push(Math.min(Math.max(ch.charCodeAt(0) - 32, 0), 94))
  }
  values.push(checksum(values))

  let bits = START_B
  for (const v of values.slice(1)) {
    bits += CODE_PATTERNS[v] || CODE_PATTERNS[0]
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
    .map((r) => `<rect x="${r.x.toFixed(2)}" y="0" width="${r.w.toFixed(2)}" height="${barHeight.value}" fill="${props.color}"/>`)
    .join('')
  return sanitizeSvgContent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${barWidth.value} ${barHeight.value}" width="${barWidth.value}" height="${barHeight.value}">` +
      `<rect width="${barWidth.value}" height="${barHeight.value}" fill="${props.background}"/>` +
      rects +
      `</svg>`
  )
})
</script>

<template>
  <view :class="`wd-bar-code ${customClass}`" :style="parseStyle(customStyle)">
    <svg :content="svgContent" :style="{ width: `${barWidth}px`, height: `${barHeight}px` }" />
    <text v-if="showText" class="wd-bar-code__text" :style="{ 'font-size': `${fontSize}px`, color }">{{ text }}</text>
  </view>
</template>

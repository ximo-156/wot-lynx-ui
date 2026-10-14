/*
 * wd-watermark — 水印
 *
 * Lynx 适配说明：
 * - wot-ui 原实现依赖 uni.createCanvasContext / uni.createOffscreenCanvas /
 *   document.createElement + Canvas 2D API 绘制水印后转为图片，
 *   Lynx 无 canvas 元素与 Canvas 2D API，也没有 uni / document 全局对象，
 *   改为在后台线程用纯 JS 生成水印 SVG 标记（文字模式：旋转的 text 元素；
 *   图片模式：image 元素；均支持 layout="staggered" 错位布局、rotate 旋转、
 *   gutterX/gutterY 间距等全部 props），
 *   再将 SVG 转换为 data URI（data:image/svg+xml;utf8,...，括号与单引号额外编码，
 *   避免破坏 CSS url('...') 解析），通过 rootStyle 的
 *   backgroundImage + backgroundSize 平铺——与 wot-ui 将 canvas.toDataURL()
 *   设为 backgroundImage 的视觉行为一致。
 * - Lynx 无 Canvas 的 measureText，文本宽度改为按字符估算（中日韩/全角按 1em、
 *   其余按 0.55em）实现自动换行，换行位置与 wot-ui 近似。
 * - 移除了模板中的 canvas 元素与全部 uni.* / document.* 调用，
 *   canvasId / canvasWidth / canvasHeight / showCanvas 等 canvas 状态一并删除；
 *   props 定义（types.ts）与 wot-ui 完全一致，未做改动。
 */
<script setup lang="ts">
import './index.css'

import { computed } from 'vue-lynx'
import { addUnit, buildUrlWithParams, isBase64Image, isDef, objToStyle, styleToObject, type CSSProperties } from '../../common/util'
import { watermarkProps, type WatermarkProps } from './types'

const props = defineProps(watermarkProps)

/**
 * 水印css类
 */
const rootClass = computed(() => {
  let classess: string = 'wd-watermark'
  if (props.fullScreen) {
    classess = `${classess} is-fullscreen`
  }
  return `${classess} ${props.customClass}`
})

/**
 * 水印样式
 */
const rootStyle = computed(() => {
  let width = props.width + props.gutterX
  if (props.layout === 'staggered') {
    width *= 2
  }
  const style: CSSProperties = {
    backgroundSize: addUnit(width),
    zIndex: props.zIndex
  }
  if (isDef(props.opacity)) {
    style['opacity'] = props.opacity
  }
  if (waterMarkUrl.value) {
    style['backgroundImage'] = `url('${waterMarkUrl.value}')`
  }
  return `${objToStyle(style)}${props.customStyle}`
})

/**
 * 生成水印 SVG 并转换为 data URI
 * 替代 wot-ui 的 canvas.toDataURL()，作为 backgroundImage 平铺
 */
const waterMarkUrl = computed(() => {
  const svg = createWaterMarkSvg(props)
  return toSvgDataUri(svg)
})

/**
 * 将 SVG 标记转换为 data URI
 * encodeURIComponent 不会编码括号与单引号，而它们会破坏 CSS url('...') 的解析
 * （SVG 的 transform="translate(50 50)" 等语法天然包含括号），因此补充编码
 * @param {string} svg SVG 标记
 * @returns {string} data URI
 */
function toSvgDataUri(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/'/g, '%27')
  return `data:image/svg+xml;utf8,${encoded}`
}

/**
 * 创建水印 SVG 标记（替代 wot-ui 的 createWaterMark 系列 canvas 绘制函数）
 * @param {WatermarkProps} options 水印配置
 * @returns {string} 水印 SVG 标记
 */
function createWaterMarkSvg(options: WatermarkProps): string {
  const { width, height, gutterX, gutterY, layout } = options
  const cols = layout === 'staggered' ? 2 : 1
  const rows = layout === 'staggered' ? 2 : 1
  const tileWidth = (width + gutterX) * cols
  const tileHeight = (height + gutterY) * rows

  // 与 wot-ui 一致：staggered 布局绘制两个水印（左上、右下），grid 布局绘制一个
  const draws = layout === 'staggered' ? 2 : 1
  const items: string[] = []
  for (let i = 0; i < draws; i++) {
    const offsetX = i === 1 ? tileWidth / cols : 0
    const offsetY = i === 1 ? tileHeight / rows : 0
    items.push(options.image ? createImageItem(options, offsetX, offsetY) : createTextItem(options, offsetX, offsetY))
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}">${items.join('')}</svg>`
}

/**
 * 生成文字水印节点（替代 wot-ui 的 drawTextOffScreen / drawTextOnScreen）
 * @param {WatermarkProps} options 水印配置
 * @param {number} offsetX 当前水印在瓦片中的水平偏移
 * @param {number} offsetY 当前水印在瓦片中的垂直偏移
 * @returns {string} 旋转的 text 节点标记
 */
function createTextItem(options: WatermarkProps, offsetX: number, offsetY: number): string {
  const { width, height, color, size, fontStyle, fontWeight, fontFamily, content, rotate } = options
  const contentWidth = width
  const contentHeight = height
  const fontSize = size

  const lines = getWrappedLines(content, contentWidth, fontSize)
  const lineHeight = fontSize * 1.2
  const totalHeight = lines.length * lineHeight
  const startY = -totalHeight / 2 + lineHeight / 2

  const texts = lines
    .map(
      (line, index) =>
        `<text x="0" y="${startY + index * lineHeight}" fill="${escapeXml(color)}" font-size="${fontSize}" font-family="${escapeXml(fontFamily)}" font-style="${fontStyle}" font-weight="${escapeXml(String(fontWeight))}" text-anchor="middle" dominant-baseline="middle">${escapeXml(line)}</text>`
    )
    .join('')

  return `<g transform="translate(${offsetX + contentWidth / 2} ${offsetY + contentHeight / 2}) rotate(${rotate})">${texts}</g>`
}

/**
 * 生成图片水印节点（替代 wot-ui 的 drawImageOffScreen / drawImageOnScreen）
 * @param {WatermarkProps} options 水印配置
 * @param {number} offsetX 当前水印在瓦片中的水平偏移
 * @param {number} offsetY 当前水印在瓦片中的垂直偏移
 * @returns {string} 旋转的 image 节点标记
 */
function createImageItem(options: WatermarkProps, offsetX: number, offsetY: number): string {
  const { width, height, image, imageHeight, imageWidth, rotate } = options
  const contentWidth = width
  const contentHeight = height

  // 与 wot-ui 一致：非 base64 图片追加时间戳参数避免缓存
  const src = isBase64Image(image) ? image : buildUrlWithParams(image, { timestamp: `${new Date().getTime()}` })

  return `<g transform="translate(${offsetX + contentWidth / 2} ${offsetY + contentHeight / 2}) rotate(${rotate})"><image href="${escapeXml(src)}" x="${-imageWidth / 2}" y="${-imageHeight / 2}" width="${imageWidth}" height="${imageHeight}"/></g>`
}

/**
 * 计算文本换行（替代 wot-ui 基于 ctx.measureText 的 getWrappedLines）
 * @param {string} text 需要处理换行的文本
 * @param {number} maxWidth 最大文本宽度
 * @param {number} fontSize 字体大小
 * @returns {string[]} 分行后的文本数组
 */
function getWrappedLines(text: string, maxWidth: number, fontSize: number): string[] {
  const lines: string[] = []
  let currentLine = ''

  // content / color / fontFamily 可能被显式传 null，text.length 会抛 TypeError，
  // 而本函数由 rootStyle/waterMarkUrl computed（渲染路径）调用
  const safeText = text == null ? '' : String(text)

  for (let i = 0; i < safeText.length; i++) {
    const char = safeText[i]
    const testLine = currentLine + char
    const width = getTextWidth(testLine, fontSize)

    if (width > maxWidth && i > 0) {
      lines.push(currentLine)
      currentLine = char
    } else {
      currentLine = testLine
    }
  }
  lines.push(currentLine)

  return lines
}

/**
 * 估算文本宽度（Lynx 无 Canvas 的 measureText）
 * 中日韩及全角字符按 1em 估算，其余字符按 0.55em 估算
 * @param {string} text 需要测量的文本
 * @param {number} fontSize 字体大小
 * @returns {number} 文本宽度
 */
function getTextWidth(text: string, fontSize: number): number {
  let width = 0
  for (const char of text) {
    width += isFullWidthChar(char) ? fontSize : fontSize * 0.55
  }
  return width
}

/**
 * 是否全角字符（中日韩、全角符号等）
 */
function isFullWidthChar(char: string): boolean {
  const code = char.codePointAt(0) || 0
  return (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0xa4cf) || // CJK 部首、符号、中日韩统一表意文字等
    (code >= 0xac00 && code <= 0xd7a3) || // Hangul 音节
    (code >= 0xf900 && code <= 0xfaff) || // CJK 兼容表意文字
    (code >= 0xfe30 && code <= 0xfe4f) || // CJK 兼容形式
    (code >= 0xff00 && code <= 0xff60) || // 全角形式
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x20000 && code <= 0x3fffd) // CJK 扩展 B 及以后
  )
}

/**
 * XML 特殊字符转义（水印内容与图片地址均可能包含）
 */
function escapeXml(value: string): string {
  // value 可能为 null（color / fontFamily / image 被显式传 null），
  // null.replace 会抛 TypeError 并崩掉渲染路径
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
</script>

<template>
  <view :class="rootClass" :style="styleToObject(rootStyle)"></view>
</template>

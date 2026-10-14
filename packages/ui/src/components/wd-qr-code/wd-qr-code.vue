/*
 * wd-qr-code — 二维码
 *
 * Lynx 适配说明：
 * - wot-ui 基于 canvas 2d + uni.createCanvasContext / uni.canvasToTempFilePath 绘制，
 *   Lynx 无 canvas 元素、无 Canvas 2D API、无 uni 全局对象，真机无法工作。
 *   现改为纯 SVG 实现：后台线程用 JS 将 generateQRCode 生成的矩阵渲染为 svg 元素
 *   content 字符串，模板用 svg 元素 + :content 渲染，与 wd-icon / wd-loading 的 SVG 范式一致。
 * - 每个 dark 模块一个矩形（square 且 dotScale 为 1 时按行合并连续段以减少节点）；
 *   dots 用 circle、rounded 用带圆角的 rect、liquid 用按邻域裁剪圆角的 path。
 * - 渐变降级为纯色：Lynx 引擎的 SVG content 解析器不支持 linearGradient / stop / defs
 *   元素，真机上 PaintingContext.insertNode 会抛 "unknown child signature" 致命异常
 *   （错误码 9902），enableGradient 时退化为 gradientColors 首个颜色 / colorDark 纯色，
 *   API 保持兼容（导出内容仍为标准 SVG，可含渐变）。
 * - backgroundImage 改用 svg 下方绝对定位的原生 image 元素承载（与 logo 同一范式），
 *   svg content 内不内嵌 image 元素，避免宿主 SVG 能力差异导致节点插入失败；
 *   logo 降级为在 svg 上方叠加绝对定位的原生 image 元素 + view 背景框，保持 wot-ui 的
 *   logo 背景色 / 边框 / 圆角视觉（原生 image 稳定支持圆角与边框，避免依赖 svg 内嵌 image）。
 * - exportImage 不再走 uni.canvasToTempFilePath，改为返回 SVG data URI
 *   （data:image/svg+xml;utf8, + encodeURIComponent）；导出内容内嵌 logo 与背景图。
 * - 未使用设备像素比：SVG 为矢量图形，按 viewBox 缩放即清晰，无需 getSystemInfo。
 */
<script setup lang="ts">
import './index.css'

import { computed, watch } from 'vue-lynx'
import { addUnit, objToStyle, sanitizeSvgContent, styleToObject, uuid, type CSSProperties } from '../../common/util'
import { generateQRCode, QRErrorCorrectLevel } from './qrcode'
import { qrCodeProps, type QrCodeExpose } from './types'

const props = defineProps(qrCodeProps)
const emit = defineEmits<{
  click: [event: Event]
  error: [error: unknown]
}>()

// logo 裁剪 id 每实例生成一次，导出路径的渐变 id 由其派生，
// 避免同页多个二维码的 svg content id 冲突
const logoClipId = `wdqrlogo-${uuid()}`

const rootClass = computed(() => `wd-qr-code ${props.customClass}`)

/** XML 属性值转义，避免颜色 / URL 中的特殊字符破坏 svg content */
function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrapSvg(defs: string[], body: string[]): string {
  const size = props.size
  const defsStr = defs.length ? `<defs>${defs.join('')}</defs>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${defsStr}${body.join('')}</svg>`
}

/**
 * 码点填充色：enableGradient 时（渲染路径）降级为 gradientColors 首个颜色 / colorDark 纯色。
 * Lynx 引擎的 SVG content 解析器不支持 linearGradient / stop / defs 元素，
 * 真机上会抛 PaintingContext.insertNode "unknown child signature" 致命异常，
 * 因此渲染路径只输出纯色 fill（API 兼容，视觉降级；导出内容仍走标准 SVG 渐变）。
 */
function resolveModuleFill(): string {
  if (!props.enableGradient) return escapeXml(props.colorDark)
  const colors = props.gradientColors
  return escapeXml(colors.length > 0 ? colors[0] : props.colorDark)
}

/**
 * 依据 gradientDirection / gradientColors 生成 linearGradient，返回 fill 引用。
 * 仅导出路径（data URI，宿主按标准 SVG 解码）使用；渲染路径禁用，
 * 因为 Lynx 引擎 SVG content 解析器不支持 linearGradient / stop / defs 元素。
 */
function buildGradientDef(defs: string[]): string {
  const size = props.size
  const dir = props.gradientDirection
  let x1 = 0
  let y1 = 0
  let x2 = size
  let y2 = size

  if (dir === 'horizontal') {
    x2 = size
    y2 = 0
  } else if (dir === 'vertical') {
    x2 = 0
    y2 = size
  } else if (typeof dir === 'number') {
    const angle = (dir * Math.PI) / 180
    const center = size / 2
    const radius = (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle))) * center
    x1 = center - Math.cos(angle) * radius
    y1 = center - Math.sin(angle) * radius
    x2 = center + Math.cos(angle) * radius
    y2 = center + Math.sin(angle) * radius
  }

  const colors = props.gradientColors
  const stops =
    colors.length > 0
      ? colors.map((color, index) => `<stop offset="${index / Math.max(colors.length - 1, 1)}" stop-color="${escapeXml(color)}"/>`).join('')
      : `<stop offset="0" stop-color="${escapeXml(props.colorDark)}"/><stop offset="1" stop-color="${escapeXml(props.gradientColor)}"/>`

  defs.push(`<linearGradient id="${logoClipId}-grad" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`)
  return `url(#${logoClipId}-grad)`
}

/** 生成带独立圆角的矩形 path（liquid 码点使用） */
function roundedRectPath(x: number, y: number, width: number, height: number, corners: [number, number, number, number]): string {
  const [tl, tr, br, bl] = corners
  return (
    `M${x + tl},${y}` +
    `L${x + width - tr},${y}A${tr},${tr} 0 0 1 ${x + width},${y + tr}` +
    `L${x + width},${y + height - br}A${br},${br} 0 0 1 ${x + width - br},${y + height}` +
    `L${x + bl},${y + height}A${bl},${bl} 0 0 1 ${x},${y + height - bl}` +
    `L${x},${y + tl}A${tl},${tl} 0 0 1 ${x + tl},${y}Z`
  )
}

/** 将二维码矩阵渲染为 svg 图形序列 */
function renderModules(modules: boolean[][], fill: string): string {
  const size = props.size
  const margin = props.margin
  const count = modules.length
  const tileW = (size - margin * 2) / count
  const tileH = (size - margin * 2) / count
  const out: string[] = []
  const has = (row: number, col: number) => row >= 0 && row < count && col >= 0 && col < modules[row].length && modules[row][col]

  if (props.dotType === 'square' && props.dotScale === 1) {
    // 按行合并连续 dark 段，减少节点数量
    for (let row = 0; row < count; row++) {
      let runStart = -1
      for (let col = 0; col <= modules[row].length; col++) {
        if (modules[row][col]) {
          if (runStart === -1) runStart = col
          continue
        }
        if (runStart === -1) continue
        const x = Math.ceil(runStart * tileW) + margin
        const y = Math.ceil(row * tileH) + margin
        const width = Math.ceil(col * tileW) - Math.ceil(runStart * tileW)
        const height = Math.ceil((row + 1) * tileH) - Math.ceil(row * tileH)
        out.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}"/>`)
        runStart = -1
      }
    }
  } else {
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < modules[row].length; col++) {
        if (!modules[row][col]) continue

        const x = Math.ceil(col * tileW) + margin
        const y = Math.ceil(row * tileH) + margin
        const width = Math.ceil((col + 1) * tileW) - Math.ceil(col * tileW)
        const height = Math.ceil((row + 1) * tileH) - Math.ceil(row * tileH)
        const scaledWidth = width * props.dotScale
        const scaledHeight = height * props.dotScale
        const scaledX = x + (width - scaledWidth) / 2
        const scaledY = y + (height - scaledHeight) / 2

        if (props.dotType === 'dots') {
          out.push(`<circle cx="${scaledX + scaledWidth / 2}" cy="${scaledY + scaledHeight / 2}" r="${scaledWidth / 2}"/>`)
        } else if (props.dotType === 'rounded') {
          out.push(`<rect x="${scaledX}" y="${scaledY}" width="${scaledWidth}" height="${scaledHeight}" rx="${scaledWidth * 0.25}" ry="${scaledWidth * 0.25}"/>`)
        } else if (props.dotType === 'liquid') {
          const radius = scaledWidth * 0.5
          const tl = !has(row - 1, col) && !has(row, col - 1) ? radius : 0
          const tr = !has(row - 1, col) && !has(row, col + 1) ? radius : 0
          const br = !has(row + 1, col) && !has(row, col + 1) ? radius : 0
          const bl = !has(row + 1, col) && !has(row, col - 1) ? radius : 0
          out.push(`<path d="${roundedRectPath(scaledX, scaledY, scaledWidth, scaledHeight, [tl, tr, br, bl])}"/>`)
        } else {
          out.push(`<rect x="${scaledX}" y="${scaledY}" width="${scaledWidth}" height="${scaledHeight}"/>`)
        }
      }
    }
  }

  return `<g fill="${fill}">${out.join('')}</g>`
}

/** 导出用：把 logo 背景框 + logo 图片内嵌进 svg（含圆角裁剪） */
function renderLogoEmbed(defs: string[], body: string[]): void {
  const size = props.size
  const logoWidth = props.logoWidth || size * 0.2
  const logoHeight = props.logoHeight || logoWidth
  const logoX = (size - logoWidth) / 2
  const logoY = (size - logoHeight) / 2
  const padding = 4
  const boxX = logoX - padding
  const boxY = logoY - padding
  const boxWidth = logoWidth + padding * 2
  const boxHeight = logoHeight + padding * 2
  const radius = props.logoRadius || 0
  const borderWidth = props.logoBorderWidth || 0
  const background = props.logoBackgroundColor || '#ffffff'
  const border = props.logoBorderColor || 'transparent'
  const stroke = borderWidth > 0 ? ` stroke="${escapeXml(border)}" stroke-width="${borderWidth}"` : ''

  body.push(`<rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="${radius}" ry="${radius}" fill="${escapeXml(background)}"${stroke}/>`)

  if (radius > 0) {
    const inner = Math.max(0, radius - padding)
    defs.push(`<clipPath id="${logoClipId}"><rect x="${logoX}" y="${logoY}" width="${logoWidth}" height="${logoHeight}" rx="${inner}" ry="${inner}"/></clipPath>`)
    body.push(`<image href="${escapeXml(props.logo)}" x="${logoX}" y="${logoY}" width="${logoWidth}" height="${logoHeight}" preserveAspectRatio="none" clip-path="url(#${logoClipId})"/>`)
  } else {
    body.push(`<image href="${escapeXml(props.logo)}" x="${logoX}" y="${logoY}" width="${logoWidth}" height="${logoHeight}" preserveAspectRatio="none"/>`)
  }
}

/** 组装二维码 svg content。embedImages 为 true 时把 logo / 背景图也内嵌（用于导出）。 */
function buildQrSvg(embedImages: boolean): { content: string; error?: unknown } {
  const size = props.size
  const defs: string[] = []
  const body: string[] = []

  // 码点填充色：渲染路径退化为纯色（引擎不支持 linearGradient），导出路径保留渐变
  const moduleFill = props.enableGradient && embedImages ? buildGradientDef(defs) : resolveModuleFill()

  // 背景矩形：渲染路径下存在背景图时交由原生 image 叠加层承载（svg content 不内嵌 image
  // 元素，避免宿主 SVG 解析器缺失该节点类型时 insertNode 致命异常）；导出路径仍内嵌。
  if (!props.backgroundImage || embedImages) {
    body.push(`<rect x="0" y="0" width="${size}" height="${size}" fill="${escapeXml(props.colorLight)}"/>`)
  }

  if (props.backgroundImage && embedImages) {
    body.push(`<image href="${escapeXml(props.backgroundImage)}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="none"/>`)
  }

  if (props.text) {
    try {
      const level = QRErrorCorrectLevel[props.correctLevel as keyof typeof QRErrorCorrectLevel] || QRErrorCorrectLevel.H
      const modules = generateQRCode(props.text, { errorCorrectLevel: level }).modules
      body.push(renderModules(modules, moduleFill))
    } catch (error) {
      return { content: wrapSvg(defs, body), error }
    }
  }

  if (embedImages && props.logo) {
    renderLogoEmbed(defs, body)
  }

  return { content: wrapSvg(defs, body) }
}

const qrBuild = computed(() => buildQrSvg(false))
// 渲染路径过白名单安全网：导出路径（buildQrSvg(true) → data URI）不受引擎 SVG 解析器约束
const svgContent = computed(() => sanitizeSvgContent(qrBuild.value.content))

watch(
  qrBuild,
  (build) => {
    if (build.error !== undefined) {
      emit('error', build.error)
    }
  },
  { immediate: true }
)

const svgStyle = computed(() => objToStyle({ width: addUnit(props.size), height: addUnit(props.size) }))

/**
 * 背景图叠加层样式：绝对定位铺满二维码区域，衬于 svg 之下（DOM 顺序 + 定位层级保证）。
 * Lynx 引擎 SVG content 不支持 image 元素（insertNode 未知签名致命异常），
 * 故背景图改用原生 image 元素承载，与 logo 同一范式。
 */
const bgImageStyle = computed(() => {
  if (!props.backgroundImage) return ''
  return objToStyle({
    position: 'absolute',
    left: '0px',
    top: '0px',
    width: addUnit(props.size),
    height: addUnit(props.size)
  })
})

function getLogoMetrics() {
  const size = props.size
  const logoWidth = props.logoWidth || size * 0.2
  const logoHeight = props.logoHeight || logoWidth
  const logoX = (size - logoWidth) / 2
  const logoY = (size - logoHeight) / 2
  const padding = 4
  return {
    boxX: logoX - padding,
    boxY: logoY - padding,
    boxWidth: logoWidth + padding * 2,
    boxHeight: logoHeight + padding * 2,
    logoWidth,
    logoHeight,
    radius: props.logoRadius || 0
  }
}

const logoBoxStyle = computed(() => {
  if (!props.logo) return ''
  const m = getLogoMetrics()
  const style: CSSProperties = {
    position: 'absolute',
    left: `${m.boxX}px`,
    top: `${m.boxY}px`,
    width: `${m.boxWidth}px`,
    height: `${m.boxHeight}px`,
    background: props.logoBackgroundColor || '#ffffff'
  }
  if (m.radius) style.borderRadius = `${m.radius}px`
  if (props.logoBorderWidth && props.logoBorderWidth > 0) {
    style.border = `${props.logoBorderWidth}px solid ${props.logoBorderColor || 'transparent'}`
  }
  return objToStyle(style)
})

const logoImageStyle = computed(() => {
  if (!props.logo) return ''
  const m = getLogoMetrics()
  const style: CSSProperties = {
    position: 'absolute',
    left: '4px',
    top: '4px',
    width: `${m.logoWidth}px`,
    height: `${m.logoHeight}px`
  }
  const inner = Math.max(0, m.radius - 4)
  if (inner > 0) style.borderRadius = `${inner}px`
  return objToStyle(style)
})

async function exportImage(): Promise<string> {
  const { content } = buildQrSvg(true)
  return `data:image/svg+xml;utf8,${encodeURIComponent(content)}`
}

function handleClick(event: Event) {
  emit('click', event)
}

defineExpose<QrCodeExpose>({
  exportImage
})
</script>

<template>
  <view :class="rootClass" :style="styleToObject(props.customStyle)" @tap="handleClick">
    <image v-if="props.backgroundImage" class="wd-qr-code__bg" :src="props.backgroundImage" :style="styleToObject(bgImageStyle)" />
    <svg class="wd-qr-code__svg" :style="styleToObject(svgStyle)" :content="svgContent" />
    <view v-if="props.logo" :style="styleToObject(logoBoxStyle)">
      <image :src="props.logo" :style="styleToObject(logoImageStyle)" />
    </view>
  </view>
</template>

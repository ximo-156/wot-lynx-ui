/*
 * wd-qr-code — 二维码
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 渲染载体：参考源基于 canvas 2D（uni.createCanvasContext / createSelectorQuery
 *   取 node），Lynx 无 canvas 2D API，改用原生 svg 元素的 content 渲染
 *   （CONVENTIONS §8 白名单元素：svg / g / path / rect），码点几何（ceil 对齐、
 *   dotScale 缩放、square 运行合并、dots / rounded / liquid 的圆弧路径）逐段
 *   复刻参考源的 canvas 绘制逻辑；
 * - 渐变降级：SVG content 的 linearGradient 不在 Lynx 白名单内（真机 9902
 *   致命异常），渲染路径降级为纯色（取首个色标）；exportImage 导出走标准 SVG
 *   data URI（不受白名单约束），保留渐变；
 * - logo / backgroundImage：参考源绘制在 canvas 上，本地改用原生 image 元素
 *   叠加（CONVENTIONS §8：图片不内嵌进 svg content），logo 的底色 / 圆角 /
 *   边框由 view 容器 + image 的 border-radius 承担；设置 backgroundImage 时
 *   svg 内不再铺 colorLight 底色（由背景图垫底，与参考源的绘制次序一致）；
 * - 事件映射：参考源 @click → @tap（CONVENTIONS §6）；根 view 绑 @tap，按
 *   CONVENTIONS §14 在 emits 声明 'tap' 并转发；
 * - 平台能力调用（uni.canvasToTempFilePath）无 Lynx 等价实现，exportImage
 *   降级为返回 SVG data URI（矢量导出，分辨率与 size 无关）；
 * - customStyle 为字符串，经 parseStyle 归一为对象语法（CONVENTIONS §19）；
 * - canvasId 绑定实际原生根节点；默认生成稳定唯一 id，可供宿主定位；
 * - 编码由同目录 qrcode.ts 承担（wot-ui 2.3.2 同源编码器：Byte 模式 / 版本
 *   1-40 自适应 / L/M/Q/H 四级纠错 / RS 纠错 / 掩码评估），在后台线程同步完成；
 * - 布局居中（NATIVE-REWRITE §3）：根 view 显式 display: flex +
 *   flex-direction: row + justify-content / align-items 成对居中（码图为唯一
 *   在流子元素）；logo 外框为四边定位的 flex 居中盒（display / flex-direction /
 *   align-items / justify-content 四件套齐全），背景图与 logo 均不参与流内布局。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import { qrCodeProps, type QrCodeExpose } from './types'
import { generateQRCode, QRErrorCorrectLevel } from './qrcode'
import { parseStyle, sanitizeSvgContent, uuid } from '../../common/util'
import { createStyleResolver } from '../../common/style'

const props = defineProps(qrCodeProps)
const emit = defineEmits<{
  click: [event: Event]
  error: [error: unknown]
  tap: [event: Event]
}>()

const rootClass = computed(() => `wd-qr-code ${props.customClass}`)
const automaticId = `wd-qr-code-${uuid()}`
const canvasId = computed(() => props.canvasId || automaticId)
const resolveRootStyle = createStyleResolver()
const rootStyle = computed(() => resolveRootStyle(parseStyle(props.customStyle)))
/** 属性写入 SVG 前转义，避免 URL 的 &/引号破坏 XML 或注入额外节点。 */
function xml(value: unknown): string {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;')
}

/** 二维码模块矩阵（未编码 / 编码失败时为 null） */
const modules = ref<boolean[][] | null>(null)

// 编码失败时抛 error 事件（与参考源 draw() 的 catch 分支一致）
watch(
  [() => props.text, () => props.correctLevel],
  () => {
    modules.value = null
    if (!props.text) return
    try {
      const errorCorrectLevel =
        QRErrorCorrectLevel[props.correctLevel as keyof typeof QRErrorCorrectLevel] ?? QRErrorCorrectLevel.H
      modules.value = generateQRCode(props.text, { errorCorrectLevel }).modules
    } catch (error) {
      emit('error', error)
    }
  },
  { immediate: true }
)

/** 数值收敛（path 字符串长度控制，2 位小数不影响几何） */
function n(value: number): number {
  return Math.round(value * 100) / 100
}

/** 渐变降级后的深色（渲染路径取首个色标，CONVENTIONS §8） */
const darkColor = computed(() => {
  if (!props.enableGradient) return props.colorDark
  return (props.gradientColors && props.gradientColors[0]) || props.colorDark
})

/** 码点边长（与参考源 tileW / tileH 一致） */
const tileSize = computed(() => {
  const count = modules.value ? modules.value.length : 0
  if (!count) return 0
  return (props.size - props.margin * 2) / count
})

/**
 * square 码点：按行做运行合并（对齐参考源 drawSquareModules 的 fillRect 批次）
 */
function squareModules(m: boolean[][], tile: number): string {
  let rects = ''
  for (let row = 0; row < m.length; row++) {
    let runStart = -1
    for (let col = 0; col <= m[row].length; col++) {
      if (m[row][col]) {
        if (runStart === -1) {
          runStart = col
        }
        continue
      }
      if (runStart === -1) continue

      const x = Math.ceil(runStart * tile) + props.margin
      const y = Math.ceil(row * tile) + props.margin
      const width = Math.ceil(col * tile) - Math.ceil(runStart * tile)
      const height = Math.ceil((row + 1) * tile) - Math.ceil(row * tile)
      rects += `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}"/>`
      runStart = -1
    }
  }
  return rects
}

/** 圆弧命令：半径为 0 时退化为直线（SVG 不接受 0 半径弧） */
function arcCmd(cx: number, cy: number, r: number, endX: number, endY: number): string {
  if (r <= 0) return `L${n(endX)} ${n(endY)}`
  return `A${n(r)} ${n(r)} 0 0 1 ${n(endX)} ${n(endY)}`
}

/** 整圆 → path 子路径（两段半弧，避免单段 360° 弧） */
function circlePath(cx: number, cy: number, r: number): string {
  if (r <= 0) return ''
  return `M${n(cx - r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 1 ${n(cx + r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 1 ${n(cx - r)} ${n(cy)}Z`
}

/**
 * 圆角矩形 → path 子路径。
 * 弧序列对齐参考源 drawRoundedRect 的 canvas arc 调用（顺时针，sweep=1）。
 */
function roundedRectPath(x: number, y: number, width: number, height: number, radius: number | number[]): string {
  const [tl, tr, br, bl] = Array.isArray(radius) ? radius : [radius, radius, radius, radius]
  let d = `M${n(x + tl)} ${n(y)}`
  d += `L${n(x + width - tr)} ${n(y)}`
  d += arcCmd(x + width - tr, y + tr, tr, x + width, y + tr)
  d += `L${n(x + width)} ${n(y + height - br)}`
  d += arcCmd(x + width - br, y + height - br, br, x + width - br, y + height)
  d += `L${n(x + bl)} ${n(y + height)}`
  d += arcCmd(x + bl, y + height - bl, bl, x, y + height - bl)
  d += `L${n(x)} ${n(y + tl)}`
  d += arcCmd(x + tl, y + tl, tl, x + tl, y)
  return `${d}Z`
}

/**
 * dots / rounded / liquid 码点：逐模块计算缩放几何（对齐参考源 draw() 的
 * else 分支），圆弧类码点合并进单个 path 子路径（对应参考源的
 * beginPath() → fill() 批次）。
 */
function dotModules(m: boolean[][], tile: number): string {
  const hasModule = (row: number, col: number) => {
    return row >= 0 && row < m.length && col >= 0 && col < m[row].length && m[row][col]
  }

  let rects = ''
  let d = ''
  for (let row = 0; row < m.length; row++) {
    for (let col = 0; col < m[row].length; col++) {
      if (!m[row][col]) continue

      const x = Math.ceil(col * tile) + props.margin
      const y = Math.ceil(row * tile) + props.margin
      const width = Math.ceil((col + 1) * tile) - Math.ceil(col * tile)
      const height = Math.ceil((row + 1) * tile) - Math.ceil(row * tile)
      const scaledWidth = width * props.dotScale
      const scaledHeight = height * props.dotScale
      const scaledX = x + (width - scaledWidth) / 2
      const scaledY = y + (height - scaledHeight) / 2

      if (props.dotType === 'dots') {
        const centerX = scaledX + scaledWidth / 2
        const centerY = scaledY + scaledHeight / 2
        const radius = scaledWidth / 2
        d += circlePath(centerX, centerY, radius)
        continue
      }

      if (props.dotType === 'rounded') {
        d += roundedRectPath(scaledX, scaledY, scaledWidth, scaledHeight, scaledWidth * 0.25)
        continue
      }

      if (props.dotType === 'liquid') {
        const radius = scaledWidth * 0.5
        const top = hasModule(row - 1, col)
        const bottom = hasModule(row + 1, col)
        const left = hasModule(row, col - 1)
        const right = hasModule(row, col + 1)
        const tl = !top && !left ? radius : 0
        const tr = !top && !right ? radius : 0
        const br = !bottom && !right ? radius : 0
        const bl = !bottom && !left ? radius : 0
        d += roundedRectPath(scaledX, scaledY, scaledWidth, scaledHeight, [tl, tr, br, bl])
        continue
      }

      // square + dotScale !== 1
      rects += `<rect x="${n(scaledX)}" y="${n(scaledY)}" width="${n(scaledWidth)}" height="${n(scaledHeight)}"/>`
    }
  }
  return rects + (d ? `<path d="${d}"/>` : '')
}

/** 渲染用 svg content（白名单元素；渐变降级为纯色） */
const svgContent = computed(() => {
  const m = modules.value
  const size = props.size
  let body = ''
  // 参考源先以 colorLight 铺满画布；设置背景图时由原生 image 垫底，
  // 这里不再铺底色（否则 svg 底色会盖住背景图）。
  if (!props.backgroundImage) {
    body += `<rect width="${n(size)}" height="${n(size)}" fill="${xml(props.colorLight)}"/>`
  }
  if (m && m.length) {
    const tile = (size - props.margin * 2) / m.length
    if (props.dotType === 'square' && props.dotScale === 1) {
      body += `<g fill="${xml(darkColor.value)}">${squareModules(m, tile)}</g>`
    } else {
      body += `<g fill="${xml(darkColor.value)}">${dotModules(m, tile)}</g>`
    }
  }
  return sanitizeSvgContent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(size)} ${n(size)}" width="${n(size)}" height="${n(size)}">${body}</svg>`
  )
})

const canvasStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`
}))

/** 背景图样式（绝对定位垫在 svg 下方，不参与布局） */
const backgroundImageStyle = computed<Record<string, string>>(() => ({
  position: 'absolute',
  left: '0px',
  top: '0px',
  width: `${props.size}px`,
  height: `${props.size}px`
}))

/** Logo 实际尺寸（对齐参考源 drawLogo 的兜底） */
const logoSize = computed(() => {
  const logoWidth = props.logoWidth || props.size * 0.2
  const logoHeight = props.logoHeight || logoWidth
  return { logoWidth, logoHeight }
})

/** Logo 外框样式（底色 / 边框 / 圆角，对应参考源 drawLogoContent 的盒子） */
const logoBoxStyle = computed<Record<string, string>>(() => {
  const { logoWidth, logoHeight } = logoSize.value
  const logoX = (props.size - logoWidth) / 2
  const logoY = (props.size - logoHeight) / 2
  const padding = 4
  return {
    position: 'absolute',
    left: `${logoX - padding}px`,
    top: `${logoY - padding}px`,
    width: `${logoWidth + padding * 2}px`,
    height: `${logoHeight + padding * 2}px`,
    'border-radius': `${props.logoRadius || 0}px`,
    'background-color': props.logoBackgroundColor || '#ffffff',
    'border-width': '0px',
    'box-sizing': 'border-box',
    display: 'flex',
    'flex-direction': 'row',
    'align-items': 'center',
    'justify-content': 'center'
  }
})

/** Logo 图片样式（内圈圆角对应参考源的 clip） */
const logoImageStyle = computed(() => {
  const { logoWidth, logoHeight } = logoSize.value
  const innerRadius = Math.max(0, (props.logoRadius || 0) - 4)
  return {
    width: `${logoWidth}px`,
    height: `${logoHeight}px`,
    'border-radius': `${innerRadius}px`
  }
})

const logoBorderStyle = computed<Record<string, string>>(() => {
  const border = Math.max(0, props.logoBorderWidth || 0)
  const { logoWidth, logoHeight } = logoSize.value
  return {
    position: 'absolute', left: `${-border / 2}px`, top: `${-border / 2}px`,
    width: `${logoWidth + 8 + border}px`, height: `${logoHeight + 8 + border}px`,
    'border-width': `${border}px`, 'border-style': 'solid',
    'border-color': props.logoBorderColor || 'transparent',
    'border-radius': `${Math.max(0, props.logoRadius || 0) + border / 2}px`,
    'box-sizing': 'border-box', 'pointer-events': 'none'
  }
})

/**
 * 渐变坐标（对齐参考源 createGradient 的方向换算）。
 * 仅 exportImage 的标准 SVG 使用（渲染路径降级为纯色）。
 */
function gradientCoords(): { x1: number; y1: number; x2: number; y2: number } {
  const size = props.size
  if (props.gradientDirection === 'horizontal') {
    return { x1: 0, y1: 0, x2: size, y2: 0 }
  }
  if (props.gradientDirection === 'vertical') {
    return { x1: 0, y1: 0, x2: 0, y2: size }
  }
  if (typeof props.gradientDirection === 'number') {
    const angle = (props.gradientDirection * Math.PI) / 180
    const center = size / 2
    const radius = (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle))) * center
    return {
      x1: center - Math.cos(angle) * radius,
      y1: center - Math.sin(angle) * radius,
      x2: center + Math.cos(angle) * radius,
      y2: center + Math.sin(angle) * radius
    }
  }
  return { x1: 0, y1: 0, x2: size, y2: size }
}

/** 渐变色标（对齐参考源 createGradientWithStops） */
function gradientStops(): string {
  if (props.gradientColors.length > 0) {
    const lastIndex = Math.max(props.gradientColors.length - 1, 1)
    return props.gradientColors
      .map((color, index) => `<stop offset="${n(index / lastIndex)}" stop-color="${xml(color)}"/>`)
      .join('')
  }
  return `<stop offset="0" stop-color="${xml(props.colorDark)}"/><stop offset="1" stop-color="${xml(props.gradientColor)}"/>`
}

/**
 * 导出二维码：Lynx 无 canvasToTempFilePath，降级为返回标准 SVG data URI
 * （矢量导出，不受 Lynx svg content 白名单约束，可保留渐变与图片）。
 */
async function exportImage(): Promise<string> {
  const m = modules.value
  if (!m || !m.length) {
    return Promise.reject(new Error('wd-qr-code: 没有可导出的二维码内容'))
  }
  const size = props.size
  const tile = (size - props.margin * 2) / m.length
  const fill = props.enableGradient ? 'url(#wot-qr-code-gradient)' : darkColor.value
  const defs = props.enableGradient
    ? (() => {
        const { x1, y1, x2, y2 } = gradientCoords()
        return `<defs><linearGradient id="wot-qr-code-gradient" gradientUnits="userSpaceOnUse" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}">${gradientStops()}</linearGradient></defs>`
      })()
    : ''
  const body =
    (props.backgroundImage ? '' : `<rect width="${n(size)}" height="${n(size)}" fill="${xml(props.colorLight)}"/>`) +
    (props.backgroundImage ? `<image preserveAspectRatio="none" href="${xml(props.backgroundImage)}" x="0" y="0" width="${n(size)}" height="${n(size)}"/>` : '') +
    `<g fill="${xml(fill)}">` +
    (props.dotType === 'square' && props.dotScale === 1 ? squareModules(m, tile) : dotModules(m, tile)) +
    `</g>` +
    (props.logo
      ? (() => {
          const { logoWidth, logoHeight } = logoSize.value
          const logoX = (size - logoWidth) / 2
          const logoY = (size - logoHeight) / 2
          const padding = 4
          const radius = props.logoRadius || 0
          const innerRadius = Math.max(0, radius - padding)
          const box = `<rect x="${n(logoX - padding)}" y="${n(logoY - padding)}" width="${n(logoWidth + padding * 2)}" height="${n(logoHeight + padding * 2)}" rx="${n(radius)}" fill="${xml(props.logoBackgroundColor || '#ffffff')}" stroke="${xml(props.logoBorderColor || 'transparent')}" stroke-width="${props.logoBorderWidth || 0}"/>`
          // 内圈圆角裁剪（对应参考源 drawLogoContent 的 ctx.clip()）：
          // 标准 SVG 的 clipPath 元素，导出路径不受 Lynx 白名单约束。
          const clip =
            innerRadius > 0
              ? `<clipPath id="wot-qr-code-logo-clip"><rect x="${n(logoX)}" y="${n(logoY)}" width="${n(logoWidth)}" height="${n(logoHeight)}" rx="${n(innerRadius)}"/></clipPath>`
              : ''
          const img = `<image preserveAspectRatio="none" href="${xml(props.logo)}" x="${n(logoX)}" y="${n(logoY)}" width="${n(logoWidth)}" height="${n(logoHeight)}"${clip ? ' clip-path="url(#wot-qr-code-logo-clip)"' : ''}/>`
          return clip + box + img
        })()
      : '')
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(size)} ${n(size)}" width="${n(size)}" height="${n(size)}">${defs}${body}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`
}

function handleClick(event: Event) {
  emit('click', event)
  // Lynx 事件惯用法：消费方在组件上绑 @tap 时作为组件事件被消费
  // （CONVENTIONS §14），同时保持 wot-ui 的 click API 对齐。
  emit('tap', event)
}

defineExpose<QrCodeExpose>({
  exportImage
})
</script>

<template>
  <view :id="canvasId" :class="rootClass" :style="rootStyle" @tap="handleClick">
    <image v-if="backgroundImage" :src="backgroundImage" :style="backgroundImageStyle" mode="scaleToFill" />
    <svg :content="svgContent" :style="canvasStyle" />
    <view v-if="logo" class="wd-qr-code__logo" :style="logoBoxStyle">
      <image :src="logo" :style="logoImageStyle" mode="scaleToFill" />
      <view class="wd-qr-code__logo-border" :style="logoBorderStyle" />
    </view>
  </view>
</template>

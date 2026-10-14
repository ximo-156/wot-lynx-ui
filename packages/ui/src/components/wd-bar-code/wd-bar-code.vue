/*
 * wd-bar-code — 条形码
 *
 * Lynx 适配说明：
 * - wot-ui 基于 canvas 2d + uni.createCanvasContext / uni.canvasToTempFilePath 绘制，
 *   Lynx 无 canvas 元素、无 Canvas 2D API、无 uni 全局对象，真机无法工作。
 *   现改为纯 SVG 实现：后台线程用 JS 将 JsBarcode 编码结果渲染为条矩形序列，
 *   模板用 svg 元素 + :content 渲染（与 wd-icon 的 SVG 范式一致）。
 * - 尺寸 / 编码解析 / 条几何 / 字号自适应逻辑沉淀在 barCodeRender.ts 的纯函数
 *   buildBarCodeSvgModel 中（复用 resolveBarCodeRenderSize），无 canvas 依赖；
 *   文本宽度用等宽近似估算替代 measureText。
 * - 显示文本降级为 svg 上方绝对定位的原生 text 元素叠加层（Lynx text 稳定支持
 *   text-align / 颜色 / 字号），避免依赖 svg 内嵌 text 的渲染能力；
 *   EAN13/EAN8/UPC/UPCE 的分段文本按编码段分别定位居中。
 * - exportImage 不再走 uni.canvasToTempFilePath，改为返回 SVG data URI
 *   （data:image/svg+xml;utf8, + encodeURIComponent），导出内容含条与文本。
 * - 未使用设备像素比：SVG 为矢量图形，按 viewBox 缩放即清晰，无需 getSystemInfo。
 */
<script setup lang="ts">
import './index.css'

import { computed, watch } from 'vue-lynx'
import { isDef, objToStyle, sanitizeSvgContent, styleToObject } from '../../common/util'
import JsBarcode from './barCode'
import { buildBarCodeSvgModel, type BarCodeRenderEncoding, type BarCodeRenderOptions, type BarCodeSvgModel, type BarCodeTextItem } from './barCodeRender'
import { barCodeProps, DEFAULT_BAR_CODE_LINE_WIDTH, isValidBarCodeFormat, MAX_BAR_CODE_VALUE_LENGTH, type BarCodeExpose, type BarCodeFormat } from './types'

const props = defineProps(barCodeProps)

const emit = defineEmits<{
  error: [error: unknown]
  valid: [valid: boolean]
}>()

/** XML 属性值转义，避免颜色 / 文本中的特殊字符破坏 svg content */
function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type EncodeOptions = BarCodeRenderOptions & { margin: number; width: number; valid: (valid: boolean) => void }

type BarCodeRenderState = {
  ready: boolean
  model?: BarCodeSvgModel
  error?: unknown
  valid?: boolean
}

const rootClass = computed(() => `wd-bar-code ${props.customClass}`)

const rootStyle = computed(() =>
  // 供文本叠加层绝对定位；不改变 inline-block 的布局与视觉
  objToStyle({ position: 'relative', ...styleToObject(props.customStyle) })
)

const marginKeys = ['margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'textMargin'] as const

/** 判断是否存在可绘制的条码内容 */
function hasBarCodeValue(value: string | number | undefined | null): boolean {
  if (!isDef(value)) return false
  if (typeof value === 'string' && value === '') return false
  return true
}

const hasValue = computed(() => hasBarCodeValue(props.value))

function getResolvedMargin(value: number | undefined): number {
  return value ?? props.margin
}

/** 解析并校验条码格式 */
function resolveFormat(format: string): BarCodeFormat | null {
  if (format === 'auto') {
    return 'auto'
  }
  if (!isValidBarCodeFormat(format)) {
    return null
  }
  return format
}

function createBarCodeEncodings(barcodeValue: string, options: EncodeOptions): BarCodeRenderEncoding[] {
  const encoded: { encodings?: BarCodeRenderEncoding[] } = {}
  const encodeOptions: Record<string, unknown> = { ...options, width: DEFAULT_BAR_CODE_LINE_WIDTH }
  JsBarcode(encoded, barcodeValue, encodeOptions)
  return encoded.encodings || []
}

/**
 * 纯计算渲染状态。所有绘制均在此同步完成（无 canvas / uni / 异步节点查询），
 * 失败时记录 error 供 watch 触发 error 事件，模板据此渲染空节点。
 */
const renderState = computed<BarCodeRenderState>(() => {
  if (!hasValue.value) {
    return { ready: false }
  }

  let encodingValid = true
  try {
    const barcodeValue = String(props.value)
    if (barcodeValue.length > MAX_BAR_CODE_VALUE_LENGTH) {
      throw new Error(`Barcode value exceeds max length ${MAX_BAR_CODE_VALUE_LENGTH}`)
    }
    const format = resolveFormat(props.format)
    if (!format) {
      throw new Error(`Unsupported barcode format: ${props.format}`)
    }
    for (const key of marginKeys) {
      const margin = props[key] as number | undefined
      if (margin !== undefined && (!Number.isFinite(margin) || margin < 0)) {
        throw new Error(`Barcode ${key} must be a non-negative finite number`)
      }
    }

    const options: EncodeOptions = {
      format,
      width: DEFAULT_BAR_CODE_LINE_WIDTH,
      height: props.height,
      text: props.text || undefined,
      font: props.font,
      fontSize: props.fontSize,
      fontOptions: props.fontOptions,
      textMargin: props.textMargin,
      background: props.background,
      lineColor: props.lineColor,
      margin: props.margin,
      marginTop: getResolvedMargin(props.marginTop),
      marginBottom: getResolvedMargin(props.marginBottom),
      marginLeft: getResolvedMargin(props.marginLeft),
      marginRight: getResolvedMargin(props.marginRight),
      displayValue: props.displayValue,
      textAlign: props.textAlign,
      textPosition: props.textPosition,
      valid: (valid: boolean) => {
        encodingValid = valid
      }
    }

    const encodings = createBarCodeEncodings(barcodeValue, options)
    if (!encodingValid || !encodings.some((encoding) => encoding.data.length > 0)) {
      throw new Error('Invalid barcode value')
    }
    const displayText = options.text || encodings.map((encoding) => encoding.text).join('')
    const model = buildBarCodeSvgModel(encodings, options, props.width, displayText)
    return { ready: true, model, valid: true }
  } catch (error) {
    return { ready: false, error, valid: encodingValid }
  }
})

watch(
  renderState,
  (state) => {
    if (state.valid !== undefined) {
      emit('valid', state.valid)
    }
    if (!state.ready && state.error !== undefined) {
      emit('error', state.error)
    }
  },
  { immediate: true }
)

const svgContent = computed(() => {
  const model = renderState.value.model
  if (!renderState.value.ready || !model) return ''
  const { size, background, lineColor, bars } = model
  const parts: string[] = []
  if (background) {
    parts.push(`<rect x="0" y="0" width="${size.width}" height="${size.height}" fill="${escapeXml(background)}"/>`)
  }
  parts.push(`<g fill="${escapeXml(lineColor)}">${bars.map((bar) => `<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}"/>`).join('')}</g>`)
  return sanitizeSvgContent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width} ${size.height}">${parts.join('')}</svg>`)
})

const svgStyle = computed(() => {
  const model = renderState.value.model
  if (!renderState.value.ready || !model) return ''
  return objToStyle({ width: `${model.size.width}px`, height: `${model.size.height}px` })
})

const textItems = computed<BarCodeTextItem[]>(() => {
  const model = renderState.value.model
  if (!renderState.value.ready || !model) return []
  return model.textItems
})

function textStyle(item: BarCodeTextItem): string {
  const model = renderState.value.model
  if (!model) return ''
  const { fontSize, textTop, lineColor, font, fontOptions } = model
  const fontWeight = /\bbold\b/.test(fontOptions) ? 'bold' : 'normal'
  const fontStyle = /\bitalic\b/.test(fontOptions) ? 'italic' : 'normal'
  return objToStyle({
    position: 'absolute',
    left: `${item.x}px`,
    top: `${textTop}px`,
    width: `${item.width}px`,
    textAlign: item.align,
    color: lineColor,
    fontSize: `${fontSize}px`,
    fontFamily: font,
    fontWeight,
    fontStyle,
    lineHeight: `${Math.round(fontSize * 1.25)}px`
  })
}

/** 导出用：把条与文本合成为一段完整 SVG 字符串 */
function buildExportSvg(model: BarCodeSvgModel): string {
  const { size, background, lineColor, bars, textItems: items, fontSize, textTop, font, fontOptions } = model
  const parts: string[] = []
  if (background) {
    parts.push(`<rect x="0" y="0" width="${size.width}" height="${size.height}" fill="${escapeXml(background)}"/>`)
  }
  parts.push(`<g fill="${escapeXml(lineColor)}">${bars.map((bar) => `<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}"/>`).join('')}</g>`)
  const fontWeight = /\bbold\b/.test(fontOptions) ? 'bold' : 'normal'
  const fontStyle = /\bitalic\b/.test(fontOptions) ? 'italic' : 'normal'
  for (const item of items) {
    const anchor = item.align === 'left' ? 'start' : item.align === 'right' ? 'end' : 'middle'
    const tx = item.align === 'left' ? item.x : item.align === 'right' ? item.x + item.width : item.x + item.width / 2
    const ty = textTop + fontSize
    parts.push(
      `<text x="${tx}" y="${ty}" font-family="${escapeXml(font)}" font-size="${fontSize}" font-weight="${fontWeight}" font-style="${fontStyle}" fill="${escapeXml(lineColor)}" text-anchor="${anchor}">${escapeXml(item.text)}</text>`
    )
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width} ${size.height}">${parts.join('')}</svg>`
}

async function exportImage(): Promise<string> {
  const state = renderState.value
  if (!state.ready || !state.model) {
    throw state.error || new Error('Barcode is not ready for export')
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(buildExportSvg(state.model))}`
}

defineExpose<BarCodeExpose>({
  exportImage
})
</script>

<template>
  <view :class="rootClass" :style="styleToObject(rootStyle)">
    <svg v-if="svgContent" :style="styleToObject(svgStyle)" :content="svgContent" />
    <text v-for="(item, index) in textItems" :key="index" :style="styleToObject(textStyle(item))">{{ item.text }}</text>
  </view>
</template>

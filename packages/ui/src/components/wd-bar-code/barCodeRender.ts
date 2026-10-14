import { DEFAULT_BAR_CODE_LINE_WIDTH, type BarCodeFormat } from './types'

export type BarCodeRenderEncoding = {
  data: string
  text: string
  options?: Record<string, unknown>
}

export type BarCodeRenderOptions = {
  format: BarCodeFormat
  height: number
  fontSize: number
  font: string
  fontOptions: string
  textMargin: number
  lineColor: string
  background: string
  marginLeft: number
  marginRight: number
  marginTop: number
  marginBottom: number
  displayValue: boolean
  textAlign: string
  textPosition: string
  text?: string
}

export type BarCodeRenderSize = {
  width: number
  height: number
}

/** 单个条（矩形）几何信息，坐标系与最终 svg viewBox 一致 */
export type BarCodeBarRect = {
  x: number
  y: number
  width: number
  height: number
}

/** 一段显示文本的水平布局，x/width 为在条码坐标系中的位置与可用宽度 */
export type BarCodeTextItem = {
  text: string
  x: number
  width: number
  align: 'left' | 'center' | 'right'
}

/** 条码 SVG 渲染模型：后台线程纯计算，模板据此渲染 svg 元素 content 与原生 text 叠加层 */
export type BarCodeSvgModel = {
  size: BarCodeRenderSize
  background: string
  lineColor: string
  bars: BarCodeBarRect[]
  displayValue: boolean
  textItems: BarCodeTextItem[]
  fontSize: number
  /** 文本行顶部在条码坐标系中的 y（供原生 text 叠加层定位） */
  textTop: number
  font: string
  fontOptions: string
}

type TextAlign = 'left' | 'center' | 'right'

/**
 * 等宽字体近似字符步进比。
 *
 * Lynx 后台线程无 canvas / measureText，字号自适应与文本宽度只能估算。
 * 条码文本默认 monospace，取 0.6em 作为单字符步进的近似值。
 */
const MONOSPACE_CHAR_RATIO = 0.6

function getModuleCount(encodings: BarCodeRenderEncoding[]) {
  return encodings.reduce((total, encoding) => total + encoding.data.length, 0)
}

function usesSegmentText(options: BarCodeRenderOptions) {
  return !options.text && ['EAN13', 'EAN8', 'UPC', 'UPCE'].includes(options.format)
}

function getEncodingLayoutList(encodings: BarCodeRenderEncoding[], barcodeX: number, moduleWidth: number) {
  let moduleIndex = 0

  return encodings.map((encoding) => {
    const startX = barcodeX + moduleIndex * moduleWidth
    moduleIndex += encoding.data.length
    const endX = barcodeX + moduleIndex * moduleWidth

    return {
      x: startX,
      width: endX - startX
    }
  })
}

function getEncodingBarHeight(encoding: BarCodeRenderEncoding, options: BarCodeRenderOptions, barHeight: number, maxBarHeight: number) {
  const encodingHeight = Number(encoding.options?.height)

  if (!Number.isFinite(encodingHeight) || encodingHeight <= options.height) {
    return barHeight
  }

  return maxBarHeight
}

function getContentHeight(options: BarCodeRenderOptions) {
  return options.height - options.marginTop - options.marginBottom
}

function estimateTextWidth(text: string, fontSize: number) {
  return Array.from(text).length * fontSize * MONOSPACE_CHAR_RATIO
}

/**
 * 解析最终字号：从 props.fontSize 起，若文本放不下则按估算宽度等比缩小，
 * 与 wot-ui 的 getResolvedTextOptions 收缩逻辑一致（仅宽度估算方式不同）。
 */
function resolveFontSize(encodings: BarCodeRenderEncoding[], options: BarCodeRenderOptions, canvasSize: BarCodeRenderSize, moduleWidth: number, displayText: string): number {
  if (!options.displayValue) {
    return options.fontSize
  }

  if (!Number.isFinite(options.fontSize) || options.fontSize <= 0) {
    throw new Error('Barcode fontSize must be a positive finite number')
  }

  const layoutList = getEncodingLayoutList(encodings, options.marginLeft, moduleWidth)
  const textAreas = usesSegmentText(options)
    ? encodings.map((encoding, index) => ({ text: encoding.text, width: layoutList[index].width }))
    : [{ text: displayText, width: canvasSize.width - options.marginLeft - options.marginRight }]

  let fontSize = options.fontSize

  while (fontSize > 0) {
    let scale = 1
    for (const { text, width } of textAreas) {
      if (!text) continue
      scale = Math.min(scale, width / estimateTextWidth(text, fontSize))
    }
    if (scale >= 1) return fontSize
    const nextFontSize = Math.floor(fontSize * scale)
    if (nextFontSize < 1 || nextFontSize >= fontSize) {
      break
    }
    fontSize = nextFontSize
  }

  throw new Error('Barcode width is too small for the display text; increase width or shorten text')
}

/**
 * 计算所有条（矩形）。逻辑与 wot-ui 的 drawEncodingBars / drawBarRun 一致：
 * 连续 '1' 合并为一个通高矩形；数字字符（如 ITF 变宽条、EAN 守卫条高度标识）
 * 单独成条并按数值缩放高度；'0' 为空白。区别仅在于不做设备像素取整
 *（SVG 为矢量，按 viewBox 缩放即清晰）。
 */
function computeBars(
  encodings: BarCodeRenderEncoding[],
  options: BarCodeRenderOptions,
  barcodeX: number,
  barcodeY: number,
  moduleWidth: number,
  barHeight: number,
  maxBarHeight: number
): BarCodeBarRect[] {
  const rects: BarCodeBarRect[] = []
  let moduleStartIndex = 0

  encodings.forEach((encoding) => {
    const encodingBarHeight = getEncodingBarHeight(encoding, options, barHeight, maxBarHeight)
    let runStart = -1

    const pushRun = (startIndex: number, endIndex: number, height: number) => {
      const x = barcodeX + startIndex * moduleWidth
      const endX = barcodeX + endIndex * moduleWidth
      rects.push({ x, y: barcodeY, width: endX - x, height })
    }

    for (let index = 0; index < encoding.data.length; index++) {
      const bar = encoding.data[index]

      if (bar === '1') {
        if (runStart === -1) {
          runStart = index
        }
      } else if (bar && bar !== '0') {
        if (runStart !== -1) {
          pushRun(moduleStartIndex + runStart, moduleStartIndex + index, encodingBarHeight)
          runStart = -1
        }
        pushRun(moduleStartIndex + index, moduleStartIndex + index + 1, encodingBarHeight * Number(bar))
      } else if (runStart !== -1) {
        pushRun(moduleStartIndex + runStart, moduleStartIndex + index, encodingBarHeight)
        runStart = -1
      }
    }

    if (runStart !== -1) {
      pushRun(moduleStartIndex + runStart, moduleStartIndex + encoding.data.length, encodingBarHeight)
    }

    moduleStartIndex += encoding.data.length
  })

  return rects
}

function resolveAlign(align: string): TextAlign {
  return align === 'left' || align === 'right' ? align : 'center'
}

function computeTextItems(
  encodings: BarCodeRenderEncoding[],
  options: BarCodeRenderOptions,
  canvasSize: BarCodeRenderSize,
  moduleWidth: number,
  displayText: string
): BarCodeTextItem[] {
  if (!options.displayValue) return []

  const align = resolveAlign(options.textAlign)

  if (usesSegmentText(options)) {
    const layoutList = getEncodingLayoutList(encodings, options.marginLeft, moduleWidth)
    const items: BarCodeTextItem[] = []
    encodings.forEach((encoding, index) => {
      if (!encoding.text) return
      items.push({ text: encoding.text, x: layoutList[index].x, width: layoutList[index].width, align: 'center' })
    })
    return items
  }

  if (!displayText) return []
  return [{ text: displayText, x: options.marginLeft, width: canvasSize.width - options.marginLeft - options.marginRight, align }]
}

export function resolveBarCodeRenderSize(encodings: BarCodeRenderEncoding[], options: BarCodeRenderOptions, width?: number): BarCodeRenderSize {
  if (width !== undefined && (!Number.isFinite(width) || width <= 0)) {
    throw new Error('Barcode width must be a positive finite number')
  }
  const moduleCount = getModuleCount(encodings)
  const contentWidth = moduleCount * DEFAULT_BAR_CODE_LINE_WIDTH
  const canvasWidth = width === undefined ? contentWidth + options.marginLeft + options.marginRight : width

  return {
    width: canvasWidth,
    height: options.height
  }
}

/**
 * 构建条码 SVG 渲染模型（纯函数，无 canvas / uni 依赖）。
 *
 * 与 wot-ui 的 renderBarCode + drawBarCodeToCanvas 等价：完成同样的校验、
 * 尺寸解析、条几何与文本布局计算，但输出的是可供 svg 元素渲染的结构化数据，
 * 而非直接在 canvas 上绘制。文本宽度用等宽近似估算替代 measureText。
 */
export function buildBarCodeSvgModel(
  encodings: BarCodeRenderEncoding[],
  options: BarCodeRenderOptions,
  width: number | undefined,
  displayText: string
): BarCodeSvgModel {
  const size = resolveBarCodeRenderSize(encodings, options, width)

  const availableWidth = size.width - options.marginLeft - options.marginRight
  const availableHeight = getContentHeight(options)
  const moduleCount = Math.max(getModuleCount(encodings), 1)
  const moduleWidth = availableWidth / moduleCount
  if (!Number.isFinite(moduleWidth) || moduleWidth <= 0) {
    throw new Error('Barcode width is too small to preserve the encoded bars and spaces; increase width')
  }

  const fontSize = resolveFontSize(encodings, options, size, moduleWidth, displayText)
  const textAscent = fontSize
  const textDescent = fontSize / 4
  const textHeight = options.displayValue ? textAscent + textDescent + options.textMargin : 0
  const barHeight = availableHeight - textHeight
  if (!Number.isFinite(barHeight) || barHeight < 1) {
    throw new Error('Barcode height is too small for the margins, text and bars; increase height or reduce fontSize, textMargin or margins')
  }

  const barcodeY = options.textPosition === 'top' ? options.marginTop + textHeight : options.marginTop
  const maxBarHeight = Math.max(
    barHeight +
      (options.displayValue && usesSegmentText(options) && options.textPosition === 'bottom' ? options.textMargin + fontSize / 2 : 0),
    1
  )

  const bars = computeBars(encodings, options, options.marginLeft, barcodeY, moduleWidth, barHeight, maxBarHeight)
  const textItems = computeTextItems(encodings, options, size, moduleWidth, displayText)
  const textTop = options.textPosition === 'top' ? options.marginTop : barcodeY + barHeight + options.textMargin

  return {
    size,
    background: options.background,
    lineColor: options.lineColor,
    bars,
    displayValue: options.displayValue,
    textItems,
    fontSize,
    textTop,
    font: options.font,
    fontOptions: options.fontOptions
  }
}

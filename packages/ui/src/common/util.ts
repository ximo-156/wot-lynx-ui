import { AbortablePromise } from './AbortablePromise'

/**
 * 生成 uuid
 */
export function uuid() {
  return s4() + s4() + s4() + s4() + s4() + s4() + s4() + s4()
}

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1)
}

/**
 * 对 num 自动填充 px
 */
export function addUnit(num: number | string) {
  return Number.isNaN(Number(num)) ? `${num}` : `${num}px`
}

/**
 * 判断 target 是否对象
 */
export function isObj(value: any): value is object {
  return Object.prototype.toString.call(value) === '[object Object]' || typeof value === 'object'
}

/**
 * 获取目标原始类型
 */
export function getType(target: unknown): string {
  const typeStr = Object.prototype.toString.call(target)
  const match = typeStr.match(/\[object (\w+)\]/)
  return match && match.length ? match[1].toLowerCase() : ''
}

/**
 * 默认的外部格式化函数 - picker 组件
 */
export const defaultDisplayFormat = function (items: any[] | Record<string, any>, kv?: { labelKey?: string }): string {
  const labelKey: string = kv?.labelKey || 'value'

  if (Array.isArray(items)) {
    return items.map((item) => item[labelKey]).join(', ')
  } else {
    return items[labelKey]
  }
}

/**
 * 默认函数占位符 - pickerView 组件
 */
export const defaultFunction = <T>(value: T): T => value

/**
 * 判断值是否不为空
 */
export const isDef = <T>(value: T): value is NonNullable<T> => value !== undefined && value !== null

/**
 * 防止数字小于零
 *
 * 注意：本函数只告警不抛错。唯一消费方是 wd-tabs / wd-checkbox-group 的
 * watch 回调，在回调里 throw 会直接崩掉渲染路径（Sentry USER_RUNTIME_ERROR），
 * 而消费方对非法值本就有 clamp 兜底，告警已足够暴露问题。
 */
export const checkNumRange = (num: number, label: string = 'value'): void => {
  if (num < 0) {
    console.error(`[wot-lynx-ui] ${label} shouldn't be less than zero`)
  }
}

/**
 * 防止 pixel 无意义
 *
 * 同 checkNumRange：只告警不抛错，避免 watch / 渲染路径被异常打断。
 */
export const checkPixelRange = (num: number, label: string = 'value'): void => {
  if (num <= 0) {
    console.error(`[wot-lynx-ui] ${label} should be greater than zero`)
  }
}

/**
 * RGB 转十六进制
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const hex = ((r << 16) | (g << 8) | b).toString(16)
  return '#' + '0'.repeat(Math.max(0, 6 - hex.length)) + hex
}

/**
 * 十六进制转 RGB
 */
export function hexToRgb(hex: string): number[] {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
  const result = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b)
  const rgbResult = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(result)
  return rgbResult ? [parseInt(rgbResult[1], 16), parseInt(rgbResult[2], 16), parseInt(rgbResult[3], 16)] : []
}

/**
 * 生成渐变色数组
 */
export const gradient = (startColor: string, endColor: string, step: number = 2): string[] => {
  const startRGB = hexToRgb(startColor)
  const endRGB = hexToRgb(endColor)
  const sR = startRGB[0]
  const sG = startRGB[1]
  const sB = startRGB[2]
  const eR = endRGB[0]
  const eG = endRGB[1]
  const eB = endRGB[2]
  const rStep = (eR - sR) / step
  const gStep = (eG - sG) / step
  const bStep = (eB - sB) / step
  const gradientColorArr = []
  for (let i = 0; i < step; i++) {
    gradientColorArr.push(rgbToHex(parseInt(String(rStep * i + sR)), parseInt(String(gStep * i + sG)), parseInt(String(bStep * i + sB))))
  }
  return gradientColorArr
}

/**
 * 限制数字在 [min, max] 之间
 */
export const range = (num: number, min: number, max: number): number => {
  return Math.min(Math.max(num, min), max)
}

/**
 * 两个值是否相等
 */
export const isEqual = (value1: any, value2: any): boolean => {
  if (value1 === value2) return true
  if (isArray(value1) && isArray(value2) && value1.length === value2.length) {
    return value1.every((item, index) => isEqual(item, value2[index]))
  }
  return false
}

/**
 * 数字补零
 */
export const padZero = (number: number | string, length: number = 2): string => {
  let numStr = String(number)
  while (numStr.length < length) {
    numStr = '0' + numStr
  }
  return numStr
}

/**
 * 样式对象类型（Lynx 内联样式）
 */
export type CSSProperties = Record<string, string | number | undefined>

/**
 * 将样式字符串或对象统一转换为样式对象。
 *
 * vue-lynx 运行时的 :style 绑定只应用对象形式的值（字符串会被忽略），
 * 因此所有样式的最终绑定都需要经过本函数转换。
 */
export function styleToObject(style: string | CSSProperties | undefined | null): CSSProperties {
  if (!style) return {}
  if (typeof style !== 'string') return style
  const result: CSSProperties = {}
  // 按分号切分声明，跳过括号/引号内的分号（如 url(data:...;base64,...)）
  let depth = 0
  let quote = ''
  let current = ''
  const decls: string[] = []
  for (const ch of style) {
    if (quote) {
      current += ch
      if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ';' && depth === 0) {
      decls.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) decls.push(current)

  decls.forEach((decl) => {
    const idx = decl.indexOf(':')
    if (idx > 0) {
      const key = decl.slice(0, idx).trim()
      const value = decl.slice(idx + 1).trim()
      if (key && value) {
        result[key] = value
      }
    }
  })
  return result
}

export const context = {
  id: 1000
}

export interface RectResult {
  /** 节点左边界坐标 */
  left: number
  /** 节点右边界坐标 */
  right: number
  /** 节点上边界坐标 */
  top: number
  /** 节点下边界坐标 */
  bottom: number
  /** 节点宽度 */
  width: number
  /** 节点高度 */
  height: number
  [key: string]: any
}

/**
 * 按 key 去重的告警——同一个问题只提示一次。
 *
 * 用于「已经兜底、但需要暴露」的降级路径：调用方不会崩溃（异常已被 catch 并
 * 降级），但真机上同一个问题可能被 touchmove / watch 高频触发，无去重会直接
 * 刷屏。key 由调用方给出，需保证同一问题在不同实例间一致（如按元素选择器）。
 */
const warnedOnceKeys = new Set<string>()
export function warnOnce(key: string, message: string, error?: unknown): void {
  if (warnedOnceKeys.has(key)) return
  warnedOnceKeys.add(key)
  if (error === undefined) {
    console.warn(message)
  } else {
    console.warn(message, error)
  }
}

function warnSelectorQueryUnavailable(): void {
  warnOnce(
    'selector-query-unavailable',
    '[wot-lynx-ui] 节点度量不可用（createSelectorQuery 缺失 / 查询失败 / 无匹配节点），getRect 降级为零尺寸矩形'
  )
}

/**
 * 获取节点信息（基于 Lynx SelectorQuery）
 * @param selector 节点选择器 #id,.class
 * @param all 是否返回所有 selector 对应的节点
 * @param scope 兼容参数（uni-app 组件实例作用域），Lynx 下忽略
 * @param useFields 兼容参数，Lynx 下忽略
 * @returns 节点信息或节点信息数组
 */
export function getRect(selector: string, all: boolean = false, scope?: any, useFields?: boolean): Promise<any> {
  return new Promise<any>((resolve) => {
    /**
     * 度量不可用时的统一兜底：解析为零尺寸矩形（all 模式为空数组）并 warning 一次。
     *
     * getRect 约定**永不 reject**：约 28 处调用点中多数只有 `.then` / `await` 而没有
     * `.catch`（slider 的 initSlider、navbar、tabbar、index-bar、drop-menu、sticky、
     * swipe-action、segmented 等），任何一次 reject 都会变成未处理的 Promise 拒绝，
     * 被 Lynx Sentry 上报为 USER_RUNTIME_ERROR 并导致整张卡片崩溃：
     * "unhandled rejection: createSelectorQuery is not available"。
     */
    const resolveUnavailable = () => {
      warnSelectorQueryUnavailable()
      resolve(all ? [] : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 })
    }

    const lynx = (globalThis as any).lynx
    if (!lynx || !lynx.createSelectorQuery) {
      // 宿主运行时未提供 createSelectorQuery（旧版 Lynx 引擎 / 未注册 SelectorQuery
      // 模块的宿主）时按"测量不可用"兜底，调用方以零矩形保持默认布局。
      resolveUnavailable()
      return
    }
    const query = lynx.createSelectorQuery()
    const handleResult = (rect: RectResult | RectResult[]) => {
      if (all) {
        // all 模式：无匹配节点时返回空数组而非 reject。
        // 调用方（rate/tabs/segmented 等）均直接遍历结果，空数组是合法的"无节点"语义；
        // reject 会导致调用方缺少 catch 时产生未处理的 Promise 拒绝。
        resolve(isArray(rect) ? rect : [])
      } else if (rect) {
        resolve(rect)
      } else {
        // 选择器未命中节点（节点未渲染 / 选择器写错）：与"测量不可用"同一兜底，
        // 避免未处理拒绝崩溃整张卡片。
        resolveUnavailable()
      }
    }
    const nodesRef = all ? query.selectAll(selector) : query.select(selector)
    try {
      nodesRef
        .invoke({
          method: 'boundingClientRect',
          success: (res: RectResult) => handleResult(res),
          fail: () => resolveUnavailable()
        })
        .exec()
    } catch (error) {
      // 运行时不支持 SelectorQuery.invoke（如 jsdom 测试环境）时，
      // 返回零尺寸矩形而非 reject，避免调用方缺少 catch 时产生未处理拒绝。
      // 真机 Lynx 引擎实现了 invoke，不会走到该分支。
      resolveUnavailable()
    }
  })
}

/**
 * 驼峰转短横线
 */
export function kebabCase(word: string): string {
  return word
    .replace(/[A-Z]/g, (match) => '-' + match)
    .toLowerCase()
}

/**
 * 短横线转驼峰
 */
export function camelCase(word: string): string {
  return word.replace(/-(\w)/g, (_, c) => c.toUpperCase())
}

/**
 * 是否数组
 */
export function isArray(value: any): value is Array<any> {
  return Array.isArray(value)
}

/**
 * 是否函数
 */
export function isFunction<T extends Function>(value: any): value is T {
  return typeof value === 'function'
}

/**
 * 是否字符串
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * 是否数字
 */
export function isNumber(value: any): value is number {
  return typeof value === 'number'
}

/**
 * 是否 Promise
 */
export function isPromise(value: unknown): value is Promise<any> {
  return Object.prototype.toString.call(value) === '[object Promise]'
}

/**
 * 是否布尔值
 */
export function isBoolean(value: any): value is boolean {
  return typeof value === 'boolean'
}

/**
 * 是否 undefined
 */
export function isUndefined(value: any): value is undefined {
  return value === undefined
}

export const isNotUndefined = <T>(value: T): value is NonNullable<T> => value !== undefined

/**
 * 是否奇数
 */
export function isOdd(value: number): boolean {
  return Math.abs(value) % 2 === 1
}

/**
 * 是否 base64 图片
 */
export function isBase64Image(url: string) {
  const reg = /^data:image\/(png|jpe?g|gif|webp|bmp);base64,/
  return reg.test(url)
}

/**
 * 对象转 style 字符串
 */
export function objToStyle(styles: Record<string, any> | Record<string, any>[]): string {
  if (isArray(styles)) {
    return styles.map((item) => objToStyle(item)).join(';')
  }
  return Object.keys(styles)
    .filter((key) => styles[key] !== undefined && styles[key] !== null && styles[key] !== '')
    .map((key) => `${kebabCase(key)}:${styles[key]}`)
    .join(';')
}

/**
 * 对象是否含有字段
 */
export function hasFields(obj: unknown): boolean {
  return Object.keys(obj as object).length > 0
}

/**
 * 是否空对象
 */
export function isEmptyObj(obj: unknown): boolean {
  return Object.keys(obj as object).length === 0
}

/**
 * requestAnimationFrame（Lynx 双端可用）
 */
export const requestAnimationFrame = (cb = () => {}) => {
  const lynx = (globalThis as any).lynx
  if (lynx && lynx.requestAnimationFrame) {
    return lynx.requestAnimationFrame(cb)
  }
  return setTimeout(cb, 1000 / 30)
}

export const cancelAnimationFrame = (handle: number) => {
  const lynx = (globalThis as any).lynx
  if (lynx && lynx.cancelAnimationFrame) {
    lynx.cancelAnimationFrame(handle)
  } else {
    clearTimeout(handle)
  }
}

/**
 * 暂停
 */
export const pause = (ms: number = 1000 / 30) => {
  return new AbortablePromise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * 深拷贝
 */
export function deepClone<T>(obj: T, cache: Map<any, any> = new Map()): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  // 特殊对象类型：日期、正则表达式、错误对象（正则需保留原型，否则被降级为普通对象，
  // 如 wd-dialog 的 inputPattern 校验会失效）
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any
  }
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as any
  }
  if (obj instanceof Error) {
    const errorCopy = new Error(obj.message)
    errorCopy.stack = obj.stack
    return errorCopy as any
  }
  if (cache.has(obj)) {
    return cache.get(obj)
  }
  const clone: any = Array.isArray(obj) ? [] : {}
  cache.set(obj, clone)
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clone[key] = deepClone((obj as any)[key], cache)
    }
  }
  return clone as T
}

/**
 * 深合并（与 wot-ui 语义一致：深拷贝 target 后合并 source，不修改入参）
 *
 * 注意：必须返回**新对象**。命令式弹层组件（useDialog/useToast/useNotify 等）依赖
 * `optionRef.value = deepMerge(defaultOptions, options)` 产生新引用来触发 watch——
 * 若原地修改并返回 target，赋值的是同一引用（defaultOptions），Vue 的 ref 不会
 * 通知依赖，弹层永远打不开；同时 defaultOptions 还会被调用方选项污染。
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Record<string, any>): T {
  const result = deepClone(target) as Record<string, any>
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key]
      const targetValue = result[key]
      if (isObj(sourceValue) && isObj(targetValue)) {
        result[key] = deepMerge(targetValue as Record<string, any>, sourceValue)
      } else {
        result[key] = sourceValue
      }
    }
  }
  return result as T
}

/**
 * 深赋值
 */
export function deepAssign(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key]
      if (isObj(value)) {
        if (!isObj(target[key])) {
          target[key] = {}
        }
        deepAssign(target[key], value)
      } else {
        target[key] = value
      }
    }
  }
  return target
}

/**
 * 拼接 URL 参数
 */
export function buildUrlWithParams(baseUrl: string, params: Record<string, string>) {
  const query = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
  if (!query) return baseUrl
  return baseUrl + (baseUrl.includes('?') ? '&' : '?') + query
}

export interface DebounceOptions {
  leading?: boolean
  trailing?: boolean
}

/**
 * 防抖
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number, options: DebounceOptions = {}): T {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let lastArgs: any[] | null = null
  const { leading = false, trailing = true } = options

  const invoke = (args: any[]) => {
    func(...args)
  }

  const debounced = (...args: any[]) => {
    lastArgs = args
    if (timeout === null) {
      if (leading) {
        invoke(args)
      }
      timeout = setTimeout(() => {
        timeout = null
        if (trailing && lastArgs) {
          invoke(lastArgs)
          lastArgs = null
        }
      }, wait)
    }
  }

  debounced.cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout)
      timeout = null
      lastArgs = null
    }
  }

  return debounced as unknown as T
}

/**
 * 节流
 */
export function throttle<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let previous = 0

  const throttled = (...args: any[]) => {
    const now = Date.now()
    if (now - previous > wait) {
      func(...args)
      previous = now
    } else if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null
        previous = Date.now()
        func(...args)
      }, wait)
    }
  }

  throttled.cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  return throttled as unknown as T
}

/**
 * 按路径获取对象属性
 */
export const getPropByPath = (obj: any, path: string): any => {
  const keys = path.split('.')
  return keys.reduce((acc, key) => (acc == null ? acc : acc[key]), obj)
}

export const isDate = (val: unknown): val is Date => Object.prototype.toString.call(val) === '[object Date]' && !Number.isNaN((val as Date).getTime())

/**
 * 是否视频链接
 */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|avi|flv|wmv|m4v|rmvb|rm|mkv|webm|3gp|mpeg|mpg|ts)(\?.*)?$/i.test(url)
}

/**
 * 是否图片链接
 */
export function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url)
}

/**
 * 剔除对象中的某些属性
 */
export function omitBy<O extends Record<string, any>>(obj: O, predicate: (value: any, key: keyof O) => boolean): Partial<O> {
  const newObj = deepClone(obj)
  Object.keys(newObj).forEach((key) => predicate(newObj[key], key) && delete newObj[key])
  return newObj
}

/**
 * 缓动函数
 */
export function easingFn(t: number = 0, b: number = 0, c: number = 0, d: number = 0): number {
  return (c * (-Math.pow(2, (-10 * t) / d) + 1) * 1024) / 1023 + b
}

/**
 * 寻找最接近目标值的元素
 */
export function closest(arr: number[], target: number) {
  return arr.reduce((prev, curr) => (Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev))
}

/**
 * 是否 H5 环境（Lynx 中恒为 false，Web 端由 Lynx Web 渲染层处理）
 */
export const isH5 = false

export interface SystemInfo {
  /** 窗口宽度（px） */
  windowWidth: number
  /** 窗口高度（px） */
  windowHeight: number
  /** 窗口顶部位置 */
  windowTop: number
  /** 设备像素比 */
  pixelRatio: number
  /** 平台信息 */
  platform: string
  /** 屏幕宽度 */
  screenWidth: number
  /** 屏幕高度 */
  screenHeight: number
  /** 状态栏高度 */
  statusBarHeight: number
  // 未尽字段
  [key: string]: any
}

/**
 * 获取系统信息（Lynx SystemInfo 全局对象）
 */
export function getSystemInfo(): SystemInfo {
  const info = (globalThis as any).SystemInfo || {}
  const pixelRatio = info.pixelRatio || 2
  const screenWidth = info.pixelWidth ? info.pixelWidth / pixelRatio : 375
  const screenHeight = info.pixelHeight ? info.pixelHeight / pixelRatio : 812
  return {
    windowWidth: screenWidth,
    windowHeight: screenHeight,
    windowTop: 0,
    pixelRatio,
    platform: (info.platform || '').toLowerCase(),
    screenWidth,
    screenHeight,
    statusBarHeight: 0,
    ...info
  }
}

// ---------------------------------------------------------------------------
// SVG content 安全过滤（CONVENTIONS.md §7 真机硬约束）
// ---------------------------------------------------------------------------

/**
 * Lynx 引擎 SVG content 解析器的元素白名单（本库已验证真机可用）。
 * content 中一旦出现白名单外元素（defs / linearGradient / radialGradient /
 * stop / clipPath / image / text / use 等），真机 PaintingContext.insertNode
 * 会抛 "Insertion (new) failed due to unknown child signature" 致命异常
 * （Lynx 错误码 9902），JS 侧无法捕获、整张卡片崩溃。
 */
const SVG_SAFE_TAGS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'polyline'])

/** 匹配一个完整标签（开/闭/自闭合），属性值中的引号内容不参与分割 */
const SVG_TAG_RE = /<(\/)?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/)?>/g

/**
 * 过滤 SVG content 中引擎不支持的元素（含其整个子树），把致命崩溃降级为
 * 「忽略该元素」。白名单内的元素与其属性原样保留。
 *
 * 渲染路径（`<svg :content>`）在绑定前统一过一遍本函数；导出路径
 * （data URI 走标准 SVG 解码器）不受白名单约束，不适用本函数。
 *
 * @param content 完整 SVG 标记
 * @returns 仅含白名单元素的 SVG 标记
 */
export function sanitizeSvgContent(content: string): string {
  if (!content || !/<[a-zA-Z]/.test(content)) return content

  let result = ''
  let lastIndex = 0
  let skipTag = ''
  let skipDepth = 0
  let match: RegExpExecArray | null

  SVG_TAG_RE.lastIndex = 0
  while ((match = SVG_TAG_RE.exec(content)) !== null) {
    if (skipDepth === 0) {
      // 仅保留白名单区域之外的普通文本（SVG 标记中基本不存在，防御性保留）
      result += content.slice(lastIndex, match.index)
    }
    lastIndex = SVG_TAG_RE.lastIndex

    const isClosing = match[1] === '/'
    const tag = match[2].toLowerCase()
    const isSelfClosing = match[4] === '/'

    if (skipDepth > 0) {
      // 正在跳过不安全元素的子树：统计同名嵌套，找到匹配闭标签后退出跳过
      if (isClosing && tag === skipTag) {
        skipDepth--
      } else if (!isClosing && !isSelfClosing && tag === skipTag) {
        skipDepth++
      }
      continue
    }

    if (SVG_SAFE_TAGS.has(tag)) {
      result += match[0]
    } else if (!isSelfClosing && !isClosing) {
      // 不安全元素：连同子树一起丢弃
      skipTag = tag
      skipDepth = 1
    }
    // 不安全自闭合元素：直接丢弃
  }
  if (skipDepth === 0) {
    result += content.slice(lastIndex)
  }
  return result
}

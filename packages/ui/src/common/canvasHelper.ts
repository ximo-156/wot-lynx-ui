/**
 * Canvas 2D 宿主能力封装。
 *
 * Lynx **没有内置 canvas 元素**（内置元素只有 view / text / image / scroll-view /
 * list / swiper / input / textarea / switch / checkbox / radio / slider / form /
 * label / svg / video / web-view / page）。因此画布相关的真实能力只能由宿主
 * 原生模块提供：
 *
 * ```ts
 * NativeModules.WotLynxUI = {
 *   createCanvasContext(selector, scope) { … },
 *   canvasToTempFilePath(options, scope) { … }
 * }
 * ```
 *
 * 宿主未注册时返回可诊断的降级对象：组件据此走 SVG / 提示路径，
 * 不伪造「导出成功」。
 */
import { getHost } from './host'
import { warnOnce } from './util'

export type CanvasContext = any

const noopContext = new Proxy({}, { get: () => () => undefined })

export function createCanvasContext(selector: string, scope?: any): CanvasContext {
  const host = getHost()
  if (typeof host.createCanvasContext === 'function') return host.createCanvasContext(selector, scope)
  warnOnce(
    'canvas-context-unavailable',
    '[wot-lynx-ui] Lynx 无内置 canvas 元素：需要宿主原生模块提供 createCanvasContext（NativeModules.WotLynxUI）'
  )
  return noopContext
}

export function canvasToTempFilePath(options: any, scope?: any): any {
  const host = getHost()
  if (typeof host.canvasToTempFilePath === 'function') return host.canvasToTempFilePath(options, scope)
  warnOnce(
    'canvas-export-unavailable',
    '[wot-lynx-ui] 宿主未提供 canvasToTempFilePath，无法导出真实图片文件'
  )
  const failure = { errMsg: 'canvasToTempFilePath:fail host capability unavailable' }
  options?.fail?.(failure)
  options?.complete?.(failure)
  return Promise.resolve(undefined)
}

/** 保留给宿主自定义 2D 上下文适配（例如把标准 CanvasRenderingContext2D 包成小程序风格）。 */
export function canvas2dAdapter(ctx: any): CanvasContext {
  return getHost().createCanvasContext ? (getHost() as any).canvas2dAdapter?.(ctx) ?? ctx ?? noopContext : ctx ?? noopContext
}

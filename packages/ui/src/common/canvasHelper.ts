/** Canvas 为可选宿主能力；库组件优先使用原生 SVG。 */
import { getUniAdapter } from './uniAdapter'
export type CanvasContext = any
const noopContext = new Proxy({}, { get: () => () => undefined })

export function createCanvasContext(selector: string, scope?: any): CanvasContext {
  const adapter = getUniAdapter('createCanvasContext')
  if (adapter) return adapter(selector, scope)
  console.warn('[wot-lynx-ui] Lynx 无 Canvas 2D，未注入 createCanvasContext 宿主能力')
  return noopContext
}

export function canvasToTempFilePath(options: any, scope?: any): any {
  const adapter = getUniAdapter('canvasToTempFilePath')
  if (adapter) return adapter(options, scope)
  console.warn('[wot-lynx-ui] 未注入 canvasToTempFilePath，不能导出真实临时文件')
  const failure = { errMsg: 'canvasToTempFilePath:fail not supported in lynx' }
  options?.fail?.(failure)
  options?.complete?.(failure)
  return Promise.resolve(undefined)
}

export function canvas2dAdapter(ctx: any): CanvasContext {
  return getUniAdapter('canvas2dAdapter')?.(ctx) ?? ctx ?? noopContext
}

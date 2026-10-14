/**
 * canvas 辅助（Lynx 无 Canvas 2D API 的占位实现）。
 *
 * Lynx 引擎不提供 Canvas 2D 上下文，依赖 canvas 的组件（signature / img-cropper /
 * circle / bar-code / qr-code）需要迁移到 SVG 方案。此处保留接口以兼容类型，
 * 调用时会在控制台给出警告。
 */

/** Lynx 无 Canvas 2D，统一退化为 any */
export type CanvasContext = any

/** 空实现：所有方法调用返回 undefined */
const noopContext = new Proxy(
  {},
  {
    get: () => () => undefined
  }
)

export function createCanvasContext(_selector: string, _scope?: any): CanvasContext {
  console.warn('[wot-lynx-ui] Lynx 不支持 Canvas 2D API，相关组件请使用 SVG 方案替代')
  return noopContext
}

export function canvasToTempFilePath(_options: any, _scope?: any): Promise<any> {
  console.warn('[wot-lynx-ui] Lynx 不支持 Canvas 2D API，canvasToTempFilePath 不可用')
  return Promise.resolve({})
}

/**
 * canvas2dAdapter — uni-app Canvas 2D 接口适配（Lynx 占位，返回空实现）
 */
export function canvas2dAdapter(_ctx: any): CanvasContext {
  return noopContext
}

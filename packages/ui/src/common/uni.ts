/**
 * uni-app 兼容层 — Lynx 环境不存在 uni 全局对象，本模块提供安全的降级实现。
 *
 * 设计原则（与 CONVENTIONS.md 一致）：
 * 1. **不崩溃**：任何 uni API 在 Lynx 中调用都不会抛 ReferenceError；
 * 2. **可注入**：宿主应用（Demo / 业务方）可通过 `configureUniAdapter()` 注入
 *    真实能力（路由跳转、媒体选择、Toast 等），组件库默认降级并 warning；
 * 3. **Lynx 优先**：Lynx 自身提供的能力（SystemInfo、createSelectorQuery）
 *    直接映射到 Lynx API。
 *
 * 使用方式（组件内）：
 *   import { uni } from '../../common/uni'
 *   uni.navigateTo({ url })   // 与 uni-app 写法一致
 *
 * 宿主注入（业务方 main.ts）：
 *   import { configureUniAdapter } from 'wot-lynx-ui'
 *   configureUniAdapter({ navigateTo: (opts) => router.push(opts.url) })
 */

import { getSystemInfo } from './util'
import { createCanvasContext, canvasToTempFilePath } from './canvasHelper'

/** 宿主可注入的适配器（键与 uni API 同名） */
export type UniAdapter = Record<string, any>

const hostAdapter: UniAdapter = {}

/** 宿主注入真实实现，如路由、媒体选择、Toast */
export function configureUniAdapter(adapter: UniAdapter): void {
  Object.assign(hostAdapter, adapter)
}

/** 宿主是否注入了某个 API 的真实实现（用于能力检测后再决定是否走降级路径） */
export function hasUniAdapter(api: string): boolean {
  return typeof hostAdapter[api] === 'function'
}

// ---------------------------------------------------------------------------
// warning 去重（同一 API 仅提示一次，避免刷屏）
// ---------------------------------------------------------------------------
const warned = new Set<string>()
function warnOnce(api: string, hint?: string): void {
  if (warned.has(api)) return
  warned.add(api)
  console.warn(`[wot-lynx-ui] uni.${api} 在 Lynx 中不可用${hint ? `：${hint}` : ''}。可通过 configureUniAdapter({ ${api} }) 注入宿主实现。`)
}

/** 通用降级：调用宿主实现或 fail 回调 + warning */
function degrade(api: string, options?: any, hint?: string): void {
  if (typeof hostAdapter[api] === 'function') {
    hostAdapter[api](options)
    return
  }
  warnOnce(api, hint)
  if (options && typeof options.fail === 'function') {
    options.fail({ errMsg: `${api}:fail not supported in lynx` })
  }
  if (options && typeof options.complete === 'function') {
    options.complete({ errMsg: `${api}:fail not supported in lynx` })
  }
}

// ---------------------------------------------------------------------------
// 系统信息 — 映射到 Lynx SystemInfo
// ---------------------------------------------------------------------------
function systemInfo(): any {
  return getSystemInfo()
}

// ---------------------------------------------------------------------------
// SelectorQuery — 映射到 lynx.createSelectorQuery，缺失时返回零矩形兜底
// ---------------------------------------------------------------------------
const zeroRect = { id: '', left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }

function makeFallbackNodesRef(): any {
  const ref = {
    invoke(options: any) {
      if (options && typeof options.success === 'function') {
        setTimeout(() => options.success(zeroRect), 0)
      }
      return { exec: () => {} }
    },
    boundingClientRect(cb: any) {
      if (typeof cb === 'function') setTimeout(() => cb(zeroRect), 0)
      return { exec: () => {} }
    },
    fields(_: any, cb: any) {
      if (typeof cb === 'function') setTimeout(() => cb({ ...zeroRect }), 0)
      return { exec: () => {} }
    }
  }
  return ref
}

function makeFallbackQuery(): any {
  const ref = makeFallbackNodesRef()
  return {
    select: () => ref,
    selectAll: () => ref,
    in: () => makeFallbackQuery(),
    exec: () => {}
  }
}

function createSelectorQuery(): any {
  const lynx = (globalThis as any).lynx
  if (lynx && typeof lynx.createSelectorQuery === 'function') {
    return lynx.createSelectorQuery()
  }
  return makeFallbackQuery()
}

// ---------------------------------------------------------------------------
// 其他降级对象
// ---------------------------------------------------------------------------
const noopObserver = () => ({
  observe: () => {},
  unobserve: () => {},
  disconnect: () => {},
  relativeTo: () => {},
  relativeToViewport: () => {}
})

const noopVideoContext = () =>
  new Proxy(
    {},
    {
      get: () => () => undefined
    }
  )

const zeroMenuButtonRect = () => ({
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
})

// ---------------------------------------------------------------------------
// uni 兼容对象
// ---------------------------------------------------------------------------
export const uni: Record<string, any> = {
  // ---- 系统信息 ----
  getSystemInfoSync: systemInfo,
  getSystemInfo: (options?: any) => {
    const res = systemInfo()
    if (options && typeof options.success === 'function') options.success(res)
    if (options && typeof options.complete === 'function') options.complete(res)
    return res
  },
  getWindowInfo: systemInfo,
  getDeviceInfo: systemInfo,
  getAppBaseInfo: systemInfo,
  getMenuButtonBoundingClientRect: zeroMenuButtonRect,
  canIUse: () => false,

  // ---- 节点查询 ----
  createSelectorQuery,
  createIntersectionObserver: () => {
    warnOnce('createIntersectionObserver', 'Lynx 无该 API，返回空实现')
    return noopObserver()
  },

  // ---- 媒体 ----
  createVideoContext: () => {
    warnOnce('createVideoContext', 'Lynx 无该 API，返回空实现')
    return noopVideoContext()
  },
  createInnerAudioContext: () => {
    warnOnce('createInnerAudioContext', 'Lynx 无该 API，返回空实现')
    return noopVideoContext()
  },

  // ---- 画布（Lynx 无 Canvas 2D，统一降级，见 canvasHelper） ----
  createCanvasContext: (selector: string, scope?: any) => createCanvasContext(selector, scope),
  canvasToTempFilePath: (options: any, scope?: any) => canvasToTempFilePath(options, scope),
  createOffscreenCanvas: () => {
    warnOnce('createOffscreenCanvas', 'Lynx 无该 API')
    return null
  },
  canvasGetImageData: () => {
    warnOnce('canvasGetImageData', 'Lynx 无该 API')
    return Promise.resolve(null)
  },

  // ---- 路由 / 页面（交由宿主注入） ----
  navigateTo: (options: any) => degrade('navigateTo', options, '页面跳转请交由宿主路由处理'),
  redirectTo: (options: any) => degrade('redirectTo', options, '页面跳转请交由宿主路由处理'),
  reLaunch: (options: any) => degrade('reLaunch', options, '页面跳转请交由宿主路由处理'),
  switchTab: (options: any) => degrade('switchTab', options, '页面跳转请交由宿主路由处理'),
  navigateBack: (options: any) => degrade('navigateBack', options, '页面返回请交由宿主路由处理'),
  pageScrollTo: (options: any) => degrade('pageScrollTo', options, '页面滚动请交由宿主处理'),

  // ---- 交互反馈 ----
  showToast: (options: any) => degrade('showToast', options),
  showLoading: (options: any) => degrade('showLoading', options),
  hideLoading: () => degrade('hideLoading'),
  showActionSheet: (options: any) => degrade('showActionSheet', options),
  setNavigationBarTitle: (options: any) => degrade('setNavigationBarTitle', options),
  vibrateShort: (options: any) => degrade('vibrateShort', options),
  vibrateLong: (options: any) => degrade('vibrateLong', options),

  // ---- 媒体选择 / 文件（宿主能力） ----
  chooseImage: (options: any) => degrade('chooseImage', options),
  chooseMedia: (options: any) => degrade('chooseMedia', options),
  chooseVideo: (options: any) => degrade('chooseVideo', options),
  chooseFile: (options: any) => degrade('chooseFile', options),
  chooseMessageFile: (options: any) => degrade('chooseMessageFile', options),
  getImageInfo: (options: any) => degrade('getImageInfo', options),
  compressImage: (options: any) => degrade('compressImage', options),
  uploadFile: (options: any) => degrade('uploadFile', options),
  saveImageToPhotosAlbum: (options: any) => degrade('saveImageToPhotosAlbum', options),
  previewImage: (options: any) => degrade('previewImage', options),
  previewMedia: (options: any) => degrade('previewMedia', options),
  openDocument: (options: any) => degrade('openDocument', options)
}

// 兜底：若有遗漏的直接全局 uni 引用（未 import 本模块的文件），
// 在首次导入时安装到 globalThis，避免 ReferenceError。
if (typeof globalThis !== 'undefined' && !(globalThis as any).uni) {
  ;(globalThis as any).uni = uni
}

export default uni

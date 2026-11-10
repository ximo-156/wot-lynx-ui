/**
 * 宿主能力桥（Lynx 原生扩展点）。
 *
 * 本库**不再兼容 uni-app**：没有 `uni.*` 门面、没有 `configureUniAdapter`。
 * 宿主专属能力（路由 / 媒体选择 / 上传 / 页面滚动 / 振动 / 拨号 …）在 Lynx 里
 * 只有一条正路——宿主用 **Native Module** 或 **JS Module** 注册能力，库按固定
 * 契约取用。查找顺序：
 *
 * 1. `configureHost({ ... })` 显式注入（Web 预览、单测、特殊宿主）；
 * 2. `NativeModules.WotLynxUI`（宿主注册的原生模块）；
 * 3. `lynx.getJSModule('WotLynxUI')`（宿主注册的 JS 模块）。
 *
 * 三者都没有时，对应能力视为**不可用**：组件走原生降级路径（SVG 代替 canvas、
 * 事件代替路由），不会静默假装成功。
 *
 * 官方契约：
 * - https://lynxjs.org/guide/use-native-modules.md
 * - https://lynxjs.org/api/lynx-api/lynx/lynx-get-js-module.md
 */

import { getNativeModule, getJSModule } from './native'
import { getNativeMediaPickerHost, supplementMediaPicker } from './nativeMediaPicker'
import type { SafeAreaInsets } from './safe-area'

/** 宿主返回的矩形。 */
export interface HostRect {
  width: number
  height: number
  left: number
  right: number
  top: number
  bottom: number
}

/** 宿主返回的上传任务（Lynx 侧只需支持 abort 与进度回调）。 */
export interface HostUploadTask {
  abort?: () => void
  onProgressUpdate?: (callback: (result: { progress: number; totalBytesSent?: number; totalBytesExpectedToSend?: number }) => void) => void
  [key: string]: any
}

/**
 * 宿主能力契约。
 *
 * 所有方法都是**可选**的：缺哪个能力，对应组件就降级，不抛错、不静默成功。
 */
export interface WotLynxHost {
  // --- 路由 ---------------------------------------------------------------
  navigateTo?: (options: { url: string }) => void
  redirectTo?: (options: { url: string }) => void
  reLaunch?: (options: { url: string }) => void
  switchTab?: (options: { url: string }) => void
  navigateBack?: (options?: { delta?: number }) => void

  // --- 滚动 ---------------------------------------------------------------
  /** 页面级滚动（Lynx 页面本身不滚动，通常由宿主的 scroll-view 承载）。 */
  pageScrollTo?: (options: { scrollTop: number; duration?: number; success?: () => void; fail?: () => void }) => void

  // --- 媒体 ---------------------------------------------------------------
  /** 打开系统图片预览。 */
  previewImage?: (options: { urls: string[]; current?: string; success?: () => void; fail?: () => void }) => void
  /** 打开文档（PDF 等）。 */
  openDocument?: (options: { filePath: string; showMenu?: boolean }) => void
  /** 选择图片 / 视频（uni.chooseMedia 的原生替代）。 */
  chooseMedia?: (options: any) => void
  /** 从会话选择文件。 */
  chooseMessageFile?: (options: any) => void
  /** 从系统选择文件。 */
  chooseFile?: (options: any) => void
  /** 上传文件。 */
  uploadFile?: (options: any) => HostUploadTask | void

  // --- 设备 ---------------------------------------------------------------
  /** 短震动。 */
  vibrateShort?: (options?: any) => void
  /** 拨打电话。 */
  makePhoneCall?: (options: { phoneNumber: string }) => void
  /** 开放能力（getUserInfo / getPhoneNumber / …）。 */
  openType?: (options: any) => void
  /** 小程序胶囊按钮矩形（Lynx 宿主通常没有，返回 null 即可）。 */
  getMenuButtonRect?: () => HostRect | null

  // --- 画布 ---------------------------------------------------------------
  /** Canvas 2D 上下文（Lynx 没有内置 canvas 元素，宿主提供时才有）。 */
  createCanvasContext?: (selector: string, scope?: any) => any
  /** 画布导出临时文件。 */
  canvasToTempFilePath?: (options: any, scope?: any) => any

  // --- 视口 ---------------------------------------------------------------
  /**
   * 当前 LynxView 内仍需避让的安全区，单位为逻辑 px；已经避让的边返回 0。
   * iOS 取视图 safeAreaInsets，Android 取系统栏/刘海 WindowInsets 与视图的交集。
   * 可返回部分边；未提供的边继续读取 SystemInfo / CSS 环境值。
   */
  getSafeAreaInsets?: () => Partial<SafeAreaInsets> | null
  /** 窗口或系统栏变化回调；安全区变化但宽高未变时也应通知。 */
  onWindowResize?: (callback: (size: any) => void) => void
  offWindowResize?: (callback: (size: any) => void) => void

  // --- 元素支持 -----------------------------------------------------------
  /** 宿主是否注册了原生 `<video>` 元素（XElement，未注册时创建节点会抛引擎错误）。 */
  supportsVideoElement?: () => boolean
}

/** 显式注入的能力（优先级最高）。 */
let injectedHost: WotLynxHost | null = null
const hostChangeListeners = new Set<() => void>()
// Media supplementation must not manufacture a new event-source identity on every read.
const supplementedHosts = new WeakMap<WotLynxHost, {
  media: NonNullable<ReturnType<typeof getNativeMediaPickerHost>>
  facade: WotLynxHost
}>()

/** @internal React to late registration/replacement without caching a setup snapshot. */
export function subscribeHostChange(callback: () => void): () => void {
  hostChangeListeners.add(callback)
  return () => { hostChangeListeners.delete(callback) }
}

/**
 * 注入宿主能力。
 *
 * @param host 能力集合；传 `null` 表示撤回显式注入（回到 Native Module 探测）。
 */
export function configureHost(host: WotLynxHost | null): void {
  if (injectedHost === host) return
  injectedHost = host
  for (const notify of [...hostChangeListeners]) {
    if (hostChangeListeners.has(notify)) notify()
  }
}

/** 取当前宿主能力（稳定实例，能力读取实时）。 */
export function getHost(): WotLynxHost {
  if (injectedHost) return injectedHost
  const host = readModule('WotLynxUI') || readModule('WotLynxUIHost')
  if (host && typeof host.chooseMedia === 'function') return host
  const media = getNativeMediaPickerHost()
  if (media && host) {
    let record = supplementedHosts.get(host)
    if (!record) {
      const created = { media, facade: host }
      created.facade = supplementMediaPicker(host, { chooseMedia: (options) => created.media.chooseMedia(options) })
      supplementedHosts.set(host, created)
      record = created
    }
    // Keep late native media registration live without replacing the host facade.
    record.media = media
    return record.facade
  }
  return media || host || {}
}

function readModule(name: string): WotLynxHost | null {
  const native = getNativeModule<WotLynxHost>(name)
  if (native) return native
  const jsModule = getJSModule<WotLynxHost>(name)
  return jsModule && typeof jsModule === 'object' ? jsModule : null
}

/** 判断某项宿主能力是否可用。 */
export function hasHostCapability(name: keyof WotLynxHost): boolean {
  const host = getHost()
  return typeof host[name] === 'function'
}

/**
 * 调用宿主能力；不可用时执行 `fallback`（返回 false 表示「没有执行」）。
 *
 * 组件用它把「宿主能力缺失」变成一次可预期的降级，而不是一次异常。
 */
export function callHost<T = void>(
  name: keyof WotLynxHost,
  ...args: any[]
): { called: boolean; result?: T } {
  const host = getHost()
  const method = host[name]
  if (typeof method !== 'function') return { called: false }
  try {
    return { called: true, result: (method as (...a: any[]) => T).apply(host, args) }
  } catch (error) {
    console.warn(`[wot-lynx-ui] 宿主能力 ${String(name)} 调用失败`, error)
    return { called: false }
  }
}

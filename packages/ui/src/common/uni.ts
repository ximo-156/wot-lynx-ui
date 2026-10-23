/**
 * uni-app 兼容层。Lynx 本地能力优先；宿主可通过 configureUniAdapter 注入
 * 路由、媒体、系统安全区与观察器。未注入的能力只返回可诊断的降级结果，
 * 不能把空对象/空路径当作真实成功。
 */
import { getSystemInfo } from './util'
import { createCanvasContext, canvasToTempFilePath } from './canvasHelper'
import { getUniAdapter } from './uniAdapter'
import { getPlatform } from './platform'
export { configureUniAdapter, hasUniAdapter } from './uniAdapter'
export type { UniAdapter } from './uniAdapter'

const warned = new Set<string>()
function warnOnce(api: string, hint?: string): void {
  if (warned.has(api)) return
  warned.add(api)
  // 平台名来自 getPlatform()，而不是写死 "Lynx"：本库也跑在 web 环境
  // （packages/demo 的 environments.web），报错文案写错平台会误导排查。
  console.warn(
    `[wot-lynx-ui] uni.${api} 在当前平台（${getPlatform().name}）不可用${hint ? `：${hint}` : ''}。可通过 configureUniAdapter({ ${api} }) 注入宿主实现。`
  )
}

function degrade(api: string, options?: any, hint?: string): any {
  const adapter = getUniAdapter(api)
  if (adapter) return adapter(options)
  warnOnce(api, hint)
  const failure = { errMsg: `${api}:fail not supported in lynx` }
  options?.fail?.(failure)
  options?.complete?.(failure)
}

/** 多参数工厂必须原样转发 scope/id/options，不能像普通 options API 只传第一个参数。 */
function factory(api: string, args: any[], fallback: () => any): any {
  const adapter = getUniAdapter(api)
  if (adapter) return adapter(...args)
  warnOnce(api, '需要宿主能力；当前返回降级对象')
  return fallback()
}

const zeroRect = { id: '', left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
function makeFallbackNodesRef(): any {
  return {
    invoke(options: any) {
      if (typeof options?.success === 'function') setTimeout(() => options.success({ ...zeroRect }), 0)
      return { exec: () => {} }
    },
    boundingClientRect(cb: any) {
      if (typeof cb === 'function') setTimeout(() => cb({ ...zeroRect }), 0)
      return { exec: () => {} }
    },
    fields(_: any, cb: any) {
      if (typeof cb === 'function') setTimeout(() => cb({ ...zeroRect }), 0)
      return { exec: () => {} }
    }
  }
}
function makeFallbackQuery(): any {
  const query = {
    select: () => makeFallbackNodesRef(),
    selectAll: () => makeFallbackNodesRef(),
    in: (_scope: any) => query,
    exec: () => {}
  }
  return query
}
function createSelectorQuery(...args: any[]): any {
  const adapter = getUniAdapter('createSelectorQuery')
  if (adapter) return adapter(...args)
  const lynx = (globalThis as any).lynx
  return typeof lynx?.createSelectorQuery === 'function' ? lynx.createSelectorQuery(...args) : makeFallbackQuery()
}
function noopObserver(): any {
  const observer = {
    observe: () => {},
    unobserve: () => {},
    disconnect: () => {},
    relativeTo: (..._args: any[]) => observer,
    relativeToViewport: (..._args: any[]) => observer
  }
  return observer
}
const noopVideoContext = () => new Proxy({}, { get: () => () => undefined })
const zeroMenuButtonRect = () => ({ width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 })
function systemBucket(api: string): any {
  const adapter = getUniAdapter(api)
  return adapter ? adapter() : getSystemInfo()
}

export const uni: Record<string, any> = {
  getSystemInfoSync: getSystemInfo,
  getSystemInfo: (options?: any) => {
    const adapter = getUniAdapter('getSystemInfo')
    if (adapter) return adapter(options)
    const res = getSystemInfo()
    options?.success?.(res)
    options?.complete?.(res)
    return res
  },
  getWindowInfo: () => systemBucket('getWindowInfo'),
  getDeviceInfo: () => systemBucket('getDeviceInfo'),
  getAppBaseInfo: () => systemBucket('getAppBaseInfo'),
  getMenuButtonBoundingClientRect: (...args: any[]) => {
    const adapter = getUniAdapter('getMenuButtonBoundingClientRect')
    return adapter ? adapter(...args) : zeroMenuButtonRect()
  },
  canIUse: (...args: any[]) => getUniAdapter('canIUse')?.(...args) ?? false,

  createSelectorQuery,
  createIntersectionObserver: (...args: any[]) => factory('createIntersectionObserver', args, noopObserver),
  createVideoContext: (...args: any[]) => factory('createVideoContext', args, noopVideoContext),
  createInnerAudioContext: (...args: any[]) => factory('createInnerAudioContext', args, noopVideoContext),

  createCanvasContext: (selector: string, scope?: any) => createCanvasContext(selector, scope),
  canvasToTempFilePath: (options: any, scope?: any) => canvasToTempFilePath(options, scope),
  createOffscreenCanvas: (...args: any[]) => factory('createOffscreenCanvas', args, () => null),
  canvasGetImageData: (options: any, scope?: any) => {
    const adapter = getUniAdapter('canvasGetImageData')
    if (adapter) return adapter(options, scope)
    return degrade('canvasGetImageData', options)
  },

  navigateTo: (options: any) => degrade('navigateTo', options, '页面跳转请交由宿主路由处理'),
  redirectTo: (options: any) => degrade('redirectTo', options, '页面跳转请交由宿主路由处理'),
  reLaunch: (options: any) => degrade('reLaunch', options),
  switchTab: (options: any) => degrade('switchTab', options),
  navigateBack: (options: any) => degrade('navigateBack', options),
  pageScrollTo: (options: any) => degrade('pageScrollTo', options, '页面滚动请交由宿主处理'),
  openType: (options: any) => degrade('openType', options, '按钮开放能力请交由宿主实现'),
  showToast: (options: any) => degrade('showToast', options),
  makePhoneCall: (options: any) => degrade('makePhoneCall', options),
  showLoading: (options: any) => degrade('showLoading', options),
  hideLoading: () => degrade('hideLoading'),
  showActionSheet: (options: any) => degrade('showActionSheet', options),
  setNavigationBarTitle: (options: any) => degrade('setNavigationBarTitle', options),
  vibrateShort: (options: any) => degrade('vibrateShort', options),
  vibrateLong: (options: any) => degrade('vibrateLong', options),

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

if (typeof globalThis !== 'undefined' && !(globalThis as any).uni) (globalThis as any).uni = uni
export default uni

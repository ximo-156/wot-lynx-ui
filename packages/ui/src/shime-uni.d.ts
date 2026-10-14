/**
 * uni-app 兼容类型声明（Lynx 环境无 uni 运行时，仅用于类型兼容）。
 * 组件中的 uni.* 调用已被替换或降级，此处保留类型以便迁移中的代码通过类型检查。
 */
declare namespace UniApp {
  interface NodeInfo {
    id: string
    left: number
    right: number
    top: number
    bottom: number
    width: number
    height: number
    [key: string]: any
  }
  interface SafeArea {
    left: number
    right: number
    top: number
    bottom: number
    width: number
    height: number
  }
  interface SafeAreaInsets {
    top: number
    right: number
    bottom: number
    left: number
  }
  interface CanvasContext {
    [key: string]: any
  }
  interface IntersectionObserver {
    [key: string]: any
  }
  interface GetImageInfoSuccessData {
    [key: string]: any
  }
  interface UploadFileSuccessCallbackResult {
    data: string
    statusCode: number
    [key: string]: any
  }
  interface GeneralCallbackResult {
    errMsg: string
    [key: string]: any
  }
  interface OnProgressUpdateResult {
    progress: number
    totalBytesSent: number
    totalBytesExpectedToSend: number
    [key: string]: any
  }
  interface ChooseImageSuccessCallbackResult {
    tempFilePaths: string[]
    [key: string]: any
  }
  interface ChooseVideoSuccess {
    tempFilePath: string
    [key: string]: any
  }
  interface ChooseMediaSuccessCallbackResult {
    tempFiles: any[]
    [key: string]: any
  }
  interface UploadTask {
    [key: string]: any
  }
  interface CanvasToTempFilePathOptions {
    [key: string]: any
  }
  interface Canvas {
    [key: string]: any
  }
  interface GetSystemInfoSyncOptions {
    success?: (res: any) => void
    fail?: (err: any) => void
  }
  interface NavigateToOptions {
    url: string
    [key: string]: any
  }
}

declare const uni: {
  getSystemInfoSync(): any
  getDeviceInfo(): any
  getWindowInfo(): any
  getAppBaseInfo(): any
  getMenuButtonBoundingClientRect(): any
  createSelectorQuery(): any
  navigateTo(options: UniApp.NavigateToOptions): void
  redirectTo(options: UniApp.NavigateToOptions): void
  showToast(options: any): void
  showLoading(options: any): void
  hideLoading(): void
  setNavigationBarTitle(options: any): void
  [key: string]: any
}

declare namespace WechatMiniprogram {
  type CanvasContext = UniApp.CanvasContext
  interface Canvas {
    [key: string]: any
  }
  interface Component {
    [key: string]: any
  }
}

declare function getCurrentPages(): any[]
declare const wx: any

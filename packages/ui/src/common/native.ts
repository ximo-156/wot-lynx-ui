/**
 * Lynx 原生能力层。
 *
 * 这里只封装 **Lynx 引擎自身提供的能力**（`lynx` 全局 + `SystemInfo`），
 * 不含任何 uni-app / 小程序兼容层：
 *
 * | 能力 | 原生来源 |
 * |---|---|
 * | 节点度量 | `lynx.createSelectorQuery()` → `NodesRef.invoke` |
 * | 交叉观察 | `lynx.createIntersectionObserver()` |
 * | 原生 UIMethod | `lynx.createSelectorQuery().select(id).invoke({ method })` |
 * | 宿主原生模块 | `NativeModules.<name>` |
 * | 宿主 JS 模块 | `lynx.getJSModule(name)` |
 * | 屏幕信息 | `SystemInfo` 全局对象 |
 *
 * 宿主专属能力（路由 / 媒体选择 / 上传 / 页面滚动 / 振动 / 拨号 …）走
 * `common/host.ts`——那是 Lynx 的原生扩展点（Native Modules / JS Module），
 * 不是小程序 API 的仿真层。
 *
 * 官方契约：
 * - https://lynxjs.org/api/lynx-api/lynx/lynx-create-selector-query.md
 * - https://lynxjs.org/api/lynx-api/lynx/lynx-create-intersection-observer.md
 * - https://lynxjs.org/api/lynx-api/nodes-ref/nodes-ref-invoke.md
 */

/** Lynx 运行时全局对象（本库只用其中几个稳定方法，故只声明用到的部分）。 */
export interface LynxRuntime {
  createSelectorQuery?: () => any
  createIntersectionObserver?: (component: unknown, options?: { thresholds?: number[]; initialRatio?: number; observeAll?: boolean }) => any
  getJSModule?: (name: string) => any
  getElementById?: (id: string) => any
  requestAnimationFrame?: (callback: (time: number) => void) => number
  cancelAnimationFrame?: (handle: number) => void
  getEngineVersion?: () => string
  __globalProps?: Record<string, any> | null
  [key: string]: any
}

/**
 * Lynx bundle 的 SDK 由模块包装器以词法参数注入，不一定挂在 globalThis。
 * declare 仅提供类型，不创建变量；Node / 测试宿主仍可使用全局对象兜底。
 */
declare const lynx: LynxRuntime | undefined

/** 取当前模块的 Lynx SDK，避免把 Web 后台 Worker 的空全局当作 SDK。 */
export function getLynxRuntime(): LynxRuntime | undefined {
  const runtime = typeof lynx !== 'undefined' ? lynx : (globalThis as any).lynx
  return runtime && typeof runtime === 'object' ? (runtime as LynxRuntime) : undefined
}

/**
 * 创建原生 SelectorQuery。
 *
 * 真机与 Lynx Web 都由引擎提供；测试环境（jsdom）没有该实现，返回 undefined，
 * 调用方据此走「不可度量」分支，而不是伪造一份空实现（伪造会让 Promise 永远
 * 挂起，交互类组件全部失效）。
 */
export function createSelectorQuery(): any | undefined {
  const runtime = getLynxRuntime()
  if (typeof runtime?.createSelectorQuery !== 'function') return undefined
  try {
    return runtime.createSelectorQuery()
  } catch {
    return undefined
  }
}

/**
 * 创建原生 IntersectionObserver。
 *
 * `component` 传 undefined 表示全局检索（引擎找不到组件内节点时也会全局兜底）。
 * Lynx Web 不支持该 API，返回 undefined——调用方据此退回 CSS `position: sticky`。
 */
export function createIntersectionObserver(thresholds: number[] = [0]): any | undefined {
  const runtime = getLynxRuntime()
  if (typeof runtime?.createIntersectionObserver !== 'function') return undefined
  try {
    return runtime.createIntersectionObserver(undefined, { thresholds })
  } catch {
    return undefined
  }
}

/** 原生 UIMethod 回调。 */
export interface NativeInvokeCallbacks {
  success?: (result: any) => void
  fail?: (result: any) => void
}

/**
 * 调用原生元素的 UIMethod（video 的 play/pause、input 的 setValue/focus、
 * scroll-view 的 scrollTo …）。
 *
 * 全部走 `lynx.createSelectorQuery().select(id).invoke(...).exec()`——这是 Lynx
 * 唯一的原生方法通道，不经过后台线程的 props  diff，延迟最低。
 *
 * @returns 是否成功发起调用（false 表示运行时不支持该通道）
 */
export function invokeNative(
  selector: string,
  method: string,
  params?: Record<string, any>,
  callbacks?: NativeInvokeCallbacks
): boolean {
  const query = createSelectorQuery()
  if (!query || typeof query.select !== 'function') return false
  try {
    const nodesRef = query.select(selector)
    if (!nodesRef || typeof nodesRef.invoke !== 'function') return false
    nodesRef
      .invoke({
        method,
        ...(params ? { params } : {}),
        // 官方文档：缺少 fail 时原生失败可能触发宿主红屏，必须显式给出。
        success: (result: any) => callbacks?.success?.(result),
        fail: (result: any) => callbacks?.fail?.(result)
      })
      .exec()
    return true
  } catch {
    return false
  }
}

/** 取宿主注册的原生模块（Lynx `NativeModules` 全局对象）。 */
export function getNativeModule<T = any>(name: string): T | undefined {
  const modules = (globalThis as any).NativeModules
  if (!modules || typeof modules !== 'object') return undefined
  const target = modules[name]
  return target && typeof target === 'object' ? (target as T) : undefined
}

/** 取宿主注册的 JS 模块（`lynx.getJSModule(name)`）。 */
export function getJSModule<T = any>(name: string): T | undefined {
  const runtime = getLynxRuntime()
  if (typeof runtime?.getJSModule !== 'function') return undefined
  try {
    return runtime.getJSModule(name) as T | undefined
  } catch {
    return undefined
  }
}

/**
 * 请求一帧（Lynx 原生 rAF）。
 *
 * 后台线程同样有 `lynx.requestAnimationFrame`；缺失时退回 `setTimeout`，
 * 保证测试环境与极老宿主仍能推进（真机不会走到这条分支）。
 */
export function requestNativeFrame(callback: (time: number) => void): number {
  const runtime = getLynxRuntime()
  if (typeof runtime?.requestAnimationFrame === 'function') {
    return runtime.requestAnimationFrame(callback)
  }
  return setTimeout(() => callback(Date.now()), 1000 / 60) as unknown as number
}

/** 取消由 `requestNativeFrame` 登记的帧回调。 */
export function cancelNativeFrame(handle: number): void {
  const runtime = getLynxRuntime()
  if (typeof runtime?.cancelAnimationFrame === 'function') {
    runtime.cancelAnimationFrame(handle)
    return
  }
  clearTimeout(handle as unknown as ReturnType<typeof setTimeout>)
}

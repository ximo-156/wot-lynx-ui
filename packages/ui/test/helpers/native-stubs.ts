/**
 * 原生能力测试桩（ADR-022：uni 兼容层移除后）。
 *
 * 组件读取的是 **Lynx 引擎原生能力**，不是宿主注入的 `uni.*` 仿真层：
 *
 * | 能力 | 生产读取点 | 测试桩 |
 * |---|---|---|
 * | 节点度量 / UIMethod | `lynx.createSelectorQuery()` | `stubNativeQuery()` |
 * | 交叉观察 | `lynx.createIntersectionObserver()` | `stubNativeObserver()` |
 * | 屏幕信息 | `globalThis.SystemInfo` | `setSystemInfo()` |
 *
 * ⚠️ 双线程测试环境里，`switchToMainThread()` / `switchToBackgroundThread()`
 * 会把该线程的全局对象**整体换到** `globalThis` 上，因此：
 * - 直接 `globalThis.SystemInfo = {...}` 会在下一次线程切换时被覆盖；
 *   必须**原地改对象**（本文件的 `setSystemInfo` 就是这么做的）。
 * - 组件运行在 background 线程，桩必须打在
 *   `lynxTestingEnv.backgroundThread.globalThis.lynx` 上。
 *
 * 所有桩都登记在模块级数组里，`restoreNativeStubs()` 统一撤销；测试文件的
 * `afterEach` 调它一次即可，不依赖用例自己记得还原。
 */
import { vi } from 'vitest'

type AnyFn = (...args: any[]) => any

/** 组件实际看到的 Lynx 运行时（background 线程）。 */
export function nativeRuntime(): any {
  const env = (globalThis as any).lynxTestingEnv
  const realm = env?.backgroundThread?.globalThis
  return (realm || globalThis).lynx
}

/** 组件实际看到的 SystemInfo 对象（background 线程，跨线程切换保持同一引用）。 */
export function nativeSystemInfo(): Record<string, any> {
  const env = (globalThis as any).lynxTestingEnv
  const realm = env?.backgroundThread?.globalThis
  return ((realm || globalThis).SystemInfo || {}) as Record<string, any>
}

const restores: Array<() => void> = []

function register(restore: () => void): () => void {
  restores.push(restore)
  return restore
}

/** 撤销本次测试登记的全部原生桩。 */
export function restoreNativeStubs(): void {
  for (const restore of restores.splice(0).reverse()) restore()
}

/**
 * 覆盖 SystemInfo 字段（原地修改，跨线程切换不丢）。
 *
 * @returns 恢复函数（也会被 `restoreNativeStubs()` 统一撤销）
 */
export function setSystemInfo(patch: Record<string, any>): () => void {
  const info = nativeSystemInfo()
  const previous: Record<string, any> = {}
  const owned: string[] = []
  for (const key of Object.keys(patch)) {
    const had = Object.prototype.hasOwnProperty.call(info, key)
    previous[key] = had ? info[key] : undefined
    if (!had) owned.push(key)
    info[key] = patch[key]
  }
  return register(() => {
    for (const key of Object.keys(patch)) {
      if (owned.includes(key)) delete info[key]
      else info[key] = previous[key]
    }
  })
}

/** 引擎版本覆盖：`videoElement` 能力按 Lynx 4.1+ 判定。 */
export function setEngineVersion(version: string): () => void {
  return setSystemInfo({ engineVersion: version })
}

/**
 * 替换引擎原生 SelectorQuery。
 *
 * 默认工厂与真实引擎同形：`select(selector).invoke({ method, params, success, fail }).exec()`。
 * 传入的 `resolver` 决定 `boundingClientRect` 的返回值；其它 method 回 `{}`。
 */
export function stubNativeQuery(
  resolver: (selector: string, params: any) => any = () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 })
): { calls: Array<{ selector: string; params: any }>; restore: () => void } {
  const calls: Array<{ selector: string; params: any }> = []
  const runtime = nativeRuntime()
  const original = runtime?.createSelectorQuery
  const factory = () => {
    const query: any = {
      in: (_scope: any) => query,
      select: (selector: string) => ({
        invoke: (params: any) => ({
          exec: () => {
            calls.push({ selector, params })
            if (params.method === 'boundingClientRect') params.success?.(resolver(selector, params))
            else params.success?.({})
          }
        })
      }),
      exec: () => {}
    }
    return query
  }
  if (runtime) runtime.createSelectorQuery = factory
  const restore = register(() => {
    if (runtime) runtime.createSelectorQuery = original
  })
  return { calls, restore }
}

/** 替换引擎原生 IntersectionObserver（与官方 `lynx.createIntersectionObserver` 同形）。 */
export function stubNativeObserver(): {
  factory: ReturnType<typeof vi.fn>
  observers: any[]
  latest: (test: (selector: string) => boolean) => any
  restore: () => void
} {
  const observers: any[] = []
  const factory = vi.fn((scope: any, options: any) => {
    const observer = {
      scope,
      options,
      selector: '',
      margin: null as any,
      callback: null as any,
      relativeToViewport: vi.fn((margin: any) => {
        observer.margin = margin
        return observer
      }),
      observe: vi.fn((selector: string, callback: AnyFn) => {
        observer.selector = selector
        observer.callback = callback
      }),
      disconnect: vi.fn()
    }
    observers.push(observer)
    return observer
  })
  const runtime = nativeRuntime()
  const original = runtime?.createIntersectionObserver
  if (runtime) runtime.createIntersectionObserver = factory
  const restore = register(() => {
    if (runtime) runtime.createIntersectionObserver = original
  })
  return {
    factory,
    observers,
    latest: (test) => [...observers].reverse().find((observer) => test(observer.selector) && !observer.disconnect.mock.calls.length),
    restore
  }
}

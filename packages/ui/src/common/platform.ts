/**
 * 平台能力探测（ADR-022：uni 兼容层移除后的原生能力模型）。
 *
 * ## 与旧版的差别
 *
 * 旧版（ADR-005 / ADR-015）的能力全部来自 `uniAdapter` 注册表——也就是
 * 「宿主注入 uni.* 才算有能力」。移除 uni 兼容层后，能力分两类：
 *
 * | 能力 | 判定来源 |
 * |---|---|
 * | `intersectionObserver` | **引擎原生**：`lynx.createIntersectionObserver` 存在即为真（真机恒真） |
 * | `videoElement` | **引擎原生**：Lynx 4.1+ 内置 `<video>`（读 `SystemInfo.engineVersion`），宿主可显式覆盖 |
 * | `canvas2d` | **宿主原生模块**：宿主注册了 canvas 上下文与导出能力 |
 * | `pageScroll` | **宿主原生模块**：宿主注册了页面级滚动 |
 *
 * 引擎原生能力不再依赖宿主注入——这是「去掉小程序兼容层」带来的直接收益：
 * 粘性布局、交叉观察在真机上开箱即用。
 *
 * ## 单一事实来源
 *
 * `capabilities` 是**派生值**，不单独配置：引擎能力实时探测，宿主能力实时查询
 * 注册表。若另设一份「能力声明」，它与实现必然漂移。
 *
 * 唯一的例外是 `mockPlatform()`：它用于测试，显式强制能力为 false，
 * 以便覆盖降级分支（ADR-005 要求）。
 */
import { getHost } from './host'
import { getLynxRuntime } from './native'

/** 平台标识。`mock` 仅用于测试。 */
export type PlatformName = 'lynx' | 'web' | 'harmony' | 'mock'

export interface PlatformCapabilities {
  /** 引擎提供原生交叉观察器（`lynx.createIntersectionObserver`） */
  readonly intersectionObserver: boolean
  /** 引擎提供原生 `<video>` 元素（Lynx 4.1+；宿主未注册 XElement 时仍可能不可用） */
  readonly videoElement: boolean
  /** 宿主提供 Canvas 2D 上下文并能把画布导出为临时文件 */
  readonly canvas2d: boolean
  /** 宿主提供命令式页面滚动 */
  readonly pageScroll: boolean
}

export interface PlatformAdapter {
  readonly name: PlatformName
  readonly capabilities: PlatformCapabilities
}

// ---------------------------------------------------------------------------
// 状态
// ---------------------------------------------------------------------------
/** 显式指定的平台名（`configurePlatform` / `mockPlatform`） */
let nameOverride: PlatformName | null = null
/** 非 null 时能力判定完全走这份固定值（测试用） */
let forcedCapabilities: PlatformCapabilities | null = null

/**
 * 自动探测平台名。
 *
 * 这是**诊断信息**，不参与能力判定。默认回落到 `lynx`：本库的主运行时就是
 * Lynx，且在既无 `globalThis.lynx` 又无 `document` 的环境（裸 Node）里，
 * 把名字报成 `lynx` 比报成 `web` 更接近真实意图。
 */
function detectName(): PlatformName {
  if (nameOverride) return nameOverride
  const g = globalThis as any
  if (typeof g.lynx !== 'undefined') return 'lynx'
  if (typeof g.document !== 'undefined') return 'web'
  return 'lynx'
}

/** 原生 video 从 4.1 才加入，不能仅比较主版本号而放行 4.0。 */
function engineSupportsVideo(): boolean {
  const info = (globalThis as any).SystemInfo || {}
  const raw = String(info.engineVersion || info.lynxSdkVersion || '').trim()
  const version = /^(\d+)\.(\d+)(?:\.\d+)?(?:[-+][\w.-]+)?$/.exec(raw)
  if (!version) return false
  const major = Number(version[1])
  const minor = Number(version[2])
  return Number.isSafeInteger(major) && Number.isSafeInteger(minor) && (major > 4 || (major === 4 && minor >= 1))
}

function readCapability(key: keyof PlatformCapabilities): boolean {
  if (forcedCapabilities) return forcedCapabilities[key]
  switch (key) {
    case 'intersectionObserver':
      return typeof getLynxRuntime()?.createIntersectionObserver === 'function'
    case 'videoElement': {
      const host = getHost()
      // 宿主显式声明优先（可强制关掉未注册 XElement 的老引擎）。
      if (typeof host.supportsVideoElement === 'function') {
        try {
          return host.supportsVideoElement() === true
        } catch {
          return false
        }
      }
      return engineSupportsVideo()
    }
    case 'canvas2d': {
      const host = getHost()
      return typeof host.createCanvasContext === 'function' && typeof host.canvasToTempFilePath === 'function'
    }
    case 'pageScroll':
      return typeof getHost().pageScrollTo === 'function'
    default:
      return false
  }
}

/**
 * 能力对象。用 getter 而非快照：宿主可能在挂载后才注册能力，
 * 快照会读到过期值。
 */
const capabilities: PlatformCapabilities = {
  get intersectionObserver() {
    return readCapability('intersectionObserver')
  },
  get videoElement() {
    return readCapability('videoElement')
  },
  get canvas2d() {
    return readCapability('canvas2d')
  },
  get pageScroll() {
    return readCapability('pageScroll')
  }
}

/** 稳定实例：组件可在 setup 里取一次，后续读取仍是实时的。 */
const livePlatform: PlatformAdapter = {
  get name() {
    return detectName()
  },
  capabilities
}

// ---------------------------------------------------------------------------
// 公共 API
// ---------------------------------------------------------------------------

/**
 * 取当前平台适配器。
 *
 * 返回的**是同一个对象**，不要比较两次调用的引用（恒等），
 * 也不要在模块顶层把它解构成 `const { canvas2d } = getPlatform().capabilities`
 * ——那会变成快照，丢掉后续注册/探测的更新。
 */
export function getPlatform(): PlatformAdapter {
  return livePlatform
}

/**
 * 显式声明平台名（能力仍由实现派生）。
 *
 * Harmony 等宿主在启动时调用一次，使降级告警能报出真实平台名。
 */
export function configurePlatform(options: { name?: PlatformName }): void {
  if (options.name) nameOverride = options.name
}

/**
 * 强制能力为 `false`，用于覆盖降级分支。
 *
 * ```ts
 * const restore = mockPlatform()
 * // 此处所有 capabilities 为 false，且 name === 'mock'
 * restore()
 * ```
 *
 * @param overrides 需要**置为 true** 的能力（默认全 false）
 * @returns 恢复函数，务必在 `finally` / `afterEach` 里调用
 */
export function mockPlatform(overrides?: Partial<PlatformCapabilities>): () => void {
  const prevForced = forcedCapabilities
  const prevName = nameOverride
  forcedCapabilities = {
    intersectionObserver: false,
    videoElement: false,
    canvas2d: false,
    pageScroll: false,
    ...(overrides || {})
  }
  nameOverride = 'mock'
  return () => {
    forcedCapabilities = prevForced
    nameOverride = prevName
  }
}

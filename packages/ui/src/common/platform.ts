/**
 * 平台能力探测（ADR-005 落地 / ADR-015 范围收敛）。
 *
 * ## 解决什么问题
 *
 * `common/uniAdapter.ts` 是字符串键注册表：宿主可以注入 `pageScrollTo`、
 * `createCanvasContext` 等 API。但组件只能靠
 * `hasUniAdapter('createCanvasContext') || hasUniAdapter('canvasToTempFilePath')`
 * 这样的**组合判断**来推断「平台能不能画 canvas」。
 *
 * 后果是两个组件会对同一件事得出不同结论：`wd-signature` 认为 canvas2d 需要
 * 两个 API 齐全，将来某个组件只检查其中一个，就会出现「签名能导出、裁剪崩了」
 * 这类不一致。能力定义的改动面是 O(组件数)。
 *
 * 本模块把「能力」提为一等公民：能力的判定条件只写在这里一次，组件写
 * `platform.capabilities.canvas2d`。
 *
 * ## 范围：只抽象有 ≥2 个消费者的能力
 *
 * ADR-005 的推翻条件写着「抽象出的能力未被 2 个以上组件实际使用 → 应删除」。
 * 据此，当前只声明 4 个能力（括号内为实际消费者）：
 *
 * | 能力 | 消费者 |
 * |---|---|
 * | `canvas2d` | `wd-signature`、`wd-img-cropper` |
 * | `intersectionObserver` | `wd-sticky`、`wd-sticky-box` |
 * | `videoContext` | `wd-swiper`、`wd-video-preview` |
 * | `pageScroll` | `wd-backtop`、`wd-tour` |
 *
 * 单点能力（`getImageInfo` / `makePhoneCall` / `openType`）**不进 capabilities**，
 * 继续用 `hasUniAdapter(key)`。否则 capabilities 会退化成注册表的镜像，
 * 多一层间接却不多一点信息。
 *
 * ## 单一事实来源
 *
 * `capabilities` 是**派生值**，不单独配置：宿主注入 API 后能力自动为真。
 * 若另设一份「能力声明」让它与注册表并存，两者必然漂移——这正是本仓库
 * 反复出现的「文档/声明与实现不一致」问题，不能在代码里重演。
 *
 * 唯一的例外是 `mockPlatform()`：它用于测试，显式强制能力为 false，
 * 以便覆盖降级分支（ADR-005 要求）。
 */
import { hasUniAdapter } from './uniAdapter'

/** 平台标识。`mock` 仅用于测试。 */
export type PlatformName = 'lynx' | 'web' | 'harmony' | 'mock'

export interface PlatformCapabilities {
  /** 能创建 canvas 2d 上下文并把画布导出为临时文件 */
  readonly canvas2d: boolean
  /** 能创建交叉观察器（`createIntersectionObserver`） */
  readonly intersectionObserver: boolean
  /** 能创建视频上下文（`createVideoContext`） */
  readonly videoContext: boolean
  /** 能命令式滚动页面（`pageScrollTo`） */
  readonly pageScroll: boolean
}

export interface PlatformAdapter {
  readonly name: PlatformName
  readonly capabilities: PlatformCapabilities
}

/**
 * 能力 → 必需的宿主 API 集合（**全部具备**才算支持）。
 *
 * ⚠️ 这是能力定义的唯一来源。新增能力时先确认有 ≥2 个消费者，
 * 否则用 `hasUniAdapter` 就够了。
 */
const CAPABILITY_APIS: Record<keyof PlatformCapabilities, readonly string[]> = {
  canvas2d: ['createCanvasContext', 'canvasToTempFilePath'],
  intersectionObserver: ['createIntersectionObserver'],
  videoContext: ['createVideoContext'],
  pageScroll: ['pageScrollTo']
}

const ALL_FALSE: PlatformCapabilities = {
  canvas2d: false,
  intersectionObserver: false,
  videoContext: false,
  pageScroll: false
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
 * 这是**诊断信息**，不参与能力判定（能力只看注册表）。默认回落到 `lynx`：
 * 本库的主运行时就是 Lynx，且在既无 `globalThis.lynx` 又无 `document` 的
 * 环境（裸 Node）里，把名字报成 `lynx` 比报成 `web` 更接近真实意图。
 */
function detectName(): PlatformName {
  if (nameOverride) return nameOverride
  const g = globalThis as any
  if (typeof g.lynx !== 'undefined') return 'lynx'
  if (typeof g.document !== 'undefined') return 'web'
  return 'lynx'
}

function readCapability(key: keyof PlatformCapabilities): boolean {
  if (forcedCapabilities) return forcedCapabilities[key]
  return CAPABILITY_APIS[key].every((api) => hasUniAdapter(api))
}

/**
 * 能力对象。用 getter 而非快照：宿主可能在挂载后才注入 API
 * （`configureUniAdapter` 的既有契约），快照会读到过期值。
 */
const capabilities: PlatformCapabilities = {
  get canvas2d() {
    return readCapability('canvas2d')
  },
  get intersectionObserver() {
    return readCapability('intersectionObserver')
  },
  get videoContext() {
    return readCapability('videoContext')
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
 * ——那会变成快照，丢掉后续注入的更新。
 */
export function getPlatform(): PlatformAdapter {
  return livePlatform
}

/**
 * 显式声明平台名（能力仍由注册表派生）。
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
  forcedCapabilities = { ...ALL_FALSE, ...(overrides || {}) }
  nameOverride = 'mock'
  return () => {
    forcedCapabilities = prevForced
    nameOverride = prevName
  }
}

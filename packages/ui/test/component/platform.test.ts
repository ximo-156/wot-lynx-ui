/**
 * 平台能力探测（`common/platform.ts`，ADR-022）。
 *
 * 覆盖三件事：
 *
 * 1. **原生能力不依赖宿主注入**：`intersectionObserver` 直接来自
 *    `lynx.createIntersectionObserver`，`videoElement` 来自引擎版本
 *    （SystemInfo.engineVersion ≥ 4.1），宿主可覆盖实际元素支持情况。
 * 2. **mock 强制降级**：`mockPlatform()` 必须能**压过**已注册的宿主能力，
 *    而不是简单地「不注册」。
 * 3. **能力真的驱动了组件分支**：`wd-backtop` 的 `pageScroll` 门禁在 mock 下
 *    必须拦住宿主注册的 `pageScrollTo`。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { h } from 'vue-lynx'
import { render, cleanup } from '../render'
import { pause } from '@wot-lynx/core/common/util'
import { fireEvent } from '../fire-event'
import { configureHost } from '@wot-lynx/core/common/host'
import { restoreNativeStubs, setSystemInfo } from '../helpers/native-stubs'
import { getPlatform, configurePlatform, mockPlatform } from '@wot-lynx/core/common/platform'
import Backtop from '@wot-lynx/ui-display/wd-backtop'
import Signature from '@wot-lynx/ui-form/wd-signature'

/** 本模块关心的宿主能力键；测试之间必须清干净，否则相互污染 */
const HOST_KEYS = ['createCanvasContext', 'canvasToTempFilePath', 'pageScrollTo', 'supportsVideoElement'] as const

function resetHost(): void {
  // configureHost 的契约：传 undefined 即撤回该能力
  configureHost(Object.fromEntries(HOST_KEYS.map((key) => [key, undefined])))
}

/** 注入一份「宿主能力齐全」的宿主 */
function installFullHost(): void {
  configureHost({
    createCanvasContext: () => ({}),
    canvasToTempFilePath: () => ({}),
    pageScrollTo: () => ({}),
    supportsVideoElement: () => true
  })
}

/** 引擎原生交叉观察器：测试环境没有该实现，按真机能力补齐。 */
function installNativeObserver(): () => void {
  const lynx = (globalThis as any).lynx
  const original = lynx.createIntersectionObserver
  lynx.createIntersectionObserver = () => ({ disconnect() {} })
  return () => { lynx.createIntersectionObserver = original }
}

/** 用原地修改的原生桩覆盖版本，避免线程切换丢失覆盖。 */
function installEngineVersion(version: string): () => void {
  return setSystemInfo({ engineVersion: version })
}

beforeEach(() => {
  resetHost()
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  restoreNativeStubs()
  resetHost()
})

describe('平台能力探测', () => {
  it('未注册宿主能力时：canvas2d / pageScroll 为 false，原生能力由引擎决定', () => {
    const restoreVersion = installEngineVersion('3.9.0')
    const { capabilities } = getPlatform()
    expect(capabilities.canvas2d).toBe(false)
    expect(capabilities.pageScroll).toBe(false)
    expect(capabilities.videoElement, 'Lynx 3.x 没有内置 video 元素').toBe(false)
    restoreVersion()
  })

  it('原生交叉观察器存在即为真，不需要宿主注册任何东西', () => {
    const restoreObserver = installNativeObserver()
    expect(getPlatform().capabilities.intersectionObserver, 'lynx.createIntersectionObserver 是引擎原生能力').toBe(true)
    restoreObserver()
  })

  it.each([
    ['3.9.0', false], ['4', false], ['4.0', false], ['4.0.99', false],
    ['4.1', true], ['4.1.0', true], ['4.2.0', true], ['4.10.0', true], ['5.0.0', true],
    ['', false], ['unknown', false], ['4.invalid', false], ['4.1garbage', false]
  ])('videoElement 的 4.1 版本边界：%s → %s', (version, supported) => {
    installEngineVersion(version as string)
    expect(getPlatform().capabilities.videoElement).toBe(supported)
  })

  it('版本缺失时可读 lynxSdkVersion，但不以较新的备用字段绕过实际 4.0 引擎', () => {
    setSystemInfo({ engineVersion: '', lynxSdkVersion: '4.1.0' })
    expect(getPlatform().capabilities.videoElement).toBe(true)
    setSystemInfo({ engineVersion: '4.0.0' })
    expect(getPlatform().capabilities.videoElement).toBe(false)
  })

  it('宿主可按真实注册情况覆盖版本，迟注册与撤销不缓存', () => {
    installEngineVersion('4.0.0')
    const { capabilities } = getPlatform()
    expect(capabilities.videoElement).toBe(false)
    configureHost({ supportsVideoElement: () => true })
    expect(capabilities.videoElement).toBe(true)
    configureHost({})
    expect(capabilities.videoElement).toBe(false)
    installEngineVersion('4.2.0')
    expect(capabilities.videoElement).toBe(true)
    configureHost({ supportsVideoElement: () => false })
    expect(capabilities.videoElement).toBe(false)
    configureHost({ supportsVideoElement: () => { throw new Error('element registry unavailable') } })
    expect(capabilities.videoElement).toBe(false)
  })

  it('canvas2d 要求两个宿主 API 同时存在（缺一即为 false）', () => {
    configureHost({ createCanvasContext: () => ({}) })
    expect(getPlatform().capabilities.canvas2d, '仅 createCanvasContext 不足以导出画布').toBe(false)

    // configureHost 是整体替换：必须同时注册两个 API
    configureHost({ createCanvasContext: () => ({}), canvasToTempFilePath: () => ({}) })
    expect(getPlatform().capabilities.canvas2d).toBe(true)
  })

  it('getPlatform 返回稳定实例，且能力是实时读取（宿主可后注册）', () => {
    const first = getPlatform()
    expect(getPlatform(), '同一对象，不要依赖两次调用返回新实例').toBe(first)
    expect(first.capabilities.pageScroll).toBe(false)

    configureHost({ pageScrollTo: () => ({}) })
    expect(first.capabilities.pageScroll, '能力不能是 setup 时快照，否则后注册的宿主能力读不到').toBe(true)
  })

  it('mockPlatform 强制能力为 false，压过已注册的宿主能力', () => {
    installFullHost()
    expect(getPlatform().capabilities.canvas2d).toBe(true)

    const restore = mockPlatform()
    expect(getPlatform().name).toBe('mock')
    expect(getPlatform().capabilities.canvas2d).toBe(false)
    expect(getPlatform().capabilities.pageScroll).toBe(false)
    expect(getPlatform().capabilities.intersectionObserver).toBe(false)
    expect(getPlatform().capabilities.videoElement).toBe(false)

    restore()
    expect(getPlatform().capabilities.canvas2d, 'restore 后回到派生值').toBe(true)
    expect(getPlatform().name).not.toBe('mock')
  })

  it('mockPlatform 可按能力放行，用于只验证单条降级分支', () => {
    installFullHost()
    const restore = mockPlatform({ pageScroll: true })
    expect(getPlatform().capabilities.pageScroll).toBe(true)
    expect(getPlatform().capabilities.canvas2d, '未放行的能力仍为 false').toBe(false)
    restore()
  })

  it('configurePlatform 只改平台名，不参与能力判定', () => {
    configurePlatform({ name: 'harmony' })
    expect(getPlatform().name).toBe('harmony')
    expect(getPlatform().capabilities.canvas2d, '名字不应影响能力').toBe(false)

    configurePlatform({ name: 'lynx' })
    expect(getPlatform().name).toBe('lynx')
  })
})

describe('能力门禁真的驱动组件分支', () => {
  /** wd-backtop 在 scrollTop 超过阈值后才可点击 */
  async function mountBacktop(onTap: () => void) {
    const { container } = render({
      setup: () => () => h(Backtop as any, { scrollTop: 200, top: 60, onTap })
    } as any)
    await pause(30)
    return container
  }

  it('pageScroll 可用时，点击回到顶部会调用宿主 pageScrollTo', async () => {
    const scrollTo = vi.fn()
    configureHost({ pageScrollTo: scrollTo })

    let tapped = 0
    const container = await mountBacktop(() => tapped++)

    fireEvent.tap(container.querySelector('.wd-backtop')!)
    await pause(10)

    expect(tapped, '点击事件照常抛出').toBe(1)
    expect(scrollTo, '能力可用时必须走原生滚动').toHaveBeenCalledTimes(1)
  })

  it('mockPlatform 关闭 pageScroll 后，即使宿主已注册也不调用', async () => {
    const scrollTo = vi.fn()
    configureHost({ pageScrollTo: scrollTo })
    const restore = mockPlatform()

    let tapped = 0
    const container = await mountBacktop(() => tapped++)

    fireEvent.tap(container.querySelector('.wd-backtop')!)
    await pause(10)

    expect(tapped, '降级时仍抛事件，由消费方自行滚动').toBe(1)
    expect(scrollTo, 'mock 必须压过宿主注册').not.toHaveBeenCalled()

    restore()
  })

  it('canvas2d 关闭时 wd-signature 导出 SVG data URI，不伪造 PNG 路径', async () => {
    interface ConfirmPayload {
      tempFilePath?: string
      success?: boolean
    }
    const payloads: ConfirmPayload[] = []
    const { container } = render(Signature, {
      onConfirm: (payload: ConfirmPayload) => payloads.push(payload)
    } as any)
    await pause(30)

    // 确认按钮是最后一个 .wd-signature__button
    const buttons = [...container.querySelectorAll('.wd-signature__button')]
    expect(buttons.length, '签名组件应有取消 + 确认两个按钮').toBeGreaterThan(0)
    fireEvent.tap(buttons.at(-1)!)
    await pause(20)

    expect(payloads, '必须 emit confirm（降级不是静默失败）').toHaveLength(1)
    expect(String(payloads[0].tempFilePath), '无 canvas 能力时导出真实 SVG URI').toMatch(/^data:image\/svg\+xml/)
    expect(payloads[0].success).toBe(true)
  })
})

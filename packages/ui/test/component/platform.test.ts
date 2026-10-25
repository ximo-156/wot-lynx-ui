/**
 * 平台能力探测（`common/platform.ts`，ADR-005 / ADR-015）。
 *
 * 覆盖三件事：
 *
 * 1. **单一事实来源**：`capabilities` 是注册表的派生值，不另设一份声明。
 *    `canvas2d` 要求 `createCanvasContext` 与 `canvasToTempFilePath` **同时**存在
 *    —— 这个定义只写在 `CAPABILITY_APIS` 一处，组件不得自行组合字符串键。
 * 2. **mock 强制降级**：ADR-005 的原始诉求是「测试降级路径时无法注入全能力关闭的
 *    mock → 降级分支无覆盖」。因此 mock 必须能**压过已注入的宿主能力**，
 *    而不是简单地「不注入」。
 * 3. **能力真的驱动了组件分支**：`wd-backtop` 的 `pageScroll` 门禁在 mock 下
 *    必须拦住宿主注入的 `pageScrollTo`。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { h } from 'vue-lynx'
import { render, cleanup } from '../render'
import { pause } from '../../src/common/util'
import { fireEvent } from '../fire-event'
import { configureUniAdapter } from '../../src/common/uni'
import { getPlatform, configurePlatform, mockPlatform } from '../../src/common/platform'
import Backtop from '../../src/components/wd-backtop/wd-backtop.vue'
import Signature from '../../src/components/wd-signature/wd-signature.vue'

/** 本模块关心的注册表键；测试之间必须清干净，否则相互污染 */
const ADAPTER_KEYS = [
  'createCanvasContext',
  'canvasToTempFilePath',
  'createIntersectionObserver',
  'createVideoContext',
  'pageScrollTo'
] as const

function resetAdapters(): void {
  // configureUniAdapter 的既有契约：传 undefined 即撤回该能力
  configureUniAdapter(Object.fromEntries(ADAPTER_KEYS.map((key) => [key, undefined])))
}

/** 注入一份「能力齐全」的宿主 */
function installFullHost(): void {
  configureUniAdapter({
    createCanvasContext: () => ({}),
    canvasToTempFilePath: () => ({}),
    createIntersectionObserver: () => ({}),
    createVideoContext: () => ({}),
    pageScrollTo: () => ({})
  })
}

afterEach(() => {
  cleanup()
  resetAdapters()
})

describe('平台能力探测', () => {
  it('未注入任何宿主能力时，四项能力全为 false', () => {
    const { capabilities } = getPlatform()
    expect(capabilities.canvas2d).toBe(false)
    expect(capabilities.intersectionObserver).toBe(false)
    expect(capabilities.videoContext).toBe(false)
    expect(capabilities.pageScroll).toBe(false)
  })

  it('能力由注册表派生：注入齐全后全为 true', () => {
    installFullHost()
    const { capabilities } = getPlatform()
    expect(capabilities.canvas2d).toBe(true)
    expect(capabilities.intersectionObserver).toBe(true)
    expect(capabilities.videoContext).toBe(true)
    expect(capabilities.pageScroll).toBe(true)
  })

  it('canvas2d 要求两个 API 同时存在（缺一即为 false）', () => {
    // 只注入一半：这正是「两个组件各自组合字符串键」会踩的分歧点
    configureUniAdapter({ createCanvasContext: () => ({}) })
    expect(getPlatform().capabilities.canvas2d, '仅 createCanvasContext 不足以导出画布').toBe(false)

    configureUniAdapter({ canvasToTempFilePath: () => ({}) })
    expect(getPlatform().capabilities.canvas2d).toBe(true)
  })

  it('getPlatform 返回稳定实例，且能力是实时读取（宿主可后注入）', () => {
    const first = getPlatform()
    expect(getPlatform(), '同一对象，不要依赖两次调用返回新实例').toBe(first)
    expect(first.capabilities.pageScroll).toBe(false)

    configureUniAdapter({ pageScrollTo: () => ({}) })
    expect(first.capabilities.pageScroll, '能力不能是 setup 时快照，否则后注入的宿主能力读不到').toBe(true)
  })

  it('mockPlatform 强制能力为 false，压过已注入的宿主能力', () => {
    installFullHost()
    expect(getPlatform().capabilities.canvas2d).toBe(true)

    const restore = mockPlatform()
    expect(getPlatform().name).toBe('mock')
    expect(getPlatform().capabilities.canvas2d).toBe(false)
    expect(getPlatform().capabilities.pageScroll).toBe(false)

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
    configureUniAdapter({ pageScrollTo: scrollTo })

    let tapped = 0
    const container = await mountBacktop(() => tapped++)

    fireEvent.tap(container.querySelector('.wd-backtop')!)
    await pause(10)

    expect(tapped, '点击事件照常抛出').toBe(1)
    expect(scrollTo, '能力可用时必须走原生滚动').toHaveBeenCalledTimes(1)
  })

  it('mockPlatform 关闭 pageScroll 后，即使宿主已注入也不调用', async () => {
    const scrollTo = vi.fn()
    configureUniAdapter({ pageScrollTo: scrollTo })
    const restore = mockPlatform()

    let tapped = 0
    const container = await mountBacktop(() => tapped++)

    fireEvent.tap(container.querySelector('.wd-backtop')!)
    await pause(10)

    expect(tapped, '降级时仍抛事件，由消费方自行滚动').toBe(1)
    expect(scrollTo, 'mock 必须压过宿主注入').not.toHaveBeenCalled()

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

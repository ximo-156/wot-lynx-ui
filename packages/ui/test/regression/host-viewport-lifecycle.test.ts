/** Host replacement must update live safe areas and retire old native resize callbacks. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue-lynx'
import { cleanup, render } from '../render'
import { restoreNativeStubs, setSystemInfo } from '../helpers/native-stubs'
import { configureHost, getHost, subscribeHostChange, type WotLynxHost } from '@wot-lynx/core/common/host'
import { getViewportOverride, setViewportOverride } from '@wot-lynx/core/common/viewport-state'
import { useSafeArea } from '@wot-lynx/core/composables/useSafeArea'

type ResizeListener = (event: unknown) => void
let restores: Array<() => void>
async function flush() { for (let i = 0; i < 6; i++) await nextTick() }
function device(platform = 'ios') {
  setSystemInfo({
    platform, windowWidth: 390, windowHeight: 844, screenWidth: 390, screenHeight: 844,
    windowTop: 0, windowLeft: 0, statusBarHeight: 0, safeArea: undefined, safeAreaInsets: undefined
  })
}
function makeHost(name: string, bottom = 34, order: string[] = []) {
  return {
    name,
    insets: { top: 20, right: 0, bottom, left: 0 },
    listeners: new Set<ResizeListener>(),
    captured: [] as ResizeListener[],
    getSafeAreaInsets() { return this.insets },
    onWindowResize: vi.fn(function (this: any, callback: ResizeListener) {
      // These methods intentionally depend on their receiver, just like a native module.
      order.push(`${this.name}:on`)
      this.listeners.add(callback)
      this.captured.push(callback)
    }),
    offWindowResize: vi.fn(function (this: any, callback: ResizeListener) {
      order.push(`${this.name}:off`)
      this.listeners.delete(callback)
    })
  }
}
function emitResize(host: ReturnType<typeof makeHost>, width = 390, height = 844) {
  for (const callback of [...host.listeners]) callback({ size: { width, height } })
}
function mountProbe(duringSetup?: () => void) {
  let area!: ReturnType<typeof useSafeArea>
  const result = render({
    setup() {
      area = useSafeArea()
      duringSetup?.()
      return () => h('view', null, [h('view', {
        class: 'host-viewport-probe',
        style: { width: `${area.width.value}px`, height: `${area.height.value}px`, 'padding-bottom': area.inset('bottom') }
      })])
    }
  } as any)
  const element = result.container.querySelector('.host-viewport-probe') as HTMLElement
  expect(element).not.toBeNull()
  return { ...result, area, element }
}
function snapshot(area: ReturnType<typeof useSafeArea>) {
  return { width: area.width.value, height: area.height.value, revision: area.revision.value, bottom: area.inset('bottom') }
}
function nativeModules(modules: Record<string, unknown>) {
  const global = globalThis as any
  const realms = [global, global.lynxTestingEnv.backgroundThread.globalThis, global.lynxTestingEnv.mainThread.globalThis]
  for (const realm of realms) {
    const owned = Object.prototype.hasOwnProperty.call(realm, 'NativeModules')
    const previous = realm.NativeModules
    realm.NativeModules = modules
    restores.push(() => {
      if (owned) realm.NativeModules = previous
      else delete realm.NativeModules
    })
  }
}

beforeEach(() => {
  restores = []
  setViewportOverride(null)
  device()
})
afterEach(() => {
  cleanup()
  for (const restore of restores.reverse()) restore()
  configureHost(null)
  setViewportOverride(null)
  vi.restoreAllMocks()
  restoreNativeStubs()
})

describe('host registration and live viewport lifecycle', () => {
  it('notifies only on injected host instance changes and supports explicit unsubscription', () => {
    const first = makeHost('first'), second = makeHost('second')
    const seen: WotLynxHost[] = []
    const stop = subscribeHostChange(() => { seen.push(getHost()) })
    restores.push(stop)
    configureHost(first)
    configureHost(first)
    configureHost(second)
    configureHost(null)
    configureHost(null)
    expect(seen).toHaveLength(3)
    expect(seen[0]).toBe(first)
    expect(seen[1]).toBe(second)
    expect(seen[2]).not.toBe(second)
    stop()
    configureHost(first)
    expect(seen).toHaveLength(3)
  })

  it.each(['ios', 'android'])('%s subscribes after mounted configureHost and refreshes same-size zero/nonzero insets', async (platform) => {
    device(platform)
    const { area, element, unmount } = mountProbe()
    await flush()
    expect(area.insets.value.known.bottom).toBe(false)
    const host = makeHost(platform, platform === 'ios' ? 34 : 24)
    const before = area.revision.value
    configureHost(host)
    await flush()
    expect(host.listeners.size).toBe(1)
    expect(area.revision.value).toBeGreaterThan(before)
    expect(element.style.paddingBottom).toBe(`${host.insets.bottom}px`)
    for (const bottom of [0, 18, 0, 24]) {
      const revision = area.revision.value
      host.insets.bottom = bottom
      emitResize(host)
      await flush()
      expect(area.revision.value).toBeGreaterThan(revision)
      expect(element.style.paddingBottom).toBe(`${bottom}px`)
      expect(area.width.value).toBe(390)
      expect(area.height.value).toBe(844)
    }
    emitResize(host, 844, 390)
    await flush()
    expect(element.style.width).toBe('844px')
    expect(element.style.height).toBe('390px')
    expect(host.onWindowResize).toHaveBeenCalledTimes(1)
    unmount()
    expect(host.listeners.size).toBe(0)
    expect(host.offWindowResize).toHaveBeenCalledExactlyOnceWith(host.captured[0])
  })

  it('observes configureHost during setup without duplicate binding at mounted', async () => {
    const host = makeHost('setup')
    const { element } = mountProbe(() => configureHost(host))
    await flush()
    expect(host.onWindowResize).toHaveBeenCalledTimes(1)
    expect(host.listeners.size).toBe(1)
    expect(element.style.paddingBottom).toBe('34px')
  })

  it('unbinds before replacing, preserves receivers, and rejects old callbacks after withdrawal/reusing an instance', async () => {
    const order: string[] = []
    const first = makeHost('first', 34, order), second = makeHost('second', 24, order)
    configureHost(first)
    const { area, element } = mountProbe()
    await flush()
    const oldFirst = first.captured[0]
    first.offWindowResize.mockImplementation(function (this: any, callback: ResizeListener) {
      order.push(`${this.name}:off`)
      this.listeners.delete(callback)
      callback({ width: 1500, height: 1000 }) // An in-flight callback during unsubscription.
    })
    configureHost(second)
    await flush()
    expect(order).toEqual(['first:on', 'first:off', 'second:on'])
    expect(first.listeners.size).toBe(0)
    expect(second.listeners.size).toBe(1)
    expect(element.style.paddingBottom).toBe('24px')
    expect(area.width.value).toBe(390)
    const current = snapshot(area)
    oldFirst({ width: 1400, height: 900 })
    await flush()
    expect(snapshot(area)).toEqual(current)
    const oldSecond = second.captured[0]
    configureHost(null)
    await flush()
    expect(second.listeners.size).toBe(0)
    expect(area.insets.value.known.bottom).toBe(false)
    const withdrawn = snapshot(area)
    oldSecond({ width: 1300, height: 800 })
    oldFirst({ width: 1200, height: 700 })
    await flush()
    expect(snapshot(area)).toEqual(withdrawn)
    configureHost(first)
    await flush()
    expect(first.listeners.size).toBe(1)
    expect(first.captured[1]).not.toBe(oldFirst)
    const reused = snapshot(area)
    oldFirst({ width: 1100, height: 600 })
    await flush()
    expect(snapshot(area)).toEqual(reused)
    emitResize(first, 360, 780)
    await flush()
    expect(area.width.value).toBe(360)
    expect(area.height.value).toBe(780)
  })

  it('rejects queued callbacks for every viewport before sequential replacement notifications finish', async () => {
    const first = makeHost('first'), second = makeHost('second', 24)
    configureHost(first)
    const areas: Array<ReturnType<typeof useSafeArea>> = []
    render({ setup() {
      areas.push(useSafeArea(), useSafeArea())
      return () => h('view')
    } } as any)
    await flush()
    expect(first.listeners.size).toBe(2)
    first.offWindowResize.mockImplementation(function (this: any, callback: ResizeListener) {
      this.listeners.delete(callback)
      // configureHost notifies subscribers sequentially; the other viewport may
      // still hold its old record when this first off method drains its queue.
      for (const queued of this.captured) queued({ width: 1500, height: 1000 })
    })
    configureHost(second)
    await flush()
    expect(first.listeners.size).toBe(0)
    expect(second.listeners.size).toBe(2)
    expect(getViewportOverride()).toBeNull()
    for (const area of areas) {
      expect(area.width.value).toBe(390)
      expect(area.height.value).toBe(844)
      expect(area.inset('bottom')).toBe('24px')
    }
    emitResize(second, 360, 720)
    await flush()
    for (const area of areas) expect([area.width.value, area.height.value]).toEqual([360, 720])
    cleanup()
    expect(second.listeners.size).toBe(0)
  })

  it('refresh reconciles changed on/off method identities on the same host using the captured old off method', async () => {
    const host = makeHost('stable')
    configureHost(host)
    const { area } = mountProbe()
    await flush()
    const originalOff = host.offWindowResize
    const retired = host.captured[0]
    host.onWindowResize = vi.fn(function (this: any, callback: ResizeListener) {
      this.listeners.add(callback)
      this.captured.push(callback)
    })
    const nextOff = vi.fn(function (this: any, callback: ResizeListener) { this.listeners.delete(callback) })
    host.offWindowResize = nextOff
    configureHost(host) // Same instance is intentionally not a host-change notification.
    expect(host.onWindowResize).not.toHaveBeenCalled()
    area.refresh()
    await flush()
    expect(originalOff).toHaveBeenCalledExactlyOnceWith(retired)
    expect(nextOff).not.toHaveBeenCalled()
    expect(host.onWindowResize).toHaveBeenCalledTimes(1)
    expect(host.listeners.size).toBe(1)
    const firstReplacement = snapshot(area)
    retired({ width: 999, height: 888 })
    await flush()
    expect(snapshot(area)).toEqual(firstReplacement)
    const replacementListener = host.captured[1]
    const latestOff = vi.fn(function (this: any, callback: ResizeListener) { this.listeners.delete(callback) })
    host.offWindowResize = latestOff // Even an off-only change must retire the old pair.
    area.refresh()
    await flush()
    expect(nextOff).toHaveBeenCalledExactlyOnceWith(replacementListener)
    expect(host.onWindowResize).toHaveBeenCalledTimes(2)
    expect(host.listeners.size).toBe(1)
    cleanup()
    expect(latestOff).toHaveBeenCalledExactlyOnceWith(host.captured[2])
  })

  it('records the subscription before a synchronous initial resize and does not recurse or duplicate listeners', async () => {
    const host = makeHost('sync')
    host.onWindowResize.mockImplementation(function (this: any, callback: ResizeListener) {
      this.listeners.add(callback)
      this.captured.push(callback)
      callback({ width: 844, height: 390 })
    })
    configureHost(host)
    const { area, element } = mountProbe()
    await flush()
    expect(host.onWindowResize).toHaveBeenCalledTimes(1)
    expect(host.listeners.size).toBe(1)
    expect(element.style.width).toBe('844px')
    expect(element.style.height).toBe('390px')
    for (let i = 0; i < 5; i++) area.refresh()
    await flush()
    expect(host.onWindowResize).toHaveBeenCalledTimes(1)
    expect(host.offWindowResize).not.toHaveBeenCalled()
  })

  it('reconciles reentrant configureHost from on/off methods without installing an obsolete source', async () => {
    const order: string[] = []
    const first = makeHost('first', 34, order), second = makeHost('second', 24, order)
    const skipped = makeHost('skipped', 16, order), latest = makeHost('latest', 12, order)
    first.onWindowResize.mockImplementation(function (this: any, callback: ResizeListener) {
      order.push(`${this.name}:on`)
      this.listeners.add(callback)
      this.captured.push(callback)
      configureHost(second)
      callback({ width: 1400, height: 1000 })
    })
    configureHost(first)
    const { area, element } = mountProbe()
    await flush()
    expect(order).toEqual(['first:on', 'first:off', 'second:on'])
    expect(first.listeners.size).toBe(0)
    expect(second.listeners.size).toBe(1)
    expect(element.style.paddingBottom).toBe('24px')
    expect(area.width.value).toBe(390)
    second.offWindowResize.mockImplementation(function (this: any, callback: ResizeListener) {
      order.push(`${this.name}:off`)
      this.listeners.delete(callback)
      configureHost(latest)
      callback({ width: 1300, height: 900 })
    })
    configureHost(skipped)
    await flush()
    expect(skipped.onWindowResize).not.toHaveBeenCalled()
    expect(latest.onWindowResize).toHaveBeenCalledTimes(1)
    expect(order.slice(-2)).toEqual(['second:off', 'latest:on'])
    expect(element.style.paddingBottom).toBe('12px')
    expect(area.width.value).toBe(390)
  })

  it('disposed refresh and retained callbacks cannot mutate local or shared viewport, even without an off method', async () => {
    const host = makeHost('unremovable')
    const originalOff = host.offWindowResize
    delete (host as Partial<WotLynxHost>).offWindowResize
    configureHost(host)
    const { area, unmount } = mountProbe()
    await flush()
    const callback = host.captured[0]
    unmount()
    const frozen = snapshot(area)
    const next = makeHost('after-unmount')
    configureHost(next)
    setViewportOverride({ width: 360, height: 720 })
    area.refresh()
    callback({ width: 1200, height: 1000 })
    await flush()
    expect(snapshot(area)).toEqual(frozen)
    expect(getViewportOverride()).toEqual({ width: 360, height: 720 })
    expect(next.onWindowResize).not.toHaveBeenCalled()
    expect(originalOff).not.toHaveBeenCalled()
  })

  it.each([false, true])('refresh and withdrawal find the native host without duplicate facade subscriptions (media=%s)', async (withMedia) => {
    const first = makeHost('native-first'), second = makeHost('native-second', 24)
    first.onWindowResize.mockImplementation(function (this: any, callback: ResizeListener) {
      this.listeners.add(callback)
      this.captured.push(callback)
      callback({ width: 390, height: 844 })
    })
    const media = { chooseMedia: vi.fn() }
    const modules: Record<string, unknown> = { WotLynxUI: first, ...(withMedia ? { WotMediaPicker: media } : {}) }
    nativeModules(modules)
    const { area, element } = mountProbe()
    await flush()
    for (let i = 0; i < 5; i++) area.refresh()
    await flush()
    expect(first.onWindowResize).toHaveBeenCalledTimes(1)
    expect(first.listeners.size).toBe(1)
    if (withMedia) {
      const facade = getHost()
      const replacementMedia = { chooseMedia: vi.fn() }
      modules.WotMediaPicker = replacementMedia
      expect(getHost()).toBe(facade)
      getHost().chooseMedia?.({})
      expect(media.chooseMedia).not.toHaveBeenCalled()
      expect(replacementMedia.chooseMedia).toHaveBeenCalledTimes(1)
    }
    const old = first.captured[0]
    modules.WotLynxUI = second // Native module replacement has no configureHost signal.
    area.refresh() // Reopening / explicit refresh must discover it.
    await flush()
    expect(first.listeners.size).toBe(0)
    expect(second.listeners.size).toBe(1)
    expect(element.style.paddingBottom).toBe('24px')
    const latest = snapshot(area)
    old({ width: 1500, height: 1000 })
    await flush()
    expect(snapshot(area)).toEqual(latest)
    const injected = makeHost('injected', 8)
    configureHost(injected)
    await flush()
    expect(second.listeners.size).toBe(0)
    expect(element.style.paddingBottom).toBe('8px')
    configureHost(null)
    await flush()
    expect(injected.listeners.size).toBe(0)
    expect(second.listeners.size).toBe(1)
    expect(element.style.paddingBottom).toBe('24px')
  })
})

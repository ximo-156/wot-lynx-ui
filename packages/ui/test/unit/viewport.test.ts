import { afterEach, describe, expect, it } from 'vitest'
import { configureUniAdapter } from '../../src/common/uniAdapter'
import { getSystemInfo } from '../../src/common/util'
import { getViewportSize, getViewportOverride, hasViewportOverride, isDesktopViewport, isWideViewport, setViewportOverride, VIEWPORT_BREAKPOINTS } from '../../src/common/viewport'
import { subscribeViewportChange } from '../../src/common/viewport-state'

const g = globalThis as any
const originals = new Map(['window', 'SystemInfo', 'lynx'].map(key => [key, Object.getOwnPropertyDescriptor(g, key)]))
const oldOverride = getViewportOverride()
afterEach(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(g, key, descriptor)
    else delete g[key]
  }
  configureUniAdapter({ getSystemInfoSync: undefined })
  setViewportOverride(oldOverride)
})

describe('application viewport source', () => {
  it('uses native logical pixels even if a native host exposes window', () => {
    g.SystemInfo = { platform: 'iOS', pixelRatio: 3, pixelWidth: 1170, pixelHeight: 2532 }
    g.window = { innerWidth: 1600, innerHeight: 1200 }
    expect(getViewportSize()).toEqual({ width: 390, height: 844 })
  })

  it('uses browser window, not display width, for a DOM Web runtime', () => {
    g.SystemInfo = { platform: 'web', pixelRatio: 2, pixelWidth: 3840, pixelHeight: 2160 }
    g.window = { innerWidth: 800, innerHeight: 600 }
    expect(getViewportSize()).toEqual({ width: 800, height: 600 })
    expect(getSystemInfo().screenWidth).toBe(1920)
  })

  it('prefers explicitly declared host dimensions, independently per axis', () => {
    g.SystemInfo = { platform: 'web', windowWidth: 375, pixelRatio: 2, pixelWidth: 750 }
    g.window = { innerWidth: 1600, innerHeight: 720 }
    expect(getViewportSize()).toEqual({ width: 375, height: 720 })
  })

  it('supports a Web Worker with no window and a frozen SystemInfo', () => {
    delete g.window
    g.SystemInfo = Object.freeze({ platform: 'web', pixelRatio: 2, pixelWidth: 3840, pixelHeight: 2160 })
    setViewportOverride({ width: 1024, height: 768 })
    expect(getViewportSize()).toEqual({ width: 1024, height: 768 })
    expect(getSystemInfo().windowWidth).toBe(1024)
    expect(getSystemInfo().screenWidth).toBe(1920)
    expect(Object.isFrozen(g.SystemInfo)).toBe(true)
  })

  it('calls a host adapter once per read and honors its size', () => {
    let calls = 0
    configureUniAdapter({ getSystemInfoSync: () => { calls++; return { windowWidth: 680, windowHeight: 500 } } })
    expect(getViewportSize()).toEqual({ width: 680, height: 500 })
    expect(calls).toBe(1)
  })

  it('copies overrides and notifies only actual changes', () => {
    setViewportOverride(null)
    let calls = 0
    const stop = subscribeViewportChange(() => calls++)
    const size = { width: 1280, height: 720 }
    try {
      setViewportOverride(size)
      size.width = 1
      expect(getViewportOverride()).toEqual({ width: 1280, height: 720 })
      setViewportOverride({ width: 1280, height: 720 })
      expect(calls).toBe(1)
      setViewportOverride(null)
      expect(hasViewportOverride()).toBe(false)
      expect(calls).toBe(2)
    } finally { stop() }
    setViewportOverride({ width: 375, height: 812 })
    expect(calls).toBe(2)
  })

  it.each([
    { width: 0, height: 720 }, { width: 1280, height: 0 },
    { width: Infinity, height: 720 }, { width: 1280, height: NaN },
    { width: -1, height: 720 }
  ])('rejects invalid viewport %j', size => {
    setViewportOverride(size)
    expect(hasViewportOverride()).toBe(false)
  })
})

describe('responsive breakpoints', () => {
  it('includes endpoints and rejects non-finite widths', () => {
    expect(VIEWPORT_BREAKPOINTS).toEqual({ wide: 768, desktop: 1024 })
    expect(isWideViewport(767)).toBe(false)
    expect(isWideViewport(768)).toBe(true)
    expect(isDesktopViewport(1023)).toBe(false)
    expect(isDesktopViewport(1024)).toBe(true)
    expect(isWideViewport(Infinity)).toBe(false)
    expect(isDesktopViewport(NaN)).toBe(false)
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { getSystemInfo } from '@wot-lynx/core/common/util'
import { resolveSafeAreaInsets } from '@wot-lynx/core/common/safe-area'
import { getViewportSize, getViewportOverride, hasViewportOverride, isDesktopViewport, isWideViewport, setViewportOverride, VIEWPORT_BREAKPOINTS } from '@wot-lynx/core/common/viewport'
import { subscribeViewportChange } from '@wot-lynx/core/common/viewport-state'

const g = globalThis as any
const originals = new Map(['window', 'SystemInfo', 'lynx'].map(key => [key, Object.getOwnPropertyDescriptor(g, key)]))
const oldOverride = getViewportOverride()
afterEach(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(g, key, descriptor)
    else delete g[key]
  }
  setViewportOverride(oldOverride)
})

describe('application viewport source', () => {
  it('does not mistake a normalized zero for a reported window origin', () => {
    g.SystemInfo = { platform: 'iOS', pixelRatio: 3, pixelWidth: 1170, pixelHeight: 2532,
      safeArea: { top: 59, bottom: 810, left: 0, right: 390 }, statusBarHeight: 59 }
    setViewportOverride({ width: 390, height: 785 })
    const unknownOrigin = getSystemInfo()
    expect(unknownOrigin.windowTop).toBe(0)
    expect(unknownOrigin.windowTopKnown).toBe(false)
    expect(unknownOrigin.windowLeftKnown).toBe(false)
    expect(resolveSafeAreaInsets(unknownOrigin)).toMatchObject({
      top: 0, bottom: 0, known: { top: false, bottom: false, left: false, right: false }
    })
    // The same 785px view starts below the 59px status/notch region, not at screen 0.
    g.SystemInfo.windowTop = 59
    g.SystemInfo.windowLeft = 0
    expect(resolveSafeAreaInsets(getSystemInfo())).toMatchObject({
      top: 0, bottom: 34, known: { top: true, bottom: true, left: true, right: true }
    })
    // A viewport-relative inset needs no screen origin and its explicit 0 remains authoritative.
    delete g.SystemInfo.windowTop
    g.SystemInfo.safeAreaInsets = { top: 0, bottom: 0 }
    expect(resolveSafeAreaInsets(getSystemInfo())).toMatchObject({ top: 0, bottom: 0, known: { top: true, bottom: true } })
  })

  it.each([undefined, null, '', NaN, Infinity, true])('rejects an unknown/invalid window origin %j', windowTop => {
    g.SystemInfo = { platform: 'Android', windowTop }
    expect(getSystemInfo().windowTopKnown).toBe(false)
    expect(getSystemInfo().windowTop).toBe(0)
  })

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

  it('reads the native SystemInfo window dimensions directly', () => {
    g.SystemInfo = { platform: 'iOS', windowWidth: 680, windowHeight: 500 }
    expect(getViewportSize()).toEqual({ width: 680, height: 500 })
    expect(getSystemInfo().windowWidth).toBe(680)
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

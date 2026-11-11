import { afterEach, describe, expect, it } from 'vitest'
import { configureHost } from '@wot-lynx/core/common/host'
import { getSafeAreaInsets, resolveSafeAreaInsets } from '@wot-lynx/core/common/safe-area'
import type { SystemInfo } from '@wot-lynx/core/common/util'

const screen: SystemInfo = { platform: 'ios', screenWidth: 390, screenHeight: 844, windowWidth: 390, windowHeight: 844, windowTop: 0, windowLeft: 0, statusBarHeight: 0, pixelRatio: 3 }
afterEach(() => configureHost(null))

describe('window safe-area coordinates', () => {
  it.each([
    { platform: 'ios', top: 59, bottom: 34 },
    { platform: 'android', top: 32, bottom: 24 },
    { platform: 'android', top: 24, bottom: 48 }
  ])('uses host-provided $platform insets without device-size heuristics', ({ platform, top, bottom }) => {
    const result = resolveSafeAreaInsets({ ...screen, platform, safeAreaInsets: { top, bottom, left: 0, right: 0 } })
    expect(result).toEqual({ top, bottom, left: 0, right: 0, known: { top: true, bottom: true, left: true, right: true } })
  })

  it('intersects a screen rectangle with a full-screen, inset, or keyboard-reduced window', () => {
    const info = { ...screen, safeArea: { top: 59, bottom: 810, left: 0, right: 390 } }
    expect(resolveSafeAreaInsets(info)).toMatchObject({ top: 59, bottom: 34 })
    expect(resolveSafeAreaInsets({ ...info, windowTop: 59, windowHeight: 751 })).toMatchObject({ top: 0, bottom: 0 })
    expect(resolveSafeAreaInsets({ ...info, windowTop: 59, windowHeight: 785 })).toMatchObject({ top: 0, bottom: 34 })
    expect(resolveSafeAreaInsets({ ...info, windowTop: 59, windowHeight: 400 })).toMatchObject({ top: 0, bottom: 0 })
    expect(resolveSafeAreaInsets({ ...info, windowTop: 20, windowHeight: 824 })).toMatchObject({ top: 39, bottom: 34 })
  })

  it('handles landscape side insets and a horizontally offset viewport', () => {
    const info = { ...screen, screenWidth: 844, screenHeight: 390, windowWidth: 844, windowHeight: 390,
      safeArea: { top: 0, bottom: 369, left: 59, right: 785 } }
    expect(resolveSafeAreaInsets(info)).toMatchObject({ top: 0, bottom: 21, left: 59, right: 59 })
    expect(resolveSafeAreaInsets({ ...info, windowLeft: 59, windowWidth: 726 })).toMatchObject({ left: 0, right: 0 })
  })

  it('keeps explicit zero authoritative and falls through separately for invalid/missing edges', () => {
    const info = { ...screen, safeArea: { top: 59, bottom: 810, left: 0, right: 390 }, safeAreaInsets: { top: 0, bottom: 0 } }
    expect(resolveSafeAreaInsets(info)).toMatchObject({ top: 0, bottom: 0 })
    expect(resolveSafeAreaInsets({ ...info, safeAreaInsets: { top: NaN, bottom: Infinity } })).toMatchObject({ top: 59, bottom: 34 })
    expect(resolveSafeAreaInsets(info, { bottom: 20 })).toMatchObject({ top: 0, bottom: 20 })
    expect(resolveSafeAreaInsets({ ...screen, safeAreaInsets: { top: '24', bottom: '16' } })).toMatchObject({ top: 24, bottom: 16 })
  })

  it.each([undefined, {}, { top: 0, bottom: 0, left: 0, right: 0 }, { top: 59, bottom: 30 }, { top: 0, bottom: Infinity }])('does not turn missing/invalid rectangles into a full-screen inset: %j', safeArea => {
    const result = resolveSafeAreaInsets({ ...screen, safeArea })
    expect(result.top).toBe(0)
    expect(result.bottom).toBe(0)
    expect(result.known.top).toBe(false)
    expect(result.known.bottom).toBe(false)
  })

  it('uses a known status bar only for the overlap with the window', () => {
    expect(resolveSafeAreaInsets({ ...screen, statusBarHeight: 24 })).toMatchObject({ top: 24, bottom: 0 })
    expect(resolveSafeAreaInsets({ ...screen, statusBarHeight: 24, windowTop: 24, windowHeight: 820 })).toMatchObject({ top: 0, bottom: 0 })
  })

  it('reads late host registration, withdrawal and failure without stale cached insets', () => {
    const info = { ...screen, safeAreaInsets: { top: 59, bottom: 34 } }
    expect(getSafeAreaInsets(info)).toMatchObject({ top: 59, bottom: 34 })
    configureHost({ getSafeAreaInsets: () => ({ top: 0, bottom: 0 }) })
    expect(getSafeAreaInsets(info)).toMatchObject({ top: 0, bottom: 0 })
    configureHost({ getSafeAreaInsets: () => { throw new Error('unavailable') } })
    expect(getSafeAreaInsets(info)).toMatchObject({ top: 59, bottom: 34 })
    configureHost(null)
    expect(getSafeAreaInsets(info)).toMatchObject({ top: 59, bottom: 34 })
  })
})

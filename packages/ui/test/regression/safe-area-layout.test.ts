/** Native style-channel assertions; jsdom does not evaluate OS safe-area env values. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolve } from 'node:path'
import postcss from 'postcss'
import { h, nextTick, ref } from 'vue-lynx'
import Popup from '@wot-lynx/primitives/wd-popup'
import Navbar from '@wot-lynx/ui-nav/wd-navbar'
import Notify from '@wot-lynx/ui-feedback/wd-notify'
import Calendar from '@wot-lynx/ui-picker/wd-calendar'
import { configureHost } from '@wot-lynx/core/common/host'
import { getViewportOverride, setViewportOverride } from '@wot-lynx/core/common/viewport'
import { pause } from '@wot-lynx/core/common/util'
import { cleanup, render } from '../render'
import { restoreNativeStubs, setSystemInfo } from '../helpers/native-stubs'
import { compileScss } from '../helpers/scss'
import { compPath } from '../helpers/component-roots'

const oldViewport = getViewportOverride()
const device = (platform = 'iOS', height = 844, top = 59, bottom = 34) => setSystemInfo({
  platform, screenWidth: 390, screenHeight: height, windowWidth: 390, windowHeight: height,
  windowTop: 0, statusBarHeight: 0, safeArea: undefined, safeAreaInsets: { top, bottom, left: 0, right: 0 }
})
const style = (container: Element, selector: string, key: string) =>
  (container.querySelector(selector) as HTMLElement).style.getPropertyValue(key)
async function settle() { await nextTick(); await pause(50); await nextTick() }
afterEach(async () => {
  cleanup()
  await pause(50)
  configureHost(null)
  restoreNativeStubs()
  setViewportOverride(oldViewport)
  vi.restoreAllMocks()
})

describe('shared popup / navbar safe area', () => {
  it.each([
    { platform: 'iOS', height: 844, top: 59, bottom: 34, rootPortal: false },
    { platform: 'iOS', height: 844, top: 47, bottom: 34, rootPortal: true },
    { platform: 'Android', height: 853, top: 32, bottom: 24, rootPortal: false },
    { platform: 'Android', height: 853, top: 24, bottom: 48, rootPortal: true }
  ])('$platform reserves the actual top/bottom distances (portal=$rootPortal)', async ({ platform, height, top, bottom, rootPortal }) => {
    device(platform, height, top, bottom)
    const { container } = render(Popup, { modelValue: true, position: 'bottom', safeAreaInsetBottom: true, rootPortal, duration: 0 })
    await settle()
    expect(style(container, '.wd-popup-harness', 'height')).toBe(`${height}px`)
    expect(style(container, '.wd-popup-harness', 'padding-top')).toBe(`${top}px`)
    expect(style(container, '.wd-popup', 'padding-bottom')).toBe(`${bottom}px`)
    expect(style(container, '.wd-popup', 'max-height')).toBe(`${height - top}px`)
    expect(style(container, '.wd-popup', 'box-sizing')).toBe('border-box')
  })

  it('clears top/bottom on the same instance and restores safe padding after custom styles are removed', async () => {
    device()
    const safe = ref(true), custom = ref<Record<string, string>>({})
    const { container } = render({ setup: () => () => h(Popup, {
      modelValue: true, position: 'top', duration: 0,
      safeAreaInsetTop: safe.value, safeAreaInsetBottom: safe.value, customStyle: custom.value
    }) })
    await settle()
    safe.value = false
    await settle()
    expect(style(container, '.wd-popup-harness', 'padding-top')).toBe('0px')
    expect(style(container, '.wd-popup', 'padding-bottom')).toBe('0px')
    expect(style(container, '.wd-popup', 'max-height')).toBe('844px')
    safe.value = true
    custom.value = { 'padding-bottom': '7px', 'border-color': 'red' }
    await settle()
    expect(style(container, '.wd-popup', 'padding-bottom')).toBe('7px')
    custom.value = {}
    await settle()
    expect(style(container, '.wd-popup-harness', 'padding-top')).toBe('59px')
    expect(style(container, '.wd-popup', 'padding-bottom')).toBe('34px')
    expect(style(container, '.wd-popup', 'border-color')).toBe('')
  })

  it('does not re-add system bars when the host declares that its window is already safe', async () => {
    device()
    configureHost({ getSafeAreaInsets: () => ({ top: 0, bottom: 0 }) })
    setViewportOverride({ width: 390, height: 751 })
    const { container } = render(Popup, { modelValue: true, position: 'bottom', safeAreaInsetBottom: true, duration: 0 })
    await settle()
    expect(style(container, '.wd-popup-harness', 'height')).toBe('751px')
    expect(style(container, '.wd-popup-harness', 'padding-top')).toBe('0px')
    expect(style(container, '.wd-popup', 'padding-bottom')).toBe('0px')
    expect(style(container, '.wd-popup', 'max-height')).toBe('751px')
  })

  it('refreshes insets when system bars change without a viewport size change and unsubscribes', async () => {
    device()
    let values = { top: 59, bottom: 34 }
    let changed: ((event: unknown) => void) | undefined
    const off = vi.fn()
    configureHost({ getSafeAreaInsets: () => values, onWindowResize: callback => { changed = callback }, offWindowResize: off })
    setViewportOverride({ width: 390, height: 844 })
    const { container } = render(Popup, { modelValue: true, position: 'bottom', safeAreaInsetBottom: true, modal: false, duration: 0 })
    await settle()
    values = { top: 24, bottom: 48 }
    changed!({ width: 390, height: 844 })
    await settle()
    expect(style(container, '.wd-popup-harness', 'padding-top')).toBe('24px')
    expect(style(container, '.wd-popup', 'padding-bottom')).toBe('48px')
    cleanup()
    expect(off).toHaveBeenCalledWith(changed)
  })

  it('reads late host registration on reopen and clears mobile padding in wide-screen centered mode', async () => {
    device()
    const visible = ref(true)
    const { container } = render({ setup: () => () => h(Popup, { modelValue: visible.value, position: 'bottom', safeAreaInsetBottom: true, duration: 0 }) })
    await settle()
    visible.value = false
    await settle()
    configureHost({ getSafeAreaInsets: () => ({ top: 20, bottom: 16 }) })
    visible.value = true
    await settle()
    expect(style(container, '.wd-popup', 'padding-bottom')).toBe('16px')
    setViewportOverride({ width: 1024, height: 768 })
    await settle()
    expect(container.querySelector('.wd-popup--center')).not.toBeNull()
    expect(style(container, '.wd-popup', 'padding-bottom')).toBe('0px')
    setViewportOverride({ width: 390, height: 844 })
    await settle()
    expect(style(container, '.wd-popup', 'padding-bottom')).toBe('16px')
  })

  it('retains native env fallback instead of converting missing data into a false zero', async () => {
    device()
    setSystemInfo({ safeAreaInsets: undefined })
    const global = globalThis as any
    const mt = global.lynxTestingEnv.mainThread.globalThis
    const original = mt.__SetInlineStyles, originalGlobal = global.__SetInlineStyles
    const writes = new Map<Element, Record<string, string>>()
    mt.__SetInlineStyles = global.__SetInlineStyles = (element: Element, value: Record<string, string>) => {
      writes.set(element, { ...writes.get(element), ...value })
      return original(element, value)
    }
    try {
      const { container } = render(Popup, { modelValue: true, position: 'bottom', safeAreaInsetBottom: true, duration: 0 })
      await settle()
      // cssstyle drops bare env() in padding; assert what the real renderer receives.
      expect(writes.get(container.querySelector('.wd-popup-harness')!)?.['padding-top']).toBe('env(safe-area-inset-top)')
      expect(writes.get(container.querySelector('.wd-popup')!)?.['padding-bottom']).toBe('env(safe-area-inset-bottom)')
      expect(writes.get(container.querySelector('.wd-popup')!)?.['max-height']).toBe('calc(844px - env(safe-area-inset-top))')
      setSystemInfo({ windowTop: undefined, safeArea: { top: 59, bottom: 810 } })
      setViewportOverride({ width: 390, height: 785 })
      await settle()
      expect(writes.get(container.querySelector('.wd-popup-harness')!)?.['padding-top']).toBe('env(safe-area-inset-top)')
      expect(writes.get(container.querySelector('.wd-popup')!)?.['padding-bottom']).toBe('env(safe-area-inset-bottom)')
      expect(writes.get(container.querySelector('.wd-popup')!)?.['max-height']).toBe('calc(785px - env(safe-area-inset-top))')
    } finally {
      mt.__SetInlineStyles = original
      global.__SetInlineStyles = originalGlobal
    }
  })

  it('does not add automatic top insets on top of Notify manual safeHeight', async () => {
    device('Android', 853, 32, 24)
    const safeHeight = ref(44)
    const { container } = render({ setup: () => () => h(Notify, {
      visible: true, position: 'top', safeHeight: safeHeight.value, duration: 0, message: '通知'
    }) })
    await settle()
    expect(style(container, '.wd-popup-harness', 'padding-top')).toBe('0px')
    expect(style(container, '.wd-popup', 'padding-top')).toBe('44px')
    safeHeight.value = 0
    await settle()
    expect(style(container, '.wd-popup-harness', 'padding-top')).toBe('32px')
    expect(style(container, '.wd-popup', 'padding-top')).toBe('0px')
  })

  it('navbar uses the same source and restores top spacing after toggling/custom-style removal', async () => {
    device('Android', 853, 32, 24)
    const safe = ref(true), custom = ref<Record<string, string>>({ 'padding-top': '8px' })
    const { container } = render({ setup: () => () => h(Navbar, { title: '标题', safeAreaInsetTop: safe.value, customStyle: custom.value }) })
    await settle()
    expect(style(container, '.wd-navbar', 'padding-top')).toBe('8px')
    custom.value = {}
    await settle()
    expect(style(container, '.wd-navbar', 'padding-top')).toBe('32px')
    safe.value = false
    await settle()
    expect(style(container, '.wd-navbar', 'padding-top')).toBe('0px')
    safe.value = true
    await settle()
    expect(style(container, '.wd-navbar', 'padding-top')).toBe('32px')
  })
})

describe('calendar confirmation area', () => {
  it('keeps UI padding separate from system padding and passes insets through ActionSheet', async () => {
    device('Android', 853, 32, 24)
    const { container } = render(Calendar, {
      modelValue: new Date(2026, 10, 10).getTime(), visible: true, duration: 0,
      minDate: new Date(2026, 10, 1).getTime(), maxDate: new Date(2026, 10, 30).getTime()
    })
    await settle()
    expect(container.querySelector('.wd-calendar__confirm .wd-button')).not.toBeNull()
    expect(style(container, '.wd-popup', 'padding-bottom')).toBe('24px')
    const declarations: Record<string, string> = {}
    postcss.parse(compileScss(compPath('wd-calendar', 'index.scss'))).walkRules(rule => {
      if (rule.selector !== '.wd-calendar__confirm') return
      rule.walkDecls(decl => { declarations[decl.prop] = decl.value })
    })
    let padding = declarations.padding
    for (let depth = 0; depth < 10; depth++) padding = padding.replace(/var\(--[\w-]+,\s*([^()]+)\)/g, '$1')
    expect(padding).toBe('16px 12px')
    expect(declarations['flex-shrink']).toBe('0')
    expect(declarations.padding).not.toContain('env(')
  })
})

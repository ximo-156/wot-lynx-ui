/**
 * Bottom-safe-area integration: exercise the real BG → MT style channel on both native
 * platforms. CSSOM drops bare env() padding, so inspect SET_STYLE rather than pretend
 * jsdom can evaluate native environment values. This is not a device pixel test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import postcss from 'postcss'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import { compCss, compPath } from '../helpers/component-roots'
import { compileScss } from '../helpers/scss'
import { nativeRuntime, restoreNativeStubs, setSystemInfo, stubNativeQuery } from '../helpers/native-stubs'
import { configureHost } from '@wot-lynx/core/common/host'
import { setViewportOverride } from '@wot-lynx/core/common/viewport-state'
import type { SafeAreaInsets } from '@wot-lynx/core/common/safe-area'
import Tabbar from '@wot-lynx/ui-nav/wd-tabbar'
import SubmitBar from '@wot-lynx/ui-display/wd-submit-bar'
import Gap from '@wot-lynx/ui-layout/wd-gap'
import FloatingPanel from '@wot-lynx/ui-feedback/wd-floating-panel'

type NativeStyle = Record<string, string>
type CustomStyle = string | Record<string, string>
let styles: Map<Element, NativeStyle>
let writes: Array<{ element: Element; style: NativeStyle }>
let restoreStyleProbe: () => void

const rect = (height: number) => ({ width: 390, height, left: 0, right: 390, top: 0, bottom: height })
async function flush() { for (let i = 0; i < 6; i++) await nextTick() }
function node(container: Element, selector: string): HTMLElement {
  const result = container.querySelector(selector)
  expect(result, selector).not.toBeNull()
  return result as HTMLElement
}
function nativeStyle(element: Element): NativeStyle {
  expect(styles.has(element), 'the element must receive a native SET_STYLE object').toBe(true)
  return styles.get(element)!
}
function installHost(platform: 'ios' | 'android', initial: Partial<SafeAreaInsets> | null) {
  setSystemInfo({
    platform, windowWidth: 390, windowHeight: 844, screenWidth: 390, screenHeight: 844,
    windowTop: 0, windowLeft: 0, statusBarHeight: 0, safeArea: undefined, safeAreaInsets: undefined
  })
  let insets = initial
  const listeners = new Set<(event: unknown) => void>()
  configureHost({
    getSafeAreaInsets: () => insets,
    onWindowResize: (callback) => { listeners.add(callback) },
    offWindowResize: (callback) => { listeners.delete(callback) }
  })
  return {
    listeners,
    change(next: Partial<SafeAreaInsets> | null, size = { width: 390, height: 844 }) {
      insets = next
      for (const callback of [...listeners]) callback({ size })
    }
  }
}
function mountBottomComponents(initialSafe: boolean | 'defaults' = true) {
  const safe = ref<boolean | undefined>(initialSafe === 'defaults' ? undefined : initialSafe)
  const customStyle = ref<CustomStyle>('')
  const result = render({ setup: () => () => h('view', null, [
    h(Tabbar, { fixed: true, placeholder: true, safeAreaInsetBottom: safe.value, customStyle: customStyle.value }),
    h(Tabbar, { fixed: true, placeholder: true, shape: 'round', safeAreaInsetBottom: safe.value, customStyle: customStyle.value }),
    h(SubmitBar, { safeAreaInsetBottom: safe.value, customStyle: customStyle.value, showButton: false }),
    h(Gap, { safeAreaBottom: safe.value, customStyle: customStyle.value }),
    h(FloatingPanel, { height: 200, anchors: [200, 400], safeAreaInsetBottom: safe.value, customStyle: customStyle.value })
  ]) } as any)
  const roots = {
    tabbar: node(result.container, '.wd-tabbar--default'),
    round: node(result.container, '.wd-tabbar--round'),
    submit: node(result.container, '.wd-submit-bar'),
    gap: node(result.container, '.wd-gap'),
    panel: node(result.container, '.wd-floating-panel')
  }
  return { ...result, safe, customStyle, roots }
}
function expectInsets(roots: ReturnType<typeof mountBottomComponents>['roots'], bottom: number, enabled = true) {
  const padding = enabled ? `${bottom}px` : '0px'
  expect(nativeStyle(roots.tabbar)['padding-bottom']).toBe(padding)
  expect(nativeStyle(roots.tabbar).bottom).toBe('')
  expect(nativeStyle(roots.tabbar.parentElement!)['padding-bottom']).toBe('0px')
  expect(nativeStyle(roots.round)['padding-bottom']).toBe('0px')
  expect(nativeStyle(roots.round).bottom).toBe(enabled ? `${bottom}px` : '')
  expect(nativeStyle(roots.round.parentElement!)['padding-bottom']).toBe(padding)
  expect(nativeStyle(roots.submit)['padding-bottom']).toBe(`${8 + (enabled ? bottom : 0)}px`)
  expect(nativeStyle(roots.gap)['padding-bottom']).toBe(padding)
  expect(nativeStyle(roots.panel)['padding-bottom']).toBe(padding)
  for (const root of Object.values(roots)) expect(nativeStyle(root)).not.toHaveProperty('paddingBottom')
}

beforeEach(() => {
  setViewportOverride(null)
  stubNativeQuery(() => rect(50))
  styles = new Map()
  writes = []
  const global = globalThis as any
  const mt = global.lynxTestingEnv.mainThread.globalThis
  const original = mt.__SetInlineStyles
  const originalGlobal = global.__SetInlineStyles
  const setStyle = (element: Element, value: NativeStyle) => {
    // Match Lynx merge semantics: omitted keys retain their previous values.
    styles.set(element, { ...styles.get(element), ...value })
    writes.push({ element, style: { ...value } })
    return original(element, value)
  }
  mt.__SetInlineStyles = global.__SetInlineStyles = setStyle
  restoreStyleProbe = () => {
    mt.__SetInlineStyles = original
    global.__SetInlineStyles = originalGlobal
  }
})
afterEach(() => {
  cleanup()
  configureHost(null)
  setViewportOverride(null)
  vi.restoreAllMocks()
  restoreNativeStubs()
  restoreStyleProbe()
})

const platforms = [{ platform: 'ios', bottom: 34 }, { platform: 'android', bottom: 24 }] as const

describe('unified native bottom safe areas', () => {
  it.each(platforms)('$platform explicit window insets win over legacy data and survive repeated safe toggles', async ({ platform, bottom }) => {
    installHost(platform, { top: 47, right: 0, bottom, left: 0 })
    setSystemInfo({ safeAreaInsets: { bottom: 77 }, safeArea: { top: 47, bottom: 800, left: 0, right: 390 } })
    const { safe, roots } = mountBottomComponents()
    await flush()
    expectInsets(roots, bottom)
    for (const enabled of [false, true, false, true]) {
      safe.value = enabled
      await flush()
      expectInsets(roots, bottom, enabled)
      expect(roots.tabbar.classList.contains('is-safe')).toBe(enabled)
      expect(roots.gap.classList.contains('wd-gap--safe')).toBe(enabled)
      expect(roots.panel.classList.contains('is-safe')).toBe(enabled)
      expect(roots.round.parentElement!.classList.contains('wd-tabbar__placeholder')).toBe(enabled)
    }
  })

  it('preserves the existing safe prop defaults and the 8px SubmitBar baseline', async () => {
    installHost('ios', { bottom: 34 })
    const { roots } = mountBottomComponents('defaults')
    await flush()
    // Passing undefined exercises each component's own runtime prop default.
    expect(nativeStyle(roots.submit)['padding-bottom']).toBe('42px')
    for (const root of [roots.tabbar, roots.round, roots.gap, roots.panel]) {
      expect(nativeStyle(root)['padding-bottom']).toBe('0px')
    }
    expect(nativeStyle(roots.round).bottom).toBe('')
    expect(nativeStyle(roots.gap)).toMatchObject({ height: '14px', 'background-color': 'transparent' })
  })

  it.each(platforms)('$platform refreshes system-bar-only changes, accepts explicit zero and unsubscribes', async ({ platform, bottom }) => {
    const host = installHost(platform, { bottom })
    setSystemInfo({ safeAreaInsets: { bottom: 77 } })
    const { roots, unmount } = mountBottomComponents()
    await flush()
    expectInsets(roots, bottom)
    host.change({ bottom: 0 }) // dimensions are unchanged; revision must still invalidate styles
    await flush()
    expectInsets(roots, 0)
    host.change({ bottom: 12 }, { width: 844, height: 390 })
    await flush()
    expectInsets(roots, 12)
    expect(host.listeners.size).toBeGreaterThan(0)
    unmount()
    expect(host.listeners.size).toBe(0)
  })

  it('uses native env without a comma fallback only when bottom is unknown, and resets it explicitly', async () => {
    const host = installHost('android', null)
    const { roots, safe } = mountBottomComponents()
    await flush()
    for (const root of [roots.tabbar, roots.gap, roots.panel, roots.round.parentElement!]) {
      expect(nativeStyle(root)['padding-bottom']).toBe('env(safe-area-inset-bottom)')
    }
    expect(nativeStyle(roots.round).bottom).toBe('env(safe-area-inset-bottom)')
    expect(nativeStyle(roots.submit)['padding-bottom']).toBe('calc(8px + env(safe-area-inset-bottom))')
    safe.value = false
    await flush()
    expectInsets(roots, 0, false)
    safe.value = true
    host.change({ bottom: 0 })
    await flush()
    expectInsets(roots, 0)
    host.change(null)
    await flush()
    expect(nativeStyle(roots.gap)['padding-bottom']).toBe('env(safe-area-inset-bottom)')
    expect(nativeStyle(roots.submit)['padding-bottom']).toBe('calc(8px + env(safe-area-inset-bottom))')
  })

  it.each(['string', 'object'] as const)('%s customStyle wins, then removal restores safe/base values and clears arbitrary keys', async (format) => {
    installHost('ios', { bottom: 34 })
    const { roots, safe, customStyle } = mountBottomComponents()
    await flush()
    const custom = format === 'string'
      ? 'padding-bottom: 6px; bottom: 9px; margin-top: 7px; z-index: 87; --wot-bottom-probe: 3px'
      : { paddingBottom: '6px', bottom: '9px', marginTop: '7px', zIndex: '87', '--wot-bottom-probe': '3px' }
    customStyle.value = custom
    await flush()
    for (const root of Object.values(roots)) {
      expect(nativeStyle(root)).toMatchObject({ 'padding-bottom': '6px', bottom: '9px', 'margin-top': '7px', 'z-index': '87', '--wot-bottom-probe': '3px' })
    }
    for (const root of [roots.tabbar.parentElement!, roots.round.parentElement!]) {
      expect(nativeStyle(root)).not.toHaveProperty('margin-top')
      expect(nativeStyle(root)).not.toHaveProperty('--wot-bottom-probe')
    }
    safe.value = false
    await flush()
    for (const root of Object.values(roots)) expect(nativeStyle(root)['padding-bottom']).toBe('6px')
    customStyle.value = format === 'string' ? '' : {}
    await flush()
    expectInsets(roots, 34, false)
    for (const root of Object.values(roots)) {
      expect(nativeStyle(root)).toMatchObject({ 'margin-top': '', '--wot-bottom-probe': '' })
    }
    expect(nativeStyle(roots.tabbar)['z-index']).toBe('10')
    expect(nativeStyle(roots.round)['z-index']).toBe('10')
    safe.value = true
    await flush()
    expectInsets(roots, 34)
    customStyle.value = custom
    await flush()
    customStyle.value = ''
    await flush()
    expectInsets(roots, 34)
  })

  it('keeps per-instance resolver histories separate', async () => {
    installHost('android', { bottom: 24 })
    const custom = ref<CustomStyle>({ marginTop: '11px' })
    const { container } = render({ setup: () => () => h('view', [
      h(Gap, { customClass: 'first-gap', safeAreaBottom: true, customStyle: custom.value }),
      h(Gap, { customClass: 'second-gap', safeAreaBottom: true })
    ]) } as any)
    await flush()
    const first = node(container, '.first-gap'), second = node(container, '.second-gap')
    expect(nativeStyle(first)['margin-top']).toBe('11px')
    expect(nativeStyle(second)).not.toHaveProperty('margin-top')
    custom.value = {}
    await flush()
    expect(nativeStyle(first)['margin-top']).toBe('')
    expect(nativeStyle(second)).not.toHaveProperty('margin-top')
  })
})

describe('bottom component layout and lifecycle contracts', () => {
  it('remeasures Tabbar after safe-area/shape changes without double-counting padding; fixed/placeholder toggles reset', async () => {
    const host = installHost('ios', { bottom: 34 })
    let measuredHeight = 84
    const { calls } = stubNativeQuery(() => rect(measuredHeight))
    const shape = ref<'default' | 'round'>('default'), fixed = ref(true), placeholder = ref(true), safe = ref(true)
    const { container } = render({ setup: () => () => h(Tabbar, {
      fixed: fixed.value, placeholder: placeholder.value, shape: shape.value, safeAreaInsetBottom: safe.value
    }) } as any)
    await flush()
    const root = node(container, '.wd-tabbar'), space = root.parentElement!
    expect(nativeStyle(space)).toMatchObject({ display: 'flex', 'flex-direction': 'column', height: '84px', 'padding-bottom': '0px' })
    expect(nativeStyle(root)['padding-bottom']).toBe('34px')
    measuredHeight = 50
    shape.value = 'round'
    await flush()
    expect(nativeStyle(root)).toMatchObject({ bottom: '34px', 'padding-bottom': '0px' })
    expect(nativeStyle(space)).toMatchObject({ height: '50px', 'padding-bottom': '34px' })
    const count = calls.length
    host.change({ bottom: 21 })
    await flush()
    expect(calls.length).toBeGreaterThan(count)
    expect(nativeStyle(root).bottom).toBe('21px')
    expect(nativeStyle(space)).toMatchObject({ height: '50px', 'padding-bottom': '21px' })
    shape.value = 'default'
    measuredHeight = 71
    await flush()
    expect(nativeStyle(root)).toMatchObject({ bottom: '', 'padding-bottom': '21px' })
    expect(nativeStyle(space)).toMatchObject({ height: '71px', 'padding-bottom': '0px' })
    fixed.value = false
    await flush()
    expect(nativeStyle(root)).toMatchObject({ bottom: '', 'padding-bottom': '0px' })
    expect(nativeStyle(space)).toMatchObject({ height: 'auto', 'padding-bottom': '0px' })
    fixed.value = true
    shape.value = 'round'
    placeholder.value = false
    await flush()
    expect(nativeStyle(space)).toMatchObject({ height: 'auto', 'padding-bottom': '0px' })
    placeholder.value = true
    measuredHeight = 50
    await flush()
    expect(nativeStyle(space)).toMatchObject({ height: '50px', 'padding-bottom': '21px' })
    safe.value = false
    await flush()
    expect(nativeStyle(root)).toMatchObject({ bottom: '', 'padding-bottom': '0px' })
    expect(nativeStyle(space)['padding-bottom']).toBe('0px')
  })

  it('ignores stale Tabbar measurements after a safety revision and after unmount', async () => {
    const host = installHost('ios', { bottom: 34 })
    const pending: Array<(value: ReturnType<typeof rect>) => void> = []
    vi.spyOn(nativeRuntime(), 'createSelectorQuery').mockImplementation(() => {
      const query: any = {
        in: () => query,
        select: () => ({ invoke: (options: any) => ({ exec: () => pending.push(options.success) }) }),
        exec: () => {}
      }
      return query
    })
    const { container, unmount } = render({ setup: () => () => h(Tabbar, { fixed: true, placeholder: true, safeAreaInsetBottom: true }) } as any)
    await flush()
    const space = node(container, '.wd-tabbar').parentElement!
    const old = pending.splice(0)
    expect(old.length).toBeGreaterThan(0)
    host.change({ bottom: 20 })
    await flush()
    const current = pending.splice(0)
    expect(current.length).toBeGreaterThan(0)
    current[current.length - 1](rect(70))
    for (const resolve of [...old, ...current.slice(0, -1)]) resolve(rect(999))
    await flush()
    expect(nativeStyle(space).height).toBe('70px')
    host.change({ bottom: 0 })
    await flush()
    expect(pending.length).toBeGreaterThan(0)
    unmount()
    const writeCount = writes.length
    for (const resolve of pending.splice(0)) resolve(rect(999))
    await flush()
    expect(writes.length).toBe(writeCount)
    expect(host.listeners.size).toBe(0)
  })

  it('Gap retains height/background overrides and restores prop values after customStyle removal', async () => {
    installHost('android', { bottom: 24 })
    const height = ref<string | number>(20), bg = ref('rgb(1, 2, 3)'), custom = ref<CustomStyle>({ height: '60px', backgroundColor: 'rgb(4, 5, 6)' })
    const { container } = render({ setup: () => () => h(Gap, { height: height.value, bgColor: bg.value, safeAreaBottom: true, customStyle: custom.value }) } as any)
    await flush()
    const gap = node(container, '.wd-gap')
    expect(nativeStyle(gap)).toMatchObject({ height: '60px', 'background-color': 'rgb(4, 5, 6)', 'padding-bottom': '24px' })
    custom.value = ''
    await flush()
    expect(nativeStyle(gap)).toMatchObject({ height: '20px', 'background-color': 'rgb(1, 2, 3)' })
    height.value = 0
    bg.value = ''
    await flush()
    expect(nativeStyle(gap)).toMatchObject({ height: '0px', 'background-color': 'transparent', 'padding-bottom': '24px' })
  })

  it('SubmitBar preserves price sizing, slots and disabled/loading submit gating', async () => {
    installHost('ios', { bottom: 34 })
    const disabled = ref(false), loading = ref(false), submit = vi.fn()
    const { container } = render({ setup: () => () => h(SubmitBar, {
      price: '12.30', label: '合计', buttonDisabled: disabled.value, buttonLoading: loading.value, onSubmit: submit
    }, { left: () => h('text', { class: 'left-slot' }, '左侧'), default: () => h('text', { class: 'main-slot' }, '内容') }) } as any)
    await flush()
    expect(node(container, '.wd-submit-bar__price-integer').textContent).toBe('12')
    expect(node(container, '.wd-submit-bar__price-decimal').textContent).toBe('.30')
    expect(nativeStyle(node(container, '.wd-submit-bar__price-integer'))['font-size']).toBe('20px')
    expect(nativeStyle(node(container, '.wd-submit-bar__price-decimal'))['font-size']).toBe('14px')
    expect(node(container, '.left-slot').textContent).toBe('左侧')
    expect(node(container, '.main-slot').textContent).toBe('内容')
    const button = node(container, '.wd-submit-bar__button')
    fireEvent.tap(button)
    expect(submit).toHaveBeenCalledTimes(1)
    disabled.value = true
    await flush()
    fireEvent.tap(button)
    disabled.value = false
    loading.value = true
    await flush()
    fireEvent.tap(button)
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('FloatingPanel only pads its root and invalidates old gestures on safe toggles/host resize without changing MTS math', async () => {
    const host = installHost('ios', { bottom: 34 })
    const safe = ref(true), updates: number[] = [], changes: number[] = []
    const panelAnchors = [200, 400] // Keep configuration stable when only safety changes.
    const { container } = render({ setup: () => () => h(FloatingPanel, {
      height: 200, anchors: panelAnchors, safeAreaInsetBottom: safe.value,
      'onUpdate:height': (height: number) => updates.push(height), onHeightChange: (value: { height: number }) => changes.push(value.height)
    }, () => h('text', { class: 'panel-slot' }, '面板内容')) } as any)
    await flush()
    updates.length = 0
    const root = node(container, '.wd-floating-panel'), header = node(container, '.wd-floating-panel__header')
    const start = async () => {
      fireEvent.touchstart(header, { touches: [{ clientY: 500, clientX: 0 }] })
      fireEvent.touchstart(root, { touches: [{ clientY: 500, clientX: 0 }] })
      await flush()
    }
    await start()
    fireEvent.touchmove(root, { touches: [{ clientY: 400, clientX: 0 }] })
    expect(root.style.transform).toBe('translateY(calc(100% + -300px))')
    expect(root.style.transition).toBe('none')
    safe.value = false
    await flush()
    expect(nativeStyle(root)['padding-bottom']).toBe('0px')
    expect(root.style.transform).toBe('translateY(calc(100% + -200px))')
    fireEvent.touchmove(root, { touches: [{ clientY: 300, clientX: 0 }] })
    fireEvent.touchend(root, { changedTouches: [{ clientY: 300, clientX: 0 }] })
    await flush()
    expect(updates).toEqual([])
    expect(changes).toEqual([])
    safe.value = true
    await flush()
    await start()
    fireEvent.touchmove(root, { touches: [{ clientY: 100, clientX: 0 }] })
    expect(root.style.transform).toBe('translateY(calc(100% + -440px))') // same 0.2 damping
    host.change({ bottom: 21 }, { width: 844, height: 390 })
    await flush()
    expect(nativeStyle(root)).toMatchObject({ height: '400px', 'padding-bottom': '21px' })
    expect(root.getAttribute('max-bound')).toBe('400')
    expect(root.style.transform).toBe('translateY(calc(100% + -200px))')
    fireEvent.touchend(root, { changedTouches: [{ clientY: 100, clientX: 0 }] })
    await flush()
    expect(updates).toEqual([])
    await start()
    fireEvent.touchmove(root, { touches: [{ clientY: 300, clientX: 0 }] })
    fireEvent.touchend(root, { changedTouches: [{ clientY: 300, clientX: 0 }] })
    await flush()
    expect(updates).toEqual([400])
    expect(changes).toEqual([400])
    expect(root.style.transform).toBe('translateY(calc(100% + -400px))')
    expect(root.style.transition).toContain('300ms')
    expect(node(container, '.panel-slot').parentElement!.tagName.toLowerCase()).toBe('scroll-view')
  })

  it('retains existing flex, box-model, theme and fixed-anchor CSS contracts', () => {
    const sheets = new Map<string, ReturnType<typeof postcss.parse>>()
    const rule = (name: string, selector: string) => {
      // Compile only these component sheets in memory; never run/write CSS generators.
      if (!sheets.has(name)) sheets.set(name, postcss.parse(compileScss(compPath(name, 'index.scss'))))
      const values: Record<string, string> = {}
      sheets.get(name)!.walkRules((entry) => {
        if (entry.selectors.includes(selector)) entry.walkDecls((decl) => { values[decl.prop] = decl.value })
      })
      expect(Object.keys(values).length, selector).toBeGreaterThan(0)
      return values
    }
    expect(rule('wd-tabbar', '.wd-tabbar')).toMatchObject({ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', 'justify-content': 'center' })
    expect(rule('wd-tabbar', '.wd-tabbar').height).toContain('--wot-tabbar-height')
    expect(rule('wd-tabbar', '.wd-tabbar__placeholder')).toMatchObject({ display: 'flex', 'flex-direction': 'column', 'box-sizing': 'content-box' })
    expect(rule('wd-tabbar', '.wd-tabbar--default.is-fixed.is-safe')['box-sizing']).toBe('content-box')
    const round = rule('wd-tabbar', '.wd-tabbar--round')
    for (const property of ['margin-left', 'margin-right', 'border-radius', 'box-shadow']) expect(round[property]).toContain('--wot-tabbar-round-')
    expect(rule('wd-tabbar', '.wd-tabbar.is-fixed')).toMatchObject({ position: 'fixed', left: '0', right: '0', bottom: '0' })
    expect(rule('wd-submit-bar', '.wd-submit-bar')).toMatchObject({ display: 'flex', 'flex-direction': 'row', padding: '8px 16px', width: '100%' })
    expect(rule('wd-gap', '.wd-gap')).toMatchObject({ display: 'flex', 'flex-direction': 'column' })
    expect(rule('wd-floating-panel', '.wd-floating-panel')).toMatchObject({ position: 'fixed', bottom: '0', left: '0', right: '0', display: 'flex', 'flex-direction': 'column', 'box-sizing': 'border-box' })
    expect(rule('wd-floating-panel', '.wd-floating-panel__content')).toMatchObject({ flex: '1', 'min-height': '0', 'min-width': '0' })
    for (const name of ['wd-tabbar', 'wd-gap', 'wd-floating-panel']) {
      expect(compCss(name)).toContain('env(safe-area-inset-bottom)')
      expect(compCss(name)).not.toMatch(/env\(safe-area-inset-bottom\s*,/)
    }
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '@wot-lynx/core/common/util'
import { configureHost } from '@wot-lynx/core/common/host'
import { setViewportOverride } from '@wot-lynx/core/common/viewport'
import Popup from '@wot-lynx/primitives/wd-popup'
import DropMenu from '@wot-lynx/ui-nav/wd-drop-menu'
import DropMenuItem from '@wot-lynx/ui-nav/wd-drop-menu-item'

async function frames(n = 4) { for (let i = 0; i < n; i++) await pause() }
function width(el: Element | null) {
  expect(el, 'expected a real mounted element').not.toBeNull()
  return (el as HTMLElement).style.width
}
function mountPopup(extra: Record<string, unknown> = {}) {
  return render({ setup: () => () => h('view', [
    h(Popup as any, { modelValue: true, position: 'bottom', ...extra }, { default: () => h('view', '内容') })
  ]) } as any)
}
afterEach(() => {
  cleanup()
  configureHost({ onWindowResize: undefined, offWindowResize: undefined })
  setViewportOverride(null)
})

describe('wide-screen popup and viewport regression', () => {
  it('uses a centered bounded modal on desktop, with a full-size overlay', async () => {
    setViewportOverride({ width: 1440, height: 900 })
    const { container } = mountPopup({ round: true })
    await frames()
    const panel = container.querySelector('.wd-popup')!
    expect(width(panel)).toBe('480px')
    expect(panel.classList.contains('wd-popup--center')).toBe(true)
    expect(panel.classList.contains('is-wide')).toBe(true)
    expect(container.querySelector('.wd-popup-spacer')).toBeNull()
    const harness = container.querySelector('.wd-popup-harness') as HTMLElement
    expect(width(harness)).toBe('1440px')
    expect(harness.style.justifyContent).toBe('center')
    expect(width(container.querySelector('.wd-overlay'))).toBe('1440px')
    expect((container.querySelector('.wd-overlay') as HTMLElement).style.height).toBe('900px')
  })

  it.each([320, 390, 767])('keeps the mobile bottom sheet full width at %ipx', async size => {
    setViewportOverride({ width: size, height: 844 })
    const { container } = mountPopup()
    await frames()
    const panel = container.querySelector('.wd-popup')!
    expect(width(panel)).toBe(`${size}px`)
    expect(panel.classList.contains('wd-popup--bottom')).toBe(true)
    expect(container.querySelector('.wd-popup-spacer')).not.toBeNull()
  })

  it('resizes an already-open overlay and restores bottom positioning when narrowed', async () => {
    setViewportOverride({ width: 390, height: 844 })
    const { container } = mountPopup()
    await frames()
    setViewportOverride({ width: 1440, height: 900 }) // no window/Event needed in a Worker
    await nextTick(); await frames()
    expect(width(container.querySelector('.wd-popup'))).toBe('480px')
    expect(width(container.querySelector('.wd-overlay'))).toBe('1440px')
    expect(container.querySelector('.wd-popup--center')).not.toBeNull()
    setViewportOverride({ width: 360, height: 640 })
    await nextTick(); await frames()
    expect(width(container.querySelector('.wd-popup'))).toBe('360px')
    expect(width(container.querySelector('.wd-overlay'))).toBe('360px')
    expect((container.querySelector('.wd-overlay') as HTMLElement).style.height).toBe('640px')
    expect(container.querySelector('.wd-popup--bottom')).not.toBeNull()
  })

  it('permits explicit edge placement and user panel widths on desktop', async () => {
    setViewportOverride({ width: 1440, height: 900 })
    const first = mountPopup({ responsive: false })
    await frames()
    expect(width(first.container.querySelector('.wd-popup'))).toBe('1440px')
    expect(first.container.querySelector('.wd-popup--bottom')).not.toBeNull()
    const second = mountPopup({ customStyle: { width: '640px' } })
    await frames()
    expect(width(second.container.querySelector('.wd-popup'))).toBe('640px')
    expect(second.container.querySelector('.wd-popup--center')).not.toBeNull()
  })

  it('accepts host resize events and unregisters every callback on unmount', async () => {
    setViewportOverride({ width: 390, height: 844 })
    const listeners = new Set<(event: unknown) => void>()
    configureHost({ onWindowResize: (callback: any) => listeners.add(callback), offWindowResize: (callback: any) => listeners.delete(callback) })
    const { container } = mountPopup()
    await frames()
    expect(listeners.size).toBeGreaterThan(0)
    for (const callback of [...listeners]) callback({ size: { windowWidth: 1024, windowHeight: 768 } })
    await nextTick(); await frames()
    expect(width(container.querySelector('.wd-popup'))).toBe('480px')
    expect(width(container.querySelector('.wd-overlay'))).toBe('1024px')
    cleanup()
    expect(listeners.size).toBe(0)
  })

  it('receives Web CoreContext messages when the GlobalEventEmitter shim is absent', async () => {
    setViewportOverride({ width: 390, height: 844 })
    const env = (globalThis as any).lynxTestingEnv
    const globals = env.backgroundThread.globalThis
    const native = globals.lynx
    const previousGetter = native.getJSModule
    const previousContext = native.getCoreContext
    const previousInfo = globals.SystemInfo
    const listeners = new Set<(event: unknown) => void>()
    globals.SystemInfo = { ...previousInfo, platform: 'web' }
    native.getJSModule = () => undefined
    native.getCoreContext = () => ({
      addEventListener: (_name: string, callback: any) => listeners.add(callback),
      removeEventListener: (_name: string, callback: any) => listeners.delete(callback)
    })
    try {
      const { container } = mountPopup()
      await frames()
      expect(listeners.size).toBeGreaterThan(0)
      for (const callback of [...listeners]) callback({ data: { width: 1440, height: 900 } })
      await nextTick(); await frames()
      expect(width(container.querySelector('.wd-popup'))).toBe('480px')
      expect(width(container.querySelector('.wd-overlay'))).toBe('1440px')
      cleanup()
      expect(listeners.size).toBe(0)
    } finally {
      cleanup()
      native.getJSModule = previousGetter
      native.getCoreContext = previousContext
      globals.SystemInfo = previousInfo
    }
  })

  it('mounts and opens a real dropdown; anchored menus must not become center modals', async () => {
    setViewportOverride({ width: 1440, height: 900 })
    const { container } = render({ setup: () => () => h('view', [
      h(DropMenu as any, {}, { default: () => h(DropMenuItem as any, {
        title: '排序', modelValue: '', options: [{ value: 'a', label: '选项一' }, { value: 'b', label: '选项二' }]
      }) })
    ]) } as any)
    await frames()
    const header = container.querySelector('.wd-drop-menu__option')!
    expect(header, 'real menu header must be registered').not.toBeNull()
    fireEvent.tap(header)
    await nextTick(); await frames(6)
    const panel = container.querySelector('.wd-drop-item__popup')!
    expect(width(panel)).toBe('100%')
    expect(panel.classList.contains('wd-popup--center')).toBe(false)
  })
})

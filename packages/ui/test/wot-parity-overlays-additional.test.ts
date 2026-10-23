import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, inject, nextTick, ref } from 'vue-lynx'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from './render'
import { fireEvent } from './fire-event'
import { getSystemInfo, pause } from '../src/common/util'
import { configureUniAdapter } from '../src/common/uni'
import Overlay from '../src/primitives/wd-overlay/wd-overlay.vue'
import Popup from '../src/primitives/wd-popup/wd-popup.vue'
import Dialog from '../src/components/wd-dialog/wd-dialog.vue'
import ActionSheet from '../src/components/wd-action-sheet/wd-action-sheet.vue'
import Toast from '../src/components/wd-toast/wd-toast.vue'
import Notify from '../src/components/wd-notify/wd-notify.vue'
import Popover from '../src/components/wd-popover/wd-popover.vue'
import Tooltip from '../src/components/wd-tooltip/wd-tooltip.vue'
import Curtain from '../src/components/wd-curtain/wd-curtain.vue'
import ImagePreview from '../src/components/wd-image-preview/wd-image-preview.vue'
import VideoPreview from '../src/components/wd-video-preview/wd-video-preview.vue'
import Tour from '../src/components/wd-tour/wd-tour.vue'
import { getDialogDefaultOptionKey, useDialog } from '../src/components/wd-dialog'
import { getToastOptionKey, useToast } from '../src/components/wd-toast'
import { getNotifyOptionKey, resetNotifyDefaultOptions, setNotifyDefaultOptions, useNotify } from '../src/components/wd-notify'
import { getImagePreviewOptionKey, useImagePreview } from '../src/components/wd-image-preview'
import { getVideoPreviewOptionKey, useVideoPreview } from '../src/components/wd-video-preview'

const restores: Array<() => void> = []
afterEach(() => {
  cleanup()
  restores.splice(0).reverse().forEach((restore) => restore())
  resetNotifyDefaultOptions()
  configureUniAdapter({ getSystemInfoSync: undefined, pageScrollTo: undefined, createVideoContext: undefined, getMenuButtonBoundingClientRect: undefined, navigateTo: undefined, openType: undefined })
  vi.restoreAllMocks()
})
async function frames(count = 4) { for (let index = 0; index < count; index++) await pause() }
async function settled() { await pause(450); await frames(2) }
function hidden(element: Element | null) { return !element || /display:\s*none/.test(element.getAttribute('style') || '') }
function mount(component: any, initial: Record<string, any> = {}, slots?: any) {
  const props = ref(initial)
  const exposed = ref<any>()
  const result = render({ setup: () => () => h('view', { class: 'test-host' }, [h(component, { ...props.value, ref: exposed }, slots)]) } as any)
  return { ...result, props, exposed }
}
function rect(left = 10, top = 80, width = 80, height = 40) { return { left, top, width, height, right: left + width, bottom: top + height } }
function mockRects(respond: (selector: string, success: (value: any) => void) => void = (selector, success) => success(rect())) {
  const lynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const original = lynx.createSelectorQuery
  const calls: string[] = []
  lynx.createSelectorQuery = () => ({ select: (selector: string) => ({ invoke: (options: any) => {
    calls.push(selector)
    respond(selector, options.success)
    return { exec() {} }
  } }) })
  restores.push(() => { lynx.createSelectorQuery = original })
  return calls
}
function model(initial = true) {
  const value = ref(initial)
  const updates = vi.fn((next: boolean) => { value.value = next })
  return { value, updates }
}
const confirmButton = (container: Element) => container.querySelector('.wd-dialog__actions-btn--confirm')!
const popup = (container: Element) => container.querySelector('.wd-popup.wd-transition')

/** Independent behavioral contracts, not a declaration-only parity audit. */
describe('wot 2.3.2 overlays — additional behavior', () => {
  it('overlay emits click with no payload, native tap once, and ordered transition lifecycle', async () => {
    const click = vi.fn(), tap = vi.fn()
    const lifecycle: string[] = []
    const events = Object.fromEntries(['BeforeEnter', 'Enter', 'AfterEnter', 'BeforeLeave', 'Leave', 'AfterLeave'].map((name) => [`on${name}`, () => lifecycle.push(name)]))
    const mounted = mount(Overlay, { show: false, zIndex: 876, duration: { enter: 20, leave: 40 }, lockScroll: true, customStyle: 'opacity: 0.7; padding-top: 9px', onClick: click, onTap: tap, ...events }, { default: () => h('text', { class: 'mask-content' }, 'mask slot') })
    expect(hidden(mounted.container.querySelector('.wd-overlay'))).toBe(true)
    mounted.props.value.show = true
    await frames(4)
    const mask = mounted.container.querySelector('.wd-overlay')!
    expect(mask.getAttribute('style')).toContain('z-index: 876')
    expect(mask.getAttribute('style')).toContain('padding-top: 9px')
    expect(mask.textContent).toContain('mask slot')
    fireEvent.tap(mask, { detail: { source: 'native' } })
    expect(click.mock.calls).toEqual([[]])
    expect(tap).toHaveBeenCalledOnce()
    expect(tap.mock.calls[0][0].detail).toEqual({ source: 'native' })
    expect(lifecycle).toEqual(['BeforeEnter', 'Enter', 'AfterEnter'])
    mounted.props.value.show = false
    await frames(5)
    expect(lifecycle).toEqual(['BeforeEnter', 'Enter', 'AfterEnter', 'BeforeLeave', 'Leave', 'AfterLeave'])
    expect(hidden(mounted.container.querySelector('.wd-overlay'))).toBe(true)
  })

  it.each([['center', 'zoom-in'], ['top', 'slide-down'], ['bottom', 'slide-up'], ['left', 'slide-left'], ['right', 'slide-right']])('popup %s applies position and native transition classes', async (position, transition) => {
    const mounted = mount(Popup, { modelValue: true, position, duration: 500, round: true, modal: false })
    await frames(2)
    expect(popup(mounted.container)!.className).toContain(`wd-popup--${position}`)
    expect(popup(mounted.container)!.className).toContain(`wd-transition--${transition}-enter-active`)
    expect(popup(mounted.container)!.className).toContain('is-round')
    expect(mounted.container.querySelector('.wd-overlay')).toBeNull()
  })

  it('popup modal tap reports without closing, then closes in official event order when enabled', async () => {
    configureUniAdapter({ getSystemInfoSync: () => ({ safeAreaInsets: { bottom: 27 } }) })
    const events: any[] = []
    const visible = model()
    const mounted = mount(Popup, { modelValue: visible.value.value, closeOnClickModal: false, safeAreaInsetBottom: true, customStyle: 'border-radius: 17px', modalStyle: { opacity: '0.2' }, duration: 30,
      onClickModal: () => events.push(['modal']), onClose: () => events.push(['close']), 'onUpdate:modelValue': (v: boolean) => { visible.updates(v); mounted.props.value.modelValue = v; events.push(['update', v]) }
    }, { default: () => h('text', null, 'popup body') })
    await frames()
    expect(popup(mounted.container)!.getAttribute('style')).toContain('padding-bottom: 27px')
    expect(popup(mounted.container)!.getAttribute('style')).toContain('border-radius: 17px')
    expect(mounted.container.querySelector('.wd-overlay')!.getAttribute('style')).toContain('opacity: 0.2')
    fireEvent.tap(mounted.container.querySelector('.wd-overlay')!)
    expect(events).toEqual([['modal']])
    mounted.props.value.closeOnClickModal = true
    mounted.props.value.safeAreaInsetBottom = false
    await nextTick()
    expect(popup(mounted.container)!.getAttribute('style')).toContain('padding-bottom: 0px')
    fireEvent.tap(mounted.container.querySelector('.wd-overlay')!)
    expect(events).toEqual([['modal'], ['modal'], ['close'], ['update', false]])
    await frames(4)
    expect(popup(mounted.container)).toBeNull()
  })

  it('popup lazyRender=false and hideWhenClose=false retain slots while the close icon emits a controlled update', async () => {
    const updates = vi.fn()
    const mounted = mount(Popup, { modelValue: false, lazyRender: false, hideWhenClose: false, closable: true, duration: 20, 'onUpdate:modelValue': (v: boolean) => { updates(v); mounted.props.value.modelValue = v } }, { default: () => h('text', { class: 'retained-slot' }, 'retained') })
    expect(mounted.container.querySelector('.retained-slot')).not.toBeNull()
    mounted.props.value.modelValue = true
    await frames()
    fireEvent.tap(mounted.container.querySelector('.wd-popup__close')!)
    await frames()
    expect(updates.mock.calls).toEqual([[false]])
    expect(hidden(popup(mounted.container))).toBe(true)
    expect(mounted.container.querySelector('.retained-slot')).not.toBeNull()
  })

  it('action-sheet blocks disabled/loading items, scrolls natively and emits exact selected payload before update', async () => {
    const events: any[] = []
    const actions = [{ name: 'disabled', disabled: true }, { name: 'loading', loading: true }, { name: 'enabled', description: 'details', color: 'red' }]
    const mounted = mount(ActionSheet, { modelValue: true, title: 'Actions', actions, duration: 30, onSelect: (e: any) => events.push(['select', e]), 'onUpdate:modelValue': (v: boolean) => events.push(['update', v]) })
    await frames()
    const list = mounted.container.querySelector('.wd-action-sheet__actions')!
    expect(list.tagName.toLowerCase()).toBe('scroll-view')
    expect(list.getAttribute('scroll-y')).toBe('true')
    expect(list.getAttribute('style')).toContain(`max-height: ${getSystemInfo().windowHeight / 2}px`)
    const items = list.querySelectorAll('.wd-action-sheet__action')
    fireEvent.tap(items[0]); fireEvent.tap(items[1])
    expect(events).toEqual([])
    expect(items[2].getAttribute('style')).toContain('color: red')
    mounted.props.value.actions[2].color = undefined
    await nextTick()
    expect(items[2].getAttribute('style')).not.toContain('color: red')
    fireEvent.tap(items[2])
    expect(events).toEqual([['select', { item: mounted.props.value.actions[2], index: 2 }], ['update', false]])
  })

  it.each([false, true])('action-sheet %s-dimensional panels normalize payloads and do not close when disabled by option', async (twoDimensional) => {
    const first = { icon: 'share', title: 'first' }, second = { icon: 'star', title: 'second' }
    const select = vi.fn(), update = vi.fn()
    const mounted = mount(ActionSheet, { modelValue: true, panels: twoDimensional ? [[first], [second]] : [first, second], closeOnClickAction: false, duration: 20, onSelect: select, 'onUpdate:modelValue': update })
    await frames()
    const panels = mounted.container.querySelectorAll('.wd-action-sheet__panel')
    fireEvent.tap(panels[1])
    expect(select.mock.calls).toEqual([[twoDimensional ? { item: second, rowIndex: 1, colIndex: 0 } : { item: second, index: 1 }]])
    expect(update).not.toHaveBeenCalled()
    expect(mounted.container.querySelector('.wd-action-sheet__panels-content')!.tagName.toLowerCase()).toBe('scroll-view')
  })

  it('action-sheet instance open, scoped close slot, cancel and default slot remain functional', async () => {
    const events: any[] = []
    const mounted = mount(ActionSheet, { modelValue: false, title: 'slot sheet', cancelText: 'Cancel', duration: 20, onCancel: () => events.push(['cancel']), onClose: () => events.push(['close']), 'onUpdate:modelValue': (v: boolean) => { events.push(['update', v]); mounted.props.value.modelValue = v } }, {
      close: ({ close }: any) => h('view', { class: 'custom-sheet-close', onTap: close }, [h('text', null, 'close')]),
      default: () => h('text', { class: 'custom-sheet-body' }, 'custom')
    })
    mounted.exposed.value.open(); await frames()
    expect(mounted.container.querySelector('.custom-sheet-body')!.textContent).toBe('custom')
    fireEvent.tap(mounted.container.querySelector('.wd-action-sheet__cancel')!)
    expect(events).toEqual([['update', true], ['cancel'], ['update', false]])
    mounted.exposed.value.open(); await frames()
    fireEvent.tap(mounted.container.querySelector('.custom-sheet-close')!)
    expect(events.slice(-2)).toEqual([['update', false], ['close']])
  })

  it('dialog confirm resolves promptly and the 200ms leave finishes after, not before, its animation', async () => {
    const mounted = mount(Dialog, { selector: 'timed-dialog' })
    const result = mounted.exposed.value.alert({ title: 'Notice', msg: 'message', icon: 'success' })
    await frames(4)
    expect(mounted.container.querySelector('.wd-dialog__icon')!.className).toContain('wd-icon-check-circle-fill')
    expect(mounted.container.querySelector('.wd-dialog__content')!.tagName.toLowerCase()).toBe('scroll-view')
    fireEvent.tap(confirmButton(mounted.container))
    await expect(result).resolves.toEqual({ action: 'confirm', value: '' })
    await frames(2)
    expect(popup(mounted.container)!.className).toContain('leave-active')
    await pause(300)
    expect(popup(mounted.container)).toBeNull()
  })

  it('dialog prompt validates, beforeConfirm(false) blocks, approval returns current edited input', async () => {
    let allow: (v: boolean) => void = () => {}
    const before = vi.fn(() => new Promise<boolean>((resolve) => { allow = resolve }))
    const mounted = mount(Dialog)
    const result = mounted.exposed.value.prompt({ title: 'Prompt', inputValue: 'bad', inputPattern: /^ok/, inputError: 'invalid', beforeConfirm: before })
    await frames(2)
    fireEvent.tap(confirmButton(mounted.container)); await nextTick()
    expect(mounted.container.querySelector('.wd-dialog__input-error')!.textContent).toBe('invalid')
    expect(before).not.toHaveBeenCalled()
    fireEvent.input(mounted.container.querySelector('input')!, { detail: { value: 'okay' } })
    await nextTick()
    fireEvent.tap(confirmButton(mounted.container)); allow(false); await nextTick()
    expect(before).toHaveBeenLastCalledWith('okay')
    expect(popup(mounted.container)).not.toBeNull()
    fireEvent.tap(confirmButton(mounted.container))
    fireEvent.input(mounted.container.querySelector('input')!, { detail: { value: 'ok-final' } })
    await nextTick(); allow(true)
    await expect(result).resolves.toEqual({ action: 'confirm', value: 'ok-final' })
  })

  it('dialog pending approval cannot close a newer dialog or emit a result after unmount', async () => {
    const approvals: Array<(v: boolean) => void> = []
    const mounted = mount(Dialog)
    mounted.exposed.value.confirm({ title: 'old', beforeConfirm: () => new Promise<boolean>((resolve) => approvals.push(resolve)) })
    await frames(2); fireEvent.tap(confirmButton(mounted.container))
    mounted.exposed.value.alert({ title: 'new' })
    approvals[0](true); await frames(2)
    expect(mounted.container.textContent).toContain('new')
    expect(hidden(popup(mounted.container))).toBe(false)
    const retained = mounted.exposed.value
    retained.confirm({ title: 'unmount', beforeConfirm: () => new Promise<boolean>((resolve) => approvals.push(resolve)) })
    await frames(2); fireEvent.tap(confirmButton(mounted.container))
    cleanup(); approvals[1](true); retained.alert('late'); await frames(2)
    expect(mounted.container.textContent).not.toContain('late')
  })

  it('dialog custom actions forward host open-type callbacks and cannot close a dialog opened in action.click', async () => {
    const authorized = vi.fn()
    configureUniAdapter({ openType: (options: any) => options.success({ detail: { name: 'user' } }) })
    const mounted = mount(Dialog)
    const result = mounted.exposed.value.alert({ actions: [{ text: 'Authorize', openType: 'getUserInfo', onGetuserinfo: authorized }] })
    await frames(2); fireEvent.tap(mounted.container.querySelector('.wd-dialog__actions .wd-button')!)
    await expect(result).resolves.toEqual({ action: 'confirm', value: '' })
    expect(authorized).toHaveBeenCalledExactlyOnceWith({ detail: { name: 'user' } })
    mounted.exposed.value.alert({ actions: [{ text: 'replace', click: () => mounted.exposed.value.alert('replacement') }] })
    await frames(2); fireEvent.tap(mounted.container.querySelector('.wd-dialog__actions .wd-button')!)
    await frames(2)
    expect(mounted.container.textContent).toContain('replacement')
    expect(hidden(popup(mounted.container))).toBe(false)
  })

  it('useDialog cancellation rejects exact action and stale success cannot close a new request', async () => {
    let api: ReturnType<typeof useDialog>, option: any
    const Consumer = { setup() { option = inject(getDialogDefaultOptionKey('hook-dialog')); return () => h(Dialog, { selector: 'hook-dialog' }) } }
    const mounted = render({ setup() { api = useDialog('hook-dialog'); return () => h('view', null, [h(Consumer)]) } } as any)
    const canceled = api!.confirm({ title: 'Cancel' }).catch((e) => e)
    await frames(2)
    fireEvent.tap(mounted.container.querySelector('.wd-dialog__actions .wd-button:not(.wd-dialog__actions-btn--confirm)')!)
    expect(await canceled).toEqual({ action: 'cancel' })
    const old = api!.alert('old')
    const success = option.value.success
    api!.alert('new'); success({ action: 'confirm', value: '' }); await old; await frames(2)
    expect(option.value.show).toBe(true)
    expect(mounted.container.textContent).toContain('new')
    cleanup(); const snapshot = option.value
    api!.close(); await api!.alert('late')
    expect(option.value).toBe(snapshot)
  })

  it('dialog scoped slots supply live prompt state and action methods', async () => {
    const mounted = mount(Dialog, {}, {
      header: () => h('text', { class: 'dialog-header' }, 'header'),
      image: () => h('text', { class: 'dialog-image-slot' }, 'image slot'),
      title: ({ title }: any) => h('text', { class: 'dialog-title-slot' }, title),
      default: ({ inputValue, type }: any) => h('text', { class: 'dialog-content-slot' }, `${type}:${inputValue}`),
      actions: ({ cancel }: any) => h('view', { class: 'dialog-cancel-slot', onTap: cancel }, [h('text', null, 'cancel')])
    })
    const result = mounted.exposed.value.prompt({ title: 'slot title', inputValue: 12 }).catch((e: any) => e)
    await frames(2)
    expect(mounted.container.querySelector('.dialog-title-slot')!.textContent).toBe('slot title')
    expect(mounted.container.querySelector('.dialog-content-slot')!.textContent).toBe('prompt:12')
    fireEvent.tap(mounted.container.querySelector('.dialog-cancel-slot')!)
    expect(await result).toEqual({ action: 'cancel' })
  })

  it('toast hook selectors isolate timers and a replacement duration=0 cancels the previous timer', async () => {
    let first: ReturnType<typeof useToast>, second: ReturnType<typeof useToast>
    const mounted = render({ setup() { first = useToast('first'); second = useToast('second'); return () => h('view', null, [h(Toast, { selector: 'first' }), h(Toast, { selector: 'second' })]) } } as any)
    first!.show({ msg: 'old', duration: 80 }); second!.show({ msg: 'second', duration: 80 })
    await frames(1); first!.show({ msg: 'persistent', duration: 0 }); await pause(140)
    const roots = mounted.container.querySelectorAll('.wd-toast')
    expect(roots[0].textContent).toContain('persistent')
    expect(hidden(roots[0].parentElement)).toBe(false)
    await settled()
    expect(hidden(roots[1].parentElement)).toBe(true)
    first!.close(); await settled()
    expect(hidden(roots[0].parentElement)).toBe(true)
  })

  it('toast loading cover, vertical layout, native pixel positions and transition callbacks apply', async () => {
    let api: ReturnType<typeof useToast>
    const opened = vi.fn(), closed = vi.fn()
    const mounted = render({ setup() { api = useToast('styled-toast'); return () => h('view', null, [h(Toast, { selector: 'styled-toast', position: 'bottom' })]) } } as any)
    api!.loading({ msg: 'loading', direction: 'vertical', iconSize: 30, loadingSize: 28, opened, closed })
    await settled()
    const root = mounted.container.querySelector('.wd-toast')!
    expect(root.className).toContain('is-vertical')
    expect(root.getAttribute('style')).toContain(`${getSystemInfo().windowHeight * 0.4}px`)
    expect(mounted.container.querySelector('.wd-overlay')!.getAttribute('style')).toContain('background-color: transparent')
    expect(mounted.container.querySelector('.wd-loading')).not.toBeNull()
    expect(opened).toHaveBeenCalledOnce()
    const css = readFileSync(path.resolve(__dirname, '../src/components/wd-toast/index.css'), 'utf8')
    const rule = css.match(/\.wd-toast--with-icon\{([^}]*)\}/)![1]
    expect(rule).not.toContain('flex-direction:row')
    api!.close(); await settled(); expect(closed).toHaveBeenCalledOnce()
  })

  it('toast retained hook calls do not mutate injected state after unmount', async () => {
    let api: ReturnType<typeof useToast>, option: any
    const Consumer = { setup() { option = inject(getToastOptionKey('retained')); return () => h(Toast, { selector: 'retained' }) } }
    render({ setup() { api = useToast('retained'); return () => h('view', null, [h(Consumer)]) } } as any)
    api!.show({ msg: 'before', duration: 40 }); const snapshot = option.value; cleanup()
    api!.show('after'); api!.close(); await pause(80)
    expect(option.value).toBe(snapshot)
  })

  it('notify consumes options set before child mount, closes shared state and resets prior callbacks/styles', async () => {
    let api: ReturnType<typeof useNotify>, option: any
    const clicked = vi.fn(), taps = vi.fn(), opened = vi.fn(), closed = vi.fn()
    const Consumer = { setup() { option = inject(getNotifyOptionKey('notify')); return () => h(Notify, { selector: 'notify', onTap: taps }) } }
    const mounted = render({ setup() { api = useNotify('notify'); api.showNotify({ message: 'initial', duration: 0, closable: true, safeHeight: 44, color: 'red', background: 'yellow', variant: 'floating', customClass: 'request-notify', onClick: clicked, onOpened: opened, onClosed: closed }); return () => h('view', null, [h(Consumer)]) } } as any)
    await frames(2)
    expect(mounted.container.querySelector('.wd-notify')!.textContent).toContain('initial')
    expect(mounted.container.querySelector('.request-notify')).not.toBeNull()
    expect(opened).toHaveBeenCalledOnce()
    expect(popup(mounted.container)!.getAttribute('style')).toContain('padding-top: 44px')
    fireEvent.tap(mounted.container.querySelector('.wd-notify')!)
    expect(clicked).toHaveBeenCalledOnce(); expect(taps).toHaveBeenCalledOnce()
    fireEvent.tap(mounted.container.querySelector('.wd-notify__close')!); await nextTick()
    expect(option.value.visible).toBe(false)
    expect(closed).toHaveBeenCalledOnce()
    api!.showNotify({ message: 'new', duration: 0 }); await frames(2)
    expect(popup(mounted.container)!.getAttribute('style')).toContain('padding-top: 0px')
    expect(mounted.container.querySelector('.wd-notify')!.getAttribute('style') || '').not.toContain('color: red')
    expect(mounted.container.querySelector('.request-notify')).toBeNull()
    fireEvent.tap(mounted.container.querySelector('.wd-notify')!)
    expect(clicked).toHaveBeenCalledOnce()
  })

  it('notify instance timers cancel on reopen and custom props update rootPortal without resetting the message', async () => {
    const mounted = mount(Notify)
    mounted.exposed.value.showNotify({ message: 'short', duration: 60 }); await frames(1)
    mounted.exposed.value.showNotify({ message: 'persistent', duration: 0, closable: true }); await frames(1)
    mounted.props.value.rootPortal = true; await frames(2)
    expect(mounted.container.textContent).toContain('persistent')
    expect(mounted.container.querySelector('.wd-root-portal')).not.toBeNull()
    await pause(80)
    expect(hidden(popup(mounted.container))).toBe(false)
    mounted.exposed.value.closeNotify(); await settled()
    expect(hidden(popup(mounted.container))).toBe(true)
  })

  it('notify global defaults reset and same-selector replacement never leaks prior timers', async () => {
    let api: ReturnType<typeof useNotify>
    setNotifyDefaultOptions({ type: 'success', duration: 0, safeHeight: 23 })
    const mounted = render({ setup() { api = useNotify('defaults'); return () => h('view', null, [h(Notify, { selector: 'defaults' })]) } } as any)
    api!.showNotify('success'); await frames(2)
    expect(mounted.container.querySelector('.wd-notify--success')).not.toBeNull()
    resetNotifyDefaultOptions()
    api!.showNotify({ message: 'brief', duration: 70 }); await frames(1)
    api!.showNotify({ message: 'default-danger', duration: 0 }); await pause(120)
    expect(mounted.container.querySelector('.wd-notify--danger')).not.toBeNull()
    expect(hidden(popup(mounted.container))).toBe(false)
    expect(popup(mounted.container)!.getAttribute('style')).toContain('padding-top: 0px')
  })

  it.each([['popover', Popover], ['tooltip', Tooltip]])('%s honors disabled target/close icon but imperative methods and outside close remain usable', async (name, component) => {
    mockRects()
    const updates = vi.fn(), changed = vi.fn(), open = vi.fn(), close = vi.fn()
    const mounted = mount(component, { modelValue: true, disabled: true, showClose: true, content: 'content', 'onUpdate:modelValue': updates, onChange: changed, onOpen: open, onClose: close })
    await frames(2)
    fireEvent.tap(mounted.container.querySelector(`.wd-${name}__target`)!)
    fireEvent.tap(mounted.container.querySelector(`.wd-${name}__close-icon`)!)
    expect(updates).not.toHaveBeenCalled()
    mounted.exposed.value.close(); await frames(1)
    expect(updates.mock.calls).toEqual([[false]])
    expect(changed).toHaveBeenCalledWith({ show: false })
    expect(close).toHaveBeenCalledOnce()
    mounted.exposed.value.open(); await frames(1)
    expect(open).toHaveBeenCalledOnce()
    fireEvent.tap(mounted.container.querySelector(`.wd-${name}__backdrop`)!); await frames(1)
    expect(updates.mock.calls).toEqual([[false], [true], [false]])
    expect(close).toHaveBeenCalledTimes(2)
  })

  it('popover menu payload and custom content positioning update across placement/arrow changes', async () => {
    const calls = mockRects((selector, success) => success(selector.endsWith('-target') ? rect(0, 0, 80, 40) : rect(0, 0, 120, 60)))
    const item = { content: 'choose', iconClass: 'share' }, menuclick = vi.fn()
    const mounted = mount(Popover, { modelValue: true, mode: 'menu', content: [item], placement: 'bottom', onMenuclick: menuclick })
    await settled()
    fireEvent.tap(mounted.container.querySelector('.wd-transition .wd-popover__menu-inner')!)
    expect(menuclick).toHaveBeenCalledExactlyOnceWith({ item, index: 0 })
    mounted.exposed.value.open(); mounted.props.value.placement = 'left-start'; mounted.props.value.visibleArrow = false; mounted.props.value.offset = [10, 0]
    await frames(3); await mounted.exposed.value.updatePosition(); await nextTick()
    const style = mounted.container.querySelector('.wd-popover__pos.wd-transition')!.getAttribute('style')!
    expect(style).toContain('right: 85px')
    expect(style).not.toContain('left: 40px')
    expect(mounted.container.querySelector('.wd-transition .wd-popover__arrow')).toBeNull()
    expect(calls.some((selector) => selector.endsWith('-content'))).toBe(true)
  })

  it('popover and tooltip content slots render and opening one closes the other queue entry', async () => {
    mockRects()
    const pop = ref<any>(), tip = ref<any>()
    const mounted = render({ setup: () => () => h('view', null, [h(Popover, { ref: pop, content: '' }, { content: () => h('text', { class: 'custom-popover' }, 'custom pop'), default: () => h('text', null, 'target') }), h(Tooltip, { ref: tip }, { content: () => h('text', { class: 'custom-tooltip' }, 'custom tip') })]) } as any)
    pop.value.open(); await frames(2)
    expect(mounted.container.querySelector('.custom-popover')!.textContent).toBe('custom pop')
    tip.value.open(); await frames(2)
    expect(mounted.container.querySelector('.wd-popover__backdrop')).toBeNull()
    expect(mounted.container.querySelector('.wd-tooltip__backdrop')).not.toBeNull()
    expect(mounted.container.querySelector('.custom-tooltip')!.textContent).toBe('custom tip')
    cleanup(); pop.value?.open(); tip.value?.updatePosition()
  })

  it('curtain image load derives aspect ratio, handles malformed native sizes, and clicks navigate/close once', async () => {
    const navigate = vi.fn(), click = vi.fn(), load = vi.fn(), error = vi.fn(), close = vi.fn()
    configureUniAdapter({ navigateTo: navigate })
    const mounted = mount(Curtain, { modelValue: true, src: 'https://example.com/a.png', width: 200, to: '/target', closeOnClick: false, onClick: click, onLoad: load, onError: error, onClose: close, 'onUpdate:modelValue': (v: boolean) => { mounted.props.value.modelValue = v } })
    await frames(2)
    const image = mounted.container.querySelector('image.wd-curtain__content-img')!
    fireEvent(image, new (globalThis as any).lynxTestingEnv.jsdom.window.CustomEvent('bindEvent:load', { detail: { width: 400, height: 200 } }))
    await nextTick()
    expect(image.getAttribute('style')).toContain('height: 100px')
    fireEvent(image, new (globalThis as any).lynxTestingEnv.jsdom.window.CustomEvent('bindEvent:load', { detail: { width: 0, height: 0 } }))
    await nextTick(); expect(image.getAttribute('style')).not.toMatch(/NaN|Infinity/)
    expect(load.mock.calls).toEqual([[], []])
    fireEvent(image, new (globalThis as any).lynxTestingEnv.jsdom.window.Event('bindEvent:error'))
    expect(error.mock.calls).toEqual([[]])
    fireEvent.tap(image)
    expect(click.mock.calls).toEqual([[]]); expect(navigate).toHaveBeenCalledExactlyOnceWith({ url: '/target' })
    expect(close).not.toHaveBeenCalled()
    mounted.props.value.closeOnClick = true; await nextTick(); fireEvent.tap(image); await nextTick()
    expect(close).toHaveBeenCalledOnce()
  })

  it('curtain legacy value, modal suppression and official leave/closed lifecycle preserve names and order', async () => {
    const events: string[] = []
    const mounted = mount(Curtain, { value: true, src: 'a.png', closeOnClickModal: false, onClickModal: () => events.push('modal'), onClose: () => events.push('close'), onBeforeleave: () => events.push('beforeleave'), onLeave: () => events.push('leave'), onAfterleave: () => events.push('afterleave'), onClosed: () => events.push('closed') })
    await settled(); fireEvent.tap(mounted.container.querySelector('.wd-overlay')!); expect(events).toEqual(['modal'])
    mounted.props.value.value = false; await settled()
    expect(events).toEqual(['modal', 'close', 'beforeleave', 'leave', 'afterleave', 'closed'])
    expect(hidden(popup(mounted.container))).toBe(true)
  })

  it('image preview undefined options restore props; emitted objects and explicit kebab callback props each run once', async () => {
    const changed = vi.fn(), callback = vi.fn(), longpress = vi.fn(), longCallback = vi.fn(), opened = vi.fn(), closed = vi.fn()
    const mounted = mount(ImagePreview, { images: ['a.png', 'b.png'], zIndex: 654, showIndex: true, closeOnClick: false, onChange: changed, 'on-change': callback, onLongPress: longpress, 'on-long-press': longCallback, onOpen: opened, onClose: closed })
    mounted.exposed.value.open({ closeable: undefined, showIndex: undefined, loop: undefined, zIndex: undefined })
    await frames(3)
    expect(mounted.container.querySelector('.wd-image-preview__close')).not.toBeNull()
    expect(mounted.container.querySelector('.wd-overlay')!.getAttribute('style')).toContain('z-index: 654')
    mounted.exposed.value.setActive(1); await frames(2)
    expect(changed).toHaveBeenCalledExactlyOnceWith({ index: 1 })
    expect(callback).toHaveBeenCalledExactlyOnceWith(1)
    fireEvent.longpress(mounted.container.querySelectorAll('.wd-swiper__image')[1])
    expect(longpress).toHaveBeenCalledExactlyOnceWith({ image: 'b.png' })
    expect(longCallback).toHaveBeenCalledExactlyOnceWith('b.png')
    expect(opened).toHaveBeenCalledOnce()
    fireEvent.tap(mounted.container.querySelector('.wd-overlay')!); await nextTick(); expect(closed).not.toHaveBeenCalled()
    mounted.exposed.value.close(); await nextTick(); expect(closed).toHaveBeenCalledOnce()
  })

  it('image preview reopens during leave without clearing newer media, validates setActive, and close slot works', async () => {
    const changed = vi.fn(), callback = vi.fn()
    const mounted = mount(ImagePreview, { onChange: changed }, { close: ({ close }: any) => h('view', { class: 'preview-close-slot', onTap: close }) })
    const first = ['old.png']; mounted.exposed.value.open(first); await frames(2)
    first.push('mutated.png')
    expect(mounted.container.querySelectorAll('.wd-swiper__image')).toHaveLength(1)
    mounted.exposed.value.close(); await frames(1)
    mounted.exposed.value.open({ images: ['new.png', 'next.png'], onChange: callback, closeOnClick: false }); await settled()
    expect(mounted.container.querySelectorAll('.wd-swiper__image')).toHaveLength(2)
    expect(mounted.container.querySelector('.wd-swiper__image')!.getAttribute('src')).toBe('new.png')
    mounted.exposed.value.setActive(-1); mounted.exposed.value.setActive(0.5); mounted.exposed.value.setActive(99); await frames(1)
    expect(callback).not.toHaveBeenCalled()
    mounted.exposed.value.setActive(1); await frames(2)
    expect(callback).toHaveBeenCalledExactlyOnceWith(1); expect(changed).toHaveBeenCalledExactlyOnceWith({ index: 1 })
    fireEvent.tap(mounted.container.querySelector('.preview-close-slot')!); await settled()
    expect(mounted.container.querySelector('.wd-swiper')).toBeNull()
  })

  it('video preview restores undefined options, forwards media attributes, requests host fullscreen and closes on exit', async () => {
    const requestFullScreen = vi.fn(), factory = vi.fn(() => ({ requestFullScreen })), opened = vi.fn(), closed = vi.fn()
    configureUniAdapter({ createVideoContext: factory })
    const mounted = mount(VideoPreview, { zIndex: 543, fullScreen: true, closePosition: 'right-top', onOpen: opened, onClose: closed })
    mounted.exposed.value.open({ url: 'a.mp4', poster: 'a.png', title: 'Title', zIndex: undefined, fullScreen: undefined, closePosition: undefined, onOpen: opened, onClose: closed })
    await frames(3)
    expect(opened).toHaveBeenCalledOnce()
    expect(mounted.container.querySelector('.wd-overlay')!.getAttribute('style')).toContain('z-index: 543')
    expect(mounted.container.querySelector('.wd-video-preview__close.is-right-top')).not.toBeNull()
    const video = mounted.container.querySelector('video')!
    expect(video.getAttribute('src')).toBe('a.mp4'); expect(video.getAttribute('poster')).toBe('a.png'); expect(video.getAttribute('title')).toBe('Title')
    expect(factory).toHaveBeenCalledOnce(); expect(factory.mock.calls[0][0]).toBe(video.id)
    expect(requestFullScreen).toHaveBeenCalledExactlyOnceWith({ direction: 0 })
    fireEvent(video, new (globalThis as any).lynxTestingEnv.jsdom.window.CustomEvent('bindEvent:fullscreenchange', { detail: { fullScreen: false } }))
    await nextTick(); expect(closed).toHaveBeenCalledOnce(); await settled()
    expect(mounted.container.querySelector('video')).toBeNull()
  })

  it('video preview close/reopen keeps the latest resource and cancels retained instance calls on unmount', async () => {
    const mounted = mount(VideoPreview)
    mounted.exposed.value.open({ url: 'old.mp4' }); await frames(2)
    mounted.exposed.value.close(); await frames(1); mounted.exposed.value.open({ url: 'new.mp4' }); await settled()
    expect(mounted.container.querySelector('video')!.getAttribute('src')).toBe('new.mp4')
    const retained = mounted.exposed.value
    cleanup(); retained.open({ url: 'late.mp4' }); retained.close(); await frames(2)
    expect(mounted.container.querySelector('video')).toBeNull()
  })

  it('preview hooks initialize before children mount, isolate selectors, and ignore retained calls after unmount', async () => {
    let imageApi: ReturnType<typeof useImagePreview>, videoApi: ReturnType<typeof useVideoPreview>, imageOption: any, videoOption: any
    const Consumer = { setup() { imageOption = inject(getImagePreviewOptionKey('image-hook')); videoOption = inject(getVideoPreviewOptionKey('video-hook')); return () => [h(ImagePreview, { selector: 'image-hook' }), h(VideoPreview, { selector: 'video-hook' })] } }
    const mounted = render({ setup() { imageApi = useImagePreview('image-hook'); videoApi = useVideoPreview('video-hook'); imageApi.previewImage(['hook.png']); videoApi.previewVideo({ url: 'hook.mp4' }); return () => h('view', null, [h(Consumer)]) } } as any)
    await frames(3)
    expect(mounted.container.querySelector('.wd-swiper__image')!.getAttribute('src')).toBe('hook.png')
    expect(mounted.container.querySelector('video')!.getAttribute('src')).toBe('hook.mp4')
    const imageSnapshot = imageOption.value, videoSnapshot = videoOption.value
    cleanup(); imageApi!.previewImage(['late.png']); videoApi!.previewVideo({ url: 'late.mp4' }); imageApi!.closeImagePreview(); videoApi!.closeVideoPreview()
    expect(imageOption.value).toBe(imageSnapshot); expect(videoOption.value).toBe(videoSnapshot)
  })

  it('tour exact navigation payloads, mask-next, custom text, geometry and finish update remain functional', async () => {
    mockRects((selector, success) => success(selector === '.one' ? rect(20, 100, 100, 40) : rect(40, 500, 60, 30)))
    const next = vi.fn(), prev = vi.fn(), change = vi.fn(), finish = vi.fn()
    const mounted = mount(Tour, { modelValue: true, steps: [{ element: '.one', content: 'one', placement: 'bottom', padding: 4, offset: 12 }, { element: '.two', content: 'two', placement: 'top' }], nextText: 'Continue', finishText: 'Done', clickMaskNext: true, zIndex: 600, onNext: next, onPrev: prev, onChange: change, onFinish: finish, 'onUpdate:modelValue': (v: boolean) => { mounted.props.value.modelValue = v } })
    await frames(3)
    const highlight = mounted.container.querySelector('.wd-tour__highlight')!
    expect(highlight.getAttribute('style')).toContain('top: 96px')
    expect(mounted.container.querySelector('.wd-tour__popover')!.getAttribute('style')).toContain('top: 152px')
    expect(mounted.container.textContent).toContain('Continue(1/2)')
    fireEvent.tap(mounted.container.querySelector('.wd-tour__mask')!); await frames(3)
    expect(next).toHaveBeenCalledExactlyOnceWith({ prevCurrent: 0, current: 1, total: 2, isElementInTop: true })
    expect(change).toHaveBeenCalledExactlyOnceWith({ current: 1 })
    const popStyle = mounted.container.querySelector('.wd-tour__popover')!.getAttribute('style')!
    expect(popStyle).toContain('top: auto'); expect(popStyle).toContain(`bottom: ${getSystemInfo().windowHeight - 500 + 20}px`)
    mounted.exposed.value.handlePrev(); await frames(3)
    expect(prev).toHaveBeenCalledExactlyOnceWith({ prevCurrent: 1, current: 0, total: 2, isElementInTop: false })
    mounted.exposed.value.handleNext(); await frames(2); fireEvent.tap(mounted.container.querySelector('.wd-tour__finish')!); await nextTick()
    expect(finish).toHaveBeenCalledExactlyOnceWith({ current: 1, total: 2 })
    expect(mounted.container.querySelector('.wd-tour')).toBeNull()
  })

  it('tour remeasures same-length target replacement and clears mask overrides when toggled off', async () => {
    const calls = mockRects((selector, success) => success(selector === '.old' ? rect(10, 100, 80, 40) : rect(30, 300, 120, 50)))
    const mounted = mount(Tour, { modelValue: true, steps: [{ element: '.old', content: 'old' }], maskColor: 'red' })
    await frames(3)
    expect(mounted.container.querySelector('.wd-tour__highlight')!.getAttribute('style')).toContain('red')
    mounted.props.value.steps = [{ element: '.new', content: 'new' }]; await frames(3)
    expect(calls).toContain('.new')
    expect(mounted.container.querySelector('.wd-tour__highlight')!.getAttribute('style')).toContain('top: 292px')
    mounted.props.value.mask = false; await nextTick()
    expect(mounted.container.querySelector('.wd-tour__highlight')!.getAttribute('style')).not.toContain('red')
  })

  it.each(['stop', 'skip', 'hide'])('tour missingStrategy=%s dispatches error and the documented navigation/visibility result', async (missingStrategy) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRects((selector, success) => success(selector === '.missing' ? rect(0, 0, 0, 0) : rect()))
    const error = vi.fn(), next = vi.fn(), update = vi.fn()
    const mounted = mount(Tour, { modelValue: true, steps: [{ element: '.missing', content: 'missing' }, { element: '.ok', content: 'ok' }], missingStrategy, onError: error, onNext: next, 'onUpdate:modelValue': update })
    await frames(4)
    expect(error).toHaveBeenCalledExactlyOnceWith({ message: '无法找到指定的引导元素', element: '.missing' })
    if (missingStrategy === 'skip') expect(next).toHaveBeenCalledOnce()
    else expect(next).not.toHaveBeenCalled()
    expect(update.mock.calls).toEqual(missingStrategy === 'hide' ? [[false]] : [])
    if (missingStrategy === 'stop') expect(mounted.container.querySelector('.wd-tour__highlight')!.getAttribute('style')).toContain('width: 0px')
  })

  it('tour without page-scroll capability preserves real measured position instead of a predicted destination', async () => {
    mockRects((selector, success) => success(rect(10, 900, 80, 40)))
    const mounted = mount(Tour, { modelValue: true, steps: [{ element: '.offscreen', content: 'offscreen' }] })
    await frames(3)
    expect(mounted.container.querySelector('.wd-tour__highlight')!.getAttribute('style')).toContain('top: 892px')
  })

  it('tour scroll success remeasures target; canceled late measurement cannot overwrite the next step', async () => {
    let scrollOptions: any, scrolled = false
    const late: Array<(rect: any) => void> = []
    configureUniAdapter({ pageScrollTo: (options: any) => { scrollOptions = options } })
    mockRects((selector, success) => {
      if (selector === '.old' && scrolled) late.push(success)
      else success(selector === '.old' ? rect(0, 900, 60, 40) : rect(20, 200, 80, 40))
    })
    const mounted = mount(Tour, { modelValue: true, steps: [{ element: '.old', content: 'old' }, { element: '.new', content: 'new' }] })
    await frames(3); expect(scrollOptions.scrollTop).toBeGreaterThan(0)
    scrolled = true; scrollOptions.success(); mounted.exposed.value.handleNext(); await frames(3)
    late.forEach((resolve) => resolve(rect(0, 1, 10, 10))); await frames(1)
    expect(mounted.container.querySelector('.wd-tour__highlight')!.getAttribute('style')).toContain('top: 192px')
  })

  it('notify standalone auto-dismiss survives unrelated prop updates', async () => {
    const mounted = mount(Notify)
    mounted.exposed.value.showNotify({ message: 'auto-dismiss', duration: 100 })
    await frames(1)
    mounted.props.value.customClass = 'updated-notify'
    await frames(1)
    expect(mounted.container.querySelector('.updated-notify')).not.toBeNull()
    await settled()
    expect(hidden(popup(mounted.container))).toBe(true)
  })

  it('video replacement requests fullscreen and close cancels a queued host request', async () => {
    const requestFullScreen = vi.fn(), factory = vi.fn(() => ({ requestFullScreen }))
    configureUniAdapter({ createVideoContext: factory })
    const mounted = mount(VideoPreview)
    mounted.exposed.value.open({ url: 'normal.mp4', fullScreen: false })
    await frames(2)
    expect(factory).not.toHaveBeenCalled()
    mounted.exposed.value.open({ url: 'fullscreen.mp4', fullScreen: true })
    await nextTick()
    expect(requestFullScreen).toHaveBeenCalledExactlyOnceWith({ direction: 0 })
    mounted.exposed.value.open({ url: 'canceled.mp4', fullScreen: true })
    mounted.exposed.value.close()
    await nextTick()
    expect(requestFullScreen).toHaveBeenCalledOnce()
  })

  it('tour HTML content falls back to decoded readable text, not literal markup', async () => {
    mockRects()
    const mounted = mount(Tour, { modelValue: true, steps: [{ element: '.target', content: '<p>Hello &amp; &#x1F44B;<br>next</p><script>hidden()</script>' }] })
    await frames(3)
    expect(mounted.container.querySelector('.wd-tour__info')!.textContent).toBe('Hello & 👋\nnext')
  })

  it('tour scoped highlight/content/button slots and skipped payload work with hidden buttons', async () => {
    mockRects()
    const skip = vi.fn()
    const mounted = mount(Tour, { modelValue: true, steps: [{ element: '.target', content: 'text' }], showTourButtons: false, onSkip: skip, 'onUpdate:modelValue': (v: boolean) => { mounted.props.value.modelValue = v } }, {
      highlight: ({ elementInfo }: any) => h('text', { class: 'tour-highlight-slot' }, `${elementInfo.width}:${elementInfo.height}`),
      content: () => h('text', { class: 'tour-content-slot' }, 'custom content'), finish: () => h('text', null, 'custom finish')
    })
    await frames(3)
    expect(mounted.container.querySelector('.tour-highlight-slot')!.textContent).toBe('96px:56px')
    expect(mounted.container.querySelector('.tour-content-slot')!.textContent).toBe('custom content')
    expect(mounted.container.querySelector('.wd-tour__buttons')).toBeNull()
    mounted.exposed.value.handleSkip(); await nextTick()
    expect(skip).toHaveBeenCalledExactlyOnceWith({ current: 0, total: 1 })
  })
})

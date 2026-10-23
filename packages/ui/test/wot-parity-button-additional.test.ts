import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from './render'
import { fireEvent } from './fire-event'
import { configureUniAdapter } from '../src/common/uni'
import Button from '../src/primitives/wd-button/wd-button.vue'
import ConfigProvider from '../src/components/wd-config-provider/wd-config-provider.vue'

const restores: Array<() => void> = []
afterEach(() => {
  cleanup()
  restores.splice(0).reverse().forEach((restore) => restore())
  configureUniAdapter({ openType: undefined })
  vi.restoreAllMocks()
})
function mount(initial: Record<string, any> = {}, slots?: any) {
  const props = ref(initial)
  const mounted = render({ setup: () => () => h('view', { class: 'button-test-host' }, [h(Button, props.value, slots)]) } as any)
  return { ...mounted, props, button: () => mounted.container.querySelector('.wd-button') as HTMLElement }
}
const css = () => readFileSync(path.resolve(__dirname, '../src/primitives/wd-button/index.css'), 'utf8')
function rule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css().match(new RegExp(`(?:^|[,}])${escaped}\\{([^{}]*)\\}`))
  expect(match, `compiled selector ${selector}`).not.toBeNull()
  return match![1]
}
/** Execute actual declarative worklet handlers using a deterministic main-thread frame clock. */
function hoverClock() {
  const env = (globalThis as any).lynxTestingEnv
  const mt = env.mainThread.globalThis
  const bg = env.backgroundThread.globalThis
  const originals = [mt.requestAnimationFrame, bg.requestAnimationFrame, (globalThis as any).requestAnimationFrame]
  let now = 1000
  const frames: Array<FrameRequestCallback> = []
  const schedule = (callback: FrameRequestCallback) => { frames.push(callback); return frames.length }
  mt.requestAnimationFrame = schedule
  bg.requestAnimationFrame = schedule
  ;(globalThis as any).requestAnimationFrame = schedule
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  restores.push(() => {
    mt.requestAnimationFrame = originals[0]
    bg.requestAnimationFrame = originals[1]
    ;(globalThis as any).requestAnimationFrame = originals[2]
  })
  return {
    advance(milliseconds: number) {
      now += milliseconds
      const callbacks = frames.splice(0)
      env.switchToMainThread()
      callbacks.forEach((callback) => callback(now))
      env.switchToBackgroundThread()
    },
    count: () => frames.length
  }
}
function hover(element: Element, name: 'touchstart' | 'touchend' | 'touchcancel') {
  fireEvent[name](element, { eventType: 'bindEvent', touches: [{ clientX: 10, clientY: 10 }] })
}
const active = (element: HTMLElement) => element.style.backgroundColor === 'var(--wot-button-current-bg-active)'

/** Behavior and rendering regressions independent of the existing basic/core tests. */
describe('wot 2.3.2 button — additional contracts', () => {
  it('defaults and native text are functional, not declaration-only props', () => {
    const mounted = mount({ text: 'Continue' })
    expect(mounted.button().className).toContain('is-primary')
    expect(mounted.button().className).toContain('is-medium')
    expect(mounted.button().className).not.toMatch(/is-(round|block|disabled|loading)/)
    expect(mounted.container.querySelector('.wd-button__text')!.tagName.toLowerCase()).toBe('view')
    expect(mounted.container.querySelector('.wd-button__text-content')!.tagName.toLowerCase()).toBe('text')
    expect(mounted.container.textContent).toBe('Continue')
  })

  it.each([['mini', 28, 14], ['small', 32, 16], ['medium', 40, 20], ['large', 44, 22]])('%s preserves official height and icon sizing', (size, height, iconSize) => {
    const mounted = mount({ size, icon: 'check', text: 'check' })
    expect(mounted.button().className).toContain(`is-${size}`)
    expect(rule(`.wd-button.is-${size}`)).toContain(`${height}px`)
    expect(rule(`.wd-button.is-${size} .wd-button__icon`)).toContain(`${iconSize}px`)
    expect(mounted.container.querySelector('.wd-button__icon')!.className).toContain('wd-icon-check')
  })

  it.each(['base', 'plain', 'dashed', 'soft', 'subtle', 'text'])('%s draws only outlined variants with a non-layout border overlay', (variant) => {
    const mounted = mount({ variant, hairline: true, round: true, text: 'variant' })
    const border = mounted.container.querySelector('.wd-button__border')
    expect(Boolean(border)).toBe(['plain', 'dashed', 'subtle'].includes(variant))
    expect(rule('.wd-button')).toContain('border:none')
    expect(rule('.wd-button__border')).toContain('position:absolute')
    expect(rule('.wd-button__border')).toContain('width:100%')
    expect(rule('.wd-button__border')).toContain('height:100%')
    expect(rule('.wd-button__border')).toContain('pointer-events:none')
    expect(rule('.wd-button__border')).toContain('border-radius:inherit')
    expect(rule('.wd-button.is-hairline .wd-button__border')).toContain('/2')
    if (variant === 'dashed') expect(rule('.wd-button.is-dashed.is-primary .wd-button__border')).toContain('border-style:dashed')
    expect(css()).not.toMatch(/::(?:before|after)/)
  })

  it('global defaults react, local values override them, and explicit round=false stays false', async () => {
    const config = ref({ size: 'large', type: 'success', variant: 'dashed', round: true })
    const local = ref<Record<string, any>>({ text: 'configured' })
    const mounted = render({ setup: () => () => h(ConfigProvider, { button: config.value }, { default: () => h(Button, local.value) }) } as any)
    const button = mounted.container.querySelector('.wd-button')!
    expect(button.className).toContain('is-large'); expect(button.className).toContain('is-success')
    expect(button.className).toContain('is-dashed'); expect(button.className).toContain('is-round')
    local.value = { text: 'local', size: 'mini', type: 'danger', variant: 'text', round: false, block: true }
    await nextTick()
    expect(button.className).toContain('is-mini'); expect(button.className).toContain('is-danger')
    expect(button.className).toContain('is-text'); expect(button.className).toContain('is-block')
    expect(button.className).not.toContain('is-round')
    expect(rule('.wd-button.is-block')).toContain('width:100%')
    local.value = { text: 'inherit' }; config.value = { size: 'small', type: 'warning', variant: 'plain', round: false }
    await nextTick()
    expect(button.className).toContain('is-small'); expect(button.className).toContain('is-warning')
    expect(button.className).toContain('is-plain'); expect(button.className).not.toContain('is-round')
  })

  it('icon-only, text, CSS icon and arbitrary native default slots share the official content contract', async () => {
    const mounted = mount({ icon: 'check', classPrefix: 'custom', cssIcon: true })
    expect(mounted.button().className).toContain('is-icon')
    expect(mounted.container.querySelector('.wd-button__text')).toBeNull()
    // 官方语义：cssIcon 为 true 时 name 直接作为 CSS class，不再拼接 class-prefix
    expect(mounted.container.querySelector('.wd-button__icon')!.className).toContain('wd-icon--css')
    expect(mounted.container.querySelector('.wd-button__icon')!.className).toContain('check')
    mounted.props.value.text = 'label'; await nextTick()
    expect(mounted.button().className).not.toContain('is-icon')
    expect(mounted.container.textContent).toBe('label')
    const slotted = mount({ text: 'fallback', icon: 'star' }, { default: () => h('view', { class: 'native-button-slot' }, [h('text', null, 'slot label')]) })
    expect(slotted.container.querySelector('.wd-button__text > .native-button-slot')).not.toBeNull()
    // 图标以字体字形 text 渲染，容器 textContent 含私用区码点；只校验文本插槽
    expect(slotted.container.querySelector('.wd-button__text')!.textContent).toBe('slot label')
    expect(slotted.button().className).not.toContain('is-icon')
  })

  it('tap emits each compatibility event exactly once with the same native payload', () => {
    const click = vi.fn(), tap = vi.fn()
    const mounted = mount({ text: 'tap', buttonId: 'privacy-button', onClick: click, onTap: tap })
    expect(mounted.button().id).toBe('privacy-button')
    fireEvent.tap(mounted.button(), { detail: { native: 'payload' } })
    expect(click).toHaveBeenCalledOnce(); expect(tap).toHaveBeenCalledOnce()
    expect(click.mock.calls[0][0]).toBe(tap.mock.calls[0][0])
    expect(click.mock.calls[0][0].detail).toEqual({ native: 'payload' })
  })

  it.each(['disabled', 'loading'])('%s blocks tap, open-type host requests and native hover styling', (property) => {
    const clock = hoverClock(), click = vi.fn(), tap = vi.fn(), host = vi.fn()
    configureUniAdapter({ openType: host })
    const mounted = mount({ [property]: true, openType: 'getUserInfo', hoverStartTime: 0, onClick: click, onTap: tap })
    fireEvent.tap(mounted.button()); hover(mounted.button(), 'touchstart'); clock.advance(200)
    expect(click).not.toHaveBeenCalled(); expect(tap).not.toHaveBeenCalled(); expect(host).not.toHaveBeenCalled()
    expect(active(mounted.button())).toBe(false)
  })

  it('hoverStartTime and hoverStayTime apply on the main thread and release clears root/border styles', () => {
    const clock = hoverClock(), mounted = mount({ variant: 'plain', hoverStartTime: 40, hoverStayTime: 90 })
    const button = mounted.button(), border = mounted.container.querySelector('.wd-button__border') as HTMLElement
    hover(button, 'touchstart')
    clock.advance(39); expect(active(button)).toBe(false)
    clock.advance(1); expect(active(button)).toBe(true)
    expect(button.style.color).toBe('var(--wot-button-current-text-active)')
    expect(border.style.borderColor).toBe('var(--wot-button-plain-border-active)')
    hover(button, 'touchend'); clock.advance(89); expect(active(button)).toBe(true)
    clock.advance(1); expect(active(button)).toBe(false)
    expect(button.style.color).toBe(''); expect(border.style.borderColor).toBe('')
  })

  it('short touches and touchcancel never leave a stuck hover or late delayed activation', () => {
    const clock = hoverClock(), mounted = mount({ hoverStartTime: 30, hoverStayTime: 100 })
    hover(mounted.button(), 'touchstart'); clock.advance(10); hover(mounted.button(), 'touchend'); clock.advance(100)
    expect(active(mounted.button())).toBe(false)
    hover(mounted.button(), 'touchstart'); clock.advance(30); expect(active(mounted.button())).toBe(true)
    hover(mounted.button(), 'touchcancel'); clock.advance(100)
    expect(active(mounted.button())).toBe(false)
  })

  it('new presses invalidate previous release frames and button instances keep independent hover state', () => {
    const clock = hoverClock()
    const mounted = render({ setup: () => () => h('view', null, [h(Button, { text: 'one', hoverStartTime: 0, hoverStayTime: 60 }), h(Button, { text: 'two', hoverStartTime: 0, hoverStayTime: 60 })]) } as any)
    const [one, two] = Array.from(mounted.container.querySelectorAll('.wd-button')) as HTMLElement[]
    hover(one, 'touchstart'); hover(one, 'touchend'); clock.advance(30); hover(one, 'touchstart')
    clock.advance(100); expect(active(one)).toBe(true); expect(active(two)).toBe(false)
    hover(two, 'touchstart'); hover(one, 'touchcancel')
    expect(active(one)).toBe(false); expect(active(two)).toBe(true)
    hover(two, 'touchend'); clock.advance(60); expect(active(two)).toBe(false)
  })

  it('disabled/loading and variant changes invalidate pending hover and customStyle removals clear arbitrary keys', async () => {
    const clock = hoverClock(), mounted = mount({ hoverStartTime: 0, variant: 'plain', customStyle: { 'padding-left': '25px', 'border-radius': '13px', '--button-test': 'purple' } })
    hover(mounted.button(), 'touchstart'); expect(active(mounted.button())).toBe(true)
    mounted.props.value.loading = true; await nextTick()
    expect(active(mounted.button())).toBe(false)
    mounted.props.value.loading = false; mounted.props.value.variant = 'dashed'; mounted.props.value.hoverStartTime = 80
    await nextTick(); hover(mounted.button(), 'touchstart')
    mounted.props.value.disabled = true; mounted.props.value.customStyle = ''; await nextTick(); clock.advance(100)
    expect(active(mounted.button())).toBe(false)
    expect(mounted.button().style.paddingLeft).toBe(''); expect(mounted.button().style.borderRadius).toBe('')
    expect(mounted.button().getAttribute('style') || '').not.toContain('purple')
  })

  it('hover respects explicit inline color/background and clearing overrides restores the class palette', async () => {
    const clock = hoverClock(), mounted = mount({ hoverStartTime: 0, customStyle: { color: 'red', 'background-color': 'black' } })
    hover(mounted.button(), 'touchstart')
    expect(mounted.button().style.color).toBe('red'); expect(mounted.button().style.backgroundColor).toBe('black')
    hover(mounted.button(), 'touchcancel'); mounted.props.value.customStyle = ''; await nextTick()
    hover(mounted.button(), 'touchstart'); expect(active(mounted.button())).toBe(true)
  })

  it('pending native hover callbacks settle after unmount without further frames', () => {
    const clock = hoverClock(), mounted = mount({ hoverStartTime: 40, hoverStayTime: 90 })
    const button = mounted.button()
    hover(button, 'touchstart'); cleanup()
    // 主线程无法观测节点是否已被移出树（Lynx PAPI 不提供父/连接性查询，
    // __GetElementByUniqueId 对已移除节点仍返回原对象），已移除节点上的
    // SET_STYLE 是空操作；可保证的契约是回调不抛错、不无限续帧。
    expect(() => clock.advance(100)).not.toThrow()
    expect(clock.count()).toBe(0)
  })

  it('loading options forward type/size/classes, prefer explicit color, and loadingColor is only a fallback alias', async () => {
    const options = { type: 'wave', size: 26, color: 'red', customClass: 'custom-loading', customSpinnerClass: 'custom-spinner', inheritColor: false }
    const mounted = mount({ loading: true, loadingColor: 'blue', loadingProps: options, icon: 'check', text: 'loading' })
    expect(mounted.container.querySelector('.wd-button__icon')).toBeNull()
    expect(mounted.container.querySelector('.custom-loading')!.getAttribute('style')).toContain('color: red')
    expect(mounted.container.querySelector('.wd-loading__spinner')!.className).toContain('wd-loading__spinner--wave')
    expect(mounted.container.querySelector('.custom-spinner.wd-button__loading')!.getAttribute('style')).toContain('width: 26px')
    expect(options.customSpinnerClass).toBe('custom-spinner')
    expect(rule('.wd-button.is-loading .wd-button__content')).toContain('--wot-button-loading-spacing')
    mounted.props.value.loadingProps = { size: undefined }; await nextTick()
    expect(mounted.container.querySelector('.wd-loading')!.getAttribute('style')).toContain('color: blue')
    mounted.props.value.loadingProps = { color: 'green', inheritColor: true }; await nextTick()
    expect(mounted.container.querySelector('.wd-loading')!.getAttribute('style')).toContain('color: inherit')
  })

  it('loading without an explicit color inherits the button palette', () => {
    const mounted = mount({ loading: true, type: 'danger' })
    expect(mounted.container.querySelector('.wd-loading')!.getAttribute('style')).toContain('color: inherit')
    expect(mounted.container.querySelector('.wd-loading__circular-segment')).not.toBeNull()
  })

  it.each([
    ['getUserInfo', 'Getuserinfo'], ['contact', 'Contact'], ['getPhoneNumber', 'Getphonenumber'],
    ['getRealtimePhoneNumber', 'Getrealtimephonenumber'], ['launchApp', 'Launchapp'], ['openSetting', 'Opensetting'],
    ['chooseAvatar', 'Chooseavatar'], ['agreePrivacyAuthorization', 'Agreeprivacyauthorization']
  ])('openType=%s maps one host success to the exact official event', (openType, eventName) => {
    const success = vi.fn(), error = vi.fn(), order: string[] = []
    configureUniAdapter({ openType: (options: any) => { order.push('host'); options.success({ detail: 'result' }); options.success({ ignored: true }); options.fail({ ignored: true }) } })
    const mounted = mount({ openType, [`on${eventName}`]: success, onError: error, onClick: () => order.push('click'), onTap: () => order.push('tap') })
    fireEvent.tap(mounted.button())
    expect(success).toHaveBeenCalledExactlyOnceWith({ detail: 'result' }); expect(error).not.toHaveBeenCalled()
    expect(order).toEqual(['click', 'tap', 'host'])
  })

  it.each([['phoneNumber', 'Getphonenumber'], ['userInfo', 'Getuserinfo']])('getAuthorize scope=%s forwards official scoped results', (scope, eventName) => {
    const success = vi.fn(), host = vi.fn((options: any) => options.success({ scoped: options.scope }))
    configureUniAdapter({ openType: host })
    const mounted = mount({ openType: 'getAuthorize', scope, [`on${eventName}`]: success })
    fireEvent.tap(mounted.button())
    expect(success).toHaveBeenCalledExactlyOnceWith({ scoped: scope })
  })

  it('contact/app/privacy fields are forwarded unchanged to the explicit host, and fail emits error once', () => {
    const error = vi.fn(), host = vi.fn((options: any) => { options.fail({ errMsg: 'denied' }); options.success({ ignored: true }); options.fail({ ignored: true }) })
    configureUniAdapter({ openType: host })
    const fields = { openType: 'contact', lang: 'zh_TW', scope: 'userInfo', buttonId: 'id', sessionFrom: 'session', sendMessageTitle: 'title', sendMessagePath: '/path', sendMessageImg: 'image.png', appParameter: 'parameter', showMessageCard: true }
    const mounted = mount({ ...fields, onError: error })
    fireEvent.tap(mounted.button(), { detail: { native: true } })
    expect(host.mock.calls[0][0]).toMatchObject(fields)
    expect(host.mock.calls[0][0].event.detail).toEqual({ native: true })
    expect(error).toHaveBeenCalledExactlyOnceWith({ errMsg: 'denied' })
  })

  it('without a host, openType is not faked and ordinary click/tap remain usable', () => {
    const click = vi.fn(), success = vi.fn(), error = vi.fn()
    const mounted = mount({ openType: 'share', onClick: click, onGetuserinfo: success, onError: error })
    fireEvent.tap(mounted.button())
    expect(click).toHaveBeenCalledOnce(); expect(success).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled()
  })

  it('host callbacks and a click-triggered unmount do not emit late results or initiate capability requests', () => {
    const callbacks: any[] = [], success = vi.fn(), error = vi.fn(), host = vi.fn((options: any) => callbacks.push(options))
    configureUniAdapter({ openType: host })
    const mounted = mount({ openType: 'getUserInfo', onGetuserinfo: success, onError: error })
    fireEvent.tap(mounted.button()); cleanup(); callbacks[0].success({ late: true }); callbacks[0].fail({ late: true })
    expect(success).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled()
    const second = mount({ openType: 'getUserInfo', onClick: cleanup })
    fireEvent.tap(second.button()); expect(host).toHaveBeenCalledOnce()
  })

  it('hoverStopPropagation is not misrepresented as click or general touch propagation suppression', () => {
    const clock = hoverClock(), parentTap = vi.fn()
    const mounted = render({ setup: () => () => h('view', { onTap: parentTap }, [h(Button, { hoverStopPropagation: true, hoverStartTime: 0, text: 'child' })]) } as any)
    const button = mounted.container.querySelector('.wd-button') as HTMLElement
    hover(button, 'touchstart'); clock.advance(0); expect(active(button)).toBe(true)
    fireEvent.tap(button, { bubbles: true }); expect(parentTap).toHaveBeenCalledOnce()
  })
})

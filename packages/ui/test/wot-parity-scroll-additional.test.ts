import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Fragment, h, ref } from 'vue-lynx'
import { cleanup, render } from './render'
import { fireEvent } from './fire-event'
import { pause } from '../src/common/util'
import { configureUniAdapter, hasUniAdapter, uni } from '../src/common/uni'
import { swiperProps } from '../src/components/wd-swiper/types'
import { swiperNavprops } from '../src/components/wd-swiper-nav/types'
import { stickyProps } from '../src/components/wd-sticky/types'
import { stickyBoxProps } from '../src/components/wd-sticky-box/types'
import { indexBarProps } from '../src/components/wd-index-bar/types'
import { indexAnchorProps } from '../src/components/wd-index-anchor/types'
import { backtopProps } from '../src/components/wd-backtop/types'
import Swiper from '../src/components/wd-swiper/wd-swiper.vue'
import SwiperNav from '../src/components/wd-swiper-nav/wd-swiper-nav.vue'
import Sticky from '../src/components/wd-sticky/wd-sticky.vue'
import StickyBox from '../src/components/wd-sticky-box/wd-sticky-box.vue'
import IndexBar from '../src/components/wd-index-bar/wd-index-bar.vue'
import IndexAnchor from '../src/components/wd-index-anchor/wd-index-anchor.vue'
import Backtop from '../src/components/wd-backtop/wd-backtop.vue'

/** These tests use the production dual-thread renderer and Lynx tap/scroll events, not DOM clicks. */
const images = ['one.png', 'two.png', 'three.png', 'four.png']
const restoreFns: Array<() => void> = []
const sourceDir = join(__dirname, '..', 'src', 'components')
const officialDir = join(__dirname, '..', '..', '..', '.wot-ref', 'src-2.3.2', 'components')
async function frames(count = 2) { for (let index = 0; index < count; index++) await pause() }
function rect(width = 0, height = 0, top = 0, left = 0) { return { width, height, top, left, right: left + width, bottom: top + height } }
interface InvokeCall { selector: string; params: any }
function mockQuery(resolver: (selector: string) => any = () => rect(), host = false) {
  const calls: InvokeCall[] = []
  const factory = () => {
    const query = {
      in: (_scope: any) => query,
      select: (selector: string) => ({
        invoke: (params: any) => ({ exec: () => {
          calls.push({ selector, params })
          if (params.method === 'boundingClientRect') params.success?.(resolver(selector))
          else params.success?.({})
        } })
      }),
      exec: () => {}
    }
    return query
  }
  if (host) {
    configureUniAdapter({ createSelectorQuery: factory })
    restoreFns.push(() => configureUniAdapter({ createSelectorQuery: undefined }))
  } else {
    const lynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
    const original = lynx.createSelectorQuery
    lynx.createSelectorQuery = factory
    restoreFns.push(() => { lynx.createSelectorQuery = original })
  }
  return { calls, scrolls: () => calls.filter((call) => call.params.method === 'scrollTo'), jumps: () => calls.filter((call) => call.params.method === 'scrollIntoView'), measures: () => calls.filter((call) => call.params.method === 'boundingClientRect') }
}
function nativeEvent(element: Element, name: string, detail?: any) {
  const EventCtor = element.ownerDocument.defaultView!.Event
  const event = new EventCtor(`bindEvent:${name}`)
  Object.assign(event, { eventType: 'bindEvent', eventName: name, detail })
  fireEvent(element, event)
}
function cssRule(component: string, selector: string): Record<string, string> {
  const result: Record<string, string> = {}
  const css = readFileSync(join(sourceDir, component, 'index.css'), 'utf8')
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!match[1].split(',').map((part) => part.trim()).includes(selector)) continue
    for (const declaration of match[2].split(';')) {
      const colon = declaration.indexOf(':')
      if (colon > 0) result[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim()
    }
  }
  return result
}
function officialApi(component: string, filename = 'types.ts') {
  const source = readFileSync(join(officialDir, component, filename), 'utf8')
  const block = /export const \w+[Pp]rops\s*=\s*\{([\s\S]*?)\n\}/.exec(source)?.[1] || ''
  const keys = [...block.matchAll(/^  (\w+):/gm)].map((match) => match[1])
  const defaults = [...block.matchAll(/^  (\w+): make(?:Boolean|Number|Numeric|String)Prop(?:<[^>]*>)?\(([^)]*)\)/gm)].map((match) => ({ key: match[1], value: match[2].replace(/^['"]|['"]$/g, '') }))
  return { keys, defaults }
}
function mockObservers() {
  const observers: any[] = []
  const factory = vi.fn((scope: any, options: any) => {
    const observer = {
      scope, options, selector: '', margin: null as any, callback: null as any,
      relativeToViewport: vi.fn((margin: any) => { observer.margin = margin; return observer }),
      observe: vi.fn((selector: string, callback: any) => { observer.selector = selector; observer.callback = callback }),
      disconnect: vi.fn()
    }
    observers.push(observer)
    return observer
  })
  configureUniAdapter({ createIntersectionObserver: factory })
  return { factory, observers, latest: (test: (selector: string) => boolean) => [...observers].reverse().find((observer) => test(observer.selector) && !observer.disconnect.mock.calls.length) }
}
afterEach(() => {
  cleanup()
  for (const restore of restoreFns.splice(0)) restore()
  configureUniAdapter({ createSelectorQuery: undefined, createIntersectionObserver: undefined, createVideoContext: undefined, pageScrollTo: undefined, getSystemInfoSync: undefined })
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('wot 2.3.2 scroll additional parity: complete public props', () => {
  it.each([
    ['wd-swiper', swiperProps, 'types.ts', true],
    ['wd-swiper-nav', swiperNavprops, 'types.ts', true],
    ['wd-sticky', stickyProps, 'types.ts', true],
    ['wd-index-bar', indexBarProps, 'type.ts', false],
    ['wd-index-anchor', indexAnchorProps, 'type.ts', true],
    ['wd-backtop', backtopProps, 'types.ts', true]
  ])('%s keeps every official prop, type family and declared default', (component, props, filename, base) => {
    const api = officialApi(component as string, filename as string)
    expect(Object.keys(props)).toEqual(expect.arrayContaining(api.keys))
    expect(Object.keys(props).sort()).toEqual([...api.keys, ...(base ? ['customClass', 'customStyle'] : [])].sort())
    for (const { key, value } of api.defaults) expect(String((props as any)[key].default), `${component}.${key}`).toBe(value)
  })
  it('sticky-box takes only the official baseProps contract', () => {
    expect(Object.keys(stickyBoxProps).sort()).toEqual(['customClass', 'customStyle'])
    expect((indexAnchorProps.index as any).required).toBe(true)
    expect((backtopProps.scrollTop as any).required).toBe(true)
    expect(swiperProps.list.default()).toEqual([])
    expect(swiperProps.indicator.default).toBe(true)
  })
})

describe('wot 2.3.2 scroll additional parity: swiper and nav', () => {
  it('renders custom media keys/classes/title styles and forwards real tap payloads', async () => {
    mockQuery(() => rect(300, 180))
    const clicks = vi.fn(), taps = vi.fn(), presses = vi.fn()
    const list = [{ src: 'cover.png', title: 'cover' }, { src: 'clip.mp4', type: 'video', poster: 'poster.png', title: 'video' }, { src: 'last.png', title: 'last' }]
    const { container } = render(Swiper, {
      list, valueKey: 'src', textKey: 'title', current: 1, height: 180, autoplay: false, muted: false, videoLoop: false, autoplayVideo: false,
      customClass: 'consumer-swiper', customImageClass: 'consumer-image', customItemClass: 'consumer-item', customPrevClass: 'consumer-prev', customNextClass: 'consumer-next', customTextClass: 'consumer-title', customTextStyle: 'top: 7px; font-size: 19px', customStyle: 'margin-top: 5px', imageMode: 'aspectFit', showMenuByLongpress: true, onClick: clicks, onTap: taps, 'onLong-press': presses
    })
    await frames()
    const root = container.querySelector('.wd-swiper') as HTMLElement
    expect(root.classList.contains('consumer-swiper')).toBe(true)
    expect(root.style.marginTop).toBe('5px')
    const image = container.querySelector('.wd-swiper__image') as HTMLElement
    expect(image.getAttribute('src')).toBe('cover.png')
    expect(image.getAttribute('mode')).toBe('aspectFit')
    expect(image.classList.contains('consumer-prev')).toBe(true)
    const video = container.querySelector('.wd-swiper__video') as HTMLElement
    expect(video.getAttribute('src')).toBe('clip.mp4')
    expect(video.getAttribute('poster')).toBe('poster.png')
    expect(video.style.height).toBe('180px')
    const title = video.parentElement!.querySelector('.wd-swiper__text') as HTMLElement
    expect(title.textContent).toBe('video')
    expect(title.style.top).toBe('7px')
    expect(title.style.fontSize).toBe('19px')
    fireEvent.tap(image, { detail: { marker: 'media' } })
    fireEvent.longpress(image)
    expect(clicks).toHaveBeenCalledExactlyOnceWith({ index: 0, item: list[0] })
    expect(taps.mock.calls[0][0].detail).toEqual({ marker: 'media' })
    expect(presses).toHaveBeenCalledExactlyOnceWith({ index: 0, item: list[0] })
  })
  it('slots receive item/index and current/total, replacing only the documented defaults', async () => {
    mockQuery(() => rect(320, 160))
    const indicator = ref(true)
    const { container } = render({ setup: () => () => h(Swiper, { list: images.slice(0, 3), current: 1, indicator: indicator.value, autoplay: false }, {
      default: ({ item, index }: any) => h('view', { class: 'consumer-slide' }, [h('text', null, `${index}:${item}`)]),
      indicator: ({ current, total }: any) => h('text', { class: 'consumer-indicator' }, `${current}/${total}`)
    }) } as any)
    await frames()
    expect([...container.querySelectorAll('.consumer-slide')].map((element) => element.textContent)).toEqual(['0:one.png', '1:two.png', '2:three.png'])
    expect(container.querySelector('.wd-swiper__image')).toBeNull()
    expect(container.querySelector('.wd-swiper-nav')).toBeNull()
    expect(container.querySelector('.consumer-indicator')!.textContent).toBe('1/3')
    indicator.value = false
    await frames(1)
    expect(container.querySelector('.consumer-indicator')).toBeNull()
  })
  it('uses measured margins/multiple items, real native smooth navigation, snapToEdge and clearable radius', async () => {
    const query = mockQuery(() => rect(300, 180), true)
    configureUniAdapter({ getSystemInfoSync: () => ({ windowWidth: 375 }) })
    const current = ref(0), direction = ref<'horizontal' | 'vertical'>('horizontal'), snap = ref(false), radius = ref<number | undefined>(16), duration = ref(300)
    const changes = vi.fn(), finishes = vi.fn()
    const { container } = render({ setup: () => () => h(Swiper, { list: images, autoplay: false, current: current.value, direction: direction.value, loop: false, snapToEdge: snap.value, previousMargin: '40rpx', nextMargin: '20px', displayMultipleItems: 2, radius: radius.value, duration: duration.value, onChange: changes, onAnimationfinish: finishes }) } as any)
    await frames()
    const track = container.querySelector('.wd-swiper__track') as HTMLElement
    const inner = container.querySelector('.wd-swiper__track-inner') as HTMLElement
    const item = container.querySelector('.wd-swiper__item') as HTMLElement
    expect(item.style.width).toBe('130px')
    expect(inner.style.width).toBe('560px')
    expect(inner.style.paddingLeft).toBe('20px')
    expect(track.style.borderRadius).toBe('16px')
    expect(track.hasAttribute('scroll-with-animation')).toBe(false)
    expect(track.hasAttribute('scroll-left')).toBe(false)
    current.value = 1
    await frames()
    expect(query.scrolls().slice(-1)[0].params.params).toEqual({ offset: 130, smooth: true })
    fireEvent.scroll(track, { detail: { scrollLeft: 65 } })
    fireEvent.scrollend(track, { detail: { scrollLeft: 130 } })
    expect(changes.mock.calls).toEqual([[{ current: 1, source: '' }]])
    expect(finishes).toHaveBeenCalledExactlyOnceWith({ current: 1, source: '' })
    snap.value = true; radius.value = undefined
    await frames()
    expect(inner.style.paddingLeft).toBe('0px')
    expect(inner.style.paddingRight).toBe('0px')
    expect(inner.style.width).toBe('520px')
    expect(track.style.borderRadius).toBe('')
    expect(query.scrolls().slice(-1)[0].params.params.offset).toBe(110)
    current.value = 3; duration.value = 0
    await frames()
    expect(query.scrolls().slice(-1)[0].params.params).toEqual({ offset: 220, smooth: false })
    fireEvent.scrollend(track, { detail: { scrollLeft: 220 } })
    direction.value = 'vertical'
    await frames()
    expect(inner.style.flexDirection).toBe('column')
    expect(inner.style.paddingLeft).toBe('0px')
    expect(inner.style.height).toBe('280px')
    expect(item.style.height).toBe('70px')
    expect(item.style.width).toBe('100%')
  })
  it('normalizes out-of-range current, list shrink, loop controls and non-loop boundaries', async () => {
    const query = mockQuery(() => rect(300, 180))
    const current = ref(-1), list = ref(images.slice(0, 3)), loop = ref(true)
    const updates: number[] = []
    const { container } = render({ setup: () => () => h(Swiper, { list: list.value, current: current.value, loop: loop.value, autoplay: false, indicator: { type: 'fraction', showControls: true }, 'onUpdate:current': (value: number) => updates.push(value) }) } as any)
    await frames()
    const track = container.querySelector('.wd-swiper__track')!
    const fraction = () => container.querySelector('.wd-swiper-nav__fraction-text')!.textContent
    expect(fraction()).toBe('3/3')
    fireEvent.tap(container.querySelector('.wd-swiper-nav__btn--next')!)
    await frames()
    expect(query.scrolls().slice(-1)[0].params.params).toEqual({ offset: 0, smooth: false })
    expect(fraction()).toBe('1/3')
    fireEvent.scrollend(track, { detail: { scrollLeft: 0 } })
    loop.value = false; current.value = 99
    await frames()
    expect(fraction()).toBe('3/3')
    fireEvent.scrollend(track, { detail: { scrollLeft: 600 } })
    const length = updates.length
    fireEvent.tap(container.querySelector('.wd-swiper-nav__btn--next')!)
    expect(updates).toHaveLength(length)
    list.value = ['only.png']
    await frames()
    expect(container.querySelectorAll('.wd-swiper__item')).toHaveLength(1)
    expect(container.querySelector('.wd-swiper-nav')).toBeNull()
    expect(updates.slice(-1)[0]).toBe(0)
    list.value = []
    await frames()
    fireEvent.tap(container.querySelector('.wd-swiper-nav__btn--next')!)
    expect(container.querySelector('.wd-swiper__item')).toBeNull()
  })
  it('snap finishes once with touch source and never queries rectangles on the scroll hot path', async () => {
    const query = mockQuery(() => rect(300, 180))
    const changes = vi.fn(), finishes = vi.fn()
    const { container } = render(Swiper, { list: images.slice(0, 3), autoplay: false, onChange: changes, onAnimationfinish: finishes })
    await frames()
    const track = container.querySelector('.wd-swiper__track')!
    const measured = query.measures().length
    fireEvent.touchstart(track)
    fireEvent.scroll(track, { detail: { scrollLeft: 185, isDragging: true } })
    fireEvent.touchend(track)
    fireEvent.scrollend(track, { detail: { scrollLeft: 185 } })
    await frames(1)
    expect(finishes).not.toHaveBeenCalled()
    expect(query.scrolls().slice(-1)[0].params.params).toEqual({ offset: 300, smooth: true })
    fireEvent.scroll(track, { detail: { scrollLeft: 250 } })
    fireEvent.scrollend(track, { detail: { scrollLeft: 300 } })
    fireEvent.scrollend(track, { detail: { scrollLeft: 300 } })
    expect(changes).toHaveBeenCalledExactlyOnceWith({ current: 1, source: 'touch' })
    expect(finishes).toHaveBeenCalledExactlyOnceWith({ current: 1, source: 'touch' })
    expect(query.measures()).toHaveLength(measured)
  })
  it('autoplay advances natively with autoplay finish source, wrap instant and unmount cleanup', async () => {
    vi.useFakeTimers()
    const query = mockQuery(() => rect(300, 180))
    const changes = vi.fn(), finishes = vi.fn()
    const interval = ref(100), autoplay = ref(true)
    const result = render({ setup: () => () => h(Swiper, { list: images.slice(0, 2), interval: interval.value, autoplay: autoplay.value, onChange: changes, onAnimationfinish: finishes }) } as any)
    await vi.advanceTimersByTimeAsync(20)
    const track = result.container.querySelector('.wd-swiper__track')!
    await vi.advanceTimersByTimeAsync(100)
    expect(changes.mock.calls[0]).toEqual([{ current: 1, source: 'autoplay' }])
    expect(query.scrolls().slice(-1)[0].params.params).toEqual({ offset: 300, smooth: true })
    fireEvent.scroll(track, { detail: { scrollLeft: 180 } })
    fireEvent.scrollend(track, { detail: { scrollLeft: 300 } })
    expect(finishes.mock.calls[0]).toEqual([{ current: 1, source: 'autoplay' }])
    interval.value = 50
    await vi.advanceTimersByTimeAsync(55)
    expect(query.scrolls().slice(-1)[0].params.params).toEqual({ offset: 0, smooth: false })
    fireEvent.scrollend(track, { detail: { scrollLeft: 0 } })
    expect(finishes.mock.calls[1]).toEqual([{ current: 0, source: 'autoplay' }])
    autoplay.value = false
    await vi.advanceTimersByTimeAsync(200)
    expect(changes).toHaveBeenCalledTimes(2)
    result.unmount()
    await vi.advanceTimersByTimeAsync(500)
    expect(changes).toHaveBeenCalledTimes(2)
  })
  it('tracks current video playback across stopAutoplay prop changes and list replacement', async () => {
    vi.useFakeTimers()
    mockQuery(() => rect(300, 180))
    const pauseVideo = ref(true), list = ref<any[]>([{ value: 'first.mp4', type: 'video' }, { value: 'second.mp4', type: 'video' }])
    const changes = vi.fn()
    const { container } = render({ setup: () => () => h(Swiper, { list: list.value, interval: 100, stopAutoplayWhenVideoPlay: pauseVideo.value, onChange: changes }) } as any)
    await vi.advanceTimersByTimeAsync(10)
    nativeEvent(container.querySelector('.wd-swiper__video')!, 'play')
    await vi.advanceTimersByTimeAsync(250)
    expect(changes).not.toHaveBeenCalled()
    pauseVideo.value = false
    await vi.advanceTimersByTimeAsync(110)
    expect(changes).toHaveBeenCalledExactlyOnceWith({ current: 1, source: 'autoplay' })
    const track = container.querySelector('.wd-swiper__track')!
    fireEvent.scrollend(track, { detail: { scrollLeft: 300 } })
    nativeEvent(container.querySelectorAll('.wd-swiper__video')[1], 'play')
    pauseVideo.value = true
    await vi.advanceTimersByTimeAsync(220)
    expect(changes).toHaveBeenCalledTimes(1)
    list.value = ['one.png', 'two.png']
    await vi.advanceTimersByTimeAsync(110)
    expect(changes.mock.calls[1]).toEqual([{ current: 0, source: 'autoplay' }])
  })
  it('commands only injected video contexts with actual media id and scope, honoring play/pause flags', async () => {
    mockQuery(() => rect(300, 180))
    const current = ref(0), autoplayVideo = ref(true), stopPreviousVideo = ref(true)
    const actions: string[] = []
    const host = vi.fn((id: string, scope: any) => ({ play: () => actions.push(`play:${id}`), pause: () => actions.push(`pause:${id}`) }))
    configureUniAdapter({ createVideoContext: host })
    const { container } = render({ setup: () => () => h(Swiper, { list: ['first.mp4', 'second.mp4'], current: current.value, autoplay: false, autoplayVideo: autoplayVideo.value, stopPreviousVideo: stopPreviousVideo.value }) } as any)
    await frames()
    const videos = container.querySelectorAll('.wd-swiper__video')
    current.value = 1
    await frames()
    expect(actions).toEqual([`pause:${videos[0].id}`, `play:${videos[1].id}`])
    expect(host.mock.calls.every((call) => call[1]?.$)).toBe(true)
    autoplayVideo.value = false; stopPreviousVideo.value = false; current.value = 0
    await frames()
    expect(actions).toHaveLength(2)
    configureUniAdapter({ createVideoContext: undefined })
    const fallback = vi.spyOn(uni, 'createVideoContext')
    current.value = 1
    await frames()
    expect(fallback).not.toHaveBeenCalled()
  })
  it('nav keeps minShowNum independent from controls and all direction/position/type classes', async () => {
    const type = ref<'dots' | 'dots-bar' | 'fraction'>('dots'), direction = ref<'horizontal' | 'vertical'>('horizontal'), position = ref<any>('bottom'), total = ref(1), min = ref(2)
    const changes = vi.fn(), taps = vi.fn()
    const { container } = render({ setup: () => () => h(SwiperNav, { type: type.value, direction: direction.value, indicatorPosition: position.value, total: total.value, minShowNum: min.value, current: 1, showControls: true, customClass: 'consumer-nav', customStyle: 'opacity: 0.7', onChange: changes, onTap: taps }) } as any)
    expect(container.querySelector('.wd-swiper-nav')).toBeNull()
    fireEvent.tap(container.querySelector('.wd-swiper-nav__btn--prev')!)
    fireEvent.tap(container.querySelector('.wd-swiper-nav__btn--next')!)
    expect(changes.mock.calls).toEqual([[{ dir: 'prev', source: 'nav' }], [{ dir: 'next', source: 'nav' }]])
    expect(taps).toHaveBeenCalledTimes(2)
    total.value = 3; type.value = 'dots-bar'; direction.value = 'vertical'
    for (const value of ['left', 'top-left', 'top', 'top-right', 'bottom-left', 'bottom', 'bottom-right', 'right']) {
      position.value = value
      await frames(1)
      const nav = container.querySelector('.wd-swiper-nav') as HTMLElement
      expect(nav.classList.contains(`wd-swiper-nav--${value}`)).toBe(true)
      expect(nav.classList.contains('wd-swiper-nav--vertical')).toBe(true)
      expect(nav.style.opacity).toBe('0.7')
    }
    expect(container.querySelectorAll('.wd-swiper-nav__item--dots-bar')).toHaveLength(3)
    expect(container.querySelectorAll('.is-active')).toHaveLength(1)
    type.value = 'fraction'; min.value = 0
    await frames(1)
    expect(container.querySelector('.wd-swiper-nav__fraction-text')!.textContent).toBe('2/3')
    expect(container.querySelector('.wd-swiper-nav__btn--prev .wd-icon-left')).not.toBeNull()
    expect(container.querySelector('.wd-swiper-nav__btn--next .wd-icon-right')).not.toBeNull()
  })
})

describe('wot 2.3.2 scroll additional parity: sticky and box', () => {
  it('measures exposed width/height, updates layouts/offset and supplies a real out-of-flow placeholder', async () => {
    let size = rect(220, 40, 100)
    mockQuery(() => size)
    const observerFallback = vi.spyOn(uni, 'createIntersectionObserver')
    let exposed: any
    const offset = ref(12), zIndex = ref(3)
    const { container } = render({ setup: () => () => h(Sticky, { offsetTop: offset.value, zIndex: zIndex.value, customClass: 'consumer-sticky', ref: (value: any) => { exposed = value } }, { default: () => h('text', null, 'sticky') }) } as any)
    await frames()
    const root = container.querySelector('.wd-sticky') as HTMLElement
    expect(root.style.position).toBe('sticky')
    expect(exposed.stickyState.width).toBe(220)
    expect(exposed.stickyState.height).toBe(40)
    expect(exposed.offsetTop).toBe(12)
    expect(observerFallback).not.toHaveBeenCalled()
    exposed.setPosition(true, 'absolute', 160)
    await frames(1)
    const placeholder = container.querySelector('.wd-sticky__placeholder') as HTMLElement
    expect(placeholder.style.width).toBe('220px')
    expect(placeholder.style.height).toBe('40px')
    expect(root.style.position).toBe('absolute')
    expect(root.style.top).toBe('160px')
    expect(root.style.width).toBe('220px')
    size = rect(240, 55, 100)
    fireEvent.layoutchange(container.querySelector('.wd-sticky__container')!, { detail: { width: 240, height: 55 } })
    await frames()
    expect(exposed.stickyState.height).toBe(55)
    expect(placeholder.style.height).toBe('55px')
    exposed.setPosition(false, 'sticky', 0); offset.value = 5; zIndex.value = 8
    await frames()
    expect(container.querySelector('.wd-sticky__placeholder')).toBeNull()
    expect(root.style.position).toBe('sticky')
    expect(root.style.top).toBe('5px')
    expect(root.style.width).toBe('')
    expect(root.style.height).toBe('')
    expect(root.style.zIndex).toBe('8')
    const before = root.getAttribute('style')
    exposed.setPosition(false, 'invented', 99)
    exposed.setPosition(false, 'fixed', NaN)
    await frames(1)
    expect(root.getAttribute('style')).toBe(before)
  })
  it('host observer targets a stable flow probe and faithfully changes normal/sticky states', async () => {
    mockQuery((selector) => selector.endsWith('-probe') ? rect(180, 35, 80) : rect(180, 35))
    const host = mockObservers()
    let exposed: any
    const offset = ref(10)
    const result = render({ setup: () => () => h(Sticky, { offsetTop: offset.value, ref: (value: any) => { exposed = value } }) } as any)
    await frames()
    const root = result.container.querySelector('.wd-sticky') as HTMLElement
    let observer = host.latest((selector) => selector.endsWith('-probe'))
    expect(result.container.querySelector(`[id="${observer.selector.slice(1)}"]`)).not.toBeNull()
    expect(observer.scope.$).toBeTruthy()
    expect(observer.options.thresholds).toEqual([0, 0.5])
    expect(observer.margin).toEqual({ top: -45 })
    observer.callback({ boundingClientRect: rect(180, 35, 5) })
    await frames(1)
    expect(exposed.stickyState.state).toBe('sticky')
    expect(root.style.position).toBe('fixed')
    expect(root.style.top).toBe('10px')
    expect((result.container.querySelector('.wd-sticky__placeholder') as HTMLElement).style.height).toBe('35px')
    const old = observer
    offset.value = 20
    await frames()
    expect(old.disconnect).toHaveBeenCalled()
    observer = host.latest((selector) => selector.endsWith('-probe'))
    expect(observer.margin).toEqual({ top: -55 })
    observer.callback({ boundingClientRect: rect(180, 35, 0) })
    await frames(1)
    expect(root.style.top).toBe('20px')
    old.callback({ boundingClientRect: rect(180, 35, -100) })
    await frames(1)
    expect(root.style.top).toBe('20px')
    observer.callback({ boundingClientRect: rect(180, 35, 90) })
    await frames(1)
    expect(exposed.stickyState.state).toBe('normal')
    expect(root.style.position).toBe('absolute')
    expect(root.style.top).toBe('0px')
    result.unmount()
    expect(observer.disconnect).toHaveBeenCalled()
    observer.callback({ boundingClientRect: rect(180, 35, -20) })
    await frames(1)
    expect(root.style.position).toBe('absolute')
  })
  it('sticky-box contracts limit child to bottom, restore fixed, resize and disconnect removed children', async () => {
    let box = rect(250, 300, 0)
    mockQuery((selector) => selector.startsWith('#wd-sticky-box-') ? box : selector.endsWith('-probe') ? rect(250, 50, 0) : rect(250, 50))
    const host = mockObservers(), visible = ref(true)
    let child: any
    const result = render({ setup: () => () => h(StickyBox, { customClass: 'consumer-box', customStyle: 'margin-top: 7px' }, { default: () => visible.value ? h(Sticky, { offsetTop: 10, ref: (value: any) => { if (value) child = value } }) : null }) } as any)
    await frames(3)
    const root = result.container.querySelector('.wd-sticky') as HTMLElement
    const boxElement = result.container.querySelector('.wd-sticky-box') as HTMLElement
    expect(boxElement.style.marginTop).toBe('7px')
    const ownObserver = host.latest((selector) => selector.endsWith('-probe'))
    ownObserver.callback({ boundingClientRect: rect(250, 50, 0) })
    const bottomObserver = host.latest((selector) => selector.startsWith('#wd-sticky-box-'))
    expect(bottomObserver).toBeTruthy()
    expect(bottomObserver.margin).toEqual({ top: -60 })
    bottomObserver.callback({ boundingClientRect: rect(250, 300, -260) })
    await frames(1)
    expect(child.stickyState.boxLeaved).toBe(true)
    expect(root.style.position).toBe('absolute')
    expect(root.style.top).toBe('250px')
    expect((result.container.querySelector('.wd-sticky__wrapper') as HTMLElement).style.position).toBe('static')
    ownObserver.callback({ boundingClientRect: rect(250, 50, -260) })
    await frames(1)
    expect(root.style.position).toBe('absolute') // parent's cached bottom wins callback ordering
    bottomObserver.callback({ boundingClientRect: rect(250, 300, -150) })
    await frames(1)
    expect(child.stickyState.boxLeaved).toBe(false)
    expect(root.style.position).toBe('fixed')
    expect(root.style.top).toBe('10px')
    box = rect(250, 45, 0)
    fireEvent.layoutchange(boxElement, { detail: { width: 250, height: 45 } })
    await frames()
    expect(bottomObserver.disconnect).toHaveBeenCalled()
    expect(root.style.position).toBe('absolute')
    expect(root.style.top).toBe('0px')
    visible.value = false
    await frames()
    expect(host.observers.every((observer) => observer.disconnect.mock.calls.length > 0)).toBe(true)
    result.unmount()
  })
})

describe('wot 2.3.2 scroll additional parity: indexes', () => {
  it('duplicates map sidebar targets to the real child, numeric/string keys stay distinct and ids remain unique', async () => {
    const query = mockQuery((selector) => selector.endsWith('-sidebar') ? rect(24, 100, 100) : rect(300, 30, 0))
    const indexes: Array<string | number> = ['A', 'A', 'B', 0, '0']
    const { container } = render({ setup: () => () => h('view', null, [
      h(IndexBar, { sticky: true }, { default: () => h(Fragment, null, indexes.map((index, key) => h(IndexAnchor, { index, key }))) }),
      h(IndexBar, null, { default: () => h(IndexAnchor, { index: 'A' }) })
    ]) } as any)
    await frames(3)
    const bars = container.querySelectorAll('.wd-index-bar')
    expect([...bars[0].querySelectorAll('.wd-index-bar__index')].map((element) => element.textContent)).toEqual(['A', 'B', '0', '0'])
    const anchors = container.querySelectorAll('.wd-index-anchor')
    expect(new Set([...anchors].map((element) => element.id)).size).toBe(6)
    const sidebar = bars[0].querySelector('.wd-index-bar__sidebar')!
    const measured = query.measures().length
    fireEvent.touchstart(sidebar)
    fireEvent.touchmove(sidebar, { touches: [{ pageY: 135 }] }) // second unique entry B, not duplicate A
    await frames(1)
    expect(query.jumps().slice(-1)[0].selector).toBe(`#${anchors[2].id}`)
    expect(bars[0].querySelector('.wd-index-bar__current-index')!.textContent).toBe('B')
    expect(anchors[2].classList.contains('is-sticky')).toBe(true)
    expect(anchors[1].classList.contains('is-sticky')).toBe(false)
    fireEvent.touchend(sidebar, { changedTouches: [{ pageY: 135 }] })
    await frames(2)
    expect(bars[0].querySelector('.wd-index-bar__current-index')).toBeNull()
    expect(query.measures()).toHaveLength(measured)
  })
  it('dynamic renamed/removed anchors update sidebar, collision ids and active child without prop recursion', async () => {
    mockQuery((selector) => selector.endsWith('-sidebar') ? rect(24, 72, 0) : rect(300, 30, 0))
    const names = ref(['A', 'B', 'C'])
    const { container } = render({ setup: () => () => h(IndexBar, { sticky: true }, { default: () => names.value.map((index, key) => h(IndexAnchor, { index, key, customClass: `anchor-${key}` })) }) } as any)
    await frames(3)
    const a = container.querySelector('.anchor-0')!, originalId = a.id
    names.value[1] = 'A'
    await frames(2)
    expect([...container.querySelectorAll('.wd-index-bar__index')].map((element) => element.textContent)).toEqual(['A', 'C'])
    const b = container.querySelector('.anchor-1')!
    expect(a.id).not.toBe(b.id)
    names.value[0] = 'Z'
    await frames(2)
    expect(a.id).not.toBe(originalId)
    expect(a.id).toContain('-anchor-Z')
    expect(b.id).toContain('-anchor-A')
    expect([...container.querySelectorAll('.wd-index-bar__index')].map((element) => element.textContent)).toEqual(['Z', 'A', 'C'])
    const sidebar = container.querySelector('.wd-index-bar__sidebar')!
    fireEvent.touchstart(sidebar); fireEvent.touchend(sidebar, { changedTouches: [{ clientY: 70 }] })
    await frames(2)
    expect(container.querySelector('.anchor-2')!.classList.contains('is-sticky')).toBe(true)
    names.value.pop()
    await frames(2)
    expect(container.querySelector('.anchor-2')).toBeNull()
    expect(container.querySelectorAll('.wd-index-bar__index')).toHaveLength(2)
    expect(container.querySelectorAll('.wd-index-anchor.is-sticky')).toHaveLength(1)
    names.value = []
    await frames(2)
    fireEvent.touchstart(sidebar); fireEvent.touchmove(sidebar); fireEvent.touchcancel(sidebar)
    await frames(2)
    expect(container.querySelector('.wd-index-bar__current-index')).toBeNull()
  })
  it('scroll active identity follows cached anchor content coordinates and sticky remeasurement does not corrupt top', async () => {
    let scrollTop = 0, anchorTopOffset = 0
    let bExpose: any
    const query = mockQuery((selector) => {
      if (selector.endsWith('-sidebar')) return rect(24, 72, 100)
      const label = /-anchor-([ABC])(?:-|$)/.exec(selector)?.[1]
      if (!label) return rect(300, 300, 50)
      const content = { A: 50, B: 250 + anchorTopOffset, C: 450 + anchorTopOffset }[label as 'A' | 'B' | 'C']
      const raw = content - scrollTop
      return rect(300, 30, label === 'B' && bExpose?.$?.exposed && scrollTop >= 200 ? 50 : raw)
    })
    const { container } = render({ setup: () => () => h(IndexBar, { sticky: true }, { default: () => ['A', 'B', 'C'].map((index) => h(IndexAnchor, { index, ref: index === 'B' ? (value: any) => { bExpose = value } : undefined })) }) } as any)
    await frames(3)
    const scroll = container.querySelector('.wd-index-bar__content')!
    const active = () => container.querySelector('.wd-index-bar__index.is-active')!.textContent
    scrollTop = 205
    fireEvent.scroll(scroll, { detail: { scrollTop } })
    await frames(1)
    expect(active()).toBe('B')
    expect(bExpose.top).toBe(250)
    fireEvent.layoutchange(container.querySelector('[id$="-anchor-B"]')!)
    await frames(2)
    expect(bExpose.top).toBe(250)
    const count = query.measures().length
    scrollTop = 405
    fireEvent.scroll(scroll, { detail: { scrollTop } })
    await frames(1)
    expect(active()).toBe('C')
    expect(query.measures()).toHaveLength(count)
    scrollTop = 0
    fireEvent.scroll(scroll, { detail: { scrollTop } })
    anchorTopOffset = 100
    fireEvent.layoutchange(container.querySelector('.wd-index-bar')!)
    await frames(3)
    expect(bExpose.top).toBe(350)
    scrollTop = 205
    fireEvent.scroll(scroll, { detail: { scrollTop } })
    await frames(1)
    expect(active()).toBe('A')
  })
  it('anchor exposes measured top/id standalone and zero rectangles do not pretend to know scroll position', async () => {
    let size = rect()
    mockQuery(() => size)
    let exposed: any
    const first = render({ setup: () => () => h(IndexAnchor, { index: 'A B', customClass: 'consumer-anchor', customStyle: 'padding-top: 8px', ref: (value: any) => { exposed = value } }) } as any)
    await frames()
    const root = first.container.querySelector('.wd-index-anchor') as HTMLElement
    expect(root.id).toContain('A%20B')
    expect(exposed.measured).toBe(false)
    expect(root.style.paddingTop).toBe('8px')
    size = rect(150, 32, 75)
    fireEvent.layoutchange(root)
    await frames()
    expect(exposed.measured).toBe(true)
    expect(exposed.top).toBe(75)
    first.unmount()
    size = rect()
    const { container } = render({ setup: () => () => h(IndexBar, null, { default: () => ['A', 'B', 'C'].map((index) => h(IndexAnchor, { index })) }) } as any)
    await frames()
    fireEvent.scroll(container.querySelector('.wd-index-bar__content')!, { detail: { scrollTop: 999 } })
    await frames(1)
    expect(container.querySelector('.wd-index-bar__index.is-active')!.textContent).toBe('A')
  })
})

describe('wot 2.3.2 scroll additional parity: backtop and generated geometry', () => {
  it('only activates strictly above threshold, calls the host with duration and forwards native tap without listener arrays', async () => {
    const scrollTop = ref(300), duration = ref(245), shape = ref<'circle' | 'square'>('square'), bottom = ref(42), right = ref(17), zIndex = ref(22)
    const pageScroll = vi.fn(), clicks = vi.fn(), taps = vi.fn()
    configureUniAdapter({ pageScrollTo: pageScroll })
    const { container } = render({ setup: () => () => h(Backtop, { scrollTop: scrollTop.value, duration: duration.value, shape: shape.value, bottom: bottom.value, right: right.value, zIndex: zIndex.value, text: 'Up', iconStyle: 'font-size: 25px; color: rgb(10, 20, 30)', customStyle: 'margin-top: 6px', customClass: 'consumer-backtop', onClick: clicks, onTap: taps }) } as any)
    await frames(5)
    const root = container.querySelector('.wd-backtop') as HTMLElement
    expect(root.classList.contains('wd-transition')).toBe(true)
    expect(root.classList.contains('is-square')).toBe(true)
    expect(root.style.bottom).toBe('42px')
    expect(root.style.right).toBe('17px')
    expect(root.style.zIndex).toBe('22')
    expect(root.style.display).toBe('none')
    fireEvent.tap(root)
    expect(pageScroll).not.toHaveBeenCalled()
    expect(clicks).not.toHaveBeenCalled()
    expect(taps).toHaveBeenCalledOnce()
    taps.mockClear()
    scrollTop.value = 301
    await frames(5)
    expect(root.style.display).not.toBe('none')
    fireEvent.tap(root, { detail: { marker: 'backtop' } })
    expect(pageScroll).toHaveBeenCalledExactlyOnceWith({ scrollTop: 0, duration: 245 })
    expect(clicks).toHaveBeenCalledOnce()
    expect(taps.mock.calls[0][0].detail).toEqual({ marker: 'backtop' })
    const glyph = container.querySelector('.wd-backtop__backicon .wd-icon__glyph') as HTMLElement
    expect(container.querySelector('.wd-icon-to-top')).not.toBeNull()
    expect(glyph.style.fontSize).toBe('25px')
    expect(glyph.style.color).toBe('rgb(10, 20, 30)')
    shape.value = 'circle'; bottom.value = 0; right.value = 0; duration.value = 0
    await frames()
    expect(root.classList.contains('is-circle')).toBe(true)
    expect(root.style.bottom).toBe('0px')
    expect(root.style.right).toBe('0px')
    fireEvent.tap(root)
    expect(pageScroll.mock.calls[1]).toEqual([{ scrollTop: 0, duration: 0 }])
    configureUniAdapter({ pageScrollTo: undefined })
    const fallback = vi.spyOn(uni, 'pageScrollTo')
    fireEvent.tap(root)
    expect(fallback).not.toHaveBeenCalled()
    expect(clicks).toHaveBeenCalledTimes(3)
    const registry = (globalThis as any).__VUE_LYNX_EVENT_REGISTRY__
    const handlers = registry instanceof Map ? registry : registry?.handlers
    if (handlers instanceof Map) for (const handler of handlers.values()) expect(Array.isArray(handler)).toBe(false)
  })
  it('backtop custom slot replaces default icon and text', async () => {
    const { container } = render(Backtop, { scrollTop: 900, text: 'default' }, [])
    await frames()
    expect(container.querySelector('.wd-backtop__text')!.textContent).toBe('default')
    const custom = render({ setup: () => () => h(Backtop, { scrollTop: 900, text: 'default' }, { default: () => h('text', { class: 'consumer-top' }, 'custom') }) } as any)
    await frames()
    expect(custom.container.querySelector('.consumer-top')!.textContent).toBe('custom')
    expect(custom.container.querySelector('.wd-backtop__backicon')).toBeNull()
    expect(custom.container.querySelector('.wd-backtop__text')).toBeNull()
  })
  it('SCSS/generated CSS retains official non-theme sizes, spacing and direct text rules', () => {
    for (const component of ['wd-swiper', 'wd-swiper-nav', 'wd-index-bar', 'wd-index-anchor', 'wd-backtop']) {
      const original = readFileSync(join(officialDir, component, 'index.scss'), 'utf8')
      const local = readFileSync(join(sourceDir, component, 'index.scss'), 'utf8')
      const tokens = [...original.matchAll(/\$(\w[\w-]*):\s*([^;]+);/g)]
      for (const token of tokens) expect(local, `${component}.${token[1]}`).toContain(`$${token[1]}: ${token[2]};`)
    }
    expect(cssRule('wd-swiper', '.wd-swiper__item')['flex-shrink']).toBe('0')
    expect(cssRule('wd-swiper', '.wd-swiper__item').position).toBe('relative')
    expect(cssRule('wd-swiper', '.wd-swiper__track-inner')['box-sizing']).toBe('border-box')
    expect(cssRule('wd-sticky', '.wd-sticky__placeholder')['flex-shrink']).toBe('0')
    expect(cssRule('wd-sticky-box', '.wd-sticky-box').position).toBe('relative')
    expect(cssRule('wd-index-bar', '.wd-index-bar__index-text')['font-size']).toBeDefined()
    expect(cssRule('wd-index-anchor', '.wd-index-anchor__text')['font-size']).toBeDefined()
    expect(cssRule('wd-swiper-nav', '.wd-swiper-nav__fraction-text').padding).toBeDefined()
    expect(cssRule('wd-swiper-nav', '.wd-swiper-nav__btn-icon .wd-icon__glyph')['font-size']).toBeDefined()
    expect(cssRule('wd-swiper-nav', '.wd-swiper-nav--fraction').background).toBeUndefined()
    expect(cssRule('wd-backtop', '.wd-backtop').position).toBe('fixed')
    expect(cssRule('wd-backtop', '.wd-backtop').width).toBeDefined()
    expect(cssRule('wd-backtop', '.wd-backtop .wd-backtop__backicon .wd-icon__glyph')['font-size']).toBeDefined()
  })
  it('does not disguise unsupported native animation timing, circular gestures or platform factories as real parity', () => {
    const source = readFileSync(join(sourceDir, 'wd-swiper', 'wd-swiper.vue'), 'utf8')
    expect(source).not.toMatch(/:scroll-with-animation/)
    expect(source).toContain('scrollViewTo(')
    const declaration = readFileSync(join(__dirname, '..', '..', '..', 'node_modules', '.pnpm', '@lynx-js+web-elements@0.12.0_tslib@2.8.1', 'node_modules', '@lynx-js', 'web-elements', 'dist', 'elements', 'ScrollView', 'ScrollView.d.ts'), 'utf8')
    expect(declaration).toContain('smooth?: boolean')
    expect(declaration).not.toMatch(/duration|easing|circular/)
    expect(hasUniAdapter('createIntersectionObserver')).toBe(false)
    expect(hasUniAdapter('createVideoContext')).toBe(false)
    expect(hasUniAdapter('pageScrollTo')).toBe(false)
  })
})

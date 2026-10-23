import { afterEach, describe, expect, it } from 'vitest'
import { h, ref } from 'vue-lynx'
import { cleanup, render } from './render'
import { fireEvent } from './fire-event'
import { pause } from '../src/common/util'
import Overlay from '../src/primitives/wd-overlay/wd-overlay.vue'
import Popup from '../src/primitives/wd-popup/wd-popup.vue'
import ImagePreview from '../src/components/wd-image-preview/wd-image-preview.vue'
import VideoPreview from '../src/components/wd-video-preview/wd-video-preview.vue'
import Swiper from '../src/components/wd-swiper/wd-swiper.vue'
import Popover from '../src/components/wd-popover/wd-popover.vue'
import Tooltip from '../src/components/wd-tooltip/wd-tooltip.vue'

import { usePopover } from '../src/composables/usePopover'
import Dialog from '../src/components/wd-dialog/wd-dialog.vue'
import Collapse from '../src/components/wd-collapse/wd-collapse.vue'
import CollapseItem from '../src/components/wd-collapse-item/wd-collapse-item.vue'

const restores: Array<() => void> = []
afterEach(() => {
  cleanup()
  restores.splice(0).forEach((restore) => restore())
})

function mockRects(rectFor: (selector: string) => Record<string, number>) {
  const lynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const original = lynx.createSelectorQuery
  const calls: string[] = []
  lynx.createSelectorQuery = () => ({
    select: (selector: string) => ({
      invoke: (options: any) => {
        calls.push(selector)
        const rect = rectFor(selector)
        options.success?.(rect)
        return { exec() {} }
      }
    })
  })
  restores.push(() => { lynx.createSelectorQuery = original })
  return calls
}
async function frames(count = 4) {
  for (let index = 0; index < count; index++) await pause()
}
function renderExposed(component: any, props: any = {}, slots?: any) {
  const exposed = ref<any>()
  const result = render({ setup: () => () => h(component, { ...props, ref: exposed }, slots) } as any)
  return { ...result, exposed }
}

describe('wot 2.3.2 overlays and previews parity', () => {
  it('overlay accepts object customStyle and forwards native tap once to each compatibility event', async () => {
    const clicks: any[] = []
    const taps: any[] = []
    const { container } = render(Overlay, { show: true, customStyle: { opacity: '0.7', 'padding-top': '11px' }, onClick: (e: any) => clicks.push(e), onTap: (e: any) => taps.push(e) })
    await frames()
    const mask = container.querySelector('.wd-overlay')!
    expect(mask.getAttribute('style')).toContain('padding-top: 11px')
    fireEvent.tap(mask)
    expect(clicks).toHaveLength(1)
    expect(taps).toHaveLength(1)
  })

  it('popup respects closeOnClickModal=false while reporting the modal tap', async () => {
    const updates: any[] = []
    const clicks: any[] = []
    const { container } = render(Popup, { modelValue: true, closeOnClickModal: false, 'onUpdate:modelValue': (v: any) => updates.push(v), onClickModal: () => clicks.push(1) })
    await frames()
    fireEvent.tap(container.querySelector('.wd-overlay')!)
    expect(clicks).toEqual([1])
    expect(updates).toEqual([])
  })

  it('image preview no-argument open reads props images, aspectFit, loop and indicator slot', async () => {
    const { container, exposed } = renderExposed(ImagePreview, { images: ['https://example.com/one.png', 'https://example.com/two.png'], startPosition: 1, loop: false, closeOnClick: false }, {
      indicator: ({ current, total }: any) => h('text', { class: 'custom-index' }, `${current}:${total}`)
    })
    exposed.value.open()
    await frames()
    const images = container.querySelectorAll('.wd-swiper__image')
    expect(images).toHaveLength(2)
    expect(images[0].getAttribute('src')).toBe('https://example.com/one.png')
    expect(images[0].getAttribute('mode')).toBe('aspectFit')
    expect(container.querySelector('.custom-index')!.textContent).toBe('1:2')
    expect(container.querySelector('.wd-swiper-nav')).toBeNull()
    fireEvent.tap(images[1])
    await frames(1)
    expect(container.querySelector('.wd-overlay')!.className).not.toContain('leave-active')
  })

  it('image preview per-call options and callbacks do not leak into the next open', async () => {
    const opened: number[] = []
    const closed: number[] = []
    const changed: number[] = []
    const presses: string[] = []
    const { container, exposed } = renderExposed(ImagePreview, { images: ['https://example.com/base.png'] })
    exposed.value.open({ images: ['https://example.com/one.png', 'https://example.com/two.png'], startPosition: 99, closeable: false, showIndex: false, closeOnClick: false, zIndex: 4321, onOpen: () => opened.push(1), onClose: () => closed.push(1), onChange: (index: number) => changed.push(index), onLongPress: (url: string) => presses.push(url) })
    await frames()
    expect(opened).toEqual([1])
    expect(container.querySelector('.wd-image-preview__close')).toBeNull()
    expect(container.querySelector('.wd-image-preview__index')).toBeNull()
    expect(container.querySelector('.wd-overlay')!.getAttribute('style')).toContain('z-index: 4321')
    exposed.value.setActive(0)
    await frames(1)
    expect(changed).toEqual([0])
    fireEvent.longpress(container.querySelector('.wd-swiper__image')!)
    expect(presses).toEqual(['https://example.com/one.png'])
    fireEvent.tap(container.querySelector('.wd-overlay')!)
    await frames(1)
    expect(closed).toEqual([])
    exposed.value.close()
    await frames(1)
    expect(closed).toEqual([1])
    exposed.value.open()
    await frames()
    expect(container.querySelector('.wd-image-preview__close')).not.toBeNull()
    expect(container.querySelector('.wd-swiper__image')!.getAttribute('src')).toBe('https://example.com/base.png')
  })

  it('video open honors per-call zIndex/fullScreen/closePosition and invokes callbacks only once', async () => {
    const opened: any[] = []
    const closed: any[] = []
    const { container, exposed } = renderExposed(VideoPreview, { zIndex: 1005 })
    exposed.value.open({ url: 'https://example.com/test.mp4', zIndex: 2345, fullScreen: true, closePosition: 'right-top', onOpen: () => opened.push(1), onClose: () => closed.push(1) })
    await frames()
    expect(container.querySelector('.wd-overlay')!.getAttribute('style')).toContain('z-index: 2345')
    expect(container.querySelector('.wd-video-preview__video.is-fullscreen')).not.toBeNull()
    expect(container.querySelector('.wd-video-preview__close.is-right-top')).not.toBeNull()
    expect(opened).toEqual([1])
    exposed.value.close()
    await frames(1)
    expect(closed).toEqual([1])
  })

  it.each([['popover', Popover], ['tooltip', Tooltip]])('%s honors an initial true controlled model', async (name, component) => {
    const { container } = render(component as any, { modelValue: true, content: 'hello' })
    await frames()
    expect(container.querySelector(`.wd-${name}__backdrop`)).not.toBeNull()
    expect(container.querySelector(`.wd-${name}__pos.wd-transition`)).not.toBeNull()
  })

  it('popover remeasures target and content even when content size stays unchanged', async () => {
    let targetWidth = 40
    let targetHeight = 20
    const calls = mockRects((selector) => ({ left: 10, top: 20, right: 10 + targetWidth, bottom: 20 + targetHeight, width: selector.endsWith('-target') ? targetWidth : 90, height: selector.endsWith('-target') ? targetHeight : 50 }))
    let popover: ReturnType<typeof usePopover>
    render({ setup() {
      popover = usePopover()
      return () => h('view')
    } } as any)
    popover!.init('bottom', true, 'popover')
    popover!.control('bottom', 0)
    await popover!.updatePosition('bottom', 0)
    expect(popover!.popStyle.value.left).toBe('20px')
    expect(popover!.popStyle.value.top).toBe('34px')
    const previousCalls = calls.length
    targetWidth = 80
    targetHeight = 40
    await popover!.updatePosition('bottom', 0)
    expect(calls.slice(previousCalls)).toEqual([`#${popover!.ids.target}`, `#${popover!.ids.content}`])
    expect(popover!.popStyle.value.left).toBe('40px')
    expect(popover!.popStyle.value.top).toBe('54px')
    popover!.init('left-start', false, 'popover')
    await popover!.updatePosition('left-start', [10, 0])
    expect(popover!.popStyle.value.right).toBe('85px')
    expect(popover!.popStyle.value.left).toBe('')
    expect(popover!.popStyle.value.transform).toBe('')
    expect(popover!.popStyle.value.top).toBe('0px')
  })

  it('collapse false interceptor blocks model updates and approval runs once', async () => {
    let allowed = false
    const value = ref<string[]>([])
    const changes: any[] = []
    const calls: string[] = []
    const { container } = render({ setup: () => () => h(Collapse, { modelValue: value.value, 'onUpdate:modelValue': (v: string[]) => { value.value = v; changes.push(v) } }, {
      default: () => h(CollapseItem, { name: 'one', title: 'title', beforeExpend: (name: string) => { calls.push(name); return Promise.resolve(allowed) } }, { default: () => h('text', null, 'body') })
    }) } as any)
    await frames(2)
    fireEvent.tap(container.querySelector('.wd-collapse-item__header')!)
    await frames(2)
    expect(changes).toEqual([])
    expect(calls).toEqual(['one'])
    allowed = true
    fireEvent.tap(container.querySelector('.wd-collapse-item__header')!)
    await frames(3)
    expect(changes).toEqual([['one']])
    expect(calls).toEqual(['one', 'one'])
    const wrapper = container.querySelector('.wd-collapse-item__wrapper')!
    fireEvent.transitionend(wrapper)
    await frames(1)
    expect(wrapper.getAttribute('style')).toContain('height: auto')
  })

  it('collapse keeps an initially selected body at natural height after expansion transition', async () => {
    mockRects(() => ({ left: 0, top: 0, right: 100, bottom: 72, width: 100, height: 72 }))
    const { container } = render({ setup: () => () => h(Collapse, { modelValue: ['one'] }, { default: () => h(CollapseItem, { name: 'one' }, { default: () => h('text', null, 'body') }) }) } as any)
    await frames(3)
    const wrapper = container.querySelector('.wd-collapse-item__wrapper')!
    expect(wrapper.getAttribute('style')).toContain('height: 72px')
    fireEvent.transitionend(wrapper)
    await frames(1)
    expect(wrapper.getAttribute('style')).toContain('height: auto')
  })

  it('swiper keeps programmatic current and indicator in range when list shrinks to empty', async () => {
    const list = ref(['a.png', 'b.png', 'c.png'])
    const current = ref(2)
    const changes: any[] = []
    const { container } = render({ setup: () => () => h(Swiper, { list: list.value, current: current.value, loop: false, autoplay: false, onChange: (detail: any) => changes.push(detail) }, {
      indicator: ({ current, total }: any) => h('text', { class: 'swiper-index' }, `${current}:${total}`)
    }) } as any)
    current.value = -9
    await frames(1)
    expect(container.querySelector('.swiper-index')!.textContent).toBe('0:3')
    expect(changes).toEqual([{ current: 0, source: '' }])
    list.value = []
    await frames(1)
    expect(container.querySelector('.swiper-index')!.textContent).toBe('0:0')
  })
})

/** Indicator geometry is checked at the native style outlet, not by a CSS string fragment. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import Tabs from '@wot-lynx/primitives/wd-tabs'
import Tab from '@wot-lynx/primitives/wd-tab'
import { restoreNativeStubs, stubNativeQuery } from '../helpers/native-stubs'

const empty = { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 }
const rect = (left: number, width: number, height = 44) => ({ left, width, height, top: 0, right: left + width, bottom: height })
function geometry(widths: number[], origin = 30) {
  return (selector: string) => {
    if (selector.endsWith('-nav')) return rect(origin, 390)
    const item = /-(item|text)-(\d+)$/.exec(selector)
    if (!item) return rect(origin, 390)
    const index = Number(item[2])
    const left = origin + widths.slice(0, index).reduce((a, b) => a + b, 0)
    return item[1] === 'text' ? rect(left + 16, widths[index] - 32, 24) : rect(left, widths[index])
  }
}
async function flush() { await nextTick(); await nextTick(); await Promise.resolve(); await nextTick() }
function anchor(container: Element) { return container.querySelector('.wd-tabs__line-anchor') as HTMLElement }
function line(container: Element) { return container.querySelector('.wd-tabs__line') as HTMLElement }
const panels = () => [h(Tab, { title: '浙江省', name: 'province' }), h(Tab, { title: '杭州市', name: 'city' }), h(Tab, { title: '西湖区', name: 'district' })]

afterEach(() => { cleanup(); restoreNativeStubs(); vi.useRealTimers() })

describe('wd-tabs indicator line geometry', () => {
  it('waits for valid layout, then anchors to the active item with only one pixel translation', async () => {
    vi.useFakeTimers()
    let ready = false
    const resolve = geometry([96, 84, 110])
    const native = stubNativeQuery(selector => ready ? resolve(selector) : empty)
    const { container } = render({ setup: () => () => h(Tabs, { modelValue: 'city' }, panels) })
    await vi.advanceTimersByTimeAsync(1)
    expect(anchor(container), 'the line needs its own layout-centering anchor').not.toBeNull()
    expect(anchor(container).style.display).toBe('none')
    ready = true
    await vi.advanceTimersByTimeAsync(160)
    expect(anchor(container).style.display).toBe('flex')
    expect(anchor(container).style.width).toBe('84px')
    expect(anchor(container).style.height).toBe('44px')
    expect(anchor(container).style.transform).toBe('translateX(96px)')
    expect(line(container).style.transform).toBe('none')
    expect(line(container).style.width).toBe('') // class/theme owns the short line width
    expect(native.calls.some(call => call.selector.endsWith('-nav'))).toBe(true)
  })

  it.each([false, true])('restored district points to the third label (sticky=%s)', async sticky => {
    stubNativeQuery(geometry([96, 84, 110], 75))
    const { container } = render({ setup: () => () => h(Tabs, { modelValue: 'district', sticky }, panels) })
    await flush()
    expect(container.querySelector('.wd-tabs__nav-item.is-active')!.textContent).toBe('西湖区')
    expect(anchor(container).style.transform).toBe('translateX(180px)')
    expect(anchor(container).style.width).toBe('110px')
    expect(line(container).style.transform).toBe('none')
  })

  it('uses actual relative positions, including header gaps instead of summing preceding widths', async () => {
    stubNativeQuery(selector => {
      if (selector.endsWith('-nav')) return rect(50, 390)
      const match = /-item-(\d+)$/.exec(selector)
      return match ? rect([64, 184, 302][Number(match[1])], [92, 86, 94][Number(match[1])]) : empty
    })
    const { container } = render({ setup: () => () => h(Tabs, { modelValue: 'district' }, panels) })
    await flush()
    expect(anchor(container).style.transform).toBe('translateX(252px)') // 302 - 50, not 92 + 86
    expect(anchor(container).style.width).toBe('94px')
  })

  it('refreshes same-count title changes and keeps custom line dimensions independent from the anchor', async () => {
    vi.useFakeTimers()
    const titles = ref(['浙江省', '杭州市', '西湖区'])
    const widths = [96, 84, 110]
    stubNativeQuery(geometry(widths))
    const { container } = render({ setup: () => () => h(Tabs, { modelValue: 2, lineWidth: 17, lineHeight: 3 }, () => titles.value.map((title, name) => h(Tab, { key: name, title, name }))) })
    await vi.advanceTimersByTimeAsync(1)
    expect(anchor(container).style.transform).toBe('translateX(180px)')
    widths[0] = 140
    titles.value[0] = '广西壮族自治区'
    await vi.advanceTimersByTimeAsync(1)
    expect(anchor(container).style.transform).toBe('translateX(224px)')
    expect(line(container).style.width).toBe('17px')
    expect(line(container).style.height).toBe('3px')
  })

  it('refreshes changed layout once, not continuously on scroll or identical layout notifications', async () => {
    let origin = 30
    const widths = [96, 84, 110]
    const native = stubNativeQuery(selector => geometry(widths, origin)(selector))
    const { container } = render({ setup: () => () => h(Tabs, { modelValue: 'district' }, panels) })
    await flush()
    const nav = container.querySelector('.wd-tabs__nav-container')!
    fireEvent.layoutchange(nav, { detail: { width: 390, height: 44 } })
    await flush()
    const before = native.calls.length
    origin = 80
    widths[0] = 120
    fireEvent.layoutchange(nav, { detail: { width: 450, height: 44 } })
    await flush()
    expect(anchor(container).style.transform).toBe('translateX(204px)')
    expect(native.calls.length).toBeGreaterThan(before)
    const settled = native.calls.length
    fireEvent.layoutchange(nav, { detail: { width: 450, height: 44 } })
    await flush()
    expect(native.calls.length).toBe(settled)
  })

  it('stops retrying after unmount and does not mutate a detached anchor', async () => {
    vi.useFakeTimers()
    stubNativeQuery(() => empty)
    const mounted = render({ setup: () => () => h(Tabs, { modelValue: 'city' }, panels) })
    await vi.advanceTimersByTimeAsync(1)
    const element = anchor(mounted.container)
    const before = element.getAttribute('style')
    mounted.unmount()
    await vi.advanceTimersByTimeAsync(1000)
    expect(element.getAttribute('style')).toBe(before)
  })
})

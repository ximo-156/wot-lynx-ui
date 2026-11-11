import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '@wot-lynx/core/common/util'
import Slider from '@wot-lynx/ui-form/wd-slider'

const styleOf = (el: Element): string => el.getAttribute('style') || ''
const restores: Array<() => void> = []

function installRects(width = 200) {
  const bgLynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const origin = bgLynx.createSelectorQuery
  bgLynx.createSelectorQuery = () => ({
    select: () => ({
      invoke: (params: any) => {
        params.success?.({ id: '', left: 0, top: 0, right: width, bottom: 44, width, height: 44 })
        return { exec: () => {} }
      }
    })
  })
  restores.push(() => { bgLynx.createSelectorQuery = origin })
}

function renderSlider(initial = 50) {
  const updates: number[] = []
  const changes: number[] = []
  const lifecycle: string[] = []
  const { container } = render({
    setup() {
      const value = ref(initial)
      return () => h(Slider as any, {
        modelValue: value.value,
        'onUpdate:modelValue': (next: number) => { value.value = next; updates.push(next) },
        onChange: (next: number) => changes.push(next),
        onDragstart: () => lifecycle.push('start'),
        onDragmove: () => lifecycle.push('move'),
        onDragend: () => lifecycle.push('end')
      })
    }
  } as any)
  return { container, updates, changes, lifecycle }
}

const point = (x: number) => ({ clientX: x, clientY: 0, identifier: 1 })

describe('wd-slider MTS：单个图标触摸事件沿真实响应链派发', () => {
  afterEach(() => {
    cleanup()
    restores.splice(0).reverse().forEach((restore) => restore())
  })

  it('MT 每帧直画，BG 持续更新与最终提交；不人工补发 line/bar 事件', async () => {
    installRects()
    const { container, updates, changes, lifecycle } = renderSlider()
    await pause(50)
    const icon = container.querySelector('.wd-slider__dot-slider text')!
    const line = container.querySelector('.wd-slider__line')!
    fireEvent.touchstart(icon, { touches: [point(100)], timestamp: 1000, bubbles: true })
    await pause(10)
    expect(styleOf(line)).toMatch(/width:\s*50%/)
    fireEvent.touchmove(icon, { touches: [point(150)], timestamp: 1100, bubbles: true })
    // 后台更新尚未 flush，宽度已经由 worklet 同步画到 75%。
    expect(styleOf(line)).toMatch(/width:\s*75%/)
    await pause(10)
    expect(updates).toEqual([75])
    expect(lifecycle).toEqual(['start', 'move'])
    fireEvent.touchend(icon, { touches: [], changedTouches: [point(150)], timestamp: 1200, bubbles: true })
    await pause(50)
    expect(changes).toEqual([75])
    expect(lifecycle).toEqual(['start', 'move', 'end'])
    expect(styleOf(line)).toMatch(/width:\s*75%/)
  })

  it('松手后补发的按下坐标 tap 不覆盖终值；下一次真正点按仍能跳转', async () => {
    installRects()
    const { container, updates, changes } = renderSlider()
    await pause(50)
    const icon = container.querySelector('.wd-slider__dot-slider text')!
    const bar = container.querySelector('.wd-slider__bar')!
    fireEvent.touchstart(icon, { touches: [point(100)], timestamp: 1000, bubbles: true })
    await pause(10)
    fireEvent.touchmove(icon, { touches: [point(150)], timestamp: 1100, bubbles: true })
    await pause(10)
    fireEvent.touchend(icon, { touches: [], changedTouches: [point(150)], timestamp: 1200, bubbles: true })
    await pause(30)
    expect(updates.at(-1)).toBe(75)
    fireEvent.tap(bar, { detail: { x: 100, y: 0 } })
    await pause(60)
    expect(updates.at(-1)).toBe(75)
    expect(changes).toEqual([75])

    fireEvent.touchstart(bar, { touches: [point(160)] })
    fireEvent.touchend(bar, { touches: [], changedTouches: [point(160)] })
    fireEvent.tap(bar, { detail: { x: 160, y: 0 } })
    await pause(60)
    expect(updates.at(-1)).toBe(80)
  })

  it('单独点按轨道仍按点击坐标跳转', async () => {
    installRects()
    const { container, updates } = renderSlider()
    await pause(50)
    fireEvent.tap(container.querySelector('.wd-slider__bar')!, { detail: { x: 150, y: 0 } })
    await pause(60)
    expect(updates.at(-1)).toBe(75)
  })
})

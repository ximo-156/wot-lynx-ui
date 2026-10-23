import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'
import Slider from '../../src/components/wd-slider/wd-slider.vue'

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

/** 主线程几何 stub：轨道 left=0, width=200（与后台 getRect stub 对齐） */
function installRects(width = 200) {
  ;(globalThis as any).__wdRectStub = () => ({
    id: '', left: 0, top: 0, right: width, bottom: 44, width, height: 44
  })
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
  return () => {
    delete (globalThis as any).__wdRectStub
    bgLynx.createSelectorQuery = origin
  }
}

describe('wd-slider MTS 跟手', () => {
  afterEach(() => cleanup())

  it('touchmove 经主线程 worklet 直改进度条；touchend 后台落定 commit', async () => {
    const restore = installRects(200)
    const updates: any[] = []
    const changes: any[] = []
    const drags: string[] = []
    const { container } = render({
      setup() {
        const value = ref(50)
        return () =>
          h(Slider as any, {
            modelValue: value.value,
            min: 0,
            max: 100,
            step: 1,
            'onUpdate:modelValue': (v: any) => {
              value.value = v
              updates.push(v)
            },
            onChange: (v: any) => changes.push(v),
            onDragstart: () => drags.push('start'),
            onDragend: () => drags.push('end'),
            onDragmove: () => drags.push('move')
          })
      }
    } as any)
    await pause(50)

    const bar = container.querySelector('.wd-slider__bar')!
    const dot = container.querySelector('.wd-slider__dot')!
    const line = container.querySelector('.wd-slider__line')!

    // 手势开始：轨道主线程 touchstart 度量几何
    fireEvent.touchstart(bar, { touches: [{ clientX: 100, clientY: 0 }] })
    await pause(10)

    // 滑块后台 touchstart（dragstart）
    fireEvent.touchstart(dot, { touches: [{ clientX: 100, clientY: 0 }] })
    // 跟手：主线程 worklet 应把进度条直改到 50%（value=50 → clientX=100/200）
    fireEvent.touchmove(dot, { touches: [{ clientX: 100, clientY: 0 }] })
    await pause(10)
    console.log('LINE-STYLE-AFTER-MOVE:', styleOf(line))
    expect(styleOf(line)).toMatch(/width:\s*50%/)

    // 拖到 75%：worklet 跟手到 75%
    fireEvent.touchmove(dot, { touches: [{ clientX: 150, clientY: 0 }] })
    await pause(10)
    expect(styleOf(line)).toMatch(/width:\s*75%/)

    // dragmove：真机上滑块的主线程 touchmove 不拦冒泡、继续上浮到轨道，
    // 后台处理器经 isDragging 守卫派发；jsdom 不模拟冒泡，直接派发到轨道
    // （等价冒泡结果）验证处理器逻辑
    fireEvent.touchmove(bar, { touches: [{ clientX: 150, clientY: 0 }] })
    await pause(10)
    expect(drags).toContain('move')

    // 落定：后台 touchend 以同一公式重算并 commit
    fireEvent.touchend(dot, { touches: [], changedTouches: [{ clientX: 150, clientY: 0 }] })
    await pause(50)
    expect(updates[updates.length - 1]).toBe(75)
    expect(changes[changes.length - 1]).toBe(75)
    expect(drags).toContain('start')
    expect(drags).toContain('end')
    restore()
  })
})

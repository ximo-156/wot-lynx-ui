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

/** 挂载受控 Slider（模拟 v-model），收集 update:modelValue / change */
function renderSlider(options: { modelValue: number; updates: any[]; changes: any[] }) {
  return render({
    setup() {
      const value = ref(options.modelValue)
      return () =>
        h(Slider as any, {
          modelValue: value.value,
          min: 0,
          max: 100,
          step: 1,
          'onUpdate:modelValue': (v: any) => {
            value.value = v
            options.updates.push(v)
          },
          onChange: (v: any) => options.changes.push(v)
        })
    }
  } as any)
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

    // 手势开始：进度条上的主线程 touchstart 度量几何（真机上从滑块冒泡上来；
    // MT 绑定挂在 __line 而非带 @tap 的 __bar，见 CONVENTIONS §19 差异 #4）
    fireEvent.touchstart(line, { touches: [{ clientX: 100, clientY: 0 }] })
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

  /**
   * 真机 2026-10-27 缺陷：拖动松手后滑块回弹到原位。
   *
   * 成因：Lynx 引擎在 touchend 之后补发一次 tap（wd-rate 里已有同类观测），
   * 而这次 tap 携带的是**按下时**的坐标。轨道的 @tap 是「点轨道跳转」，于是
   * 松手瞬间按按下坐标把值重算一遍 → 无论怎么拖都弹回起点。
   */
  it('拖动落定后引擎补发的 tap（按下时坐标）不得把值拉回起点', async () => {
    const restore = installRects(200)
    const updates: any[] = []
    const changes: any[] = []
    const { container } = renderSlider({ modelValue: 50, updates, changes })
    await pause(50)

    const bar = container.querySelector('.wd-slider__bar')!
    const dot = container.querySelector('.wd-slider__dot')!
    const line = container.querySelector('.wd-slider__line')!

    // 按下在 clientX=100（值 50），拖到 150（值 75）后松手
    fireEvent.touchstart(line, { touches: [{ clientX: 100, clientY: 0 }] })
    await pause(10)
    fireEvent.touchstart(dot, { touches: [{ clientX: 100, clientY: 0 }] })
    fireEvent.touchmove(dot, { touches: [{ clientX: 150, clientY: 0 }] })
    fireEvent.touchmove(bar, { touches: [{ clientX: 150, clientY: 0 }] })
    await pause(10)
    fireEvent.touchend(dot, { touches: [], changedTouches: [{ clientX: 150, clientY: 0 }] })
    await pause(30)
    expect(updates[updates.length - 1], '拖动应落定在 75').toBe(75)

    // 引擎补发 tap：坐标是按下时的 100 → 不拦就会重算回 50（回弹）
    fireEvent.tap(bar, { detail: { x: 100, y: 0 } })
    await pause(60)
    expect(updates[updates.length - 1], '补发的 tap 不得改写落定值').toBe(75)
    expect(changes[changes.length - 1], 'change 不得被补发的 tap 二次触发').toBe(75)

    // 标记不能残留：下一次真正的点按（先 touchstart 再 tap）仍要能跳转
    fireEvent.touchstart(bar, { touches: [{ clientX: 160, clientY: 0 }] })
    fireEvent.touchend(bar, { touches: [], changedTouches: [{ clientX: 160, clientY: 0 }] })
    fireEvent.tap(bar, { detail: { x: 160, y: 0 } })
    await pause(60)
    expect(updates[updates.length - 1], '拖动之后的点按仍应按点击位置跳转').toBe(80)
    restore()
  })

  it('未拖动的点按仍按点击坐标跳转（tap 抑制只作用于手势之后）', async () => {
    const restore = installRects(200)
    const updates: any[] = []
    const changes: any[] = []
    const { container } = renderSlider({ modelValue: 50, updates, changes })
    await pause(50)

    const bar = container.querySelector('.wd-slider__bar')!
    fireEvent.tap(bar, { detail: { x: 150, y: 0 } })
    await pause(60)
    expect(updates[updates.length - 1], '点轨道 75% 处应跳到 75').toBe(75)
    restore()
  })
})

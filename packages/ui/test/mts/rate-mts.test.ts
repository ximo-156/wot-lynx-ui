import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'
import Rate from '../../src/components/wd-rate/wd-rate.vue'

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

/** 星星几何：第 i 项 left=i*30 / right=i*30+24 / width=24（与后台 getRect stub 对齐） */
const NUM = 5
const ITEM_W = 24
const STRIDE = 30

const rectOf = (index: number) => ({
  id: '',
  left: index * STRIDE,
  top: 0,
  right: index * STRIDE + ITEM_W,
  bottom: ITEM_W,
  width: ITEM_W,
  height: ITEM_W
})

/** 主线程几何 stub：按元素在父节点中的序号返回矩形（星星项父节点即根 view） */
function installRects() {
  ;(globalThis as any).__wdRectStub = (el: any) => {
    const parent = el && el.parentNode
    const index = parent ? Array.prototype.indexOf.call(parent.children, el) : 0
    return rectOf(Math.max(0, index))
  }
  const bgLynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const origin = bgLynx.createSelectorQuery
  bgLynx.createSelectorQuery = () => ({
    select: () => ({
      invoke: (params: any) => {
        params.success?.(rectOf(0))
        return { exec: () => {} }
      }
    }),
    selectAll: () => ({
      invoke: (params: any) => {
        params.success?.(Array.from({ length: NUM }, (_, i) => rectOf(i)))
        return { exec: () => {} }
      }
    }),
    exec: () => {}
  })
  return () => {
    delete (globalThis as any).__wdRectStub
    bgLynx.createSelectorQuery = origin
  }
}

describe('wd-rate MTS 跟手', () => {
  afterEach(() => cleanup())

  it('touchmove 经主线程 worklet 直改星星颜色；touchend 后台落定 commit', async () => {
    const restore = installRects()
    const updates: any[] = []
    const changes: any[] = []
    const moves: any[] = []
    const { container } = render({
      setup() {
        const value = ref(0)
        return () =>
          h(Rate as any, {
            modelValue: value.value,
            num: NUM,
            color: '#c9cbd4',
            activeColor: '#faad14',
            'onUpdate:modelValue': (v: any) => {
              value.value = v
              updates.push(v)
            },
            onChange: (e: any) => changes.push(e),
            onTouchmove: () => moves.push('move')
          })
      }
    } as any)
    await pause(50)

    const root = container.querySelector('.wd-rate')!
    const items = container.querySelectorAll('.wd-rate__item')
    const stars = container.querySelectorAll('.wd-rate__item-star')
    expect(items.length).toBe(NUM)
    expect(stars.length).toBe(NUM)

    // 手势开始：星星项主线程 touchstart 一次性度量全部星星矩形
    fireEvent.touchstart(items[0], { touches: [{ clientX: 0, clientY: 0 }] })
    await pause(10)

    // 跟手：触点落入第 3 颗星（x=80 ∈ [60,84]）→ 值 3 → 前 3 颗激活、后 2 颗未激活
    fireEvent.touchmove(items[0], { touches: [{ clientX: 80, clientY: 0 }] })
    await pause(10)
    expect(styleOf(stars[0]), '第 1 颗星应被 worklet 直改为激活色').toMatch(/color:\s*rgb\(250, 173, 20\)/)
    expect(styleOf(stars[2])).toMatch(/color:\s*rgb\(250, 173, 20\)/)
    expect(styleOf(stars[3]), '第 4 颗星应保持未激活色').toMatch(/color:\s*rgb\(201, 203, 212\)/)
    expect(styleOf(stars[4])).toMatch(/color:\s*rgb\(201, 203, 212\)/)

    // 拖动期间不提交值（提交类逻辑留后台 touchend）
    expect(updates.length).toBe(0)

    // 落定：真机上 touchend 自星星项冒泡到根 view，jsdom 不模拟冒泡，
    // 直接派发到父元素验证处理器逻辑（同 slider 的 dragmove 验证方式）
    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 80, clientY: 0 }] })
    await pause(50)
    expect(updates[updates.length - 1]).toBe(3)
    expect(changes[changes.length - 1]).toEqual({ value: 3 })

    // 根 view 的后台 touchmove 转发原生事件（emits 声明 + 转发，CONVENTIONS §14）
    fireEvent.touchmove(root, { touches: [{ clientX: 80, clientY: 0 }] })
    await pause(10)
    expect(moves.length).toBe(1)

    restore()
  })

  it('allowHalf：左半触点直改半星激活、主星未激活', async () => {
    const restore = installRects()
    const updates: any[] = []
    const { container } = render({
      setup() {
        const value = ref(0)
        return () =>
          h(Rate as any, {
            modelValue: value.value,
            num: NUM,
            allowHalf: true,
            color: '#c9cbd4',
            activeColor: '#faad14',
            'onUpdate:modelValue': (v: any) => {
              value.value = v
              updates.push(v)
            }
          })
      }
    } as any)
    await pause(50)

    const root = container.querySelector('.wd-rate')!
    const items = container.querySelectorAll('.wd-rate__item')
    const mainStars = container.querySelectorAll('.wd-rate__item > .wd-rate__item-star')
    const halfStars = container.querySelectorAll('.wd-rate__item-half > .wd-rate__item-star')
    expect(mainStars.length).toBe(NUM)
    expect(halfStars.length).toBe(NUM)

    fireEvent.touchstart(items[0], { touches: [{ clientX: 0, clientY: 0 }] })
    await pause(10)

    // 触点落入第 3 颗星左半（x=70，中点 72）→ 值 2.5
    fireEvent.touchmove(items[0], { touches: [{ clientX: 70, clientY: 0 }] })
    await pause(10)
    expect(styleOf(mainStars[0]), '前 2 颗主星满激活').toMatch(/color:\s*rgb\(250, 173, 20\)/)
    expect(styleOf(mainStars[1])).toMatch(/color:\s*rgb\(250, 173, 20\)/)
    expect(styleOf(mainStars[2]), '第 3 颗主星未满').toMatch(/color:\s*rgb\(201, 203, 212\)/)
    expect(styleOf(halfStars[2]), '第 3 颗半星激活').toMatch(/color:\s*rgb\(250, 173, 20\)/)
    expect(styleOf(halfStars[3]), '第 4 颗半星未激活').toMatch(/color:\s*rgb\(201, 203, 212\)/)

    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 70, clientY: 0 }] })
    await pause(50)
    expect(updates[updates.length - 1]).toBe(2.5)

    restore()
  })

  it('touchcancel：与 touchend 同一公式落定 commit', async () => {
    const restore = installRects()
    const updates: any[] = []
    const cancels: any[] = []
    const { container } = render({
      setup() {
        const value = ref(0)
        return () =>
          h(Rate as any, {
            modelValue: value.value,
            num: NUM,
            color: '#c9cbd4',
            activeColor: '#faad14',
            'onUpdate:modelValue': (v: any) => {
              value.value = v
              updates.push(v)
            },
            onTouchcancel: () => cancels.push('cancel')
          })
      }
    } as any)
    await pause(50)

    const root = container.querySelector('.wd-rate')!
    const items = container.querySelectorAll('.wd-rate__item')

    fireEvent.touchstart(items[0], { touches: [{ clientX: 0, clientY: 0 }] })
    await pause(10)
    fireEvent.touchmove(items[0], { touches: [{ clientX: 80, clientY: 0 }] })
    await pause(10)
    // 手势被系统取消：touchcancel 冒泡到根 view，落定同一公式的值
    fireEvent.touchcancel(root, { touches: [], changedTouches: [{ clientX: 80, clientY: 0 }] })
    await pause(50)
    expect(updates[updates.length - 1]).toBe(3)
    expect(cancels.length).toBe(1)

    restore()
  })

  it('disabled：worklet 不跟手、touchend 不提交', async () => {
    const restore = installRects()
    const updates: any[] = []
    const { container } = render({
      setup() {
        const value = ref(1)
        return () =>
          h(Rate as any, {
            modelValue: value.value,
            num: NUM,
            disabled: true,
            color: '#c9cbd4',
            activeColor: '#faad14',
            'onUpdate:modelValue': (v: any) => {
              value.value = v
              updates.push(v)
            }
          })
      }
    } as any)
    await pause(50)

    const root = container.querySelector('.wd-rate')!
    const items = container.querySelectorAll('.wd-rate__item')
    const stars = container.querySelectorAll('.wd-rate__item-star')

    fireEvent.touchstart(items[0], { touches: [{ clientX: 0, clientY: 0 }] })
    await pause(10)
    fireEvent.touchmove(items[0], { touches: [{ clientX: 80, clientY: 0 }] })
    await pause(10)
    // 禁用态 worklet 直接返回：星星维持渲染态（第 1 颗激活、其余未激活）
    expect(styleOf(stars[0])).toMatch(/color:\s*rgb\(250, 173, 20\)/)
    expect(styleOf(stars[2]), '禁用态不跟手').toMatch(/color:\s*rgb\(201, 203, 212\)/)

    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 80, clientY: 0 }] })
    await pause(50)
    expect(updates.length).toBe(0)

    restore()
  })
})

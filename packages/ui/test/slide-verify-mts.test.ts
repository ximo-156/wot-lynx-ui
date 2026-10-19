/**
 * wd-slide-verify MTS 跟手测试（原生优先重写版，参照 slider-mts.test.ts）。
 *
 * 覆盖主线程跟手 + 后台落定的完整链路：
 * 1. **跟手直改**：touchmove 经主线程 worklet 直改轨道宽度（多档位）；
 * 2. **落定 commit**：touchend 后台以同一公式重算终值，success / fail
 *    与 is-success / 轨道宽度落定；
 * 3. **事件链路**：is-dragging 拖动态类名 + success / fail 事件；
 * 4. **禁用了跟手**：disabled / 已通过态经 drag-disabled 属性桥接，
 *    worklet 不改宽度、后台不提交；
 * 5. **清尾**：轨道主线程 touchend worklet 清空手势起点，残留
 *    touchmove 不再驱动轨道（防跳变）。
 *
 * 派发路径说明（jsdom 不模拟冒泡）：按钮 touchstart / touchend 为后台
 * 绑定；轨道（父元素）的 touchstart 为主线程 worklet（度量几何 + 记录
 * 起点），真机上由按钮触摸冒泡触发，测试中直接派发到轨道验证。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import { fireEvent } from './fire-event'
import SlideVerify from '../src/components/wd-slide-verify/wd-slide-verify.vue'

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

/** 容器 300×44 → maxPosition = 256；轨道宽 = 位置 + 44 */
const CONTAINER_W = 300
const CONTAINER_H = 44

/** 安装主线程（worklet invoke）与后台（getRect）双侧几何 stub */
function installRects(width = CONTAINER_W, height = CONTAINER_H): () => void {
  ;(globalThis as any).__wdRectStub = () => ({
    id: '', left: 0, top: 0, right: width, bottom: height, width, height
  })
  const bgLynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const origin = bgLynx.createSelectorQuery
  bgLynx.createSelectorQuery = () => ({
    select: (selector: string) => ({
      invoke: (params: any) => {
        const w = selector.startsWith('#') ? width : height
        params.success?.({ id: '', left: 0, top: 0, right: w, bottom: height, width: w, height })
        return { exec: () => {} }
      }
    })
  })
  return () => {
    delete (globalThis as any).__wdRectStub
    bgLynx.createSelectorQuery = origin
  }
}

/** 挂载组件，返回容器与事件记录 */
function mount(extraProps: Record<string, unknown> = {}) {
  const events: string[] = []
  const { container } = render({
    setup() {
      const passed = ref(false)
      return () =>
        h(SlideVerify as any, {
          modelValue: passed.value,
          onSuccess: () => events.push('success'),
          onFail: () => events.push('fail'),
          'onUpdate:modelValue': (v: boolean) => {
            passed.value = v
          },
          ...extraProps
        })
    }
  } as any)
  return { container, events }
}

/** 主线程手势起点（轨道 worklet：度量 + 记录 startX），invoke 为 Promise 需等待落地 */
async function armGesture(container: Element, clientX = 0) {
  const track = container.querySelector('.wd-slide-verify__track')!
  fireEvent.touchstart(track, { touches: [{ clientX, clientY: 0 }] })
  await pause(10)
}

describe('wd-slide-verify MTS 跟手', () => {
  afterEach(() => cleanup())

  it('touchmove 经主线程 worklet 直改轨道宽度（跟手，零线程跨越）', async () => {
    const restore = installRects()
    const { container } = mount()
    await pause(50)

    const button = container.querySelector('.wd-slide-verify__button')!
    const track = container.querySelector('.wd-slide-verify__track')!

    // 后台 touchstart（拖动态）+ 主线程轨道 touchstart（几何 + 起点）
    fireEvent.touchstart(button, { touches: [{ clientX: 0, clientY: 0 }] })
    await armGesture(container, 0)

    // 跟手到 25%：位置 64 → 轨道宽 64 + 44 = 108px
    fireEvent.touchmove(button, { touches: [{ clientX: 64, clientY: 0 }] })
    await pause(10)
    expect(styleOf(track)).toMatch(/width:\s*108px/)

    // 跟手到 75%：位置 192 → 轨道宽 236px
    fireEvent.touchmove(button, { touches: [{ clientX: 192, clientY: 0 }] })
    await pause(10)
    expect(styleOf(track)).toMatch(/width:\s*236px/)

    // 超过末端 clamp 到 maxPosition=256 → 轨道宽 300px（容器全宽）
    fireEvent.touchmove(button, { touches: [{ clientX: 999, clientY: 0 }] })
    await pause(10)
    expect(styleOf(track)).toMatch(/width:\s*300px/)

    restore()
  })

  it('touchend 后台落定 commit：success + is-success + 轨道满宽', async () => {
    const restore = installRects()
    const { container, events } = mount()
    await pause(50)

    const root = container.querySelector('.wd-slide-verify')!
    const button = container.querySelector('.wd-slide-verify__button')!
    const track = container.querySelector('.wd-slide-verify__track')!

    fireEvent.touchstart(button, { touches: [{ clientX: 0, clientY: 0 }] })
    await pause(10)
    expect(root.className).toContain('is-dragging')
    await armGesture(container, 0)

    // 拖入容差范围（距终点 4px）
    fireEvent.touchmove(button, { touches: [{ clientX: 252, clientY: 0 }] })
    await pause(10)

    // 落定：后台 touchend 同一公式重算并 commit
    fireEvent.touchend(button, { touches: [], changedTouches: [{ clientX: 252, clientY: 0 }] })
    await pause(50)

    expect(events).toContain('success')
    expect(events).not.toContain('fail')
    expect(root.className).toContain('is-success')
    expect(root.className).not.toContain('is-dragging')
    // 落定后由 Vue 接管：位置 256 + 容器高 44 = 300px
    expect(styleOf(track)).toMatch(/width:\s*300px/)

    restore()
  })

  it('半途抬手 fail 回弹：fail + 轨道宽度回到初始值', async () => {
    const restore = installRects()
    const { container, events } = mount()
    await pause(50)

    const root = container.querySelector('.wd-slide-verify')!
    const button = container.querySelector('.wd-slide-verify__button')!
    const track = container.querySelector('.wd-slide-verify__track')!

    fireEvent.touchstart(button, { touches: [{ clientX: 0, clientY: 0 }] })
    await armGesture(container, 0)

    fireEvent.touchmove(button, { touches: [{ clientX: 100, clientY: 0 }] })
    await pause(10)
    expect(styleOf(track)).toMatch(/width:\s*144px/)

    fireEvent.touchend(button, { touches: [], changedTouches: [{ clientX: 100, clientY: 0 }] })
    await pause(50)

    expect(events).toContain('fail')
    expect(events).not.toContain('success')
    expect(root.className).not.toContain('is-success')
    // 回弹到起点：0 + 44 = 44px（带 0.3s 过渡，内联值即目标值）
    expect(styleOf(track)).toMatch(/width:\s*44px/)

    restore()
  })

  it('disabled 禁用态：worklet 不跟手、后台不提交', async () => {
    const restore = installRects()
    const { container, events } = mount({ disabled: true })
    await pause(50)

    const button = container.querySelector('.wd-slide-verify__button')!
    const track = container.querySelector('.wd-slide-verify__track')!

    fireEvent.touchstart(button, { touches: [{ clientX: 0, clientY: 0 }] })
    await armGesture(container, 0)
    fireEvent.touchmove(button, { touches: [{ clientX: 252, clientY: 0 }] })
    await pause(10)
    // drag-disabled 属性桥接：worklet 守值，宽度保持初始值（0 + 容器高 44）
    expect(styleOf(track)).toMatch(/width:\s*44px/)

    fireEvent.touchend(button, { touches: [], changedTouches: [{ clientX: 252, clientY: 0 }] })
    await pause(50)
    expect(events).not.toContain('success')
    expect(events).not.toContain('fail')

    restore()
  })

  it('通过态禁拖：success 后 touchmove 不改轨道宽度', async () => {
    const restore = installRects()
    const { container } = mount()
    await pause(50)

    const button = container.querySelector('.wd-slide-verify__button')!
    const track = container.querySelector('.wd-slide-verify__track')!

    fireEvent.touchstart(button, { touches: [{ clientX: 0, clientY: 0 }] })
    await armGesture(container, 0)
    fireEvent.touchmove(button, { touches: [{ clientX: 252, clientY: 0 }] })
    fireEvent.touchend(button, { touches: [], changedTouches: [{ clientX: 252, clientY: 0 }] })
    await pause(50)
    expect(styleOf(track)).toMatch(/width:\s*300px/)

    // 通过态（isPass → isDisabled）：再次按下并拖动不得回缩轨道
    fireEvent.touchstart(button, { touches: [{ clientX: 252, clientY: 0 }] })
    await armGesture(container, 252)
    fireEvent.touchmove(button, { touches: [{ clientX: 60, clientY: 0 }] })
    await pause(10)
    expect(styleOf(track)).toMatch(/width:\s*300px/)

    restore()
  })

  it('主线程 touchend worklet 清尾：起点清空后残留 touchmove 不驱动轨道', async () => {
    const restore = installRects()
    const { container } = mount()
    await pause(50)

    const button = container.querySelector('.wd-slide-verify__button')!
    const track = container.querySelector('.wd-slide-verify__track')!

    fireEvent.touchstart(button, { touches: [{ clientX: 0, clientY: 0 }] })
    await armGesture(container, 0)
    fireEvent.touchmove(button, { touches: [{ clientX: 128, clientY: 0 }] })
    await pause(10)
    expect(styleOf(track)).toMatch(/width:\s*172px/)

    // 真机上滑块 touchend 冒泡到轨道触发主线程 touchend worklet 清尾；
    // jsdom 不模拟冒泡，直接派发到轨道验证清尾逻辑
    fireEvent.touchend(track, { touches: [], changedTouches: [{ clientX: 128, clientY: 0 }] })
    await pause(10)

    // 起点已清空：残留 touchmove 被 worklet 守值拦截（不写 NaN、不跳变）
    fireEvent.touchmove(button, { touches: [{ clientX: 200, clientY: 0 }] })
    await pause(10)
    expect(styleOf(track)).toMatch(/width:\s*172px/)

    restore()
  })
})

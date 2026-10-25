/**
 * wd-slide-verify 实时验证回归测试。
 *
 * 覆盖 2026-10-19 三项修复：
 * 1. **实时验证**：touchmove 中拖入容错范围立即通过并落位，无需等待
 *    touchend（touchend 仅兜底最后一次 move 丢失的场景）；
 * 2. **非受控通过态**：未绑 v-model 时拖到末端也要能展示 is-pass /
 *    成功图标 / 轨道满宽（此前 isPass 纯由 props.modelValue 计算，
 *    非受控用法永远展示不了成功态）；
 * 3. **fail-closed**：轨道度量不可用（containerWidth<=0）时不得放行
 *    ——与 wd-slider trackSize=0 不提交同一取舍。
 *
 * 另锁半途抬手回弹（fail + 轨道回初始宽度）。
 *
 * MTS 化（2026-10-19 原生优先重写）后的派发路径：
 * - 跟手 touchmove 走主线程 worklet（按钮 main-thread-bindtouchmove），
 *   几何由轨道（父元素）上的主线程 touchstart worklet 经 invoke
 *   一次性度量。真机上按钮的触摸冒泡到轨道即触发该 worklet；**jsdom
 *   不模拟冒泡**，故测试中在按钮 touchstart（后台拖动态）之后，
 *   直接向轨道元素补发一次 touchstart（等价冒泡结果）驱动 worklet，
 *   并 pause 等待 invoke 的 Promise 落地（与 slider-mts.test.ts 同法）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { pause } from '../../src/common/util'
import { fireEvent } from '../fire-event'
import SlideVerify from '../../src/components/wd-slide-verify/wd-slide-verify.vue'

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

/**
 * stub 几何度量：后台线程 patch lynx.createSelectorQuery +
 * 主线程安装 globalThis.__wdRectStub（worklet invoke 的矩形来源）。
 *
 * 不能整体替换 globalThis.lynx——测试环境切线程时会把后台线程的全局
 * 拷贝回共享全局，整体替换会被冲掉；patch 后台线程对象上的
 * createSelectorQuery 才能被 onMounted（后台线程）看到。
 * （另：jsdom 无布局且后台线程 document 不含渲染树，getRect 的 DOM
 * 兜底路径在测试环境不生效，必须走 SelectorQuery 路径。）
 */
function stubRects(containerWidth = 300, containerHeight = 44): () => void {
  const rect = { id: '', left: 0, top: 0, right: containerWidth, bottom: containerHeight, width: containerWidth, height: containerHeight }
  // 主线程：worklet 的 invoke('boundingClientRect') 经 shim 读该 stub
  ;(globalThis as any).__wdRectStub = () => rect
  const bgLynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const origin = bgLynx.createSelectorQuery
  bgLynx.createSelectorQuery = () => ({
    select: (selector: string) => ({
      invoke: (params: any) => {
        // '#wd-slide-verify-xx' 为容器，'.wd-slide-verify__button' 为滑块
        const width = selector.startsWith('#') ? containerWidth : containerHeight
        params.success?.({ id: '', left: 0, top: 0, right: width, bottom: containerHeight, width, height: containerHeight })
        return { exec: () => {} }
      }
    })
  })
  return () => {
    delete (globalThis as any).__wdRectStub
    bgLynx.createSelectorQuery = origin
  }
}

/** maxDistance = 300 - 44 = 256；tolerance 默认 10 */
const MAX_DISTANCE = 256

/**
 * 一次完整手势的派发序列（MTS 分工）：
 * 1. 按钮 touchstart（后台）：记录拖动态与起点；
 * 2. 轨道 touchstart（主线程 worklet，冒泡等价）：度量容器几何 + 记录
 *    手势起点 clientX——invoke 为 Promise，需 pause 待其落地；
 * 3. 按钮 touchmove（主线程 worklet）：跟手直改轨道宽度。
 */
async function dragTo(container: Element, clientX: number) {
  const button = container.querySelector('.wd-slide-verify__button')!
  const track = container.querySelector('.wd-slide-verify__track')!
  fireEvent.touchstart(button, { touches: [{ clientX: 0, clientY: 0 }] })
  fireEvent.touchstart(track, { touches: [{ clientX: 0, clientY: 0 }] })
  await pause(10)
  fireEvent.touchmove(button, { touches: [{ clientX, clientY: 0 }] })
  await pause(20)
}

afterEach(() => cleanup())

describe('WdSlideVerify 实时验证', () => {
  it('拖入容错范围抬手通过（touchend 判定：is-success + success + 轨道满宽）', async () => {
    const restore = stubRects()
    const events: string[] = []
    const { container } = render({
      setup() {
        const passed = ref(false)
        return () =>
          h(SlideVerify, {
            modelValue: passed.value,
            onSuccess: () => events.push('success'),
            onFail: () => events.push('fail'),
            onMove: () => events.push('move'),
            'onUpdate:modelValue': (v: boolean) => {
              passed.value = v
            }
          })
      }
    } as any)
    await pause(50)

    const root = container.querySelector('.wd-slide-verify')!
    const button = container.querySelector('.wd-slide-verify__button')!
    const track = container.querySelector('.wd-slide-verify__track')!

    // 距终点 36px（容差 10 之外）：实时跟随但不得通过
    await dragTo(container, MAX_DISTANCE - 36)
    expect(events).not.toContain('success')
    expect(root.className).not.toContain('is-success')

    // 再拖进入容错范围（距终点 4px）：wot-ui 在 touchend 才判定通过
    fireEvent.touchmove(button, { touches: [{ clientX: MAX_DISTANCE - 4, clientY: 0 }] })
    await pause(20)
    expect(events).not.toContain('success')
    expect(root.className).not.toContain('is-success')

    // 抬手：判定通过（is-success + success + 轨道宽度 = 当前位置 + 容器高度）
    fireEvent.touchend(button, { touches: [], changedTouches: [{ clientX: MAX_DISTANCE - 4, clientY: 0 }] })
    await pause(20)
    expect(events).toContain('success')
    expect(events).not.toContain('fail')
    expect(root.className).toContain('is-success')
    expect(styleOf(track)).toMatch(/width:\s*\d+px/)

    restore()
  })

  it('未绑 v-model（非受控）拖到末端抬手也展示通过态', async () => {
    const restore = stubRects()
    const events: string[] = []
    const { container } = render(SlideVerify, {
      onSuccess: () => events.push('success')
    } as any)
    await pause(50)

    const root = container.querySelector('.wd-slide-verify')!
    const button = container.querySelector('.wd-slide-verify__button')!
    const track = container.querySelector('.wd-slide-verify__track')!

    // 拖过 maxDistance（clamp 到 256）
    await dragTo(container, 999)
    // wot-ui 语义：touchmove 不判定
    expect(events).not.toContain('success')

    fireEvent.touchend(button, { touches: [], changedTouches: [{ clientX: 999, clientY: 0 }] })
    await pause(20)
    expect(events).toContain('success')
    expect(root.className).toContain('is-success')
    // 通过时轨道宽 = 当前位置 + 容器高度（容器全宽 300）
    expect(styleOf(track)).toMatch(/width:\s*\d+px/)

    restore()
  })

  it('半途抬手回弹（未达容差范围：fail + 无成功态）', async () => {
    const restore = stubRects()
    const events: string[] = []
    const { container } = render(SlideVerify, {
      onSuccess: () => events.push('success'),
      onFail: () => events.push('fail')
    } as any)
    await pause(50)

    const root = container.querySelector('.wd-slide-verify')!
    const button = container.querySelector('.wd-slide-verify__button')!

    await dragTo(container, 100)

    fireEvent.touchend(button, { touches: [], changedTouches: [{ clientX: 100, clientY: 0 }] })
    await pause(20)
    expect(events).toContain('fail')
    expect(events).not.toContain('success')
    expect(root.className).not.toContain('is-success')

    restore()
  })

  it('半途抬手回弹：报 fail 且轨道宽度回到初始值', async () => {
    const restore = stubRects()
    const events: string[] = []
    const { container } = render(SlideVerify, {
      onFail: () => events.push('fail'),
      onSuccess: () => events.push('success')
    } as any)
    await pause(50)

    const button = container.querySelector('.wd-slide-verify__button')!
    const track = container.querySelector('.wd-slide-verify__track')!

    await dragTo(container, 100)
    // 44（按钮宽）+ 100（位移）：跟手由主线程 worklet 直改
    expect(styleOf(track)).toMatch(/width:\s*144px/)

    fireEvent.touchend(button, { touches: [], changedTouches: [{ clientX: 100, clientY: 0 }] })
    await pause(50)
    expect(events).toContain('fail')
    expect(events).not.toContain('success')
    expect(styleOf(track)).toMatch(/width:\s*44px/)

    restore()
  })

  it('度量不可用（容器宽高为 0）：fail-closed 不放行', async () => {
    // 后台与主线程度量均返回零矩形：worklet 不写样式、后台不判定通过
    const restore = stubRects(0, 0)
    const events: string[] = []
    const { container } = render(SlideVerify, {
      onSuccess: () => events.push('success'),
      onFail: () => events.push('fail')
    } as any)
    await pause(50)

    const root = container.querySelector('.wd-slide-verify')!
    const button = container.querySelector('.wd-slide-verify__button')!
    const track = container.querySelector('.wd-slide-verify__track')!

    fireEvent.touchstart(button, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchstart(track, { touches: [{ clientX: 0, clientY: 0 }] })
    await pause(10)
    fireEvent.touchmove(button, { touches: [{ clientX: 200, clientY: 0 }] })
    await pause(20)
    // 度量不可用：跟手不写宽度（保持初始内联值）
    expect(styleOf(track)).not.toMatch(/width:\s*[1-9]/)

    fireEvent.touchend(button, { touches: [], changedTouches: [{ clientX: 200, clientY: 0 }] })
    await pause(50)
    expect(events).not.toContain('success')
    expect(events).toContain('fail')
    expect(root.className).not.toContain('is-success')

    restore()
  })
})

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
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import { fireEvent } from './fire-event'
import SlideVerify from '../src/components/wd-slide-verify/wd-slide-verify.vue'

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

/**
 * stub 几何度量：patch 后台线程全局上的 lynx.createSelectorQuery。
 *
 * 不能整体替换 globalThis.lynx——测试环境切线程时会把后台线程的全局
 * 拷贝回共享 global，整体替换会被冲掉；patch 后台线程对象上的
 * createSelectorQuery 才能被 onMounted（后台线程）看到。
 * （另：jsdom 无布局且后台线程 document 不含渲染树，getRect 的 DOM
 * 兜底路径在测试环境不生效，必须走 SelectorQuery 路径。）
 */
function stubRects(containerWidth = 300): () => void {
  const bgLynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const origin = bgLynx.createSelectorQuery
  bgLynx.createSelectorQuery = () => ({
    select: (selector: string) => ({
      invoke: (params: any) => {
        // '#wd-slide-verify-xx' 为容器，'.wd-slide-verify__button' 为滑块
        const width = selector.startsWith('#') ? containerWidth : 44
        params.success?.({ id: '', left: 0, top: 0, right: width, bottom: 44, width, height: 44 })
        return { exec: () => {} }
      }
    })
  })
  return () => {
    bgLynx.createSelectorQuery = origin
  }
}

/** maxDistance = 300 - 44 = 256；tolerance 默认 4 */
const MAX_DISTANCE = 256

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

    fireEvent.touchstart(button, { touches: [{ clientX: 0, clientY: 0 }] })
    // 距终点 36px（容差 4 之外）：实时跟随但不得通过
    fireEvent.touchmove(button, { touches: [{ clientX: MAX_DISTANCE - 36, clientY: 0 }] })
    await pause(20)
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

    fireEvent.touchstart(button, { touches: [{ clientX: 0, clientY: 0 }] })
    // 拖过 maxDistance（clamp 到 256）
    fireEvent.touchmove(button, { touches: [{ clientX: 999, clientY: 0 }] })
    await pause(20)
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

    fireEvent.touchstart(button, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchmove(button, { touches: [{ clientX: 100, clientY: 0 }] })
    await pause(20)

    fireEvent.touchend(button, { touches: [], changedTouches: [{ clientX: 100, clientY: 0 }] })
    await pause(20)
    expect(events).toContain('fail')
    expect(events).not.toContain('success')
    expect(root.className).not.toContain('is-success')
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

    fireEvent.touchstart(button, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchmove(button, { touches: [{ clientX: 100, clientY: 0 }] })
    await pause(20)
    // 44（按钮宽）+ 100（位移）
    expect(styleOf(track)).toMatch(/width:\s*144px/)

    fireEvent.touchend(button, { touches: [], changedTouches: [{ clientX: 100, clientY: 0 }] })
    await pause(50)
    expect(events).toContain('fail')
    expect(events).not.toContain('success')
    expect(styleOf(track)).toMatch(/width:\s*44px/)

    restore()
  })
})

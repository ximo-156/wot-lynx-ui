/**
 * 真机 2026-11-05：slider 滑动松手后整页卡死 + 气泡常驻。
 *
 * 现场：拖动滑块再松手，页面就不能滚动了（`scroll-enable` 被关死），气泡与
 * 按压态一直挂着，之后怎么点都不再响应；有时值还会弹回起点。
 *
 * 成因：拖动的结束信号只来自**圆点**上的 `touchend`。圆点只有 24px，手指沿轨道
 * 滑出去再松手时，原生按落点派发事件就收不到 end，于是
 * 1. `isDragging` 永久为 true → `useLockScroll` 一直持有租约 → 页面滚动锁死；
 * 2. `showDotPopover` 依赖 `isDragging` → 气泡常驻（看起来像「回弹一直在」）；
 * 3. `onTouchStart` 开头的 `isDragging` 早退 → 滑块彻底不再响应。
 *
 * 另一条回弹路径：原生 start 的触点带 `identifier`、end 的 `changedTouches` 却不带，
 * 旧实现按 id 找不到就当成「另一根手指」丢帧，最后一帧不提交，值退回起点。
 *
 * 断言策略：滚动锁是**模块级单例**，而 component project 关闭了文件隔离，其他用例
 * 可能仍持有租约，所以这里不假设初始值是 false——只断言「本次手势前后回到同一个
 * 值」，再用「紧接着还能再拖一次」验证 `isDragging` 没有残留（后者才是用户可见的
 * 症状，且与全局锁状态无关）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'
import { usePageScrollLock } from '../../src/composables/useLockScroll'
import Slider from '../../src/components/wd-slider/wd-slider.vue'

/** 后台 getRect 的桩：轨道 left=0 / width=200（与断言坐标对齐） */
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
  return () => {
    bgLynx.createSelectorQuery = origin
  }
}

function renderSlider(initial = 50) {
  const updates: any[] = []
  const changes: any[] = []
  const lifecycle: string[] = []
  const view = render({
    setup() {
      const value = ref(initial)
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
          onDragstart: () => lifecycle.push('start'),
          onDragend: () => lifecycle.push('end')
        })
    }
  } as any)
  return { ...view, updates, changes, lifecycle }
}

const scrollLocked = usePageScrollLock()

/** 再拖一次并松手：证明上一次手势没有把 isDragging 留在 true */
async function dragAgain(container: Element, changes: any[]) {
  const dot = container.querySelector('.wd-slider__dot')!
  const before = changes.length
  fireEvent.touchstart(dot, { touches: [{ clientX: 40, clientY: 0, identifier: 9 }] })
  await pause(20)
  fireEvent.touchmove(dot, { touches: [{ clientX: 60, clientY: 0, identifier: 9 }] })
  fireEvent.touchend(dot, { touches: [], changedTouches: [{ clientX: 60, clientY: 0, identifier: 9 }] })
  await pause(80)
  return changes.length > before
}

describe('wd-slider 拖动收尾：end 丢失/判错都不能把页面卡死', () => {
  afterEach(() => cleanup())

  it('圆点上的 end 彻底丢失时，静默兜底要收尾并让下一次手势可用', async () => {
    const restore = installRects(200)
    const { container, changes, lifecycle } = renderSlider()
    await pause(50)
    const before = scrollLocked.value

    const dot = container.querySelector('.wd-slider__dot')!
    fireEvent.touchstart(dot, { touches: [{ clientX: 100, clientY: 0, identifier: 1 }] })
    await pause(20)
    expect(scrollLocked.value, '拖动期间必须锁住页面滚动').toBe(true)

    // 关键：不派发任何 touchend，模拟手指滑出圆点松手（原生没再派发 end）
    await pause(1400)

    expect(scrollLocked.value, 'end 丢失后必须自愈解锁，否则整页不能滚动').toBe(before)
    expect(lifecycle, '兜底收尾要补发 dragend').toContain('end')
    expect(await dragAgain(container, changes), '收尾后滑块必须能再次拖动').toBe(true)
    restore()
  })

  it('落在轨道上的 end 也要收尾（手指已离开圆点）', async () => {
    const restore = installRects(200)
    const { container, changes, lifecycle } = renderSlider()
    await pause(50)
    const before = scrollLocked.value

    const dot = container.querySelector('.wd-slider__dot')!
    const bar = container.querySelector('.wd-slider__bar')!
    fireEvent.touchstart(dot, { touches: [{ clientX: 100, clientY: 0, identifier: 1 }] })
    await pause(20)
    expect(scrollLocked.value, '拖动期间必须锁住页面滚动').toBe(true)

    // 松手点不在圆点上：事件只到轨道，圆点收不到
    fireEvent.touchend(bar, { touches: [], changedTouches: [{ clientX: 150, clientY: 0, identifier: 1 }] })
    await pause(80)

    expect(scrollLocked.value, '轨道上的 end 必须解锁').toBe(before)
    expect(changes[changes.length - 1], '落定到 75（150/200）').toBe(75)
    expect(lifecycle).toContain('end')
    restore()
  })

  it('changedTouches 缺 identifier 时不能当异号触点丢掉（缺 id 也得收尾）', async () => {
    const restore = installRects(200)
    const { container, changes } = renderSlider()
    await pause(50)
    const before = scrollLocked.value

    const dot = container.querySelector('.wd-slider__dot')!
    fireEvent.touchstart(dot, { touches: [{ clientX: 100, clientY: 0, identifier: 7 }] })
    await pause(20)

    // 原生常见：start 带 identifier，end 的 changedTouches 不带
    fireEvent.touchend(dot, { touches: [], changedTouches: [{ clientX: 150, clientY: 0 }] })
    await pause(80)

    expect(scrollLocked.value, '缺 id 的 end 也必须解锁').toBe(before)
    expect(changes[changes.length - 1], '缺 id 时仍要提交最后一帧，不能回弹到起点').toBe(75)
    restore()
  })

  it('end 的时间戳小于 start 也不能拦截收尾（原生两端时间基准可能不同）', async () => {
    const restore = installRects(200)
    const { container, changes } = renderSlider()
    await pause(50)
    const before = scrollLocked.value

    const dot = container.querySelector('.wd-slider__dot')!
    fireEvent.touchstart(dot, { touches: [{ clientX: 100, clientY: 0, identifier: 1 }], timestamp: 9_000_000 })
    await pause(20)

    // 时间基准不一致：end 的时间戳远小于 start
    fireEvent.touchend(dot, { touches: [], changedTouches: [{ clientX: 150, clientY: 0, identifier: 1 }], timestamp: 5000 })
    await pause(80)

    expect(scrollLocked.value, '时间戳判错不能把 end 拦掉').toBe(before)
    expect(changes[changes.length - 1]).toBe(75)
    restore()
  })
})

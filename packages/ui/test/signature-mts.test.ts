/**
 * wd-signature MTS 跟手测试（原生优先重写版，参照 slider-mts.test.ts）。
 *
 * 覆盖「主线程线段池跟手 + 后台累积落定」的完整链路：
 * 1. **跟手直改**：touchmove 经主线程 worklet 把当前段直线直改线段池
 *    下一元素（left / top / width / height / border-radius /
 *    background-color / transform），零线程跨越；
 * 2. **落定 commit**：touchend 后台提交笔迹 → SVG 重绘（polyline）+
 *    线段池随该帧重置（宽高清零）；
 * 3. **事件链路**：start / signing / end / confirm（导出 SVG data URI）；
 * 4. **压感模式**：段宽随速度变化（与 SVG 导出逐段 path 同构）；
 * 5. **禁用态**：worklet 不起笔、后台不累积；
 * 6. **清尾**：收笔后残留 touchmove 不产生新线段。
 *
 * 派发路径说明（jsdom 不模拟冒泡）：画布（__content-canvas）绑后台
 * touchstart / touchend 与主线程 touchmove；父容器 __content 绑主线程
 * touchstart / touchend 与后台 touchmove。真机上画布触摸冒泡到
 * __content 即触发其处理器，测试中向两个元素分别派发验证。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import { fireEvent } from './fire-event'
import Signature from '../src/components/wd-signature/wd-signature.vue'

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

/** 画布矩形：left=10, top=20, width=300, height=200（触点需减偏移换算） */
const RECT = { id: '', left: 10, top: 20, right: 310, bottom: 220, width: 300, height: 200 }

/** 安装主线程（worklet invoke）与后台（getRect）双侧几何 stub */
function installRects(): () => void {
  ;(globalThis as any).__wdRectStub = () => RECT
  const bgLynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const origin = bgLynx.createSelectorQuery
  bgLynx.createSelectorQuery = () => ({
    select: () => ({
      invoke: (params: any) => {
        params.success?.(RECT)
        return { exec: () => {} }
      }
    })
  })
  return () => {
    delete (globalThis as any).__wdRectStub
    bgLynx.createSelectorQuery = origin
  }
}

/** 线段池元素（画布子 view；svg 不是 view） */
function poolOf(container: Element): Element[] {
  return [...container.querySelectorAll('.wd-signature__content-canvas > view')]
}

/** 画布 / __content 元素 */
function elsOf(container: Element) {
  return {
    canvas: container.querySelector('.wd-signature__content-canvas')!,
    content: container.querySelector('.wd-signature__content')!
  }
}

/**
 * 一次完整笔迹（MTS 分工派发）：
 * 起笔（画布后台 + __content 主线程）→ 逐点（画布主线程跟手 +
 * __content 后台累积）→ 收笔（画布后台提交 + __content 主线程清尾）。
 */
async function drawStroke(container: Element, points: Array<[number, number]>) {
  const { canvas, content } = elsOf(container)
  fireEvent.touchstart(canvas, { touches: [{ clientX: points[0][0], clientY: points[0][1] }] })
  fireEvent.touchstart(content, { touches: [{ clientX: points[0][0], clientY: points[0][1] }] })
  await pause(10)
  for (const [x, y] of points.slice(1)) {
    fireEvent.touchmove(canvas, { touches: [{ clientX: x, clientY: y }] })
    fireEvent.touchmove(content, { touches: [{ clientX: x, clientY: y }] })
    await pause(5)
  }
  const last = points[points.length - 1]
  fireEvent.touchend(canvas, { touches: [], changedTouches: [{ clientX: last[0], clientY: last[1] }] })
  fireEvent.touchend(content, { touches: [], changedTouches: [{ clientX: last[0], clientY: last[1] }] })
  await pause(30)
}

describe('wd-signature MTS 跟手', () => {
  afterEach(() => cleanup())

  it('touchmove 经主线程 worklet 直改线段池（跟手，零线程跨越）', async () => {
    const restore = installRects()
    const { container } = render(Signature, {} as any)
    await pause(50)

    const pool = poolOf(container)
    expect(pool.length).toBeGreaterThan(1)

    // 起笔（页面坐标 60,120 → 画布坐标 50,100）
    const { canvas, content } = elsOf(container)
    fireEvent.touchstart(canvas, { touches: [{ clientX: 60, clientY: 120 }] })
    fireEvent.touchstart(content, { touches: [{ clientX: 60, clientY: 120 }] })
    await pause(10)

    // 跟手到（页面 160,220 → 画布 150,200）：
    // 段长 = √(100² + 100²) ≈ 141.42，线宽默认 3，角度 45°
    fireEvent.touchmove(canvas, { touches: [{ clientX: 160, clientY: 220 }] })
    await pause(10)

    const seg0 = styleOf(pool[0])
    expect(seg0).toMatch(/width:\s*141\.42/)
    expect(seg0).toMatch(/height:\s*3px/)
    expect(seg0).toMatch(/border-radius:\s*1\.5px/)
    expect(seg0).toMatch(/transform:\s*rotate\(45deg\)/)
    // 段中心定位：left = (50+150)/2 - 141.42/2 ≈ 29.29，top = (100+200)/2 - 1.5 = 148.5
    expect(seg0).toMatch(/left:\s*29\.28/)
    expect(seg0).toMatch(/top:\s*148\.5px/)

    // 第二段落在池中下一个元素（第一个元素不被覆盖）
    fireEvent.touchmove(canvas, { touches: [{ clientX: 260, clientY: 220 }] })
    await pause(10)
    const seg1 = styleOf(pool[1])
    expect(seg1).toMatch(/width:\s*100px/)
    expect(seg1).toMatch(/transform:\s*rotate\(0deg\)/)

    restore()
  })

  it('touchend 后台落定：SVG 重绘 + 线段池重置 + start/signing/end 链路', async () => {
    const restore = installRects()
    const events: string[] = []
    const { container } = render(Signature, {
      onStart: () => events.push('start'),
      onSigning: () => events.push('signing'),
      onEnd: () => events.push('end'),
      onConfirm: () => events.push('confirm')
    } as any)
    await pause(50)

    await drawStroke(container, [
      [60, 120],
      [160, 220],
      [260, 220]
    ])

    // 事件链路：起笔 / 每个累积点 / 收笔
    expect(events.filter((e) => e === 'start')).toHaveLength(1)
    expect(events.filter((e) => e === 'signing')).toHaveLength(2)
    expect(events.filter((e) => e === 'end')).toHaveLength(1)

    // 落定后 SVG 含提交笔迹（画布坐标 50,100 / 150,200 / 250,200）
    const svg = container.querySelector('svg')!
    const content = String(svg.getAttribute('content') || '')
    expect(content).toMatch(/<polyline points="50,100 150,200 250,200"/)
    expect(content).toMatch(/stroke="#000"/)
    expect(content).toMatch(/stroke-width="3"/)

    // 线段池随该帧 SVG 重绘一并重置（宽高清零）
    const pool = poolOf(container)
    expect(styleOf(pool[0])).toMatch(/width:\s*0px/)
    expect(styleOf(pool[0])).toMatch(/height:\s*0px/)

    // 确认导出：SVG data URI 含同一笔迹
    fireEvent.tap([...container.querySelectorAll('.wd-signature__button')].at(-1)!)
    await pause(20)
    expect(events).toContain('confirm')

    restore()
  })

  it('压感模式：段宽随速度变化（与导出逐段 path 同构）', async () => {
    const restore = installRects()
    const { container } = render(Signature, { pressure: true, lineWidth: 3, minWidth: 2, maxWidth: 6 } as any)
    await pause(50)

    const pool = poolOf(container)
    const { canvas, content } = elsOf(container)
    fireEvent.touchstart(canvas, { touches: [{ clientX: 60, clientY: 120 }] })
    fireEvent.touchstart(content, { touches: [{ clientX: 60, clientY: 120 }] })
    await pause(10)

    // 快速长段（速度高 → 趋近 minWidth）
    fireEvent.touchmove(canvas, { touches: [{ clientX: 260, clientY: 120 }] })
    await pause(30)
    // 慢速短段（速度低 → 趋近 maxWidth）
    fireEvent.touchmove(canvas, { touches: [{ clientX: 270, clientY: 120 }] })
    await pause(30)

    const fast = styleOf(pool[0])
    const slow = styleOf(pool[1])
    // 两段线宽均落在 [minWidth, maxWidth] 且不相等（压感生效）
    const fastW = Number(fast.match(/height:\s*([\d.]+)px/)![1])
    const slowW = Number(slow.match(/height:\s*([\d.]+)px/)![1])
    expect(fastW).toBeGreaterThanOrEqual(2)
    expect(fastW).toBeLessThanOrEqual(6)
    expect(slowW).toBeGreaterThanOrEqual(2)
    expect(slowW).toBeLessThanOrEqual(6)
    expect(slowW).not.toBe(fastW)

    restore()
  })

  it('禁用态：worklet 不起笔、后台不累积、无笔迹产出', async () => {
    const restore = installRects()
    const { container } = render(Signature, { disabled: true } as any)
    await pause(50)

    const pool = poolOf(container)
    await drawStroke(container, [
      [60, 120],
      [160, 220],
      [260, 220]
    ])

    // 线段池无跟手渲染
    expect(styleOf(pool[0])).toMatch(/width:\s*0px/)
    // SVG 无多点滴迹（禁用的起笔不建可绘线）
    const content = String(container.querySelector('svg')!.getAttribute('content') || '')
    expect(content).not.toMatch(/points="[^"]*\s[^"]*"/)

    restore()
  })

  it('主线程 touchend worklet 清尾：残留 touchmove 不产生新线段', async () => {
    const restore = installRects()
    const { container } = render(Signature, {} as any)
    await pause(50)

    const pool = poolOf(container)
    await drawStroke(container, [
      [60, 120],
      [160, 220]
    ])

    // 收笔后池已重置
    expect(styleOf(pool[0])).toMatch(/width:\s*0px/)

    // 残留 touchmove（无起笔）：主线程状态已清，不驱动线段池
    const { canvas } = elsOf(container)
    fireEvent.touchmove(canvas, { touches: [{ clientX: 200, clientY: 220 }] })
    await pause(10)
    expect(styleOf(pool[0])).toMatch(/width:\s*0px/)
    expect(styleOf(pool[1])).toMatch(/width:\s*0px/)

    restore()
  })
})

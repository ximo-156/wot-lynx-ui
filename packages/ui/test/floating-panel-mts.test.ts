/**
 * wd-floating-panel MTS 跟手测试（原生优先重写版，参照 slider-mts.test.ts）。
 *
 * 覆盖主线程跟手 + 后台落定的完整链路：
 * 1. **跟手直改**：touchmove 经主线程 worklet 直改根节点 transform（多档位，
 *    含越界阻尼）；
 * 2. **落定 commit**：touchend 后台以同一公式重算终值、吸附最近锚点，
 *    update:height / height-change 事件与最终 transform；
 * 3. **事件链路**：touchstart（头部后台）→ touchmove（主线程）→ touchend
 *    （后台）全链路与拖动态 transition 切换；
 * 4. **属性桥接**：cur-height / min-bound / max-bound 经元素属性下发，
 *    worklet 实时读取（上一轮落定高度即下一轮手势起点）；
 * 5. **内容区门控**：contentDraggable 为真时内容区 touchstart 记录手势
 *    起点、跟手落定正常；为假时作废手势起点，落定不重算（参考源
 *    dataset.id === 'content' 分支语义）。
 *
 * 派发路径说明（jsdom 的 bindEvent 事件不冒泡）：根 view 的 touchstart /
 * touchmove 为主线程 worklet 绑定、touchend 为后台绑定；头部与内容区的
 * touchstart 为后台绑定。真机上头部 / 内容区触摸冒泡到根 view 触发主线程
 * worklet，测试中按范本直接派发到各绑定元素验证。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import { fireEvent } from './fire-event'
import FloatingPanel from '../src/components/wd-floating-panel/wd-floating-panel.vue'

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

/** 挂载组件，返回容器与事件记录 */
function mount(extraProps: Record<string, unknown> = {}) {
  const heights: number[] = []
  const changes: number[] = []
  const events: string[] = []
  const { container } = render({
    setup() {
      const height = ref(200)
      return () =>
        h(FloatingPanel as any, {
          modelValue: true,
          height: height.value,
          anchors: [200, 400],
          contentDraggable: true,
          duration: 300,
          'onUpdate:height': (v: number) => {
            height.value = v
            heights.push(v)
          },
          onHeightChange: (v: { height: number }) => changes.push(v.height),
          onTouchstart: () => events.push('touchstart'),
          onTouchend: () => events.push('touchend'),
          ...extraProps
        })
    }
  } as any)
  return { container, heights, changes, events }
}

/** 面板根 / 头部 / 内容区元素 */
function parts(container: Element) {
  return {
    root: container.querySelector('.wd-floating-panel')!,
    header: container.querySelector('.wd-floating-panel__header')!,
    content: container.querySelector('.wd-floating-panel__content')!
  }
}

describe('wd-floating-panel MTS 跟手', () => {
  afterEach(() => cleanup())

  it('touchmove 经主线程 worklet 直改 transform（跟手，含越界阻尼）', async () => {
    const { container } = mount()
    await pause(50)
    const { root, header } = parts(container)

    // 初始：height=200 → translateY(calc(100% + -200px))
    expect(styleOf(root)).toMatch(/translateY\(calc\(100% \+ -200px\)\)/)

    // 手势开始：头部后台 touchstart（记录后台手势起点）+ 根 view 主线程
    // touchstart（记录主线程手势起点：startY=500, startH 经 cur-height 读 200）
    fireEvent.touchstart(header, { touches: [{ clientX: 0, clientY: 500 }] })
    fireEvent.touchstart(root, { touches: [{ clientX: 0, clientY: 500 }] })
    await pause(10)

    // 跟手到 clientY=400：moveY = 400-500-200 = -300 → height=300
    fireEvent.touchmove(root, { touches: [{ clientX: 0, clientY: 400 }] })
    await pause(10)
    expect(styleOf(root)).toMatch(/translateY\(calc\(100% \+ -300px\)\)/)

    // 跟手到 clientY=300：moveY = -400 → 触及 max 锚点 → height=400
    fireEvent.touchmove(root, { touches: [{ clientX: 0, clientY: 300 }] })
    await pause(10)
    expect(styleOf(root)).toMatch(/translateY\(calc\(100% \+ -400px\)\)/)

    // 越界阻尼：clientY=100 → moveY = -600 → DAMP 0.2 → height=440
    fireEvent.touchmove(root, { touches: [{ clientX: 0, clientY: 100 }] })
    await pause(10)
    expect(styleOf(root)).toMatch(/translateY\(calc\(100% \+ -440px\)\)/)
    // 跟手期显式 transition: none（Style Funnel：禁过渡残留）
    expect(styleOf(root)).toMatch(/transition:\s*none/)
  })

  it('touchend 后台落定 commit：吸附最近锚点 + update:height / height-change', async () => {
    const { container, heights, changes, events } = mount()
    await pause(50)
    const { root, header } = parts(container)

    fireEvent.touchstart(header, { touches: [{ clientX: 0, clientY: 500 }] })
    fireEvent.touchstart(root, { touches: [{ clientX: 0, clientY: 500 }] })
    fireEvent.touchmove(root, { touches: [{ clientX: 0, clientY: 100 }] })
    await pause(10)

    // 落定：后台 touchend 同一公式重算（height=440）→ 吸附 400
    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 0, clientY: 100 }] })
    await pause(50)

    expect(heights[heights.length - 1]).toBe(400)
    expect(changes[changes.length - 1]).toBe(400)
    // 落定后由 Vue 接管：transform 落到锚点、transition 恢复（拖动态解除）
    expect(styleOf(root)).toMatch(/translateY\(calc\(100% \+ -400px\)\)/)
    expect(styleOf(root)).not.toMatch(/transition:\s*none/)
    expect(events).toContain('touchstart')
    expect(events).toContain('touchend')
  })

  it('原地抬手不产生 height-change（落定值与起点高度一致）', async () => {
    const { container, heights, changes } = mount()
    await pause(50)
    const { root, header } = parts(container)

    fireEvent.touchstart(header, { touches: [{ clientX: 0, clientY: 500 }] })
    fireEvent.touchstart(root, { touches: [{ clientX: 0, clientY: 500 }] })
    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 0, clientY: 500 }] })
    await pause(50)

    // moveY = 500-500-200 = -200 → height=200（起点高度）→ 不发射 height-change
    expect(changes).toEqual([])
    expect(heights[heights.length - 1]).toBe(200)
  })

  it('属性桥接：上一轮落定高度即下一轮手势起点（cur-height 实时下发）', async () => {
    const { container } = mount()
    await pause(50)
    const { root, header } = parts(container)

    // 第一轮：落到 400
    fireEvent.touchstart(header, { touches: [{ clientX: 0, clientY: 500 }] })
    fireEvent.touchstart(root, { touches: [{ clientX: 0, clientY: 500 }] })
    fireEvent.touchmove(root, { touches: [{ clientX: 0, clientY: 300 }] })
    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 0, clientY: 300 }] })
    await pause(50)
    expect(styleOf(root)).toMatch(/translateY\(calc\(100% \+ -400px\)\)/)

    // 第二轮：手势起点 clientY=300，cur-height 属性应为 400（上一轮落定值）
    fireEvent.touchstart(header, { touches: [{ clientX: 0, clientY: 300 }] })
    fireEvent.touchstart(root, { touches: [{ clientX: 0, clientY: 300 }] })
    await pause(10)
    expect(root.getAttribute('cur-height')).toBe('400')

    // 跟手到 clientY=250：moveY = 250-300-400 = -450 → DAMP → 410
    fireEvent.touchmove(root, { touches: [{ clientX: 0, clientY: 250 }] })
    await pause(10)
    expect(styleOf(root)).toMatch(/translateY\(calc\(100% \+ -410px\)\)/)
  })

  it('内容区可拖拽：内容区 touchstart 记录手势起点，跟手落定正常', async () => {
    const { container, changes } = mount()
    await pause(50)
    const { root, content } = parts(container)

    // 真机上内容区触摸冒泡到根 view 的主线程 touchstart / touchmove worklet；
    // jsdom 不冒泡，直接派发到根 view 验证（派发到内容区验证手势起点记录）
    fireEvent.touchstart(content, { touches: [{ clientX: 0, clientY: 500 }] })
    fireEvent.touchstart(root, { touches: [{ clientX: 0, clientY: 500 }] })
    await pause(10)
    fireEvent.touchmove(root, { touches: [{ clientX: 0, clientY: 250 }] })
    await pause(10)
    // moveY = 250-500-200 = -450 → 越界阻尼 → 410
    expect(styleOf(root)).toMatch(/translateY\(calc\(100% \+ -410px\)\)/)

    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 0, clientY: 250 }] })
    await pause(50)
    // 410 吸附最近锚点 400（≠ 起点高度 200）→ 发射 height-change
    expect(changes[changes.length - 1]).toBe(400)
  })

  it('内容区不可拖拽：touchstart 作废手势起点，落定不重算', async () => {
    const { container, heights, changes } = mount({ contentDraggable: false })
    await pause(50)
    const { root, content } = parts(container)

    // 内容区 touchstart（后台）作废手势起点；touchmove 被内容区 catch 拦截，
    // 不冒泡到根 view 的主线程 worklet（真机语义；jsdom 派发到内容区即不到根）
    fireEvent.touchstart(content, { touches: [{ clientX: 0, clientY: 500 }] })
    fireEvent.touchmove(content, { touches: [{ clientX: 0, clientY: 100 }] })
    await pause(10)
    // transform 保持初始值（跟手未发生）
    expect(styleOf(root)).toMatch(/translateY\(calc\(100% \+ -200px\)\)/)

    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 0, clientY: 100 }] })
    await pause(50)
    // 手势起点已作废：不按坐标重算，高度不变、不发射 height-change
    expect(changes).toEqual([])
    expect(heights[heights.length - 1]).toBe(200)
  })

  it('落定值等于拖前高度：行内值仍被覆写回锚点（commitTick 强制重写）', async () => {
    const { container, changes, heights } = mount()
    await pause(50)
    const { root, header } = parts(container)

    fireEvent.touchstart(header, { touches: [{ clientX: 0, clientY: 500 }] })
    fireEvent.touchstart(root, { touches: [{ clientX: 0, clientY: 500 }] })
    await pause(10)
    // 轻微拖到 clientY=490：moveY = 490-500-200 = -210 → 跟手到 210
    fireEvent.touchmove(root, { touches: [{ clientX: 0, clientY: 490 }] })
    await pause(10)
    expect(styleOf(root)).toMatch(/translateY\(calc\(100% \+ -210px\)\)/)

    // 落定：210 吸附最近锚点 200（= 拖前高度，heightValue 不变）
    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 0, clientY: 490 }] })
    await pause(50)
    // 高度未变 → 不发射 height-change，但行内 transform 必须被覆写回 200
    expect(changes).toEqual([])
    expect(heights[heights.length - 1]).toBe(200)
    expect(styleOf(root)).toMatch(/translateY\(calc\(100% \+ -200px\)\)/)
    // 同时恢复落位 transition（跟手期的 none 被覆写）
    expect(styleOf(root)).not.toMatch(/transition:\s*none/)
  })

  it('touchcancel 与 touchend 同路径落定', async () => {
    const { container, changes } = mount()
    await pause(50)
    const { root, header } = parts(container)

    fireEvent.touchstart(header, { touches: [{ clientX: 0, clientY: 500 }] })
    fireEvent.touchstart(root, { touches: [{ clientX: 0, clientY: 500 }] })
    await pause(10)
    fireEvent.touchmove(root, { touches: [{ clientX: 0, clientY: 200 }] })
    await pause(10)
    // moveY = 200-500-200 = -500 → 越界阻尼 → 420
    expect(styleOf(root)).toMatch(/translateY\(calc\(100% \+ -420px\)\)/)

    fireEvent.touchcancel(root, { touches: [], changedTouches: [{ clientX: 0, clientY: 200 }] })
    await pause(50)
    expect(changes[changes.length - 1]).toBe(400)
  })
})

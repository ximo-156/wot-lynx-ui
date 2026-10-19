/**
 * wd-swipe-action MTS 跟手测试（原生优先重写版，范本 test/slider-mts.test.ts、
 * test/floating-panel-mts.test.ts）。
 *
 * 背景（NATIVE-REWRITE §2/§10）：横向拖拽原以后台线程 touchmove 逐帧累计
 * （useTouch），每帧两次线程往返、低端机跟手滞后；现按声明式 MTS 重写——
 * - 根 view（父）`main-thread-bindtouchstart`（主线程记起点：触点坐标 +
 *   经元素属性 origin-offset 读当前偏移）/ `main-thread-bindtouchmove`
 *   （主线程跟手：绝对公式 offset = origin + deltaX 按操作区宽度钳制，
 *   直改容器 transform + transition: none，零线程跨越）；
 * - 内容容器 wrapper（子）后台 `@touchstart`（记后台手势起点 + 互斥收起
 *   其他行 + 置位 touching）/ `@touchmove`（仅转发原生事件）/ `@touchend`
 *   / `@touchcancel`（同一套公式由 changedTouches 重算落定偏移，按 0.3
 *   阈值状态机 commit update:modelValue，beforeClose 拦截留后台）。
 *
 * 派发路径说明（jsdom 的 bindEvent 事件不冒泡）：真机上内容区 / 操作区触摸
 * 先经 wrapper 的后台处理器，再冒泡到根 view 的主线程 worklet；测试中按
 * 分工直接派发到对应元素验证（touchstart 派发到 wrapper 验后台、到 root
 * 验主线程，touchmove 派发到 root 验主线程跟手，touchend 派发到 wrapper
 * 验落定）。
 *
 * 几何 stub：操作区宽度经 createSelectorQuery 返回（左 80px / 右 60px），
 * 与后台 getRect 对齐；未度量（0）时该侧不可拖。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import { pause } from '../src/common/util'
import SwipeAction from '../src/components/wd-swipe-action/wd-swipe-action.vue'

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

/** 操作区宽度 stub：左 80px / 右 60px（按实例唯一类名匹配） */
function installWidths(left = 80, right = 60) {
  const bgLynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const origin = bgLynx.createSelectorQuery
  bgLynx.createSelectorQuery = () => ({
    select: (selector: string) => ({
      invoke: (params: any) => {
        const width = /__left$/.test(selector) ? left : /__right$/.test(selector) ? right : 0
        params.success?.({ id: '', left: 0, top: 0, right: width, bottom: 44, width, height: 44 })
        return { exec: () => {} }
      }
    })
  })
  return () => {
    bgLynx.createSelectorQuery = origin
  }
}

/** 挂载一个带左右操作区的 swipe-action，返回容器与事件记录 */
function mount(record: { modelValue: string; updates: string[]; clicks: any[]; events: string[] }, extraProps: Record<string, unknown> = {}) {
  const v = ref<string>(record.modelValue)
  const { container } = render({
    setup() {
      return () =>
        h(
          SwipeAction as any,
          {
            modelValue: v.value,
            'onUpdate:modelValue': (x: string) => {
              v.value = x
              record.modelValue = x
              record.updates.push(x)
            },
            onClick: (e: any) => record.clicks.push(e),
            onTouchstart: () => record.events.push('touchstart'),
            onTouchmove: () => record.events.push('touchmove'),
            onTouchend: () => record.events.push('touchend'),
            ...extraProps
          },
          {
            left: () => h('view', { class: 'op-left' }, '收藏'),
            default: () => h('view', { class: 'op-content' }, '单元格'),
            right: () => h('view', { class: 'op-right' }, '删除')
          }
        )
    }
  } as any)
  return container
}

/** 元素：根 view（主线程事件挂载层）/ 内容容器（后台事件挂载层） */
function parts(container: Element) {
  return {
    root: container.querySelector('.wd-swipe-action')!,
    wrapper: container.querySelector('.wd-swipe-action__wrapper')!
  }
}

/**
 * 一次完整手势的后台 + 主线程起点（真机上冒泡令两层都收到）。
 * 参照 floating-panel 范本：后台 touchstart 置位 touching 会触发一次重渲染
 * （写回已提交的 transform + transition:none），须在其落定后再派发
 * touchmove——否则 Vue 的回写会盖掉 worklet 的跟手直改。
 */
async function gestureStart(root: Element, wrapper: Element, clientX: number, clientY = 100) {
  fireEvent.touchstart(wrapper, { touches: [{ clientX, clientY }] })
  fireEvent.touchstart(root, { touches: [{ clientX, clientY }] })
  await pause(10)
}

describe('wd-swipe-action MTS 跟手', () => {
  afterEach(() => cleanup())

  it('touchmove 经主线程 worklet 直改容器 transform（跟手 + 边界钳制 + transition:none）', async () => {
    const restore = installWidths(80, 60)
    const record = { modelValue: 'close', updates: [] as string[], clicks: [] as any[], events: [] as string[] }
    const container = mount(record)
    await pause(50)
    const { root, wrapper } = parts(container)

    // 属性桥接：操作区宽度与当前偏移经元素属性下发
    expect(wrapper.getAttribute('left-width')).toBe('80')
    expect(wrapper.getAttribute('right-width')).toBe('60')
    expect(wrapper.getAttribute('origin-offset')).toBe('0')

    await gestureStart(root, wrapper, 200)
    await pause(10)

    // 向左拖 40px：offset = 0 + (-40) = -40（右操作区 60 内，不钳制）
    fireEvent.touchmove(root, { touches: [{ clientX: 160, clientY: 100 }] })
    await pause(10)
    expect(styleOf(wrapper)).toMatch(/translateX\(-40px\)/)
    // 跟手期显式 transition: none（Style Funnel：禁过渡残留）
    expect(styleOf(wrapper)).toMatch(/transition:\s*none/)

    // 向左拖 100px：越过右操作区宽度 → 钳制到 -60
    fireEvent.touchmove(root, { touches: [{ clientX: 100, clientY: 100 }] })
    await pause(10)
    expect(styleOf(wrapper)).toMatch(/translateX\(-60px\)/)

    // 向右拖 60px：offset = 60（左操作区 80 内）
    fireEvent.touchmove(root, { touches: [{ clientX: 260, clientY: 100 }] })
    await pause(10)
    expect(styleOf(wrapper)).toMatch(/translateX\(60px\)/)

    // 向右拖 80px：越过左操作区宽度 → 钳制到 80
    fireEvent.touchmove(root, { touches: [{ clientX: 280, clientY: 100 }] })
    await pause(10)
    expect(styleOf(wrapper)).toMatch(/translateX\(80px\)/)

    // 落定：后台 touchend 同一公式重算 → 超过 30% 阈值 → 展开左操作区
    fireEvent.touchend(wrapper, { touches: [], changedTouches: [{ clientX: 280, clientY: 100 }] })
    await pause(50)
    expect(record.updates[record.updates.length - 1]).toBe('left')
    // 落定后由 Vue 接管：transform 落到左操作区宽度、transition 恢复
    expect(styleOf(wrapper)).toMatch(/translateX\(80px\)/)
    expect(styleOf(wrapper)).toMatch(/transition:\s*transform/)
    restore()
  })

  it('纵向主导时不横移（方向锁，worklet 与后台一致）', async () => {
    const restore = installWidths(80, 60)
    const record = { modelValue: 'close', updates: [] as string[], clicks: [] as any[], events: [] as string[] }
    const container = mount(record)
    await pause(50)
    const { root, wrapper } = parts(container)

    await gestureStart(root, wrapper, 200)
    // 纵向大位移 + 横向小位移：|deltaY| > |deltaX| → 不横移
    fireEvent.touchmove(root, { touches: [{ clientX: 210, clientY: 400 }] })
    await pause(10)
    expect(styleOf(wrapper)).toMatch(/translateX\(0px\)/)

    // 落定：后台同样按方向锁跳过重算 → 回归初始状态
    fireEvent.touchend(wrapper, { touches: [], changedTouches: [{ clientX: 210, clientY: 400 }] })
    await pause(50)
    expect(record.updates).toEqual([])
    expect(styleOf(wrapper)).toMatch(/translateX\(0px\)/)
    restore()
  })

  it('touchend 后台落定 commit：未达阈值回归收起并同步 modelValue', async () => {
    const restore = installWidths(80, 60)
    const record = { modelValue: 'close', updates: [] as string[], clicks: [] as any[], events: [] as string[] }
    const container = mount(record)
    await pause(50)
    const { root, wrapper } = parts(container)

    await gestureStart(root, wrapper, 200)
    // 向左拖 10px：|offset| = 10 < 60 * 0.3 = 18 → 未达阈值
    fireEvent.touchmove(root, { touches: [{ clientX: 190, clientY: 100 }] })
    await pause(10)
    expect(styleOf(wrapper)).toMatch(/translateX\(-10px\)/)

    fireEvent.touchend(wrapper, { touches: [], changedTouches: [{ clientX: 190, clientY: 100 }] })
    await pause(50)
    expect(record.updates).toEqual([])
    expect(styleOf(wrapper)).toMatch(/translateX\(0px\)/)
    restore()
  })

  it('已展开态回拖未超阈值：保持展开（originOffset 参与状态机）', async () => {
    const restore = installWidths(80, 60)
    const record = { modelValue: 'right', updates: [] as string[], clicks: [] as any[], events: [] as string[] }
    const container = mount(record)
    await pause(50)
    const { root, wrapper } = parts(container)

    // 外部 modelValue=right：宽度落地后展开（offset = -60）
    await pause(30)
    expect(styleOf(wrapper)).toMatch(/translateX\(-60px\)/)

    // 从展开态向右回拖 5px：offset = -55，回拖量 5 < 60 * 0.3 → 保持展开
    await gestureStart(root, wrapper, 200)
    fireEvent.touchmove(root, { touches: [{ clientX: 205, clientY: 100 }] })
    await pause(10)
    expect(styleOf(wrapper)).toMatch(/translateX\(-55px\)/)

    fireEvent.touchend(wrapper, { touches: [], changedTouches: [{ clientX: 205, clientY: 100 }] })
    await pause(50)
    expect(record.updates[record.updates.length - 1]).toBe('right')
    expect(styleOf(wrapper)).toMatch(/translateX\(-60px\)/)
    restore()
  })

  it('事件链路：touchstart/touchmove/touchend 全链路转发（§14 防合并数组 handler）', async () => {
    const restore = installWidths(80, 60)
    const record = { modelValue: 'close', updates: [] as string[], clicks: [] as any[], events: [] as string[] }
    const container = mount(record)
    await pause(50)
    const { root, wrapper } = parts(container)

    await gestureStart(root, wrapper, 200)
    // 后台 wrapper 的 touchmove 转发（主线程跟手派发到 root，互不干扰）
    fireEvent.touchmove(wrapper, { touches: [{ clientX: 160, clientY: 100 }] })
    fireEvent.touchmove(root, { touches: [{ clientX: 160, clientY: 100 }] })
    await pause(10)
    fireEvent.touchend(wrapper, { touches: [], changedTouches: [{ clientX: 160, clientY: 100 }] })
    await pause(50)

    expect(record.events).toContain('touchstart')
    expect(record.events).toContain('touchmove')
    expect(record.events).toContain('touchend')
    restore()
  })

  it('touchcancel 与 touchend 同路径落定', async () => {
    const restore = installWidths(80, 60)
    const record = { modelValue: 'close', updates: [] as string[], clicks: [] as any[], events: [] as string[] }
    const container = mount(record)
    await pause(50)
    const { root, wrapper } = parts(container)

    await gestureStart(root, wrapper, 200)
    fireEvent.touchmove(root, { touches: [{ clientX: 100, clientY: 100 }] })
    await pause(10)
    fireEvent.touchcancel(wrapper, { touches: [], changedTouches: [{ clientX: 100, clientY: 100 }] })
    await pause(50)
    expect(record.updates[record.updates.length - 1]).toBe('right')
    expect(styleOf(wrapper)).toMatch(/translateX\(-60px\)/)
    restore()
  })

  it('禁用态：drag-disabled 属性桥接，worklet 不跟手、后台不提交', async () => {
    const restore = installWidths(80, 60)
    const record = { modelValue: 'close', updates: [] as string[], clicks: [] as any[], events: [] as string[] }
    const container = mount(record, { disabled: true })
    await pause(50)
    const { root, wrapper } = parts(container)

    expect(wrapper.getAttribute('drag-disabled')).toBe('true')
    await gestureStart(root, wrapper, 200)
    fireEvent.touchmove(root, { touches: [{ clientX: 100, clientY: 100 }] })
    await pause(10)
    // worklet 读 drag-disabled 直接返回：无直改
    expect(styleOf(wrapper)).toMatch(/translateX\(0px\)/)

    fireEvent.touchend(wrapper, { touches: [], changedTouches: [{ clientX: 100, clientY: 100 }] })
    await pause(50)
    expect(record.updates).toEqual([])
    restore()
  })

  it('无操作区时不可拖（宽度 0 → 两侧钳制为 0）', async () => {
    const restore = installWidths(0, 0)
    const record = { modelValue: 'close', updates: [] as string[], clicks: [] as any[], events: [] as string[] }
    const container = mount(record)
    await pause(50)
    const { root, wrapper } = parts(container)

    await gestureStart(root, wrapper, 200)
    fireEvent.touchmove(root, { touches: [{ clientX: 100, clientY: 100 }] })
    await pause(10)
    expect(styleOf(wrapper)).toMatch(/translateX\(0px\)/)

    fireEvent.touchend(wrapper, { touches: [], changedTouches: [{ clientX: 100, clientY: 100 }] })
    await pause(50)
    expect(record.updates).toEqual([])
    restore()
  })
})

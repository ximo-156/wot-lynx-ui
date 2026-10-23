/**
 * wd-fab MTS 跟手回归（NATIVE-REWRITE §2 / §6）。
 *
 * 拖动交互必须走声明式 MTS：触发器上的 'main thread' worklet 读触点 → 算几何
 * → setStyleProperty 直改 fab 根节点（top / left / transition 全量键集），
 * 零线程跨越；落定（吸附到最近侧边 + 菜单方向翻转）留后台 @touchend，用同一
 * 公式由落定后的元素矩形重算。
 *
 * jsdom 不模拟事件冒泡：真机上触摸在触发器上按下后 touchmove / touchend 目标
 * 固定为触发器并冒泡到根 view，测试中后台处理器直接派发到根元素验证（同
 * slider-mts.test.ts 的冒泡验证方式）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'
import Fab from '../../src/components/wd-fab/wd-fab.vue'

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

const FAB_SIZE = 60
// 测试环境 SystemInfo：windowWidth=390, windowHeight=844（@lynx-js/testing-environment）
const SCREEN_WIDTH = 390
const SCREEN_HEIGHT = 844
const GAP = 16
const MAX_LEFT = SCREEN_WIDTH - FAB_SIZE - GAP // 314
const MAX_TOP = SCREEN_HEIGHT - FAB_SIZE - GAP // 768

/** 从元素内联样式解析矩形（模拟主线程 boundingClientRect / 后台 getRect） */
function rectOf(el: Element | null) {
  const style = (el && el.getAttribute('style')) || ''
  const left = Number(/left:\s*(-?[\d.]+)px/.exec(style)?.[1] || 0)
  const top = Number(/top:\s*(-?[\d.]+)px/.exec(style)?.[1] || 0)
  return { id: '', left, top, right: left + FAB_SIZE, bottom: top + FAB_SIZE, width: FAB_SIZE, height: FAB_SIZE }
}

/**
 * 几何 stub：主线程 __wdRectStub 与后台 createSelectorQuery 同源——
 * 均按根节点当前内联位置返回 fab 矩形（跟手期间根节点被 worklet 直改，
 * 落定时后台度量到的就是跟手末位置）。
 */
function installRects(container: Element) {
  ;(globalThis as any).__wdRectStub = (el: any) => rectOf(el)
  const bgLynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const origin = bgLynx.createSelectorQuery
  bgLynx.createSelectorQuery = () => ({
    select: () => ({
      invoke: (params: any) => {
        params.success?.(rectOf(container.querySelector('.wd-fab')))
        return { exec: () => {} }
      }
    }),
    selectAll: () => ({ invoke: () => ({ exec: () => {} }), exec: () => {} }),
    exec: () => {}
  })
  return () => {
    delete (globalThis as any).__wdRectStub
    bgLynx.createSelectorQuery = origin
  }
}

function mountFab(extra: Record<string, any> = {}) {
  const events: string[] = []
  const updates: boolean[] = []
  const { container } = render({
    setup() {
      return () =>
        h(Fab as any, {
          draggable: true,
          'onUpdate:active': (v: boolean) => updates.push(v),
          onTouchstart: () => events.push('touchstart'),
          onTouchmove: () => events.push('touchmove'),
          onTouchend: () => events.push('touchend'),
          onTap: () => events.push('tap'),
          ...extra
        })
    }
  } as any)
  return { container, events, updates }
}

describe('wd-fab MTS 跟手', () => {
  afterEach(() => cleanup())

  it('touchmove 经主线程 worklet 直改根节点位置；touchend 后台吸附落定', async () => {
    const holder = mountFab()
    const restore = installRects(holder.container)
    await pause(60)

    const root = holder.container.querySelector('.wd-fab')!
    const trigger = holder.container.querySelector('.wd-fab [class^="wd-fab-trigger-"]')!
    // 初始位置：right-bottom → maxLeft / maxTop（边界经元素属性下发）
    expect(root.getAttribute('drag-min-left')).toBe(String(GAP))
    expect(root.getAttribute('drag-max-left')).toBe(String(MAX_LEFT))
    expect(root.getAttribute('drag-min-top')).toBe(String(GAP))
    expect(root.getAttribute('drag-max-top')).toBe(String(MAX_TOP))
    expect(styleOf(root)).toMatch(/left:\s*314px/)
    expect(styleOf(root)).toMatch(/top:\s*768px/)

    // 手势开始：触发器主线程 touchstart 一次性度量 fab 盒子并算触点偏移
    // （按在 fab 中心：314+30 / 768+30 → 偏移 30）
    fireEvent.touchstart(trigger, { touches: [{ clientX: 344, clientY: 798 }] })
    await pause(20)

    // 跟手：触点左移 200px → fab 左移 200px（314 - 200 = 114，未触边界）
    fireEvent.touchmove(trigger, { touches: [{ clientX: 144, clientY: 798 }] })
    await pause(20)
    expect(styleOf(root), 'worklet 应把 left 直改到 114px').toMatch(/left:\s*114px/)
    expect(styleOf(root), '跟手期 transition 必须显式置 none').toMatch(/transition:\s*none/)

    // 跟手越界：触点继续左移 → 钳制到 minLeft（gap）
    fireEvent.touchmove(trigger, { touches: [{ clientX: 5, clientY: 798 }] })
    await pause(20)
    expect(styleOf(root)).toMatch(/left:\s*16px/)

    // 落定：真机上 touchend 自触发器冒泡到根 view，jsdom 不模拟冒泡，
    // 直接派发到根元素验证后台落定逻辑（fab 中心 46 < 屏幕中心 195）
    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 5, clientY: 798 }] })
    await pause(60)
    expect(styleOf(root), '落定应吸附到左侧边').toMatch(/left:\s*16px/)
    expect(styleOf(root), '落定恢复吸附过渡').toMatch(/transition:\s*all ease 0\.3s/)
    // 动作菜单方向应翻转为 right（菜单在按钮右侧展开）
    expect(holder.container.querySelector('.wd-fab__actions--right'), '方向应翻转为 right').not.toBeNull()

    restore()
  })

  it('落定到右半屏时吸附右侧边且方向翻转为 left', async () => {
    const holder = mountFab({ position: 'left-top' })
    const restore = installRects(holder.container)
    await pause(60)

    const root = holder.container.querySelector('.wd-fab')!
    const trigger = holder.container.querySelector('.wd-fab [class^="wd-fab-trigger-"]')!
    // 初始位置：left-top → minLeft / minTop
    expect(styleOf(root)).toMatch(/left:\s*16px/)

    fireEvent.touchstart(trigger, { touches: [{ clientX: 46, clientY: 46 }] })
    await pause(20)
    fireEvent.touchmove(trigger, { touches: [{ clientX: 330, clientY: 46 }] })
    await pause(20)
    expect(styleOf(root), 'worklet 跟手到 300px').toMatch(/left:\s*300px/)

    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 330, clientY: 46 }] })
    await pause(60)
    expect(styleOf(root), '落定应吸附到右侧边').toMatch(/left:\s*314px/)
    expect(holder.container.querySelector('.wd-fab__actions--left'), '方向应翻转为 left').not.toBeNull()

    restore()
  })

  it('纵向拖动：worklet 钳制 top 并跟手；落定写回后台状态', async () => {
    const holder = mountFab()
    const restore = installRects(holder.container)
    await pause(60)

    const root = holder.container.querySelector('.wd-fab')!
    const trigger = holder.container.querySelector('.wd-fab [class^="wd-fab-trigger-"]')!

    fireEvent.touchstart(trigger, { touches: [{ clientX: 344, clientY: 798 }] })
    await pause(20)
    // 触点下移 100px → fab 下移 100px（768 + 100 = 868 > maxTop 768 → 钳制）
    fireEvent.touchmove(trigger, { touches: [{ clientX: 344, clientY: 898 }] })
    await pause(20)
    expect(styleOf(root), 'top 应钳制到 maxTop').toMatch(/top:\s*768px/)

    // 触点上移 600px → fab 上移 600px（768 - 600 = 168，未触边界）
    fireEvent.touchmove(trigger, { touches: [{ clientX: 344, clientY: 198 }] })
    await pause(20)
    expect(styleOf(root), 'top 应跟手到 168px').toMatch(/top:\s*168px/)

    // 落定：横向中心 344 ≥ 195 → 吸附右侧边；纵向跟手值 168 写回后台状态
    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 344, clientY: 198 }] })
    await pause(60)
    expect(styleOf(root), '落定后 top 保持跟手值（不跳回旧值）').toMatch(/top:\s*168px/)
    expect(styleOf(root)).toMatch(/left:\s*314px/)

    restore()
  })

  it('原生 touch 事件经 emits 转发（CONVENTIONS §14）', async () => {
    const holder = mountFab()
    const restore = installRects(holder.container)
    await pause(60)

    const root = holder.container.querySelector('.wd-fab')!
    const trigger = holder.container.querySelector('.wd-fab [class^="wd-fab-trigger-"]')!

    fireEvent.touchstart(root, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchmove(root, { touches: [{ clientX: 110, clientY: 100 }] })
    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 110, clientY: 100 }] })
    await pause(60)
    expect(holder.events).toContain('touchstart')
    expect(holder.events).toContain('touchmove')
    expect(holder.events).toContain('touchend')

    restore()
  })

  it('draggable=false：worklet 不跟手、touchend 不吸附', async () => {
    const holder = mountFab({ draggable: false })
    const restore = installRects(holder.container)
    await pause(60)

    const root = holder.container.querySelector('.wd-fab')!
    const trigger = holder.container.querySelector('.wd-fab [class^="wd-fab-trigger-"]')!
    const before = styleOf(root)

    fireEvent.touchstart(trigger, { touches: [{ clientX: 329, clientY: 766 }] })
    await pause(20)
    fireEvent.touchmove(trigger, { touches: [{ clientX: 129, clientY: 766 }] })
    await pause(20)
    expect(styleOf(root), '不可拖动时位置不得被 worklet 直改').toBe(before)

    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 129, clientY: 766 }] })
    await pause(60)
    expect(styleOf(root)).toBe(before)

    restore()
  })

  it('tap 触发器展开菜单并更新 active', async () => {
    const holder = mountFab()
    const restore = installRects(holder.container)
    await pause(60)

    // wd-button 根节点（custom-class="wd-fab__trigger"）绑 @tap → emit click
    const button = holder.container.querySelector('.wd-fab__trigger')!
    fireEvent.tap(button)
    await pause(20)
    expect(holder.updates[holder.updates.length - 1]).toBe(true)

    restore()
  })
})

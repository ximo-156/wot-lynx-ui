/**
 * wd-tabs MTS 滑动手势回归（NATIVE-REWRITE §2/§10，范本 test/slider-mts.test.ts）。
 *
 * 背景：swipeable 的滑动手势原以后台线程 touchmove 逐帧累计（useTouch），
 * 每帧两次线程往返、低端机跟手滞后；现按声明式 MTS 重写——
 * - 面板条带（wd-tabs__body）main-thread-bindtouchstart（主线程一次性度量
 *   条带宽度 + 记起点 + 方向锁）/ main-thread-bindtouchmove（主线程跟手，
 *   绝对公式 left = -activeIndex * width + deltaX 直改节点样式，零线程跨越）；
 * - 容器（父节点）后台 @touchstart（记起点 + 置位 swiping）/ @touchend
 *   （同一套公式重算终值，水平位移 ≥50px 才切换并 emit change /
 *   update:modelValue，未达阈值回弹归位）。
 *
 * jsdom 不模拟事件冒泡：真机上触摸面板内容时事件沿响应链上浮，条带与容器
 * 两条链路都会收到；测试中按分工直接派发到对应元素验证处理器逻辑
 * （touchstart/touchmove 派发到条带，touchend 派发到容器，冒泡结果等价）。
 *
 * 几何 stub：主线程 invoke('boundingClientRect') 读 globalThis.__wdRectStub，
 * 后台 createSelectorQuery 同步 stub（条带宽 300，与 wd-slider 测试对齐）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'
import Tabs from '../../src/components/wd-tabs/wd-tabs.vue'
import Tab from '../../src/components/wd-tab/wd-tab.vue'

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

/** 主线程 + 后台几何 stub：条带宽 300px；selectAll（导航项度量）返回 3 个 100px 项 */
function installRects(width = 300) {
  ;(globalThis as any).__wdRectStub = () => ({
    id: '', left: 0, top: 0, right: width, bottom: 44, width, height: 44
  })
  const bgLynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const origin = bgLynx.createSelectorQuery
  bgLynx.createSelectorQuery = () => {
    const nodesRef = (all: boolean) => ({
      invoke: (params: any) => {
        if (all) {
          params.success?.([
            { id: '', left: 0, top: 0, right: 100, bottom: 44, width: 100, height: 44 },
            { id: '', left: 100, top: 0, right: 200, bottom: 44, width: 100, height: 44 },
            { id: '', left: 200, top: 0, right: 300, bottom: 44, width: 100, height: 44 }
          ])
        } else {
          params.success?.({ id: '', left: 0, top: 0, right: width, bottom: 44, width, height: 44 })
        }
        return { exec: () => {} }
      }
    })
    return {
      select: () => nodesRef(false),
      selectAll: () => nodesRef(true)
    }
  }
  return () => {
    delete (globalThis as any).__wdRectStub
    bgLynx.createSelectorQuery = origin
  }
}

/** 挂载 3 个标签的 swipeable + animated  tabs；modelValue 控制初始激活项 */
async function renderTabs(modelValue: number, handlers: Record<string, (v: any) => void> = {}) {
  const result = render({
    setup() {
      const value = ref(modelValue)
      return () =>
        h(
          Tabs as any,
          {
            modelValue: value.value,
            swipeable: true,
            animated: true,
            'onUpdate:modelValue': (v: any) => {
              value.value = v
              handlers.update?.(v)
            },
            onChange: (v: any) => handlers.change?.(v),
            onClick: (v: any) => handlers.click?.(v),
            onDisabled: (v: any) => handlers.disabled?.(v)
          },
          {
            default: () => [
              h(Tab as any, { title: '标签一', name: 0 }, { default: () => h('text', '内容一') }),
              h(Tab as any, { title: '标签二', name: 1 }, { default: () => h('text', '内容二') }),
              h(Tab as any, { title: '标签三', name: 2 }, { default: () => h('text', '内容三') })
            ]
          }
        )
    }
  } as any)
  await pause(50)
  return result
}

describe('wd-tabs MTS 滑动手势', () => {
  afterEach(() => cleanup())

  it('touchmove 经主线程 worklet 跟手直改条带 left；touchend 后台落定切换', async () => {
    const restore = installRects(300)
    const updates: any[] = []
    const changes: any[] = []
    const { container } = await renderTabs(1, {
      update: (v) => updates.push(v),
      change: (v) => changes.push(v)
    })

    const containerEl = container.querySelector('.wd-tabs__container')!
    const body = container.querySelector('.wd-tabs__body')!
    // 元素属性桥接：worklet 经 getAttribute 实时读激活索引与标签总数
    expect(body.getAttribute('active-index')).toBe('1')
    expect(body.getAttribute('tab-count')).toBe('3')

    // 手势开始：条带主线程 touchstart 度量宽度（300）+ 容器后台 touchstart 记起点
    fireEvent.touchstart(body, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchstart(containerEl, { touches: [{ clientX: 0, clientY: 0 }] })
    await pause(10)

    // 跟手：主线程 worklet 直改 left（activeIndex=1, width=300 → left = -300 + dx）
    fireEvent.touchmove(body, { touches: [{ clientX: 100, clientY: 0 }] })
    await pause(10)
    expect(styleOf(body), '跟手期 left 应为 -200px').toMatch(/left:\s*-200px/)
    // 跟手期禁过渡：worklet 逐帧写 transition-duration: 0ms
    expect(styleOf(body)).toMatch(/transition-duration:\s*0ms/)

    // 继续跟手到 60px（总位移 60 ≥ 50 阈值）
    fireEvent.touchmove(body, { touches: [{ clientX: 60, clientY: 0 }] })
    await pause(10)
    expect(styleOf(body)).toMatch(/left:\s*-240px/)

    // 落定：容器后台 touchend 以同一公式重算——水平位移 60 ≥ 50 且向右 →
    // 切换到上一项（index 0）
    fireEvent.touchend(containerEl, { touches: [], changedTouches: [{ clientX: 60, clientY: 0 }] })
    await pause(50)
    expect(updates[updates.length - 1]).toBe(0)
    expect(changes[changes.length - 1]).toEqual({ index: 0, name: 0 })
    // 落定后条带回落到 -100% * 0 = 0%，并恢复落位过渡时长
    expect(styleOf(body)).toMatch(/left:\s*0%/)
    expect(styleOf(body)).toMatch(/transition-duration:\s*300ms/)

    restore()
  })

  it('位移不足阈值：touchend 不切换，条带过渡回弹归位', async () => {
    const restore = installRects(300)
    const updates: any[] = []
    const { container } = await renderTabs(1, { update: (v) => updates.push(v) })

    const containerEl = container.querySelector('.wd-tabs__container')!
    const body = container.querySelector('.wd-tabs__body')!

    fireEvent.touchstart(body, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchstart(containerEl, { touches: [{ clientX: 0, clientY: 0 }] })
    await pause(10)

    // 跟手 20px（不足 50 阈值）
    fireEvent.touchmove(body, { touches: [{ clientX: 20, clientY: 0 }] })
    await pause(10)
    expect(styleOf(body)).toMatch(/left:\s*-280px/)

    // 落定：不切换，swiping 回落 → bodyStyle 重写 left: -100% * 1 与过渡时长
    fireEvent.touchend(containerEl, { touches: [], changedTouches: [{ clientX: 20, clientY: 0 }] })
    await pause(50)
    expect(updates, '不应产生 update:modelValue').toEqual([])
    expect(styleOf(body)).toMatch(/left:\s*-100%/)
    expect(styleOf(body)).toMatch(/transition-duration:\s*300ms/)

    restore()
  })

  it('边缘阻尼：首页继续右拖 / 末页继续左拖按 0.3 衰减，落定不切换', async () => {
    const restore = installRects(300)
    const updates: any[] = []
    const { container } = await renderTabs(0, { update: (v) => updates.push(v) })

    const containerEl = container.querySelector('.wd-tabs__container')!
    const body = container.querySelector('.wd-tabs__body')!

    fireEvent.touchstart(body, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchstart(containerEl, { touches: [{ clientX: 0, clientY: 0 }] })
    await pause(10)

    // 首页右拖 100px → 阻尼后 30px（left = -0 * 300 + 30）
    fireEvent.touchmove(body, { touches: [{ clientX: 100, clientY: 0 }] })
    await pause(10)
    expect(styleOf(body)).toMatch(/left:\s*30px/)

    // 落定：位移虽 ≥50，但首页无上一项可切，不产生 update
    fireEvent.touchend(containerEl, { touches: [], changedTouches: [{ clientX: 100, clientY: 0 }] })
    await pause(50)
    expect(updates).toEqual([])
    expect(styleOf(body)).toMatch(/left:\s*0%/)

    restore()
  })

  it('方向锁：纵向手势不抢占，条带不跟手、落定不切换', async () => {
    const restore = installRects(300)
    const updates: any[] = []
    const { container } = await renderTabs(1, { update: (v) => updates.push(v) })

    const containerEl = container.querySelector('.wd-tabs__container')!
    const body = container.querySelector('.wd-tabs__body')!

    fireEvent.touchstart(body, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchstart(containerEl, { touches: [{ clientX: 0, clientY: 0 }] })
    await pause(10)

    // 纵向位移占优（dx=10, dy=100）→ worklet 锁定 vertical，不直改 left
    // （left 保持 Vue 侧基础值 -100%，不出现 worklet 的 px 直改）
    fireEvent.touchmove(body, { touches: [{ clientX: 10, clientY: 100 }] })
    await pause(10)
    expect(styleOf(body), '纵向手势不应拖动条带').toMatch(/left:\s*-100%/)
    expect(styleOf(body), '纵向手势不应出现 px 跟手直改').not.toMatch(/left:\s*-?\d+px/)

    // 落定：direction 为 vertical，不切换
    fireEvent.touchend(containerEl, { touches: [], changedTouches: [{ clientX: 10, clientY: 100 }] })
    await pause(50)
    expect(updates).toEqual([])

    restore()
  })

  it('禁用/未开手势时不进 MTS 链路：非 swipeable 触摸无任何直改', async () => {
    const restore = installRects(300)
    const updates: any[] = []
    const { container } = render({
      setup() {
        const value = ref(1)
        return () =>
          h(
            Tabs as any,
            {
              modelValue: value.value,
              animated: true,
              'onUpdate:modelValue': (v: any) => {
                value.value = v
                updates.push(v)
              }
            },
            {
              default: () => [
                h(Tab as any, { title: '标签一', name: 0 }, { default: () => h('text', '内容一') }),
                h(Tab as any, { title: '标签二', name: 1 }, { default: () => h('text', '内容二') })
              ]
            }
          )
      }
    } as any)
    await pause(50)

    const containerEl = container.querySelector('.wd-tabs__container')!
    const body = container.querySelector('.wd-tabs__body')!

    fireEvent.touchstart(body, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchstart(containerEl, { touches: [{ clientX: 0, clientY: 0 }] })
    await pause(10)
    fireEvent.touchmove(body, { touches: [{ clientX: 120, clientY: 0 }] })
    fireEvent.touchend(containerEl, { touches: [], changedTouches: [{ clientX: 120, clientY: 0 }] })
    await pause(50)

    // 非 swipeable：worklet 直接返回、后台 handler 早退——既无跟手直改也无切换
    // （left 保持 Vue 侧基础值 -100%，不出现 worklet 的 px 直改）
    expect(styleOf(body)).not.toMatch(/left:\s*-?\d+px/)
    expect(updates).toEqual([])

    restore()
  })
})

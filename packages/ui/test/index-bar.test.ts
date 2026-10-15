/**
 * WdIndexBar / WdIndexAnchor 回归测试。
 *
 * 背景：
 * 1. index-anchor 曾用裸 inject 从不调用 link，index-bar 的 children 永远
 *    为空——右侧索引条不渲染、触摸跳转空转（count === 0 直接 return）；
 * 2. index-bar 曾用第二个 provide 覆盖 useChildren 的 link/unlink，子组件
 *    即使想注册也拿不到 link；
 * 3. 子组件 props 曾经 proxy.props 读取（该运行时下恒为空），须用 $.props
 *    （CONVENTIONS §13，参照 wd-checkbox-group）；
 * 4. 触摸跳转曾依赖从未被更新的 scroll-top 属性，实际不会滚动。
 *
 * 本测试锁定：子组件注册后索引条渲染全部索引；触摸索引条经官方
 * scrollIntoView（SelectorQuery.invoke）把对应锚点滚入可见区。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, nextTick } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import IndexBar from '../src/components/wd-index-bar/wd-index-bar.vue'
import IndexAnchor from '../src/components/wd-index-anchor/wd-index-anchor.vue'

interface InvokeCall {
  selector: string
  params: any
}

/**
 * mock SelectorQuery：patch 后台线程全局上的 lynx 对象。
 *
 * 不能整体替换 globalThis.lynx——测试环境切线程时会把后台线程的全局
 * 拷贝回共享 global，整体替换会被冲掉；patch 后台线程对象上的
 * createSelectorQuery 才能被事件处理器（后台线程）看到。
 */
function mockSelectorQuery(): { calls: InvokeCall[]; restore: () => void } {
  const calls: InvokeCall[] = []
  const bgLynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const origin = bgLynx.createSelectorQuery
  bgLynx.createSelectorQuery = () => ({
    select: (selector: string) => ({
      invoke: (params: any) => {
        calls.push({ selector, params })
        return { exec: () => {} }
      }
    })
  })
  return { calls, restore: () => { bgLynx.createSelectorQuery = origin } }
}

/** 挂载 index-bar + 3 个锚点；注册发生在挂载期间，需等一个 tick 刷新索引条 */
async function renderIndexBar() {
  const result = render({
    setup() {
      return () =>
        h(IndexBar, null, {
          default: () => [
            h(IndexAnchor, { index: 'A' }),
            h(IndexAnchor, { index: 'B' }),
            h(IndexAnchor, { index: 'C' })
          ]
        })
    }
  } as any)
  await nextTick()
  return result
}

/** 触摸序列：touchstart → touchmove（带触点）→ touchend */
function touchSidebar(sidebar: Element, clientY: number, withTouchend: boolean = true) {
  fireEvent.touchstart(sidebar)
  fireEvent.touchmove(sidebar, { touches: [{ clientY }] })
  if (withTouchend) fireEvent.touchend(sidebar)
}

describe('WdIndexBar / WdIndexAnchor', () => {
  const originRect = (globalThis as any).__wdIndexBarRect
  let mock: { calls: InvokeCall[]; restore: () => void } | null = null

  afterEach(() => {
    cleanup()
    mock?.restore()
    mock = null
    ;(globalThis as any).__wdIndexBarRect = originRect
  })

  it('子组件注册后索引条渲染全部索引', async () => {
    const { container } = await renderIndexBar()
    const items = Array.from(container.querySelectorAll('.wd-index-bar__index'))
    expect(items.map((el) => el.textContent)).toEqual(['A', 'B', 'C'])
  })

  it('触摸索引条经 scrollIntoView 跳转对应锚点', async () => {
    mock = mockSelectorQuery()
    const calls = mock.calls
    // 索引条几何：top 0 / 高 300，3 个索引均分
    ;(globalThis as any).__wdIndexBarRect = { top: 0, height: 300 }

    const { container } = await renderIndexBar()
    const sidebar = container.querySelector('.wd-index-bar__sidebar')!

    // clientY=150 → floor(150/300*3)=1 → 第二个索引 B
    // 不发 touchend：气泡仅在 touching 期间显示，先断言气泡再收尾
    touchSidebar(sidebar, 150, false)
    await nextTick()

    expect(calls.length, '应触发一次 scrollIntoView').toBe(1)
    expect(calls[0].selector).toBe('#wd-index-anchor-B')
    expect(calls[0].params.method).toBe('scrollIntoView')
    expect(calls[0].params.params.scrollIntoViewOptions.block).toBe('start')

    // 触摸气泡回显当前索引
    const bubble = container.querySelector('.wd-index-bar__current-index')
    expect(bubble, 'touching 时应显示当前索引气泡').not.toBeNull()
    expect(bubble!.textContent).toContain('B')

    fireEvent.touchend(sidebar)
    await nextTick()
    expect(container.querySelector('.wd-index-bar__current-index'), 'touchend 后气泡消失').toBeNull()
  })

  it('索引命中边界时钳制到首/末锚点', async () => {
    mock = mockSelectorQuery()
    const calls = mock.calls
    ;(globalThis as any).__wdIndexBarRect = { top: 0, height: 300 }

    const { container } = await renderIndexBar()
    const sidebar = container.querySelector('.wd-index-bar__sidebar')!

    touchSidebar(sidebar, 9999)
    await nextTick()
    expect(calls[calls.length - 1].selector).toBe('#wd-index-anchor-C')

    touchSidebar(sidebar, 0)
    await nextTick()
    expect(calls[calls.length - 1].selector).toBe('#wd-index-anchor-A')
  })
})

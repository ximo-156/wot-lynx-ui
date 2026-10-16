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
 * 4. 触摸跳转曾依赖从未被更新的 scroll-top 属性，实际不会滚动；
 * 5. 触摸定位曾读 globalThis.__wdIndexBarRect——该全局全仓库没有赋值点，
 *    永远走 top:0/height:300 兜底，clientY 映射错误。现改为挂载后
 *    getRect 一次性度量索引条几何并缓存（CONVENTIONS §16）；jsdom 环境
 *    度量返回零矩形，组件回落到默认几何（top:0/height:300），本测试
 *    据此锁定映射结果。
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
 *
 * 注意：组件自身的几何度量（boundingClientRect invoke）也会记入 calls，
 * 断言跳转时需按 method 过滤（见 scrollCalls）。
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

/** 只取 scrollIntoView 调用（滤除组件自身的几何度量） */
function scrollCalls(calls: InvokeCall[]): InvokeCall[] {
  return calls.filter((c) => c.params && c.params.method === 'scrollIntoView')
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
  let mock: { calls: InvokeCall[]; restore: () => void } | null = null

  afterEach(() => {
    cleanup()
    mock?.restore()
    mock = null
  })

  it('子组件注册后索引条渲染全部索引', async () => {
    const { container } = await renderIndexBar()
    const items = Array.from(container.querySelectorAll('.wd-index-bar__index'))
    expect(items.map((el) => el.textContent)).toEqual(['A', 'B', 'C'])
  })

  it('触摸索引条经 scrollIntoView 跳转对应锚点', async () => {
    mock = mockSelectorQuery()
    const calls = mock.calls

    const { container } = await renderIndexBar()
    const sidebar = container.querySelector('.wd-index-bar__sidebar')!

    // 索引条几何：jsdom 度量返回零矩形，组件回落默认 top:0/height:300，
    // 3 个索引均分。clientY=150 → floor(150/300*3)=1 → 第二个索引 B
    // 不发 touchend：气泡仅在 touching 期间显示，先断言气泡再收尾
    touchSidebar(sidebar, 150, false)
    await nextTick()

    const jumps = scrollCalls(calls)
    expect(jumps.length, '应触发一次 scrollIntoView').toBe(1)
    // 锚点 id = `${indexBarId}-anchor-${index}`（实例唯一前缀，防同页多 bar 撞 id）
    expect(jumps[0].selector).toMatch(/^#wd-index-bar-[0-9a-f]+-anchor-B$/)
    expect(jumps[0].params.method).toBe('scrollIntoView')
    expect(jumps[0].params.params.scrollIntoViewOptions.block).toBe('start')

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

    const { container } = await renderIndexBar()
    const sidebar = container.querySelector('.wd-index-bar__sidebar')!

    touchSidebar(sidebar, 9999)
    await nextTick()
    expect(scrollCalls(calls).pop()!.selector).toMatch(/^#wd-index-bar-[0-9a-f]+-anchor-C$/)

    touchSidebar(sidebar, 0)
    await nextTick()
    expect(scrollCalls(calls).pop()!.selector).toMatch(/^#wd-index-bar-[0-9a-f]+-anchor-A$/)
  })
})

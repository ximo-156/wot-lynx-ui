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
 * 6. 2026-11-05 真机修复：跳转曾只走 SelectorQuery.invoke 的 scrollIntoView，
 *    部分引擎上静默不滚动（点索引条高亮动、列表不动）；现改用官方 API
 *    scrollTo（scrollViewTo）按锚点内容偏移定位。触点纵坐标曾只读
 *    pageY/clientY，真机 changedTouches 只带 x/y 或 detail.y 时点击完全
 *    无响应；现按 wd-slider readPointer 口径多源兜底。
 *
 * 本测试锁定：子组件注册后索引条渲染全部索引；点击/触摸索引条经官方
 * scrollTo（实测几何）或 scrollIntoView（未度量兜底）把对应锚点滚入可见区。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, nextTick } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'
import IndexBar from '../../src/components/wd-index-bar/wd-index-bar.vue'
import IndexAnchor from '../../src/components/wd-index-anchor/wd-index-anchor.vue'

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
 * 断言跳转时需按 method 过滤（见 scrollCalls / scrollToCalls）。
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

/**
 * 带真实几何的 SelectorQuery mock（模拟真机度量）：
 * 索引条 top=1000/height=300；索引条 4×18px 垂直居中（top=1114/height=72）；
 * 锚点 A~D 各 100px 高、间距 100px（scrollTop=0 时页面坐标 = 内容坐标 + 1000）。
 */
function mockGeometry(): { calls: InvokeCall[]; restore: () => void } {
  const calls: InvokeCall[] = []
  const bgLynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const origin = bgLynx.createSelectorQuery
  bgLynx.createSelectorQuery = () => ({
    select: (selector: string) => ({
      invoke: (params: any) => {
        calls.push({ selector, params })
        if (params?.method === 'boundingClientRect') {
          let rect: any = { top: 0, height: 0, width: 100, left: 0, right: 100, bottom: 0 }
          if (selector.endsWith('-sidebar')) rect = { top: 1114, height: 72, width: 18, left: 300, right: 318, bottom: 1186 }
          else if (/-anchor-A$/.test(selector)) rect = { top: 1000, height: 100, width: 300, left: 0, right: 300, bottom: 1100 }
          else if (/-anchor-B$/.test(selector)) rect = { top: 1100, height: 100, width: 300, left: 0, right: 300, bottom: 1200 }
          else if (/-anchor-C$/.test(selector)) rect = { top: 1200, height: 100, width: 300, left: 0, right: 300, bottom: 1300 }
          else if (/-anchor-D$/.test(selector)) rect = { top: 1300, height: 100, width: 300, left: 0, right: 300, bottom: 1400 }
          else rect = { top: 1000, height: 300, width: 375, left: 0, right: 375, bottom: 1300 }
          params.success?.(rect)
        }
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

/** 只取 scrollTo 调用（官方 scrollViewTo 通道） */
function scrollToCalls(calls: InvokeCall[]): InvokeCall[] {
  return calls.filter((c) => c.params && c.params.method === 'scrollTo')
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

/** 挂载 index-bar + 4 个锚点（A~D，模拟 Demo 城市列表） */
async function renderIndexBar4() {
  const result = render({
    setup() {
      return () =>
        h(IndexBar, { sticky: true }, {
          default: () => ['A', 'B', 'C', 'D'].map((index) => h(IndexAnchor, { index }))
        })
    }
  } as any)
  await nextTick()
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

  it('触摸索引条经 scrollIntoView 跳转对应锚点（未度量兜底）', async () => {
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
    // 未度量（jsdom 零矩形）时无内容偏移可算，不得下发官方 scrollTo
    expect(scrollToCalls(calls)).toHaveLength(0)

    // 触摸气泡回显当前索引
    const bubble = container.querySelector('.wd-index-bar__current-index')
    expect(bubble, 'touching 时应显示当前索引气泡').not.toBeNull()
    expect(bubble!.textContent).toContain('B')

    fireEvent.touchend(sidebar)
    // 参考源 handleTouchEnd 内部 await pause()（30ms）后才清除 touching，
    // 需等待定时器而非仅 nextTick（对齐 wot-ui 的异步收尾语义）
    await pause(50)
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

  // 桌面 Web 的鼠标 click 映射为 Lynx tap，不会先派发 touch 事件。
  it('字母上的 tap 无需触摸事件或坐标即可跳转对应锚点', async () => {
    mock = mockGeometry()
    const { container } = await renderIndexBar4()
    const label = container.querySelectorAll('.wd-index-bar__index-text')[3]

    fireEvent.tap(label, { bubbles: true })
    await nextTick()

    const scrolls = scrollToCalls(mock.calls)
    expect(scrolls).toHaveLength(1)
    expect(scrolls[0].selector).toMatch(/^#wd-index-bar-[0-9a-f]+-content$/)
    expect(scrolls[0].params.params).toEqual({ offset: 300, smooth: true })
    expect(container.querySelector('.wd-index-bar__index.is-active')?.textContent).toBe('D')
  })

  it('未度量时重复 tap 同一字母仍逐次跳转（包括当前激活项）', async () => {
    mock = mockSelectorQuery()
    const { container } = await renderIndexBar()
    const first = container.querySelector('.wd-index-bar__index')!

    fireEvent.tap(first)
    await nextTick()
    fireEvent.tap(first)
    await nextTick()

    const jumps = scrollCalls(mock.calls)
    expect(jumps).toHaveLength(2)
    expect(jumps.every((call) => /-anchor-A$/.test(call.selector))).toBe(true)
    expect(scrollToCalls(mock.calls)).toHaveLength(0)
  })

  it('touchend 后同一字母的 tap 不重复下发滚动', async () => {
    mock = mockGeometry()
    const { container } = await renderIndexBar4()
    const sidebar = container.querySelector('.wd-index-bar__sidebar')!
    const last = container.querySelectorAll('.wd-index-bar__index')[3]

    fireEvent.touchstart(sidebar)
    fireEvent.touchend(sidebar, { changedTouches: [{ clientY: 1177 }] })
    fireEvent.tap(last)
    await nextTick()

    expect(scrollToCalls(mock.calls)).toHaveLength(1)
    expect(scrollToCalls(mock.calls)[0].params.params.offset).toBe(300)
  })

  it('页面滚动后点击仍按实际字母定位，不被过期触摸坐标阻断', async () => {
    mock = mockGeometry()
    const { container } = await renderIndexBar4()
    const sidebar = container.querySelector('.wd-index-bar__sidebar')!
    const last = container.querySelectorAll('.wd-index-bar__index')[3]

    // 外层页面移动了 300px，而侧栏缓存仍是 top=1114：旧映射会错误命中 A。
    fireEvent.touchstart(sidebar)
    fireEvent.touchend(sidebar, { changedTouches: [{ clientY: 877 }] })
    fireEvent.tap(last)
    await nextTick()

    const scrolls = scrollToCalls(mock.calls)
    expect(scrolls.at(-1)?.params.params.offset).toBe(300)
    expect(container.querySelector('.wd-index-bar__index.is-active')?.textContent).toBe('D')
  })

  it('平滑跳转和末尾偏移钳制不覆盖目标，scrollend 后恢复滚动联动', async () => {
    mock = mockGeometry()
    const { container } = await renderIndexBar4()
    const content = container.querySelector('.wd-index-bar__content')!
    const last = container.querySelectorAll('.wd-index-bar__index')[3]
    const active = () => container.querySelector('.wd-index-bar__index.is-active')?.textContent

    fireEvent.tap(last)
    await nextTick()
    fireEvent.scroll(content, { detail: { scrollTop: 100 } })
    await nextTick()
    expect(active()).toBe('D')

    fireEvent.scrollend(content)
    await nextTick()
    expect(active()).toBe('D')
    fireEvent.scroll(content, { detail: { scrollTop: 100 } })
    await nextTick()
    expect(active()).toBe('B')
  })

  it('用户触摸列表会立即解除程序化目标保护', async () => {
    mock = mockGeometry()
    const { container } = await renderIndexBar4()
    const content = container.querySelector('.wd-index-bar__content')!
    const last = container.querySelectorAll('.wd-index-bar__index')[3]

    fireEvent.tap(last)
    await nextTick()
    fireEvent.touchstart(content)
    fireEvent.scroll(content, { detail: { scrollTop: 100 } })
    await nextTick()

    expect(container.querySelector('.wd-index-bar__index.is-active')?.textContent).toBe('B')
  })

  // ---- 2026-11-05 真机「点击索引条无反应」回归 ----

  it('纯点击（touchstart → touchend 带触点坐标）经官方 scrollTo 跳转，无需 touchmove', async () => {
    mock = mockGeometry()
    const { container } = await renderIndexBar4()
    const sidebar = container.querySelector('.wd-index-bar__sidebar')!

    // D 的中心：sidebar top=1114 + 63 ≈ 1177（真机点击不产生 touchmove）
    fireEvent.touchstart(sidebar)
    fireEvent.touchend(sidebar, { changedTouches: [{ clientY: 1177, pageY: 1177 }] })
    await nextTick()

    const scrolls = scrollToCalls(mock!.calls)
    expect(scrolls.length, '点击应触发一次官方 scrollTo').toBe(1)
    // 目标滚动容器 = 内容 scroll-view（实例唯一 id）
    expect(scrolls[0].selector).toMatch(/^#wd-index-bar-[0-9a-f]+-content$/)
    // 内容偏移 = 锚点实测 top 1300 − 索引条页面偏移 1000 = 300；落定平滑收尾
    expect(scrolls[0].params.params.offset).toBe(300)
    expect(scrolls[0].params.params.smooth).toBe(true)
    // 实测几何下不再需要 scrollIntoView 兜底
    expect(scrollCalls(mock!.calls)).toHaveLength(0)
  })

  it('touchmove 跟手经官方 scrollTo 瞬时滚动', async () => {
    mock = mockGeometry()
    const { container } = await renderIndexBar4()
    const sidebar = container.querySelector('.wd-index-bar__sidebar')!

    fireEvent.touchstart(sidebar)
    fireEvent.touchmove(sidebar, { touches: [{ clientY: 1177 }] })
    await nextTick()

    const scrolls = scrollToCalls(mock!.calls)
    expect(scrolls.length).toBe(1)
    expect(scrolls[0].params.params.offset).toBe(300)
    expect(scrolls[0].params.params.smooth, '跟手应瞬时贴合手指').toBe(false)
  })

  it('纯点击：touchend 仅带 x/y（宿主兼容触点形状）也跳转', async () => {
    mock = mockGeometry()
    const { container } = await renderIndexBar4()
    const sidebar = container.querySelector('.wd-index-bar__sidebar')!

    fireEvent.touchstart(sidebar)
    fireEvent.touchend(sidebar, { changedTouches: [{ x: 350, y: 1177 }] })
    await nextTick()

    const scrolls = scrollToCalls(mock!.calls)
    expect(scrolls.length, '仅 x/y 坐标不应静默丢弃').toBe(1)
    expect(scrolls[0].params.params.offset).toBe(300)
  })

  it('纯点击：touchend 仅带 detail.y 也跳转', async () => {
    mock = mockGeometry()
    const { container } = await renderIndexBar4()
    const sidebar = container.querySelector('.wd-index-bar__sidebar')!

    fireEvent.touchstart(sidebar)
    fireEvent.touchend(sidebar, { detail: { x: 350, y: 1177 } })
    await nextTick()

    const scrolls = scrollToCalls(mock!.calls)
    expect(scrolls.length, '仅 detail 坐标不应静默丢弃').toBe(1)
    expect(scrolls[0].params.params.offset).toBe(300)
  })

  it('连续点击同一锚点每次都下发 scrollTo（invoke 无属性等值门禁）', async () => {
    mock = mockGeometry()
    const { container } = await renderIndexBar4()
    const sidebar = container.querySelector('.wd-index-bar__sidebar')!

    const tap = () => {
      fireEvent.touchstart(sidebar)
      fireEvent.touchend(sidebar, { changedTouches: [{ clientY: 1177 }] })
    }
    tap()
    await nextTick()
    tap()
    await nextTick()

    const scrolls = scrollToCalls(mock!.calls)
    expect(scrolls.length, '重复定位应各自生效').toBe(2)
    expect(scrolls.every((call) => call.params.params.offset === 300)).toBe(true)
  })
})

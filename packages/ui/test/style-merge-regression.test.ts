/**
 * 样式脏值回归测试 —— 「条件写样式 + SetStyle 合并语义」缺陷锁定。
 *
 * 背景：Lynx 的 SET_STYLE 最终落到 `__SetInlineStyles(el, styleObject)`，
 * 语义是**逐属性合并（Object.assign）**：新样式对象里没有出现的键**不会**清除
 * 元素上已应用的内联属性。测试环境（@lynx-js/testing-environment
 * dist/lynx/ElementPAPI.js:128）同样是 `Object.assign(e.style, styles)`，
 * 因此本文件可以在 jsdom 下真实复现该类缺陷。
 *
 * 仓库已为此付出过两次代价（见 test/overlay-chain-regression.test.ts 缺陷②、
 * wd-swipe-action 的 transition: 'none'）。本文件锁定本次审查新发现的四处
 * 同型缺陷：任何一处把「显式写值」改回「条件省略键」都会立即失败。
 *
 * 注意：断言只使用单词属性名（transform / transition / top / bottom），
 * 因为测试环境把样式对象 Object.assign 到 CSSStyleDeclaration 上，
 * 带连字符的键（z-index / font-size）在该环境下不会真正写入。
 */
import { describe, it, expect } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import { pause } from '../src/common/util'
import Segmented from '../src/components/wd-segmented/wd-segmented.vue'
import PickerView from '../src/components/wd-picker-view/wd-picker-view.vue'
import Fab from '../src/components/wd-fab/wd-fab.vue'
import Toast from '../src/components/wd-toast/wd-toast.vue'
import { useToast } from '../src/components/wd-toast'

async function frames(n = 6) {
  for (let i = 0; i < n; i++) await pause()
}

function styleOf(el: Element | null): string {
  return el?.getAttribute('style') || ''
}

/**
 * 安装返回固定宽度的 SelectorQuery mock（setup.ts 默认返回零矩形，
 * 无法驱动依赖「各项宽度」的定位逻辑，如 segmented 的滑块位移）。
 */
function installSelectorQueryWithWidths(widths: number[]) {
  const lynx = (globalThis as any).lynx
  const rects = widths.map((w) => ({ id: '', left: 0, top: 0, right: w, bottom: 40, width: w, height: 40 }))
  const single = { id: '', left: 0, top: 0, right: widths[0] ?? 0, bottom: 40, width: widths[0] ?? 0, height: 40 }
  const makeRef = (payload: any) => ({
    invoke(options: any) {
      if (options && typeof options.success === 'function') {
        setTimeout(() => options.success(payload), 0)
      }
      return { exec: () => {} }
    },
    boundingClientRect(cb: any) {
      if (typeof cb === 'function') setTimeout(() => cb(payload), 0)
      return { exec: () => {} }
    },
    fields(_: any, cb: any) {
      if (typeof cb === 'function') setTimeout(() => cb({ width: single.width, height: single.height }), 0)
      return { exec: () => {} }
    }
  })
  const makeQuery = () => ({
    select: () => makeRef(single),
    selectAll: () => makeRef(rects),
    in: () => makeQuery(),
    exec: () => {}
  })
  lynx.createSelectorQuery = () => makeQuery()
}

describe('样式脏值（SetStyle 合并语义）', () => {
  it('wd-segmented：切回首项后滑块位移必须显式归零', async () => {
    installSelectorQueryWithWidths([100, 100, 100])
    const value = ref<string | number>('A')
    const { container } = render({
      setup() {
        return () =>
          h(Segmented as any, {
            options: ['A', 'B', 'C'],
            value: value.value,
            'onUpdate:value': (val: string | number) => {
              value.value = val
            }
          })
      }
    } as any)

    await frames()
    const slider = () => container.querySelector('.wd-segmented__slider')
    expect(slider(), 'card 主题（默认）应渲染滑块').not.toBeNull()

    const items = container.querySelectorAll('.wd-segmented__item')
    expect(items.length).toBe(3)

    fireEvent.tap(items[1]!)
    await frames()
    expect(styleOf(slider()), '选中第 2 项后滑块应右移 100px').toContain('translateX(100px)')

    fireEvent.tap(items[0]!)
    await frames()
    expect(
      styleOf(slider()),
      '切回首项后位移必须显式归零（旧实现省略 transform → 残留 translateX(100px)）'
    ).toContain('translateX(0px)')

    cleanup()
  })

  it('wd-picker-view：跟手期 transition 必须显式置 none（否则拖动带缓动、不跟手）', async () => {
    const { container } = render({
      setup() {
        return () =>
          h(PickerView as any, {
            immediateChange: true,
            columns: [Array.from({ length: 5 }, (_, i) => ({ label: String(i), value: i }))]
          })
      }
    } as any)

    await frames()
    const column = container.querySelector('.wd-picker-view__column')!
    const content = () => container.querySelector('.wd-picker-view__column-content')
    expect(column, '应渲染列').not.toBeNull()
    // 原生优先重写后：列内容常驻落位吸附过渡（Vue 侧重渲染承担落位动画）
    expect(styleOf(content()), '初始（未拖动）应带落位吸附过渡').toContain('transform 0.2s')

    // 拖动（MTS 分工派发，jsdom 不模拟冒泡：后台 touchstart/touchend 派发到
    // 列内容，主线程 touchstart/touchmove 分别派发到列 / 列内容）→ 跟手期
    // worklet 与 transform 同帧显式写 transition: none
    fireEvent.touchstart(content(), { touches: [{ clientY: 100 }] })
    fireEvent.touchstart(column, { touches: [{ clientY: 100 }] })
    fireEvent.touchmove(content(), { touches: [{ clientY: 60 }] })
    await frames()
    expect(styleOf(content()), '跟手期过渡必须显式为 none（残留 0.2s → 拖动全程带缓动）').toContain(
      'transition: none'
    )
    // 跟手直改：位移 = 起点 0 + (100 - 60) = 40px → translateY(-40px)
    expect(styleOf(content()), '跟手应直改 transform').toContain('translateY(-40px)')

    // 落位（后台 touchend 用同一公式重算并 commit）→ 重新下发吸附过渡
    fireEvent.touchend(content(), { touches: [], changedTouches: [{ clientY: 60 }] })
    await frames()
    expect(styleOf(content()), '落位应恢复吸附过渡').toContain('transform 0.2s')

    // 再次拖动 → 跟手期过渡必须重新显式置为 none（旧实现省略该键 → 残留 0.2s，不跟手）
    fireEvent.touchstart(content(), { touches: [{ clientY: 100 }] })
    fireEvent.touchstart(column, { touches: [{ clientY: 100 }] })
    fireEvent.touchmove(content(), { touches: [{ clientY: 90 }] })
    await frames()
    expect(
      styleOf(content()),
      '再次拖动必须清除吸附过渡（残留 transform 0.2s → 拖动全程带缓动）'
    ).toContain('transition: none')

    cleanup()
  })

  it('wd-toast：position 切换不产生 top / bottom 内联残留（定位根四边 0 + flex 居中，偏移由 --top/--bottom 类 transform 承担）', async () => {
    const { container } = render({
      setup() {
        const toast = useToast('style-merge-toast')
        return () => [
          h('view', { class: 'trigger-top', onTap: () => toast.show({ msg: '上', position: 'top' }) }, ['top']),
          h('view', { class: 'trigger-bottom', onTap: () => toast.show({ msg: '下', position: 'bottom' }) }, ['bottom']),
          h(Toast as any, { selector: 'style-merge-toast' })
        ]
      }
    } as any)

    const transitionRoot = () =>
      Array.from(container.querySelectorAll('.wd-transition')).find((el) => el.querySelector('.wd-toast')) || null

    fireEvent.tap(container.querySelector('.trigger-top')!)
    await frames()
    // 与 wot-ui 的差异仅在定位机制（NATIVE-REWRITE §3.2 / CONVENTIONS §9）：
    // 内联样式为常量键集（四边 0 + flex 成对居中），不随 position 变化写任何
    // 条件键——上下偏移由根类 wd-toast--top/--bottom 的 transform 在居中基准上
    // 承担，因此不存在 top/bottom 残留问题（SetStyle 合并语义下唯一可能残留
    // 的键也全部恒写，且不含被禁的 left/top 50% + translate）。
    const topStyle = styleOf(transitionRoot())
    expect(topStyle, '内联样式不得写 top: 10%（旧本地实现）').not.toContain('top: 10%')
    expect(topStyle, '内联样式不得写 bottom: 10%').not.toContain('bottom: 10%')
    expect(topStyle, '禁止 top: 50% + translate 找中心').not.toContain('top: 50%')
    expect(topStyle, 'position 固定写 fixed').toContain('position: fixed')
    expect(topStyle, '四边 0 撑满视口').toMatch(/top:\s*0px/)
    expect(topStyle).toMatch(/bottom:\s*0px/)
    expect(topStyle).toMatch(/left:\s*0px/)
    expect(topStyle).toMatch(/right:\s*0px/)
    expect(topStyle, 'flex 成对居中').toMatch(/justify-content:\s*center/)
    expect(topStyle).toMatch(/align-items:\s*center/)

    fireEvent.tap(container.querySelector('.trigger-bottom')!)
    await frames()
    const bottomStyle = styleOf(transitionRoot())
    expect(bottomStyle, '切到 bottom 后内联样式键集完全不变（无残留、无条件键）').toBe(topStyle)

    cleanup()
  })

  it('wd-fab：位移键集恒定（top/left 恒写，不残留旧位移）', async () => {
    const { container } = render({
      setup() {
        return () => h(Fab as any)
      }
    } as any)

    await frames()
    const root = container.querySelector('.wd-fab')!
    expect(root, '应渲染 fab 根节点').not.toBeNull()
    // 与 wot-ui 一致：fab 位移经 top/left 下发（非 transform），且键集恒定
    // （top/left/transition 恒写）——合并语义下不存在旧位移残留。
    const style = styleOf(root)
    expect(style, 'top 恒写').toMatch(/top:\s*\d+px/)
    expect(style, 'left 恒写').toMatch(/left:\s*\d+px/)
    expect(style, 'transition 恒写').toMatch(/transition:/)
    expect(style, '不得写 transform（旧本地实现）').not.toContain('transform')

    cleanup()
  })
})

/**
 * wd-backtop 显隐回归（2026-10-19 演示页实测缺陷）。
 *
 * 现象：滚动阈值未到（scrollTop = 0）时「回到顶部」按钮仍常驻屏幕，
 * 浮在任意章节内容之上；点它也没有回到顶部效果。
 *
 * 根因：Lynx 会把 `position: fixed` 节点提升到页面根节点，旧实现把 fixed
 * 放在 wd-transition 的**子 view**（`.wd-backtop`）上——提升后它不再是
 * transition 根节点的子树，父级的 `display:none` 隐藏态管不到它，于是
 * v-show=false 只隐藏了一个空壳。
 *
 * 契约：承载 `position: fixed` 的元素必须是 wd-transition 的根节点本身
 * （同一节点同时有 `wd-transition` 与 `wd-backtop` 类），显隐与定位同源。
 */
import { describe, it, expect } from 'vitest'
import { h } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import { pause } from '../src/common/util'
import Backtop from '../src/components/wd-backtop/wd-backtop.vue'

async function frames(n = 6) {
  for (let i = 0; i < n; i++) await pause()
}

function isHidden(el: Element | null): boolean {
  if (!el) return true
  return /display:\s*none/.test((el as HTMLElement).getAttribute('style') || '')
}

describe('wd-backtop 显隐', () => {
  it('阈值未到时按钮不可见（fixed 必须落在 transition 根节点上）', async () => {
    const { container } = render({
      setup: () => () => h(Backtop as any, { scrollTop: 0, top: 60, text: '顶部' })
    } as any)
    await frames()

    const btn = container.querySelector('.wd-backtop')
    expect(btn, '按钮节点应存在（常驻 + v-show）').not.toBeNull()
    // 关键契约：fixed 节点即 transition 根节点，隐藏态才真正生效
    expect(
      btn!.classList.contains('wd-transition'),
      'fixed 定位必须下发到 wd-transition 根节点，否则引擎提升后父级隐藏无效'
    ).toBe(true)
    expect(isHidden(btn), 'scrollTop=0 时按钮必须隐藏').toBe(true)
    cleanup()
  })

  it('超过阈值后可见，且点击派发 click / tap', async () => {
    const events: string[] = []
    const { container } = render({
      setup: () => () =>
        h(Backtop as any, {
          scrollTop: 200,
          top: 60,
          text: '顶部',
          onClick: () => events.push('click'),
          onTap: () => events.push('tap')
        })
    } as any)
    await frames()

    const btn = container.querySelector('.wd-backtop')!
    expect(isHidden(btn), '超过阈值应可见').toBe(false)

    btn.dispatchEvent(new Event('click', { bubbles: true }))
    await frames(2)
    fireEvent.tap(btn)
    await frames(2)
    expect(events).toContain('click')
    expect(events).toContain('tap')
    cleanup()
  })
})

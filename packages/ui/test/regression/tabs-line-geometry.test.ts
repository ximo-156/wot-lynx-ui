/**
 * wd-tabs 指示线几何（真机 2026-11-08 回归）。
 *
 * 真机缺陷：“紫色短线贴在导航区最左边”。根因是弹层刚打开时
 * `boundingClientRect` 返回 0 宽，旧实现拿 0 宽直接算 left = 0。
 * 现在的契约：
 * 1. 度量无效时保持隐藏（display: none），不把线放到 0 位置；
 * 2. 布局就绪后自动重试并落到激活项中心；
 * 3. 组件卸载后停止重试，不再写样式。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { h, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import Tabs from '../../src/components/wd-tabs/wd-tabs.vue'
import Tab from '../../src/components/wd-tab/wd-tab.vue'
import { pause } from '../../src/common/util'
import { restoreNativeStubs, stubNativeQuery } from '../helpers/native-stubs'

const empty = { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 }
function measured(width: number) {
  return { width, height: 44, left: 0, top: 0, right: width, bottom: 44 }
}

describe('wd-tabs indicator line geometry', () => {
  afterEach(() => {
    cleanup()
    restoreNativeStubs()
  })

  it('waits for a real measurement instead of pinning the line to the left edge', async () => {
    let ready = false
    stubNativeQuery(() => (ready ? measured(100) : empty))
    const { container } = render({
      setup: () => () => h(Tabs, { modelValue: 1 }, () => [
        h(Tab, { title: 'one', name: 0 }),
        h(Tab, { title: 'two', name: 1 }),
        h(Tab, { title: 'three', name: 2 })
      ])
    } as any)
    await pause(30)
    const line = () => container.querySelector('.wd-tabs__line') as HTMLElement | null
    // 未就绪：保持初始隐藏态（display: none），不会出现可见的 translateX(0) 线
    expect(line()).not.toBeNull()
    expect(line()!.getAttribute('style')).toContain('display: none')

    ready = true
    await pause(300)
    // 就绪后：重试把线落到第 2 项中心（100 + 100/2 = 150）
    expect(line()!.getAttribute('style')).toContain('display: flex')
    expect(line()!.getAttribute('style')).toContain('translateX(150px)')
  })

  it('stops retrying after unmount and never writes the line again', async () => {
    let ready = false
    stubNativeQuery(() => (ready ? measured(80) : empty))
    const mounted = render({
      setup: () => () => h(Tabs, { modelValue: 0 }, () => [h(Tab, { title: 'one', name: 0 }), h(Tab, { title: 'two', name: 1 })])
    } as any)
    const line = mounted.container.querySelector('.wd-tabs__line') as HTMLElement
    const before = line.getAttribute('style')
    mounted.unmount()
    ready = true
    await pause(300)
    expect(line.getAttribute('style')).toBe(before)
  })
})

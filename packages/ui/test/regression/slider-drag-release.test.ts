/** Slider 结束事件容错。原生 target 延续 start；人工 bar end 只验证容器兜底。 */
import { afterEach, describe, expect, it } from 'vitest'
import { h, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '@wot-lynx/core/common/util'
import { usePageScrollLock } from '@wot-lynx/core/composables/useLockScroll'
import Slider from '@wot-lynx/ui-form/wd-slider'

const restores: Array<() => void> = []
const scrollLocked = usePageScrollLock()
function mount() {
  const bg = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const original = bg.createSelectorQuery
  bg.createSelectorQuery = () => ({ select: () => ({ invoke: (options: any) => {
    options.success?.({ left: 0, top: 0, width: 200, height: 44, right: 200, bottom: 44 })
    return { exec() {} }
  } }) })
  restores.push(() => { bg.createSelectorQuery = original })
  const changes: number[] = [], lifecycle: string[] = []
  const view = render({ setup() {
    const value = ref(50)
    return () => h(Slider, {
      modelValue: value.value, 'onUpdate:modelValue': (next: any) => { value.value = next },
      onChange: (next: any) => changes.push(next), onDragstart: () => lifecycle.push('start'), onDragend: () => lifecycle.push('end')
    })
  } } as any)
  return { ...view, changes, lifecycle }
}
afterEach(() => { cleanup(); restores.splice(0).reverse().forEach((fn) => fn()) })

describe('wd-slider 结束容错，不持有页面滚动锁', () => {
  it('缺失 end 后可收尾，再次拖动仍可用', async () => {
    const m = mount(); await pause(50); const before = scrollLocked.value
    const grip = m.container.querySelector('.wd-slider__dot-slider')!
    fireEvent.touchstart(grip, { touches: [{ clientX: 100, identifier: 1 }], bubbles: true })
    await pause(20); expect(scrollLocked.value).toBe(before)
    await pause(1400); expect(m.lifecycle).toEqual(['start', 'end']); expect(scrollLocked.value).toBe(before)
    fireEvent.touchstart(grip, { touches: [{ clientX: 100, identifier: 9 }], bubbles: true })
    await pause(20)
    fireEvent.touchmove(grip, { touches: [{ clientX: 150, identifier: 9 }], bubbles: true })
    fireEvent.touchend(grip, { touches: [], changedTouches: [{ clientX: 150, identifier: 9 }], bubbles: true })
    await pause(80); expect(m.changes.at(-1)).toBe(75)
  })

  it('只到 bar 的 end 仍提交终点并结束', async () => {
    const m = mount(); await pause(50); const before = scrollLocked.value
    fireEvent.touchstart(m.container.querySelector('.wd-slider__dot')!, { touches: [{ clientX: 100, identifier: 1 }] })
    fireEvent.touchend(m.container.querySelector('.wd-slider__bar')!, { touches: [], changedTouches: [{ clientX: 150, identifier: 1 }] })
    await pause(80); expect(m.changes).toEqual([75]); expect(m.lifecycle).toEqual(['start', 'end']); expect(scrollLocked.value).toBe(before)
  })

  it('结束候选只有一个无 id 触点时仍提交终点', async () => {
    const m = mount(); await pause(50)
    const grip = m.container.querySelector('.wd-slider__dot-slider')!
    fireEvent.touchstart(grip, { touches: [{ clientX: 100, identifier: 7 }], bubbles: true })
    fireEvent.touchend(grip, { touches: [], changedTouches: [{ clientX: 150 }], bubbles: true })
    await pause(80); expect(m.changes).toEqual([75]); expect(m.lifecycle).toEqual(['start', 'end'])
  })

  it('无效时间字段允许收尾；已知旧时间另由协议测试拒绝', async () => {
    const m = mount(); await pause(50); const before = scrollLocked.value
    const grip = m.container.querySelector('.wd-slider__dot-slider')!
    fireEvent.touchstart(grip, { touches: [{ clientX: 100, identifier: 1 }], timestamp: 9_000_000, bubbles: true })
    fireEvent.touchend(grip, { touches: [], changedTouches: [{ clientX: 150, identifier: 1 }], timestamp: 'invalid', bubbles: true })
    await pause(80); expect(m.changes).toEqual([75]); expect(scrollLocked.value).toBe(before)
  })
})

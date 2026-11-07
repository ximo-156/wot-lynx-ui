/**
 * 原生单指参数兼容：Lynx SDK 3.4.0 GetTouchEventParam 的非 multi-finger
 * 分支使用局部 touch 变量地址作为 identifier，每次参数构造不保证一致。
 * https://github.com/lynx-family/lynx/blob/3.4.0/core/renderer/events/touch_event_handler.cc
 * 测试故意令每帧/每线程 ID 不同，并保留 native end.touches 中的单触点。
 * 这验证 native-like 事件数据，不冒充手机实机验收。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import Slider from '../../src/components/wd-slider/wd-slider.vue'
import type { SliderValue } from '../../src/components/wd-slider/types'
import { usePageScrollLock } from '../../src/composables/useLockScroll'

const restores: Array<() => void> = []
const lock = usePageScrollLock()
async function flush(ms = 20) { await vi.advanceTimersByTimeAsync(ms); await nextTick() }
function mount(vertical = false, range = false) {
  vi.useFakeTimers()
  const env = (globalThis as any).lynxTestingEnv
  const lynx = env.backgroundThread.globalThis.lynx
  const original = lynx.createSelectorQuery
  lynx.createSelectorQuery = () => ({ select: () => ({ invoke(options: any) {
    options.success?.({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200 })
    return { exec() {} }
  } }) })
  restores.push(() => { lynx.createSelectorQuery = original })
  const value = ref<SliderValue>(range ? [20, 80] : 50)
  const changes: SliderValue[] = [], events: string[] = []
  const view = render({ setup: () => () => h(Slider, {
    vertical, range, modelValue: value.value,
    'onUpdate:modelValue': (next: SliderValue) => { value.value = next },
    onDragstart: () => events.push('start'), onDragmove: () => events.push('move'), onDragend: () => events.push('end'),
    onChange: (next: SliderValue) => changes.push(next)
  }) } as any)
  const grips = [...view.container.querySelectorAll('.wd-slider__dot-slider')]
  const line = view.container.querySelector('.wd-slider__line') as HTMLElement
  return { ...view, value, changes, events, grips, line }
}
function point(value: number, identifier: number, vertical = false) {
  const x = vertical ? 0 : value * 2, y = vertical ? value * 2 : 0
  return { identifier, clientX: x, clientY: y, pageX: x, pageY: y, x, y }
}
function native(target: Element, type: string, value: number, id: number, time: number, vertical = false) {
  const p = point(value, id, vertical)
  fireEvent[type](target, { touches: [p], changedTouches: [p], detail: { x: p.pageX, y: p.pageY }, timestamp: time, bubbles: true })
}
/** 原生给每个 BG 监听重建参数；不用同一个 JS Touch 引用伪造跨线程相同 ID。 */
function separateBackgroundIds() {
  const g = globalThis as any, env = g.lynxTestingEnv
  const hook = g.onSwitchedToBackgroundThread
  const publish = env.backgroundThread.globalThis.publishEvent
  let id = 9000
  g.onSwitchedToBackgroundThread = () => {
    hook?.()
    g.lynxCoreInject.tt.publishEvent = (sign: any, e: any) => {
      const identity = ++id
      publish(sign, { ...e, target: { id: e.target.id }, currentTarget: { id: e.currentTarget.id },
        touches: e.touches?.map((p: any) => ({ ...p, identifier: identity })),
        changedTouches: e.changedTouches?.map((p: any) => ({ ...p, identifier: identity })) })
    }
  }
  restores.push(() => { g.onSwitchedToBackgroundThread = hook; env.switchToBackgroundThread(); hook?.() })
}
afterEach(() => { cleanup(); restores.splice(0).reverse().forEach((fn) => fn()); vi.useRealTimers() })

describe('Slider 原生单指移动参数', () => {
  it.each([false, true].flatMap((vertical) => [false, true].map((range) => ({ vertical, range }))))('每帧 identifier 改变仍跟手并落定（%j）', async ({ vertical, range }) => {
    const m = mount(vertical, range); await flush()
    const beforeLock = lock.value, grip = m.grips[range ? 1 : 0]
    native(grip, 'touchstart', range ? 80 : 50, 1001, 1000, vertical); await flush()
    expect(m.container.querySelectorAll('.wd-slider__dot-popover')).toHaveLength(1)
    native(grip, 'touchmove', range ? 90 : 75, 2002, 1100, vertical)
    expect(m.line.style.getPropertyValue(vertical ? 'height' : 'width'), '不能只出气泡、不画移动').toBe(range ? '70%' : '75%')
    await flush(); expect(m.value.value).toEqual(range ? [20, 90] : 75)
    native(grip, 'touchend', range ? 95 : 80, 3003, 1200, vertical); await flush()
    expect(m.changes).toEqual([range ? [20, 95] : 80])
    expect(m.events).toEqual(['start', 'move', 'end'])
    expect(m.container.querySelector('.wd-slider__dot-popover')).toBeNull()
    expect(lock.value).toBe(beforeLock)
  })

  it('MT/BG 同一 start 参数的 ID 不同，不得让握手永久失配', async () => {
    const m = mount(); await flush(); separateBackgroundIds()
    native(m.grips[0], 'touchstart', 50, 100, 1000); await flush()
    native(m.grips[0], 'touchmove', 75, 200, 1100); await flush()
    expect(m.line.style.width).toBe('75%'); expect(m.value.value).toBe(75)
    await flush(1400)
    native(m.grips[0], 'touchmove', 85, 300, 2500); await flush()
    expect(m.line.style.width).toBe('85%'); expect(m.value.value).toBe(85)
    native(m.grips[0], 'touchend', 90, 400, 2600); await flush()
    expect(m.changes.at(-1)).toBe(90); expect(m.events.filter((v) => v === 'end')).toHaveLength(2)
  })

  it('多指出现过之后继续严格追踪原 ID，不把剩下的另一指当漂移单指', async () => {
    const m = mount(); await flush(); const grip = m.grips[0]
    native(grip, 'touchstart', 50, 7, 1000); await flush()
    fireEvent.touchstart(grip, { touches: [point(50, 7), point(80, 8)], changedTouches: [point(80, 8)], timestamp: 1050, bubbles: true })
    fireEvent.touchmove(grip, { touches: [point(50, 7), point(90, 8)], changedTouches: [point(90, 8)], timestamp: 1100, bubbles: true })
    await flush(); expect(m.value.value).toBe(50)
    fireEvent.touchend(grip, { touches: [point(50, 7)], changedTouches: [point(90, 8)], timestamp: 1150, bubbles: true })
    native(grip, 'touchmove', 95, 8, 1200); await flush()
    expect(m.value.value).toBe(50); expect(m.changes).toEqual([])
    native(grip, 'touchmove', 60, 7, 1300); await flush(); expect(m.value.value).toBe(60)
    fireEvent.touchend(grip, { touches: [], changedTouches: [point(60, 7)], timestamp: 1400, bubbles: true })
    await flush(); expect(m.changes).toEqual([60])
  })

  it('另一握把/另一目标的单候选不能冒充当前单指', async () => {
    const m = mount(false, true); await flush()
    native(m.grips[0], 'touchstart', 20, 7, 1000); await flush()
    native(m.grips[1], 'touchmove', 95, 8, 1100); native(m.grips[1], 'touchend', 95, 8, 1150); await flush()
    expect(m.value.value).toEqual([20, 80]); expect(m.changes).toEqual([])
    native(m.grips[0], 'touchmove', 30, 9, 1200); native(m.grips[0], 'touchend', 35, 10, 1250); await flush()
    expect(m.changes).toEqual([[35, 80]])
  })

  it('漂移单指的取消清理即时，迟到 move 不能复活', async () => {
    const m = mount(); await flush()
    native(m.grips[0], 'touchstart', 50, 1, 1000); await flush()
    native(m.grips[0], 'touchmove', 70, 2, 1100); await flush()
    native(m.grips[0], 'touchcancel', 95, 3, 1200); await flush()
    expect(m.value.value).toBe(70); expect(m.changes).toEqual([70])
    native(m.grips[0], 'touchmove', 95, 4, 1300); await flush()
    expect(m.value.value).toBe(70); expect(m.line.style.width).toBe('70%')
  })

  it('普通 gesture-target 可桥接无 id 属性的 MT Element，装饰图标不参与命中', async () => {
    const m = mount(false, true); await flush()
    expect(m.grips[0].id).not.toBe(m.grips[1].id)
    for (const grip of m.grips) {
      expect(grip.id).not.toBe('')
      expect(grip.getAttribute('gesture-target')).toBe(grip.id)
      expect(grip.getAttribute('flatten')).toBe('false')
      const icon = grip.querySelector('.wd-icon') as HTMLElement
      expect(icon.getAttribute('user-interaction-enabled')).toBe('false')
      expect(icon.style.pointerEvents).toBe('none')
    }
    const grip = m.grips[0]
    const getAttribute = grip.getAttribute.bind(grip)
    const spy = vi.spyOn(grip, 'getAttribute').mockImplementation((key) => key === 'id' ? null : getAttribute(key))
    restores.push(() => spy.mockRestore())
    native(grip, 'touchstart', 20, 7, 1000); await flush()
    native(grip, 'touchmove', 30, 8, 1100); await flush()
    expect(m.value.value).toEqual([30, 80]); expect(m.line.style.width).toBe('50%')
  })

  it('未知目标的 ID 漂移保持拒绝，不把空目标当同源', async () => {
    const m = mount(); await flush(); const grip = m.grips[0]
    grip.removeAttribute('id'); grip.removeAttribute('gesture-target')
    native(grip, 'touchstart', 50, 7, 1000); await flush()
    native(grip, 'touchmove', 90, 8, 1100); await flush()
    expect(m.value.value).toBe(50); expect(m.line.style.width).toBe('50%')
    native(grip, 'touchend', 50, 7, 1200); await flush(); expect(m.changes).toEqual([50])
  })

  it('touches/changed 各一个但指向两根手指，后续仍严格匹配', async () => {
    const m = mount(); await flush(); const grip = m.grips[0]
    native(grip, 'touchstart', 50, 7, 1000); await flush()
    fireEvent.touchend(grip, { touches: [point(50, 7)], changedTouches: [point(80, 8)], timestamp: 1100, bubbles: true })
    native(grip, 'touchmove', 90, 8, 1200); await flush()
    expect(m.value.value).toBe(50); expect(m.changes).toEqual([])
    native(grip, 'touchmove', 60, 7, 1300); native(grip, 'touchend', 65, 7, 1400); await flush()
    expect(m.changes).toEqual([65])
  })

  it('长度为一的嵌套触点数组不视为合法单指', async () => {
    const m = mount(); await flush(); const grip = m.grips[0]
    native(grip, 'touchstart', 50, 7, 1000); await flush()
    const nested = [[point(90, 8)]]
    fireEvent.touchmove(grip, { touches: nested, changedTouches: nested, detail: { x: 180, y: 0 }, timestamp: 1100, bubbles: true })
    await flush(); expect(m.value.value).toBe(50); expect(m.line.style.width).toBe('50%')
    native(grip, 'touchend', 50, 7, 1200); await flush(); expect(m.changes).toEqual([50])
  })

  it('同毫秒/浮点时间桶的新 start 仍可接管，已知更早的帧不能污染', async () => {
    const m = mount(); await flush()
    const time = Math.fround(1_794_000_000_000)
    native(m.grips[0], 'touchstart', 50, 1, time); await flush()
    native(m.grips[0], 'touchmove', 60, 2, time); await flush()
    native(m.grips[0], 'touchstart', 60, 3, time); await flush()
    native(m.grips[0], 'touchmove', 75, 4, time); await flush()
    expect(m.value.value).toBe(75)
    native(m.grips[0], 'touchend', 0, 99, time - 1000); await flush(); expect(m.value.value).toBe(75)
    native(m.grips[0], 'touchend', 80, 5, time); await flush(); expect(m.changes.at(-1)).toBe(80)
    expect(m.events.filter((v) => v === 'start')).toHaveLength(2)
  })
})

/** Slider 手势协议回归：真实冒泡、跨线程排队、结束/取消与暂停续拖。
 * JSDOM 验证状态和事件/样式协议，不冒充 Android/iOS 原生滚动与像素验收。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { useLockScroll, usePageScrollLock } from '@wot-lynx/core/composables/useLockScroll'
import Slider from '@wot-lynx/ui-form/wd-slider'
import type { SliderValue } from '@wot-lynx/ui-form/wd-slider/types'

const restore: Array<() => void> = []
const rectangle = { left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 }
const lock = usePageScrollLock()
const point = (x: number, y = 0, identifier: number | null = 1) => ({ clientX: x, clientY: y, ...(identifier == null ? {} : { identifier }) })

function rects(hold = false) {
  const pending: any[] = []
  const lynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const original = lynx.createSelectorQuery
  lynx.createSelectorQuery = () => ({ select: () => ({ invoke: (options: any) => {
    if (hold) pending.push(options)
    else options.success?.(rectangle)
    return { exec() {} }
  } }) })
  restore.push(() => { lynx.createSelectorQuery = original })
  return pending
}

function mount(initial: SliderValue = 50, options: Record<string, any> = {}) {
  const value = ref(initial)
  const props = ref(options)
  const updates: SliderValue[] = [], changes: SliderValue[] = [], events: string[] = []
  let instance: any
  const result = render({ setup: () => () => h(Slider as any, {
    ...props.value, modelValue: value.value, ref: (component: any) => { instance = component },
    'onUpdate:modelValue': (next: SliderValue) => { value.value = next; updates.push(Array.isArray(next) ? [...next] : next) },
    onChange: (next: SliderValue) => changes.push(Array.isArray(next) ? [...next] : next),
    onDragstart: () => events.push('start'), onDragmove: () => events.push('move'), onDragend: () => events.push('end')
  }) } as any)
  const grips = [...result.container.querySelectorAll('.wd-slider__dot-slider')]
  const line = result.container.querySelector('.wd-slider__line') as HTMLElement
  const bar = result.container.querySelector('.wd-slider__bar')!
  return { ...result, value, props, updates, changes, events, grips, line, bar, instance: () => instance }
}

async function flush(ms = 20) {
  await vi.advanceTimersByTimeAsync(ms)
  await nextTick()
}
function touch(target: Element, type: string, p: any, timestamp: number | string = 1000) {
  fireEvent[type](target, { touches: /end|cancel/.test(type) ? [] : [p], changedTouches: [p], timestamp, bubbles: true })
}

/** 只延迟 BG publishEvent，MT 仍在同一 native-like 冒泡事件内同步执行。 */
function delayBackground() {
  const g = globalThis as any
  const env = g.lynxTestingEnv
  const originalHook = g.onSwitchedToBackgroundThread
  const publish = env.backgroundThread.globalThis.publishEvent
  const pending: Array<{ sign: any; data: any }> = []
  const delayed = (sign: any, data: any) => pending.push({ sign, data: {
    ...data, timeStamp: data.timeStamp, target: data.target, currentTarget: data.currentTarget
  } })
  g.onSwitchedToBackgroundThread = () => {
    originalHook?.()
    g.lynxCoreInject.tt.publishEvent = delayed
  }
  restore.push(() => {
    g.onSwitchedToBackgroundThread = originalHook
    env.switchToBackgroundThread()
    originalHook?.()
  })
  return {
    pending,
    async release(count = pending.length) {
      for (let i = 0; i < count; i++) {
        const event = pending.shift()
        if (!event) throw new Error('expected another queued BG event')
        env.switchToBackgroundThread()
        publish(event.sign, event.data)
        await flush()
      }
    }
  }
}

afterEach(() => { cleanup(); restore.splice(0).reverse().forEach((fn) => fn()); vi.useRealTimers() })

describe('Slider 局部手势与收尾', () => {
  it.each(['other-end', 'other-move', 'old-move', 'invalid-move'])('%s 不能撤掉或续命旧手势的兜底', async (kind) => {
    vi.useFakeTimers(); rects(); const m = mount(); await flush()
    const before = lock.value
    touch(m.grips[0], 'touchstart', point(100), 1000)
    await flush(700)
    if (kind === 'other-end') fireEvent.touchend(m.grips[0], {
      touches: [point(100)], changedTouches: [point(120, 0, 2)], timestamp: 1100, bubbles: true
    })
    else fireEvent.touchmove(m.bar, {
      touches: [kind === 'invalid-move' ? { identifier: 1 } : point(150, 0, kind === 'other-move' ? 2 : 1)],
      timestamp: kind === 'old-move' ? 900 : 1100
    })
    await flush(700)
    expect(m.events.filter((v) => v === 'end')).toHaveLength(1)
    expect(m.line.getAttribute('gesture-active')).toBe('false')
    expect(lock.value).toBe(before)
  })

  it('mixed changedTouches 的无标识候选允许收尾，但不借用明确异号坐标', async () => {
    vi.useFakeTimers(); rects(); const m = mount(); await flush()
    touch(m.grips[0], 'touchstart', point(100), 1000)
    fireEvent.touchend(m.grips[0], { touches: [], changedTouches: [point(120, 0, 2), point(150, 0, null)], timestamp: 1100, bubbles: true })
    await flush()
    expect(m.events).toEqual(['start', 'end'])
    expect(m.changes).toEqual([50])
  })

  it('单个无标识 move 在 MT/BG 都连续取值', async () => {
    vi.useFakeTimers(); rects(); const m = mount(); await flush()
    touch(m.grips[0], 'touchstart', point(100, 0, 7), 1000)
    await flush()
    touch(m.grips[0], 'touchmove', point(150, 0, null), 1100)
    expect(m.line.style.width).toBe('75%')
    await flush()
    expect(m.updates.at(-1)).toBe(75)
    touch(m.grips[0], 'touchend', point(150, 0, null), 1200)
    await flush(); expect(m.changes.at(-1)).toBe(75)
  })

  it('无标识起点后的多指候选不更新或猜测终点', async () => {
    vi.useFakeTimers(); rects(); const m = mount(); await flush()
    touch(m.grips[0], 'touchstart', point(100, 0, null), 1000); await flush()
    fireEvent.touchmove(m.grips[0], { touches: [point(180, 0, 2), point(100, 0, 1)], changedTouches: [point(180, 0, 2)], timestamp: 1100, bubbles: true })
    await flush(); expect(m.updates).toEqual([]); expect(m.line.style.width).toBe('50%')
    fireEvent.touchend(m.grips[0], { touches: [], changedTouches: [point(180, 0, 2), point(100, 0, 1)], timestamp: 1200, bubbles: true })
    await flush(); expect(m.changes).toEqual([50]); expect(m.line.getAttribute('gesture-active')).toBe('false')
  })

  it('新单指 start 立即接管漏 end 的旧手势，多指 start 不抢占', async () => {
    vi.useFakeTimers(); rects(); const m = mount(); await flush()
    touch(m.grips[0], 'touchstart', point(100), 1000)
    fireEvent.touchstart(m.grips[0], { touches: [point(100), point(120, 0, 2)], changedTouches: [point(120, 0, 2)], timestamp: 1100, bubbles: true })
    await flush(); expect(m.events).toEqual(['start'])
    touch(m.grips[0], 'touchstart', point(100, 0, 2), 2000)
    await flush()
    touch(m.grips[0], 'touchmove', point(150, 0, 2), 2100)
    touch(m.grips[0], 'touchend', point(150, 0, 2), 2200)
    await flush()
    expect(m.changes.at(-1)).toBe(75)
    expect(m.events.filter((v) => v === 'start')).toHaveLength(2)
    expect(m.events.filter((v) => v === 'end')).toHaveLength(2)
  })

  it.each(['touchend', 'touchcancel'])('复用同 id 后的旧 %s 不能结束新段', async (kind) => {
    vi.useFakeTimers(); rects(); const m = mount(); await flush()
    touch(m.grips[0], 'touchstart', point(100), 1000); touch(m.grips[0], 'touchend', point(100), 1100); await flush()
    touch(m.grips[0], 'touchstart', point(100), 2000); await flush()
    touch(m.grips[0], kind, point(40), 1100); await flush()
    expect(m.changes).toEqual([50]); expect(m.line.getAttribute('gesture-active')).toBe('true')
    touch(m.grips[0], 'touchmove', point(150), 2100); touch(m.grips[0], 'touchend', point(150), 2200); await flush()
    expect(m.changes).toEqual([50, 75])
  })

  it('旧尺寸回调不能清掉新拖动计时器或新落定的样式所有权', async () => {
    vi.useFakeTimers(); const pending = rects(true); const m = mount(); await flush()
    touch(m.grips[0], 'touchstart', point(100), 1000); touch(m.grips[0], 'touchend', point(150), 1100); await flush()
    const old = pending.at(-1)
    touch(m.grips[0], 'touchstart', point(100, 0, 2), 2000); touch(m.grips[0], 'touchend', point(120, 0, 2), 2100); await flush()
    const current = pending.at(-1)
    old.success(rectangle); await flush(); expect(m.line.getAttribute('gesture-active')).toBe('true')
    current.success(rectangle); await flush(); expect(m.line.getAttribute('gesture-active')).toBe('false')
    touch(m.grips[0], 'touchstart', point(100, 0, 3), 3000); await flush(1400)
    expect(m.line.getAttribute('gesture-active')).toBe('false')
  })

  it.each([false, true])('vertical=%s 只消费滑块同轴；交叉轴不改值，不持全页租约', async (vertical) => {
    vi.useFakeTimers(); rects(); const before = lock.value; const m = mount(50, { vertical }); await flush()
    const barProps = m.instance().$.subTree.children.find((v: any) => v.props?.class?.includes?.('wd-slider__bar')).props
    expect(barProps['consume-slide-event']).toEqual(vertical ? [[-135, -45], [45, 135]] : [[-180, -135], [-45, 45], [135, 180]])
    expect(barProps.flatten).toBe(false)
    touch(m.grips[0], 'touchstart', point(100, 100), 1000)
    await flush(); expect(lock.value).toBe(before)
    touch(m.grips[0], 'touchmove', vertical ? point(140, 105) : point(105, 140), 1100)
    await flush(); expect(m.updates).toEqual([]); expect(m.line.getAttribute('gesture-active')).toBe('false')
    expect(m.container.querySelector('.wd-slider__dot-popover')).toBeNull()
    m.props.value.disabled = true; await flush()
    expect(m.instance().$.subTree.children.find((v: any) => v.props?.class?.includes?.('wd-slider__bar')).props['consume-slide-event']).toEqual([])
  })

  it('Slider 结束不解开其他弹层的滚动租约', async () => {
    vi.useFakeTimers(); rects(); const held = ref(true)
    const { container } = render({ setup() { useLockScroll(() => held.value); return () => h(Slider, { modelValue: 50 }) } } as any)
    await flush(); const grip = container.querySelector('.wd-slider__dot-slider')!
    touch(grip, 'touchstart', point(100), 1000); touch(grip, 'touchend', point(150), 1100); await flush()
    expect(lock.value).toBe(true); held.value = false; await flush(); expect(lock.value).toBe(false)
  })
})

describe('Slider 真实事件链、缓存与退休续拖', () => {
  it.each([false, true].flatMap((vertical) => [false, true].map((range) => ({ vertical, range }))))('50轮握把内部图标/end/cancel（%j）', async ({ vertical, range }) => {
    vi.useFakeTimers(); rects(); const m = mount(range ? [20, 80] : 50, { vertical, range }); await flush()
    const before = lock.value
    for (let i = 0; i < 50; i++) {
      const index = range ? i % 2 : 0, grip = m.grips[index], icon = grip.querySelector('text')!
      const values = m.value.value, initial = Array.isArray(values) ? values[index] : values
      const next = range ? (index === 0 ? 30 : 70) : i % 2 === 0 ? 40 : 60
      const p = (v: number) => vertical ? point(100, v * 2) : point(v * 2, 100)
      touch(icon, 'touchstart', p(initial), 1000 + i * 10); await flush()
      touch(icon, 'touchmove', p(next), 1001 + i * 10)
      const expected = range ? index === 0 ? [next, (values as number[])[1]] : [(values as number[])[0], next] : next
      expect(m.line.style.getPropertyValue(vertical ? 'height' : 'width')).toBe(`${Array.isArray(expected) ? expected[1] - expected[0] : expected}%`)
      await flush(); touch(icon, i % 7 ? 'touchend' : 'touchcancel', p(next), 1002 + i * 10); await flush()
      expect(m.changes).toHaveLength(i + 1); expect(m.changes.at(-1)).toEqual(expected)
      expect(m.line.getAttribute('gesture-active')).toBe('false'); expect(m.container.querySelector('.wd-slider__dot-popover')).toBeNull()
      expect(m.container.querySelectorAll('.wd-slider__dot-slider')[index]).toBe(grip); expect(lock.value).toBe(before)
    }
    expect(m.events.filter((v) => v === 'start')).toHaveLength(50); expect(m.events.filter((v) => v === 'end')).toHaveLength(50)
  })

  it.each([false, true])('暂停后可重复续拖，range跨越也保留原始映射（range=%s）', async (range) => {
    vi.useFakeTimers(); rects(); const m = mount(range ? [20, 80] : 50, { range }); await flush()
    const grip = m.grips[0], initial = range ? 40 : 100
    touch(grip, 'touchstart', point(initial), 1000); await flush()
    touch(grip, 'touchmove', point(180), 1100); await flush(1400)
    touch(grip, 'touchmove', point(140), 2500); await flush()
    expect(m.updates.at(-1)).toEqual(range ? [70, 80] : 70)
    await flush(1400); touch(grip, 'touchmove', point(160), 4000); await flush()
    expect(m.updates.at(-1)).toEqual(range ? [80, 80] : 80)
    touch(grip, 'touchend', point(160), 4100); await flush()
    expect(m.changes.at(-1)).toEqual(range ? [80, 80] : 80)
    expect(m.events.filter((v) => v === 'start')).toHaveLength(3); expect(m.events.filter((v) => v === 'end')).toHaveLength(3)
  })

  it.each(['touchend', 'touchcancel', 'external', 'disabled'])('timeout 后的 %s 撤销退休资格，旧move不复活', async (kind) => {
    vi.useFakeTimers(); rects(); const m = mount(); await flush()
    touch(m.grips[0], 'touchstart', point(100), 1000); await flush(1400)
    if (kind === 'external') m.value.value = 20
    else if (kind === 'disabled') m.props.value.disabled = true
    else touch(m.grips[0], kind, point(100), 2500)
    await flush(); const oldStyle = m.line.getAttribute('style'), count = m.changes.length
    touch(m.grips[0], 'touchmove', point(170), 2600); await flush()
    expect(m.changes).toHaveLength(count); expect(m.line.getAttribute('style')).toBe(oldStyle)
    expect(m.line.getAttribute('gesture-active')).toBe('false')
  })

  it('BG-only 轨道点按必须废弃 MT 旧缓存', async () => {
    vi.useFakeTimers(); rects(); const m = mount(); await flush()
    touch(m.grips[0], 'touchstart', point(100), 1000); touch(m.grips[0], 'touchend', point(150), 1100); await flush()
    touch(m.bar, 'touchstart', point(40), 2000); touch(m.bar, 'touchend', point(40), 2100); fireEvent.tap(m.bar, { detail: { x: 40 } }); await flush()
    expect(m.value.value).toBe(20)
    touch(m.grips[0], 'touchstart', point(40), 3000); await flush(); touch(m.grips[0], 'touchmove', point(60), 3100)
    expect(m.line.style.width).toBe('30%'); await flush(); expect(m.value.value).toBe(30)
  })

  it.each([true, false])('MT B先于排队BG A结束，A不能覆盖B位置或使B失效（time=%s）', async (knownTime) => {
    vi.useFakeTimers(); rects(); const m = mount(); await flush(); const bg = delayBackground()
    const t = (value: number) => knownTime ? value : 'invalid'
    touch(m.grips[0], 'touchstart', point(100), t(1000)); touch(m.grips[0], 'touchmove', point(150), t(1100)); touch(m.grips[0], 'touchend', point(150), t(1200))
    touch(m.grips[0], 'touchstart', point(150), t(2000)); touch(m.grips[0], 'touchmove', point(170), t(2100))
    expect(m.line.style.width).toBe('85%')
    // A start dot/bar、A move bar、A end dot/bar，B 的 BG start 仍保持排队。
    expect(bg.pending.length).toBeGreaterThanOrEqual(8)
    await bg.release(5)
    expect(m.line.style.width, '迟到 A 的 STYLE 不得覆盖正在 MT 跟手的 B').toBe('85%')
    await bg.release()
    touch(m.grips[0], 'touchmove', point(180), t(2200)); expect(m.line.style.width).toBe('90%'); await bg.release()
    touch(m.grips[0], 'touchend', point(180), t(2300)); await bg.release()
    expect(m.changes).toEqual([75, 90]); expect(m.events.filter((v) => v === 'end')).toHaveLength(2)
  })

  it('无时间的 B 在旧 A 结束之后、BG B确认之前松手，终点仍进入 MT 缓存', async () => {
    vi.useFakeTimers(); rects(); const m = mount(); await flush(); const bg = delayBackground()
    touch(m.grips[0], 'touchstart', point(100), 'invalid')
    touch(m.grips[0], 'touchend', point(150), 'invalid')
    touch(m.grips[0], 'touchstart', point(150), 'invalid')
    await bg.release(4)
    touch(m.grips[0], 'touchend', point(180), 'invalid')
    expect(m.line.style.width).toBe('90%')
    await bg.release(); expect(m.changes).toEqual([75, 90])
    touch(m.grips[0], 'touchstart', point(180), 'invalid')
    touch(m.grips[0], 'touchmove', point(200), 'invalid')
    expect(m.line.style.width).toBe('100%')
    await bg.release(); touch(m.grips[0], 'touchend', point(200), 'invalid'); await bg.release()
    expect(m.changes).toEqual([75, 90, 100])
  })

  it('起始 MT 零几何的 BG 最终落定必须刷新位置和下一次手势的缓存', async () => {
    vi.useFakeTimers(); const pending = rects(true); const m = mount(); await flush()
    pending[0].success({ ...rectangle, width: 0, height: 0 }); await flush()
    touch(m.grips[0], 'touchstart', point(100), 1000)
    touch(m.grips[0], 'touchend', point(150), 1100)
    pending.at(-1).success(rectangle); await flush()
    expect(m.value.value).toBe(75); expect(m.line.style.width).toBe('75%')
    touch(m.grips[0], 'touchstart', point(150), 2000); await flush()
    touch(m.grips[0], 'touchmove', point(170), 2100)
    expect(m.line.style.width).toBe('85%'); await flush(); expect(m.value.value).toBe(85)
  })

  it('续拖段的时间起点独立于原始几何起点，旧 end 不终止已恢复的手势', async () => {
    vi.useFakeTimers(); rects(); const m = mount(); await flush()
    touch(m.grips[0], 'touchstart', point(100), 1000)
    touch(m.grips[0], 'touchmove', point(150), 1100); await flush(1400)
    touch(m.grips[0], 'touchmove', point(170), 2500); await flush()
    touch(m.grips[0], 'touchend', point(40), 1500); await flush()
    expect(m.line.getAttribute('gesture-active')).toBe('true'); expect(m.value.value).toBe(85)
    touch(m.grips[0], 'touchend', point(170), 2600); await flush()
    expect(m.events.filter((v) => v === 'end')).toHaveLength(2); expect(m.changes.at(-1)).toBe(85)
  })
})

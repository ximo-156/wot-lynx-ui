import { afterEach, describe, expect, it } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '@wot-lynx/core/common/util'
import NativeSlider from '../../../demo/src/perf/NativeSlider.vue'
import PerfApp from '../../../demo/src/perf/App.vue'

afterEach(cleanup)

describe('native slider performance baseline', () => {
  it('mounts only the selected version and publishes move counts after release', async () => {
    const mounted = render(PerfApp)
    await pause(10)
    expect(mounted.container.querySelectorAll('.wd-slider')).toHaveLength(1)
    fireEvent.tap(mounted.container.querySelectorAll('.perf__choice')[1])
    await pause(10)
    expect(mounted.container.querySelector('.wd-slider')).toBeNull()
    const thumb = mounted.container.querySelector('.native-slider__thumb')!
    fireEvent.touchstart(thumb, { touches: [{ clientX: 140 }], bubbles: true })
    await pause(10)
    fireEvent.touchmove(thumb, { touches: [{ clientX: 210 }], bubbles: true })
    await pause(10)
    expect(mounted.container.textContent).toContain('move 0')
    fireEvent.touchend(thumb, { touches: [], changedTouches: [{ clientX: 210 }], bubbles: true })
    await pause(10)
    expect(mounted.container.textContent).toContain('move 1')
    fireEvent.tap(mounted.container.querySelectorAll('.perf__choice')[0])
    await pause(10)
    expect(mounted.container.querySelector('.native-slider')).toBeNull()
    expect(mounted.container.querySelectorAll('.wd-slider')).toHaveLength(1)
    expect(mounted.container.textContent).toContain('值 50 · move 0 · change 0')
  })

  it('paints on MT before flushing BG updates and commits the terminal point', async () => {
    const updates: number[] = [], changes: number[] = []
    const mounted = render({ setup() {
      const value = ref(50)
      return () => h(NativeSlider, { modelValue: value.value,
        'onUpdate:modelValue': (next: number) => { updates.push(next); value.value = next },
        onChange: (next: number) => changes.push(next)
      })
    } })
    await pause(10)
    const thumb = mounted.container.querySelector('.native-slider__thumb')!
    const fill = mounted.container.querySelector('.native-slider__fill') as HTMLElement
    expect(mounted.container.querySelector('.native-slider')?.getAttribute('gesture-value')).toBe('50')
    fireEvent.touchstart(thumb, { touches: [{ clientX: 140 }], bubbles: true })
    await pause(10)
    fireEvent.touchmove(thumb, { touches: [{ clientX: 210 }], bubbles: true })
    expect(fill.style.width).toBe('75%')
    await pause(10)
    expect(updates).toEqual([75])
    fireEvent.touchend(thumb, { touches: [], changedTouches: [{ clientX: 280 }], bubbles: true })
    await pause(10)
    expect(updates).toEqual([75, 100])
    expect(changes).toEqual([100])
    expect(fill.style.width).toBe('100%')
  })
})

import { describe, it, expect } from 'vitest'
import { inject, provide, ref, watch } from 'vue-lynx'
import { render } from './render'
import WdIcon from '../src/components/wd-icon/wd-icon.vue'

describe('debug watch', () => {
  it('injected ref replacement triggers deep watch in child', async () => {
    const key = '__DBG_WATCH_KEY__'
    const calls: any[] = []
    ;(globalThis as any).__DBG_CALLS__ = calls
    const Child = {
      components: { WdIcon },
      setup() {
        const r = inject(key, ref<any>({ a: 1 }))
        console.log('[DBG] child setup, a =', (r.value as any).a)
        watch(
          () => r.value,
          (v) => {
            ;(globalThis as any).__DBG_CALLS__.push((v as any).a)
          },
          { deep: true, immediate: true }
        )
      },
      template: `<view class="dbg-child" />`
    }
    const Wrapper = {
      components: { Child },
      setup() {
        const r = ref<any>({ a: 1 })
        provide(key, r)
        ;(globalThis as any).__DBG_PARENT_REF__ = r
        console.log('[DBG] wrapper setup done')
      },
      template: `<Child />`
    }
    const { container } = render(Wrapper)
    await new Promise((r) => setTimeout(r, 30))
    console.log('[DBG] container:', container.outerHTML.slice(0, 200))
    console.log('[DBG] calls after mount:', JSON.stringify(calls))
    ;(globalThis as any).__DBG_PARENT_REF__.value = { a: 2 }
    await new Promise((r) => setTimeout(r, 30))
    console.log('[DBG] calls after replace:', JSON.stringify(calls))
    expect(calls).toEqual([1, 2])
  })
})

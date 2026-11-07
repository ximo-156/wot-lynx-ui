import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick, provide, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import { SCROLL_LOCK_TARGET_KEY, useLockScroll, usePageScrollLock } from '../../src/composables/useLockScroll'

afterEach(cleanup)

describe('embedded Web scroll lock targets', () => {
  it('keeps nested preview leases local and restores the target without locking document body', async () => {
    const doc = (globalThis as any).lynxTestingEnv.jsdom.window.document as Document
    const first = ref(true)
    const second = ref(true)
    let target: HTMLElement
    let originalBody = ''
    const Locks = { setup() {
      const owner = Symbol('preview-owner')
      useLockScroll(() => first.value, owner)
      useLockScroll(() => second.value, owner)
      return () => h('view', 'Preview')
    } }
    render({ setup() {
      target = doc.createElement('div')
      target.style.overflow = 'auto'
      originalBody = doc.body.style.overflow
      provide(SCROLL_LOCK_TARGET_KEY, () => target)
      return () => h(Locks as any)
    } } as any)
    await nextTick()
    expect(target!.style.overflow).toBe('hidden')
    expect(doc.body.style.overflow).toBe(originalBody)
    expect(usePageScrollLock().value).toBe(false)
    first.value = false
    await nextTick()
    expect(target!.style.overflow).toBe('hidden')
    second.value = false
    await nextTick()
    expect(target!.style.overflow).toBe('auto')
    first.value = true; second.value = true
    await nextTick()
    cleanup()
    expect(target!.style.overflow).toBe('auto')
    expect(doc.body.style.overflow).toBe(originalBody)
  })
})

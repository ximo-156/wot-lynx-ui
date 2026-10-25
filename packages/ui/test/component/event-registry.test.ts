/**
 * 事件注册表回归测试。
 *
 * 背景：真机曾出现 `TypeError: _getRegistryState_handlers_get is not a
 * function`（publishEvent 中 handlers.get(sign) 返回了非函数）。
 * 该错误只可能由「非函数处理器被注册」引起，故本测试包装注册表的
 * set 方法，挂载全量 Demo 组件树并模拟交互，断言注册的处理器全是函数。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import DemoApp from '../../../demo/src/App.vue'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'

const REGISTRY_KEY = '__VUE_LYNX_EVENT_REGISTRY__'

/** 注册表状态懒创建（与 vue-lynx event-registry 的 getRegistryState 一致） */
function ensureRegistryState() {
  let state = (globalThis as any)[REGISTRY_KEY]
  if (!state) {
    state = { signCounter: 0, handlers: new Map() }
    Object.defineProperty(globalThis, REGISTRY_KEY, {
      value: state,
      configurable: true,
      enumerable: false,
      writable: true
    })
  }
  return state
}

describe('事件注册表', () => {
  beforeAll(() => {
    const state = ensureRegistryState()
    const origSet = state.handlers.set.bind(state.handlers)
    const bad: Array<{ key: string; type: string }> = []
    ;(globalThis as any).__BAD_HANDLERS__ = bad
    state.handlers.set = (k: string, v: unknown) => {
      if (typeof v !== 'function') bad.push({ key: k, type: typeof v })
      return origSet(k, v)
    }
  })

  it('全量组件树注册的事件处理器均为函数', async () => {
    const errors: string[] = []
    const origPublish = (globalThis as any).publishEvent
    ;(globalThis as any).publishEvent = (sign: string, data: unknown) => {
      try {
        return origPublish(sign, data)
      } catch (e) {
        errors.push((e as Error).message)
      }
    }

    const { container } = render(DemoApp as any)
    await pause(300)

    // 模拟交互：点击可见元素 + 滚动滚动容器
    let fired = 0
    for (const el of Array.from(container.querySelectorAll('view, text, scroll-view'))) {
      try {
        fireEvent.tap(el)
        fired++
      } catch {
        /* 元素不可交互时忽略 */
      }
    }
    for (const el of Array.from(container.querySelectorAll('scroll-view'))) {
      for (const name of ['scroll', 'scrollend']) {
        try {
          fireEvent[name](el, { scrollLeft: 20, scrollTop: 20 })
          fired++
        } catch {
          /* 事件类型不支持时忽略 */
        }
      }
    }
    await pause(200)

    expect((globalThis as any).__BAD_HANDLERS__).toEqual([])
    expect(errors).toEqual([])
    expect(fired).toBeGreaterThan(0)
    cleanup()
  })
})

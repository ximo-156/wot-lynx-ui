/**
 * fireEvent — 通过双线程管线派发 Lynx 事件。
 *
 * 事件在 JSDOM 元素（主线程）上派发，PAPI 的 __AddEvent 监听器会拦截并调用
 * lynxCoreInject.tt.publishEvent，从而切换到后台线程执行 Vue 事件处理器。
 *
 * 事件类型格式："bindEvent:tap"（与 __AddEvent 注册一致）。
 */
import { createEvent, fireEvent as domFireEvent } from '@testing-library/dom'

const EVENT_INIT_KEYS = new Set(['bubbles', 'cancelable', 'composed'])

export const eventMap: Record<string, { defaultInit: Record<string, unknown> }> = {
  tap: { defaultInit: {} },
  longtap: { defaultInit: {} },
  touchstart: { defaultInit: {} },
  touchmove: { defaultInit: {} },
  touchcancel: { defaultInit: {} },
  touchend: { defaultInit: {} },
  longpress: { defaultInit: {} },
  scroll: { defaultInit: {} },
  scrollend: { defaultInit: {} },
  focus: { defaultInit: {} },
  blur: { defaultInit: {} },
  input: { defaultInit: {} },
  confirm: { defaultInit: {} },
  layoutchange: { defaultInit: {} },
  transitionend: { defaultInit: {} },
  animationend: { defaultInit: {} }
}

export const fireEvent: Record<string, any> & ((elem: Element, event: Event) => boolean) = ((elem: Element, event: Event) => {
  const env = (globalThis as any).lynxTestingEnv
  const isMainThread = (globalThis as any).__MAIN_THREAD__

  env.switchToBackgroundThread()
  const ans = domFireEvent(elem, event)

  if (isMainThread) {
    env.switchToMainThread()
  }
  return ans
}) as any

for (const key of Object.keys(eventMap)) {
  fireEvent[key] = (elem: Element, init?: Record<string, unknown>): boolean => {
    const env = (globalThis as any).lynxTestingEnv
    const isMainThread = (globalThis as any).__MAIN_THREAD__

    env.switchToBackgroundThread()

    const eventType = (init?.eventType as string) || 'bindEvent'
    const eventInit = {
      eventType,
      eventName: key,
      ...eventMap[key].defaultInit,
      ...init
    }

    const event = createEvent(`${eventType}:${key}`, elem, eventInit)
    const customProps = Object.fromEntries(Object.entries(eventInit).filter(([k]) => !EVENT_INIT_KEYS.has(k)))
    Object.assign(event, customProps)
    const ans = domFireEvent(elem, event)

    if (isMainThread) {
      env.switchToMainThread()
    }
    return ans
  }
}

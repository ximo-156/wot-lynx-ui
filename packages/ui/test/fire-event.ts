/**
 * fireEvent — 通过双线程管线派发 Lynx 事件。
 *
 * 事件在 JSDOM 元素（主线程）上派发，PAPI 的 __AddEvent 监听器会拦截并调用
 * lynxCoreInject.tt.publishEvent，从而切换到后台线程执行 Vue 事件处理器。
 *
 * 事件类型格式："bindEvent:tap"（与 __AddEvent 注册一致）。
 *
 * 主线程 worklet 事件（main-thread-bind*）：ElementPAPI 以
 * `Object.assign({}, evt)` 拷贝事件后调 runWorklet——jsdom 的
 * target/currentTarget 是 Event.prototype 访问器，不在自有属性里，拷贝即丢失。
 * 真机 Lynx 事件自带绑定元素 currentTarget；测试用可枚举 Symbol getter 在
 * Object.assign 的时刻采样 event.currentTarget，而不是固定在派发的图标落点。
 * mts-worklet-shim 据此恢复每一层实际的绑定元素，支持真实冒泡链的索引判断。
 */
import { createEvent, fireEvent as domFireEvent } from '@testing-library/dom'
import { WD_EVENT_TARGET_EL } from './mts-worklet-shim'

const EVENT_INIT_KEYS = new Set(['bubbles', 'cancelable', 'composed'])

export const eventMap: Record<string, { defaultInit: Record<string, unknown> }> = {
  tap: { defaultInit: {} },
  // Lynx view 原生 click 事件（部分交互组件根 view 用 @click 而非 @tap，
  // 见 CONVENTIONS §14：避免与消费方 @tap 同名合并击穿事件注册表）
  click: { defaultInit: {} },
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
  // 原生 <image> 生命周期事件（detail.width / height 是图片原始像素）
  load: { defaultInit: {} },
  error: { defaultInit: {} },
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
    // worklet 事件的 currentTarget/target 桥接（Symbol 自有属性，见文件头）
    Object.defineProperty(event, WD_EVENT_TARGET_EL, {
      enumerable: true,
      get: () => event.currentTarget || elem
    })
    const ans = domFireEvent(elem, event)

    if (isMainThread) {
      env.switchToMainThread()
    }
    return ans
  }
}

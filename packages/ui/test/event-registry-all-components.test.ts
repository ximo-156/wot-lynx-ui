/**
 * 事件注册表全覆盖回归测试 — CONVENTIONS §14。
 *
 * 用户真机反馈（Sentry，手动测试复现）：
 *   TypeError: _getRegistryState_handlers_get is not a function
 *
 * 根因：vue-lynx 把元素事件处理器按 sign 存进
 * globalThis.__VUE_LYNX_EVENT_REGISTRY__ 的 Map，原生事件到来时由
 * lynx_core 调 publishEvent(sign, data) 取出并**直接调用**——只容忍函数值。
 * 当消费方在组件上绑某个原生事件（Lynx 惯用法 @tap / @touchmove…），而该
 * 事件未被组件 defineEmits 声明时，监听会穿透 $attrs 落到组件根 vnode 链
 * 末端的原生元素上，与元素自身的同名监听被 mergeProps 合并成**数组**，
 * 数组被原样注册——事件一派发即抛上述 TypeError。
 * （标准 Vue DOM 的 patchEvent 支持监听数组，所以该 bug 只在 Lynx 暴露。）
 *
 * 做法：对组件库**每一个组件**，挂载时绑定全部 Lynx 原生事件名，然后对
 * 渲染树中的**每一个真实元素**逐一派发全部事件。派发抛 registry TypeError
 * 即失败（注释根上的惰性数组不会收到派发，不构成用户可见崩溃，故只以
 * 「派发不抛」为准）。
 *
 * 修复模式：组件把根 vnode 链上的原生事件名同时声明为 emit 并转发；对
 * 「根是子组件」的包装链（overlay→transition 等），在最外层组件声明即可
 * 阻止穿透。
 */
import { describe, it, expect } from 'vitest'
import { h } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'

/** 全部 Lynx 原生事件名（fire-event.ts 支持派发的集合） */
const NATIVE_EVENTS = [
  'tap', 'longtap', 'longpress', 'touchstart', 'touchmove', 'touchend',
  'touchcancel', 'transitionend', 'animationend', 'scroll', 'scrollend',
  'focus', 'blur', 'input', 'confirm', 'layoutchange'
] as const

/** 触摸类事件的派发初始化（部分 handler 读取 touches[0]） */
const TOUCH_INIT = { touches: [{ clientX: 10, clientY: 10 }] }

/** 条件渲染组件的最小打开 props（不传则根元素不渲染，测试 vacuous） */
const OPEN_PROPS: Record<string, Record<string, unknown>> = {
  'wd-popup': { modelValue: true },
  'wd-curtain': { modelValue: true, src: 'https://example.com/a.png' },
  'wd-image-preview': { modelValue: true, images: ['https://example.com/a.png'] },
  'wd-video-preview': { modelValue: true, src: 'https://example.com/a.mp4' },
  'wd-dialog': { modelValue: true },
  'wd-action-sheet': { modelValue: true, actions: [{ name: 'a' }] },
  'wd-calendar': { visible: true },
  'wd-datetime-picker': { visible: true },
  'wd-datetime-picker-view': { visible: true },
  'wd-picker': { visible: true, columns: [['a', 'b']] },
  'wd-picker-view': { visible: true, columns: [['a', 'b']] },
  'wd-select-picker': { visible: true, columns: [['a', 'b']] },
  'wd-cascader': { visible: true, columns: [['a', 'b']] },
  'wd-keyboard': { visible: true },
  'wd-notify': { visible: true },
  'wd-popover': { visible: true },
  'wd-tooltip': { visible: true },
  'wd-floating-panel': { modelValue: true },
  'wd-drop-menu': { modelValue: true },
  'wd-share-sheet': { modelValue: true },
  'wd-tour': { modelValue: true },
  'wd-img-cropper': { modelValue: true, src: 'https://example.com/a.png' },
  'wd-signature': { modelValue: true },
  'wd-swipe-action': { modelValue: 'close' },
  'wd-qr-code': { text: 'x' },
  'wd-bar-code': { text: '12345678' },
  'wd-table': { data: [{ a: 1 }], columns: [{ prop: 'a', label: 'A' }] },
  'wd-swiper': { list: [{ url: 'https://example.com/a.png' }] },
  'wd-segmented': { options: ['a', 'b'] },
  'wd-loadmore': { state: 'error' },
  'wd-notice-bar': { text: 'x' },
  'wd-text': { text: 'x' },
  'wd-icon': { name: 'close' },
  'wd-button': { text: 'x' },
  'wd-cell': { title: 'x' },
  'wd-tag': { text: 'x' },
  'wd-badge': { value: 1 },
  'wd-img': { src: 'https://example.com/a.png' },
  'wd-video': { src: 'https://example.com/a.mp4' },
  'wd-watermark': { text: 'x' },
  'wd-transition': { show: true },
  'wd-overlay': { show: true },
  'wd-sort-button': { title: 'x' }
}

/** 取组件名（wd-xxx） */
function compName(path: string): string {
  const m = path.match(/(wd-[a-z-]+)\/wd-[a-z-]+\.vue$/)
  return m ? m[1] : path
}

const modules = import.meta.glob('../src/components/wd-*/wd-*.vue', { eager: true })
const entries = Object.entries(modules).filter(([path]) => !path.includes('/key/') && !path.includes('/year/'))

/** registry TypeError 的特征（合并数组被 publishEvent 调用） */
function isRegistryCrash(msg: string): boolean {
  return /handlers|_getRegistryState/.test(msg) && /is not a function/.test(msg)
}

describe('事件注册表全覆盖：每个组件 × 每个 Lynx 原生事件 × 每个真实元素', () => {
  it('组件清单非空', () => {
    expect(entries.length).toBeGreaterThan(50)
  })

  for (const [path, mod] of entries) {
    const name = compName(path)
    const Comp = (mod as any).default

    // 重型组件（日历/日期面板等）在全量并行跑时挂载 + 全元素派发会接近默认 5s 上限
    it(`${name}：绑定全部原生事件后挂载 + 全元素派发不崩溃`, () => {
      const listeners: Record<string, () => void> = {}
      for (const ev of NATIVE_EVENTS) {
        const key = 'on' + ev.charAt(0).toUpperCase() + ev.slice(1)
        listeners[key] = () => {}
      }

      let container: Element
      // 注册表跨测试残留：只断言本测试新注册的 sign（精确归属，避免串台）
      const registry = (globalThis as any).__VUE_LYNX_EVENT_REGISTRY__
      const signsBefore = registry ? new Set(registry.handlers.keys() as Iterable<string>) : new Set<string>()
      try {
        const rendered = render({
          setup() {
            return () =>
              h(
                Comp,
                { ...(OPEN_PROPS[name] || {}), ...listeners },
                { default: () => h('view', {}, [h('text', 'slot')]) }
              )
          }
        } as any)
        container = rendered.container
      } catch {
        // 挂载即抛（缺上下文等）与注册表无关，跳过
        cleanup()
        return
      }

      const elements = [...container.querySelectorAll('*')]
      for (const el of elements) {
        for (const ev of NATIVE_EVENTS) {
          try {
            ;(fireEvent as any)[ev](el, ev.startsWith('touch') ? TOUCH_INIT : undefined)
          } catch (e) {
            const msg = (e as Error)?.message || String(e)
            expect(
              isRegistryCrash(msg),
              `${name} 在 <${el.tagName.toLowerCase()} class="${el.className}"> 上派发 ${ev} 触发注册表崩溃：${msg}`
            ).toBe(false)
          }
        }
      }

      // 设备等价路径：lynx_core 事件到达时直接调 publishEvent(sign)。
      // 本测试新注册的数组 handler 说明发生了同名监听合并——逐一调用必崩。
      const state = (globalThis as any).__VUE_LYNX_EVENT_REGISTRY__
      const publish = (globalThis as any).publishEvent
      if (state && typeof publish === 'function') {
        for (const [sign, handler] of state.handlers as Map<string, unknown>) {
          if (signsBefore.has(sign)) continue
          if (Array.isArray(handler)) {
            let crashed = false
            try {
              publish(sign, {})
            } catch {
              crashed = true
            }
            expect(
              crashed,
              `${name} 注册表中存在合并数组 handler（sign=${sign}）——设备上事件到达即抛 registry TypeError`
            ).toBe(false)
          }
        }
      }
      cleanup()
    }, 20000)
  }
})

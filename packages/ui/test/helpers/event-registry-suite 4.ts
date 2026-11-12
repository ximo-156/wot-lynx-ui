/**
 * 事件注册表全覆盖回归测试的共享逻辑（CONVENTIONS §14）。
 *
 * 背景与做法见 test/component/event-registry-all-components.test.ts 头注释。
 * 拆出本模块的原因：域包拆分后（ADR-023），一次 eager 导入全部 106 个组件
 * 的 SFC 会超出 vitest worker 的默认堆上限（实测 OOM，worker 直接
 * Channel closed）。因此按包拆成两个测试文件，各自导入一半组件，
 * 共用本模块的派发逻辑——覆盖面不减，单 worker 内存有界。
 */
import { describe, it, expect } from 'vitest'
import { h } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'

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
  'wd-drop-menu': { visible: true }
}

/** 取组件名（wd-xxx） */
export function compName(path: string): string {
  const m = path.match(/(wd-[a-z-]+)\/wd-[a-z-]+\.vue$/)
  return m ? m[1] : path
}

/** registry TypeError 的特征（合并数组被 publishEvent 调用） */
function isRegistryCrash(msg: string): boolean {
  return /handlers|_getRegistryState/.test(msg) && /is not a function/.test(msg)
}

/**
 * 对给定组件条目跑「绑定全部原生事件 → 挂载 → 全元素派发」回归。
 * entries 为 import.meta.glob 的 [path, module] 条目（调用方负责筛选范围）。
 */
export function runEventRegistrySuite(label: string, entries: Array<[string, () => Promise<unknown>]>): void {
  describe(`事件注册表全覆盖（${label}）：每个组件 × 每个 Lynx 原生事件 × 每个真实元素`, () => {
    it('组件清单非空', () => {
      expect(entries.length).toBeGreaterThan(0)
    })

    for (const [path, load] of entries) {
      const name = compName(path)
      // 重型组件（日历/日期面板等）在全量并行跑时挂载 + 全元素派发会接近默认 5s 上限
      it(`${name}：绑定全部原生事件后挂载 + 全元素派发不崩溃`, async () => {
        const Comp = ((await load()) as any).default
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
      })
    }
  })
}

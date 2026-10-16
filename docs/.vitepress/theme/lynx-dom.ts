/**
 * lynx-dom — 文档站 H5 预览的「vue-lynx → 浏览器 DOM」渲染垫片。
 *
 * 背景：wot-lynx-ui 的组件源码面向 Lynx 引擎（vue-lynx 运行时 + view/text
 * 等原生元素 + SystemInfo / SelectorQuery 等宿主全局）。组件库自身已为
 * 「Web 预览」预留了降级路径（common/util.ts 的 DOM 度量兜底、common/uni.ts
 * 的 uni 兼容层），因此只需在浏览器中补三块拼图，即可让真实组件源码在
 * 文档站里直接渲染：
 *
 * 1. **模块别名**：`vue-lynx` → 本文件（Vite alias），组件 import 的
 *    computed / ref / useSlots 等 API 全部由 `vue` 提供；
 * 2. **渲染器**：基于 @vue/runtime-core 的 createRenderer 自定义 nodeOps，
 *    把 Lynx 原生元素（view / text / scroll-view …）创建为真实 DOM 元素，
 *    并把 Lynx 手势事件（@tap）映射为 DOM 事件（click）；
 * 3. **宿主全局**：注入 SystemInfo（屏幕尺寸），不注入 lynx 全局——
 *    让 getRect 走 common/util.ts 已有的 DOM 度量兜底路径。
 *
 * 该垫片只服务于文档预览，不进入组件库产物（CONVENTIONS.md §15 的
 * __web_preview 截图核对流程亦可复用本预览页）。
 */
import {
  createRenderer,
  type App,
  type Component,
  type RendererElement,
  type RendererNode
} from 'vue'

export * from 'vue'

// ---------------------------------------------------------------------------
// Lynx 手势事件 → DOM 事件映射
// ---------------------------------------------------------------------------
const EVENT_MAP: Record<string, string> = {
  tap: 'click',
  longpress: 'contextmenu'
}

/** 元素上挂载的事件监听表（key: DOM 事件名） */
const EVENT_STORE = '__wdH5Events'

type AnyEl = RendererElement & Record<string, any>

function addEventListener(el: AnyEl, event: string, handler: any) {
  const store: Record<string, any> = (el[EVENT_STORE] ||= {})
  if (store[event]) el.removeEventListener(event, store[event])
  // 编译器可能产出数组型多语句 handler；包装为单函数供 addEventListener 使用
  const fn = Array.isArray(handler)
    ? (e: Event) => {
        for (const hd of handler) typeof hd === 'function' && hd(e)
      }
    : handler
  if (typeof fn !== 'function') return
  store[event] = fn
  el.addEventListener(event, fn)
}

function removeEventListener(el: AnyEl, event: string) {
  const store: Record<string, any> = el[EVENT_STORE]
  if (store && store[event]) {
    el.removeEventListener(event, store[event])
    delete store[event]
  }
}

// ---------------------------------------------------------------------------
// normalizeClass —— vue-lynx 公开导出、vue 未公开导出，复刻最小实现
// （与 @vue/shared normalizeClass 语义一致）
// ---------------------------------------------------------------------------
export function normalizeClass(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map(normalizeClass)
      .filter(Boolean)
      .join(' ')
  }
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .filter((k) => (value as Record<string, unknown>)[k])
      .join(' ')
  }
  return String(value)
}

// ---------------------------------------------------------------------------
// patchProp —— class / style / 事件 / 其余属性四类处理
// ---------------------------------------------------------------------------
function patchProp(
  el: AnyEl,
  key: string,
  _prevValue: unknown,
  nextValue: unknown
) {
  // 事件：@tap → onTap → DOM click
  if (key.length > 2 && key.charCodeAt(0) === 111 /* o */ && key.charCodeAt(1) === 110 /* n */) {
    const raw = key.slice(2).toLowerCase()
    const event = EVENT_MAP[raw] || raw
    if (nextValue == null || nextValue === false) {
      removeEventListener(el, event)
    } else {
      addEventListener(el, event, nextValue)
    }
    return
  }

  if (key === 'class') {
    el.className = normalizeClass(nextValue)
    return
  }

  if (key === 'style') {
    if (!nextValue || typeof nextValue === 'string') {
      el.style.cssText = (nextValue as string) || ''
    } else {
      // 对象语法：先清空旧声明再整体下发，避免残留（Lynx SetStyle 为逐属性
      // 合并语义，但 DOM 上按 key 删除更符合直觉）
      el.removeAttribute('style')
      for (const [k, v] of Object.entries(nextValue as Record<string, unknown>)) {
        if (v != null && v !== false) el.style.setProperty(toKebab(k), String(v))
      }
    }
    return
  }

  if (nextValue == null || nextValue === false) {
    if (key in el) {
      try {
        ;(el as any)[key] = ''
      } catch {
        /* 只读属性忽略 */
      }
    }
    el.removeAttribute(key)
    return
  }

  // value / checked / disabled / id 等真实 DOM 属性优先走属性赋值，其余落 setAttribute
  if (key in el) {
    try {
      ;(el as any)[key] = nextValue === true ? '' : nextValue
      return
    } catch {
      /* 只读属性落到 setAttribute */
    }
  }
  el.setAttribute(key, nextValue === true ? '' : String(nextValue))
}

function toKebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

// ---------------------------------------------------------------------------
// nodeOps —— Lynx 原生元素即建即用（未知元素在 DOM 中合法）
// ---------------------------------------------------------------------------
const nodeOps: any = {
  createElement: (tag: string): RendererElement => document.createElement(tag),
  createText: (text: string): RendererNode => document.createTextNode(text),
  createComment: (text: string): RendererNode => document.createComment(text),
  setText: (node: RendererNode, text: string) => {
    ;(node as Text).data = text
  },
  setElementText: (el: RendererElement, text: string) => {
    ;(el as Element).textContent = text
  },
  insert: (child: RendererNode, parent: RendererElement, anchor?: RendererNode | null) => {
    ;(parent as Element).insertBefore(child as Node, (anchor as Node) || null)
  },
  remove: (child: RendererNode) => {
    const parent = (child as Node).parentNode
    if (parent) parent.removeChild(child as Node)
  },
  parentNode: (node: RendererNode): RendererElement | null => (node as Node).parentNode as any,
  nextSibling: (node: RendererNode): RendererNode | null => (node as Node).nextSibling as any,
  querySelector: (selector: string): RendererElement | null => document.querySelector(selector) as any,
  patchProp
}

// ---------------------------------------------------------------------------
// 宿主全局垫片
// ---------------------------------------------------------------------------
let installed = false

/**
 * 注入浏览器预览所需的 Lynx 宿主全局：
 * - SystemInfo：getSystemInfo() 的取值来源（common/util.ts），未注入时
 *   回退 375×812 —— 与预览手机框一致，这里显式声明以免歧义；
 * - 不注入 lynx 全局：使 getRect 走 common/util.ts 的 DOM 度量兜底
 *   （querySelector 真实元素），比零矩形兜底更能保持 slider / swipe-action
 *   等依赖度量的交互可用。
 */
export function installLynxGlobals(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  ;(globalThis as any).SystemInfo = {
    pixelRatio: 2,
    pixelWidth: 750,
    pixelHeight: 1624,
    platform: 'web',
    ...((globalThis as any).SystemInfo || {})
  }
}

// ---------------------------------------------------------------------------
// createApp —— 用自定义渲染器建树，供预览壳挂载真实组件
// ---------------------------------------------------------------------------
export function createLynxApp(rootComponent: Component, rootProps?: Record<string, unknown>): App {
  return createRenderer(nodeOps).createApp(rootComponent, rootProps)
}

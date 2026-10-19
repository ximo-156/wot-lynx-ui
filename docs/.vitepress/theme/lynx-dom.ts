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
// MTS 兼容导出（2026-10-19 原生优先重写后组件开始 import useMainThreadRef）
//
// Web 预览无主线程，useMainThreadRef 退化为「返回一个带 .current/.value 的
// 普通对象引用」：main-thread-bind* 事件在预览中不派发（无 worklet 运行时），
// 组件经此引用做的直改在预览中不可见——预览只做静态视觉核对，交互回归以
// 单测（mts-worklet-shim）与真机清单为准。
// ---------------------------------------------------------------------------
class PreviewMainThreadRef<T> {
  _value: T
  constructor(initValue: T) {
    this._value = initValue
  }
  get value(): T {
    return this._value
  }
  set value(_v: T) {
    // 只读（与真机 BG 侧语义一致）
  }
  get current(): T {
    return this._value
  }
  set current(v: T) {
    this._value = v
  }
  toJSON() {
    return { _wvid: 0, _initValue: this._value }
  }
}

export function useMainThreadRef<T>(initValue: T): any {
  return new PreviewMainThreadRef(initValue)
}

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
// 鼠标 → 触摸事件合成
//
// 组件库的滑动类交互（slide-verify / slider / signature / swipe-action /
// picker-view / floating-panel / index-bar / fab / img-cropper…）全部基于
// 原生 touch 事件。桌面浏览器里鼠标交互只派发 mouse 事件、不派发 touch
// 事件，这些组件在文档预览中会完全无法拖动。这里在捕获阶段把鼠标序列
// 翻译为等价的 Touch 事件派发到同一节点：
// - mousedown → touchstart，mousemove（按住）→ touchmove，
//   mouseup → touchend；touch 系列事件目标固定为 mousedown 所在节点
//   （与真机 touch 语义一致：touchmove/touchend 不因划出元素而改目标）；
// - 仅在目标节点或其祖先上注册过对应 touch 监听时才合成（EVENT_STORE），
//   不影响只绑 @tap 的元素与文档站自身的交互；
// - 合成拖拽期间对真实 mousemove preventDefault，避免划选文字/滚页面。
// ---------------------------------------------------------------------------
type SyntheticTouch = {
  identifier: number
  target: EventTarget | null
  clientX: number
  clientY: number
  pageX: number
  pageY: number
  screenX: number
  screenY: number
}

let activeTouch: { target: AnyEl; x: number; y: number } | null = null

function hasTouchListener(node: EventTarget | null, type: string): boolean {
  let el = node as AnyEl | null
  while (el && el.addEventListener) {
    const store: Record<string, any> = el[EVENT_STORE]
    if (store && store[type]) return true
    el = el.parentElement as AnyEl | null
  }
  return false
}

function makeTouchEvent(
  type: 'touchstart' | 'touchmove' | 'touchend',
  x: number,
  y: number,
  target: EventTarget | null
): Event {
  const init: any = { bubbles: true, cancelable: true }
  const touch: SyntheticTouch = {
    identifier: 1,
    target,
    clientX: x,
    clientY: y,
    pageX: x + (window.scrollX || 0),
    pageY: y + (window.scrollY || 0),
    screenX: x,
    screenY: y
  }
  if (typeof TouchEvent !== 'undefined' && typeof Touch !== 'undefined') {
    const t = new Touch({
      identifier: 1,
      target: target as Element,
      clientX: x,
      clientY: y,
      pageX: touch.pageX,
      pageY: touch.pageY,
      screenX: x,
      screenY: y
    })
    if (type === 'touchend') {
      init.touches = []
      init.targetTouches = []
    } else {
      init.touches = [t]
      init.targetTouches = [t]
    }
    init.changedTouches = [t]
    return new TouchEvent(type, init)
  }
  // 无 TouchEvent 构造器的环境：普通 Event + 手挂 touches/changedTouches
  // （useTouch 等消费方只读这两个字段）
  const ev = new Event(type, init) as any
  ev.touches = type === 'touchend' ? [] : [touch]
  ev.targetTouches = ev.touches
  ev.changedTouches = [touch]
  return ev
}

function installMouseToTouchBridge(): void {
  if (typeof window === 'undefined' || (window as any).__wdH5TouchBridge) return
  ;(window as any).__wdH5TouchBridge = true

  window.addEventListener(
    'mousedown',
    (e: MouseEvent) => {
      if (e.button !== 0) return
      if (!hasTouchListener(e.target, 'touchstart')) return
      activeTouch = { target: e.target as AnyEl, x: e.clientX, y: e.clientY }
      ;(e.target as AnyEl).dispatchEvent(makeTouchEvent('touchstart', e.clientX, e.clientY, e.target))
    },
    true
  )

  window.addEventListener(
    'mousemove',
    (e: MouseEvent) => {
      if (!activeTouch) return
      // 阻断默认划选/滚动，模拟真机 touchmove.preventDefault 语义
      e.preventDefault()
      activeTouch.x = e.clientX
      activeTouch.y = e.clientY
      activeTouch.target.dispatchEvent(makeTouchEvent('touchmove', e.clientX, e.clientY, activeTouch.target))
    },
    true
  )

  const finish = (e: MouseEvent) => {
    if (!activeTouch) return
    const { target } = activeTouch
    activeTouch = null
    target.dispatchEvent(makeTouchEvent('touchend', e.clientX, e.clientY, target))
  }
  window.addEventListener('mouseup', finish, true)
  // 拖出窗口释放：mouseup 可能不再派发到页面
  window.addEventListener('mouseleave', finish, true)
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
/**
 * 静态内容插入 —— 编译器会把无动态绑定的模板段提升为静态 vnode，挂载时
 * 经 nodeOps.insertStaticContent 一次性插入。用 <template> 解析 HTML 串，
 * 返回首尾节点供运行时打锚点。
 */
function insertStaticContent(
  content: string,
  parent: RendererElement,
  anchor?: RendererNode | null
): [RendererNode, RendererNode] {
  const tpl = document.createElement('template')
  tpl.innerHTML = content
  const nodes = Array.from(tpl.content.childNodes) as RendererNode[]
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  for (const node of nodes) {
    ;(parent as Element).insertBefore(node as Node, (anchor as Node) || null)
  }
  return [first, last]
}

const nodeOps: any = {
  insertStaticContent,
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
 * v-show-lynx 指令垫片。
 *
 * 组件库中 wd-transition 使用 `v-show-lynx`（vue-lynx 编译期的显隐指令，
 * 语义为 display:none 切换）。文档站用标准 vue 编译器编译组件源码，该
 * 指令无法解析（运行期 warn + 无效果），这里补一个等价的 DOM 实现。
 */
const vShowLynx = {
  beforeMount(el: Element, binding: { value: unknown }) {
    ;(el as HTMLElement).style.display = binding.value ? '' : 'none'
  },
  updated(el: Element, binding: { value: unknown }) {
    ;(el as HTMLElement).style.display = binding.value ? '' : 'none'
  }
}

/**
 * 注入浏览器预览所需的 Lynx 宿主全局：
 * - SystemInfo：getSystemInfo() 的取值来源（common/util.ts），未注入时
 *   回退 375×812 —— 与预览手机框一致，这里显式声明以免歧义；
 * - 不注入 lynx 全局：使 getRect 走 common/util.ts 的 DOM 度量兜底
 *   （querySelector 真实元素），比零矩形兜底更能保持 slider / swipe-action
 *   等依赖度量的交互可用；
 * - 鼠标 → touch 事件桥：桌面浏览器用鼠标也能驱动 slide-verify / slider /
 *   signature 等基于原生 touch 事件的交互组件。
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
  installMouseToTouchBridge()
}

// ---------------------------------------------------------------------------
// createApp —— 用自定义渲染器建树，供预览壳挂载真实组件
// ---------------------------------------------------------------------------
export function createLynxApp(rootComponent: Component, rootProps?: Record<string, unknown>): App {
  const app = createRenderer(nodeOps).createApp(rootComponent, rootProps)
  app.directive('show-lynx', vShowLynx as any)
  return app
}

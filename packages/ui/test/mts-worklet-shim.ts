/**
 * mts-worklet-shim — 测试环境的 Main Thread Script（MTS）模拟层。
 *
 * 背景：生产构建中 Rspeedy 的 SWC worklet 转换把 `'main thread'` 指令函数
 * 改写为可序列化的 worklet 上下文对象（随 SET_WORKLET_EVENT ops 下发主线程），
 * 主线程事件（main-thread-bind*）由引擎直接派发、零线程跨越——这是 Lynx 官方
 * 的「原生交互性能」路径。vitest 环境没有该转换，且 ops 经 JSON.stringify
 * 跨线程传输（函数载荷会变成 null），故本模块在测试侧补齐三块拼图：
 *
 * 1. **worklet 注册**：`registerMainThreadFn(fn)` 把函数存入全局注册表，
 *    返回 JSON 可序列化的上下文对象 `{ __wdWorklet: id }`（替代 SWC 产物）；
 * 2. **runWorklet**：安装到主线程全局——@lynx-js/testing-environment 的
 *    ElementPAPI 在派发 worklet 事件时会切换到主线程并调用它；
 * 3. **MainThread.Element 模拟**：`useMainThreadRef().current` 经
 *    lynxWorkletImpl._refImpl 解析（vue-lynx main-thread 运行时约定），
 *    返回包装 jsdom 元素的桩对象（setStyleProperty / invoke / getRect）；
 * 4. **事件 currentTarget 桥接**：真机 worklet 事件对象自带 currentTarget
 *    （事件绑定元素），jsdom 的对应访问器不被 Object.assign 复制，由
 *    fire-event 挂载 + runWorklet 还原补齐（见 WD_EVENT_TARGET_EL）。
 *
 * 约束（与真机一致的语义）：
 * - worklet 函数捕获的外层变量是渲染期快照，测试中直接透传（组件在测试里
 *   同步渲染，快照即最新值）；
 * - 主线程元素操作是同步的；
 * - 未提供 lynxWorkletImpl 时（旧测试环境）退化为 no-op，不影响既有用例。
 */

interface WorkletElement {
  setStyleProperty(key: string, value: string): void
  getAttribute(name: string): string | null
  invoke(method: string, params?: any): Promise<any>
  __el: any
}

const registry = new Map<number, Function>()
let nextId = 1

/** 注册主线程函数，返回 JSON 可序列化的 worklet 上下文 */
export function registerMainThreadFn(fn: Function): { __wdWorklet: number } {
  const id = nextId++
  registry.set(id, fn)
  return { __wdWorklet: id }
}

/** 主线程派发入口（由 ElementPAPI 的 worklet 监听器调用） */
export function runWorklet(ctx: any, args: any[]): any {
  const fn = ctx && typeof ctx === 'object' ? registry.get(ctx.__wdWorklet) : undefined
  if (typeof fn !== 'function') return undefined
  // 真机语义补齐：worklet 事件对象的 currentTarget/target 指向事件绑定元素。
  // ElementPAPI 以 Object.assign({}, evt) 传事件（原型访问器不复制），此处
  // 把 fire-event 挂上的绑定元素还原为 currentTarget（与真机 Lynx 事件一致），
  // 使「主线程 worklet 经 currentTarget 寻址被操作元素」的写法可被单测覆盖
  // （如 wd-picker-view 的逐列跟手、wd-slider 范围模式的拖动对象判定）。
  const evt = args[0]
  if (evt && typeof evt === 'object' && evt[WD_EVENT_TARGET_EL]) {
    const el = evt[WD_EVENT_TARGET_EL]
    delete evt[WD_EVENT_TARGET_EL]
    if (evt.currentTarget === undefined) {
      evt.currentTarget = makeWorkletElement(el)
    }
    if (evt.target === undefined) {
      evt.target = makeWorkletElement(el)
    }
  }
  return fn(...args)
}

/**
 * 事件对象 → 绑定元素（currentTarget）的桥接键。
 *
 * 真机上 Lynx 主线程事件对象自带 `currentTarget`（事件绑定元素，
 * 见 @lynx-js/types 的 LynxCrossThreadEvent）；jsdom 的 target/currentTarget
 * 是 Event.prototype 上的访问器，ElementPAPI 派发 worklet 时的
 * `Object.assign({}, evt)` 只复制自有可枚举属性，拿不到它们。fire-event.ts
 * 在派发前把元素挂到该 Symbol 自有属性上（Object.assign 会复制 Symbol 键），
 * 本模块的 runWorklet 再将其还原为 worklet 事件上的 currentTarget。
 */
export const WD_EVENT_TARGET_EL = Symbol('wdEventTargetEl')

/** 元素 → 主线程元素桩（每元素单例，保证引用 identity 与 refMap 一致） */
const elementWrapperCache = new WeakMap<any, WorkletElement>()

function makeWorkletElement(el: any): WorkletElement {
  let wrapper = elementWrapperCache.get(el)
  if (!wrapper) {
    wrapper = {
      __el: el,
      setStyleProperty(key: string, value: string) {
        if (el && el.style) el.style[key] = value
      },
      getAttribute(name: string): string | null {
        // 元素属性桥接：后台经 Vue 属性绑定下发的实时值（如 slider 的
        // left-bound / right-bound）供 worklet 读取
        return el && typeof el.getAttribute === 'function' ? el.getAttribute(name) : null
      },
      invoke(method: string, _params?: any): Promise<any> {
        // 主线程元素 UI 方法：boundingClientRect 返回矩形 Promise。
        // 测试可经 globalThis.__wdRectStub(el) 注入几何（与后台
        // createSelectorQuery stub 对齐）；默认零矩形。
        if (method === 'boundingClientRect') {
          const stub = (globalThis as any).__wdRectStub
          const rect =
            typeof stub === 'function'
              ? stub(el)
              : { id: '', left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
          return Promise.resolve(rect)
        }
        // scrollIntoView 等方法在测试环境为 no-op
        return Promise.resolve(undefined)
      }
    }
    elementWrapperCache.set(el, wrapper)
  }
  return wrapper
}

/**
 * 补丁 MainThreadRef.prototype.current：worklet 内读取 .current 时经
 * lynxWorkletImpl._refImpl._workletRefMap 取主线程元素桩。
 *
 * 生产环境中 SWC worklet 转换会把 worklet 内的 `ref.current` 改写为直读
 * refMap；测试环境没有该转换，worklet 以原始闭包执行，故在此补一层等价桥接。
 */
export function patchMainThreadRefCurrent(): void {
  try {
    const probe = (globalThis as any).__wdUseMainThreadRefProbe
    if (!probe) return
    const proto = Object.getPrototypeOf(probe)
    if (!proto || proto.__wdPatched) return
    Object.defineProperty(proto, 'current', {
      configurable: true,
      get() {
        const refMap = (globalThis as any).lynxWorkletImpl?._refImpl?._workletRefMap || {}
        const entry = refMap[this._wvid]
        return entry ? entry.current : this._ref ? this._ref.value : undefined
      },
      set(v) {
        // 主线程写入：更新 refMap（与真机 worklet 内 .current = x 语义一致；
        // 后台线程的写入在真机被拒绝，此处由 worklet 模拟层放行）
        const refMap = (globalThis as any).lynxWorkletImpl?._refImpl?._workletRefMap
        if (!refMap) return
        const entry = refMap[this._wvid] || (refMap[this._wvid] = { current: null, _wvid: this._wvid })
        entry.current = v
      }
    })
    proto.__wdPatched = true
  } catch {
    // 原型不可扩展时静默跳过（不影响非 MTS 用例）
  }
}

/**
 * 安装到主线程全局：runWorklet + lynxWorkletImpl._refImpl。
 *
 * 注意 runWorklet 必须同时挂到**共享 globalThis**：@lynx-js/testing-environment
 * 的 ElementPAPI 以自由变量引用它（模块作用域链直达 worker 全局），只挂线程
 * 副本（switchToMainThread 才拷贝过来）在事件派发时序里不可靠。
 */
export function installWorkletGlobals(mainThreadGlobal: any): void {
  mainThreadGlobal.runWorklet = runWorklet
  ;(globalThis as any).runWorklet = runWorklet
  patchMainThreadRefCurrent()

  // vue-lynx 的 applySetMtRef 经 lynxWorkletImpl._refImpl 更新 worklet ref；
  // updateWorkletRef(refImpl, el) 时把 current 指向元素桩。
  const refMap: Record<number, any> = {}
  const lynxWorkletImpl = {
    _refImpl: {
      _workletRefMap: refMap,
      updateWorkletRef(refImpl: any, el: any) {
        if (!refImpl || refImpl._wvid == null) return
        const entry = refMap[refImpl._wvid] || (refMap[refImpl._wvid] = { current: null, _wvid: refImpl._wvid })
        entry.current = makeWorkletElement(el)
      }
    }
  }
  mainThreadGlobal.lynxWorkletImpl = lynxWorkletImpl
}

// 这里曾有 resetWorkletRegistry()，从未被调用，已删除：registry 由
// mtsWorkletPlugin 在 SFC 模块求值时填充（不是按用例），清空会让同 worker
// 内后续文件的 worklet 上下文全部失效。需要看注册表内容请直接读 registry。

/**
 * Vitest setup — 搭建 Vue Lynx 双线程测试环境。
 *
 * 参考 @vue-lynx/testing-library 的实现：
 * - Main Thread: renderPage / vuePatchUpdate（PAPI ops 执行器）
 * - Background Thread: publishEvent / callLepusMethod
 */
import { JSDOM } from 'jsdom'
import { LynxTestingEnv } from '@lynx-js/testing-environment'
import { installWorkletGlobals, resetWorkletRegistry } from './mts-worklet-shim'

// url 必须给 http(s) origin：about:blank 是不透明 origin，jsdom 的
// localStorage getter 会抛 SecurityError；断言失败时 vitest 序列化 DOM
// 元素会走到 window，把真正的断言信息掩盖成 "localStorage is not
// available for opaque origins"。
const jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' })
const lynxTestingEnv = new LynxTestingEnv(jsdom)

;(globalThis as any).lynxTestingEnv = lynxTestingEnv

lynxTestingEnv.switchToMainThread()

if (typeof (globalThis as any).registerWorkletInternal === 'undefined') {
  ;(globalThis as any).registerWorkletInternal = () => {}
}

await import('vue-lynx/main-thread')

const mainThreadFns = {
  renderPage: (globalThis as any).renderPage,
  vuePatchUpdate: (globalThis as any).vuePatchUpdate,
  processData: (globalThis as any).processData,
  updatePage: (globalThis as any).updatePage,
  updateGlobalProps: (globalThis as any).updateGlobalProps
}

const mtGlobal = lynxTestingEnv.mainThread.globalThis as any
Object.assign(mtGlobal, mainThreadFns)

// 测试宿主 0.1.11 用 Object.assign(e.style, styles)，CSSOM 不序列化 --* 键。
// 真实 Web 使用 WASM set_inline_styles_in_key_value_vec，原生同样支持自定义变量。
// 只补齐自定义属性写入/删除；普通样式仍走原测试 API，不模拟 CSS 变量求值。
const setInlineStyles = mtGlobal.__SetInlineStyles
mtGlobal.__SetInlineStyles = (element: HTMLElement, styles: unknown) => {
  setInlineStyles(element, styles)
  if (styles && typeof styles === 'object') {
    for (const [key, value] of Object.entries(styles)) {
      if (!key.startsWith('--')) continue
      if (value === '' || value == null) element.style.removeProperty(key)
      else element.style.setProperty(key, String(value))
    }
  }
}
;(globalThis as any).__SetInlineStyles = mtGlobal.__SetInlineStyles

// Main Thread Script 模拟层：worklet 派发 + 主线程元素桩（见 mts-worklet-shim.ts）
installWorkletGlobals(mtGlobal)

lynxTestingEnv.switchToBackgroundThread()

await import('vue-lynx/entry-background')

// MTS 探针：供 mts-worklet-shim 补丁 MainThreadRef.prototype.current
;(globalThis as any).__wdUseMainThreadRefProbe = (await import('vue-lynx')).useMainThreadRef(null)
// 探针就绪后再桥接 .current（installWorkletGlobals 时探针尚未就位）
const { patchMainThreadRefCurrent } = await import('./mts-worklet-shim')
patchMainThreadRefCurrent()

const publishEventFn = (globalThis as any).publishEvent

const bgGlobal = lynxTestingEnv.backgroundThread.globalThis as any
bgGlobal.publishEvent = publishEventFn

;(globalThis as any).onSwitchedToMainThread = () => {
  Object.assign(globalThis, mainThreadFns)
}

;(globalThis as any).onSwitchedToBackgroundThread = () => {
  if ((globalThis as any).lynxCoreInject?.tt) {
    ;(globalThis as any).lynxCoreInject.tt.publishEvent = publishEventFn
  }
  ;(globalThis as any).publishEvent = publishEventFn
}

// ---------------------------------------------------------------------------
// SelectorQuery mock
//
// @lynx-js/testing-environment 的 NodesRef.invoke 未实现（同步抛
// "not implemented"）。这里安装一个可链式调用的 mock，使依赖 getRect
// 的组件（slider 轨道测量、swipe-action 按钮宽度等）的 invoke 成功回调
// 路径在测试中真实走通，而不是走到 getRect 的兜底分支。
// ---------------------------------------------------------------------------
const installSelectorQueryMock = () => {
  const lynx = (globalThis as any).lynx
  if (!lynx || typeof lynx.createSelectorQuery !== 'function') return

  const rect = { id: '', left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
  const makeNodesRef = () => ({
    invoke(options: any) {
      if (options && typeof options.success === 'function') {
        setTimeout(() => options.success(rect), 0)
      }
      return { exec: () => {} }
    },
    boundingClientRect(cb: any) {
      if (typeof cb === 'function') setTimeout(() => cb(rect), 0)
      return { exec: () => {} }
    },
    fields(_: any, cb: any) {
      if (typeof cb === 'function') setTimeout(() => cb({ width: 0, height: 0 }), 0)
      return { exec: () => {} }
    }
  })
  const makeQuery = () => {
    const ref = makeNodesRef()
    return {
      select: () => ref,
      selectAll: () => ref,
      in: () => makeQuery(),
      exec: () => {}
    }
  }
  lynx.createSelectorQuery = () => makeQuery()
}

installSelectorQueryMock()

// ---------------------------------------------------------------------------
// 预期降级告警的静默
//
// getRect 在宿主未提供 createSelectorQuery（或查询失败 / 无匹配节点）时会
// console.warn 一次「节点度量不可用」。多个回归用例（wd-tabs / wd-collapse-item /
// util / wd-slider）会主动删除 createSelectorQuery 来复现该真机降级路径，
// 此时告警属于**预期输出**：继续打印只会刷屏、掩盖真正的失败信息。
//
// 这里统一静默并记录到 globalThis.__metricDegradation——需要锁定该降级的
// 用例可读取它做断言（降级发生了），而不是让它污染所有用例的输出。
// ---------------------------------------------------------------------------
const METRIC_DEGRADATION_MARKER = '节点度量不可用'
const metricDegradation: string[] = []
;(globalThis as any).__metricDegradation = metricDegradation

const originalWarn = console.warn
console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes(METRIC_DEGRADATION_MARKER)) {
    metricDegradation.push(args[0])
    return
  }
  originalWarn(...args)
}

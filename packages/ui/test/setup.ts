/**
 * Vitest setup — 搭建 Vue Lynx 双线程测试环境。
 *
 * 参考 @vue-lynx/testing-library 的实现：
 * - Main Thread: renderPage / vuePatchUpdate（PAPI ops 执行器）
 * - Background Thread: publishEvent / callLepusMethod
 */
import { JSDOM } from 'jsdom'
import { LynxTestingEnv } from '@lynx-js/testing-environment'

const jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
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

lynxTestingEnv.switchToBackgroundThread()

await import('vue-lynx/entry-background')

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

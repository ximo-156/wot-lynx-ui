import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

/**
 * SDK 作用域回归：执行实际 native.ts，而不是复制 getLynxRuntime 的实现。
 *
 * 生产 Web / 原生 bundle 把 SDK 作为模块参数 lynx 注入，后台 globalThis.lynx
 * 可能不存在（或指向错误的对象）。普通 import 会被测试宿主的全局 SDK 掩盖，
 * 因而这里将完整源码转成 CommonJS，在独立 VM 中用词法参数模拟生产包装。
 * 每个用例有独立全局和可控时钟，不改测试宿主的 lynx / timers，也不模拟签名绘制。
 */
type NativeModule = typeof import('@wot-lynx/core/common/native')
type RuntimeScope = { lexical?: unknown; global?: unknown }
type InvokeOptions = {
  method: string
  params?: Record<string, unknown>
  success: (result: unknown) => void
  fail: (result: unknown) => void
}

const sourcePath = resolve(__dirname, '../../../core/src/common/native.ts')
const nativeJavaScript = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
  fileName: sourcePath,
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText

function loadNative(scope: RuntimeScope = {}) {
  const exports: Record<string, unknown> = {}
  const timers = {
    setTimeout: vi.fn((_callback: () => void, _delay: number) => 9001),
    clearTimeout: vi.fn((_handle: number) => {}),
    now: vi.fn(() => 123456)
  }
  const globals: Record<string, unknown> = {
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    Date: { now: timers.now }
  }
  const own = (key: keyof RuntimeScope) => Object.prototype.hasOwnProperty.call(scope, key)
  if (own('global')) globals.lynx = scope.global

  // 未注入参数与显式注入 undefined 都要覆盖；前者才能验证未绑定词法名的 typeof 安全性。
  const parameters = own('lexical') ? 'exports, lynx' : 'exports'
  const factory = runInNewContext(`(function (${parameters}) {\n${nativeJavaScript}\n})`, globals, {
    filename: sourcePath,
    timeout: 1000
  }) as (exports: Record<string, unknown>, lynx?: unknown) => void
  factory(exports, scope.lexical)
  return { native: exports as NativeModule, globals, timers }
}

function makeQuery() {
  const exec = vi.fn()
  const invocation = { exec }
  const invoke = vi.fn((_options: InvokeOptions) => invocation)
  const nodesRef = { invoke }
  const select = vi.fn((_selector: string) => nodesRef)
  const query = { select }
  return { query, nodesRef, invocation, select, invoke, exec }
}

const missingScopes: Array<{ name: string; scope: RuntimeScope }> = [
  { name: '没有 lynx 参数', scope: {} },
  { name: 'lynx 参数为 undefined', scope: { lexical: undefined } }
]

describe('native.ts：Lynx SDK 词法注入作用域', () => {
  it('globalThis.lynx 缺失时，模块参数 SDK 仍可发起 getRect 并收到非零节点度量', () => {
    const channel = makeQuery()
    const sdk = { createSelectorQuery: vi.fn(() => channel.query) }
    const { native, globals } = loadNative({ lexical: sdk })
    const success = vi.fn()
    const rect = { left: 80, top: 420, right: 380, bottom: 620, width: 300, height: 200 }

    expect(Object.prototype.hasOwnProperty.call(globals, 'lynx')).toBe(false)
    expect(native.getLynxRuntime()).toBe(sdk)
    expect(native.invokeNative('#signature-svg', 'getRect', undefined, { success })).toBe(true)
    expect(channel.select).toHaveBeenCalledWith('#signature-svg')
    expect(channel.exec).toHaveBeenCalledOnce()
    expect(success).not.toHaveBeenCalled()
    const options = channel.invoke.mock.calls[0][0]
    expect(options.method).toBe('getRect')
    options.success(rect)
    expect(success).toHaveBeenCalledWith(rect)
  })

  it('词法 SDK 优先于错误的 globalThis.lynx 对象', () => {
    const query = { source: 'lexical SDK' }
    const sdk = { createSelectorQuery: vi.fn(() => query) }
    const wrongGlobal = { createSelectorQuery: vi.fn(() => ({ source: 'wrong global' })) }
    const { native, globals } = loadNative({ lexical: sdk, global: wrongGlobal })

    expect(globals.lynx).toBe(wrongGlobal)
    expect(native.getLynxRuntime()).toBe(sdk)
    expect(native.createSelectorQuery()).toBe(query)
    expect(sdk.createSelectorQuery).toHaveBeenCalledOnce()
    expect(wrongGlobal.createSelectorQuery).not.toHaveBeenCalled()
  })

  it('存在词法 SDK 时，不读取可能抛错的全局 SDK 属性', () => {
    const sdk = {}
    const { native, globals } = loadNative({ lexical: sdk })
    const readGlobal = vi.fn(() => { throw new Error('background global is unavailable') })
    Object.defineProperty(globals, 'lynx', { get: readGlobal })

    expect(native.getLynxRuntime()).toBe(sdk)
    expect(readGlobal).not.toHaveBeenCalled()
  })

  it.each(missingScopes)('只有全局 SDK 的测试宿主仍可工作：$name', ({ scope }) => {
    const query = {}
    const sdk = { createSelectorQuery: vi.fn(() => query) }
    const { native } = loadNative({ ...scope, global: sdk })

    expect(native.getLynxRuntime()).toBe(sdk)
    expect(native.createSelectorQuery()).toBe(query)
    expect(sdk.createSelectorQuery.mock.contexts[0]).toBe(sdk)
  })

  it.each(missingScopes)('SDK 完全缺失时安全降级而不抛 ReferenceError：$name', ({ scope }) => {
    const { native, timers } = loadNative(scope)
    const callback = vi.fn((_time: number) => {})

    expect(native.getLynxRuntime()).toBeUndefined()
    expect(native.createSelectorQuery()).toBeUndefined()
    expect(native.createIntersectionObserver()).toBeUndefined()
    expect(native.getJSModule('MissingModule')).toBeUndefined()
    expect(native.invokeNative('#missing', 'getRect')).toBe(false)

    const handle = native.requestNativeFrame(callback)
    expect(handle).toBe(9001)
    expect(timers.setTimeout).toHaveBeenCalledOnce()
    expect(timers.setTimeout.mock.calls[0][1]).toBeCloseTo(1000 / 60)
    expect(callback).not.toHaveBeenCalled()
    timers.setTimeout.mock.calls[0][0]()
    expect(callback).toHaveBeenCalledWith(123456)
    native.cancelNativeFrame(handle)
    expect(timers.clearTimeout).toHaveBeenCalledWith(handle)
  })

  it.each([null, 0, 'not an SDK', true, () => {}])('非对象 SDK %s 不被当作运行时', (lexical) => {
    const { native } = loadNative({ lexical })
    expect(native.getLynxRuntime()).toBeUndefined()
    expect(native.createSelectorQuery()).toBeUndefined()
    expect(native.invokeNative('#missing', 'focus')).toBe(false)
  })

  it('createSelectorQuery 保留 SDK 的 this，而不是脱离对象调用工厂', () => {
    const query = {}
    const sdk = {
      query,
      createSelectorQuery: vi.fn(function (this: { query: object }) { return this.query })
    }
    const { native } = loadNative({ lexical: sdk })

    expect(native.createSelectorQuery()).toBe(query)
    expect(sdk.createSelectorQuery.mock.contexts[0]).toBe(sdk)
  })

  it.each([undefined, null, false, 'not a function', {}])('SelectorQuery 工厂不可用（%s）时返回 undefined', (createSelectorQuery) => {
    const { native } = loadNative({ lexical: { createSelectorQuery } })
    expect(native.createSelectorQuery()).toBeUndefined()
    expect(native.invokeNative('#missing', 'getRect')).toBe(false)
  })

  it('SelectorQuery 工厂抛错时安全降级，不误用另一个全局 SDK', () => {
    const sdk = { createSelectorQuery: vi.fn(() => { throw new Error('native bridge detached') }) }
    const wrongGlobal = { createSelectorQuery: vi.fn(() => ({})) }
    const { native } = loadNative({ lexical: sdk, global: wrongGlobal })

    expect(native.createSelectorQuery()).toBeUndefined()
    expect(native.invokeNative('#missing', 'getRect')).toBe(false)
    expect(wrongGlobal.createSelectorQuery).not.toHaveBeenCalled()
  })

  it.each(['success', 'fail'] as const)('invokeNative 通过注入 SDK 保留调用链、params 和 %s 回调', (outcome) => {
    const channel = makeQuery()
    const sdk = { createSelectorQuery: vi.fn(() => channel.query) }
    const { native } = loadNative({ lexical: sdk })
    const params = { value: '签名', animated: false }
    const callbacks = { success: vi.fn(), fail: vi.fn() }
    const result = outcome === 'success' ? { value: '签名' } : { code: 1, data: 'node is not ready' }

    expect(native.invokeNative('#native-input', 'setValue', params, callbacks)).toBe(true)
    expect(channel.select).toHaveBeenCalledWith('#native-input')
    expect(channel.select.mock.contexts[0]).toBe(channel.query)
    expect(channel.invoke.mock.contexts[0]).toBe(channel.nodesRef)
    expect(channel.exec.mock.contexts[0]).toBe(channel.invocation)
    expect(channel.exec).toHaveBeenCalledOnce()
    const options = channel.invoke.mock.calls[0][0]
    expect(options.method).toBe('setValue')
    expect(options.params).toBe(params)
    expect(options.success).toBeTypeOf('function')
    expect(options.fail).toBeTypeOf('function')
    expect(callbacks.success).not.toHaveBeenCalled()
    expect(callbacks.fail).not.toHaveBeenCalled()

    // 原生回调在 exec 发起后独立到达；返回 true 只表示成功发起，不表示原生成功。
    options[outcome](result)
    expect(callbacks[outcome]).toHaveBeenCalledWith(result)
    expect(callbacks[outcome === 'success' ? 'fail' : 'success']).not.toHaveBeenCalled()
  })

  it('invokeNative 未传 params/回调时省略 params，但仍提供安全 success/fail（避免宿主红屏）', () => {
    const channel = makeQuery()
    const { native } = loadNative({ lexical: { createSelectorQuery: () => channel.query } })

    expect(native.invokeNative('#native-input', 'focus')).toBe(true)
    const options = channel.invoke.mock.calls[0][0]
    expect(options).not.toHaveProperty('params')
    expect(options.method).toBe('focus')
    expect(options.success).toBeTypeOf('function')
    expect(options.fail).toBeTypeOf('function')
    expect(() => options.success({})).not.toThrow()
    expect(() => options.fail({ code: 1 })).not.toThrow()
    expect(channel.exec).toHaveBeenCalledOnce()
  })

  const brokenQueries: Array<{ name: string; query: unknown }> = [
    { name: 'query 缺失', query: undefined },
    { name: 'select 缺失', query: {} },
    { name: 'select 不是函数', query: { select: true } },
    { name: 'select 没有节点', query: { select: () => undefined } },
    { name: 'invoke 缺失', query: { select: () => ({}) } },
    { name: 'select 抛错', query: { select: () => { throw new Error('select failed') } } },
    { name: 'invoke 抛错', query: { select: () => ({ invoke: () => { throw new Error('invoke failed') } }) } },
    { name: 'exec 缺失', query: { select: () => ({ invoke: () => ({}) }) } },
    { name: 'exec 抛错', query: { select: () => ({ invoke: () => ({ exec: () => { throw new Error('exec failed') } }) }) } }
  ]
  it.each(brokenQueries)('invokeNative 对异常或不完整的原生通道返回 false：$name', ({ query }) => {
    const { native } = loadNative({ lexical: { createSelectorQuery: () => query } })
    expect(native.invokeNative('#native-input', 'focus')).toBe(false)
  })

  it('IntersectionObserver / JS Module 同样来自词法 SDK，并保留 this 与调用参数', () => {
    const observer = {}
    const jsModule = { emit: vi.fn() }
    const sdk = {
      createIntersectionObserver: vi.fn((_component: unknown, _options: unknown) => observer),
      getJSModule: vi.fn((_name: string) => jsModule)
    }
    const wrongGlobal = { createIntersectionObserver: vi.fn(), getJSModule: vi.fn() }
    const { native } = loadNative({ lexical: sdk, global: wrongGlobal })

    expect(native.createIntersectionObserver()).toBe(observer)
    expect(sdk.createIntersectionObserver).toHaveBeenCalledWith(undefined, { thresholds: [0] })
    const thresholds = [0, 0.5, 1]
    expect(native.createIntersectionObserver(thresholds)).toBe(observer)
    expect(sdk.createIntersectionObserver).toHaveBeenLastCalledWith(undefined, { thresholds })
    expect(sdk.createIntersectionObserver.mock.contexts[0]).toBe(sdk)
    expect(native.getJSModule('HostEvents')).toBe(jsModule)
    expect(sdk.getJSModule).toHaveBeenCalledWith('HostEvents')
    expect(sdk.getJSModule.mock.contexts[0]).toBe(sdk)
    expect(wrongGlobal.createIntersectionObserver).not.toHaveBeenCalled()
    expect(wrongGlobal.getJSModule).not.toHaveBeenCalled()
  })

  it('IntersectionObserver / JS Module 能力抛错时返回 undefined', () => {
    const { native } = loadNative({
      lexical: {
        createIntersectionObserver: () => { throw new Error('observer unavailable') },
        getJSModule: () => { throw new Error('module unavailable') }
      }
    })
    expect(native.createIntersectionObserver()).toBeUndefined()
    expect(native.getJSModule('HostEvents')).toBeUndefined()
  })

  it.each([0, 42])('帧请求/取消使用词法 SDK、保留 this 和句柄 %i，不误走全局或 timer', (expectedHandle) => {
    const sdk = {
      requestAnimationFrame: vi.fn((_callback: (time: number) => void) => expectedHandle),
      cancelAnimationFrame: vi.fn((_handle: number) => {})
    }
    const wrongGlobal = { requestAnimationFrame: vi.fn(() => 99), cancelAnimationFrame: vi.fn() }
    const { native, timers } = loadNative({ lexical: sdk, global: wrongGlobal })
    const callback = vi.fn((_time: number) => {})

    const handle = native.requestNativeFrame(callback)
    expect(handle).toBe(expectedHandle)
    expect(sdk.requestAnimationFrame).toHaveBeenCalledWith(callback)
    expect(sdk.requestAnimationFrame.mock.contexts[0]).toBe(sdk)
    expect(callback).not.toHaveBeenCalled()
    sdk.requestAnimationFrame.mock.calls[0][0](876.5)
    expect(callback).toHaveBeenCalledWith(876.5)
    native.cancelNativeFrame(handle)
    expect(sdk.cancelAnimationFrame).toHaveBeenCalledWith(expectedHandle)
    expect(sdk.cancelAnimationFrame.mock.contexts[0]).toBe(sdk)
    expect(wrongGlobal.requestAnimationFrame).not.toHaveBeenCalled()
    expect(wrongGlobal.cancelAnimationFrame).not.toHaveBeenCalled()
    expect(timers.setTimeout).not.toHaveBeenCalled()
    expect(timers.clearTimeout).not.toHaveBeenCalled()
  })

  it('仅有全局帧 SDK 时也转发 request/cancel，不使用 timeout fallback', () => {
    const sdk = {
      requestAnimationFrame: vi.fn((_callback: (time: number) => void) => 7),
      cancelAnimationFrame: vi.fn((_handle: number) => {})
    }
    const { native, timers } = loadNative({ lexical: undefined, global: sdk })
    const callback = vi.fn((_time: number) => {})

    const handle = native.requestNativeFrame(callback)
    native.cancelNativeFrame(handle)
    expect(handle).toBe(7)
    expect(sdk.requestAnimationFrame).toHaveBeenCalledWith(callback)
    expect(sdk.requestAnimationFrame.mock.contexts[0]).toBe(sdk)
    expect(sdk.cancelAnimationFrame).toHaveBeenCalledWith(handle)
    expect(sdk.cancelAnimationFrame.mock.contexts[0]).toBe(sdk)
    expect(timers.setTimeout).not.toHaveBeenCalled()
    expect(timers.clearTimeout).not.toHaveBeenCalled()
  })

  it('SDK 存在但帧能力不是函数时，仍安全退回 timeout / clearTimeout', () => {
    const { native, timers } = loadNative({ lexical: { requestAnimationFrame: true, cancelAnimationFrame: null } })
    const callback = vi.fn((_time: number) => {})
    const handle = native.requestNativeFrame(callback)
    native.cancelNativeFrame(handle)

    expect(handle).toBe(9001)
    expect(timers.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000 / 60)
    expect(timers.clearTimeout).toHaveBeenCalledWith(handle)
  })
})

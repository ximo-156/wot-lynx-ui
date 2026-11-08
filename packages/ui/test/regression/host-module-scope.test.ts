import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

/**
 * Execute both real modules with the Lynx bundle's module-local SDK objects.
 * A ordinary import sees the test runner's globals and would mask this bug.
 * No production function is copied, and no shared test SDK or timer is changed.
 */
type NativeApi = typeof import('../../src/common/native')
type HostApi = typeof import('../../src/common/host')
type Scope = {
  lexicalModules?: unknown
  globalModules?: unknown
  lexicalLynx?: unknown
  globalLynx?: unknown
}
const sourceDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/common')
function compile(name: string) {
  const path = resolve(sourceDir, `${name}.ts`)
  return ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
  }).outputText
}
const nativeCode = compile('native')
const hostCode = compile('host')
const own = (scope: Scope, key: keyof Scope) => Object.prototype.hasOwnProperty.call(scope, key)

function loadHost(scope: Scope = {}) {
  const warn = vi.fn()
  const globals: Record<string, unknown> = { console: { warn } }
  if (own(scope, 'globalModules')) globals.NativeModules = scope.globalModules
  if (own(scope, 'globalLynx')) globals.lynx = scope.globalLynx
  const nativeExports: Record<string, unknown> = {}
  const parameters = ['exports']
  const args: unknown[] = [nativeExports]
  if (own(scope, 'lexicalModules')) { parameters.push('NativeModules'); args.push(scope.lexicalModules) }
  if (own(scope, 'lexicalLynx')) { parameters.push('lynx'); args.push(scope.lexicalLynx) }
  const nativeFactory = runInNewContext(`(function (${parameters.join(', ')}) {\n${nativeCode}\n})`, globals, {
    filename: resolve(sourceDir, 'native.ts'), timeout: 1000
  }) as (...args: unknown[]) => void
  nativeFactory(...args)
  const hostExports: Record<string, unknown> = {}
  const requireNative = vi.fn((specifier: string) => {
    if (specifier !== './native') throw new Error(`Unexpected import: ${specifier}`)
    return nativeExports
  })
  const hostFactory = runInNewContext(`(function (exports, require) {\n${hostCode}\n})`, globals, {
    filename: resolve(sourceDir, 'host.ts'), timeout: 1000
  }) as (exports: Record<string, unknown>, require: typeof requireNative) => void
  hostFactory(hostExports, requireNative)
  return { host: hostExports as HostApi, native: nativeExports as NativeApi, globals, warn, requireNative }
}

function mediaHost() { return { chooseMedia: vi.fn((_options: unknown) => {}) } }

describe('host/native module injection scope', () => {
  it('finds WotLynxUI in lexical NativeModules with no global registry', () => {
    const module = mediaHost()
    const { host, native, globals, requireNative } = loadHost({ lexicalModules: { WotLynxUI: module } })
    expect(Object.prototype.hasOwnProperty.call(globals, 'NativeModules')).toBe(false)
    expect(native.getNativeModule('WotLynxUI')).toBe(module)
    expect(host.getHost()).toBe(module)
    expect(host.hasHostCapability('chooseMedia')).toBe(true)
    const options = { count: 1, mediaType: ['image'] }
    expect(host.callHost('chooseMedia', options).called).toBe(true)
    expect(module.chooseMedia).toHaveBeenCalledWith(options)
    expect(module.chooseMedia.mock.contexts[0]).toBe(module)
    expect(requireNative).toHaveBeenCalledWith('./native')
  })

  it('prefers lexical NativeModules over the wrong global module object', () => {
    const selected = mediaHost(), wrong = mediaHost()
    const { host } = loadHost({ lexicalModules: { WotLynxUI: selected }, globalModules: { WotLynxUI: wrong } })
    expect(host.getHost()).toBe(selected)
    host.callHost('chooseMedia', {})
    expect(selected.chooseMedia).toHaveBeenCalledOnce()
    expect(wrong.chooseMedia).not.toHaveBeenCalled()
  })

  it('uses a lexical Lynx JSModule SDK even when globalThis.lynx is missing', () => {
    const module = mediaHost()
    const sdk = { getJSModule: vi.fn((_name: string) => module) }
    const { host, globals } = loadHost({ lexicalLynx: sdk })
    expect(Object.prototype.hasOwnProperty.call(globals, 'lynx')).toBe(false)
    expect(host.getHost()).toBe(module)
    expect(sdk.getJSModule).toHaveBeenCalledWith('WotLynxUI')
    expect(sdk.getJSModule.mock.contexts[0]).toBe(sdk)
  })

  it('uses the lexical JSModule SDK rather than a wrong global SDK', () => {
    const module = mediaHost()
    const localSdk = { getJSModule: vi.fn((_name: string) => module) }
    const globalSdk = { getJSModule: vi.fn((_name: string) => mediaHost()) }
    const { host } = loadHost({ lexicalLynx: localSdk, globalLynx: globalSdk })
    expect(host.getHost()).toBe(module)
    expect(localSdk.getJSModule).toHaveBeenCalledOnce()
    expect(globalSdk.getJSModule).not.toHaveBeenCalled()
  })

  it('explicit configureHost takes priority without probing either SDK', () => {
    const module = mediaHost(), explicit = mediaHost()
    const sdk = { getJSModule: vi.fn((_name: string) => mediaHost()) }
    const { host } = loadHost({ lexicalModules: { WotLynxUI: module }, lexicalLynx: sdk })
    host.configureHost(explicit)
    expect(host.getHost()).toBe(explicit)
    host.callHost('chooseMedia', { count: 1 })
    expect(explicit.chooseMedia).toHaveBeenCalledOnce()
    expect(module.chooseMedia).not.toHaveBeenCalled()
    expect(sdk.getJSModule).not.toHaveBeenCalled()
  })

  it('withdrawing an explicit host restores the lexical native registry', () => {
    const module = mediaHost(), explicit = mediaHost()
    const { host } = loadHost({ lexicalModules: { WotLynxUI: module } })
    host.configureHost(explicit)
    expect(host.getHost()).toBe(explicit)
    host.configureHost(null)
    expect(host.getHost()).toBe(module)
  })

  it('withdrawing an explicit host restores a lexical JSModule', () => {
    const module = mediaHost()
    const sdk = { getJSModule: vi.fn((_name: string) => module) }
    const { host } = loadHost({ lexicalLynx: sdk })
    host.configureHost(mediaHost())
    host.configureHost(null)
    expect(host.getHost()).toBe(module)
  })

  it('an explicitly empty host intentionally overrides available native capabilities', () => {
    const { host } = loadHost({ lexicalModules: { WotLynxUI: mediaHost() } })
    const empty = {}
    host.configureHost(empty)
    expect(host.getHost()).toBe(empty)
    expect(host.hasHostCapability('chooseMedia')).toBe(false)
  })

  it('prefers the primary native module to its compatible name and JSModule', () => {
    const primary = mediaHost(), compatible = mediaHost()
    const sdk = { getJSModule: vi.fn((_name: string) => mediaHost()) }
    const { host } = loadHost({ lexicalModules: { WotLynxUI: primary, WotLynxUIHost: compatible }, lexicalLynx: sdk })
    expect(host.getHost()).toBe(primary)
    expect(sdk.getJSModule).not.toHaveBeenCalled()
  })

  it('supports WotLynxUIHost when the primary module is absent', () => {
    const compatible = mediaHost()
    const sdk = { getJSModule: vi.fn((_name: string) => undefined) }
    const { host } = loadHost({ lexicalModules: { WotLynxUIHost: compatible }, lexicalLynx: sdk })
    expect(host.getHost()).toBe(compatible)
    expect(sdk.getJSModule.mock.calls).toEqual([['WotLynxUI']])
  })

  it('supports the compatible JSModule name', () => {
    const compatible = mediaHost()
    const sdk = { getJSModule: vi.fn((name: string) => name === 'WotLynxUIHost' ? compatible : undefined) }
    const { host } = loadHost({ lexicalLynx: sdk })
    expect(host.getHost()).toBe(compatible)
    expect(sdk.getJSModule.mock.calls).toEqual([['WotLynxUI'], ['WotLynxUIHost']])
  })

  it('prefers a primary JSModule to a compatible native module', () => {
    const primary = mediaHost(), compatible = mediaHost()
    const sdk = { getJSModule: vi.fn((name: string) => name === 'WotLynxUI' ? primary : undefined) }
    const { host } = loadHost({ lexicalModules: { WotLynxUIHost: compatible }, lexicalLynx: sdk })
    expect(host.getHost()).toBe(primary)
  })

  it('missing SDKs return an honest unavailable capability', () => {
    const { host } = loadHost()
    expect(host.getHost()).toEqual({})
    expect(host.hasHostCapability('chooseMedia')).toBe(false)
    expect(host.callHost('chooseMedia', {})).toEqual({ called: false })
  })

  it.each([
    { name: 'unbound module name', scope: {} },
    { name: 'explicit undefined parameter', scope: { lexicalModules: undefined } }
  ])('keeps global-only test hosts working: $name', ({ scope }) => {
    const module = mediaHost()
    const { host } = loadHost({ ...scope, globalModules: { WotLynxUI: module } })
    expect(host.getHost()).toBe(module)
  })

  it('keeps a global-only JSModule SDK working', () => {
    const module = mediaHost()
    const sdk = { getJSModule: vi.fn((_name: string) => module) }
    const { host } = loadHost({ globalLynx: sdk })
    expect(host.getHost()).toBe(module)
  })

  it('does not read a throwing global registry getter when the module-local registry is present', () => {
    const module = mediaHost()
    const { host, globals } = loadHost({ lexicalModules: { WotLynxUI: module } })
    const getter = vi.fn(() => { throw new Error('wrong global') })
    Object.defineProperty(globals, 'NativeModules', { get: getter })
    expect(host.getHost()).toBe(module)
    expect(getter).not.toHaveBeenCalled()
  })

  it('sees native modules registered after an initial unavailable lookup', () => {
    const modules: Record<string, unknown> = {}
    const { host } = loadHost({ lexicalModules: modules })
    expect(host.hasHostCapability('chooseMedia')).toBe(false)
    const module = mediaHost()
    modules.WotLynxUI = module
    expect(host.getHost()).toBe(module)
    expect(host.hasHostCapability('chooseMedia')).toBe(true)
  })

  it('sees JSModules registered after an initial unavailable lookup', () => {
    const modules: Record<string, unknown> = {}
    const sdk = { getJSModule: vi.fn((name: string) => modules[name]) }
    const { host } = loadHost({ lexicalLynx: sdk })
    expect(host.getHost()).toEqual({})
    const module = mediaHost()
    modules.WotLynxUI = module
    expect(host.getHost()).toBe(module)
    expect(host.hasHostCapability('chooseMedia')).toBe(true)
  })

  it('does not cache replacement or withdrawal of a native module', () => {
    const first = mediaHost(), second = mediaHost()
    const modules: Record<string, unknown> = { WotLynxUI: first }
    const { host } = loadHost({ lexicalModules: modules })
    expect(host.getHost()).toBe(first)
    modules.WotLynxUI = second
    expect(host.getHost()).toBe(second)
    modules.WotLynxUI = undefined
    expect(host.getHost()).toEqual({})
    expect(host.hasHostCapability('chooseMedia')).toBe(false)
  })

  it.each([null, 'not a module', 1, () => {}])('invalid primary native entry %s falls through to its JSModule', value => {
    const module = mediaHost()
    const sdk = { getJSModule: vi.fn((_name: string) => module) }
    const { host } = loadHost({ lexicalModules: { WotLynxUI: value }, lexicalLynx: sdk })
    expect(host.getHost()).toBe(module)
  })

  it('an unavailable or throwing primary JSModule still allows a compatible native module', () => {
    const compatible = mediaHost()
    const sdk = { getJSModule: vi.fn((_name: string) => { throw new Error('not registered') }) }
    const { host } = loadHost({ lexicalModules: { WotLynxUIHost: compatible }, lexicalLynx: sdk })
    expect(() => host.getHost()).not.toThrow()
    expect(host.getHost()).toBe(compatible)
  })

  it('calls the selected real module with its own receiver and preserves its result', () => {
    const module = { chooseMedia: vi.fn(function (this: unknown, _options: unknown) { return this }) }
    const { host } = loadHost({ lexicalModules: { WotLynxUI: module } })
    const options = { count: 1, mediaType: ['image'] }
    expect(host.callHost('chooseMedia', options)).toEqual({ called: true, result: module })
    expect(module.chooseMedia.mock.contexts[0]).toBe(module)
    expect(module.chooseMedia).toHaveBeenCalledWith(options)
  })

  it('surfaces a throwing host invocation as failure rather than fake success', () => {
    const module = { chooseMedia: vi.fn((_options: unknown) => { throw new Error('native failure') }) }
    const { host, warn } = loadHost({ lexicalModules: { WotLynxUI: module } })
    expect(host.callHost('chooseMedia', {})).toEqual({ called: false })
    expect(warn).toHaveBeenCalledOnce()
  })
})

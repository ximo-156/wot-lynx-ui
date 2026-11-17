import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { parse } from 'vue/compiler-sfc'
import { compPath } from '../helpers/component-roots'

// Use the installed production compiler, not the lexical-closure Vitest shim:
// native hydration can resolve a missing positive _wvid to undefined.
const require = createRequire(import.meta.url)
const lynxRequire = createRequire(require.resolve('vue-lynx'))
const { transformReactLynxSync } = lynxRequire('@lynx-js/react/transform')

function compile(name: string) {
  const filename = compPath(name, `${name}.vue`)
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
  // Worklet extraction depends on the script body; template/macro compilation
  // is verified separately by the real dual-platform Demo build.
  const script = descriptor.scriptSetup!.content
  const js = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText
  const result = transformReactLynxSync(js, {
    pluginName: 'vue:worklet-mt', filename, sourcemap: false, cssScope: false,
    shake: false, compat: false, refresh: false, defineDCE: false, directiveDCE: false,
    worklet: { target: 'LEPUS', filename, runtimePkg: 'vue-lynx' }
  })
  expect(result.errors).toEqual([])
  const tree = ts.createSourceFile(filename + '.js', result.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const functions: Function[] = []
  const frames: Function[] = []
  let now = 1000
  const sandbox = {
    registerWorkletInternal: (_type: string, _id: string, fn: Function) => functions.push(fn),
    requestAnimationFrame: (fn: Function) => frames.push(fn), Date: { now: () => now }
  }
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'registerWorkletInternal') {
      vm.runInNewContext(node.getText(tree), sandbox)
    } else ts.forEachChild(node, visit)
  }
  visit(tree)
  expect(functions.length).toBeGreaterThan(0)
  return {
    find(marker: string) {
      const fn = functions.find(fn => fn.toString().includes(marker))
      expect(fn, `${name}: missing compiled worklet ${marker}`).toBeDefined()
      return (ctx: object, event: object = {}) => fn!.call({ _c: ctx }, event)
    },
    advance(ms: number) { now += ms; frames.splice(0).forEach(fn => fn()) }
  }
}
function element(attrs: Record<string, string> = {}) {
  const styles: Record<string, string> = {}
  return {
    attrs, styles, getAttribute: (name: string) => attrs[name] ?? null,
    setStyleProperty: (name: string, value: string) => { styles[name] = value },
    querySelectorAll: () => []
  }
}
const ref = (current: any = null) => ({ current })

describe('production worklets with missing conditional refs', () => {
  const button = compile('wd-button')
  const start = button.find('hover-start-time')
  const end = button.find('press.released = Date.now()')
  const cancel = button.find('const color =')
  it.each(Array.from({ length: 8 }, (_, index) => index))('Button preserves press/release/cancel with conditional ref mask %i', mask => {
    const root = element({ 'hover-version': '1', 'hover-start-time': '10', 'hover-stay-time': '20' })
    const ctx = {
      buttonRef: ref(root), pressRef: ref(), nativeTextSelector: 'text',
      borderRef: mask & 1 ? ref(element()) : undefined,
      labelRef: mask & 2 ? ref(element()) : undefined,
      iconRef: mask & 4 ? ref(element()) : undefined
    }
    start(ctx)
    button.advance(10)
    expect(root.styles['background-color']).toContain('active')
    end(ctx)
    button.advance(20)
    expect(root.styles['background-color']).toBe('')
    expect(ctx.pressRef.current).toBeNull()
    start(ctx)
    button.advance(10)
    cancel(ctx)
    expect(root.styles['background-color']).toBe('')
    expect(ctx.pressRef.current).toBeNull()
  })
  it('Button ignores an unready context and stale frames after root removal', () => {
    expect(() => { start({}); end({}); cancel({}) }).not.toThrow()
    const ctx = { buttonRef: ref(element({ 'hover-start-time': '10' })), pressRef: ref() }
    start(ctx)
    ctx.buttonRef.current = null
    button.advance(10)
    expect(ctx.pressRef.current).toBeNull()
  })

  it('Button retires stale delayed work and supports another press after configuration changes', () => {
    const root = element({ 'hover-version': '1', 'hover-start-time': '10', 'hover-stay-time': '20' })
    const ctx = { buttonRef: ref(root), pressRef: ref() }
    start(ctx)
    root.attrs['hover-version'] = '2'
    button.advance(10)
    expect(ctx.pressRef.current).toBeNull()
    expect(root.styles['background-color']).toBe('')
    start(ctx)
    button.advance(10)
    end(ctx)
    start(ctx)
    button.advance(20)
    expect(ctx.pressRef.current.active).toBe(true)
    cancel(ctx)
    expect(ctx.pressRef.current).toBeNull()
    expect(root.styles['background-color']).toBe('')
  })

  it('PullRefresh tolerates absent hints, then updates both hints on the next gesture', () => {
    const compiled = compile('wd-pull-refresh')
    const start = compiled.find('scroll-offset')
    const move = compiled.find('head-height')
    const root = element({ 'head-height': '50', 'gesture-epoch': '1' })
    const ctx = { trackRef: ref(root), dragRef: ref(), pullingRef: undefined as any, loosingRef: undefined as any }
    start(ctx, { touches: [{ clientX: 0, clientY: 0 }] })
    expect(() => move(ctx, { touches: [{ clientX: 0, clientY: 60 }] })).not.toThrow()
    expect(root.styles.transform).toBe('translateY(55px)')
    ctx.pullingRef = ref(element()); ctx.loosingRef = ref(element())
    start(ctx, { touches: [{ clientX: 0, clientY: 0 }] })
    move(ctx, { touches: [{ clientX: 0, clientY: 60 }] })
    expect(ctx.pullingRef.current.styles.display).toBe('none')
    expect(ctx.loosingRef.current.styles.display).toBe('flex')
    move(ctx, { touches: [{ clientX: 0, clientY: 20 }] })
    expect(ctx.pullingRef.current.styles.display).toBe('flex')
    expect(ctx.loosingRef.current.styles.display).toBe('none')
  })

  it('Rate skips absent half-star refs while updating mounted stars', () => {
    const compiled = compile('wd-rate')
    const move = compiled.find('gesture-active-a')
    const star = element()
    move({
      rateRef: ref(element({ 'gesture-count': '1', 'gesture-active-a': '#123456' })),
      geomRef: ref({ count: 1, rects: [{ left: 0, right: 20, width: 20 }], lastStyle: null }),
      starRefs: [ref(star)], halfRefs: [undefined]
    }, { touches: [{ clientX: 10 }] })
    expect(star.styles.color).toBe('#123456')
  })
})

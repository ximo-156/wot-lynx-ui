/**
 * Search 点击响应与竞争状态：真实组件、单次子节点冒泡、主线程 ack、原生方法桩。
 * 不推进固定 100/150ms 延迟来证明响应；focus 属性和 jsdom 几何不是原生事实。
 * SCSS 在内存编译，核查直接声明，不用祖先字体继承替代 text 自身样式。
 * 真机触摸命中、键盘仲裁与视觉体验仍需设备验收。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import postcss from 'postcss'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import Search from '@wot-lynx/primitives/wd-search'
import { compPath } from '../helpers/component-roots'
import { compileScss } from '../helpers/scss'

const restores: Array<() => void> = []
beforeEach(() => { vi.useFakeTimers() })
afterEach(async () => {
  cleanup()
  restores.splice(0).reverse().forEach((restore) => restore())
  await nextTick()
  vi.clearAllTimers()
  vi.useRealTimers()
})

/** 只推进 Vue/MT 提交及 Promise，不推进任何计时器。 */
async function flush() {
  await nextTick()
  await nextTick()
  await nextTick()
}
async function flushLate() {
  await vi.advanceTimersByTimeAsync(500)
  await flush()
}

function nativeMethods(echoInput = false) {
  const env = (globalThis as any).lynxTestingEnv
  const lynx = env.backgroundThread.globalThis.lynx
  const doc: Document = env.jsdom.window.document
  const original = lynx.createSelectorQuery
  const calls: Array<{ method: string; value?: string; node: Element | null }> = []
  const nativeText = new Map<Element, string>()
  lynx.createSelectorQuery = () => ({
    select: (selector: string) => ({
      invoke: (options: any) => ({
        exec() {
          const node = doc.querySelector(selector)
          calls.push({ method: options.method, value: options.params?.value, node })
          if (!node) {
            options.fail?.({ code: 1, data: 'native node has not been materialized' })
            return
          }
          if (options.method === 'setValue') {
            const value = String(options.params?.value ?? '')
            nativeText.set(node, value)
            // Android TextWatcher 可在 setValue 的 success 之前回发 input。
            if (echoInput) fireEvent.input(node, { detail: { value, isComposing: false } })
          }
          options.success?.(options.method === 'getValue' ? { value: nativeText.get(node) ?? '' } : undefined)
        }
      })
    })
  })
  restores.push(() => { lynx.createSelectorQuery = original })
  return { calls, byMethod: (method: string) => calls.filter((call) => call.method === method) }
}

function holdMainThread() {
  const env = (globalThis as any).lynxTestingEnv
  const app = env.backgroundThread.globalThis.lynx.getNativeApp()
  const original = app.callLepusMethod
  const pending: Array<() => void> = []
  let holding = true
  app.callLepusMethod = (...args: any[]) => {
    if (holding && args[0] === 'vuePatchUpdate') pending.push(() => original.apply(app, args))
    else original.apply(app, args)
  }
  const release = () => { holding = false; pending.splice(0).forEach((run) => run()) }
  restores.push(() => { release(); app.callLepusMethod = original })
  return { pending, release }
}

function mountSearch(initialValue = '', initialProps: Record<string, any> = {}) {
  const value = ref(initialValue)
  const props = ref(initialProps)
  const order: any[] = []
  const blur = vi.fn()
  const focus = vi.fn()
  const cancel = vi.fn((payload: any) => order.push(['cancel', payload]))
  const result = render({
    setup: () => () => h(Search, {
      ...props.value,
      modelValue: value.value,
      'onUpdate:modelValue': (next: string) => { order.push(['update', next]); value.value = next },
      onChange: (payload: any) => order.push(['change', payload]),
      onClear: () => order.push(['clear']),
      onCancel: cancel,
      onBlur: blur,
      onFocus: focus
    })
  })
  return {
    ...result, value, props, order, blur, focus, cancel,
    input: () => result.container.querySelector('.wd-search__input'),
    cover: () => result.container.querySelector('.wd-search__cover')
  }
}

function node(container: Element, selector: string): Element {
  const found = container.querySelector(selector)
  expect(found, `missing ${selector}`).not.toBeNull()
  return found!
}
/** 只发一次事件，由 DOM→PAPI→BG 管线自然冒泡，绝不逐层调用处理器。 */
function tapChild(target: Element) {
  fireEvent.tap(target.querySelector('text, svg, image') || target, { bubbles: true })
}

const scss = compPath('wd-search', 'index.scss')
const rules: Array<{ selector: string; declarations: Record<string, string> }> = []
postcss.parse(compileScss(scss)).walkRules((rule) => {
  if (rule.parent?.type !== 'root') return
  const declarations: Record<string, string> = {}
  rule.walkDecls((declaration) => { declarations[declaration.prop] = declaration.value })
  rule.selectors.forEach((selector) => rules.push({ selector, declarations }))
})
function ownStyle(element: Element, active = false) {
  const result: Record<string, string> = {}
  for (const rule of rules) {
    if (rule.selector.includes(':active') && !active) continue
    const selector = rule.selector.replace(/:active/g, '')
    if (element.matches(selector)) Object.assign(result, rule.declarations)
  }
  return result
}

describe('Search 无固定延迟的点击与原生焦点', () => {
  it.each([
    '.wd-search__cover',
    '.wd-search__placeholder-txt',
    '.wd-search__search-icon'
  ])('单次点击 %s 子节点，下一次 MT ack 后只调用一次 focus', async (selector) => {
    const native = nativeMethods()
    const mounted = mountSearch()
    await flush()
    const now = Date.now()
    tapChild(node(mounted.container, selector))
    await flush()
    expect(Date.now(), '不能靠推进固定延迟使测试通过').toBe(now)
    expect(mounted.cover()).toBeNull()
    expect(mounted.input()).not.toBeNull()
    expect(native.byMethod('focus')).toHaveLength(1)
    expect(native.byMethod('focus')[0]!.node).toBe(mounted.input())
  })

  it('后台点击不等于原生 input 已存在，必须等实际 MT 建树 ack 再 focus', async () => {
    const native = nativeMethods()
    const mounted = mountSearch()
    await flush()
    const mt = holdMainThread()
    tapChild(node(mounted.container, '.wd-search__search-icon'))
    await Promise.resolve()
    await Promise.resolve()
    expect(mt.pending.length).toBeGreaterThan(0)
    expect(mounted.input()).toBeNull()
    expect(native.byMethod('focus')).toHaveLength(0)
    mt.release()
    await flush()
    expect(native.byMethod('focus')).toHaveLength(1)
    expect(native.byMethod('focus')[0]!.node).toBe(mounted.input())
  })

  it('已有输入框的左侧放大镜也能聚焦；取消整盒子节点冒泡只 blur/cancel 一次且保留值', async () => {
    const native = nativeMethods()
    const mounted = mountSearch('保留关键词', { placeholderLeft: true })
    await flush()
    tapChild(node(mounted.container, '.wd-search__search-left-icon'))
    await flush()
    expect(native.byMethod('focus')).toHaveLength(1)
    mounted.order.length = 0
    tapChild(node(mounted.container, '.wd-search__cancel-text'))
    await flush()
    expect(native.byMethod('blur')).toHaveLength(1)
    expect(native.byMethod('blur')[0]!.node).toBe(mounted.input())
    expect(mounted.value.value).toBe('保留关键词')
    expect(mounted.cancel).toHaveBeenCalledExactlyOnceWith({ value: '保留关键词' })
    expect(mounted.order).toEqual([['cancel', { value: '保留关键词' }]])
  })

  it('封面点击后立即取消，不能在下一帧或旧延迟到期后重新弹出键盘', async () => {
    const native = nativeMethods()
    const mounted = mountSearch()
    await flush()
    tapChild(node(mounted.container, '.wd-search__cover'))
    tapChild(node(mounted.container, '.wd-search__cancel-text'))
    await flush()
    expect(native.byMethod('focus')).toHaveLength(0)
    expect(mounted.cover()).not.toBeNull()
    expect(mounted.cancel).toHaveBeenCalledExactlyOnceWith({ value: '' })
    await flushLate()
    expect(native.byMethod('focus')).toHaveLength(0)
    expect(mounted.input()).toBeNull()
  })

  it.each(['disabled', 'unmount'] as const)('待执行 focus 遇到 %s 后不再调用原生 focus', async (action) => {
    const native = nativeMethods()
    const mounted = mountSearch()
    await flush()
    tapChild(node(mounted.container, '.wd-search__cover'))
    if (action === 'disabled') mounted.props.value.disabled = true
    else mounted.unmount()
    await flush()
    await flushLate()
    expect(native.byMethod('focus')).toHaveLength(0)
  })

  it('同一轮 blur 后马上收到新 focus，旧 blur 不得卸载空输入框', async () => {
    nativeMethods()
    const mounted = mountSearch('', { focus: true })
    await flush()
    const input = mounted.input()!
    expect(input).not.toBeNull()
    fireEvent.blur(input, { detail: { value: '' } })
    fireEvent.focus(input, { detail: { value: '' } })
    await flush()
    expect(mounted.input()).toBe(input)
    expect(mounted.cover()).toBeNull()
    expect(mounted.blur).not.toHaveBeenCalled()
    expect(mounted.focus).toHaveBeenCalledExactlyOnceWith({ value: '' })
  })
})

describe('Search 清除、取消与外部受控替换', () => {
  it('clear 后立即 cancel，旧 clear 不重发事件、不重新 focus', async () => {
    const native = nativeMethods()
    const mounted = mountSearch('old', { focus: true, focusWhenClear: true })
    await flush()
    native.calls.length = 0
    mounted.order.length = 0
    tapChild(node(mounted.container, '.wd-search__clear-icon'))
    tapChild(node(mounted.container, '.wd-search__cancel-text'))
    await flush()
    await flushLate()
    expect(native.byMethod('focus')).toHaveLength(0)
    expect(native.byMethod('blur')).toHaveLength(1)
    expect(mounted.value.value).toBe('old')
    expect(mounted.order).toEqual([['cancel', { value: '' }]])
    expect(mounted.cover()).not.toBeNull()
  })

  it.each([false, true])('clear 保持 change→update→clear 与 v-model 回写后的 refocus（原生 input 回声=%s）', async (echoInput) => {
    const native = nativeMethods(echoInput)
    const mounted = mountSearch('old', { placeholderLeft: true, focusWhenClear: true })
    await flush()
    native.calls.length = 0
    mounted.order.length = 0
    const now = Date.now()
    tapChild(node(mounted.container, '.wd-search__clear-icon'))
    await flush()
    expect(Date.now()).toBe(now)
    expect(mounted.order).toEqual([['change', { value: '' }], ['update', ''], ['clear']])
    expect(mounted.value.value).toBe('')
    expect(mounted.input()).not.toBeNull()
    expect(native.byMethod('focus')).toHaveLength(1)
    expect(native.byMethod('focus')[0]!.node).toBe(mounted.input())
  })

  it('clear 等待 MT 时外部换成 newer，不能清掉新值或执行旧 refocus', async () => {
    const native = nativeMethods()
    const mounted = mountSearch('old', { placeholderLeft: true, focusWhenClear: true })
    await flush()
    native.calls.length = 0
    mounted.order.length = 0
    tapChild(node(mounted.container, '.wd-search__clear-icon'))
    mounted.value.value = 'newer'
    await flush()
    await flushLate()
    expect(mounted.value.value).toBe('newer')
    expect(mounted.order).toEqual([])
    expect(native.byMethod('focus')).toHaveLength(0)
    expect(mounted.input()).not.toBeNull()
  })
})

describe('Search 取消按钮原生盒与直接文字样式', () => {
  it('取消文字直接声明字体/颜色，整盒有 flex/定高/内边距与 active 反馈', async () => {
    nativeMethods()
    const mounted = mountSearch()
    await flush()
    const box = node(mounted.container, '.wd-search__cancel')
    const text = node(mounted.container, '.wd-search__cancel-text')
    const boxStyle = ownStyle(box)
    const textStyle = ownStyle(text)
    expect(text.tagName.toLowerCase()).toBe('text')
    for (const property of ['font-size', 'line-height', 'color']) {
      expect(textStyle[property], `${property} 必须直接落在 text`).toBeTruthy()
      expect(textStyle[property]).not.toMatch(/^(inherit|currentColor)$/i)
      expect(boxStyle[property], `容器不代替 text 声明 ${property}`).toBeUndefined()
    }
    expect(boxStyle.display).toBe('flex')
    expect(boxStyle['flex-direction']).toBe('row')
    expect(boxStyle['align-items']).toBe('center')
    expect(boxStyle['justify-content']).toBe('center')
    expect(boxStyle['flex-shrink']).toBe('0')
    expect(boxStyle.height).toContain('--wot-search-input-height')
    expect(boxStyle.padding).toContain('var(')
    expect(ownStyle(box, true).opacity, '按压反馈应由 CSS active 承担').toBeTruthy()
    expect(textStyle['pointer-events']).toBe('none')
    expect(text.getAttribute('user-interaction-enabled')).toBe('false')
  })
})

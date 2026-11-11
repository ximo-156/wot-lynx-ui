/**
 * SlideVerify 设备回归：真实单事件冒泡、迟到几何、取消/重试与直接文字样式。
 * 数字几何桩只验证手势映射；不把 JSDOM 当成 Android/iOS 布局或绘制验收。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import postcss from 'postcss'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import SlideVerify from '@wot-lynx/ui-form/wd-slide-verify'
import { usePageScrollLock } from '@wot-lynx/core/composables/useLockScroll'
import { compileScss } from '../helpers/scss'
import { compPath } from '../helpers/component-roots'

const scss = compPath('wd-slide-verify', 'index.scss')
const rules: Array<{ selector: string; specificity: number; declarations: Record<string, string> }> = []
postcss.parse(compileScss(scss)).walkRules((rule) => {
  if (rule.parent?.type !== 'root') return
  const declarations: Record<string, string> = {}
  rule.walkDecls((decl) => { declarations[decl.prop] = decl.value })
  for (const selector of rule.selectors) {
    rules.push({ selector, specificity: (selector.match(/\.[\w-]+/g) || []).length, declarations })
  }
})
function ownStyle(element: Element) {
  const style: Record<string, string> = {}, weights: Record<string, number> = {}
  for (const rule of rules) {
    if (!element.matches(rule.selector)) continue
    for (const [key, value] of Object.entries(rule.declarations)) {
      if ((weights[key] ?? -1) <= rule.specificity) { weights[key] = rule.specificity; style[key] = value }
    }
  }
  return style
}
function resolveTokens(value: string, tokens: Record<string, string> = {}) {
  for (let depth = 0; depth < 30; depth++) {
    const next = value.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g, (match, key, fallback) => tokens[key] ?? fallback?.trim() ?? match)
    if (next === value) return value
    value = next
  }
  throw new Error('cyclic slide-verify token')
}

const rect = (width = 300, height = 40) => ({ id: '', left: 0, top: 0, right: width, bottom: height, width, height })
let query: (options: any) => void
let restoreQuery: () => void
const lock = usePageScrollLock()
beforeEach(() => {
  vi.useFakeTimers()
  query = (options) => options.success?.(rect())
  const lynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const original = lynx.createSelectorQuery
  lynx.createSelectorQuery = () => ({ select: () => ({ invoke(options: any) { query(options); return { exec() {} } } }) })
  restoreQuery = () => { lynx.createSelectorQuery = original }
  ;(globalThis as any).__wdRectStub = () => rect()
})
afterEach(() => { cleanup(); restoreQuery(); delete (globalThis as any).__wdRectStub; vi.useRealTimers() })
async function flush(ms = 20) { await vi.advanceTimersByTimeAsync(ms); await nextTick() }
function mount(extra: Record<string, any> = {}) {
  const events: string[] = [], disabled = ref(false), exposed = ref<any>()
  const view = render({ setup: () => () => h(SlideVerify, {
    ...extra, ref: exposed, disabled: disabled.value,
    onSuccess: () => events.push('success'), onFail: () => events.push('fail')
  }) } as any)
  return { ...view, events, disabled, exposed,
    root: view.container.querySelector('.wd-slide-verify') as HTMLElement,
    track: view.container.querySelector('.wd-slide-verify__track') as HTMLElement,
    button: view.container.querySelector('.wd-slide-verify__button') as HTMLElement
  }
}
function native(element: Element, type: string, x: number, timestamp = 1000) {
  const point = { clientX: x, clientY: 0, identifier: timestamp }
  fireEvent[type](element, { touches: [point], changedTouches: [point], timestamp, bubbles: true })
}

describe('SlideVerify 真机反馈回归', () => {
  it('默认宽度先经样式表变量保存 100% fallback；自定义宽度仍生效', async () => {
    const m = mount(); await flush()
    const style = ownStyle(m.root)
    expect(style.width).toBe('var(--wot-slide-verify-resolved-width)')
    expect(style['--wot-slide-verify-resolved-width']).toContain('var(--wot-slide-verify-width, 100%)')
    expect(resolveTokens(style.width, style)).toBe('100%')
    expect(resolveTokens(style.width, { ...style, '--wot-slide-verify-width': '260px' })).toBe('260px')
    expect(style['flex-shrink']).toBe('0')
    expect(m.root.getAttribute('flatten')).toBe('false')
    expect(m.exposed.value.$.subTree.props.style['touch-action']).toBe('pan-y')
    expect(m.exposed.value.$.subTree.props['consume-slide-event']).toEqual([[-180, -135], [-45, 45], [135, 180]])
    const icon = m.button.querySelector('.wd-icon') as HTMLElement
    expect(icon.getAttribute('user-interaction-enabled')).toBe('false')
    expect(icon.style.pointerEvents).toBe('none')
  })

  it('单事件冒泡拖过中点、停顿后继续到末端；不持有全页滚动锁', async () => {
    const m = mount({ activeBackgroundColor: '#138a65' }); await flush()
    const beforeLock = lock.value
    native(m.button, 'touchstart', 0); await flush()
    native(m.button, 'touchmove', 120, 1100)
    expect(m.track.style.width).toBe('160px')
    expect(m.track.style.backgroundColor).toBe('rgb(19, 138, 101)')
    await flush(1500)
    native(m.button, 'touchmove', 260, 2700)
    expect(m.track.style.width).toBe('300px')
    expect(m.events).toEqual([])
    native(m.button, 'touchend', 260, 2800); await flush()
    expect(m.events).toEqual(['success'])
    expect(m.root.classList.contains('is-dragging')).toBe(false)
    expect(lock.value).toBe(beforeLock)
  })

  it('取消即使在终点也不能通过；清尾后可以立即重试且不带回弹 transition', async () => {
    const m = mount(); await flush()
    native(m.button, 'touchstart', 0); await flush()
    native(m.button, 'touchmove', 260, 1100)
    native(m.button, 'touchcancel', 260, 1200); await flush()
    expect(m.events).toEqual(['fail'])
    expect(m.track.style.width).toBe('40px')
    expect(m.root.classList.contains('is-dragging')).toBe(false)
    native(m.button, 'touchmove', 260, 1250)
    expect(m.track.style.width).toBe('40px')
    native(m.button, 'touchstart', 0, 1300); await flush()
    native(m.button, 'touchmove', 260, 1400)
    expect(m.track.style.transition).toBe('none')
    native(m.button, 'touchend', 260, 1500); await flush()
    expect(m.events).toEqual(['fail', 'success'])
  })

  it('半途失败回弹后，下一次完整拖动仍正常通过', async () => {
    const m = mount(); await flush()
    native(m.button, 'touchstart', 0); await flush()
    native(m.button, 'touchmove', 100, 1100)
    native(m.button, 'touchend', 100, 1200); await flush()
    expect(m.events).toEqual(['fail'])
    native(m.button, 'touchstart', 0, 1300); await flush()
    native(m.button, 'touchmove', 260, 1400)
    native(m.button, 'touchend', 260, 1500); await flush()
    expect(m.events).toEqual(['fail', 'success'])
    expect(m.track.style.width).toBe('300px')
  })

  it('旧的非零首屏尺寸不会把轨道终点截在中途', async () => {
    query = (options) => options.success?.(rect(96))
    const m = mount(); await flush()
    expect(m.track.getAttribute('container-width')).toBe('96')
    query = (options) => options.success?.(rect())
    native(m.button, 'touchstart', 0); await flush()
    native(m.button, 'touchmove', 190, 1100)
    expect(m.track.style.width).toBe('230px')
    native(m.button, 'touchmove', 260, 1200)
    native(m.button, 'touchend', 260, 1300); await flush()
    expect(m.events).toEqual(['success'])
    expect(m.track.style.width).toBe('300px')
  })

  it('抬手早于新尺寸回调：不按旧短轨道误判通过', async () => {
    query = (options) => options.success?.(rect(96))
    const m = mount(); await flush()
    const pending: any[] = []
    query = (options) => { pending.push(options) }
    native(m.button, 'touchstart', 0); await flush()
    native(m.button, 'touchmove', 120, 1100)
    native(m.button, 'touchend', 120, 1200); await flush()
    expect(m.events).toEqual([])
    pending[0].success(rect()); await flush()
    expect(m.events).toEqual(['fail'])
    expect(m.root.classList.contains('is-success')).toBe(false)
  })

  it('主线程首次度量迟到时自动补到最新触点，不丢前半段 move', async () => {
    query = (options) => options.success?.(rect(0, 0))
    const m = mount(); await flush()
    let resolveRect!: (value: any) => void
    ;(globalThis as any).__wdRectStub = () => new Promise((resolve) => { resolveRect = resolve })
    native(m.button, 'touchstart', 0)
    native(m.button, 'touchmove', 120, 1100)
    expect(m.track.style.width).toBe('0px')
    resolveRect(rect()); await flush()
    expect(m.track.style.width).toBe('160px')
  })

  it('拖动期间 layoutchange 更新后台几何但不冲刷 MT 正在跟手的宽度', async () => {
    const m = mount(); await flush()
    native(m.button, 'touchstart', 0); await flush()
    native(m.button, 'touchmove', 140, 1100)
    expect(m.track.style.width).toBe('180px')
    fireEvent.layoutchange(m.root, { detail: { width: 320, height: 44 } }); await flush()
    expect(m.track.style.width).toBe('180px')
    native(m.button, 'touchmove', 150, 1200)
    expect(m.track.style.width).toBe('190px')
    native(m.button, 'touchend', 280, 1300); await flush()
    expect(m.events).toEqual(['success'])
    expect(m.track.style.width).toBe('320px')
  })

  it('旧段迟到的主线程查询不能覆盖新段的位置与几何', async () => {
    const m = mount(); await flush()
    const callbacks: Array<(value: any) => void> = []
    ;(globalThis as any).__wdRectStub = () => new Promise((resolve) => { callbacks.push(resolve) })
    native(m.button, 'touchstart', 0)
    native(m.button, 'touchmove', 100, 1100)
    native(m.button, 'touchend', 100, 1200); await flush()
    native(m.button, 'touchstart', 0, 1300)
    callbacks[1](rect()); await flush()
    native(m.button, 'touchmove', 200, 1400)
    expect(m.track.style.width).toBe('240px')
    callbacks[0](rect(80)); await flush()
    expect(m.track.style.width).toBe('240px')
  })

  it('外部 reset 失效仍在派发的旧 move，下一次真实 start 可以恢复', async () => {
    const m = mount(); await flush()
    native(m.button, 'touchstart', 0); await flush()
    native(m.button, 'touchmove', 150, 1100)
    m.exposed.value.reset(); await flush()
    native(m.button, 'touchmove', 260, 1200)
    native(m.button, 'touchend', 260, 1300); await flush()
    expect(m.track.style.width).toBe('40px')
    expect(m.events).toEqual([])
    native(m.button, 'touchstart', 0, 1400); await flush()
    native(m.button, 'touchend', 260, 1500); await flush()
    expect(m.events).toEqual(['success'])
  })

  it('禁用变化撤销等待尺寸的落定，迟到回调不得通过；重新启用可重试', async () => {
    const m = mount(); await flush()
    const callbacks: any[] = []
    query = (options) => { callbacks.push(options) }
    native(m.button, 'touchstart', 0); await flush()
    native(m.button, 'touchend', 260, 1100); await flush()
    m.disabled.value = true; await flush()
    callbacks[0].success(rect()); await flush()
    expect(m.events).toEqual([])
    expect(m.track.style.width).toBe('40px')
    expect(m.exposed.value.$.subTree.props['consume-slide-event']).toEqual([])
    query = (options) => options.success?.(rect())
    m.disabled.value = false; await flush()
    native(m.button, 'touchstart', 0, 1200); await flush()
    native(m.button, 'touchend', 260, 1300); await flush()
    expect(m.events).toEqual(['success'])
  })

  it('未通过时不露成功文案；通过后白色/字号/行高直接声明在 text', async () => {
    const m = mount(); await flush()
    expect(m.container.querySelector('.wd-slide-verify__track-text')).toBeNull()
    native(m.button, 'touchstart', 0); await flush()
    native(m.button, 'touchend', 260, 1100); await flush()
    const text = m.container.querySelector('.wd-slide-verify__track-text-inner')!
    expect(text.tagName.toLowerCase()).toBe('text')
    expect(text.getAttribute('text-maxline')).toBe('1')
    const style = ownStyle(text)
    expect(['white', '#fff', '#ffffff', '#ffffffff']).toContain(resolveTokens(style.color).toLowerCase())
    for (const key of ['color', 'font-size', 'line-height']) {
      expect(style[key]).toBeTruthy()
      expect(style[key]).not.toMatch(/^(inherit|currentColor)$/i)
    }
  })
})

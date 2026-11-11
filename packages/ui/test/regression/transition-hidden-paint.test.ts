/**
 * 原生闭态绘制回归（不是 jsdom 像素测试）。
 *
 * Lynx 的 display:none 把子树尺寸归零，但文字仍可能绘制；官方要求隐藏父级
 * 同时裁剪：https://lynxjs.org/api/css/properties/display.md
 * 时间选择器 hideWhenClose=false、Toast/Loading 默认保活都命中此契约。
 *
 * 在真实双线程 SET_STYLE / FlushElementTree 出口取证，不把浏览器的
 * display:none、CSSOM 归一化或一次新 mount 当作原生关闭成功。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, onUnmounted, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import Transition from '@wot-lynx/primitives/wd-transition'
import Popup from '@wot-lynx/primitives/wd-popup'
import DatetimePicker from '@wot-lynx/ui-picker/wd-datetime-picker'
import Toast from '@wot-lynx/primitives/wd-toast'
import { useToast } from '@wot-lynx/primitives/wd-toast'
import { usePageScrollLock } from '@wot-lynx/core/composables/useLockScroll'

type NativeStyle = Record<string, string>
let styles: Map<Element, NativeStyle>
let painted: Array<{ element: Element; style: NativeStyle }>
let restoreProbe: () => void

async function advance(ms = 20) {
  await vi.advanceTimersByTimeAsync(ms)
  await nextTick()
}

beforeEach(() => {
  vi.useFakeTimers()
  styles = new Map()
  painted = []
  const global = globalThis as any
  const mt = global.lynxTestingEnv.mainThread.globalThis
  const bg = global.lynxTestingEnv.backgroundThread.globalThis
  // 测试宿主初始化时把 rAF 固定成了当时的真实 setTimeout。只 fake 全局
  // timers 不会推进它，且线程切换还会恢复旧 rAF；三处一起接到受控时钟。
  const frameTargets = [global, mt, bg]
  const frameOriginals = frameTargets.map((target) => [target.requestAnimationFrame, target.cancelAnimationFrame])
  for (const target of frameTargets) {
    target.requestAnimationFrame = (callback: (time: number) => void) => setTimeout(() => callback(Date.now()), 16)
    target.cancelAnimationFrame = (id: ReturnType<typeof setTimeout>) => clearTimeout(id)
  }
  const originalStyle = mt.__SetInlineStyles
  const originalFlush = mt.__FlushElementTree
  const globalStyle = global.__SetInlineStyles
  const globalFlush = global.__FlushElementTree
  const setStyle = (element: Element, value: NativeStyle) => {
    styles.set(element, { ...styles.get(element), ...value })
    return originalStyle(element, value)
  }
  const flush = (...args: unknown[]) => {
    for (const [element, style] of styles) {
      if (element.isConnected && element.classList.contains('wd-transition')) {
        painted.push({ element, style: { ...style } })
      }
    }
    return originalFlush(...args)
  }
  mt.__SetInlineStyles = global.__SetInlineStyles = setStyle
  mt.__FlushElementTree = global.__FlushElementTree = flush
  restoreProbe = () => {
    mt.__SetInlineStyles = originalStyle
    mt.__FlushElementTree = originalFlush
    global.__SetInlineStyles = globalStyle
    global.__FlushElementTree = globalFlush
    frameTargets.forEach((target, index) => {
      ;[target.requestAnimationFrame, target.cancelAnimationFrame] = frameOriginals[index]!
    })
  }
})

afterEach(async () => {
  cleanup()
  await advance(1000)
  restoreProbe()
  vi.useRealTimers()
})

function node(container: Element, selector = '.wd-transition'): Element {
  const result = container.querySelector(selector)
  expect(result, selector).not.toBeNull()
  return result!
}

function nativeStyle(element: Element): NativeStyle {
  expect(styles.has(element), '应在主线程收到该节点的样式').toBe(true)
  return styles.get(element)!
}

const closedStyle = { display: 'none', overflow: 'hidden', 'overflow-x': 'hidden', 'overflow-y': 'hidden' }
function expectClosed(element: Element) {
  expect(nativeStyle(element), '尺寸归零的保活节点必须同时裁剪两轴，不能只检查 display:none').toMatchObject(closedStyle)
}

function expectNoUnclippedHiddenPaint() {
  const hidden = painted.filter(({ style }) => style.display === 'none')
  expect(hidden.length, '必须实际观察到关闭态的原生绘制批次').toBeGreaterThan(0)
  for (const { style } of hidden) {
    expect(style, '任何已下发的关闭帧都不能有无裁剪的 0×0 文字容器').toMatchObject(closedStyle)
  }
}

const modes = [
  { destroy: false, lazyRender: false },
  { destroy: false, lazyRender: true },
  { destroy: true, lazyRender: false },
  { destroy: true, lazyRender: true }
]

describe('Transition 原生关闭态绘制契约', () => {
  it.each(modes)('保留显隐/销毁语义：destroy=$destroy lazyRender=$lazyRender', async (mode) => {
    const show = ref(false)
    const afterEnter = vi.fn()
    const afterLeave = vi.fn()
    let mounts = 0
    let unmounts = 0
    const Child = {
      setup() {
        mounts++
        const count = ref(0)
        onUnmounted(() => { unmounts++ })
        return () => h('text', { class: 'memory', onTap: () => count.value++ }, String(count.value))
      }
    }
    const { container } = render({
      setup: () => () => h(Transition, {
        ...mode, show: show.value, name: 'slide-up', duration: { enter: 40, leave: 100 },
        onAfterEnter: afterEnter, onAfterLeave: afterLeave
      }, { default: () => h(Child) })
    })
    await advance()
    const destroys = mode.destroy && mode.lazyRender
    if (destroys) expect(container.querySelector('.wd-transition')).toBeNull()
    else expectClosed(node(container))
    expect(mounts).toBe(mode.lazyRender ? 0 : 1)

    show.value = true
    await advance(200)
    const panel = node(container)
    const child = node(container, '.memory')
    expect(nativeStyle(panel)).toMatchObject({ display: 'flex', overflow: '', 'overflow-x': '', 'overflow-y': '' })
    expect(afterEnter).toHaveBeenCalledTimes(1)
    fireEvent.tap(child)
    await advance()
    expect(child.textContent).toBe('1')

    show.value = false
    await advance()
    // false 只是启动 leave；不能在退场中途裁掉圆角内容/外溢动画。
    expect(nativeStyle(panel)).toMatchObject({ display: 'flex', overflow: '' })
    expect(afterLeave).not.toHaveBeenCalled()
    await advance(200)
    expect(afterLeave).toHaveBeenCalledTimes(1)
    if (destroys) {
      expect(container.querySelector('.wd-transition')).toBeNull()
      expect(unmounts).toBe(1)
    } else {
      expect(node(container, '.memory')).toBe(child)
      expectClosed(panel)
      expect(unmounts).toBe(0)
      expectNoUnclippedHiddenPaint()
    }

    show.value = true
    await advance(200)
    expect(afterEnter).toHaveBeenCalledTimes(2)
    expect(node(container, '.memory').textContent).toBe(destroys ? '0' : '1')
    expect(mounts).toBe(destroys ? 2 : 1)
    expect(nativeStyle(node(container))).toMatchObject({ display: 'flex', overflow: '', 'overflow-x': '', 'overflow-y': '' })
  })

  it('关闭时定制样式不能击穿裁剪；重开/删定制显式恢复原值，不留下 hidden', async () => {
    const show = ref(false)
    const customStyle = ref<string | Record<string, string>>('overflow:visible;overflow-x:visible;overflow-y:visible;border-radius:12px')
    const duration = ref(50)
    const { container } = render({
      setup: () => () => h(Transition, {
        show: show.value, customStyle: customStyle.value, duration: duration.value, name: 'fade'
      }, { default: () => h('text', {}, '不能漏到左上角') })
    })
    await advance()
    const panel = node(container)
    expectClosed(panel)
    // show 同值，但样式和时长变更，原节点仍不能泄漏。
    customStyle.value = { overflow: 'visible', overflowX: 'visible', overflowY: 'visible', 'border-radius': '16px' }
    duration.value = 80
    await advance()
    expectClosed(panel)
    show.value = true
    await advance(200)
    expect(nativeStyle(panel)).toMatchObject({ display: 'flex', overflow: 'visible', 'overflow-x': 'visible', 'overflow-y': 'visible' })

    show.value = false
    await advance(200)
    expectClosed(panel)
    customStyle.value = { overflow: 'hidden' }
    await advance()
    show.value = true
    await advance(200)
    // 恢复 shorthand 时，两轴的中性值不能把调用方的 hidden 冲掉。
    expect(nativeStyle(panel)).toMatchObject({ overflow: 'hidden', 'overflow-x': 'hidden', 'overflow-y': 'hidden' })
    customStyle.value = { 'overflow-x': 'hidden', 'overflow-y': 'visible' }
    await advance()
    expect(nativeStyle(panel)).toMatchObject({ overflow: '', 'overflow-x': 'hidden', 'overflow-y': 'visible' })
    customStyle.value = {}
    await advance()
    expect(nativeStyle(panel)).toMatchObject({ overflow: '', 'overflow-x': '', 'overflow-y': '' })
    expectNoUnclippedHiddenPaint()
  })

  it.each([false, true])('入场中关闭、退场中重开，不被旧回调裁掉（initialShow=%s）', async (initialShow) => {
    const show = ref(initialShow)
    const afterLeave = vi.fn()
    const { container } = render({
      setup: () => () => h(Transition, {
        show: show.value, name: 'fade', duration: { enter: 100, leave: 100 }, onAfterLeave: afterLeave
      }, { default: () => h('text', {}, '加载中') })
    })
    await advance()
    show.value = true
    await advance()
    const panel = node(container)
    show.value = false
    await advance()
    expect(nativeStyle(panel)).toMatchObject({ display: 'flex', overflow: '' })
    show.value = true
    await advance(250)
    expect(nativeStyle(panel)).toMatchObject({ display: 'flex', overflow: '' })
    expect(afterLeave).not.toHaveBeenCalled()
    show.value = false
    await advance(250)
    expectClosed(panel)
    expect(afterLeave).toHaveBeenCalledTimes(1)
    expectNoUnclippedHiddenPaint()
  })

  it('从未打开的闭态根切换为保活模式，不把框架合成入场当作真实打开', async () => {
    const destroy = ref(true)
    const afterEnter = vi.fn()
    const afterLeave = vi.fn()
    const { container } = render({
      setup: () => () => h(Transition, {
        show: false, destroy: destroy.value, lazyRender: true, duration: 40,
        onAfterEnter: afterEnter, onAfterLeave: afterLeave
      }, { default: () => h('text', {}, '尚未打开') })
    })
    await advance()
    destroy.value = false
    await advance(200)
    expectClosed(node(container))
    expect(afterEnter).not.toHaveBeenCalled()
    expect(afterLeave).not.toHaveBeenCalled()
    expectNoUnclippedHiddenPaint()
  })

  it.each([0, 20])('关闭同帧/离场中切换为保活模式，新根从第一帧就裁剪（delay=%s）', async (delay) => {
    const show = ref(true)
    const destroy = ref(true)
    const { container } = render({
      setup: () => () => h(Transition, {
        show: show.value, destroy: destroy.value, lazyRender: true, duration: { enter: 40, leave: 120 }, name: 'fade'
      }, { default: () => h('text', {}, '切换模式') })
    })
    await advance(200)
    const oldRoot = node(container)
    show.value = false
    if (delay) await advance(delay)
    destroy.value = false
    await advance()
    const newRoot = [...container.querySelectorAll('.wd-transition')].find((element) => element !== oldRoot)!
    expect(newRoot).toBeDefined()
    expectClosed(newRoot)
    expect(nativeStyle(oldRoot)).toMatchObject({ display: 'flex', overflow: '' })
    await advance(300)
    expect(oldRoot.isConnected).toBe(false)
    expectClosed(newRoot)
    show.value = true
    await advance(200)
    expect(node(container)).toBe(newRoot)
    expect(nativeStyle(newRoot)).toMatchObject({ display: 'flex', overflow: '' })
    expectNoUnclippedHiddenPaint()
  })

  it('退休根的 after-leave 不能提前裁掉新根正在播放的 leave，也不能提前发关闭回调', async () => {
    const show = ref(true)
    const destroy = ref(true)
    const afterLeave = vi.fn()
    const { container } = render({
      setup: () => () => h(Transition, {
        show: show.value, destroy: destroy.value, lazyRender: true, duration: { enter: 40, leave: 100 },
        name: 'fade', onAfterLeave: afterLeave
      }, { default: () => h('text', {}, '新旧原生根') })
    })
    await advance(200)
    const oldRoot = node(container)
    destroy.value = false
    await advance()
    expect(oldRoot.isConnected, '必须真实观察到旧根正在离场，不能在旧根已直接删除时假绿').toBe(true)
    const newRoot = [...container.querySelectorAll('.wd-transition')].find((element) => element !== oldRoot)!
    expect(newRoot).toBeDefined()
    show.value = false
    await advance()
    await advance(100)
    // A 的 leave 已完成，B 的 leave 晚启动 20ms，当前仍在场。
    expect(oldRoot.isConnected).toBe(false)
    expect(nativeStyle(newRoot)).toMatchObject({ display: 'flex', overflow: '' })
    expect(afterLeave).not.toHaveBeenCalled()
    await advance(60)
    expectClosed(newRoot)
    expect(afterLeave).toHaveBeenCalledTimes(1)
    expectNoUnclippedHiddenPaint()
  })

  it('after-leave 回调立即重新打开仍恢复原样式', async () => {
    const show = ref(true)
    const afterLeave = vi.fn(() => { show.value = true })
    const { container } = render({
      setup: () => () => h(Transition, {
        show: show.value, duration: 40, name: 'fade', onAfterLeave: afterLeave
      }, { default: () => h('text', {}, '下一条消息') })
    })
    await advance(200)
    show.value = false
    await advance(300)
    expect(afterLeave).toHaveBeenCalledTimes(1)
    expect(nativeStyle(node(container))).toMatchObject({ display: 'flex', overflow: '', 'overflow-x': '', 'overflow-y': '' })
  })
})

describe.each(['hideWhenClose', 'lazyRender'])('Popup 关闭期间修改 %s 的锁释放', (property) => {
  it.each([0, 20])('同帧/离场中修改模式仍完整收尾（delay=%s）', async (delay) => {
    const show = ref(true)
    const mode = ref(true)
    const afterLeave = vi.fn()
    const lock = usePageScrollLock()
    const { container } = render({
      setup: () => () => h(Popup, {
        modelValue: show.value, position: 'bottom', duration: 120,
        hideWhenClose: property === 'hideWhenClose' ? mode.value : true,
        lazyRender: property === 'lazyRender' ? mode.value : true,
        onAfterLeave: afterLeave
      }, { default: () => h('text', {}, '保活弹层') })
    })
    await advance(200)
    expect(lock.value).toBe(true)
    show.value = false
    if (delay) await advance(delay)
    mode.value = false
    await advance()
    expect(lock.value, '仍有旧面板退场，不能提前释放租约').toBe(true)
    expect(afterLeave).not.toHaveBeenCalled()
    await advance(300)
    expect(lock.value, '根模式替换不能跳过 after-leave，留下永久全页锁').toBe(false)
    expect(afterLeave).toHaveBeenCalledTimes(1)
    expectClosed(node(container, '.wd-popup'))
    expectClosed(node(container, '.wd-overlay'))
    show.value = true
    await advance(200)
    expect(lock.value).toBe(true)
    expect(nativeStyle(node(container, '.wd-popup'))).toMatchObject({ display: 'flex', overflow: '' })
    expectNoUnclippedHiddenPaint()
  })
})

describe.each([false, true])('日期时间选择器真实关闭链（rootPortal=%s）', (rootPortal) => {
  it.each(['cancel', 'confirm', 'mask', 'external'])('%s 关闭后保活但裁剪，重开正常', async (channel) => {
    const visible = ref(false)
    const value = ref('09:30')
    const title = ref('日期时间')
    const zIndex = ref(10)
    const changes = vi.fn()
    const lock = usePageScrollLock()
    const { container } = render({
      setup: () => () => h(DatetimePicker, {
        visible: visible.value, modelValue: value.value, type: 'time', title: title.value,
        rootPortal, zIndex: zIndex.value,
        'onUpdate:visible': (next: boolean) => { visible.value = next },
        'onUpdate:modelValue': (next: string) => { value.value = next },
        onChange: changes
      })
    })
    await advance()
    const panel = node(container, '.wd-popup')
    expectClosed(panel)
    expect(container.querySelector('.wd-datetime-picker__title')).toBeNull()
    expect(lock.value).toBe(false)

    visible.value = true
    await advance(400)
    expect(node(container, '.wd-popup')).toBe(panel)
    expect(panel.classList.contains('wd-popup--bottom')).toBe(true)
    const harness = node(container, '.wd-popup-harness')
    expect(nativeStyle(harness)).toMatchObject({ position: 'fixed', top: '0px', left: '0px' })
    expect(harness.firstElementChild?.classList.contains('wd-popup-spacer')).toBe(true)
    expect(lock.value).toBe(true)
    const picker = node(container, '.wd-picker-view')
    const minute = container.querySelectorAll('.wd-picker-view__column-content')[1]!
    fireEvent.touchstart(minute, { touches: [{ clientY: 100 }] })
    fireEvent.touchmove(minute, { touches: [{ clientY: 56 }] })
    fireEvent.touchend(minute, { touches: [], changedTouches: [{ clientY: 56 }] })
    await advance(300)
    expect(changes).toHaveBeenCalledWith({ value: '09:31' })
    expect(value.value).toBe('09:30')

    const actions = container.querySelectorAll('.wd-datetime-picker__action')
    if (channel === 'cancel') fireEvent.tap(actions[0]!)
    else if (channel === 'confirm') fireEvent.tap(actions[1]!)
    else if (channel === 'mask') fireEvent.tap(node(container, '.wd-overlay'))
    else visible.value = false
    await advance()
    expect(visible.value).toBe(false)
    expect(lock.value, '退场未结束仍需持有模态滚动锁').toBe(true)
    expect(nativeStyle(panel)).toMatchObject({ display: 'flex', overflow: '' })
    await advance(400)
    expectClosed(panel)
    expectClosed(node(container, '.wd-overlay'))
    expect(lock.value).toBe(false)
    expect(node(container, '.wd-picker-view')).toBe(picker)
    expect(value.value).toBe(channel === 'confirm' ? '09:31' : '09:30')

    // 关闭后保持同一原生节点并更新文字/样式，不让旧显隐状态被新内容绕过。
    title.value = '更新后的日期时间'
    zIndex.value = 88
    await advance()
    expectClosed(panel)
    expect(node(container, '.wd-datetime-picker__title').textContent).toContain(title.value)
    visible.value = true
    await advance(400)
    expect(nativeStyle(panel)).toMatchObject({ display: 'flex', overflow: '', 'z-index': '88' })
    const selected = [...container.querySelectorAll('.wd-picker-view__column-item--active')].map((item) => item.textContent)
    expect(selected).toEqual(['09', channel === 'confirm' ? '31' : '30'])
    expect(container.querySelectorAll('.wd-datetime-picker__title')).toHaveLength(1)
    expectNoUnclippedHiddenPaint()
  })
})

describe('Toast Loading 复用共享闭态裁剪', () => {
  it.each(['manual', 'timer'])('%s 关闭保留 Loading 子树但无未裁剪关闭帧，重开清除保护', async (mode) => {
    let toast!: ReturnType<typeof useToast>
    const opened = vi.fn()
    const closed = vi.fn()
    const lock = usePageScrollLock()
    const { container } = render({
      setup() {
        toast = useToast('hidden-paint-loading')
        return () => h(Toast, { selector: 'hidden-paint-loading' })
      }
    })
    await advance()
    const root = node(container, '.wd-toast').parentElement!
    expectClosed(root)
    toast.loading({ msg: '加载中', duration: mode === 'timer' ? 600 : 0, opened, closed })
    await advance(400)
    const loading = node(container, '.wd-loading')
    expect(opened).toHaveBeenCalledTimes(1)
    expect(nativeStyle(root)).toMatchObject({ position: 'fixed', display: 'flex', overflow: '' })
    expect(lock.value).toBe(true)
    if (mode === 'manual') toast.close()
    else await advance(200)
    await advance()
    expect(nativeStyle(root)).toMatchObject({ display: 'flex', overflow: '' })
    expect(lock.value).toBe(true)
    await advance(400)
    expectClosed(root)
    expectClosed(node(container, '.wd-overlay'))
    expect(node(container, '.wd-loading')).toBe(loading)
    expect(root.textContent).toContain('加载中')
    expect(closed).toHaveBeenCalledTimes(1)
    expect(lock.value).toBe(false)
    toast.loading({ msg: '再次加载', duration: 0 })
    await advance(400)
    expect(nativeStyle(root)).toMatchObject({ display: 'flex', overflow: '', 'overflow-x': '', 'overflow-y': '' })
    expect(node(container, '.wd-loading')).toBe(loading)
    expect(root.textContent).toContain('再次加载')
    expectNoUnclippedHiddenPaint()
  })
})

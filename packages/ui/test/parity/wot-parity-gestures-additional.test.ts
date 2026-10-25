import { afterEach, describe, expect, it } from 'vitest'
import { h, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'
import Fab from '../../src/components/wd-fab/wd-fab.vue'
import SwipeAction from '../../src/components/wd-swipe-action/wd-swipe-action.vue'

// These tests execute the repository's declarative MTS shim + BG event pipeline.
// Geometry is stubbed: this is NOT native layout/scroll arbitration verification.
const restores: Array<() => void> = []
afterEach(() => {
  cleanup()
  while (restores.length) restores.pop()!()
})
const style = (el: Element) => el.getAttribute('style') || ''
function rect(left = 0, top = 0, width = 60, height = 60) {
  return { id: '', left, top, width, height, right: left + width, bottom: top + height }
}
function rectFromStyle(el: Element, width = 60, height = 60) {
  const text = style(el)
  return rect(Number(/(?:^|;)\s*left:\s*(-?[\d.]+)px/.exec(text)?.[1] || 0), Number(/(?:^|;)\s*top:\s*(-?[\d.]+)px/.exec(text)?.[1] || 0), width, height)
}
function installQuery(resolve: (selector: string, params: any) => void) {
  const env = (globalThis as any).lynxTestingEnv
  const bg = env.backgroundThread.globalThis.lynx
  const original = bg.createSelectorQuery
  bg.createSelectorQuery = () => ({
    select: (selector: string) => ({ invoke: (params: any) => { resolve(selector, params); return { exec() {} } } })
  })
  restores.push(() => { bg.createSelectorQuery = original })
}
function installMainRect(resolve: (el: Element) => any) {
  const previous = (globalThis as any).__wdRectStub
  ;(globalThis as any).__wdRectStub = resolve
  restores.push(() => {
    if (previous === undefined) delete (globalThis as any).__wdRectStub
    else (globalThis as any).__wdRectStub = previous
  })
}
function mount(component: any, values: Record<string, any> = {}, slots?: any) {
  const props = ref(values)
  const exposed = ref<any>()
  const result = render({ setup: () => () => h(component, { ...props.value, ref: exposed }, slots) } as any)
  return { ...result, props, exposed }
}
function swipeParts(container: Element) {
  return { root: container.querySelector('.wd-swipe-action')!, wrapper: container.querySelector('.wd-swipe-action__wrapper')! }
}
async function swipeStart(root: Element, wrapper: Element, x = 200, y = 100) {
  fireEvent.touchstart(wrapper, { touches: [{ clientX: x, clientY: y }] })
  fireEvent.touchstart(root, { touches: [{ clientX: x, clientY: y }] })
  await pause(15)
}
function fabParts(container: Element) {
  return { root: container.querySelector('.wd-fab')!, trigger: container.querySelector('[class^="wd-fab-trigger-"]')! }
}
function fabRects(holder: { container: Element }, width = 60, height = 60) {
  installQuery((_selector, params) => params.success(rectFromStyle(holder.container.querySelector('.wd-fab')!, width, height)))
  installMainRect((el) => rectFromStyle(el, width, height))
}

// Official 2.3.2 contracts: props/types/.vue/index.scss were inspected for both.
describe('official 2.3.2 swipe-action applied contracts', () => {
  const slots = { left: () => h('text', { class: 'left-action' }, 'left'), right: () => h('text', { class: 'right-action' }, 'right'), default: () => h('text', { class: 'content' }, 'content') }
  it('initial model, all slots/custom style, expose close reason/position and veto/allow are applied', async () => {
    installQuery((selector, params) => params.success(rect(0, 0, selector.endsWith('__left') ? 80 : 60, 44)))
    const calls: any[] = [], updates: string[] = []
    let allow = false
    const holder = mount(SwipeAction, { modelValue: 'right', customClass: 'custom-swipe', customStyle: 'margin-top: 7px', beforeClose: (reason: any, position: any) => { calls.push([reason, position]); return allow }, 'onUpdate:modelValue': (v: string) => updates.push(v) }, slots)
    await pause(60)
    const { root, wrapper } = swipeParts(holder.container)
    expect(root.classList.contains('custom-swipe')).toBe(true)
    expect(style(root)).toContain('margin-top: 7px')
    expect(holder.container.querySelectorAll('.left-action,.right-action,.content')).toHaveLength(3)
    expect(style(wrapper)).toContain('translateX(-60px)')
    holder.exposed.value.close('click', 'right')
    await pause(15)
    expect(calls).toEqual([['click', 'right']])
    expect(style(wrapper)).toContain('translateX(-60px)')
    allow = true
    holder.exposed.value.close('value', 'right')
    await pause(20)
    expect(calls[1]).toEqual(['value', 'right'])
    expect(updates).toEqual(['close'])
    expect(style(wrapper)).toContain('translateX(0px)')
  })
  it('action/content taps preserve click payload, interceptor reason and raw tap forwarding', async () => {
    installQuery((selector, params) => params.success(rect(0, 0, selector.endsWith('__left') ? 80 : 60, 44)))
    const clicks: any[] = [], taps: any[] = [], calls: any[] = []
    const holder = mount(SwipeAction, { modelValue: 'left', beforeClose: (r: any, p: any) => { calls.push([r, p]); return true }, onClick: (v: any) => clicks.push(v), onTap: (v: any) => taps.push(v) }, slots)
    await pause(50)
    fireEvent.tap(holder.container.querySelector('.wd-swipe-action__left')!)
    await pause(20)
    expect(clicks).toEqual([{ value: 'left' }])
    expect(calls).toEqual([['click', 'left']])
    holder.props.value.modelValue = 'right'
    await pause(40)
    const { root } = swipeParts(holder.container)
    fireEvent.tap(root)
    await pause(20)
    expect(clicks[1]).toEqual({ value: 'inside' })
    expect(taps).toHaveLength(1)
    fireEvent.tap(root)
    await pause(10)
    expect(clicks).toHaveLength(2)
  })
  it('layout/config refresh widths, programmatic opening uses the latest cache, and moves do not query', async () => {
    let widths = [80, 60], queries = 0
    installQuery((selector, params) => { queries++; params.success(rect(0, 0, widths[selector.endsWith('__left') ? 0 : 1], 44)) })
    const updates: string[] = []
    const holder = mount(SwipeAction, { modelValue: 'right', 'onUpdate:modelValue': (v: string) => updates.push(v) }, slots)
    await pause(50)
    const { root, wrapper } = swipeParts(holder.container)
    widths = [100, 120]
    fireEvent.layoutchange(holder.container.querySelector('.wd-swipe-action__right')!)
    await pause(40)
    expect(wrapper.getAttribute('right-width')).toBe('120')
    expect(style(wrapper)).toContain('translateX(-120px)')
    holder.props.value.modelValue = 'left'
    await pause(40)
    expect(style(wrapper)).toContain('translateX(100px)')
    await swipeStart(root, wrapper)
    const before = queries
    for (let x = 199; x > 160; x--) fireEvent.touchmove(root, { touches: [{ clientX: x, clientY: 100 }] })
    await pause(15)
    expect(queries).toBe(before)
    expect(style(wrapper)).toContain('transition: none')
    fireEvent.touchend(wrapper, { touches: [], changedTouches: [{ clientX: 195, clientY: 100 }] })
    await pause(25)
    expect(updates.at(-1)).toBe('left')
    expect(style(wrapper)).toContain('translateX(100px)')
    expect(style(wrapper)).toContain('transition: transform')
  })
  it('disabled changes cancel active worklets, restore committed position and can re-enable', async () => {
    installQuery((_selector, params) => params.success(rect(0, 0, 80, 44)))
    const updates: string[] = []
    const holder = mount(SwipeAction, { modelValue: 'close', 'onUpdate:modelValue': (v: string) => updates.push(v) }, slots)
    await pause(50)
    const { root, wrapper } = swipeParts(holder.container)
    await swipeStart(root, wrapper)
    fireEvent.touchmove(root, { touches: [{ clientX: 150, clientY: 100 }] })
    expect(style(wrapper)).toContain('translateX(-50px)')
    holder.props.value.disabled = true
    await pause(20)
    fireEvent.touchmove(root, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchend(wrapper, { touches: [], changedTouches: [{ clientX: 100, clientY: 100 }] })
    await pause(20)
    expect(style(wrapper)).toContain('translateX(0px)')
    expect(updates).toEqual([])
    holder.props.value.disabled = false
    await pause(30)
    await swipeStart(root, wrapper)
    fireEvent.touchmove(root, { touches: [{ clientX: 260, clientY: 100 }] })
    fireEvent.touchcancel(wrapper, { touches: [], changedTouches: [{ clientX: 260, clientY: 100 }] })
    fireEvent.touchcancel(root, { touches: [] })
    await pause(20)
    expect(updates.at(-1)).toBe('left')
    expect(style(wrapper)).toContain('translateX(80px)')
  })
  it('stale async close cannot close a newer gesture, and unmounted query/close callbacks are ignored', async () => {
    const pending: Array<() => void> = []
    installQuery((_selector, params) => params.success(rect(0, 0, 80, 44)))
    const updates: string[] = []
    const holder = mount(SwipeAction, { modelValue: 'right', beforeClose: () => new Promise<boolean>((resolve) => pending.push(() => resolve(true))), 'onUpdate:modelValue': (v: string) => updates.push(v) }, slots)
    await pause(45)
    holder.exposed.value.close('value', 'right')
    const { root, wrapper } = swipeParts(holder.container)
    await swipeStart(root, wrapper)
    pending.shift()!()
    await pause(20)
    expect(updates).toEqual([])
    expect(style(wrapper)).toContain('translateX(-80px)')
    holder.exposed.value.close('click', 'right')
    holder.unmount()
    pending.shift()!()
    await pause(20)
    expect(updates).toEqual([])
  })
})

describe('official 2.3.2 fab applied contracts and geometry lifecycle', () => {
  it('all eight positions and live gap use measured 60px trigger geometry', async () => {
    const holder = mount(Fab, { draggable: false })
    fabRects(holder)
    await pause(80)
    const { root } = fabParts(holder.container)
    const positions: Record<string, [number, number]> = {
      'left-top': [16, 16], 'right-top': [314, 16], 'left-bottom': [16, 768], 'right-bottom': [314, 768],
      'left-center': [16, 392], 'right-center': [314, 392], 'top-center': [165, 16], 'bottom-center': [165, 768]
    }
    for (const [position, [x, y]] of Object.entries(positions)) {
      holder.props.value.position = position
      await pause(20)
      expect(style(root)).toContain(`left: ${x}px`)
      expect(style(root)).toContain(`top: ${y}px`)
    }
    holder.props.value.gap = { top: 30, left: 40, right: 20, bottom: 50 }
    holder.props.value.position = 'right-bottom'
    await pause(35)
    // 边界随 gap 收敛：maxLeft = 390-60-20 = 310、maxTop = 844-60-50 = 734
    //（2026-10-25 真机巡检后 MT 边界元素属性已随 worklet 拖拽一并移除，
    //  以落位坐标断言边界）
    expect(style(root)).toContain('left: 310px')
    expect(style(root)).toContain('top: 734px')
  })
  it('live draggable false→true→false, cached clamp and touchcancel restore snap/direction', async () => {
    const events: string[] = []
    const holder = mount(Fab, { draggable: false, onTouchcancel: () => events.push('cancel'), onTouchend: () => events.push('end') })
    fabRects(holder)
    await pause(80)
    const { root, trigger } = fabParts(holder.container)
    fireEvent.touchstart(trigger, { touches: [{ clientX: 344, clientY: 798 }] })
    fireEvent.touchmove(root, { touches: [{ clientX: 144, clientY: 400 }] })
    expect(style(root)).toContain('left: 314px')
    holder.props.value.draggable = true
    await pause(20)
    fireEvent.touchstart(root, { touches: [{ clientX: 344, clientY: 798 }] })
    await pause(10)
    fireEvent.touchmove(root, { touches: [{ clientX: 144, clientY: 400 }] })
    await pause(10)
    expect(style(root)).toContain('left: 114px')
    expect(style(root)).toContain('top: 370px')
    fireEvent.touchcancel(root, { touches: [], changedTouches: [{ clientX: 144, clientY: 400 }] })
    await pause(25)
    expect(events).toEqual(['cancel'])
    expect(style(root)).toContain('left: 16px')
    expect(style(root)).toContain('top: 370px')
    expect(style(root)).toContain('transition: all ease 0.3s')
    expect(holder.container.querySelector('.wd-fab__actions--right')).not.toBeNull()
    holder.props.value.draggable = false
    await pause(20)
    fireEvent.touchstart(root, { touches: [{ clientX: 344, clientY: 798 }] })
    fireEvent.touchmove(root, { touches: [{ clientX: 344, clientY: 798 }] })
    expect(style(root)).toContain('left: 16px')
  })
  it('background drag follows touch deltas; touchcancel stops tracking and later moves are ignored', async () => {
    const holder = mount(Fab, { draggable: true, position: 'left-top' })
    fabRects(holder)
    await pause(80)
    const { root } = fabParts(holder.container)
    // 起点记 (46,46)，跟手到 (100,110)：left = 16+54 = 70、top = 16+64 = 80
    fireEvent.touchstart(root, { touches: [{ clientX: 46, clientY: 46 }] })
    fireEvent.touchmove(root, { touches: [{ clientX: 100, clientY: 110 }] })
    await pause(10)
    expect(style(root)).toContain('left: 70px')
    expect(style(root)).toContain('top: 80px')
    // 新手势重新以当前落位为起点：起点 (56,56)，跟手到 (110,110) → +54/+54
    fireEvent.touchstart(root, { touches: [{ clientX: 56, clientY: 56 }] })
    fireEvent.touchmove(root, { touches: [{ clientX: 110, clientY: 110 }] })
    await pause(10)
    expect(style(root)).toContain('left: 124px')
    expect(style(root)).toContain('top: 134px')
    // 取消即落定：吸附最近侧边（中心 154 < 195 → 左侧 16px，纵向保持跟手值），
    // 之后未再 touchstart 的 touchmove 不得改位置
    fireEvent.touchcancel(root, { touches: [] })
    await pause(25)
    expect(style(root)).toContain('left: 16px')
    expect(style(root)).toContain('top: 134px')
    fireEvent.touchmove(root, { touches: [{ clientX: 300, clientY: 300 }] })
    await pause(10)
    expect(style(root)).toContain('left: 16px')
  })
  it('late end query is invalidated by newer start/config changes and by unmount', async () => {
    const holder = mount(Fab, { draggable: true, position: 'left-top' })
    fabRects(holder)
    await pause(80)
    const { root } = fabParts(holder.container)
    const pending: any[] = []
    installQuery((_selector, params) => pending.push(params))
    fireEvent.touchend(root, { touches: [] })
    fireEvent.touchstart(root, { touches: [{ clientX: 46, clientY: 46 }] })
    pending.shift().success(rect(300, 500))
    await pause(15)
    expect(style(root)).toContain('left: 16px')
    expect(style(root)).toContain('top: 16px')
    fireEvent.touchend(root, { touches: [] })
    holder.unmount()
    pending.shift().success(rect(300, 500))
    await pause(15)
    expect(holder.container.querySelector('.wd-fab')).toBeNull()
  })
  it('active/type/disabled/icon/direction/expandable props, trigger slot scope and expose apply', async () => {
    const active: boolean[] = [], clicks: number[] = []
    const holder = mount(Fab, { active: true, type: 'danger', inactiveIcon: 'plus', activeIcon: 'close', direction: 'left', customClass: 'custom-fab', customStyle: 'margin-top: 4px', zIndex: 1234, 'onUpdate:active': (v: boolean) => active.push(v), onClick: () => clicks.push(1) }, { default: () => h('text', { class: 'fab-action' }, 'action') })
    fabRects(holder)
    await pause(80)
    const { root } = fabParts(holder.container)
    expect(root.classList.contains('custom-fab')).toBe(true)
    expect(style(root)).toContain('z-index: 1234')
    expect(style(root)).toContain('margin-top: 4px')
    expect(holder.container.querySelector('.fab-action')).not.toBeNull()
    expect(holder.container.querySelector('.wd-fab__actions--left')).not.toBeNull()
    const button = holder.container.querySelector('.wd-fab__trigger')!
    expect(button.className).toContain('is-danger')
    holder.exposed.value.close()
    holder.exposed.value.open()
    await pause(20)
    expect(active).toEqual([false, true])
    holder.props.value.disabled = true
    await pause(20)
    fireEvent.tap(button)
    await pause(10)
    expect(active).toEqual([false, true])
    holder.props.value.disabled = false
    holder.props.value.expandable = false
    await pause(20)
    fireEvent.tap(button)
    await pause(10)
    expect(clicks).toEqual([1])
    const scoped = mount(Fab, { disabled: true }, { trigger: ({ disabled }: any) => h('text', { class: 'scoped-trigger' }, String(disabled)) })
    fabRects(scoped)
    await pause(60)
    expect(scoped.container.querySelector('.scoped-trigger')!.textContent).toBe('true')
  })
})

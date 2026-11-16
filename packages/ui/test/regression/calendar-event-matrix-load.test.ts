import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue-lynx'
import Calendar from '@wot-lynx/ui-picker/wd-calendar'
import CalendarView from '@wot-lynx/ui-picker/wd-calendar-view'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'

const EVENTS = ['tap','longtap','longpress','touchstart','touchmove','touchend','touchcancel','transitionend','animationend','scroll','scrollend','focus','blur','input','confirm','layoutchange'] as const
const touch = { touches: [{ clientX: 10, clientY: 10 }] }
afterEach(cleanup)
function mount(component: any, props: Record<string, unknown>) {
  const listeners = Object.fromEntries(EVENTS.map(name => [`on${name[0]!.toUpperCase()}${name.slice(1)}`, () => {}]))
  const mounted = render({ setup: () => () => h(component, { ...props, ...listeners, modelValue: props.modelValue }, { default: () => h('view', null, [h('text', 'x')]) }) } as any)
  const events = new Set<string>()
  const fail = new Set<string>()
  const registry = (globalThis as any).__VUE_LYNX_EVENT_REGISTRY__
  const before = registry ? new Set(registry.handlers.keys() as Iterable<string>) : new Set<string>()
  for (const node of [...mounted.container.querySelectorAll('*')]) {
    // Every event is delivered to at least one real node, and every node receives tap.
    let tapFailed = false
    try { fireEvent.tap(node) } catch (error) { tapFailed = true; fail.add(`tap:${(error as Error).message}`) }
    events.add('tap')
    expect(tapFailed).toBe(false)
  }
  const target = mounted.container.querySelector('.wd-calendar, .wd-calendar-view') || mounted.container.firstElementChild!
  for (const event of EVENTS.slice(1)) {
    try { (fireEvent as any)[event](target, event.startsWith('touch') ? touch : undefined) }
    catch (error) { fail.add(`${event}:${(error as Error).message}`) }
    events.add(event)
  }
  expect([...events].sort()).toEqual([...EVENTS].sort())
  expect([...fail]).toEqual([])
  const current = (globalThis as any).__VUE_LYNX_EVENT_REGISTRY__
  if (current) for (const [sign, handler] of current.handlers as Map<string, unknown>) {
    if (before.has(sign) || !Array.isArray(handler)) continue
    expect(() => (globalThis as any).publishEvent(sign, {}), 'newly registered native event listeners must be callable').not.toThrow()
  }
  return mounted
}

describe('Calendar event-matrix load is bounded without event or element gaps', () => {
  it('dispatches every native event type and tap to every real day node in a bounded view', () => {
    const mounted = mount(CalendarView, { type: 'date', modelValue: Date.UTC(2024, 0, 15), minDate: Date.UTC(2024, 0, 1), maxDate: Date.UTC(2024, 0, 31) })
    const dayNodes = mounted.container.querySelectorAll('.wd-month__day:not(.wd-month__day--empty)')
    expect(dayNodes.length).toBeGreaterThan(0)
  })
  it('dispatches every native event type and tap to every real Calendar tree node', () => {
    const mounted = mount(Calendar, { modelValue: Date.UTC(2024, 0, 15), visible: true, minDate: Date.UTC(2024, 0, 1), maxDate: Date.UTC(2024, 1, 1) })
    expect(mounted.container.querySelectorAll('*').length).toBeGreaterThan(30)
  })
})

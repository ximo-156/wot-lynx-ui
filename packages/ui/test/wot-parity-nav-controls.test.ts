import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile } from 'sass'
import postcss from 'postcss'
import { Fragment, h, ref } from 'vue-lynx'
import { cleanup, render } from './render'
import { fireEvent } from './fire-event'
import { pause } from '../src/common/util'
import { configureUniAdapter, getUniAdapter } from '../src/common/uniAdapter'
import { useDeviceInfo } from '../src/composables/useDeviceInfo'
import Tabs from '../src/components/wd-tabs/wd-tabs.vue'
import Tab from '../src/components/wd-tab/wd-tab.vue'
import Tabbar from '../src/components/wd-tabbar/wd-tabbar.vue'
import TabbarItem from '../src/components/wd-tabbar-item/wd-tabbar-item.vue'
import Sidebar from '../src/components/wd-sidebar/wd-sidebar.vue'
import SidebarItem from '../src/components/wd-sidebar-item/wd-sidebar-item.vue'
import Steps from '../src/components/wd-steps/wd-steps.vue'
import Step from '../src/components/wd-step/wd-step.vue'
import Navbar from '../src/components/wd-navbar/wd-navbar.vue'
import NavbarCapsule from '../src/components/wd-navbar-capsule/wd-navbar-capsule.vue'
import Pagination from '../src/components/wd-pagination/wd-pagination.vue'
import Collapse from '../src/components/wd-collapse/wd-collapse.vue'
import CollapseItem from '../src/components/wd-collapse-item/wd-collapse-item.vue'
import DropMenu from '../src/components/wd-drop-menu/wd-drop-menu.vue'
import DropMenuItem from '../src/components/wd-drop-menu-item/wd-drop-menu-item.vue'
import SortButton from '../src/components/wd-sort-button/wd-sort-button.vue'
import { tabsProps as officialTabs } from '../../../.wot-ref/src-2.3.2/components/wd-tabs/types'
import { tabProps as officialTab } from '../../../.wot-ref/src-2.3.2/components/wd-tab/types'
import { tabbarProps as officialTabbar } from '../../../.wot-ref/src-2.3.2/components/wd-tabbar/types'
import { tabbarItemProps as officialTabbarItem } from '../../../.wot-ref/src-2.3.2/components/wd-tabbar-item/types'
import { sidebarProps as officialSidebar } from '../../../.wot-ref/src-2.3.2/components/wd-sidebar/types'
import { sidebarItemProps as officialSidebarItem } from '../../../.wot-ref/src-2.3.2/components/wd-sidebar-item/types'
import { stepsProps as officialSteps } from '../../../.wot-ref/src-2.3.2/components/wd-steps/types'
import { stepProps as officialStep } from '../../../.wot-ref/src-2.3.2/components/wd-step/types'
import { navbarProps as officialNavbar } from '../../../.wot-ref/src-2.3.2/components/wd-navbar/types'
import { navbarCapsuleProps as officialCapsule } from '../../../.wot-ref/src-2.3.2/components/wd-navbar-capsule/types'
import { paginationProps as officialPagination } from '../../../.wot-ref/src-2.3.2/components/wd-pagination/types'
import { collapseProps as officialCollapse } from '../../../.wot-ref/src-2.3.2/components/wd-collapse/types'
import { collapseItemProps as officialCollapseItem } from '../../../.wot-ref/src-2.3.2/components/wd-collapse-item/types'
import { dropMenuProps as officialDropMenu } from '../../../.wot-ref/src-2.3.2/components/wd-drop-menu/types'
import { dorpMenuItemProps as officialDropItem } from '../../../.wot-ref/src-2.3.2/components/wd-drop-menu-item/types'
import { sortButtonProps as officialSort } from '../../../.wot-ref/src-2.3.2/components/wd-sort-button/types'
import { compRead } from './helpers/component-roots'

// Compare the actual reference, not an API fixture or theme preset. Numeric tab
// names and reactive pagination totals intentionally retain established fixes.
const COMPONENTS = [
  ['wd-tabs', Tabs, officialTabs], ['wd-tab', Tab, officialTab],
  ['wd-tabbar', Tabbar, officialTabbar], ['wd-tabbar-item', TabbarItem, officialTabbarItem],
  ['wd-sidebar', Sidebar, officialSidebar], ['wd-sidebar-item', SidebarItem, officialSidebarItem],
  ['wd-steps', Steps, officialSteps], ['wd-step', Step, officialStep],
  ['wd-navbar', Navbar, officialNavbar], ['wd-navbar-capsule', NavbarCapsule, officialCapsule],
  ['wd-pagination', Pagination, officialPagination], ['wd-collapse', Collapse, officialCollapse],
  ['wd-collapse-item', CollapseItem, officialCollapseItem], ['wd-drop-menu', DropMenu, officialDropMenu],
  ['wd-drop-menu-item', DropMenuItem, officialDropItem], ['wd-sort-button', SortButton, officialSort]
] as const
const restores: Array<() => void> = []
afterEach(() => {
  cleanup()
  restores.splice(0).forEach((restore) => restore())
  vi.restoreAllMocks()
  vi.useRealTimers()
})
async function frames(count = 3) { for (let i = 0; i < count; i++) await pause() }
function node(container: Element, selector: string) { return container.querySelector(selector) as HTMLElement }
function renderExposed(component: any, props: any = {}, slots?: any) {
  const exposed = ref<any>()
  return { ...render({ setup: () => () => h(component, { ...props, ref: exposed }, slots) } as any), exposed }
}
const RECT = { left: 0, top: 20, right: 300, bottom: 64, width: 300, height: 44 }
function mockRects(rectFor: (selector: string, all: boolean) => any = (_, all) => all ? [0, 1, 2].map((i) => ({ ...RECT, left: i * 100, width: 100 })) : RECT) {
  const lynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const original = lynx.createSelectorQuery
  const pending: Array<{ selector: string; all: boolean; deliver: (rect?: any) => void }> = []
  let delayed = false
  const select = (selector: string, all: boolean) => ({
    invoke(options: any) {
      const deliver = (rect = rectFor(selector, all)) => options.success?.(rect)
      if (delayed) pending.push({ selector, all, deliver }); else deliver()
      return { exec() {} }
    }
  })
  lynx.createSelectorQuery = () => ({ select: (s: string) => select(s, false), selectAll: (s: string) => select(s, true) })
  restores.push(() => { lynx.createSelectorQuery = original })
  return { pending, delay() { delayed = true } }
}
function propContract(definition: any) {
  const prop = definition && typeof definition === 'object' && !Array.isArray(definition) ? definition : { type: definition }
  const type = Array.isArray(prop.type) ? prop.type : [prop.type]
  return {
    types: type.map((ctor: any) => ctor?.name ?? null).sort(), required: Boolean(prop.required),
    default: typeof prop.default === 'function' && prop.type !== Function ? prop.default() : prop.default
  }
}

describe('navigation controls: official public props', () => {
  it.each(COMPONENTS)('%s preserves names, constructors, required flags and defaults', (_, component, official) => {
    const local = (component as any).props
    expect(Object.keys(local).sort()).toEqual(Object.keys(official).sort())
    for (const key of Object.keys(official)) {
      const expected = propContract((official as any)[key]), actual = propContract(local[key])
      // Object customStyle is the deliberate Lynx extension to the string API.
      if (key === 'customStyle') { expect(actual.default).toEqual(expected.default); continue }
      expect(actual, key).toEqual(expected)
    }
  })
})

describe('tabs and panels', () => {
  it('ignores unrelated titled nodes while flattening tabs; numeric names retain the compatibility fix', async () => {
    const value = ref<string | number>(20), clicks: any[] = [], disabled: any[] = [], changes: any[] = []
    const { container } = render({ setup: () => () => h(Tabs, {
      modelValue: value.value, onClick: (d: any) => clicks.push(d), onDisabled: (d: any) => disabled.push(d), onChange: (d: any) => changes.push(d),
      'onUpdate:modelValue': (v: any) => { value.value = v }
    }, { default: () => [h('view', { title: 'not a tab' }), h(Fragment, null, [
      h(Tab, { name: 10, title: 'one' }, () => h('text', 'first panel')),
      h(Tab, { name: 20, title: 'two' }, () => h('text', 'second panel')),
      h(Tab, { name: 30, title: 'three', disabled: '' })
    ])] }) } as any)
    await frames()
    const items = container.querySelectorAll('.wd-tabs__nav-item')
    expect(items).toHaveLength(3)
    expect(items[1].classList.contains('is-active')).toBe(true)
    fireEvent.tap(items[2]); fireEvent.tap(items[1])
    expect(disabled).toEqual([{ index: 2, name: 30 }]); expect(clicks).toEqual([{ index: 1, name: 20 }]); expect(changes).toEqual([])
    fireEvent.tap(items[0]); await pause(120); await frames()
    expect(value.value).toBe(10); expect(changes).toEqual([{ index: 0, name: 10 }]); expect(clicks.at(-1)).toEqual({ index: 0, name: 10 })
  })

  it('retains lazy panels after painting and restores flex layout when reactivated', async () => {
    const value = ref('a')
    const { container } = render({ setup: () => () => h(Tabs, { modelValue: value.value }, () => [
      h(Tab, { name: 'a', title: 'a' }, () => h('text', { class: 'panel-a' }, 'a')),
      h(Tab, { name: 'b', title: 'b' }, () => h('text', { class: 'panel-b' }, 'b')),
      h(Tab, { name: 'c', title: 'c', lazy: false }, () => h('text', { class: 'panel-c' }, 'c'))
    ]) } as any)
    await frames()
    expect(node(container, '.panel-a')).not.toBeNull(); expect(node(container, '.panel-b')).toBeNull(); expect(node(container, '.panel-c')).not.toBeNull()
    value.value = 'b'; await pause(120); await frames()
    expect(node(container, '.panel-b')).not.toBeNull(); expect(node(container, '.panel-a').parentElement!.style.display).toBe('none')
    value.value = 'a'; await pause(120); await frames()
    expect(node(container, '.panel-a').parentElement!.style.display).toBe('flex'); expect(node(container, '.panel-b')).not.toBeNull()
  })

  it('exposes setActive/scrollIntoView/updateLineStyle and reacts to line props without overriding theme dimensions', async () => {
    mockRects()
    const theme = ref('dot'), width = ref<number | undefined>(), height = ref<number | undefined>(), exposed = ref<any>()
    const { container } = render({ setup: () => () => h(Tabs, { ref: exposed, modelValue: 'a', lineTheme: theme.value, lineWidth: width.value, lineHeight: height.value }, () => [
      h(Tab, { name: 'a', title: 'A' }), h(Tab, { name: 'b', title: 'B' })
    ]) } as any)
    await frames()
    for (const name of ['setActive', 'scrollIntoView', 'updateLineStyle']) expect(exposed.value[name]).toBeTypeOf('function')
    const line = () => node(container, '.wd-tabs__nav-container > .wd-tabs__line')
    expect(line().style.width).toBe(''); expect(line().style.height).toBe('')
    width.value = 17; height.value = 3; await frames()
    expect(line().style.width).toBe('17px'); expect(line().style.height).toBe('3px')
    theme.value = 'underline'; width.value = undefined; height.value = undefined; await frames()
    expect(line().style.width).toBe('100px'); expect(line().style.height).toBe('')
    exposed.value.setActive('b', false, false); await frames()
    expect(container.querySelectorAll('.wd-tabs__nav-item')[1].classList.contains('is-active')).toBe(true)
  })

  it('clears active/inactive color and map border overrides on prop removal', async () => {
    const color = ref('rgb(1, 2, 3)'), inactive = ref('rgb(4, 5, 6)')
    const { container } = render({ setup: () => () => h(Tabs, { modelValue: 'a', color: color.value, inactiveColor: inactive.value, mapNum: 1 }, () => [h(Tab, { name: 'a', title: 'a' }), h(Tab, { name: 'b', title: 'b' })]) } as any)
    await frames()
    const items = container.querySelectorAll('.wd-tabs__nav-item') as NodeListOf<HTMLElement>
    expect(items[0].style.color).toBe('rgb(1, 2, 3)'); expect(items[1].style.color).toBe('rgb(4, 5, 6)')
    color.value = ''; inactive.value = ''; await frames()
    expect(items[0].style.color).toBe(''); expect(items[1].style.color).toBe(''); expect(node(container, '.wd-tabs__map-nav-btn').style.borderColor).toBe('')
  })

  it('discards stale text line measurements and scopes selectors to each instance', async () => {
    const rects = mockRects(), first = ref<any>(), second = ref<any>()
    const { container } = render({ setup: () => () => h('view', null, [first, second].map((exposed) => h(Tabs, { ref: exposed, modelValue: 0, lineTheme: 'text' }, () => [h(Tab, { title: 'a' }), h(Tab, { title: 'b' })]))) } as any)
    await frames(); rects.delay()
    const older = first.value.updateLineStyle(), newer = first.value.updateLineStyle()
    second.value.updateLineStyle()
    expect(rects.pending).toHaveLength(6); expect(rects.pending[0].selector).not.toBe(rects.pending[4].selector)
    rects.pending[2].deliver([{ ...RECT, width: 100 }]); rects.pending[3].deliver([{ ...RECT, width: 55 }]); await newer; await frames(1)
    rects.pending[0].deliver([{ ...RECT, width: 100 }]); rects.pending[1].deliver([{ ...RECT, width: 12 }])
    rects.pending[4].deliver([{ ...RECT, width: 100 }]); rects.pending[5].deliver([{ ...RECT, width: 20 }])
    await older; await frames()
    expect(node(container, '.wd-tabs__nav-container > .wd-tabs__line').style.width).toBe('55px')
  })

  it('reacts to child removal without mismatching header and painted panel', async () => {
    const names = ref(['a', 'b', 'c'])
    const { container } = render({ setup: () => () => h(Tabs, { modelValue: 'c' }, () => names.value.map((name) => h(Tab, { key: name, name, title: name }, () => h('text', { class: `panel-${name}` }, name)))) } as any)
    await frames(); names.value = ['b', 'c']; await pause(120); await frames()
    const items = container.querySelectorAll('.wd-tabs__nav-item')
    expect(items).toHaveLength(2); expect(items[1].classList.contains('is-active')).toBe(true)
    expect(node(container, '.panel-c').parentElement!.style.display).toBe('flex')
  })

  it('map close cancels its earlier open animation; gesture flags stay reactive', async () => {
    vi.useFakeTimers()
    const swipe = ref(false), animated = ref(false)
    const { container } = render({ setup: () => () => h(Tabs, { modelValue: 0, mapNum: 1, swipeable: swipe.value, animated: animated.value }, () => [h(Tab, { title: 'a' }), h(Tab, { title: 'b' })]) } as any)
    await vi.advanceTimersByTimeAsync(2)
    fireEvent.tap(node(container, '.wd-tabs__map-btn')); fireEvent.tap(node(container, '.wd-tabs__mask'))
    await vi.advanceTimersByTimeAsync(110); expect(node(container, '.wd-tabs__map-arrow').classList.contains('is-open')).toBe(false)
    await vi.advanceTimersByTimeAsync(220); expect(node(container, '.wd-tabs__map-body').style.display).toBe('none')
    swipe.value = true; animated.value = true; await vi.advanceTimersByTimeAsync(2)
    const body = node(container, '.wd-tabs__body')
    expect(body.getAttribute('swipeable')).toBe('true'); expect(body.getAttribute('animated')).toBe('true')
  })
})

describe('tabbar and sidebar selection contracts', () => {
  it('sidebar intercepts and emits even when the active item is selected again', async () => {
    const hook = vi.fn(() => true), changes: any[] = [], updates: any[] = []
    const { container } = render({ setup: () => () => h(Sidebar, { modelValue: 'a', beforeChange: hook, onChange: (d: any) => changes.push(d), 'onUpdate:modelValue': (v: any) => updates.push(v) }, () => h(SidebarItem, { value: 'a', label: 'A' })) } as any)
    await frames(1); fireEvent.tap(node(container, '.wd-sidebar-item'))
    expect(hook).toHaveBeenCalledExactlyOnceWith('a'); expect(updates).toEqual(['a']); expect(changes).toEqual([{ value: 'a', label: 'A' }])
  })

  it.each([['sidebar', Sidebar, SidebarItem, '.wd-sidebar-item'], ['tabbar', Tabbar, TabbarItem, '.wd-tabbar-item']])('%s stays controlled, accepts only the latest approval and ignores removed items', async (name, component, item, selector) => {
    const value = ref('a'), present = ref(true), hooks: Array<(v: boolean) => void> = [], updates: any[] = [], changes: any[] = []
    const { container } = render({ setup: () => () => h(component as any, { modelValue: value.value, beforeChange: () => new Promise<boolean>((r) => hooks.push(r)), onChange: (d: any) => changes.push(d), 'onUpdate:modelValue': (v: any) => updates.push(v) }, () => ['a', 'b', ...(present.value ? ['c'] : [])].map((v) => h(item as any, name === 'sidebar' ? { key: v, value: v, label: v } : { key: v, name: v, title: v }))) } as any)
    await frames(1)
    const items = container.querySelectorAll(selector)
    fireEvent.tap(items[1]); fireEvent.tap(items[2]); hooks[1](true); await frames(1); hooks[0](true); await frames(1)
    expect(updates).toEqual(['c']); expect(changes).toEqual(name === 'sidebar' ? [{ value: 'c', label: 'c' }] : [{ value: 'c' }])
    const activeSelector = name === 'sidebar' ? '.wd-sidebar-item--active' : '.wd-tabbar-item__body-title.is-active'
    expect(node(container, activeSelector).textContent).toBe('a')
    fireEvent.tap(items[2]); present.value = false; await frames(1); hooks[2](true); await frames(1); expect(updates).toEqual(['c'])
    value.value = 'b'; await frames(1); expect(node(container, activeSelector).textContent).toBe('b')
  })

  it.each([['sidebar', Sidebar, SidebarItem, '.wd-sidebar-item'], ['tabbar', Tabbar, TabbarItem, '.wd-tabbar-item']])('%s cancels pending hooks on external write, false, rejection and unmount', async (name, component, item, selector) => {
    const value = ref('a'), updates: any[] = [], hooks: Array<{ resolve(v: boolean): void; reject(e: any): void }> = []
    const beforeChange = () => new Promise<boolean>((resolve, reject) => hooks.push({ resolve, reject }))
    const result = render({ setup: () => () => h(component as any, { modelValue: value.value, beforeChange, 'onUpdate:modelValue': (v: any) => updates.push(v) }, () => ['a', 'b'].map((v) => h(item as any, name === 'sidebar' ? { value: v, label: v } : { name: v, title: v }))) } as any)
    await frames(1)
    const target = result.container.querySelectorAll(selector)[1]
    fireEvent.tap(target); value.value = 'b'; await frames(1); hooks[0].resolve(true); await frames(1); expect(updates).toEqual([])
    value.value = 'a'; await frames(1); fireEvent.tap(target); hooks[1].resolve(false); await frames(1)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fireEvent.tap(target); hooks[2].reject(new Error('denied')); await frames(1)
    fireEvent.tap(target); result.unmount(); hooks[3].resolve(true); await frames(1); expect(updates).toEqual([])
  })

  it('tabbar unnamed items use indices; icon scope and default slot priority match', async () => {
    const value = ref(0), changes: any[] = []
    const { container } = render({ setup: () => () => h(Tabbar, { modelValue: value.value, onChange: (d: any) => changes.push(d), 'onUpdate:modelValue': (v: any) => { value.value = v } }, () => [
      h(TabbarItem, { title: 'one', icon: 'home' }, { icon: ({ active }: any) => h('text', { class: 'slot-icon' }, active ? 'yes' : 'no') }), h(TabbarItem, { title: 'two' }),
      h(TabbarItem, { title: 'hidden' }, () => h('text', { class: 'custom-item' }, 'custom'))
    ]) } as any)
    await frames(1); expect(node(container, '.slot-icon').textContent).toBe('yes')
    fireEvent.tap(container.querySelectorAll('.wd-tabbar-item')[0]); expect(changes).toEqual([])
    fireEvent.tap(container.querySelectorAll('.wd-tabbar-item')[1]); await frames(1)
    expect(changes).toEqual([{ value: 1 }]); expect(node(container, '.slot-icon').textContent).toBe('no')
    expect(node(container, '.custom-item')).not.toBeNull(); expect(container.textContent).not.toContain('hidden')
  })

  it('sidebar disabled item has no events; neighbors and icon slot reflect selection', async () => {
    const hook = vi.fn(() => true), tapped = vi.fn()
    const { container } = render({ setup: () => () => h(Sidebar, { modelValue: 'b', beforeChange: hook }, () => [
      h(SidebarItem, { value: 'a', label: 'a' }), h(SidebarItem, { value: 'b', label: 'b', icon: 'home' }, { icon: () => h('text', { class: 'sidebar-icon' }, 'slot') }), h(SidebarItem, { value: 'c', label: 'c', disabled: true, onTap: tapped })
    ]) } as any)
    await frames(1)
    expect(node(container, '.wd-sidebar-item--prefix').textContent).toContain('a'); expect(node(container, '.wd-sidebar-item--suffix').textContent).toContain('c')
    expect(node(container, '.wd-sidebar-item__indicator')).not.toBeNull(); expect(node(container, '.sidebar-icon')).not.toBeNull(); expect(container.querySelectorAll('.wd-sidebar-item__icon')).toHaveLength(0)
    fireEvent.tap(container.querySelectorAll('.wd-sidebar-item')[2]); expect(hook).not.toHaveBeenCalled(); expect(tapped).not.toHaveBeenCalled()
  })

  it('tabbar restores CSS colors and refreshes placeholder after shape changes', async () => {
    let height = 50
    mockRects(() => ({ ...RECT, height }))
    const activeColor = ref('rgb(8, 9, 10)'), inactiveColor = ref('rgb(11, 12, 13)'), shape = ref('default')
    const { container } = render({ setup: () => () => h(Tabbar, { fixed: true, placeholder: true, activeColor: activeColor.value, inactiveColor: inactiveColor.value, shape: shape.value }, () => [h(TabbarItem, { title: 'a', icon: 'home' }), h(TabbarItem, { title: 'b' })]) } as any)
    await frames()
    const root = node(container, '.wd-tabbar')
    expect(root.parentElement!.style.height).toBe('50px')
    activeColor.value = ''; inactiveColor.value = ''; height = 61; shape.value = 'round'; await frames()
    expect(node(container, '.wd-tabbar-item__body-title').style.color).toBe(''); expect(node(container, '.wd-tabbar-item__body-icon').style.color).toBe('')
    expect(root.parentElement!.style.height).toBe('61px')
  })
})

describe('steps and step', () => {
  it('updates inferred/explicit statuses and dot/vertical/space without residual dimensions', async () => {
    const active = ref(1), vertical = ref(false), dot = ref(false), space = ref('120px')
    const { container } = render({ setup: () => () => h(Steps, { active: active.value, vertical: vertical.value, dot: dot.value, space: space.value, alignCenter: true }, () => [h(Step), h(Step), h(Step, { status: 'error', description: 'failed' })]) } as any)
    await frames(1)
    const steps = () => container.querySelectorAll('.wd-step') as NodeListOf<HTMLElement>
    expect(steps()[0].classList.contains('wd-step--finished')).toBe(true); expect(steps()[1].classList.contains('wd-step--process')).toBe(true); expect(steps()[2].classList.contains('wd-step--error')).toBe(true)
    expect(steps()[0].style.width).toBe('120px')
    active.value = 0; vertical.value = true; dot.value = true; space.value = '80px'; await frames(1)
    expect(steps()[0].classList.contains('is-center')).toBe(false); expect(steps()[0].style.width).toBe('auto'); expect(steps()[0].style.height).toBe('80px')
    expect(container.querySelectorAll('.wd-step__dot')).toHaveLength(3); expect(container.querySelectorAll('.wd-step__line')).toHaveLength(2)
    space.value = ''; await frames(1); expect(steps()[0].style.height).toBe('auto')
    vertical.value = false; await frames(1); expect(steps()[0].style.width).toBe('33.333333333333336%')
  })

  it('standalone step defaults to wait; all named slots override fallback', () => {
    const standalone = render(Step, { title: 'fallback', icon: 'home' }); expect(node(standalone.container, '.wd-step').classList.contains('wd-step--wait')).toBe(true)
    cleanup()
    const { container } = render({ setup: () => () => h(Steps, null, () => h(Step, { title: 'fallback', description: 'fallback description', icon: 'home' }, {
      title: () => h('text', { class: 'slot-title' }, 'title'), description: () => h('text', { class: 'slot-description' }, 'description'), icon: () => h('text', { class: 'step-icon' }, 'icon')
    })) } as any)
    expect(node(container, '.slot-title')).not.toBeNull(); expect(node(container, '.slot-description')).not.toBeNull(); expect(node(container, '.step-icon')).not.toBeNull()
    expect(node(container, '.wd-step__icon')).toBeNull(); expect(container.textContent).not.toContain('fallback')
  })
})

describe('navbar and capsule', () => {
  it('default navbar height retains the CSS token instead of auto', () => {
    const { container } = render(Navbar, { title: 'title', bordered: true })
    expect(node(container, '.wd-navbar').style.height).toBe(''); expect(node(container, '.wd-navbar__border')).not.toBeNull()
  })

  it('navbar slot priority, disabled sides and capsule no-payload events match', () => {
    const left = vi.fn(), right = vi.fn(), back = vi.fn(), home = vi.fn()
    const result = render({ setup: () => () => h(Navbar, { title: 'fallback', leftText: 'left fallback', rightText: 'right fallback', rightDisabled: true, onClickLeft: left, onClickRight: right }, {
      left: () => h('text', 'left slot'), title: () => h('text', 'title slot'), right: () => h('text', 'right slot')
    }) } as any)
    fireEvent.tap(node(result.container, '.wd-navbar__left')); fireEvent.tap(node(result.container, '.wd-navbar__right'))
    expect(left).toHaveBeenCalledExactlyOnceWith(); expect(right).not.toHaveBeenCalled(); expect(result.container.textContent).not.toContain('fallback')
    cleanup()
    const { container } = render({ setup: () => () => h(Navbar, { leftText: 'hidden' }, { capsule: () => h(NavbarCapsule, { onBack: back, onBackHome: home }), left: () => h('text', 'also hidden') }) } as any)
    expect(node(container, '.wd-navbar__left')).toBeNull()
    const icons = container.querySelectorAll('.wd-navbar-capsule__icon')
    fireEvent.tap(icons[0]); fireEvent.tap(icons[1]); expect(back).toHaveBeenCalledExactlyOnceWith(); expect(home).toHaveBeenCalledExactlyOnceWith()
    expect(node(container, '.wd-navbar-capsule__border')).not.toBeNull()
  })

  it('refreshes fixed placeholder after sizing overrides and clears it when fixed is disabled', async () => {
    let height = 44
    mockRects(() => ({ ...RECT, height }))
    const customStyle = ref('height: 44px'), fixed = ref(true)
    const { container } = render({ setup: () => () => h(Navbar, { fixed: fixed.value, placeholder: true, customStyle: customStyle.value }) } as any)
    await frames(); const root = node(container, '.wd-navbar')
    expect(root.parentElement!.style.height).toBe('44px')
    height = 68; customStyle.value = 'height: 68px'; await frames(); expect(root.parentElement!.style.height).toBe('68px')
    fixed.value = false; await frames(); expect(root.parentElement!.style.height).toBe('auto')
  })
})

describe('pagination', () => {
  it('preserves all four scoped slots and hides the message slot when not enabled', () => {
    const scopes: any[] = [], slot = (name: string) => (scope: any) => { scopes.push(scope); return h('text', name) }
    const { container } = render({ setup: () => () => h(Pagination, { modelValue: 2, total: 25, pageSize: 10, showMessage: true }, { prev: slot('prev'), size: slot('size'), next: slot('next'), message: slot('message') }) } as any)
    expect(scopes).toHaveLength(4); for (const scope of scopes) expect(scope).toEqual({ modelValue: 2, totalPageNum: 3, total: 25, pageSize: 10 })
    expect(container.querySelectorAll('.wd-button')).toHaveLength(0)
    cleanup(); const hidden = vi.fn(); render({ setup: () => () => h(Pagination, { modelValue: 1 }, { message: hidden }) } as any); expect(hidden).not.toHaveBeenCalled()
  })

  it('retains reactive totalPage/pageSize fixes, stays controlled, emits change before update and respects bounds', async () => {
    const total = ref(0), pages = ref(4), size = ref(10), value = ref(1), events: any[] = []
    const { container } = render({ setup: () => () => h(Pagination, { modelValue: value.value, total: total.value, totalPage: pages.value, pageSize: size.value, showMessage: true, onChange: (d: any) => events.push(['change', d]), 'onUpdate:modelValue': (v: any) => events.push(['update', v]) }) } as any)
    expect(node(container, '.wd-pagination__total').textContent).toBe('4')
    const buttons = container.querySelectorAll('.wd-button')
    fireEvent.tap(buttons[0]); fireEvent.tap(buttons[1]); expect(events).toEqual([['change', { value: 2 }], ['update', 2]]); expect(node(container, '.wd-pagination__current').textContent).toBe('1')
    pages.value = 7; await frames(1); expect(node(container, '.wd-pagination__total').textContent).toBe('7')
    total.value = 43; await frames(1); expect(node(container, '.wd-pagination__total').textContent).toBe('5')
    size.value = 20; await frames(1); expect(node(container, '.wd-pagination__total').textContent).toBe('3')
    value.value = 3; await frames(1); fireEvent.tap(buttons[1]); expect(events).toHaveLength(2); expect(node(container, '.wd-pagination__message-text').textContent).toContain('43')
  })

  it('honors hideIfOnePage, custom labels and icon navigation', () => {
    const hidden = render(Pagination, { modelValue: 1, total: 1, hideIfOnePage: true }); expect(node(hidden.container, '.wd-pagination')).toBeNull()
    cleanup(); const custom = render(Pagination, { modelValue: 2, total: 40, prevText: 'previous', nextText: 'next' }); expect(custom.container.textContent).toContain('previous'); expect(custom.container.textContent).toContain('next')
    cleanup(); const icons = render(Pagination, { modelValue: 2, total: 40, showIcon: true }); expect(icons.container.querySelectorAll('.wd-button__icon')).toHaveLength(2)
  })
})

describe('collapse and collapse-item', () => {
  it('uncontrolled toggle, title scope, body customization and toggleAll/skipDisabled/accordion match', async () => {
    mockRects(() => ({ ...RECT, height: 85 }))
    const changes: any[] = [], itemRef = ref<any>(), collapseRef = ref<any>(), scopes: any[] = []
    const { container } = render({ setup: () => () => h(Collapse, { ref: collapseRef, onChange: (d: any) => changes.push(d) }, () => [
      h(CollapseItem, { ref: itemRef, name: 'a', customBodyClass: 'body-custom', customBodyStyle: 'padding: 7px' }, { default: () => h('text', 'body'), title: (s: any) => { scopes.push(s); return h('text', 'custom title') } }), h(CollapseItem, { name: 'b', title: 'disabled', disabled: true })
    ]) } as any)
    await frames(); expect(itemRef.value.getExpanded()).toBe(false)
    fireEvent.tap(node(container, '.wd-collapse-item__header')); await frames(); expect(itemRef.value.getExpanded()).toBe(true)
    expect(scopes.at(-1)).toEqual({ expanded: true, disabled: false, isFirst: true }); expect(node(container, '.body-custom').style.padding).toBe('7px')
    collapseRef.value.toggleAll({ expanded: true, skipDisabled: true }); await frames(); expect(changes.at(-1)).toEqual({ value: ['a'] })
    collapseRef.value.toggleAll(true); await frames(); expect(changes.at(-1)).toEqual({ value: ['a', 'b'] })
    collapseRef.value.toggleAll({ expanded: false, skipDisabled: true }); await frames(); expect(changes.at(-1)).toEqual({ value: ['b'] })
    collapseRef.value.toggleAll(); await frames(); expect(changes.at(-1)).toEqual({ value: ['a'] })
    cleanup(); const accordion = renderExposed(Collapse, { accordion: true, onChange: (d: any) => changes.push(d) }, () => h(CollapseItem, { name: 'a', title: 'a' }))
    const previous = changes.length; accordion.exposed.value.toggleAll(true); expect(changes).toHaveLength(previous)
    fireEvent.tap(node(accordion.container, '.wd-collapse-item__header')); await frames(); expect(changes.at(-1)).toEqual({ value: 'a' })
    fireEvent.tap(node(accordion.container, '.wd-collapse-item__header')); await frames(); expect(changes.at(-1)).toEqual({ value: '' })
  })

  it('controlled panels paint only after acknowledgement; beforeExpend is called once for an approved click', async () => {
    mockRects()
    const value = ref<string[]>([]), itemRef = ref<any>(), updates: any[] = [], hook = vi.fn(() => false)
    const { container } = render({ setup: () => () => h(Collapse, { modelValue: value.value, 'onUpdate:modelValue': (v: any) => updates.push(v) }, () => h(CollapseItem, { ref: itemRef, name: 'a', title: 'a', beforeExpend: hook })) } as any)
    await frames(); fireEvent.tap(node(container, '.wd-collapse-item__header')); await frames(); expect(updates).toEqual([])
    hook.mockImplementation(() => true); fireEvent.tap(node(container, '.wd-collapse-item__header')); await frames()
    expect(updates).toEqual([['a']]); expect(itemRef.value.getExpanded()).toBe(false)
    value.value = ['a']; await frames(); expect(itemRef.value.getExpanded()).toBe(true); expect(hook).toHaveBeenCalledTimes(2)
    fireEvent.transitionend(node(container, '.wd-collapse-item__wrapper')); await frames(1); expect(node(container, '.wd-collapse-item__wrapper').style.height).toBe('auto')
  })

  it('collapse-item cancels pending approvals when disabled, renamed or unmounted', async () => {
    mockRects()
    const disabled = ref(false), name = ref('a'), updates: any[] = [], hooks: Array<(v: boolean) => void> = []
    const result = render({ setup: () => () => h(Collapse, { modelValue: [], 'onUpdate:modelValue': (v: any) => updates.push(v) }, () => h(CollapseItem, { name: name.value, title: 'a', disabled: disabled.value, beforeExpend: () => new Promise<boolean>((r) => hooks.push(r)) })) } as any)
    await frames(); const header = node(result.container, '.wd-collapse-item__header')
    fireEvent.tap(header); disabled.value = true; await frames(1); hooks[0](true); await frames(); expect(updates).toEqual([])
    disabled.value = false; await frames(1); fireEvent.tap(header); name.value = 'b'; await frames(1); hooks[1](true); await frames(); expect(updates).toEqual([])
    fireEvent.tap(header); result.unmount(); hooks[2](true); await frames(); expect(updates).toEqual([])
  })

  it('viewmore applies native text-maxline and retains controlled more-slot semantics', async () => {
    const value = ref(false), updates: any[] = []
    const { container } = render({ setup: () => () => h(Collapse, { viewmore: true, lineNum: 3, modelValue: value.value, useMoreSlot: true, customMoreSlotClass: 'more-custom', 'onUpdate:modelValue': (v: any) => updates.push(v) }, { default: () => h('text', 'long text content'), more: () => h('text', 'custom more') }) } as any)
    expect(node(container, '.more-custom').textContent).toBe('custom more')
    const text = node(container, '.wd-collapse__content text'); expect(text.getAttribute('text-maxline')).toBe('3')
    fireEvent.tap(node(container, '.wd-collapse__more')); expect(updates).toEqual([true]); expect(node(container, '.wd-collapse__content').classList.contains('is-retract')).toBe(true)
    value.value = true; await frames(1); expect(text.getAttribute('text-maxline')).toBe('0')
  })
})

describe('drop-menu and drop-menu-item', () => {
  it('header tracks external value/option labels/explicit title without recursive updates', async () => {
    const value = ref('a'), label = ref('A'), title = ref<string>()
    const { container } = render({ setup: () => () => h(DropMenu, null, () => h(DropMenuItem, { modelValue: value.value, title: title.value, options: [{ id: 'a', text: label.value }, { id: 'b', text: 'B' }], valueKey: 'id', labelKey: 'text' })) } as any)
    await frames(1); expect(node(container, '.wd-drop-menu__option-title-text').textContent).toBe('A')
    value.value = 'b'; await frames(1); expect(node(container, '.wd-drop-menu__option-title-text').textContent).toBe('B')
    value.value = 'a'; label.value = 'renamed'; await frames(1); expect(node(container, '.wd-drop-menu__option-title-text').textContent).toBe('renamed')
    title.value = 'custom'; await frames(1); expect(node(container, '.wd-drop-menu__option-title-text').textContent).toBe('custom')
  })

  it('disabled header/options cannot select, but official imperative open still works', async () => {
    mockRects()
    const exposed = ref<any>(), changes = vi.fn(), hook = vi.fn(() => true)
    const { container } = render({ setup: () => () => h(DropMenu, { duration: 0 }, () => h(DropMenuItem, { ref: exposed, disabled: true, title: 'menu', modelValue: 'a', options: [{ label: 'A', value: 'a' }], beforeToggle: hook, onChange: changes })) } as any)
    await frames(1); fireEvent.tap(node(container, '.wd-drop-menu__option')); await frames(); expect(hook).not.toHaveBeenCalled()
    for (const method of ['open', 'close', 'toggle', 'getShowPop']) expect(exposed.value[method]).toBeTypeOf('function')
    exposed.value.open(); await frames(); expect(exposed.value.getShowPop()).toBe(true); expect(hook).toHaveBeenCalledExactlyOnceWith({ status: true })
    fireEvent.tap(node(container, '.wd-drop-item__option')); expect(changes).not.toHaveBeenCalled(); exposed.value.close(); await frames(); expect(exposed.value.getShowPop()).toBe(false)
  })

  it('controlled selection uses custom keys, emits exact selected object on repeat, and preserves popup sizing', async () => {
    mockRects()
    const chosen = { id: '', text: 'Empty', help: 'tip' }, other = { id: 0, text: 'Zero' }, changes: any[] = [], updates: any[] = [], exposed = ref<any>()
    const { container } = render({ setup: () => () => h(DropMenu, { direction: 'up', duration: 0, zIndex: 31 }, () => h(DropMenuItem, {
      ref: exposed, modelValue: '', options: [chosen, other], valueKey: 'id', labelKey: 'text', tipKey: 'help', popupHeight: '150px', customPopupClass: 'popup-custom', customPopupStyle: 'padding: 6px', onChange: (d: any) => changes.push(d), 'onUpdate:modelValue': (v: any) => updates.push(v)
    })) } as any)
    await frames(1); exposed.value.open(); await frames()
    expect(node(container, '.wd-drop-item__option').classList.contains('is-active')).toBe(true); expect(node(container, '.wd-drop-item__tip').textContent).toBe('tip')
    expect(node(container, '.popup-custom').style.maxHeight).toBe('150px'); expect(node(container, '.popup-custom').style.padding).toBe('6px'); expect(node(container, '.wd-drop-item scroll-view').style.height).toBe('150px'); expect(node(container, '.wd-drop-item').style.zIndex).toBe('31')
    fireEvent.tap(node(container, '.wd-drop-item__option')); await frames(); expect(updates).toEqual(['']); expect(changes).toEqual([{ value: '', selectedItem: chosen }])
    exposed.value.open(); await frames(); fireEvent.tap(container.querySelectorAll('.wd-drop-item__option')[1]); await frames(); expect(updates.at(-1)).toBe(0); expect(changes.at(-1)).toEqual({ value: 0, selectedItem: other })
  })

  it('false/rejected/pending interceptors, opposite requests and unmount cannot reopen stale popups', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const hooks: Array<{ option: any; resolve(v: boolean): void; reject(e: any): void }> = []
    const result = renderExposed(DropMenuItem, { title: 'menu', beforeToggle: (option: any) => new Promise<boolean>((resolve, reject) => hooks.push({ option, resolve, reject })) })
    result.exposed.value.open(); result.exposed.value.close(); hooks[0].resolve(true); await frames(); expect(result.exposed.value.getShowPop()).toBe(false)
    result.exposed.value.open(); hooks[1].resolve(false); await frames(); expect(result.exposed.value.getShowPop()).toBe(false)
    result.exposed.value.open(); hooks[2].reject(new Error('no')); await frames(); expect(result.exposed.value.getShowPop()).toBe(false)
    result.exposed.value.open(); result.unmount(); hooks[3].resolve(true); await frames(); expect(node(result.container, '.wd-drop-item')).toBeNull()
  })

  it('fold accepts only the latest measurement and closes through the modal', async () => {
    const rects = mockRects(), first = ref<any>(), second = ref<any>()
    const { container } = render({ setup: () => () => h(DropMenu, { duration: 0 }, () => [h(DropMenuItem, { ref: first, title: 'a' }), h(DropMenuItem, { ref: second, title: 'b' })]) } as any)
    await frames(1); rects.delay(); const items = container.querySelectorAll('.wd-drop-menu__option')
    fireEvent.tap(items[0]); fireEvent.tap(items[1]); rects.pending[1].deliver(); await frames(); rects.pending[0].deliver(); await frames()
    expect(first.value.getShowPop()).toBe(false); expect(second.value.getShowPop()).toBe(true); expect(node(container, '.wd-drop-item').style.top).toContain('64px')
    fireEvent.tap(node(container, '.wd-overlay')); await frames(); expect(second.value.getShowPop()).toBe(false)
  })

  it('parent direction/z-index changes update an open item; lifecycle and default slot priority match', async () => {
    mockRects()
    const direction = ref('down'), zIndex = ref(24), exposed = ref<any>(), events: string[] = []
    const { container } = render({ setup: () => () => h(DropMenu, { direction: direction.value, zIndex: zIndex.value, duration: 0 }, () => h(DropMenuItem, {
      ref: exposed, title: 'menu', options: [{ label: 'hidden', value: 'a' }], onOpen: () => events.push('open'), onOpened: () => events.push('opened'), onClose: () => events.push('close'), onClosed: () => events.push('closed')
    }, () => h('text', { class: 'custom-drop' }, 'custom'))) } as any)
    await frames(1); fireEvent.tap(node(container, '.wd-drop-menu__option')); await frames()
    expect(events).toEqual(['open', 'opened']); expect(node(container, '.custom-drop')).not.toBeNull(); expect(node(container, '.wd-drop-item__option')).toBeNull()
    direction.value = 'up'; zIndex.value = 45; await frames(); expect(node(container, '.wd-popup').classList.contains('wd-popup--bottom')).toBe(true); expect(node(container, '.wd-drop-item').style.zIndex).toBe('45')
    exposed.value.close(); await frames(); expect(events).toEqual(['open', 'opened', 'close', 'closed']); expect(node(container, '.wd-drop-item')).toBeNull()
  })

  it('honors closeOnClickModal=false and modal=false', async () => {
    mockRects()
    const exposed = ref<any>(), modal = ref(true)
    const { container } = render({ setup: () => () => h(DropMenu, { closeOnClickModal: false, modal: modal.value, duration: 0 }, () => h(DropMenuItem, { ref: exposed, title: 'menu' })) } as any)
    await frames(1); exposed.value.open(); await frames(); fireEvent.tap(node(container, '.wd-overlay')); await frames(); expect(exposed.value.getShowPop()).toBe(true)
    modal.value = false; await frames(1); expect(node(container, '.wd-overlay')).toBeNull()
  })
})

describe('sort button', () => {
  it.each([[false, false, [1, -1, 1]], [false, true, [1, -1, 0]], [true, false, [-1, 1, -1]], [true, true, [-1, 1, 0]]])('descFirst=%s allowReset=%s preserves cycle, event order and native tap forwarding', async (descFirst, allowReset, expected) => {
    const value = ref(0), events: any[] = [], tap = vi.fn()
    const { container } = render({ setup: () => () => h(SortButton, { title: 'sort', line: true, modelValue: value.value, descFirst, allowReset, onTap: tap, onChange: (d: any) => events.push(['change', d]), 'onUpdate:modelValue': (v: any) => { events.push(['update', v]); value.value = v } }) } as any)
    for (const next of expected as number[]) {
      fireEvent.tap(node(container, '.wd-sort-button')); await frames(1)
      expect(events.slice(-2)).toEqual([['update', next], ['change', { value: next }]])
      expect(node(container, '.wd-sort-button__underline').classList.contains('is-active')).toBe(next !== 0)
      expect(node(container, '.wd-sort-button__icon-up').classList.contains('wd-sort-button__icon-up--active')).toBe(next === -1)
      expect(node(container, '.wd-sort-button__icon-down').classList.contains('wd-sort-button__icon-down--active')).toBe(next === 1)
    }
    expect(tap).toHaveBeenCalledTimes(3)
  })
  it('remains controlled without acknowledgements', async () => {
    const changes: any[] = [], { container } = render(SortButton, { modelValue: 0, onChange: (d: any) => changes.push(d) })
    fireEvent.tap(node(container, '.wd-sort-button')); fireEvent.tap(node(container, '.wd-sort-button')); await frames(1)
    expect(changes).toEqual([{ value: 1 }, { value: 1 }]); expect(node(container, '.wd-sort-button__left').classList.contains('is-active')).toBe(false)
  })
})

// Resolve fallback chains including build-css's rule-local --csslib-* vars.
// No presets/colors/theme values enter this non-theme geometry comparison.
function resolveVars(value: string, variables: Record<string, string>, depth = 0): string {
  if (depth > 25) throw new Error(`recursive CSS variable: ${value}`)
  let result = '', start = 0, at: number
  while ((at = value.indexOf('var(', start)) >= 0) {
    result += value.slice(start, at)
    let end = at + 4, nesting = 1, comma = -1
    for (; end < value.length && nesting; end++) {
      if (value[end] === '(') nesting++
      else if (value[end] === ')') nesting--
      else if (value[end] === ',' && nesting === 1 && comma === -1) comma = end
    }
    const name = value.slice(at + 4, comma === -1 ? end - 1 : comma).trim()
    const fallback = comma === -1 ? `var(${name})` : value.slice(comma + 1, end - 1).trim(), selected = variables[name] ?? fallback
    result += selected === `var(${name})` ? selected : resolveVars(selected, variables, depth + 1)
    start = end
  }
  return (result + value.slice(start)).replace(/(^|[^\w.])\.(\d)/g, '$10.$2').replace(/\s*([*,])\s*/g, '$1').replace(/\s+/g, ' ').trim()
}
const cssCache = new Map<string, Map<string, Record<string, string>>>()
function cssRules(component: string, official: boolean) {
  const key = `${component}:${official}`
  if (cssCache.has(key)) return cssCache.get(key)!
  const root = resolve(__dirname, '../../..')
  const css = official ? compile(resolve(root, `.wot-ref/src-2.3.2/components/${component}/index.scss`), { style: 'expanded', logger: { warn() {}, debug() {} } }).css : compRead(component, 'index.css')
  const rules = new Map<string, Record<string, string>>()
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/.test((rule.parent as any).name)) return
    const declarations: Record<string, string> = {}, variables: Record<string, string> = {}
    rule.nodes.forEach((decl: any) => { if (decl.type === 'decl') (decl.prop.startsWith('--') ? variables : declarations)[decl.prop] = decl.value })
    for (const selector of rule.selector.replace(/:deep\(([^)]*)\)/g, '$1').split(',')) {
      const name = selector.trim().replace(/\s+/g, ' '), current = rules.get(name) ?? {}
      for (const [prop, value] of Object.entries(declarations)) current[prop] = resolveVars(value, variables)
      rules.set(name, current)
    }
  })
  cssCache.set(key, rules); return rules
}
const GEOMETRY: Array<[string, string, string[]]> = [
  ['wd-tabs', '.wd-tabs__nav-item', ['font-size', 'line-height', 'padding', 'flex', 'min-width']], ['wd-tabs', '.wd-tabs__line.is-dot', ['width', 'height', 'bottom', 'border-radius']],
  ['wd-tab', '.wd-tab', ['width', 'flex-shrink', 'box-sizing']], ['wd-tab', '.wd-tab__body--inactive', ['height', 'transition']],
  ['wd-tabbar', '.wd-tabbar', ['height']], ['wd-tabbar', '.wd-tabbar--round', ['margin-left', 'margin-right', 'border-radius']], ['wd-tabbar-item', '.wd-tabbar-item', ['height', 'flex']], ['wd-tabbar-item', '.wd-tabbar-item__body-title', ['font-size', 'line-height']],
  ['wd-sidebar', '.wd-sidebar', ['width', 'height']], ['wd-sidebar-item', '.wd-sidebar-item', ['padding', 'min-height', 'font-size', 'line-height', 'box-sizing']], ['wd-sidebar-item', '.wd-sidebar-item .wd-sidebar-item__icon', ['font-size', 'margin-right']],
  ['wd-step', '.wd-step__circle', ['width', 'height', 'border-radius']], ['wd-step', '.wd-step__circle-text', ['font-size', 'line-height', 'font-weight']], ['wd-step', '.wd-step__line', ['width', 'height', 'top', 'left']], ['wd-step', '.wd-step__description', ['font-size', 'line-height', 'margin-top', 'padding']],
  ['wd-navbar', '.wd-navbar', ['height', 'line-height', 'box-sizing']], ['wd-navbar', '.wd-navbar__title', ['max-width', 'font-size', 'font-weight', 'height']], ['wd-navbar-capsule', '.wd-navbar-capsule', ['width', 'height', 'box-sizing']], ['wd-navbar-capsule', '.wd-navbar-capsule .wd-navbar-capsule__icon', ['font-size', 'flex']],
  ['wd-pagination', '.wd-pagination', ['padding']], ['wd-pagination', '.wd-pagination__size', ['font-size', 'line-height', 'flex']], ['wd-collapse', '.wd-collapse.is-viewmore', ['padding']], ['wd-collapse', '.wd-collapse__arrow', ['font-size', 'height', 'line-height', 'transition']],
  ['wd-collapse-item', '.wd-collapse-item__header', ['padding', 'overflow']], ['wd-collapse-item', '.wd-collapse-item__body', ['padding', 'font-size', 'line-height']], ['wd-drop-menu', '.wd-drop-menu__option', ['height', 'padding', 'box-sizing', 'min-width', 'flex']], ['wd-drop-menu', '.wd-drop-menu__option-title-text', ['font-size', 'line-height']],
  ['wd-drop-menu-item', '.wd-drop-item__option', ['padding', 'transition']], ['wd-drop-menu-item', '.wd-drop-item__tip', ['font-size', 'line-height', 'margin-left']], ['wd-sort-button', '.wd-sort-button', ['height']], ['wd-sort-button', '.wd-sort-button__right', ['width', 'height', 'margin-left']], ['wd-sort-button', '.wd-sort-button .wd-sort-button__icon-up', ['font-size', 'top', 'transform', 'transform-origin']]
]
describe('actual official non-theme CSS geometry and native layout', () => {
  it.each(GEOMETRY)('%s %s matches official dimension/spacing defaults', (component, selector, properties) => {
    const actual = cssRules(component, false).get(selector), expected = cssRules(component, true).get(selector)
    expect(actual, selector).toBeDefined(); expect(expected, selector).toBeDefined()
    for (const property of properties) expect(actual![property], property).toBe(expected![property])
  })
  it.each(COMPONENTS)('%s root uses supported explicit flex layout', (name) => {
    const rule = cssRules(name, false).get(name === 'wd-drop-menu-item' ? '.wd-drop-item' : `.${name}`)!
    expect(rule.display).toBe('flex'); expect(['row', 'column']).toContain(rule['flex-direction'])
  })
  it('capsule border substitute retains official geometry/stroke customization and navbar border does not shrink content', () => {
    const border = cssRules('wd-navbar-capsule', false).get('.wd-navbar-capsule__border')!
    expect(border).toBeDefined(); expect(border.width).toBe('200%'); expect(border.height).toBe('200%'); expect(border.transform).toBe('scale(0.5)'); expect(border.border).toContain('1px solid')
    expect(cssRules('wd-navbar', false).get('.wd-navbar.is-border')?.['box-sizing']).not.toBe('border-box')
  })
})

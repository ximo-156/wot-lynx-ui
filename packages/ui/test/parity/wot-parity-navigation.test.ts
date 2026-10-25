import { afterEach, describe, expect, it } from 'vitest'
import { Fragment, h, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'
import Pagination from '../../src/components/wd-pagination/wd-pagination.vue'
import Tabs from '../../src/components/wd-tabs/wd-tabs.vue'
import Tab from '../../src/components/wd-tab/wd-tab.vue'
import Tour from '../../src/components/wd-tour/wd-tour.vue'
import Sidebar from '../../src/components/wd-sidebar/wd-sidebar.vue'
import SidebarItem from '../../src/components/wd-sidebar-item/wd-sidebar-item.vue'
import Tabbar from '../../src/components/wd-tabbar/wd-tabbar.vue'
import TabbarItem from '../../src/components/wd-tabbar-item/wd-tabbar-item.vue'
import Navbar from '../../src/components/wd-navbar/wd-navbar.vue'
import NavbarCapsule from '../../src/components/wd-navbar-capsule/wd-navbar-capsule.vue'

afterEach(cleanup)

async function frames(count = 3) {
  for (let index = 0; index < count; index++) await pause()
}

describe('wot 2.3.2 navigation parity', () => {
  it('pagination recomputes page count after totalPage, pageSize and total change', async () => {
    const total = ref(0)
    const totalPage = ref(5)
    const pageSize = ref(10)
    const { container } = render({
      setup: () => () => h(Pagination, { modelValue: 1, total: total.value, totalPage: totalPage.value, pageSize: pageSize.value })
    } as any)
    const pageCount = () => container.querySelector('.wd-pagination__total')!.textContent
    expect(pageCount()).toBe('5')
    totalPage.value = 8
    await frames(1)
    expect(pageCount()).toBe('8')
    total.value = 90
    await frames(1)
    expect(pageCount()).toBe('9')
    pageSize.value = 20
    await frames(1)
    expect(pageCount()).toBe('5')
    total.value = 0
    await frames(1)
    expect(pageCount()).toBe('8')
  })

  it('pagination remains controlled and emits documented payload only within its bounds', async () => {
    const value = ref(1)
    const updates: number[] = []
    const changes: any[] = []
    const { container } = render({
      setup: () => () => h(Pagination, {
        modelValue: value.value,
        totalPage: 2,
        onChange: (detail: any) => changes.push(detail),
        'onUpdate:modelValue': (next: number) => updates.push(next)
      })
    } as any)
    const buttons = () => container.querySelectorAll('.wd-button')
    fireEvent.tap(buttons()[0])
    fireEvent.tap(buttons()[1])
    expect(updates).toEqual([2])
    expect(changes).toEqual([{ value: 2 }])
    expect(container.querySelector('.wd-pagination__current')!.textContent).toBe('1')
    value.value = 2
    await frames(1)
    fireEvent.tap(buttons()[1])
    expect(updates).toEqual([2])
  })

  it('tour honors an initial nonzero current and an external jump', async () => {
    const current = ref(1)
    const { container } = render({
      setup: () => () => h(Tour, {
        modelValue: true,
        current: current.value,
        steps: [{ element: '', content: 'first' }, { element: '', content: 'second' }, { element: '', content: 'third' }],
        customClass: 'consumer-tour'
      })
    } as any)
    expect(container.querySelector('.wd-tour__info')!.textContent).toBe('second')
    expect(container.querySelector('.wd-tour')!.classList.contains('consumer-tour')).toBe(true)
    current.value = 2
    await frames(1)
    expect(container.querySelector('.wd-tour__info')!.textContent).toBe('third')
    expect(container.querySelector('.wd-tour__finish')).not.toBeNull()
  })

  it.each([
    ['sidebar', Sidebar, SidebarItem, '.wd-sidebar-item'],
    ['tabbar', Tabbar, TabbarItem, '.wd-tabbar-item']
  ])('%s only applies the latest asynchronous selection and ignores unmounted completion', async (name, component, item, selector) => {
    const resolves: Array<(value: boolean) => void> = []
    const changes: any[] = []
    const updates: any[] = []
    const result = render({ setup: () => () => h(component as any, { modelValue: 'a', fixed: false, beforeChange: () => new Promise<boolean>((resolve) => resolves.push(resolve)), onChange: (detail: any) => changes.push(detail), 'onUpdate:modelValue': (value: any) => updates.push(value) }, {
      default: () => ['a', 'b', 'c'].map((value) => h(item as any, name === 'sidebar' ? { value, label: value } : { name: value, title: value }))
    }) } as any)
    await frames(1)
    const items = result.container.querySelectorAll(selector as string)
    fireEvent.tap(items[1])
    fireEvent.tap(items[2])
    resolves[1](true)
    await frames(1)
    resolves[0](true)
    await frames(1)
    expect(updates).toEqual(['c'])
    expect(changes).toEqual(name === 'sidebar' ? [{ value: 'c', label: 'c' }] : [{ value: 'c' }])
    fireEvent.tap(items[1])
    result.unmount()
    resolves[2](true)
    await frames(1)
    expect(updates).toEqual(['c'])
  })

  it('navbar slots and capsule expose the documented native tap event names', async () => {
    const events: string[] = []
    const { container } = render({ setup: () => () => h('view', null, [
      h(Navbar, { title: 'title', leftArrow: true, leftDisabled: true, rightText: 'right', onClickLeft: () => events.push('left'), onClickRight: () => events.push('right') }),
      h(NavbarCapsule, { onBack: () => events.push('back'), onBackHome: () => events.push('home') })
    ]) } as any)
    fireEvent.tap(container.querySelector('.wd-navbar__left')!)
    fireEvent.tap(container.querySelector('.wd-navbar__right')!)
    const icons = container.querySelectorAll('.wd-navbar-capsule__icon')
    expect(icons).toHaveLength(2)
    fireEvent.tap(icons[0])
    fireEvent.tap(icons[1])
    expect(events).toEqual(['right', 'back', 'home'])
  })

  it('tabs renders v-for fragments, supports numeric names and reports disabled selections', async () => {
    const current = ref<string | number>(20)
    const clicks: any[] = []
    const disabled: any[] = []
    const { container } = render({
      setup: () => () => h(Tabs, {
        modelValue: current.value,
        onClick: (detail: any) => clicks.push(detail),
        onDisabled: (detail: any) => disabled.push(detail),
        'onUpdate:modelValue': (next: string | number) => { current.value = next }
      }, {
        default: () => [h(Fragment, null, [h(Tab, { title: 'one', name: 10 }), h(Tab, { title: 'two', name: 20 }), h(Tab, { title: 'disabled', name: 30, disabled: '' })])]
      })
    } as any)
    await frames()
    const items = container.querySelectorAll('.wd-tabs__nav-item')
    expect(items).toHaveLength(3)
    expect(items[1].classList.contains('is-active')).toBe(true)
    fireEvent.tap(items[2])
    expect(disabled).toEqual([{ index: 2, name: 30 }])
    expect(current.value).toBe(20)
    fireEvent.tap(items[0])
    await frames(4)
    expect(current.value).toBe(10)
    expect(clicks).toEqual([{ index: 0, name: 10 }])
  })
})

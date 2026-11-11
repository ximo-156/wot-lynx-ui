import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import * as util from '@wot-lynx/core/common/util'
import { getViewportOverride, setViewportOverride } from '@wot-lynx/core/common/viewport-state'
import { compRead } from '../helpers/component-roots'
import Table from '@wot-lynx/ui-display/wd-table'
import TableColumn from '@wot-lynx/ui-display/wd-table-column'

async function frames(count = 3) { for (let i = 0; i < count; i++) await util.pause() }
const node = (root: Element, selector: string) => root.querySelector(selector)! as HTMLElement
const headers = (root: Element) => [...root.querySelectorAll<HTMLElement>('.wd-table__header > .wd-table__cell')]
const columns = (root: Element) => [...root.querySelectorAll<HTMLElement>('.wd-table-column')]
async function layout(root: Element, width: number, nested = false) {
  fireEvent.layoutchange(node(root, 'scroll-view'), { detail: nested ? { layout: { width } } : { width } })
  await frames()
}

// Check the actual styles delivered through Lynx's dual-thread renderer. JSDOM
// does not perform layout; browser/native pixel verification remains separate.
const initialViewport = getViewportOverride()
afterEach(() => { cleanup(); vi.restoreAllMocks(); setViewportOverride(initialViewport) })

describe('table container-relative column widths', () => {
  it('shares viewport widths across the header/body and adapts without remounting', async () => {
    const { container } = render({ setup: () => () => h(Table, { data: [{ name: '张三', age: 28, city: '北京' }] }, {
      default: () => [
        h(TableColumn, { prop: 'name', label: '姓名', width: '35%' }),
        h(TableColumn, { prop: 'age', label: '年龄', width: '30%' }),
        h(TableColumn, { prop: 'city', label: '城市', width: '35%' })
      ]
    }) } as any)
    await frames()
    const original = columns(container)
    await layout(container, 320)
    expect(headers(container).map((cell) => cell.style.width)).toEqual(['112px', '96px', '112px'])
    expect(original.map((column) => column.style.width)).toEqual(['112px', '96px', '112px'])
    // A cell is relative to its own column, not to the table again (35% * 35%).
    expect(original.map((column) => node(column, '.wd-table__cell').style.width)).toEqual(['100%', '100%', '100%'])
    await layout(container, 280, true)
    expect(columns(container)).toEqual(original)
    expect(headers(container).map((cell) => cell.style.width)).toEqual(['98px', '84px', '98px'])
    expect(original.map((column) => column.style.width)).toEqual(['98px', '84px', '98px'])
  })

  it('updates percentage colspan widths and sticky offsets together after a resize or prop change', async () => {
    const firstWidth = ref<string | number>('20%'), fixed = ref(true)
    const spanMethod = ({ columnIndex }: any) => columnIndex === 0 ? { rowspan: 1, colspan: 2 } : columnIndex === 1 ? { rowspan: 0, colspan: 0 } : undefined
    const { container } = render({ setup: () => () => h(Table, { data: [{ a: 'merged', b: 'hidden', c: 'tail' }], spanMethod }, {
      default: () => [
        h(TableColumn, { prop: 'a', label: 'A', width: firstWidth.value, fixed: true }),
        h(TableColumn, { prop: 'b', label: 'B', width: '30%', fixed: fixed.value }),
        h(TableColumn, { prop: 'c', label: 'C', width: '50%' })
      ]
    }) } as any)
    await frames(); await layout(container, 400)
    const body = columns(container), merged = node(body[0], '.wd-table__cell')
    expect(body.map((column) => column.style.width)).toEqual(['80px', '120px', '200px'])
    expect(merged.style.width).toBe('calc(200px)')
    expect(body[1].style.left).toBe('80px'); expect(headers(container)[1].style.left).toBe('80px')
    await layout(container, 300)
    expect(merged.style.width).toBe('calc(150px)')
    expect(body[1].style.left).toBe('60px'); expect(headers(container)[1].style.left).toBe('60px')
    firstWidth.value = 90; fixed.value = false; await frames()
    expect(body[0].style.width).toBe('90px'); expect(merged.style.width).toBe('calc(180px)')
    expect(body[1].style.left).toBe('auto'); expect(headers(container)[1].style.left).toBe('auto')
    firstWidth.value = '20%'; fixed.value = true; await frames()
    expect(body[0].style.width).toBe('60px'); expect(body[1].style.left).toBe('60px')
  })

  it('preserves explicit pixel widths and horizontal scrolling when columns exceed the viewport', async () => {
    const { container } = render({ setup: () => () => h(Table, { data: [{ a: 'a', b: 'b', c: 'c' }] }, {
      default: () => ['a', 'b', 'c'].map((prop) => h(TableColumn, { prop, label: prop, width: 180 }))
    }) } as any)
    await frames(); await layout(container, 300)
    expect(headers(container).map((cell) => cell.style.width)).toEqual(['180px', '180px', '180px'])
    expect(columns(container).map((column) => column.style.width)).toEqual(['180px', '180px', '180px'])
    expect(node(container, '.wd-table__content').style.width).toBe('calc(540px)')
    expect(node(container, 'scroll-view').getAttribute('scroll-x')).toBe('true')
    const query = vi.spyOn(util, 'getRect')
    fireEvent.scroll(node(container, 'scroll-view'), { detail: { scrollLeft: 100 } }); await frames()
    expect(query).not.toHaveBeenCalled()
  })

  it('uses percentages of the viewport, not the expanded content, for mixed/overflowing columns', async () => {
    const index = ref<any>(false)
    const { container } = render({ setup: () => () => h(Table, { data: [{ a: 'a', b: 'b' }], index: index.value }, {
      default: () => [h(TableColumn, { prop: 'a', label: 'A', width: '80%' }), h(TableColumn, { prop: 'b', label: 'B', width: 120 })]
    }) } as any)
    await frames(); await layout(container, 300)
    expect(columns(container).map((column) => column.style.width)).toEqual(['240px', '120px'])
    expect(node(container, '.wd-table__content').style.width).toBe('calc(360px)')
    index.value = { width: '20%', label: 'No.' }; await frames()
    expect(columns(container).map((column) => column.style.width)).toEqual(['60px', '240px', '120px'])
    expect(headers(container).map((cell) => cell.style.width)).toEqual(['60px', '240px', '120px'])
    index.value = false; await frames()
    expect(columns(container).map((column) => column.style.width)).toEqual(['240px', '120px'])
  })

  it('keeps percentage cells full width before the first nonzero layout and rejects invalid events', async () => {
    vi.spyOn(util, 'getRect').mockResolvedValue({ width: 0, height: 0 })
    const { container } = render({ setup: () => () => h(Table, { data: [{ a: 'a' }] }, {
      default: () => h(TableColumn, { prop: 'a', label: 'A', width: '100%' })
    }) } as any)
    await frames()
    expect(columns(container)[0].style.width).toBe('100%')
    expect(node(columns(container)[0], '.wd-table__cell').style.width).toBe('100%')
    await layout(container, 250)
    expect(columns(container)[0].style.width).toBe('250px')
    for (const width of [NaN, -1, Infinity]) await layout(container, width)
    expect(columns(container)[0].style.width).toBe('250px')
    await layout(container, 0)
    expect(columns(container)[0].style.width).toBe('100%')
    await layout(container, 300)
    expect(columns(container)[0].style.width).toBe('300px')
  })

  it('does not let a late mounted query overwrite a newer viewport layout', async () => {
    let complete: (value: any) => void = () => { throw new Error('viewport query was not scheduled') }
    const query = vi.spyOn(util, 'getRect').mockImplementation((selector) => selector.startsWith('#wd-table-viewport-')
      ? new Promise((resolve) => { complete = resolve }) : Promise.resolve([]))
    const { container } = render({ setup: () => () => h(Table, { data: [{ a: 'a' }] }, {
      default: () => h(TableColumn, { prop: 'a', label: 'A', width: '100%' })
    }) } as any)
    await frames()
    expect(query.mock.calls.some(([selector]) => selector.startsWith('#wd-table-viewport-'))).toBe(true)
    await layout(container, 360)
    complete({ width: 240, height: 100 }); await frames()
    expect(columns(container)[0].style.width).toBe('360px')
  })

  it('ignores a viewport query completed after unmount', async () => {
    let complete: (value: any) => void = () => { throw new Error('viewport query was not scheduled') }
    vi.spyOn(util, 'getRect').mockImplementation((selector) => selector.startsWith('#wd-table-viewport-')
      ? new Promise((resolve) => { complete = resolve }) : Promise.resolve([]))
    const { container } = render({ setup: () => () => h(Table, { data: [] }, {
      default: () => h(TableColumn, { prop: 'a', label: 'A', width: '100%' })
    }) } as any)
    await frames(); cleanup()
    complete({ width: 320, height: 100 }); await frames()
    expect(container.querySelector('.wd-table')).toBeNull()
  })

  it('remeasures the container after viewport notifications without relying on layoutchange', async () => {
    let measuredWidth = 320
    setViewportOverride({ width: 1000, height: 800 })
    const query = vi.spyOn(util, 'getRect').mockImplementation((_selector, all) => Promise.resolve(all ? [] : { width: measuredWidth, height: 100 }))
    const { container } = render({ setup: () => () => h(Table, { data: [{ a: 'a', b: 'b' }] }, {
      default: () => [h(TableColumn, { prop: 'a', label: 'A', width: '35%' }), h(TableColumn, { prop: 'b', label: 'B', width: '65%' })]
    }) } as any)
    await frames()
    expect(columns(container).map((column) => column.style.width)).toEqual(['112px', '208px'])
    measuredWidth = 240; query.mockClear()
    setViewportOverride({ width: 600, height: 800 }); await frames()
    expect(query.mock.calls.some(([selector]) => selector.startsWith('#wd-table-viewport-'))).toBe(true)
    // The actual container is 240px; the notified window is 600px.
    expect(columns(container).map((column) => column.style.width)).toEqual(['84px', '156px'])
    expect(headers(container).map((cell) => cell.style.width)).toEqual(['84px', '156px'])
  })

  it('ignores an older query when viewport notifications schedule a newer one', async () => {
    const pending: ((rect: any) => void)[] = []
    setViewportOverride({ width: 1000, height: 800 })
    vi.spyOn(util, 'getRect').mockImplementation((selector) => selector.startsWith('#wd-table-viewport-')
      ? new Promise((resolve) => { pending.push(resolve) }) : Promise.resolve([]))
    const { container } = render({ setup: () => () => h(Table, { data: [{ a: 'a' }] }, {
      default: () => h(TableColumn, { prop: 'a', label: 'A', width: '100%' })
    }) } as any)
    await frames()
    setViewportOverride({ width: 600, height: 800 }); await frames()
    expect(pending).toHaveLength(2)
    pending[1]({ width: 240, height: 100 }); await frames()
    pending[0]({ width: 400, height: 100 }); await frames()
    expect(columns(container)[0].style.width).toBe('240px')
  })

  it('constrains the viewport including borders and keeps a dedicated full-width scroller', () => {
    const css = compRead('wd-table', 'index.css')
    expect(css).toMatch(/\.wd-table\{[^}]*box-sizing:border-box/)
    expect(css).toMatch(/\.wd-table\{[^}]*min-width:0/)
    expect(css).toMatch(/\.wd-table__scroll\{[^}]*width:100%/)
    expect(css).toMatch(/\.wd-table__scroll\{[^}]*flex-shrink:0/)
  })
})

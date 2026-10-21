import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { h, ref } from 'vue-lynx'
import { cleanup, render } from './render'
import { fireEvent } from './fire-event'
import { addUnit, pause } from '../src/common/util'
import { configureUniAdapter } from '../src/common/uni'
import Grid from '../src/components/wd-grid/wd-grid.vue'
import GridItem from '../src/components/wd-grid-item/wd-grid-item.vue'
import Row from '../src/components/wd-row/wd-row.vue'
import Col from '../src/components/wd-col/wd-col.vue'
import Cell from '../src/components/wd-cell/wd-cell.vue'
import CellGroup from '../src/components/wd-cell-group/wd-cell-group.vue'
import Card from '../src/components/wd-card/wd-card.vue'
import Table from '../src/components/wd-table/wd-table.vue'
import TableColumn from '../src/components/wd-table-column/wd-table-column.vue'
import Divider from '../src/components/wd-divider/wd-divider.vue'
import Gap from '../src/components/wd-gap/wd-gap.vue'
import AddressEdit from '../src/components/wd-address-edit/wd-address-edit.vue'
import SubmitBar from '../src/components/wd-submit-bar/wd-submit-bar.vue'
import ShareSheet from '../src/components/wd-share-sheet/wd-share-sheet.vue'
import Coupon from '../src/components/wd-coupon/wd-coupon.vue'
import WotUi from '../src/components/wot-ui/wot-ui.vue'
import { normalizeTableSpan, resolveTableRows } from '../src/components/wd-table/layout'

async function frames(count = 3) { for (let i = 0; i < count; i++) await pause() }
const text = (value: string, className?: string) => h('text', { class: className }, value)
const element = (root: Element, selector: string) => root.querySelector(selector)! as HTMLElement
const css = (name: string) => readFileSync(resolve(__dirname, `../src/components/${name}/index.css`), 'utf8')
// Testing PAPI uses Object.assign(CSSStyleDeclaration), storing CSS variables as own keys;
// native PAPI receives the same object. Do not patch the runtime or pretend computed CSS.
const inlineVariable = (node: HTMLElement, name: string) => (node.style as any)[name] ?? node.style.getPropertyValue(name)
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  configureUniAdapter({ navigateTo: undefined, redirectTo: undefined, createSelectorQuery: undefined })
})

describe('wot 2.3.2 layout behavior (real Lynx dual-thread renderer, not native screenshots)', () => {
  it('applies row/col gutter, span, offset, alignment and clears old insets', async () => {
    const gutter = ref(20), span = ref(12), offset = ref(6), justify = ref('space-between'), align = ref('bottom')
    const { container } = render({ setup: () => () => h('view', null, [h(Row, { gutter: gutter.value, justify: justify.value, align: align.value }, { default: () => h(Col, { span: span.value, offset: offset.value }, { default: () => text('column') }) })]) } as any)
    const row = element(container, '.wd-row'), col = element(container, '.wd-col')
    expect(row.style.marginLeft).toBe('-10px'); expect(row.style.marginRight).toBe('-10px')
    expect(col.style.paddingLeft).toBe('10px'); expect(col.style.paddingRight).toBe('10px')
    expect(col.style.width).toBe('50%'); expect(col.style.marginLeft).toBe('25%')
    expect(row.style.justifyContent).toBe('space-between'); expect(row.style.alignItems).toBe('flex-end')
    gutter.value = 0; span.value = 24; offset.value = 0; justify.value = 'center'; align.value = 'middle'
    await frames()
    expect(row.style.marginLeft).toBe('0px'); expect(col.style.paddingLeft).toBe('0px')
    expect(col.style.width).toBe('100%'); expect(col.style.marginLeft).toBe('0px')
    expect(row.style.justifyContent).toBe('center'); expect(row.style.alignItems).toBe('center')
  })

  it('uses grid child render order after a real keyed reorder, insertion and removal', async () => {
    const keys = ref(['a', 'b', 'c'])
    const { container } = render({ setup: () => () => h('view', null, [h(Grid, { column: 2, border: true }, { default: () => keys.value.map((key) => h(GridItem, { key, text: key, customClass: `grid-${key}` })) })]) } as any)
    await frames()
    const oldA = element(container, '.grid-a')
    expect(oldA.classList.contains('is-first')).toBe(true)
    expect(element(container, '.grid-c').classList.contains('is-border')).toBe(true)
    keys.value = ['c', 'b', 'a']; await frames()
    expect(element(container, '.grid-a')).toBe(oldA)
    expect(element(container, '.grid-a').classList.contains('is-border')).toBe(true)
    expect(element(container, '.grid-c').classList.contains('is-first')).toBe(true)
    keys.value = ['c', 'd']; await frames()
    expect(container.querySelectorAll('.wd-grid-item')).toHaveLength(2)
    expect(element(container, '.grid-d').classList.contains('is-right')).toBe(true)
  })

  it('applies grid parent square/gutter/background/direction and clears removed styles', async () => {
    const square = ref(true), gutter = ref(12), bg = ref('rgb(20, 30, 40)'), reverse = ref(true)
    const { container } = render({ setup: () => () => h('view', null, [h(Grid, { column: 2, square: square.value, gutter: gutter.value, bgColor: bg.value, direction: 'horizontal', reverse: reverse.value }, { default: () => [h(GridItem, { text: 'one' }), h(GridItem, { text: 'two' })] })]) } as any)
    await frames()
    const item = element(container, '.wd-grid-item'), content = element(item, '.wd-grid-item__content')
    expect(item.style.width).toBe('50%'); expect(item.style.paddingTop).toBe('50%'); expect(item.style.paddingRight).toBe('12px')
    expect(content.style.right).toBe('12px'); expect(content.style.bottom).toBe('12px')
    expect(inlineVariable(content, '--wot-grid-item-bg')).toBe('rgb(20, 30, 40)')
    expect(content.classList.contains('is-horizontal')).toBe(true); expect(content.classList.contains('is-reverse')).toBe(true)
    square.value = false; gutter.value = 0; bg.value = ''; reverse.value = false; await frames()
    expect(item.style.paddingTop).toBe(''); expect(item.style.paddingRight).toBe('')
    expect(content.style.right).toBe('0px'); expect(content.style.bottom).toBe('auto')
    expect(inlineVariable(content, '--wot-grid-item-bg')).toBe('')
    expect(content.classList.contains('is-reverse')).toBe(false)
  })

  it('emits grid no-argument click before navigation and rejects nonclickable parent taps', async () => {
    const order: any[] = [], clickable = ref(true)
    configureUniAdapter({ navigateTo: (options) => { order.push(['navigate', options.url]) } })
    const click = vi.fn((...args) => order.push(['click', args]))
    const { container } = render({ setup: () => () => h('view', null, [h(Grid, { clickable: clickable.value }, { default: () => h(GridItem, { text: 'go', url: '/grid', onClick: click }) })]) } as any)
    fireEvent.tap(element(container, '.wd-grid-item'))
    expect(order).toEqual([['click', []], ['navigate', '/grid']])
    clickable.value = false; await frames(); fireEvent.tap(element(container, '.wd-grid-item'))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('honors grid default/icon/text slots without rendering fallback icon or text', () => {
    const { container } = render({ setup: () => () => h('view', null, [h(Grid, {}, { default: () => [
      h(GridItem, { text: 'fallback' }, { default: () => [h('view', { class: 'custom-grid' }, text('custom'))] }),
      h(GridItem, { icon: 'home', text: 'fallback' }, { icon: () => text('icon slot', 'grid-icon-slot'), text: () => text('text slot', 'grid-text-slot') })
    ] })]) } as any)
    expect(container.querySelector('.custom-grid')).not.toBeNull(); expect(container.textContent).not.toContain('fallback')
    expect(container.querySelector('.grid-icon-slot')).not.toBeNull(); expect(container.querySelector('.grid-text-slot')).not.toBeNull()
  })

  it('inherits cell-group props, respects local overrides and reorders first-cell borders', async () => {
    const keys = ref(['a', 'b']), width = ref<number | undefined>(90)
    const { container } = render({ setup: () => () => h('view', null, [h(CellGroup, { title: 'group', value: 'more', border: true, insert: true, center: true, size: 'large', titleWidth: width.value, layout: 'vertical', valueAlign: 'center' }, { default: () => keys.value.map((key) => h(Cell, { key, title: key, customClass: `cell-${key}`, ...(key === 'b' ? { center: false, size: '', layout: 'horizontal', valueAlign: 'left' } : {}) })) })]) } as any)
    await frames()
    const a = element(container, '.cell-a'), b = element(container, '.cell-b')
    expect(a.classList.contains('is-large')).toBe(true); expect(a.classList.contains('is-center')).toBe(true)
    expect(a.classList.contains('is-border')).toBe(false); expect(b.classList.contains('is-border')).toBe(true)
    expect(b.classList.contains('is-center')).toBe(false)
    expect(element(a, '.wd-cell__left').style.minWidth).toBe('90px')
    expect(a.querySelector('.wd-cell__wrapper--vertical')).not.toBeNull()
    keys.value = ['b', 'a']; width.value = undefined; await frames()
    expect(element(container, '.cell-a')).toBe(a)
    expect(a.classList.contains('is-border')).toBe(true); expect(b.classList.contains('is-border')).toBe(false)
    expect(element(a, '.wd-cell__left').style.minWidth).toBe(''); expect(element(a, '.wd-cell__left').style.maxWidth).toBe('')
  })

  it('preserves zero values and required markers, and slots obey their enable flags', async () => {
    const useTitle = ref(false), value = ref<any>(0)
    const { container } = render({ setup: () => () => h('view', null, [h(Cell, { title: 'fallback title', label: 'label', useTitleSlot: useTitle.value, value: value.value, placeholder: 'empty', required: true, asteriskPosition: 'end' }, { title: () => text('title slot'), prefix: () => text('prefix slot'), suffix: () => text('suffix slot') })]) } as any)
    expect(container.textContent).toContain('fallback title'); expect(container.textContent).not.toContain('title slot')
    expect(element(container, '.wd-cell__value').textContent).toBe('0')
    expect(container.querySelectorAll('.wd-cell__required')).toHaveLength(1)
    value.value = ''; useTitle.value = true; await frames()
    expect(container.textContent).toContain('title slot'); expect(element(container, '.wd-cell__value').textContent).toBe('empty')
    expect(element(container, '.wd-cell__value').classList.contains('wd-cell__placeholder')).toBe(true)
  })

  it('emits cell no-argument click before redirect, and not for non-link passive cells', async () => {
    const order: any[] = [], link = ref(true)
    configureUniAdapter({ redirectTo: (options) => { order.push(['route', options.url]) } })
    const { container } = render({ setup: () => () => h('view', null, [h(Cell, { title: 'cell', isLink: link.value, replace: true, to: '/cell', arrowDirection: 'left', onClick: (...args: any[]) => order.push(['click', args]) })]) } as any)
    fireEvent.tap(element(container, '.wd-cell')); expect(order).toEqual([['click', []], ['route', '/cell']])
    expect(element(container, '.wd-cell__arrow-right').className).toContain('left')
    link.value = false; await frames(); fireEvent.tap(element(container, '.wd-cell')); expect(order).toHaveLength(2)
  })

  it('matches card last-element margins through keyed reorder/removal and non-card siblings', async () => {
    const keys = ref(['a', 'b']), tail = ref(false)
    const { container } = render({ setup: () => () => h('view', null, [...keys.value.map((key) => h(Card, { key, title: key, type: 'rectangle', customClass: `card-${key}` }, { default: () => text('body'), footer: () => text('footer') })), ...(tail.value ? [h('view', { key: 'tail', class: 'tail' }, text('tail'))] : [])]) } as any)
    await frames()
    expect(element(container, '.card-a').classList.contains('is-last')).toBe(false)
    expect(element(container, '.card-b').classList.contains('is-last')).toBe(true)
    expect(container.querySelectorAll('.wd-card__border')).toHaveLength(4)
    keys.value = ['b', 'a']; await frames(); expect(element(container, '.card-a').classList.contains('is-last')).toBe(true)
    tail.value = true; await frames(); expect(element(container, '.card-a').classList.contains('is-last')).toBe(false)
    tail.value = false; keys.value = ['a']; await frames(); expect(element(container, '.card-a').classList.contains('is-last')).toBe(true)
  })

  it('renders divider arbitrary view slots, official empty left/right lines and clears color', async () => {
    const vertical = ref(false), color = ref('rgb(30, 40, 50)'), position = ref('left')
    const { container } = render({ setup: () => () => h('view', null, [h(Divider, { vertical: vertical.value, color: color.value, contentPosition: position.value, dashed: true }, { default: () => h('view', { class: 'divider-slot' }, text('slot')) })]) } as any)
    const divider = element(container, '.wd-divider')
    expect(divider.querySelectorAll('.wd-divider__line')).toHaveLength(2)
    expect(element(container, '.divider-slot').parentElement?.tagName.toLowerCase()).toBe('view')
    color.value = ''; vertical.value = true; await frames()
    expect(divider.style.color).toBe(''); expect(divider.querySelectorAll('.wd-divider__line')).toHaveLength(1)
    cleanup()
    const empty = render({ setup: () => () => h('view', null, [h(Divider, { contentPosition: 'right' })]) } as any)
    expect(empty.container.querySelectorAll('.wd-divider__line')).toHaveLength(2)
  })

  it('applies and clears gap height/background and safe-area padding', async () => {
    const height = ref<string | number>('40px'), bg = ref('rgb(1, 2, 3)'), safe = ref(true)
    const { container } = render({ setup: () => () => h('view', null, [h(Gap, { height: height.value, bgColor: bg.value, safeAreaBottom: safe.value })]) } as any)
    const gap = element(container, '.wd-gap')
    expect(gap.style.height).toBe('40px'); expect(gap.style.background).toBe('rgb(1, 2, 3)')
    expect(gap.classList.contains('wd-gap--safe')).toBe(true)
    height.value = 0; bg.value = ''; safe.value = false; await frames()
    expect(gap.style.height).toBe('0px'); expect(gap.style.background).toBe('transparent')
    expect(gap.classList.contains('wd-gap--safe')).toBe(false)
    expect(css('wd-gap')).toContain('env(safe-area-inset-bottom)')
  })
})

describe('table metadata, sorting, slots and shared row tracks', () => {
  it('reacts to all six column props and keeps keyed columns/headers in render order', async () => {
    const columns = ref<any[]>([{ prop: 'a', label: 'A', width: 80, sortable: false, fixed: true, align: 'left' }, { prop: 'b', label: 'B', width: 100, sortable: false, fixed: true, align: 'right' }])
    const { container } = render({ setup: () => () => h('view', null, [h(Table, { data: [{ a: 'value A', b: 'value B', c: 'value C' }] }, { default: () => columns.value.map((column) => h(TableColumn, { key: column.label === 'A' ? 'a' : 'b', ...column })) })]) } as any)
    await frames()
    const original = element(container, '.wd-table-column')
    expect(element(container, '.wd-table__header').textContent).toBe('AB')
    columns.value[0].prop = 'c'; columns.value[0].width = 120; columns.value[0].sortable = true; columns.value[0].fixed = false; columns.value[0].align = 'center'
    await frames()
    expect(element(container, '.wd-table-column')).toBe(original)
    expect(original.textContent).toContain('value C'); expect(original.style.width).toBe('120px')
    expect(original.classList.contains('is-fixed')).toBe(false)
    expect(element(container, '.wd-table__header .wd-table__cell').classList.contains('is-center')).toBe(true)
    expect(container.querySelector('.wd-sort-button')).not.toBeNull()
    columns.value = [columns.value[1], columns.value[0]]; await frames()
    expect(element(container, '.wd-table__header').textContent).toContain('BA')
    expect(container.querySelectorAll('.wd-table-column')[1]).toBe(original)
    columns.value[1].label = 'Renamed'; await frames(); expect(element(container, '.wd-table__header').textContent).toContain('Renamed')
    columns.value = [columns.value[0]]; await frames(); expect(container.querySelectorAll('.wd-table-column')).toHaveLength(1)
    expect(container.querySelectorAll('.wd-table__header .wd-table__cell')).toHaveLength(1)
  })

  it('sorts/reset cycles and exposes refs; other directions reset before exact official payload emits', async () => {
    const a = ref<any>(), b = ref<any>(), events: any[] = []
    const { container } = render({ setup: () => () => h('view', null, [h(Table, { data: [{ a: 'z', b: 'y' }, { a: 'a', b: 'b' }], onSortMethod: (payload: any) => events.push({ payload, a: a.value.sortDirection, b: b.value.sortDirection }) }, { default: () => [h(TableColumn, { ref: a, prop: 'a', label: 'A', width: 80, sortable: true, fixed: true, align: 'left' }), h(TableColumn, { ref: b, prop: 'b', label: 'B', width: 100, sortable: true, align: 'right' })] })]) } as any)
    await frames()
    const buttons = () => container.querySelectorAll('.wd-sort-button')
    fireEvent.tap(buttons()[0]); await frames()
    expect(events[0]).toEqual({ payload: { prop: 'a', label: 'A', width: 80, sortable: true, align: 'left', sortDirection: 1, fixed: true }, a: 1, b: 0 })
    fireEvent.tap(buttons()[1]); await frames(); expect(events[1].a).toBe(0); expect(events[1].b).toBe(1)
    fireEvent.tap(buttons()[1]); await frames(); expect(events[2].payload.sortDirection).toBe(-1)
    fireEvent.tap(buttons()[1]); await frames(); expect(events[3].payload.sortDirection).toBe(0)
    expect(element(container, '.wd-table-column').textContent).toBe('za')
  })

  it('passes the complete row/index to value slots and emits exact row-click payload', async () => {
    const data = ref([{ a: 'x', b: 'extra' }, { a: 'y', b: 'other' }]), scopes: any[] = [], rowClick = vi.fn()
    const { container } = render({ setup: () => () => h('view', null, [h(Table, { data: data.value, onRowClick: rowClick }, { default: () => h(TableColumn, { prop: 'a', label: 'A' }, { value: (scope: any) => { scopes.push(scope); return text(`${scope.index}:${scope.row.a}:${scope.row.b}`) } }) })]) } as any)
    await frames()
    expect(scopes.some((scope) => scope.index === 1 && scope.row.b === 'other')).toBe(true)
    fireEvent.tap(container.querySelectorAll('.wd-table-column .wd-table__cell')[1])
    expect(rowClick.mock.calls).toEqual([[{ rowIndex: 1 }]])
    data.value[1].b = 'updated'; await frames(); expect(container.textContent).toContain('1:y:updated')
  })

  it('positions merged natural-height rows in shared tracks and consumes real layout events', async () => {
    const spanMethod = ({ rowIndex, columnIndex }: any) => columnIndex === 0 && rowIndex === 0 ? { rowspan: 2, colspan: 1 } : columnIndex === 0 && rowIndex === 1 ? { rowspan: 0, colspan: 0 } : undefined
    const { container } = render({ setup: () => () => h('view', null, [h(Table, { data: [{ a: 'merge', b: 'b0' }, { a: 'hidden', b: 'b1' }, { a: 'a2', b: 'b2' }], spanMethod }, { default: () => [h(TableColumn, { prop: 'a', label: 'A', width: 80 }), h(TableColumn, { prop: 'b', label: 'B', width: 120 })] })]) } as any)
    await frames()
    const roots = container.querySelectorAll('.wd-table-column')
    fireEvent.layoutchange(roots[1].querySelectorAll('.wd-table__cell-content')[0], { detail: { height: 60 } })
    fireEvent.layoutchange(roots[1].querySelectorAll('.wd-table__cell-content')[1], { detail: { height: 80 } })
    await frames()
    const merged = roots[0].querySelectorAll('.wd-table__cell'), normal = roots[1].querySelectorAll('.wd-table__cell')
    expect(merged).toHaveLength(2)
    expect((merged[0] as HTMLElement).style.height).toBe('140px')
    expect((merged[1] as HTMLElement).style.top).toBe('140px')
    expect((normal[1] as HTMLElement).style.top).toBe('60px'); expect((normal[1] as HTMLElement).style.height).toBe('80px')
    expect(element(container, '.wd-table__body').style.height).toBe('184px')
  })

  it('supports colspan widths, hidden cells, and span callbacks after reactive width changes', async () => {
    const width = ref<string | number>(80), spans: any[] = []
    const spanMethod = (params: any) => { spans.push(params); return params.columnIndex === 0 ? { rowspan: 1, colspan: 2 } : { rowspan: 0, colspan: 0 } }
    const { container } = render({ setup: () => () => h('view', null, [h(Table, { data: [{ a: 'merged', b: 'hidden' }], spanMethod }, { default: () => [h(TableColumn, { prop: 'a', label: 'A', width: width.value }), h(TableColumn, { prop: 'b', label: 'B', width: '120px' })] })]) } as any)
    await frames()
    const cell = element(container, '.wd-table-column .wd-table__cell')
    expect(cell.style.width.replace(/\s/g, '')).toMatch(/calc\((80px\+120px|200px)\)/)
    expect(container.querySelectorAll('.wd-table-column .wd-table__cell')).toHaveLength(1)
    expect(spans.some((param) => param.column.prop === 'a' && param.row.b === 'hidden' && param.rowIndex === 0)).toBe(true)
    width.value = 90; await frames(); expect(cell.style.width.replace(/\s/g, '')).toMatch(/calc\((90px\+120px|210px)\)/)
  })

  it('syncs natural row heights through asynchronous selector queries and avoids queries during scrolling', async () => {
    const widths = ref(80), heights = [[60, 70], [90, 45]], pending: (() => void)[] = []
    const query = vi.fn(() => ({
      selectAll(selector: string) {
        return { invoke(options: any) {
          pending.push(() => {
            const doc = (globalThis as any).lynxTestingEnv.jsdom.window.document
            const nodes = Array.from(doc.querySelectorAll(selector)) as HTMLElement[]
            options.success(nodes.map((node) => {
              const match = /^([ab])(\d)/.exec(node.textContent || '')!
              return { width: 80, height: heights[match[1] === 'a' ? 0 : 1][Number(match[2])] }
            }))
          })
          return { exec() {} }
        } }
      }
    }))
    configureUniAdapter({ createSelectorQuery: query })
    const { container } = render({ setup: () => () => h('view', null, [h(Table, { data: [{ a: 'a0', b: 'b0' }, { a: 'a1', b: 'b1' }] }, { default: () => [h(TableColumn, { prop: 'a', label: 'A', width: widths.value, fixed: true }), h(TableColumn, { prop: 'b', label: 'B' })] })]) } as any)
    await frames()
    pending.splice(0).forEach((complete) => complete()); await frames()
    pending.splice(0).forEach((complete) => complete()); await frames()
    const columns = container.querySelectorAll('.wd-table-column')
    expect((columns[0].querySelectorAll('.wd-table__cell')[0] as HTMLElement).style.height).toBe('90px')
    expect((columns[1].querySelectorAll('.wd-table__cell')[1] as HTMLElement).style.top).toBe('90px')
    expect(element(container, '.wd-table__body').style.height).toBe('160px')
    query.mockClear()
    fireEvent.scroll(element(container, 'scroll-view'), { detail: { scrollLeft: 25 } }); await frames()
    expect(query).not.toHaveBeenCalled()
    heights[0][1] = 120; widths.value = 100; await frames()
    pending.splice(0).forEach((complete) => complete()); await frames()
    expect(element(container, '.wd-table__body').style.height).toBe('210px')
    cleanup()
    pending.splice(0).forEach((complete) => complete()); await frames()
    expect((globalThis as any).lynxTestingEnv.jsdom.window.document.querySelector('.wd-table')).toBeNull()
  })

  it('renders fixed shadows only on the final fixed column and clears offsets after reactive unfix', async () => {
    const fixed = ref(true)
    const { container } = render({ setup: () => () => h('view', null, [h(Table, { data: [{ a: 'a', b: 'b', c: 'c' }] }, { default: () => [h(TableColumn, { prop: 'a', label: 'A', width: 80, fixed: true }), h(TableColumn, { prop: 'b', label: 'B', width: 100, fixed: fixed.value }), h(TableColumn, { prop: 'c', label: 'C' })] })]) } as any)
    await frames()
    fireEvent.scroll(element(container, 'scroll-view'), { detail: { scrollLeft: 20 } }); await frames()
    const body = () => container.querySelectorAll('.wd-table-column')
    expect(body()[0].querySelector('.wd-table__shadow')).toBeNull()
    expect(body()[1].querySelector('.wd-table__shadow')).not.toBeNull()
    expect((body()[1] as HTMLElement).style.left).toBe('80px')
    expect(container.querySelectorAll('.wd-table__header .wd-table__shadow')).toHaveLength(1)
    fixed.value = false; await frames()
    expect(body()[0].querySelector('.wd-table__shadow')).not.toBeNull()
    expect(body()[1].querySelector('.wd-table__shadow')).toBeNull(); expect((body()[1] as HTMLElement).style.left).toBe('auto')
    fireEvent.scroll(element(container, 'scroll-view'), { detail: { scrollLeft: 0 } }); await frames()
    expect(container.querySelectorAll('.wd-table__shadow')).toHaveLength(0)
    expect(css('wd-table-column')).toContain('.wd-table-column .wd-table__shadow')
  })

  it('reacts to index config/header/height/fixed switches and converts official default 100rpx', async () => {
    const index = ref<any>(true), height = ref<string | number | undefined>(200), header = ref(true), fixed = ref(true)
    const { container } = render({ setup: () => () => h('view', null, [h(Table, { data: [{ a: 'a' }], index: index.value, height: height.value, showHeader: header.value, fixedHeader: fixed.value }, { default: () => h(TableColumn, { prop: 'a', label: 'A' }) })]) } as any)
    await frames()
    expect(element(container, '.wd-table-column').style.width).toBe(addUnit('100rpx'))
    index.value = { label: 'No.', width: 70, align: 'right', fixed: true }; await frames()
    expect(element(container, '.wd-table-column').style.width).toBe('70px')
    expect(element(container, '.wd-table__header').textContent).toContain('No.')
    fixed.value = false; height.value = undefined; await frames()
    expect(element(container, '.wd-table__header').classList.contains('is-sticky')).toBe(false)
    expect(element(container, 'scroll-view').style.maxHeight).toBe('none')
    index.value = false; header.value = false; await frames()
    expect(container.querySelector('.wd-table__header')).toBeNull(); expect(container.querySelectorAll('.wd-table-column')).toHaveLength(1)
  })

  it('virtual scrolling preserves actual row indexes/offsets with no measurements in the scroll path', async () => {
    const rowClick = vi.fn(), data = Array.from({ length: 50 }, (_, index) => ({ a: `row${index}` }))
    const { container } = render({ setup: () => () => h('view', null, [h(Table, { data, virtual: true, height: 88, rowHeight: 44, buffer: 1, onRowClick: rowClick }, { default: () => h(TableColumn, { prop: 'a', label: 'A' }) })]) } as any)
    await frames()
    const query = vi.spyOn((globalThis as any).lynx, 'createSelectorQuery')
    fireEvent.scroll(element(container, 'scroll-view'), { detail: { scrollTop: 440, scrollLeft: 10 } }); await frames()
    const first = element(container, '.wd-table-column .wd-table__cell')
    expect(first.textContent).toBe('row9'); expect(first.style.top).toBe('396px'); expect(first.style.height).toBe('44px')
    expect(element(container, '.wd-table__body').style.height).toBe('2200px')
    fireEvent.tap(first); expect(rowClick).toHaveBeenCalledWith({ rowIndex: 9 }); expect(query).not.toHaveBeenCalled()
  })

  it('resolves row-height constraints and normalizes invalid spans without shifting hidden tracks', () => {
    const rows = resolveTableRows(3, 44, false, [{ rowIndex: 0, rowspan: 1, height: 60 }, { rowIndex: 1, rowspan: 1, height: 80 }, { rowIndex: 0, rowspan: 2, height: 180 }])
    expect(rows.heights).toEqual([80, 100, 44]); expect(rows.offsets).toEqual([0, 80, 180, 224])
    expect(resolveTableRows(2, 50, true, [{ rowIndex: 0, rowspan: 1, height: 100 }]).heights).toEqual([50, 50])
    expect(normalizeTableSpan(undefined)).toEqual({ rowspan: 1, colspan: 1 })
    expect(normalizeTableSpan({ rowspan: 0, colspan: 0 })).toEqual({ rowspan: 0, colspan: 0 })
    expect(normalizeTableSpan({ rowspan: -1, colspan: NaN })).toEqual({ rowspan: 1, colspan: 1 })
  })
})

describe('local-only extensions (not official wot 2.3.2 parity)', () => {
  it('classifies four nonofficial components and the official empty wot-ui placeholder', () => {
    for (const name of ['wd-address-edit', 'wd-submit-bar', 'wd-share-sheet', 'wd-coupon']) {
      expect(existsSync(resolve(__dirname, `../../../.wot-ref/src-2.3.2/components/${name}/${name}.vue`))).toBe(false)
    }
    const reference = readFileSync(resolve(__dirname, '../../../.wot-ref/src-2.3.2/components/wot-ui/wot-ui.vue'), 'utf8')
    expect(reference).toContain('<view></view>')
  })

  it('keeps wot-ui empty placeholder and its local class/style convenience explicit', () => {
    const { container } = render({ setup: () => () => h('view', null, [h(WotUi, { customClass: 'custom-ui', customStyle: 'padding: 4px;' }, { default: () => text('ignored slot') })]) } as any)
    expect(element(container, '.wot-ui').classList.contains('custom-ui')).toBe(true)
    expect(element(container, '.wot-ui').style.padding).toBe('4px'); expect(element(container, '.wot-ui').childElementCount).toBe(0)
    expect(css('wot-ui')).toContain('.wot-ui'); expect(css('wot-ui')).not.toContain('.wd-wot-ui')
  })

  it('shows numeric zero/decimal prices, slots, button flags and no-argument submit', async () => {
    const price = ref<string | number>(0), disabled = ref(false), loading = ref(false), show = ref(true), submit = vi.fn()
    const { container } = render({ setup: () => () => h('view', null, [h(SubmitBar, { price: price.value, label: 'total', safeAreaInsetBottom: false, buttonDisabled: disabled.value, buttonLoading: loading.value, showButton: show.value, onSubmit: submit }, { left: () => text('left slot'), default: () => text('main slot') })]) } as any)
    expect(element(container, '.wd-submit-bar__price-integer').textContent).toBe('0')
    expect(element(container, '.wd-submit-bar').style.paddingBottom).toBe('8px')
    fireEvent.tap(element(container, '.wd-submit-bar__button')); expect(submit.mock.calls).toEqual([[]])
    price.value = '12.30'; disabled.value = true; await frames(); expect(element(container, '.wd-submit-bar__price-decimal').textContent).toBe('.30')
    fireEvent.tap(element(container, '.wd-submit-bar__button')); expect(submit).toHaveBeenCalledTimes(1)
    disabled.value = false; loading.value = true; await frames(); fireEvent.tap(element(container, '.wd-submit-bar__button')); expect(submit).toHaveBeenCalledTimes(1)
    show.value = false; price.value = ''; await frames(); expect(container.querySelector('.wd-submit-bar__button')).toBeNull(); expect(container.querySelector('.wd-submit-bar__price')).toBeNull()
    expect(container.textContent).toContain('left slot'); expect(container.textContent).toContain('main slot')
  })

  it('address actions clone snapshots, watch edits, obey visibility and disabled flags', async () => {
    const address = ref({ name: 'Name', tel: '123', province: 'Province', city: 'City', county: 'County', addressDetail: 'Detail' }), disabled = ref(false), detail = ref(true)
    const save = vi.fn(), remove = vi.fn(), area = vi.fn()
    const { container } = render({ setup: () => () => h('view', null, [h(AddressEdit, { addressInfo: address.value, disabled: disabled.value, showDetail: detail.value, showDeleteButton: true, showPostalCode: true, showAreaCode: true, onSave: save, onDelete: remove, onChangeArea: area })]) } as any)
    await frames()
    fireEvent.tap(element(container, '.wd-address-edit__save-btn')); expect(save).toHaveBeenCalledWith(address.value)
    expect(save.mock.calls[0][0]).not.toBe(address.value)
    address.value.name = 'Changed'; await frames(); fireEvent.tap(element(container, '.wd-address-edit__delete-btn')); expect(remove.mock.calls[0][0].name).toBe('Changed')
    fireEvent.tap(element(container, '.wd-cell')); expect(area).toHaveBeenCalledTimes(1)
    disabled.value = true; detail.value = false; await frames()
    fireEvent.tap(element(container, '.wd-address-edit__save-btn')); fireEvent.tap(element(container, '.wd-address-edit__delete-btn')); fireEvent.tap(element(container, '.wd-cell'))
    expect(save).toHaveBeenCalledTimes(1); expect(remove).toHaveBeenCalledTimes(1); expect(area).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.wd-textarea')).toBeNull()
  })

  it('share open/close change real popup state and modal policy honors false/true with exact ordering', async () => {
    const instance = ref<any>(), modal = ref(false), order: any[] = [], select = vi.fn()
    const option = { name: 'image', icon: 'https://example.com/icon.png' }, disabled = { name: 'disabled', icon: 'home', disabled: true }
    const { container } = render({ setup: () => () => h('view', null, [h(ShareSheet, { ref: instance, options: [option, disabled], closeOnClickModal: modal.value, duration: 0, customClass: 'custom-share', customStyle: 'padding: 7px', onSelect: select, onClickModal: () => order.push('modal'), onCancel: () => order.push('cancel'), 'onUpdate:modelValue': (value: boolean) => order.push(value) })]) } as any)
    instance.value.open(); await frames(4)
    expect(order).toEqual([true]); expect(container.querySelector('.custom-share')).not.toBeNull()
    expect(element(container, '.custom-share').style.padding).toBe('7px')
    expect(element(container, 'image').getAttribute('src')).toBe(option.icon)
    fireEvent.tap(container.querySelectorAll('.wd-share-sheet__option')[0]); fireEvent.tap(container.querySelectorAll('.wd-share-sheet__option')[1]); expect(select.mock.calls).toEqual([[{ option, index: 0 }]])
    fireEvent.tap(element(container, '.wd-overlay')); await frames(); expect(order).toEqual([true, 'modal'])
    modal.value = true; await frames(); fireEvent.tap(element(container, '.wd-overlay')); await frames(); expect(order).toEqual([true, 'modal', 'modal', false])
    instance.value.open(); await frames(); fireEvent.tap(element(container, '.wd-share-sheet__cancel')); await frames(); expect(order.slice(-2)).toEqual(['cancel', false])
    instance.value.open(); await frames(); instance.value.close(); await frames(); expect(order.slice(-2)).toEqual([true, false])
  })

  it('coupon selection index, descriptions, dates and global disabled state apply reactively', async () => {
    const chosen = ref(1), disabled = ref(false), change = vi.fn()
    const coupons = [{ id: 'a', name: 'A', value: 10, chosen: true }, { id: 'b', name: 'B', value: 8, unit: 'discount', valueDesc: '八', unitDesc: '折扣', startAt: 1704067200, endAt: 1706745600 }]
    const { container } = render({ setup: () => () => h('view', null, [h(Coupon, { coupons, chosenCoupon: chosen.value, disabledCoupons: disabled.value, onChange: change })]) } as any)
    const items = () => container.querySelectorAll('.wd-coupon__item')
    expect(items()[0].classList.contains('wd-coupon__item--chosen')).toBe(false); expect(items()[1].classList.contains('wd-coupon__item--chosen')).toBe(true)
    expect(items()[1].textContent).toContain('八折扣'); expect(items()[1].textContent).toContain('2024.')
    fireEvent.tap(items()[0]); expect(change).toHaveBeenCalledWith({ coupon: coupons[0], index: 0 })
    chosen.value = 0; disabled.value = true; await frames(); expect(items()[0].classList.contains('wd-coupon__item--chosen')).toBe(true)
    expect(items()[1].classList.contains('wd-coupon__item--disabled')).toBe(true)
    fireEvent.tap(items()[1]); expect(change).toHaveBeenCalledTimes(1)
  })

  it('coupon exchange guards minimum length and clears only after emitting the entered code', async () => {
    const exchange = vi.fn()
    const { container } = render({ setup: () => () => h('view', null, [h(Coupon, { showExchangeBar: true, exchangeMinLength: 3, onExchange: exchange })]) } as any)
    const input = element(container, 'input'), button = element(container, '.wd-coupon__exchange-btn')
    fireEvent.input(input, { detail: { value: 'ab' } }); await frames(); fireEvent.tap(button); expect(exchange).not.toHaveBeenCalled()
    fireEvent.input(input, { detail: { value: 'abc' } }); await frames(); fireEvent.tap(button); await frames(); expect(exchange.mock.calls).toEqual([['abc']])
    expect(button.classList.contains('is-disabled')).toBe(true)
  })
})

describe('compiled non-theme layout structure', () => {
  it('retains real inset separators, card final margin, divider half-scale and table tracks', () => {
    expect(css('wd-cell')).toContain('.wd-cell__border'); expect(css('wd-cell')).toContain('--wot-cell-border-margin-horizontal')
    expect(css('wd-card')).toContain('.wd-card.is-last'); expect(css('wd-card')).toContain('.wd-card__border--footer')
    expect(css('wd-divider')).toContain('scaleY(0.5)'); expect(css('wd-divider')).toContain('scaleX(0.5)')
    expect(css('wd-table-column')).toMatch(/\.wd-table-column \.wd-table__cell\s*\{[^}]*position:\s*absolute/s)
    expect(css('wd-table')).toContain('.wd-table__shadow')
    for (const name of ['wd-grid', 'wd-grid-item', 'wd-row', 'wd-col', 'wd-cell', 'wd-cell-group', 'wd-card', 'wd-table', 'wd-table-column', 'wd-divider', 'wd-gap']) {
      expect(css(name)).not.toMatch(/display:\s*(grid|contents|inline-flex|inline-block)/)
      expect(css(name)).not.toMatch(/::(before|after)|:last-child|:first-child/)
    }
  })
})

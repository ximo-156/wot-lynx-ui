import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { h, nextTick, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import Icon from '../../src/primitives/wd-icon/wd-icon.vue'
import Grid from '../../src/components/wd-grid/wd-grid.vue'
import GridItem from '../../src/components/wd-grid-item/wd-grid-item.vue'
import Pagination from '../../src/components/wd-pagination/wd-pagination.vue'
import { hasIcon, registerIconSet, resolveIcon } from '../../src/icons/registry'
import { iconProps as officialIcon } from '../../../../.wot-ref/src-2.3.2/components/wd-icon/types'
import { gridProps as officialGrid } from '../../../../.wot-ref/src-2.3.2/components/wd-grid/types'
import { gridItemProps as officialGridItem } from '../../../../.wot-ref/src-2.3.2/components/wd-grid-item/types'
import { paginationProps as officialPagination } from '../../../../.wot-ref/src-2.3.2/components/wd-pagination/types'
import { wotIconsSet } from '../../src/icons/sets/wot-icons'

async function frames() {
  for (let i = 0; i < 3; i++) {
    await nextTick()
    await new Promise((done) => setTimeout(done, 0))
  }
}
const node = (container: Element, selector: string) => container.querySelector(selector)! as HTMLElement
const contract = (definition: any) => {
  const prop = definition && typeof definition === 'object' && !Array.isArray(definition) ? definition : { type: definition }
  return {
    types: (Array.isArray(prop.type) ? prop.type : [prop.type]).map((type: any) => type?.name).sort(),
    required: Boolean(prop.required),
    default: typeof prop.default === 'function' && prop.type !== Function ? prop.default() : prop.default
  }
}
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('icon / grid / pagination independent official 2.3.2 audit', () => {
  it.each([
    ['icon', Icon, officialIcon], ['grid', Grid, officialGrid],
    ['grid-item', GridItem, officialGridItem], ['pagination', Pagination, officialPagination]
  ])('%s matches official prop names, defaults and constructors', (_, component: any, official: any) => {
    expect(Object.keys(component.props).sort()).toEqual(Object.keys(official).sort())
    for (const key of Object.keys(official)) {
      if (key === 'customStyle') { expect(contract(component.props[key]).default).toEqual(contract(official[key]).default); continue }
      expect(contract(component.props[key]), key).toEqual(contract(official[key]))
    }
  })

  it('official 305 glyph names and codepoints come from the actual offline stylesheet, with identical font bytes', () => {
    const reference = resolve(__dirname, '../../../../.wot-ref/src-2.3.2/components/wd-icon')
    const source = readFileSync(resolve(reference, 'iconfont.scss'), 'utf8')
    const expected = Object.fromEntries([...source.matchAll(/\.wd-icon-([^:]+):before\s*\{\s*content:\s*"\\([\da-f]+)";/g)].map((match) => [match[1], match[2]]))
    expect(Object.keys(expected)).toHaveLength(305)
    expect(wotIconsSet.unicodes).toEqual(expected)
    expect(readFileSync(resolve(__dirname, '../../src/icons/fonts/wot-icons.ttf'))).toEqual(readFileSync(resolve(reference, 'iconfont.ttf')))
  })

  it('never resolves inherited Object keys as glyphs or SVG paths', () => {
    registerIconSet({ key: 'audit-prototype-svg', type: 'svg', viewBox: '0 0 10 10', paths: { actual: 'M0 0h10v10z' } })
    for (const name of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      expect(resolveIcon(name), name).toBeNull()
      expect(hasIcon(name), name).toBe(false)
      expect(resolveIcon(`wot:${name}`)).toBeNull()
      expect(resolveIcon(`audit-prototype-svg:${name}`)).toBeNull()
    }
  })

  it('updates an already mounted icon on late registration and same-key replacement, including font-to-SVG', async () => {
    const { container } = render(Icon, { name: 'audit-live:late', size: 22 })
    expect(container.querySelector('text')).toBeNull()
    registerIconSet({ key: 'audit-live', type: 'font', fontFamily: 'audit-font', unicodes: { late: 'e001' } })
    await frames()
    const glyph = node(container, 'text')
    expect(glyph.textContent).toBe('\ue001')
    expect(glyph.style.fontFamily).toBe('audit-font')
    registerIconSet({ key: 'audit-live', type: 'font', fontFamily: 'audit-next', unicodes: { late: 'e002' } })
    await frames()
    expect(node(container, 'text').textContent).toBe('\ue002')
    expect(node(container, 'text').style.fontFamily).toBe('audit-next')
    registerIconSet({ key: 'audit-live', type: 'svg', viewBox: '0 0 10 10', paths: { late: ['M0 0h10', 'M0 0v10'] } })
    await frames()
    expect(container.querySelector('text')).toBeNull()
    expect(node(container, 'svg').getAttribute('content')).toContain('viewBox="0 0 10 10"')
    expect(node(container, 'svg').getAttribute('content')!.match(/<path/g)).toHaveLength(2)
  })

  it('renders registered supplementary-plane codepoints without truncating to 16 bits', () => {
    registerIconSet({ key: 'audit-unicode', type: 'font', fontFamily: 'audit-unicode', unicodes: { smile: '1f600' } })
    const { container } = render(Icon, { name: 'audit-unicode:smile' })
    expect(node(container, 'text').textContent).toBe(String.fromCodePoint(0x1f600))
  })

  it('preserves image/CSS/font modes, customStyle precedence and click/tap payloads through changes', async () => {
    const name = ref('https://example.com/icon.png'), cssIcon = ref<boolean | string>(false)
    const size = ref<number | undefined>(24), color = ref<string | undefined>('red')
    const customStyle = ref<any>({ width: '30px', opacity: '0.5', color: 'blue' })
    const click = vi.fn(), tap = vi.fn()
    const { container } = render({ setup: () => () => h(Icon, { name: name.value, cssIcon: cssIcon.value, size: size.value, color: color.value, customStyle: customStyle.value, onClick: click, onTap: tap }) })
    const root = node(container, '.wd-icon')
    expect(root.style.width).toBe('30px'); expect(root.style.height).toBe('24px'); expect(root.style.color).toBe('blue')
    expect(node(container, 'image').getAttribute('src')).toBe(name.value)
    fireEvent.tap(root, { detail: { audit: true } })
    expect(click).toHaveBeenCalledTimes(1); expect(tap).toHaveBeenCalledTimes(1)
    expect(click.mock.calls[0][0]).toBe(tap.mock.calls[0][0])
    cssIcon.value = 'audit-css'; await frames()
    expect(root.classList.contains('audit-css')).toBe(true); expect(container.querySelector('image')).toBeNull()
    cssIcon.value = false; name.value = 'left'; size.value = undefined; color.value = undefined; customStyle.value = ''; await frames()
    expect(root.style.width).toBe(''); expect(root.style.height).toBe(''); expect(root.style.color).toBe(''); expect(root.style.opacity).toBe(''); expect(root.style.fontSize).toBe('')
    expect(node(container, 'text').textContent).toBe(String.fromCodePoint(parseInt(wotIconsSet.unicodes.left, 16)))
  })

  it.each([['grid', Grid, '.wd-grid'], ['grid-item', GridItem, '.wd-grid-item'], ['pagination', Pagination, '.wd-pagination']])('%s clears removed customStyle keys on the same native element', async (_, component: any, selector) => {
    const customStyle = ref<any>({ opacity: '0.5', paddingLeft: '19px' })
    const { container } = render({ setup: () => () => h('view', null, [h(component, { ...(component === Pagination ? { modelValue: 1, totalPage: 3 } : {}), customStyle: customStyle.value })]) })
    const root = node(container, selector as string)
    expect(root.style.opacity).toBe('0.5'); expect(root.style.paddingLeft).toBe('19px')
    customStyle.value = 'opacity: 0.7'; await frames()
    expect(node(container, selector as string)).toBe(root)
    expect(root.style.opacity).toBe('0.7')
    expect(root.style.paddingLeft).toBe(component === Grid ? '0px' : '')
    customStyle.value = ''; await frames()
    expect(root.style.opacity).toBe('')
  })

  it('renders real grid border lines and avoids default-slot spacing, matching reference adjacency behavior', async () => {
    const { container } = render({ setup: () => () => h(Grid, { column: 2, border: true }, () => Array.from({ length: 5 }, (_, index) => h(GridItem, { key: index, text: String(index), icon: index === 0 ? 'home' : '' }))) })
    await frames()
    expect(container.querySelectorAll('.wd-grid-item__line--top')).toHaveLength(3)
    expect(container.querySelectorAll('.wd-grid-item__line--right')).toHaveLength(2)
    expect(container.querySelectorAll('.wd-grid-item__text.is-spaced')).toHaveLength(1)
    const scss = readFileSync(resolve(__dirname, '../../src/components/wd-grid-item/index.scss'), 'utf8')
    expect(scss).toMatch(/gap:\s*0/)
    expect(scss).toContain('.wd-grid-item__text.is-spaced')
  })
})

/** The exact province/city/district header from the reported screenshot. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, ref } from 'vue-lynx'
import { compile } from 'sass'
import postcss from 'postcss'
import path from 'node:path'
import Cascader from '../../src/components/wd-cascader/wd-cascader.vue'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import { restoreNativeStubs, stubNativeQuery } from '../helpers/native-stubs'

const options = [
  { value: 'zj', text: '浙江省', children: [
    { value: 'hz', text: '杭州市', children: [{ value: 'xh', text: '西湖区' }, { value: 'bj', text: '滨江区' }] },
    { value: 'nb', text: '宁波市', children: [{ value: 'jb', text: '江北区' }] }
  ] },
  { value: 'js', text: '江苏省', children: [{ value: 'nj', text: '南京市', children: [{ value: 'xw', text: '玄武区' }] }] }
]
const rect = (left: number, width: number, height = 44) => ({ left, width, height, top: 0, bottom: height, right: left + width })
function installGeometry() {
  const widths = [96, 84, 110]
  return stubNativeQuery(selector => {
    if (selector.endsWith('-nav')) return rect(50, 390)
    const item = /-(item|text)-(\d+)$/.exec(selector)
    if (!item) return rect(50, 390)
    const index = Number(item[2])
    const left = 50 + widths.slice(0, index).reduce((a, b) => a + b, 0)
    return rect(left, item[1] === 'text' ? widths[index] - 32 : widths[index])
  })
}
function activeIndex(container: Element) {
  return [...container.querySelectorAll('.wd-tabs__nav-item')].findIndex(item => item.classList.contains('is-active'))
}
function header(container: Element) {
  return [...container.querySelectorAll('.wd-tabs__nav-item-text')].map(item => item.textContent)
}
function expectAligned(container: Element, index: number, text: string) {
  expect(activeIndex(container)).toBe(index)
  expect(header(container)[index]).toBe(text)
  const anchor = container.querySelector('.wd-tabs__line-anchor') as HTMLElement
  const marker = container.querySelector('.wd-tabs__line') as HTMLElement
  expect(anchor.style.display).toBe('flex')
  expect(anchor.style.transform).toBe(`translateX(${[0, 96, 180][index]}px)`)
  expect(anchor.style.width).toBe(`${[96, 84, 110][index]}px`)
  expect(marker.style.transform).toBe('none')
}
async function tapOption(container: Element, title: string) {
  const pane = container.querySelectorAll('.wd-tab')[activeIndex(container)]
  const item = [...pane.querySelectorAll('.wd-cascader__list-item')].find(item => item.querySelector('.wd-cascader__list-item-label')?.textContent === title)
  expect(item, `missing current option ${title}`).not.toBeUndefined()
  fireEvent.tap(item!)
  await vi.advanceTimersByTimeAsync(120)
}

afterEach(() => { cleanup(); restoreNativeStubs(); vi.useRealTimers() })

describe('cascader header alignment', () => {
  it('follows province → city → district and a return to an earlier level', async () => {
    vi.useFakeTimers()
    installGeometry()
    const beforeConfirm = vi.fn(() => false)
    const { container } = render(Cascader, { visible: true, options, beforeConfirm })
    await vi.advanceTimersByTimeAsync(240)
    expectAligned(container, 0, '请选择')
    await tapOption(container, '浙江省')
    expect(header(container)).toEqual(['浙江省', '请选择'])
    expectAligned(container, 1, '请选择')
    await tapOption(container, '杭州市')
    expect(header(container)).toEqual(['浙江省', '杭州市', '请选择'])
    expectAligned(container, 2, '请选择')
    await tapOption(container, '西湖区')
    expect(header(container)).toEqual(['浙江省', '杭州市', '西湖区'])
    expectAligned(container, 2, '西湖区')
    expect(beforeConfirm).toHaveBeenCalledOnce()
    fireEvent.tap(container.querySelectorAll('.wd-tabs__nav-item')[0])
    await vi.advanceTimersByTimeAsync(120)
    expectAligned(container, 0, '浙江省')
    await tapOption(container, '江苏省')
    expect(header(container)).toEqual(['江苏省', '请选择'])
    expectAligned(container, 1, '请选择')
  })

  it('reopens a committed leaf with the district indicator, not the first label', async () => {
    vi.useFakeTimers()
    installGeometry()
    const visible = ref(true)
    const value = ref<string | number>('xh')
    const { container } = render({ setup: () => () => h(Cascader, {
      modelValue: value.value, visible: visible.value, options,
      'onUpdate:modelValue': (next: string | number) => { value.value = next },
      'onUpdate:visible': (next: boolean) => { visible.value = next }
    }) })
    await vi.advanceTimersByTimeAsync(240)
    expect(header(container)).toEqual(['浙江省', '杭州市', '西湖区'])
    expectAligned(container, 2, '西湖区')
    await tapOption(container, '滨江区')
    expect(value.value).toBe('bj')
    expect(visible.value).toBe(false)
    await vi.advanceTimersByTimeAsync(400)
    visible.value = true
    await vi.advanceTimersByTimeAsync(240)
    expect(header(container)).toEqual(['浙江省', '杭州市', '滨江区'])
    expectAligned(container, 2, '滨江区')
  })

  it('uses native flex centering for theme-owned widths and a spacer for vertical alignment', () => {
    const css = postcss.parse(compile(path.resolve(__dirname, '../../src/components/wd-tabs/index.scss')).css)
    const rule = (selector: string) => {
      const declarations: Record<string, string> = {}
      css.walkRules(candidate => {
        if (!candidate.selectors.includes(selector)) return
        candidate.walkDecls(decl => { declarations[decl.prop] = decl.value })
      })
      return declarations
    }
    const anchor = rule('.wd-tabs__line-anchor')
    expect(anchor.display).toBe('flex')
    expect(anchor['flex-direction']).toBe('column')
    expect(anchor['align-items']).toBe('center')
    expect(anchor['box-sizing']).toBe('border-box')
    expect(anchor['pointer-events']).toBe('none')
    expect(anchor['padding-bottom']).toContain('--wot-tabs-nav-line-bottom')
    expect(rule('.wd-tabs__line-spacer')['flex-grow']).toBe('1')
    expect(rule('.wd-tabs__line').position).toBe('relative')
    expect(rule('.wd-tabs__line')['flex-shrink']).toBe('0')
    expect(rule('.wd-tabs__line.is-normal').width).toContain('--wot-tabs-nav-line-width')
  })
})

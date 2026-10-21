/**
 * 宫格 / 分页视觉回归：锁定 wot-ui 2.3.2 的取值，不靠改演示页遮盖布局缺陷。
 * CSS 从 build-css.mjs 的产物读取；JSDOM 不做原生布局，宽高视觉验收由浏览器
 * 补充。动态 props、插槽与 tap 经 Vue Lynx 双线程管线真实执行。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { h, nextTick, ref } from 'vue-lynx'
import { cleanup, render } from './render'
import { fireEvent } from './fire-event'
import Grid from '../src/components/wd-grid/wd-grid.vue'
import GridItem from '../src/components/wd-grid-item/wd-grid-item.vue'
import Pagination from '../src/components/wd-pagination/wd-pagination.vue'

type Declarations = Record<string, string>
const componentDir = join(__dirname, '..', 'src', 'components')

function cssRules(component: string) {
  const css = readFileSync(join(componentDir, component, 'index.css'), 'utf8')
  return Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), ([, selector, body]) => {
    const declarations: Declarations = {}
    for (const declaration of body.split(';')) {
      const separator = declaration.indexOf(':')
      if (separator > 0) declarations[declaration.slice(0, separator).trim()] = declaration.slice(separator + 1).trim()
    }
    return { selector: selector.trim(), declarations }
  })
}

function rule(component: string, selector: string): Declarations {
  const matches = cssRules(component).filter((item) => item.selector.split(',').includes(selector))
  expect(matches.length, `${component}: ${selector}`).toBeGreaterThan(0)
  return Object.assign({}, ...matches.map((item) => item.declarations))
}

/** 展开生成物的 --csslib-* 局部变量与嵌套 fallback；不依赖忽略的参考源码。 */
function resolveCss(value: string, variables: Declarations): string {
  let resolved = value
  for (let i = 0; i < 40 && resolved.includes('var('); i++) {
    const previous = resolved
    resolved = resolved.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g,
      (_, name, fallback) => variables[name] ?? fallback ?? `unresolved:${name}`)
    if (resolved === previous) break
  }
  return resolved.trim()
}

function cssValue(declarations: Declarations, property: string, overrides: Declarations = {}) {
  return resolveCss(declarations[property], { ...declarations, ...overrides })
}

async function flush() {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

afterEach(cleanup)

describe('分页：wot 2.3.2 尺寸与横向排版', () => {
  it('根保留块级全宽，页码为一行居中而不是三个 linear 行', () => {
    const root = rule('wd-pagination', '.wd-pagination')
    expect(root.width).toBe('100%')
    expect(root['box-sizing']).toBe('border-box')
    expect(root['flex-shrink']).toBe('0')
    expect(cssValue(root, 'padding')).toBe('12px')
    const content = rule('wd-pagination', '.wd-pagination__content')
    expect(content.display).toBe('flex')
    expect(content['flex-direction']).toBe('row')
    expect(content['align-items']).toBe('center')
    const size = rule('wd-pagination', '.wd-pagination__size')
    expect(size.display).toBe('flex')
    expect(size['flex-direction']).toBe('row')
    expect(size['justify-content']).toBe('center')
    expect(size['align-items']).toBe('center')
    expect(cssValue(size, 'font-size')).toBe('18px')
    expect(cssValue(size, 'line-height')).toBe('26px')
    expect(cssValue(rule('wd-pagination', '.wd-pagination__separator'), 'margin')).toBe('0px 4px')
  })

  it('图标分页按钮实际最小宽度为64px，胜过按钮32px规则且仍可主题定制', () => {
    const { container } = render(Pagination, { modelValue: 1, totalPage: 6, showIcon: true })
    const nav = container.querySelector('.wd-pagination__nav')!
    expect(container.querySelectorAll('.wd-pagination__nav.wd-button')).toHaveLength(2)
    expect(container.querySelectorAll('.wd-pagination__nav .wd-icon')).toHaveLength(2)
    // 以最不利样式顺序（分页在前、按钮在后）模拟真实特异性竞争。
    const matching = ['wd-pagination', 'wd-button'].flatMap(cssRules).flatMap((item) =>
      item.selector.split(',').filter((selector) => item.declarations['min-width'] && nav.matches(selector))
        .map((selector) => ({ ...item, classes: (selector.match(/\.[\w-]+/g) || []).length }))
    )
    expect(matching.some((item) => cssValue(item.declarations, 'min-width') === '32px')).toBe(true)
    matching.sort((a, b) => a.classes - b.classes)
    const winner = matching[matching.length - 1]!
    expect(winner.classes).toBeGreaterThan(3)
    expect(cssValue(winner.declarations, 'min-width')).toBe('64px')
    expect(cssValue(winner.declarations, 'min-width', { '--wot-pagination-nav-width': '80px' })).toBe('80px')
    expect(winner.declarations['flex-shrink']).toBe('0')
  })

  it('辅助文案14px/20px、上间距4px，三个参考片段组成一个连续文本行', () => {
    const messageRule = rule('wd-pagination', '.wd-pagination__message')
    expect(cssValue(messageRule, 'font-size')).toBe('14px')
    expect(cssValue(messageRule, 'line-height')).toBe('20px')
    expect(cssValue(messageRule, 'margin-top')).toBe('4px')
    const { container } = render(Pagination, { modelValue: 2, total: 100, showMessage: true })
    const message = container.querySelector('.wd-pagination__message')!
    expect(message.querySelectorAll('text')).toHaveLength(1)
    expect(message.querySelector('.wd-pagination__message-text')).toBeTruthy()
    expect(rule('wd-pagination', '.wd-pagination__message-text').color).toBe('inherit')
    expect(message.textContent).toBe('当前页：2，当前数据：100条，分页大小：10')
    const noTotal = render(Pagination, { modelValue: 2, totalPage: 6, showMessage: true })
    expect(noTotal.container.querySelector('.wd-pagination__message')!.textContent).toBe('当前页：2，分页大小：10')
  })
})

describe('分页：响应式计数、插槽与 tap 契约', () => {
  it('totalPage 更新、total 优先及total清零均立即更新总页数', async () => {
    const totalPage = ref(6)
    const total = ref(0)
    const { container } = render({
      setup: () => () => h(Pagination, { modelValue: 1, totalPage: totalPage.value, total: total.value })
    })
    const totalText = () => container.querySelector('.wd-pagination__total')!.textContent
    expect(totalText()).toBe('6')
    totalPage.value = 8
    await flush()
    expect(totalText()).toBe('8')
    total.value = 25
    await flush()
    expect(totalText()).toBe('3')
    totalPage.value = 5
    await flush()
    expect(totalText()).toBe('3')
    total.value = 0
    await flush()
    expect(totalText()).toBe('5')
  })

  it('pageSize 更新重新计算总页数、禁用状态和文案，不留旧watch结果', async () => {
    const pageSize = ref(10)
    const { container } = render({
      setup: () => () => h(Pagination, { modelValue: 2, total: 100, pageSize: pageSize.value, showMessage: true })
    })
    const next = () => container.querySelectorAll('.wd-pagination__nav')[1]!
    expect(container.querySelector('.wd-pagination__total')!.textContent).toBe('10')
    expect(next().classList.contains('is-disabled')).toBe(false)
    pageSize.value = 50
    await flush()
    expect(container.querySelector('.wd-pagination__total')!.textContent).toBe('2')
    expect(next().classList.contains('is-disabled')).toBe(true)
    expect(container.querySelector('.wd-pagination__message')!.textContent).toBe('当前页：2，当前数据：100条，分页大小：50')
  })

  it('hideIfOnePage 随总页数双向变化，默认缺省仍为一页', async () => {
    const totalPage = ref(1)
    const { container } = render({
      setup: () => () => h(Pagination, { modelValue: 1, totalPage: totalPage.value, hideIfOnePage: true })
    })
    expect(container.querySelector('.wd-pagination')).toBeNull()
    totalPage.value = 2
    await flush()
    expect(container.querySelector('.wd-pagination__total')!.textContent).toBe('2')
    totalPage.value = 1
    await flush()
    expect(container.querySelector('.wd-pagination')).toBeNull()
    const defaults = render(Pagination, { modelValue: 1 })
    expect(defaults.container.querySelector('.wd-pagination__total')!.textContent).toBe('1')
  })

  it('prev/size/next/message 插槽收到相同计算值且替换各自默认内容', () => {
    const seen: Record<string, any> = {}
    const names = ['prev', 'size', 'next', 'message']
    const slots = Object.fromEntries(names.map((name) => [name, (props: any) => {
      seen[name] = { ...props }
      return h('text', { class: `test-slot-${name}` }, name)
    }]))
    const { container } = render({
      setup: () => () => h(Pagination, { modelValue: 2, total: 25, pageSize: 10, totalPage: 8, showMessage: true }, slots)
    })
    for (const name of names) {
      expect(seen[name], `slot ${name}`).toEqual({ modelValue: 2, totalPageNum: 3, total: 25, pageSize: 10 })
      expect(container.querySelector(`.test-slot-${name}`)!.textContent).toBe(name)
    }
    expect(container.querySelector('.wd-pagination__nav')).toBeNull()
    expect(container.querySelector('.wd-pagination__size')).toBeNull()
    expect(container.querySelector('.wd-pagination__message')).toBeNull()
  })

  it('tap 翻页按change→update顺序发出，首尾禁用且文字/variant透传', async () => {
    const page = ref(1)
    const events: unknown[] = []
    const { container } = render({
      setup: () => () => h(Pagination, {
        modelValue: page.value, totalPage: 3, prevText: '前页', nextText: '后页', buttonVariant: 'plain',
        onChange: (value: unknown) => events.push(['change', value]),
        'onUpdate:modelValue': (value: number) => { events.push(['update', value]); page.value = value }
      })
    })
    const nav = (index: number) => container.querySelectorAll('.wd-pagination__nav')[index]!
    expect(nav(0).textContent).toBe('前页')
    expect(nav(1).textContent).toBe('后页')
    expect(nav(0).classList.contains('is-info')).toBe(true)
    expect(nav(1).classList.contains('is-primary')).toBe(true)
    expect(nav(1).classList.contains('is-plain')).toBe(true)
    fireEvent.tap(nav(0))
    expect(events).toEqual([])
    fireEvent.tap(nav(1))
    await flush()
    expect(events).toEqual([['change', { value: 2 }], ['update', 2]])
    fireEvent.tap(nav(1))
    await flush()
    expect(page.value).toBe(3)
    expect(nav(1).classList.contains('is-disabled')).toBe(true)
    fireEvent.tap(nav(1))
    expect(events).toHaveLength(4)
    fireEvent.tap(nav(0))
    await flush()
    expect(page.value).toBe(2)
    expect(events.slice(-2)).toEqual([['change', { value: 2 }], ['update', 2]])
  })
})

describe('宫格：保留参考视觉与动态布局', () => {
  it('未缩小图标画廊设计：文字16/24、图标32、内边距12、间距4', () => {
    const label = rule('wd-grid-item', '.wd-grid-item__text')
    expect(cssValue(label, 'font-size')).toBe('16px')
    expect(cssValue(label, 'line-height')).toBe('24px')
    const content = rule('wd-grid-item', '.wd-grid-item__content')
    expect(cssValue(content, 'padding')).toBe('12px 12px')
    expect(cssValue(content, 'gap')).toBe('0')
    expect(cssValue(rule('wd-grid-item', '.wd-grid-item__content .wd-grid-item__text.is-spaced'), 'margin-top')).toBe('4px')
    expect(cssValue(rule('wd-grid-item', '.wd-grid-item .wd-grid-item__icon'), 'font-size')).toBe('32px')
    expect(rule('wd-grid', '.wd-grid')['flex-wrap']).toBe('wrap')
  })

  it('5列每项20%，label样式和省略属性落在真实text而非无样式子text', async () => {
    const { container } = render({
      setup: () => () => h(Grid, { column: 5 }, {
        default: () => [h(GridItem, { icon: 'setting', text: 'arrow-left-bold', ellipsis: true, customText: 'test-label' })]
      })
    })
    await flush()
    const item = container.querySelector('.wd-grid-item') as HTMLElement
    expect(item.style.width).toBe('20%')
    expect(item.style.flexBasis).toBe('20%')
    const label = container.querySelector('.wd-grid-item__text')!
    expect(label.tagName.toLowerCase()).toBe('text')
    expect(label.classList.contains('test-label')).toBe(true)
    expect(label.classList.contains('is-ellipsis')).toBe(true)
    expect(label.getAttribute('text-maxline')).toBe('1')
    expect(container.querySelector('.wd-grid-item__icon.wd-icon')).toBeTruthy()
  })

  it('自动列数随子项数量更新；指定列数的边框位置对齐参考源', async () => {
    const count = ref(3)
    const { container } = render({
      setup: () => () => h(Grid, null, {
        default: () => Array.from({ length: count.value }, (_, index) => h(GridItem, { key: index, text: String(index) }))
      })
    })
    await flush()
    expect((container.querySelector('.wd-grid-item') as HTMLElement).style.width).toBe('33.333333333333336%')
    count.value = 2
    await flush()
    expect(container.querySelectorAll('.wd-grid-item')).toHaveLength(2)
    for (const item of container.querySelectorAll<HTMLElement>('.wd-grid-item')) expect(item.style.width).toBe('50%')
    const fixed = render({
      setup: () => () => h(Grid, { column: 2, border: true }, {
        default: () => Array.from({ length: 5 }, (_, index) => h(GridItem, { key: index, text: String(index) }))
      })
    })
    await flush()
    const items = Array.from(fixed.container.querySelectorAll('.wd-grid-item'))
    expect(items.filter((item) => item.classList.contains('is-first'))).toHaveLength(2)
    expect(items.map((item) => item.classList.contains('is-right'))).toEqual([false, true, false, true, true])
    expect(items.map((item) => item.classList.contains('is-border'))).toEqual([false, false, true, true, true])
    expect(items[4].classList.contains('is-last')).toBe(true)
  })

  it('同实例square/gutter切回时清除旧缩进、高度与行距，方向类响应式更新', async () => {
    const square = ref(true)
    const gutter = ref(8)
    const reverse = ref(false)
    const { container } = render({
      setup: () => () => h(Grid, { column: 2, square: square.value, gutter: gutter.value, reverse: reverse.value, direction: 'horizontal' }, {
        default: () => Array.from({ length: 3 }, (_, index) => h(GridItem, { key: index, text: String(index) }))
      })
    })
    await flush()
    const first = () => container.querySelector('.wd-grid-item__content') as HTMLElement
    expect(first().style.right).toBe('8px')
    expect(first().style.bottom).toBe('8px')
    expect(first().style.height).toBe('auto')
    gutter.value = 0
    await flush()
    expect(first().style.right).toBe('0px')
    expect(first().style.bottom).toBe('auto')
    expect(first().style.height).toBe('100%')
    expect((container.querySelector('.wd-grid') as HTMLElement).style.marginBottom).toBe('0px')
    gutter.value = 8
    await flush()
    square.value = false
    reverse.value = true
    await flush()
    expect(first().style.right).toBe('0px')
    expect(first().style.bottom).toBe('auto')
    expect(first().style.height).toBe('100%')
    expect(first().classList.contains('is-square')).toBe(false)
    expect(first().classList.contains('is-horizontal')).toBe(true)
    expect(first().classList.contains('is-reverse')).toBe(true)
    expect((container.querySelectorAll('.wd-grid-item')[2] as HTMLElement).style.marginTop).toBe('8px')
    gutter.value = 0
    await flush()
    expect((container.querySelectorAll('.wd-grid-item')[2] as HTMLElement).style.marginTop).toBe('0px')
  })
})

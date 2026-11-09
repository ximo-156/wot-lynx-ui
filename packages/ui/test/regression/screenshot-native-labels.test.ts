/** 原生截图文字布局回归；样式/节点契约不是 Android/iOS 像素验收。 */
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue-lynx'
import { compile } from 'sass'
import postcss from 'postcss'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render } from '../render'
import { restoreNativeStubs, stubNativeObserver, stubNativeQuery } from '../helpers/native-stubs'
import Circle from '../../src/components/wd-circle/wd-circle.vue'
import Sticky from '../../src/components/wd-sticky/wd-sticky.vue'

const here = path.dirname(fileURLToPath(import.meta.url))
const circleCss = postcss.parse(compile(path.resolve(here, '../../src/components/wd-circle/index.scss')).css)
function declarations(element: Element, sheet = circleCss) {
  const values: Record<string, string> = {}
  sheet.walkRules((rule) => {
    if (!rule.selectors.some((selector) => element.matches(selector))) return
    rule.walkDecls((decl) => { values[decl.prop] = decl.value })
  })
  return values
}
async function flush() { for (let i = 0; i < 6; i++) await nextTick() }
afterEach(() => { cleanup(); restoreNativeStubs() })

describe('Circle 百分比与插槽使用相同的居中容器', () => {
  it('65% 是居中 view 的文字子节点，size 变化同时改变明确的根尺寸', async () => {
    const size = ref(80)
    const text = ref('65%')
    const color = ref('#123456')
    const { container } = render(defineComponent(() => () => h(Circle, { size: size.value, text: text.value, color: color.value, modelValue: 65 })))
    const root = container.querySelector('.wd-circle') as HTMLElement
    const wrapper = root.querySelector('.wd-circle__text') as HTMLElement
    expect(wrapper.style.color).toBe('rgb(18, 52, 86)')
    const label = wrapper.querySelector('.wd-circle__label')!
    expect(wrapper.tagName.toLowerCase()).toBe('view')
    expect(label.tagName.toLowerCase()).toBe('text')
    expect(label.textContent).toBe('65%')
    expect(root.style.width).toBe('80px')
    expect(root.style.height).toBe('80px')
    const wrapperStyle = declarations(wrapper)
    expect(wrapperStyle).toMatchObject({ position: 'absolute', top: '0', bottom: '0', left: '0', right: '0', width: '100%', height: '100%', display: 'flex', 'align-items': 'center', 'justify-content': 'center' })
    expect(wrapperStyle['line-height']).toBeUndefined()
    expect(declarations(label).position).toBeUndefined()
    for (const property of ['line-height', 'font-size', 'color', 'text-align']) expect(declarations(label)[property]).toBeTruthy()
    size.value = 120
    text.value = '100%'
    color.value = '#755FFE'
    await flush()
    expect(wrapper.style.color).toBe('rgb(117, 95, 254)')
    expect(root.style.width).toBe('120px')
    expect(root.style.height).toBe('120px')
    expect(wrapper.querySelector('.wd-circle__label')?.textContent).toBe('100%')
  })

  it('普通文字插槽归一为有样式的 text，自定义 view 不被包进 text', async () => {
    const label = ref('进行中')
    const { container } = render(defineComponent(() => () => h(Circle, { size: 100 }, () => [
      label.value, h('view', { class: 'custom-circle-label' }, [h('text', null, '自定义结构')])
    ])))
    const wrapper = container.querySelector('view.wd-circle__text')!
    expect(wrapper.querySelector('text.wd-circle__label')?.textContent).toBe('进行中')
    expect(wrapper.querySelector('.custom-circle-label')?.parentElement).toBe(wrapper)
    label.value = '已完成'
    await flush()
    expect(wrapper.querySelector('text.wd-circle__label')?.textContent).toBe('已完成')
  })
})

it('Sticky 首次度量前保持内容在流中，不从零高占位反向约束文字', async () => {
  stubNativeObserver()
  const positions: string[] = []
  let root: HTMLElement | null = null
  stubNativeQuery((selector) => {
    if (selector.endsWith('-container')) positions.push(root?.style.position || '')
    return { width: 240, height: 40, left: 0, top: 80, right: 240, bottom: 120 }
  })
  const { container } = render(defineComponent(() => () => h(Sticky, {}, () => h('view', { style: { height: '40px' } }, [h('text', null, '吸顶标题')]))))
  root = container.querySelector('.wd-sticky') as HTMLElement
  expect(root.style.position).toBe('relative')
  expect(root.style.width).toBe('')
  expect(root.style.height).toBe('')
  await flush()
  expect(positions[0]).toBe('relative')
  expect(root.style.position).toBe('absolute')
  expect(root.style.height).toBe('40px')
  expect((container.querySelector('.wd-sticky__placeholder') as HTMLElement).style.height).toBe('40px')
})

it('Sticky/StickyBox 真机示例有独立滚动视口、固定高居中标签和直接文字行高', () => {
  const showcase = readFileSync(path.resolve(here, '../../../demo/src/showcase/Showcase.vue'), 'utf8')
  for (const name of ['wd-sticky', 'wd-sticky-box']) {
    const start = showcase.indexOf(`<DemoSection name="${name}"`)
    const section = showcase.slice(start, showcase.indexOf('</DemoSection>', start))
    expect(start).toBeGreaterThan(0)
    expect(section).toContain('<scroll-view scroll-orientation="vertical"')
    expect(section).toContain("overflow: 'hidden'")
    expect(section.match(/<text class="demo-sticky-label__text">/g)).toHaveLength(2)
  }
  const style = showcase.slice(showcase.indexOf('<style scoped>') + '<style scoped>'.length, showcase.indexOf('</style>'))
  const sheet = postcss.parse(style)
  // 用真实渲染元素匹配 class，避免把祖先继承或空文字节点当成直接声明。
  const { container } = render(defineComponent(() => () => h('view', { class: 'demo-sticky-label' }, [h('text', { class: 'demo-sticky-label__text' }, '标签')])))
  const wrapper = container.querySelector('.demo-sticky-label') || container
  const text = wrapper.querySelector('.demo-sticky-label__text')!
  expect(declarations(wrapper, sheet)).toMatchObject({ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', 'justify-content': 'center', height: '40px', 'flex-shrink': '0' })
  expect(declarations(text, sheet)).toMatchObject({ 'font-size': '13px', 'line-height': '20px', 'text-align': 'center' })
})

/**
 * 移动端文字出口回归。
 *
 * Vue Text vnode 会被运行时变成匿名原生 text，但没有组件的文字样式契约。
 * 这里同时检查真实双线程渲染树和 SCSS 编译后的直接声明：文字必须拿到
 * class/字号/颜色/行高，不能用 JSDOM 的“textContent 存在”代替真机可见性。
 * 不把声明检查当作像素布局或 Android/iOS 真机验收。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref, type Component } from 'vue-lynx'
import { compile } from 'sass'
import postcss, { type Root } from 'postcss'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { cleanup, render } from '../render'
import Tag from '../../src/components/wd-tag/wd-tag.vue'
import Radio from '../../src/components/wd-radio/wd-radio.vue'
import Checkbox from '../../src/components/wd-checkbox/wd-checkbox.vue'
import Divider from '../../src/components/wd-divider/wd-divider.vue'
import Loading from '../../src/primitives/wd-loading/wd-loading.vue'

const cases: Array<{ name: string; component: Component; path: string; wrapper: string; leaf: string; props?: Record<string, unknown> }> = [
  { name: 'Tag', component: Tag, path: 'components/wd-tag', wrapper: '.wd-tag__text', leaf: '.wd-tag__text-content' },
  { name: 'Radio', component: Radio, path: 'components/wd-radio', wrapper: '.wd-radio__label', leaf: '.wd-radio__label-text', props: { value: 'a' } },
  { name: 'Checkbox', component: Checkbox, path: 'components/wd-checkbox', wrapper: '.wd-checkbox__label', leaf: '.wd-checkbox__label-text', props: { modelValue: false } },
  { name: 'Divider', component: Divider, path: 'components/wd-divider', wrapper: '.wd-divider__content', leaf: '.wd-divider__text' },
  { name: 'Loading', component: Loading, path: 'primitives/wd-loading', wrapper: '.wd-loading__text', leaf: '.wd-loading__text-content' }
]
const sheets = new Map<string, Root>()

function declarations(element: Element, source: string): Record<string, string> {
  if (!sheets.has(source)) {
    const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src', source, 'index.scss')
    sheets.set(source, postcss.parse(compile(filename, { style: 'expanded' }).css))
  }
  const values: Record<string, string> = {}
  sheets.get(source)!.walkRules((rule) => {
    if (rule.parent?.type !== 'root' || !rule.selectors.some((selector) => element.matches(selector))) return
    rule.walkDecls((decl) => { values[decl.prop] = decl.value })
  })
  return values
}

afterEach(cleanup)

describe('移动端标签插槽的显式文字契约', () => {
  for (const item of cases) {
    it(`${item.name} 将普通插槽文案放进有明确排版的原生 text`, () => {
      const { container } = render(defineComponent(() => () => h(item.component, item.props, () => '移动端标签')))
      const wrapper = container.querySelector(item.wrapper)!
      const leaf = container.querySelector(item.leaf)!
      expect(leaf, `${item.name} 不能只依赖匿名 Text vnode 的祖先继承`).toBeTruthy()
      expect(leaf.tagName.toLowerCase()).toBe('text')
      expect(leaf.textContent).toBe('移动端标签')
      expect(wrapper.contains(leaf)).toBe(true)
      const style = declarations(leaf, item.path)
      for (const property of ['font-size', 'line-height', 'color']) {
        expect(style[property], `${item.name} 的 ${property} 必须直接声明在文字节点`).toBeTruthy()
        expect(style[property]).not.toMatch(/^(inherit|currentColor)$/i)
      }
      expect(declarations(wrapper, item.path)['line-height'], 'view 不应再与内部 text 叠加行高').toBeUndefined()
    })

    it(`${item.name} 保留动态文字和自定义结构插槽`, async () => {
      const label = ref('第一项')
      const { container } = render(defineComponent(() => () => h(item.component, item.props, () => [
        label.value,
        h('view', { class: 'consumer-label' }, [h('text', { style: { color: '#123456' } }, '自定义内容')])
      ])))
      expect(container.querySelector('.consumer-label')?.parentElement?.matches(item.wrapper)).toBe(true)
      expect(container.querySelector('.consumer-label text')?.getAttribute('style')).toContain('color: rgb(18, 52, 86)')
      label.value = '第二项'
      await nextTick()
      expect(container.querySelector(item.leaf)?.textContent).toBe('第二项')
      expect(container.querySelectorAll('.consumer-label')).toHaveLength(1)
    })
  }

  it('Tag 自定义文字色直接落到文字节点，动态 add 插槽也走相同出口', () => {
    const { container } = render(defineComponent(() => () => h(Tag, { dynamic: true, color: '#123456' }, { add: () => '添加标签' })))
    const text = container.querySelector('text.wd-tag__text-content')
    expect(text?.textContent).toBe('添加标签')
    expect(text?.getAttribute('style')).toContain('color: rgb(18, 52, 86)')
  })

  it('Divider color 和 Loading color 均直接传到标签而非只写在祖先', () => {
    const { container } = render(defineComponent(() => () => h('view', null, [
      h(Divider, { color: '#123456' }, () => '分割线'),
      h(Loading, { color: '#123456', text: '加载中' })
    ])))
    for (const selector of ['.wd-divider__text', '.wd-loading__text-content']) {
      expect(container.querySelector(selector)?.getAttribute('style')).toContain('color: rgb(18, 52, 86)')
    }
  })
})

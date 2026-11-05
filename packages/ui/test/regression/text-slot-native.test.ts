/**
 * Native text contracts, not screenshot assertions: Vue Text VNodes already use
 * native CREATE_TEXT, but that anonymous element has no label class/style/maxline.
 * The boundary gives text slots the same explicit contract as props fallbacks.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createTextVNode, defineComponent, Fragment, h, nextTick, ref, type VNode } from 'vue-lynx'
import { normalizeTextSlot, WdTextSlot } from '../../src/common/textSlot'
import { cleanup, render } from '../render'

afterEach(cleanup)

describe('WdTextSlot native text boundary', () => {
  it('gives static strings an explicit native text class/style/maxline', () => {
    const { container } = render({ setup: () => () => h('view', null, [
      h(WdTextSlot, { textClass: 'native-label', textStyle: { color: '#123456', 'font-size': '16px' }, textMaxline: 1 }, () => '菜单')
    ]) } as any)
    const label = container.querySelector('text.native-label') as HTMLElement
    expect(label.textContent).toBe('菜单')
    expect(label.style.color).toBe('rgb(18, 52, 86)')
    expect(label.style.fontSize).toBe('16px')
    expect(label.getAttribute('text-maxline')).toBe('1')
  })

  it('updates interpolation text without losing its explicit text contract', async () => {
    const label = ref('菜单')
    const { container } = render({ setup: () => () => h('view', null, [h(WdTextSlot, { textClass: 'label' }, () => label.value)]) } as any)
    label.value = '编辑'; await nextTick()
    expect(container.querySelectorAll('text.label')).toHaveLength(1)
    expect(container.querySelector('text.label')!.textContent).toBe('编辑')
  })

  it('preserves native and component slots instead of nesting them inside a text', () => {
    const Child = defineComponent({ setup: () => () => h('view', { class: 'component-slot' }, [h('text', null, '组件')]) })
    const { container } = render({ setup: () => () => h('view', { class: 'slot-host' }, [h(WdTextSlot, { textClass: 'wrapped' }, () => [
      '前', h('view', { class: 'native-slot' }, [h('text', null, '结构')]), h(Child), '后'
    ])]) } as any)
    expect(container.querySelectorAll('text.wrapped')).toHaveLength(2)
    for (const selector of ['.native-slot', '.component-slot']) {
      expect(container.querySelector(selector)!.closest('text')).toBeNull()
      expect(container.querySelector(selector)!.parentElement!.className).toBe('slot-host')
    }
  })

  it('normalizes keyed/conditional fragments and updates/reorders them safely', async () => {
    const visible = ref(true), labels = ref(['一', '二'])
    const { container } = render({ setup: () => () => h('view', null, [h(WdTextSlot, { textClass: 'fragment-text' }, () => [
      h(Fragment, { key: 'conditional' }, visible.value ? [createTextVNode('菜单')] : []),
      ...labels.value.map((label) => h(Fragment, { key: label }, [createTextVNode(label)]))
    ])]) } as any)
    visible.value = false; labels.value = ['二', '三', '一']; await nextTick()
    expect(Array.from(container.querySelectorAll('text.fragment-text')).map((el) => el.textContent)).toEqual(['二', '三', '一'])
    visible.value = true; await nextTick()
    expect(container.querySelector('text.fragment-text')!.textContent).toBe('菜单')
  })

  it('does not mutate input VNodes, fragment keys, blocks or structured descendants', () => {
    const raw = createTextVNode('原文')
    const native = h('view', { class: 'owned-by-caller' }, [createTextVNode('caller-owned text')])
    const component = h(defineComponent({ setup: () => () => h('text', null, 'component') }))
    const fragment = h(Fragment, { key: 'stable' }, [raw, native, component])
    const originalChildren = fragment.children
    const dynamicChildren = [raw] as VNode[] & { hasOnce?: boolean }
    fragment.dynamicChildren = dynamicChildren
    fragment.patchFlag = 64
    const output = normalizeTextSlot([fragment], { textClass: 'generated' })
    const normalized = output[0] as VNode
    expect(normalized).not.toBe(fragment)
    expect(normalized.key).toBe('stable')
    expect(normalized.dynamicChildren).toBeNull()
    expect(normalized.patchFlag).toBe(-2)
    expect((normalized.children as VNode[])[0].type).toBe('text')
    expect((normalized.children as VNode[])[1]).toBe(native)
    expect((normalized.children as VNode[])[2]).toBe(component)
    expect(fragment.children).toBe(originalChildren)
    expect(fragment.dynamicChildren).toBe(dynamicChildren)
    expect(fragment.patchFlag).toBe(64)
    expect(raw.type).not.toBe('text')
    expect((native.children as VNode[])[0].type).toBe(raw.type)
  })

  it('does not materialize empty Text anchors or add styled labels to an empty branch', async () => {
    const empty = createTextVNode('')
    expect(normalizeTextSlot([empty], { textClass: 'label', textStyle: { 'line-height': '24px' } })[0]).toBe(empty)
    const shown = ref(true)
    const { container } = render({ setup: () => () => h('view', null, [h(WdTextSlot, { textClass: 'conditional-label' }, () => h(Fragment, null, [createTextVNode(shown.value ? '菜单' : '')]))]) } as any)
    expect(container.querySelectorAll('.conditional-label')).toHaveLength(1)
    shown.value = false; await nextTick()
    expect(container.querySelectorAll('.conditional-label')).toHaveLength(0)
  })

  it('keeps significant whitespace between visible words instead of trimming it', () => {
    const { container } = render({ setup: () => () => h('view', null, [h(WdTextSlot, { textClass: 'spaced-label' }, () => [createTextVNode('前'), createTextVNode(' '), createTextVNode('后')])]) } as any)
    expect(Array.from(container.querySelectorAll('.spaced-label')).map((node) => node.textContent)).toEqual(['前', ' ', '后'])
  })

  it('normalizes primitive Fragment children from render functions, including numeric zero', () => {
    const { container } = render({ setup: () => () => h('view', null, [h(WdTextSlot, { textClass: 'primitive-label' }, () => h(Fragment, { key: 'primitive' }, ['菜单', ' ', 0, false]))]) } as any)
    expect(Array.from(container.querySelectorAll('.primitive-label')).map((node) => node.textContent)).toEqual(['菜单', ' ', '0'])
  })

  it('preserves an already-native props fallback without wrapping it twice', () => {
    const { container } = render({ setup: () => () => h('view', null, [h(WdTextSlot, { textClass: 'wrapped' }, () => h('text', { class: 'props-fallback' }, 'fallback'))]) } as any)
    expect(container.querySelector('.props-fallback')!.textContent).toBe('fallback')
    expect(container.querySelector('.wrapped')).toBeNull()
    expect(container.querySelector('.props-fallback text')).toBeNull()
  })
})

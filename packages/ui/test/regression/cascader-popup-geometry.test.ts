/**
 * 级联选择器弹层几何（真机 2026-11-08 回归）。
 *
 * 真机缺陷：弹层只有两三个选项高、列表被裁掉。根因是选项列表高度写成
 * `calc(336 * var(--wot-n-1, 1px))`——运行时 var 参与 calc 乘法在 Lynx CSS
 * 引擎上不保证可求值，一旦求值失败，height 整体失效并回落到内容高度。
 *
 * 现在的契约：
 * 1. 列表 / 面板高度直接落像素值（保留 --wot-cascader-list-height 覆盖点），
 *    生成 CSS 里不再出现 calc 乘法；
 * 2. wd-tabs 导航区（定高）禁止压缩，内容区吃掉剩余高度（否则窄高弹层里
 *    导航文字会叠在内容上）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { compile } from 'sass'
import postcss from 'postcss'
import path from 'node:path'
import { h } from 'vue-lynx'
import { cleanup, render } from '../render'
import Cascader from '../../src/components/wd-cascader/wd-cascader.vue'
import { pause } from '../../src/common/util'

const cascaderCss = postcss.parse(compile(path.resolve(__dirname, '../../src/components/wd-cascader/index.scss')).css)
const tabsCss = postcss.parse(compile(path.resolve(__dirname, '../../src/components/wd-tabs/index.scss')).css)

function rule(css: postcss.Root, selector: string): Record<string, string> {
  const declarations: Record<string, string> = {}
  css.walkRules((candidate) => {
    if (!candidate.selectors.includes(selector)) return
    candidate.walkDecls((decl) => { declarations[decl.prop] = decl.value })
  })
  return declarations
}

const OPTIONS = [
  {
    value: 'zj',
    text: '浙江省',
    children: [{ value: 'hz', text: '杭州市', children: [{ value: 'xh', text: '西湖区' }, { value: 'bj', text: '滨江区' }] }]
  }
]

afterEach(cleanup)

describe('wd-cascader popup geometry', () => {
  it('uses a device-safe pixel height for the option list and the panel', () => {
    const list = rule(cascaderCss, '.wd-cascader__list')
    const panel = rule(cascaderCss, '.wd-cascader__panel')
    expect(list.height).toBeTruthy()
    expect(panel.height).toBeTruthy()
    for (const [name, value] of [['list', list.height], ['panel', panel.height]] as const) {
      expect(value, `${name} 仍依赖 calc 乘法，真机可能整体失效`).not.toContain('calc(')
      expect(value, `${name} 应保留 --wot-cascader-list-height 覆盖点`).toContain('--wot-cascader-list-height')
      expect(value, `${name} 应有像素落值`).toContain('336px')
    }
  })

  it('renders a scrollable option list for every level', async () => {
    const { container } = render(Cascader, { modelValue: '', options: OPTIONS, visible: true } as any)
    await pause(120)
    const panels = container.querySelectorAll('.wd-cascader__panel')
    expect(panels.length).toBeGreaterThanOrEqual(1)
    const list = container.querySelector('.wd-cascader__list') as HTMLElement
    expect(list).not.toBeNull()
    expect(list.tagName.toLowerCase()).toBe('scroll-view')
    expect(list.getAttribute('scroll-y')).toBe('true')
    expect(container.querySelectorAll('.wd-cascader__list-item').length).toBeGreaterThan(0)
  })

  it('keeps the tabs nav fixed and gives remaining height to the content area', () => {
    const nav = rule(tabsCss, '.wd-tabs__nav')
    expect(nav['flex-shrink'], '导航区是定高元素，真机不压缩').toBe('0')
    const navWrap = rule(tabsCss, '.wd-tabs__nav--wrap')
    expect(navWrap.overflow).toBe('hidden')
    const container = rule(tabsCss, '.wd-tabs__container')
    expect(container['min-height']).toBe('0')
    // basis 保持 auto：父容器高度为 auto 时内容区不会被压成 0 高
    expect(container.flex).toBe('1 1 auto')
    // 内容区按剩余高度定尺寸，面板才不会长出弹层
    expect(rule(tabsCss, '.wd-tabs__body').height).toBe('100%')
  })
})

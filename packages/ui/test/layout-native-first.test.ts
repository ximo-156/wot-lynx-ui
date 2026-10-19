/**
 * 原生优先重写回归（NATIVE-REWRITE §3 / CONVENTIONS §15/§19/§20）——
 * 布局家族（wd-row / wd-col / wd-grid / wd-grid-item / wd-card / wd-cell /
 * wd-cell-group / wd-divider / wd-gap / wd-text / wd-resize / wd-sticky /
 * wd-sticky-box）。
 *
 * 守护三类「静默丢样式 / 不居中」根因：
 *
 * 1. **根节点三件套**：Lynx 3.x 默认 linear 布局，`flex-direction` 不写在
 *    `display: flex` 上即被静默丢弃（CONVENTIONS §15）。本测试对每个
 *    view 根组件断言生成的 index.css 根规则同时含 `display:flex` 与
 *    `flex-direction`——这是「一行一个、还没有间距」的直接防线；
 * 2. **居中成对**：需要居中处 `justify-content` + `align-items` 成对写全，
 *    文本另加 `text-align`（NATIVE-REWRITE §3.2）；
 * 3. **Web 专有声明清零**：`inline-flex` / `inline-block` / `float` /
 *    `vertical-align` / `cursor` / `user-select` / `outline` / `-webkit-*` /
 *    `background-clip` 在 Lynx 一律不识别，写了即静默丢失。
 *
 * 另守护 CONVENTIONS §20 的 Style Funnel 迁移：根内联样式每帧输出完整
 * 键集（中性值在场），避免「条件写样式」在 prop 由有值变无值时残留旧值。
 *
 * 断言边界：CSS 侧断言基于 scripts/build-css.mjs 的产物 index.css（与真机
 * 下发的样式同源）；内联样式侧经 JSDOM 的 style 属性序列化断言普通属性
 * （自定义属性 JSDOM 不可见，同 layout-inline-style-regression.test.ts）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { h } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import Row from '../src/components/wd-row/wd-row.vue'
import Col from '../src/components/wd-col/wd-col.vue'
import Grid from '../src/components/wd-grid/wd-grid.vue'
import GridItem from '../src/components/wd-grid-item/wd-grid-item.vue'
import Card from '../src/components/wd-card/wd-card.vue'
import Cell from '../src/components/wd-cell/wd-cell.vue'
import CellGroup from '../src/components/wd-cell-group/wd-cell-group.vue'
import Divider from '../src/components/wd-divider/wd-divider.vue'
import Gap from '../src/components/wd-gap/wd-gap.vue'
import Text from '../src/components/wd-text/wd-text.vue'
import Resize from '../src/components/wd-resize/wd-resize.vue'
import Sticky from '../src/components/wd-sticky/wd-sticky.vue'
import StickyBox from '../src/components/wd-sticky-box/wd-sticky-box.vue'

const COMPONENT_DIR = join(__dirname, '..', 'src', 'components')

/** 本批全部组件（wd-text 根为 text 元素，单独处理） */
const VIEW_ROOTED = [
  'wd-row',
  'wd-col',
  'wd-grid',
  'wd-grid-item',
  'wd-card',
  'wd-cell',
  'wd-cell-group',
  'wd-divider',
  'wd-gap',
  'wd-resize',
  'wd-sticky',
  'wd-sticky-box'
] as const

/** 读取组件编译产物 index.css 并按选择器拆成声明表 */
function cssRules(component: string): Array<{ selector: string; decls: Record<string, string> }> {
  const css = readFileSync(join(COMPONENT_DIR, component, 'index.css'), 'utf8')
  const rules: Array<{ selector: string; decls: Record<string, string> }> = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    const selector = m[1]!.trim()
    const decls: Record<string, string> = {}
    for (const decl of m[2]!.split(';')) {
      const idx = decl.indexOf(':')
      if (idx === -1) continue
      const prop = decl.slice(0, idx).trim()
      const val = decl.slice(idx + 1).trim()
      if (prop && val) decls[prop] = val
    }
    if (Object.keys(decls).length) rules.push({ selector, decls })
  }
  return rules
}

/** 取根规则（`.wd-xxx`，无修饰类） */
function rootRule(component: string) {
  const block = component.replace(/^wd-/, '')
  const rules = cssRules(component).filter((r) => r.selector === `.${component}`)
  expect(rules.length, `${component} 应有根规则 .${component}`).toBeGreaterThan(0)
  const merged: Record<string, string> = {}
  for (const r of rules) Object.assign(merged, r.decls)
  expect(block.length).toBeGreaterThan(0)
  return merged
}

function styleOf(el: Element | null): string {
  return el ? el.getAttribute('style') || '' : ''
}

describe('原生优先：根节点三件套（NATIVE-REWRITE §3.1 / CONVENTIONS §15）', () => {
  it.each(VIEW_ROOTED)('%s 根规则显式 display:flex + flex-direction', (component) => {
    const decls = rootRule(component)
    expect(decls.display, `${component} 根节点必须显式 display: flex`).toBe('flex')
    expect(
      decls['flex-direction'],
      `${component} 根节点必须显式 flex-direction（linear 布局下不写即被静默丢弃）`
    ).toMatch(/^(row|column)$/)
  })

  it('wd-row / wd-grid 为 row 方向，其余为 column 方向', () => {
    expect(rootRule('wd-row')['flex-direction']).toBe('row')
    expect(rootRule('wd-grid')['flex-direction']).toBe('row')
    expect(rootRule('wd-divider')['flex-direction']).toBe('row')
    for (const c of ['wd-col', 'wd-grid-item', 'wd-card', 'wd-cell', 'wd-cell-group', 'wd-gap', 'wd-resize', 'wd-sticky', 'wd-sticky-box']) {
      expect(rootRule(c)['flex-direction'], `${c} 应为纵向堆叠`).toBe('column')
    }
  })

  it('wd-text 根为原生 text 元素（不走 view 的 flex 布局体系）', () => {
    const decls = rootRule('wd-text')
    // text 元素上 flex 声明无意义：根规则不应出现 display/flex-direction
    expect(decls.display).toBeUndefined()
    expect(decls['flex-direction']).toBeUndefined()
  })
})

/**
 * 取规则的「基础元素选择器」：去掉 is-* / --* 修饰类与 :active 伪类，
 * 只留元素本身的结构路径。用于判断同一元素是否在别处声明了 display: flex
 * （CSS 层叠：`.a { display:flex }` + `.a.is-x { flex-direction:row }`
 * 对同一元素生效，不构成 §15 违规）。
 */
function baseSelector(selector: string): string {
  return selector
    .replace(/\.[\w-]*--[\w-]+/g, '')
    .replace(/\.is-[\w-]+/g, '')
    .replace(/:active/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('原生优先：flex-direction 必须挂在 display:flex 上（CONVENTIONS §15）', () => {
  it.each(VIEW_ROOTED.concat(['wd-text']))('%s 所有含 flex-direction 的规则，其元素都声明了 display:flex', (component) => {
    const rules = cssRules(component)
    // 基础选择器 → 该元素是否声明 display: flex（层叠后生效）
    const flexElements = new Set<string>()
    for (const rule of rules) {
      if (rule.decls.display === 'flex') flexElements.add(baseSelector(rule.selector))
    }
    for (const rule of rules) {
      if (!Object.prototype.hasOwnProperty.call(rule.decls, 'flex-direction')) continue
      expect(
        flexElements.has(baseSelector(rule.selector)),
        `${component} 的 ${rule.selector} 用了 flex-direction，但其元素未声明 display: flex —— Lynx 3.x 下该声明被静默丢弃`
      ).toBe(true)
    }
  })
})

describe('原生优先：Web 专有声明清零（NATIVE-REWRITE §3.1 / PORTING §4.5）', () => {
  const ALL = VIEW_ROOTED.concat(['wd-text'])

  it.each(ALL)('%s 不含 inline-flex / inline-block', (component) => {
    const css = readFileSync(join(COMPONENT_DIR, component, 'index.css'), 'utf8')
    expect(css).not.toMatch(/display\s*:\s*inline-(?:flex|block)/)
  })

  it.each(ALL)('%s 不含 float / vertical-align / cursor / user-select / outline', (component) => {
    const css = readFileSync(join(COMPONENT_DIR, component, 'index.css'), 'utf8')
    expect(css, `${component} 残留 Web 专有声明`).not.toMatch(/(?:^|[;\s])(?:float|vertical-align|cursor|user-select|outline)\s*:/)
  })

  it.each(ALL)('%s 不含 -webkit-* / background-clip', (component) => {
    const css = readFileSync(join(COMPONENT_DIR, component, 'index.css'), 'utf8')
    expect(css).not.toMatch(/-webkit-/)
    expect(css).not.toMatch(/background-clip\s*:/)
  })
})

describe('原生优先：居中成对写全（NATIVE-REWRITE §3.2）', () => {
  it('wd-grid-item：图标行与文字均显式居中', () => {
    const rules = cssRules('wd-grid-item')
    const wrapper = rules.find((r) => r.selector === '.wd-grid-item__wrapper')!
    expect(wrapper.decls.display).toBe('flex')
    expect(wrapper.decls['flex-direction']).toBe('row')
    expect(wrapper.decls['align-items']).toBe('center')
    expect(wrapper.decls['justify-content']).toBe('center')

    // 文字：容器 flex 居中之外，文本自身显式 text-align: center
    const text = rules.find((r) => r.selector === '.wd-grid-item__text')!
    expect(text.decls['text-align']).toBe('center')

    // is-center 内容区：justify-content + align-items 成对
    const centered = rules.find((r) => r.selector === '.wd-grid-item__content.is-center')!
    expect(centered.decls['align-items']).toBe('center')
    expect(centered.decls['justify-content']).toBe('center')
  })

  it('wd-cell：左侧区与右侧区均为 flex 行 + 交叉轴居中', () => {
    const rules = cssRules('wd-cell')
    for (const sel of ['.wd-cell__left', '.wd-cell__body', '.wd-cell .wd-cell__prefix', '.wd-cell .wd-cell__arrow-right', '.wd-cell .wd-cell__suffix']) {
      const rule = rules.find((r) => r.selector === sel)
      expect(rule, `wd-cell 缺少 ${sel}`).toBeTruthy()
      expect(rule!.decls.display, `${sel} 应显式 display: flex`).toBe('flex')
      expect(rule!.decls['flex-direction'], `${sel} 应为横向行`).toBe('row')
      expect(rule!.decls['align-items'], `${sel} 应交叉轴居中`).toBe('center')
    }
    // is-center：三个层级成对补全
    const centerWrapper = rules.find((r) => r.selector === '.wd-cell.is-center .wd-cell__wrapper')!
    expect(centerWrapper.decls['align-items']).toBe('center')
    expect(centerWrapper.decls['justify-content']).toBe('space-between')
  })

  it('wd-cell-group：标题行两端对齐 + 同行居中，左右文本容器为 flex 行', () => {
    const rules = cssRules('wd-cell-group')
    const title = rules.find((r) => r.selector === '.wd-cell-group__title')!
    expect(title.decls.display).toBe('flex')
    expect(title.decls['flex-direction']).toBe('row')
    expect(title.decls['align-items']).toBe('center')
    expect(title.decls['justify-content']).toBe('space-between')

    for (const sel of ['.wd-cell-group__left', '.wd-cell-group__right']) {
      const rule = rules.find((r) => r.selector === sel)!
      expect(rule.decls.display).toBe('flex')
      expect(rule.decls['flex-direction']).toBe('row')
      expect(rule.decls['align-items']).toBe('center')
    }
  })

  it('wd-card：标题 / 内容 / 底部三区布局方向显式', () => {
    const rules = cssRules('wd-card')
    const title = rules.find((r) => r.selector === '.wd-card__title')!
    expect(title.decls.display).toBe('flex')
    expect(title.decls['flex-direction']).toBe('row')
    expect(title.decls['align-items']).toBe('center')

    const content = rules.find((r) => r.selector === '.wd-card__content')!
    expect(content.decls.display).toBe('flex')
    expect(content.decls['flex-direction']).toBe('column')

    const footer = rules.find((r) => r.selector === '.wd-card__footer')!
    expect(footer.decls.display).toBe('flex')
    expect(footer.decls['flex-direction']).toBe('row')
    expect(footer.decls['align-items']).toBe('center')
    expect(footer.decls['justify-content']).toBe('flex-end')
  })

  it('wd-divider：线段 + 内容为 flex 行且内容在行内垂直居中', () => {
    const decls = rootRule('wd-divider')
    expect(decls['align-items']).toBe('center')
    expect(decls['justify-content']).toBe('center')
  })

  it('wd-resize：探测 scroll-view 以四边 0 绝对定位铺满容器', () => {
    const wrapper = cssRules('wd-resize').find((r) => r.selector === '.wd-resize__wrapper')!
    expect(wrapper.decls.position).toBe('absolute')
    expect(wrapper.decls.top).toBe('0')
    expect(wrapper.decls.right).toBe('0')
    expect(wrapper.decls.bottom).toBe('0')
    expect(wrapper.decls.left).toBe('0')
  })
})

describe('原生优先：原生元素与 CSS 态（NATIVE-REWRITE §3.3 / §4）', () => {
  it('wd-resize 以原生 scroll-view 做尺寸探测（两个：变大 / 变小）', () => {
    const { container } = render(Resize, {})
    const views = container.querySelectorAll('scroll-view')
    expect(views.length, '应为两个探测 scroll-view').toBe(2)
    for (const el of views) {
      expect(el.getAttribute('scroll-y')).toBe('true')
      expect(el.getAttribute('scroll-x')).toBe('true')
    }
    cleanup()
  })

  it('wd-sticky 以渲染器原生 position: sticky 吸顶（零 JS 滚动联动）', () => {
    const { container } = render(Sticky, { offsetTop: 12, zIndex: 10 })
    const style = styleOf(container.querySelector('.wd-sticky'))
    expect(style).toMatch(/position:\s*sticky/)
    expect(style).toMatch(/top:\s*12px/)
    expect(style).toMatch(/z-index:\s*10/)
    cleanup()
  })

  it('wd-sticky-box 为相对定位包裹层（flex 列）', () => {
    const decls = rootRule('wd-sticky-box')
    expect(decls.position).toBe('relative')
    expect(decls.display).toBe('flex')
    expect(decls['flex-direction']).toBe('column')
    cleanup()
  })

  it('wd-cell / wd-grid-item 按压反馈走 CSS :active（CONVENTIONS §17）', () => {
    const cell = cssRules('wd-cell').find((r) => r.selector === '.wd-cell.is-hover:active')
    expect(cell, 'wd-cell 应有 is-hover:active 按压背景').toBeTruthy()
    const item = cssRules('wd-grid-item').find((r) => r.selector === '.wd-grid-item__content--hover:active')
    expect(item, 'wd-grid-item 应有 hover:active 按压背景').toBeTruthy()
  })
})

describe('原生优先：Style Funnel 完整键集（CONVENTIONS §20）', () => {
  afterEach(() => cleanup())

  it('wd-row：gutter=0 时四个可切换键仍全部在场（中性值）', () => {
    const { container } = render(Row, {})
    const style = styleOf(container.querySelector('.wd-row'))
    // margin-left / margin-right / justify-content / align-items 均输出
    expect(style).toMatch(/margin-left:\s*0px/)
    expect(style).toMatch(/margin-right:\s*0px/)
    expect(style).toMatch(/justify-content:\s*flex-start/)
    expect(style).toMatch(/align-items:\s*flex-start/)
    cleanup()
  })

  it('wd-row：gutter / justify / align 生效且与 customStyle 合并', () => {
    const { container } = render(Row, { gutter: 12, justify: 'center', align: 'middle', customStyle: 'margin-bottom: 8px' })
    const style = styleOf(container.querySelector('.wd-row'))
    expect(style).toMatch(/margin-left:\s*-6px/)
    expect(style).toMatch(/margin-right:\s*-6px/)
    expect(style).toMatch(/justify-content:\s*center/)
    expect(style).toMatch(/align-items:\s*center/)
    expect(style).toMatch(/margin-bottom:\s*8px/)
    cleanup()
  })

  it('wd-col：span/offset 换算后 width 与 margin-left 始终在场', () => {
    const { container } = render(Col, { span: 12, offset: 6 })
    let style = styleOf(container.querySelector('.wd-col'))
    expect(style).toMatch(/width:\s*50%/)
    expect(style).toMatch(/margin-left:\s*25%/)

    // span 回退默认 24 → width 仍输出完整键集（不残留旧 50%）
    const second = render(Col, {})
    style = styleOf(second.container.querySelector('.wd-col'))
    expect(style).toMatch(/width:\s*100%/)
    expect(style).toMatch(/margin-left:\s*0px/)
    cleanup()
  })

  it('wd-grid：gutter 左内边距与 square 负底边距完整输出', () => {
    const { container } = render(Grid, { gutter: 8, square: true })
    const style = styleOf(container.querySelector('.wd-grid'))
    expect(style).toMatch(/padding-left:\s*8px/)
    expect(style).toMatch(/margin-bottom:\s*-8px/)

    const plain = render(Grid, {})
    const plainStyle = styleOf(plain.container.querySelector('.wd-grid'))
    expect(plainStyle).toMatch(/padding-left:\s*0px/)
    expect(plainStyle).toMatch(/margin-bottom:\s*0px/)
    cleanup()
  })

  it('wd-gap：背景与高度键集完整（bgColor 可回落）', () => {
    const { container } = render(Gap, { height: 20, bgColor: '#f5f5f5' })
    let style = styleOf(container.querySelector('.wd-gap'))
    expect(style).toMatch(/background:\s*rgb\(245, 245, 245\)/)
    expect(style).toMatch(/height:\s*20px/)

    const plain = render(Gap, {})
    style = styleOf(plain.container.querySelector('.wd-gap'))
    expect(style).toMatch(/background:\s*transparent/)
    expect(style).toMatch(/height:\s*14px/)
    cleanup()
  })

  it('wd-text：color/size/lineHeight/decoration 键集完整，decoration 回落 none', () => {
    const { container } = render(Text, { text: '文本', color: '#f00', size: '16px', lineHeight: '24px', decoration: 'underline' })
    let style = styleOf(container.querySelector('.wd-text'))
    expect(style).toMatch(/color:\s*rgb\(255, 0, 0\)/)
    expect(style).toMatch(/font-size:\s*16px/)
    expect(style).toMatch(/line-height:\s*24px/)
    expect(style).toMatch(/text-decoration:\s*underline/)

    const plain = render(Text, { text: '文本' })
    style = styleOf(plain.container.querySelector('.wd-text'))
    expect(style, 'decoration 默认 none 应显式在场（切回时不留旧下划线）').toMatch(/text-decoration:\s*none/)
    cleanup()
  })

  it('wd-resize：宽高键集完整（度量未返回时为 0px 中性值）', async () => {
    const { container } = render(Resize, {})
    await pause(20)
    const style = styleOf(container.querySelector('.wd-resize'))
    expect(style).toMatch(/width:\s*0px/)
    expect(style).toMatch(/height:\s*0px/)
    cleanup()
  })

  it('wd-sticky：position/top/z-index 键集完整（offsetTop 由具体值回落 0 不留旧位移）', () => {
    const { container } = render(Sticky, { offsetTop: 0 })
    const style = styleOf(container.querySelector('.wd-sticky'))
    expect(style).toMatch(/position:\s*sticky/)
    expect(style).toMatch(/top:\s*0px/)
    expect(style).toMatch(/z-index:\s*1/)
    cleanup()
  })

  it('wd-grid-item：gutter 由有值变 0 时 padding-right / margin-top 不留残值', () => {
    const withGutter = render(
      {
        setup() {
          return () =>
            h(Grid as any, { column: 2, gutter: 8 }, { default: () => [h(GridItem as any, { text: 'a' }), h(GridItem as any, { text: 'b' })] })
        }
      } as any
    )
    const items = withGutter.container.querySelectorAll('.wd-grid-item')
    expect(items.length).toBe(2)
    // 第二项（index 1 >= columnNum 2? 否）——此处 column=2、共 2 项，均无 marginTop
    for (const el of items) {
      expect(styleOf(el)).toMatch(/padding-right:\s*8px/)
      expect(styleOf(el)).toMatch(/margin-top:\s*0px/)
    }

    const plain = render(
      {
        setup() {
          return () =>
            h(Grid as any, { column: 2 }, { default: () => [h(GridItem as any, { text: 'a' }), h(GridItem as any, { text: 'b' })] })
        }
      } as any
    )
    for (const el of plain.container.querySelectorAll('.wd-grid-item')) {
      expect(styleOf(el), 'gutter 归零后 padding-right 应回落中性值').toMatch(/padding-right:\s*0px/)
    }
    cleanup()
  })
})

describe('原生优先：内联样式对象语法（CONVENTIONS §19）', () => {
  afterEach(() => cleanup())

  it('wd-cell / wd-cell-group / wd-card / wd-divider 的 customStyle 以对象语法合并且生效', () => {
    const cell = render(Cell, { title: '单元格', customStyle: 'padding: 20px' })
    expect(styleOf(cell.container.querySelector('.wd-cell'))).toMatch(/padding:\s*20px/)

    const group = render(CellGroup, { title: '分组', customStyle: 'margin-top: 6px' })
    expect(styleOf(group.container.querySelector('.wd-cell-group'))).toMatch(/margin-top:\s*6px/)

    const card = render(Card, { title: '标题', customStyle: 'background: #fff' })
    expect(styleOf(card.container.querySelector('.wd-card'))).toMatch(/background:\s*rgb\(255, 255, 255\)/)

    const divider = render(Divider, { color: '#f00', customStyle: 'margin-top: 4px' })
    const dividerStyle = styleOf(divider.container.querySelector('.wd-divider'))
    expect(dividerStyle).toMatch(/color:\s*rgb\(255, 0, 0\)/)
    expect(dividerStyle).toMatch(/margin-top:\s*4px/)
  })

  it('wd-divider 的 color prop 走内联下发（自定义颜色）', () => {
    const { container } = render(Divider, { color: 'rgb(1, 2, 3)' })
    expect(styleOf(container.querySelector('.wd-divider'))).toMatch(/color:\s*rgb\(1, 2, 3\)/)
    cleanup()
  })
})

/**
 * 原生优先重写 · 布局居中契约回归（wd-navbar / wd-navbar-capsule / wd-tabs /
 * wd-tab / wd-index-bar / wd-index-anchor / wd-pagination）。
 *
 * 背景（NATIVE-REWRITE §3 / CONVENTIONS §15/§19/§20）：Lynx 3.x 默认 linear
 * 布局，`flex-direction` 等弹性属性只在 `display: flex` 上生效；
 * `inline-flex` / `inline-block` / `float` / `vertical-align` 写了即静默丢失
 * ——这是「样式不居中」的根因。本测试锁定本批组件「根节点三件套 + 居中成对
 * 书写 + 无 Web 专有写法 + DOM 结构不回退 + MTS 手势分工」的静态契约：
 *
 * 1. 每个组件根 view 显式 `display: flex` + `flex-direction`（按内容方向）；
 * 2. 需要居中处 `justify-content` + `align-items` 成对写全，文本节点另加
 *    `text-align: center`（图标+文字行、按钮内容、导航栏三区、索引项、
 *    页码区、辅助文案逐处核查）；
 * 3. 编译产物中不出现 Lynx 不识别的 Web 专有写法（inline-flex /
 *    inline-block / float / vertical-align / cursor / user-select /
 *    outline / -webkit-*）——wd-tabs 的 map-nav-btn 经共享 buttonClear
 *    mixin 输出 `outline: none`（参考源同源，style-parity 将 outline 计入
 *    Web 专有白名单不计差异），该条单独豁免；
 * 4. DOM 结构（BEM 类名 / 层级）与 wot-ui 2.3.2 对齐不回退；
 * 5. wd-tabs 滑动手势分工：条带（子）挂主线程 touchstart/touchmove，
 *    容器（父）挂后台 touchstart/touchend——同一元素同名事件不双绑
 *    （NATIVE-REWRITE §2）；行为细节由 test/tabs-mts.test.ts 覆盖。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import Navbar from '../../src/components/wd-navbar/wd-navbar.vue'
import NavbarCapsule from '../../src/components/wd-navbar-capsule/wd-navbar-capsule.vue'
import Tabs from '../../src/components/wd-tabs/wd-tabs.vue'
import Tab from '../../src/components/wd-tab/wd-tab.vue'
import IndexBar from '../../src/components/wd-index-bar/wd-index-bar.vue'
import IndexAnchor from '../../src/components/wd-index-anchor/wd-index-anchor.vue'
import Pagination from '../../src/components/wd-pagination/wd-pagination.vue'
import { compRead } from '../helpers/component-roots'


/** 本批全部组件 */
const BATCH = [
  'wd-navbar',
  'wd-navbar-capsule',
  'wd-tabs',
  'wd-tab',
  'wd-index-bar',
  'wd-index-anchor',
  'wd-pagination'
] as const

/** 根节点内容方向（按 wot-ui 视觉：横向排列为 row，纵向堆叠为 column） */
const ROOT_DIRECTION: Record<string, 'row' | 'column'> = {
  'wd-navbar': 'column',
  'wd-navbar-capsule': 'row',
  'wd-tabs': 'column',
  'wd-tab': 'column',
  'wd-index-bar': 'column',
  'wd-index-anchor': 'column',
  'wd-pagination': 'column'
}

/** 读取组件编译产物 index.css 并按选择器拆成声明表 */
function cssRules(component: string): Array<{ selector: string; decls: Record<string, string> }> {
  const css = compRead(component, 'index.css')
  const rules: Array<{ selector: string; decls: Record<string, string> }> = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
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

/** 取根规则（`.wd-xxx`，无修饰类），多段声明合并 */
function rootRule(component: string): Record<string, string> {
  const rules = cssRules(component).filter((r) => r.selector === `.${component}`)
  expect(rules.length, `${component} 应有根规则 .${component}`).toBeGreaterThan(0)
  const merged: Record<string, string> = {}
  for (const r of rules) Object.assign(merged, r.decls)
  return merged
}

/**
 * 取指定选择器的声明（找不到即失败）。
 *
 * 编译产物会把同声明块的选择器合并成逗号分组（如
 * `.wd-navbar__left,.wd-navbar__right,.wd-navbar__capsule{...}`），
 * 故按逗号拆分后匹配，并把该元素命中的全部规则声明合并（层叠语义）。
 */
function ruleOf(component: string, selector: string): Record<string, string> {
  const merged: Record<string, string> = {}
  let found = false
  for (const rule of cssRules(component)) {
    const selectors = rule.selector.split(',').map((s) => s.trim())
    if (!selectors.includes(selector)) continue
    found = true
    Object.assign(merged, rule.decls)
  }
  expect(found, `${component} 缺少选择器 ${selector}`).toBe(true)
  return merged
}

/** 取规则的「基础元素选择器」：去掉 is-* / --* 修饰类与 :active 伪类 */
function baseSelector(selector: string): string {
  return selector
    .replace(/\.[\w-]*--[\w-]+/g, '')
    .replace(/\.is-[\w-]+/g, '')
    .replace(/:active/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 居中成对：justify-content + align-items 同时为 center */
function expectCenterPair(decls: Record<string, string>, label: string) {
  expect(decls['justify-content'], `${label} 需要 justify-content: center`).toBe('center')
  expect(decls['align-items'], `${label} 需要 align-items: center`).toBe('center')
}

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

describe('原生优先：根节点三件套（NATIVE-REWRITE §3.1 / CONVENTIONS §15）', () => {
  it.each(BATCH)('%s 根规则显式 display:flex + flex-direction', (component) => {
    const decls = rootRule(component)
    expect(decls.display, `${component} 根节点必须显式 display: flex`).toBe('flex')
    expect(decls['flex-direction'], `${component} 根节点必须显式 flex-direction`).toBe(ROOT_DIRECTION[component])
  })
})

describe('原生优先：flex-direction 必须挂在 display:flex 上（CONVENTIONS §15）', () => {
  it.each(BATCH)('%s 所有含 flex-direction 的规则，其元素都声明了 display:flex', (component) => {
    const rules = cssRules(component)
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
  it.each(BATCH)('%s 不含 inline-flex / inline-block', (component) => {
    const css = compRead(component, 'index.css')
    expect(css).not.toMatch(/display\s*:\s*inline-(?:flex|block)/)
  })

  it.each(BATCH.filter((c) => c !== 'wd-tabs'))('%s 不含 float / vertical-align / cursor / user-select / outline', (component) => {
    const css = compRead(component, 'index.css')
    expect(css, `${component} 残留 Web 专有声明`).not.toMatch(/(?:^|[;\s])(?:float|vertical-align|cursor|user-select|outline)\s*:/)
  })

  it('wd-tabs 仅豁免共享 buttonClear mixin 的 outline:none（参考源同源）', () => {
    const css = compRead('wd-tabs', 'index.css')
    expect(css).not.toMatch(/(?:^|[;\s])(?:float|vertical-align|cursor|user-select)\s*:/)
    // outline 只允许以 `outline:none` 形式来自 buttonClear（按钮样式重置）
    const outlines = css.match(/(?:^|[;\s])outline\s*:\s*[^;}]+/g) || []
    for (const o of outlines) expect(o.replace(/[;\s]/g, '')).toBe('outline:none')
  })

  it.each(BATCH)('%s 不含 -webkit-*', (component) => {
    const css = compRead(component, 'index.css')
    expect(css).not.toMatch(/-webkit-/)
  })
})

describe('原生优先：居中成对写全（NATIVE-REWRITE §3.2）', () => {
  it('wd-navbar：内容区/标题/两侧文案逐处居中', () => {
    // 内容区：left/right 绝对定位不参与流，title 是唯一流内子项——
    // 主轴居中使其水平居中，交叉轴居中保证任意行高下垂直居中
    const content = ruleOf('wd-navbar', '.wd-navbar__content')
    expect(content.display).toBe('flex')
    expect(content['flex-direction']).toBe('row')
    expectCenterPair(content, '.wd-navbar__content')

    // 标题：自身 flex 行 + 双向居中 + text-align: center
    const title = ruleOf('wd-navbar', '.wd-navbar__title')
    expect(title.display).toBe('flex')
    expect(title['flex-direction']).toBe('row')
    expectCenterPair(title, '.wd-navbar__title')
    expect(title['text-align'], '.wd-navbar__title 需要 text-align: center').toBe('center')

    // 两侧文案（图标+文字行）：flex 行 + 交叉轴居中 + 主轴居中
    const text = ruleOf('wd-navbar', '.wd-navbar__text')
    expect(text.display).toBe('flex')
    expect(text['flex-direction']).toBe('row')
    expectCenterPair(text, '.wd-navbar__text')

    // 左/右/胶囊区：绝对定位四边贴齐（top/bottom: 0 + 左或右贴边）+
    // flex 行 + 交叉轴居中（垂直居中不依赖 line-height 继承）
    for (const sel of ['.wd-navbar__left', '.wd-navbar__right', '.wd-navbar__capsule']) {
      const decls = ruleOf('wd-navbar', sel)
      expect(decls.position, `${sel} 应为绝对定位`).toBe('absolute')
      expect(decls.top, `${sel} 应贴顶`).toBe('0')
      expect(decls.bottom, `${sel} 应贴底`).toBe('0')
      expect(decls.display, `${sel} 应为 flex 行`).toBe('flex')
      expect(decls['flex-direction']).toBe('row')
      expect(decls['align-items'], `${sel} 需要 align-items: center`).toBe('center')
    }
    expect(ruleOf('wd-navbar', '.wd-navbar__left').left, '左侧区贴左').toBe('0')
    expect(ruleOf('wd-navbar', '.wd-navbar__right').right, '右侧区贴右').toBe('0')
  })

  it('wd-navbar-capsule：胶囊根与图标区居中', () => {
    const root = rootRule('wd-navbar-capsule')
    expect(root['flex-direction']).toBe('row')
    expectCenterPair(root, '.wd-navbar-capsule')
    // 分割线为 flex 子项落在容器正中（替代参考源 ::after 的 left:50% 定位）
    expect(ruleOf('wd-navbar-capsule', '.wd-navbar-capsule__separator')).toBeTruthy()
  })

  it('wd-tabs：导航项与地图按钮居中', () => {
    const item = ruleOf('wd-tabs', '.wd-tabs__nav-item')
    expect(item.display).toBe('flex')
    expect(item['flex-direction']).toBe('row')
    expectCenterPair(item, '.wd-tabs__nav-item')

    const btn = ruleOf('wd-tabs', '.wd-tabs__map-nav-btn')
    expect(btn.display).toBe('flex')
    expect(btn['flex-direction']).toBe('row')
    expectCenterPair(btn, '.wd-tabs__map-nav-btn')
    expect(btn['text-align'], '.wd-tabs__map-nav-btn 需要 text-align: center').toBe('center')

    const container = ruleOf('wd-tabs', '.wd-tabs__nav-container')
    expect(container.display).toBe('flex')
    expect(container['flex-direction']).toBe('row')
  })

  it('wd-index-bar：索引项居中（圆点激活态）', () => {
    const index = ruleOf('wd-index-bar', '.wd-index-bar__index')
    expect(index.display).toBe('flex')
    expect(index['flex-direction']).toBe('row')
    expectCenterPair(index, '.wd-index-bar__index')

    const content = ruleOf('wd-index-bar', '.wd-index-bar__content')
    expect(content.display).toBe('flex')
    expect(content['flex-direction']).toBe('column')
  })

  it('wd-pagination：内容区两端分布 + 交叉轴居中，页码/文案文本居中', () => {
    const content = ruleOf('wd-pagination', '.wd-pagination__content')
    expect(content.display).toBe('flex')
    expect(content['flex-direction']).toBe('row')
    expect(content['justify-content'], '.wd-pagination__content 需要 justify-content').toBe('space-between')
    expect(content['align-items'], '.wd-pagination__content 需要 align-items: center').toBe('center')

    expect(ruleOf('wd-pagination', '.wd-pagination__size')['text-align'], '页码区需要 text-align: center').toBe('center')
    expect(ruleOf('wd-pagination', '.wd-pagination__message')['text-align'], '辅助文案需要 text-align: center').toBe('center')
  })

  it('wd-tab：面板根与 body 纵向排布', () => {
    const body = ruleOf('wd-tab', '.wd-tab__body')
    expect(body.display).toBe('flex')
    expect(body['flex-direction']).toBe('column')
  })
})

describe('原生优先：DOM 结构不回退（BEM 类名 / 层级，PORTING §3.1）', () => {
  afterEach(() => cleanup())

  it('wd-navbar：占位根三件套经内联样式下发，三区类名齐全', () => {
    const { container } = render({
      setup() {
        return () =>
          h(Navbar as any, {
            title: '标题',
            leftText: '返回',
            rightText: '更多',
            leftArrow: true
          })
      }
    } as any)
    const root = container.firstElementChild!
    // 占位 view（SFC 根）经 Style Funnel 下发 display/flex-direction 常量键
    expect(styleOf(root)).toMatch(/display:\s*flex/)
    expect(styleOf(root)).toMatch(/flex-direction:\s*column/)

    expect(container.querySelector('.wd-navbar')).toBeTruthy()
    expect(container.querySelector('.wd-navbar__content')).toBeTruthy()
    expect(container.querySelector('.wd-navbar__left')).toBeTruthy()
    expect(container.querySelector('.wd-navbar__left .wd-navbar__arrow')).toBeTruthy()
    expect(container.querySelector('.wd-navbar__left .wd-navbar__text')!.textContent).toBe('返回')
    expect(container.querySelector('.wd-navbar__title')!.textContent).toBe('标题')
    expect(container.querySelector('.wd-navbar__right .wd-navbar__text')!.textContent).toBe('更多')
  })

  it('wd-navbar-capsule：两个图标 + 分割线', () => {
    const { container } = render({
      setup() {
        return () => h(NavbarCapsule as any)
      }
    } as any)
    expect(container.querySelectorAll('.wd-navbar-capsule__icon').length).toBe(2)
    expect(container.querySelector('.wd-navbar-capsule__separator')).toBeTruthy()
  })

  it('wd-tabs：条带挂主线程 touchstart/touchmove，容器挂后台 touchstart/touchend（分工不变式）', async () => {
    const { container } = render({
      setup() {
        const value = ref(0)
        return () =>
          h(
            Tabs as any,
            { modelValue: value.value, swipeable: true, animated: true },
            {
              default: () => [
                h(Tab as any, { title: '标签一', name: 0 }, { default: () => h('text', '内容一') }),
                h(Tab as any, { title: '标签二', name: 1 }, { default: () => h('text', '内容二') })
              ]
            }
          )
      }
    } as any)
    await new Promise((r) => setTimeout(r, 30))

    const body = container.querySelector('.wd-tabs__body') as any
    const containerEl = container.querySelector('.wd-tabs__container') as any
    // 元素属性桥接：worklet 经 getAttribute 实时读激活索引与标签总数
    expect(body.getAttribute('active-index')).toBe('0')
    expect(body.getAttribute('tab-count')).toBe('2')

    // 主线程链路：条带（子）注册 worklet 版 touchstart / touchmove
    expect(body.eventMap['bindEvent:touchstart'], '条带应有主线程 touchstart').toBeTruthy()
    expect(body.eventMap['bindEvent:touchmove'], '条带应有主线程 touchmove').toBeTruthy()
    // 分工不变式：touchend 不在条带上与主线程事件同名双绑
    expect(body.eventMap['bindEvent:touchend']).toBeFalsy()

    // 后台链路：容器（父）touchstart / touchend / touchcancel
    expect(containerEl.eventMap['bindEvent:touchstart'], '容器应有后台 touchstart').toBeTruthy()
    expect(containerEl.eventMap['bindEvent:touchend'], '容器应有后台 touchend').toBeTruthy()
    expect(containerEl.eventMap['bindEvent:touchcancel'], '容器应有后台 touchcancel').toBeTruthy()
    // 后台不再逐帧累计 touchmove（跟手已上主线程）
    expect(containerEl.eventMap['bindEvent:touchmove']).toBeFalsy()

    // DOM 层级不回退
    expect(container.querySelectorAll('.wd-tabs__nav-item').length).toBe(2)
    expect(container.querySelector('.wd-tabs__nav-container')).toBeTruthy()
  })

  it('wd-index-bar / wd-index-anchor：索引条渲染全部索引，锚点挂载', async () => {
    const { container } = render({
      setup() {
        return () =>
          h(IndexBar as any, null, {
            default: () => [h(IndexAnchor as any, { index: 'A' }), h(IndexAnchor as any, { index: 'B' })]
          })
      }
    } as any)
    await new Promise((r) => setTimeout(r, 30))
    expect(container.querySelector('.wd-index-bar')).toBeTruthy()
    expect(container.querySelector('.wd-index-bar__content')).toBeTruthy()
    expect(container.querySelector('.wd-index-bar__sidebar')).toBeTruthy()
    const items = Array.from(container.querySelectorAll('.wd-index-bar__index'))
    expect(items.map((el) => el.textContent)).toEqual(['A', 'B'])
    expect(container.querySelectorAll('.wd-index-anchor').length).toBe(2)
  })

  it('wd-pagination：翻页按钮 + 页码区 + 辅助文案', () => {
    const { container } = render({
      setup() {
        const value = ref(2)
        return () =>
          h(Pagination as any, {
            modelValue: value.value,
            total: 100,
            pageSize: 10,
            showMessage: true
          })
      }
    } as any)
    expect(container.querySelector('.wd-pagination')).toBeTruthy()
    expect(container.querySelector('.wd-pagination__content')).toBeTruthy()
    expect(container.querySelectorAll('.wd-pagination__nav').length).toBe(2)
    expect(container.querySelector('.wd-pagination__current')!.textContent).toBe('2')
    expect(container.querySelector('.wd-pagination__total')!.textContent).toBe('10')
    expect(container.querySelector('.wd-pagination__message')).toBeTruthy()
  })
})

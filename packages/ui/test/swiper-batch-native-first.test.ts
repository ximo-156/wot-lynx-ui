/**
 * 原生优先重写 · 布局居中契约回归（wd-swiper / wd-swiper-nav / wd-collapse /
 * wd-collapse-item / wd-drop-menu / wd-drop-menu-item / wd-swipe-action /
 * wd-table / wd-table-column）。
 *
 * 背景（NATIVE-REWRITE §3 / CONVENTIONS §15/§19/§20）：Lynx 3.x 默认 linear
 * 布局，`flex-direction` 等弹性属性只在 `display: flex` 上生效；
 * `inline-flex` / `inline-block` / `float` / `vertical-align` 写了即静默丢失
 * ——这是「样式不居中」的根因。本测试锁定本批组件「根节点三件套 + 居中成对
 * 书写 + 无 Web 专有写法 + DOM 结构不回退」的静态契约：
 *
 * 1. 每个组件根 view 显式 `display: flex` + `flex-direction`（按内容方向）；
 * 2. 需要居中处 `justify-content` + `align-items` 成对写全，文本节点另加
 *    `text-align: center`（轮播滑块、指示点、菜单项标题、折叠箭头、表格
 *    单元格左右区逐处核查）；
 * 3. 编译产物中不出现 Lynx 不识别的 Web 专有写法（inline-flex /
 *    inline-block / float / vertical-align / cursor / user-select /
 *    outline / -webkit-*）；
 * 4. 绝对定位居中用四边 0 + flex 居中，禁 `left:50% + translate`
 *    （wd-swiper-nav 的指示器定位由 50% + translate 改写为四边撑满）；
 * 5. DOM 结构（BEM 类名 / 层级）与 wot-ui 2.3.2 对齐不回退；
 * 6. wd-swipe-action 的 MTS 手势分工（根 view 主线程 touchstart/move +
 *    wrapper 后台 touch*）由 test/swipe-action-mts.test.ts 覆盖，此处只锁
 *    静态契约。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import { pause } from '../src/common/util'
import Swiper from '../src/components/wd-swiper/wd-swiper.vue'
import SwiperNav from '../src/components/wd-swiper-nav/wd-swiper-nav.vue'
import { compRead } from './helpers/component-roots'


/** 本批全部组件 */
const BATCH = [
  'wd-swiper',
  'wd-swiper-nav',
  'wd-collapse',
  'wd-collapse-item',
  'wd-drop-menu',
  'wd-drop-menu-item',
  'wd-swipe-action',
  'wd-table',
  'wd-table-column'
] as const

/**
 * 根选择器覆盖：多数组件目录名即 BEM 块名，wd-drop-menu-item 的块名是
 * wd-drop-item（与 wot-ui 一致，目录名只是文件名约定）。
 */
const ROOT_SELECTOR: Record<string, string> = {
  'wd-drop-menu-item': '.wd-drop-item'
}

/** 根节点内容方向（按 wot-ui 视觉：横向排列为 row，纵向堆叠为 column） */
const ROOT_DIRECTION: Record<string, 'row' | 'column'> = {
  'wd-swiper': 'column',
  'wd-swiper-nav': 'row',
  'wd-collapse': 'column',
  'wd-collapse-item': 'column',
  'wd-drop-menu': 'column',
  'wd-drop-menu-item': 'column',
  'wd-swipe-action': 'column',
  'wd-table': 'column',
  'wd-table-column': 'column'
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
  const rootSelector = ROOT_SELECTOR[component] || `.${component}`
  const rules = cssRules(component).filter((r) => r.selector === rootSelector)
  expect(rules.length, `${component} 应有根规则 .${component}`).toBeGreaterThan(0)
  const merged: Record<string, string> = {}
  for (const r of rules) Object.assign(merged, r.decls)
  return merged
}

/**
 * 取指定选择器的声明（找不到即失败）。
 *
 * 编译产物会把同声明块的选择器合并成逗号分组（如
 * `.wd-swipe-action__left,.wd-swipe-action__right{...}`），
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

  it.each(BATCH)('%s 不含 float / vertical-align / cursor / user-select / outline', (component) => {
    const css = compRead(component, 'index.css')
    expect(css, `${component} 残留 Web 专有声明`).not.toMatch(/(?:^|[;\s])(?:float|vertical-align|cursor|user-select|outline)\s*:/)
  })

  it.each(BATCH)('%s 不含 -webkit-*', (component) => {
    const css = compRead(component, 'index.css')
    expect(css).not.toMatch(/-webkit-/)
  })

  it.each(BATCH)('%s 不含 rpx 单位（Lynx 只认 px）', (component) => {
    const css = compRead(component, 'index.css')
    expect(css, `${component} 残留小程序专有 rpx 单位`).not.toMatch(/\d+rpx/)
  })
})

describe('原生优先：居中成对写全（NATIVE-REWRITE §3.2）', () => {
  it('wd-swiper：轮播滑块内容横纵居中', () => {
    const item = ruleOf('wd-swiper', '.wd-swiper__item')
    expect(item.display).toBe('flex')
    expect(item['flex-direction']).toBe('row')
    expectCenterPair(item, '.wd-swiper__item')

    // 内容轨道：scroll-view 平台必需的包裹层，横向排列显式 flex
    const inner = ruleOf('wd-swiper', '.wd-swiper__track-inner')
    expect(inner.display).toBe('flex')
    expect(inner['flex-direction']).toBe('row')
  })

  it('wd-swiper-nav：指示点条带四边撑满 + flex 居中（禁 left:50% + translate）', () => {
    // 根（dots 行 / fraction 文案）成对居中
    const root = rootRule('wd-swiper-nav')
    expect(root.display).toBe('flex')
    expect(root['flex-direction']).toBe('row')
    expectCenterPair(root, '.wd-swiper-nav')

    // 顶部 / 底部：左右贴边撑满 + flex 水平居中（参考源 left:50% + translateX）
    for (const sel of ['.wd-swiper-nav--top', '.wd-swiper-nav--bottom']) {
      const decls = ruleOf('wd-swiper-nav', sel)
      expect(decls.position, `${sel} 应为绝对定位`).toBe('absolute')
      expect(decls.left, `${sel} 应左贴边`).toBe('0')
      expect(decls.right, `${sel} 应右贴边`).toBe('0')
      expect(decls.transform, `${sel} 不应依赖 translate 居中`).toBeUndefined()
    }
    expect(ruleOf('wd-swiper-nav', '.wd-swiper-nav--top').top, '顶部条带贴上').not.toBe('50%')
    expect(ruleOf('wd-swiper-nav', '.wd-swiper-nav--bottom').bottom, '底部条带贴下').not.toBe('50%')

    // 左侧 / 右侧：上下贴边撑满 + flex 垂直居中（参考源 top:50% + translateY）
    for (const sel of ['.wd-swiper-nav--left', '.wd-swiper-nav--right']) {
      const decls = ruleOf('wd-swiper-nav', sel)
      expect(decls.position, `${sel} 应为绝对定位`).toBe('absolute')
      expect(decls.top, `${sel} 应贴上`).toBe('0')
      expect(decls.bottom, `${sel} 应贴下`).toBe('0')
      expect(decls.transform, `${sel} 不应依赖 translate 居中`).toBeUndefined()
    }

    // 分数文案：文本居中
    expect(ruleOf('wd-swiper-nav', '.wd-swiper-nav--fraction')['text-align'], 'fraction 需要 text-align: center').toBe('center')

    // 纵向指示器：列方向覆盖根行方向（同类名晚者胜出）
    const vertical = ruleOf('wd-swiper-nav', '.wd-swiper-nav--vertical')
    expect(vertical['flex-direction']).toBe('column')
  })

  it('wd-collapse：更多按钮（图标+文字行）交叉轴居中，箭头成对居中', () => {
    const more = ruleOf('wd-collapse', '.wd-collapse__more')
    expect(more.display).toBe('flex')
    expect(more['flex-direction']).toBe('row')
    expect(more['align-items'], '.wd-collapse__more 需要 align-items: center').toBe('center')

    const arrow = ruleOf('wd-collapse', '.wd-collapse__arrow')
    expect(arrow.display).toBe('flex')
    expect(arrow['flex-direction']).toBe('row')
    expectCenterPair(arrow, '.wd-collapse__arrow')
  })

  it('wd-collapse-item：标题行两端分布 + 交叉轴居中，箭头成对居中', () => {
    const header = ruleOf('wd-collapse-item', '.wd-collapse-item__header')
    expect(header.display).toBe('flex')
    expect(header['flex-direction']).toBe('row')
    expect(header['align-items'], '.wd-collapse-item__header 需要 align-items: center').toBe('center')
    expect(header['justify-content'], '.wd-collapse-item__header 需要 justify-content: space-between').toBe('space-between')

    // 自定义标题插槽：纵向块级流（参考源 display:block 的 Lynx 等价）
    const custom = ruleOf('wd-collapse-item', '.wd-collapse-item__header.is-custom')
    expect(custom.display).toBe('flex')
    expect(custom['flex-direction']).toBe('column')

    // 箭头图标根（wd-icon 的 view，经 custom-class 穿透）
    const arrow = ruleOf('wd-collapse-item', '.wd-collapse-item .wd-collapse-item__arrow')
    expect(arrow.display).toBe('flex')
    expect(arrow['flex-direction']).toBe('row')
    expectCenterPair(arrow, '.wd-collapse-item__arrow')
  })

  it('wd-drop-menu：菜单项定高横条内标题纵横居中', () => {
    const list = ruleOf('wd-drop-menu', '.wd-drop-menu__list')
    expect(list.display).toBe('flex')
    expect(list['flex-direction']).toBe('row')

    const option = ruleOf('wd-drop-menu', '.wd-drop-menu__option')
    expect(option.display).toBe('flex')
    expect(option['flex-direction']).toBe('column')
    expectCenterPair(option, '.wd-drop-menu__option')

    const title = ruleOf('wd-drop-menu', '.wd-drop-menu__option-title')
    expect(title.display).toBe('flex')
    expect(title['flex-direction']).toBe('row')
    expectCenterPair(title, '.wd-drop-menu__option-title')
  })

  it('wd-drop-menu-item：选项行两端分布 + 交叉轴居中，标题/提示同行', () => {
    const option = ruleOf('wd-drop-menu-item', '.wd-drop-item__option')
    expect(option.display).toBe('flex')
    expect(option['flex-direction']).toBe('row')
    expect(option['align-items'], '.wd-drop-item__option 需要 align-items: center').toBe('center')
    expect(option['justify-content'], '.wd-drop-item__option 需要 justify-content: space-between').toBe('space-between')

    for (const sel of ['.wd-drop-item__title', '.wd-drop-item__tip']) {
      const decls = ruleOf('wd-drop-menu-item', sel)
      expect(decls.display, `${sel} 应为 flex 行`).toBe('flex')
      expect(decls['flex-direction']).toBe('row')
      expect(decls['align-items'], `${sel} 需要 align-items: center`).toBe('center')
    }

    // 勾选图标根成对居中（参考源 display:block 的 Lynx 等价）
    const icon = ruleOf('wd-drop-menu-item', '.wd-drop-item .wd-drop-item__icon')
    expect(icon.display).toBe('flex')
    expectCenterPair(icon, '.wd-drop-item__icon')
  })

  it('wd-swipe-action：内容容器纵向块级流撑满宽度，操作区横向排列', () => {
    // 默认插槽内容是唯一流式子节点：flex column + stretch 令其撑满宽度
    // （与 Web 块级流语义一致；用 row 会收缩到内容宽、空白处无法触发滑动）
    const wrapper = ruleOf('wd-swipe-action', '.wd-swipe-action__wrapper')
    expect(wrapper.display).toBe('flex')
    expect(wrapper['flex-direction']).toBe('column')
    expect(wrapper['align-items'], '.wd-swipe-action__wrapper 需要 align-items: stretch').toBe('stretch')

    for (const sel of ['.wd-swipe-action__left', '.wd-swipe-action__right']) {
      const decls = ruleOf('wd-swipe-action', sel)
      expect(decls.display, `${sel} 应为 flex 行（按钮组横向排列）`).toBe('flex')
      expect(decls['flex-direction']).toBe('row')
    }
  })

  it('wd-table：单元格 flex 行 + 交叉轴居中，对齐方式同步文本 text-align', () => {
    const cell = ruleOf('wd-table', '.wd-table__cell')
    expect(cell.display).toBe('flex')
    expect(cell['flex-direction']).toBe('row')
    expect(cell['align-items'], '.wd-table__cell 需要 align-items: center').toBe('center')

    for (const sel of ['.wd-table__header', '.wd-table__body']) {
      const decls = ruleOf('wd-table', sel)
      expect(decls.display, `${sel} 应为 flex 行`).toBe('flex')
      expect(decls['flex-direction']).toBe('row')
    }

    // 列根（列主布局）：纵向容器
    const column = ruleOf('wd-table-column', '.wd-table-column')
    expect(column.display).toBe('flex')
    expect(column['flex-direction']).toBe('column')
    expect(column['flex-shrink'], '.wd-table-column 需要 flex-shrink: 0（防被表体压缩）').toBe('0')

    // 固定列阴影：px 单位（参考源 30rpx 为小程序专有单位，Lynx 不识别）；
    // 保留 --wot-table-shadow-width 主题变量，只要求回退值为 px
    const shadow = ruleOf('wd-table-column', '.wd-table-column .wd-table__shadow')
    expect(shadow.width, '阴影宽度回退值应为 px').toBe('var(--wot-table-shadow-width, 30px)')
    expect(shadow.right, '阴影偏移回退值应为 px').toBe('calc(-1*var(--wot-table-shadow-width, 30px))')
  })

  it('wd-table：居中对齐的单元格文本同步 text-align: center', () => {
    const css = compRead('wd-table', 'index.css')
    // flex 子项（text）以盒子为单位被 justify-content 对齐；换行 / 省略时
    // 盒子撑满单元格，内部文本需按对齐方式同步 text-align
    expect(css).toMatch(/\.wd-table__cell\.is-center\s+\.wd-table__value\{[^}]*text-align:center/)
    expect(css).toMatch(/\.wd-table__cell\.is-right\s+\.wd-table__value\{[^}]*text-align:right/)
  })
})

describe('原生优先：DOM 结构与 wot-ui 2.3.2 对齐不回退', () => {
  afterEach(() => cleanup())

  it('wd-swiper-nav：dots / fraction / 控制按钮结构与 change 事件', async () => {
    const changes: any[] = []
    const { container } = render({
      setup() {
        return () =>
          h(SwiperNav as any, {
            type: 'dots',
            current: 1,
            total: 3,
            direction: 'horizontal',
            indicatorPosition: 'bottom',
            minShowNum: 2,
            onChange: (e: any) => changes.push(e)
          })
      }
    } as any)
    await pause(50)
    const nav = container.querySelector('.wd-swiper-nav')!
    expect(nav).toBeTruthy()
    // BEM 类名与参考源一致：wd-swiper-nav--{direction}--{type}--{position}
    expect(nav.className).toContain('wd-swiper-nav--horizontal')
    expect(nav.className).toContain('wd-swiper-nav--dots')
    expect(nav.className).toContain('wd-swiper-nav--bottom')
    // 3 个指示点，第 2 个激活
    const dots = container.querySelectorAll('.wd-swiper-nav__item--dots')
    expect(dots.length).toBe(3)
    expect(dots[1]!.className).toContain('is-active')
    expect(dots[0]!.className).not.toContain('is-active')

    // 控制按钮：change 事件载荷 { dir, source }
    const withControls = render({
      setup() {
        return () =>
          h(SwiperNav as any, {
            type: 'dots',
            current: 0,
            total: 3,
            showControls: true,
            onChange: (e: any) => changes.push(e)
          })
      }
    } as any)
    await pause(50)
    const prev = withControls.container.querySelector('.wd-swiper-nav__btn--prev')!
    const next = withControls.container.querySelector('.wd-swiper-nav__btn--next')!
    expect(prev).toBeTruthy()
    expect(next).toBeTruthy()
    fireEvent.tap(prev)
    fireEvent.tap(next)
    await pause(30)
    expect(changes).toEqual([
      { dir: 'prev', source: 'nav' },
      { dir: 'next', source: 'nav' }
    ])
    cleanup()
  })

  it('wd-swiper-nav：fraction 类型渲染 "当前/总数" 文本', async () => {
    const { container } = render({
      setup() {
        return () => h(SwiperNav as any, { type: 'fraction', current: 1, total: 4 })
      }
    } as any)
    await pause(50)
    const nav = container.querySelector('.wd-swiper-nav')!
    expect(nav.className).toContain('wd-swiper-nav--fraction')
    expect(nav.textContent).toContain('2/4')
    cleanup()
  })

  it('wd-swiper：list 渲染滑块图片与指示点', async () => {
    const list = ['https://example.com/1.png', 'https://example.com/2.png']
    const { container } = render({
      setup() {
        return () => h(Swiper as any, { list })
      }
    } as any)
    await pause(50)
    expect(container.querySelectorAll('.wd-swiper__item').length).toBe(2)
    expect(container.querySelectorAll('.wd-swiper__image').length).toBe(2)
    expect(container.querySelectorAll('.wd-swiper-nav__item--dots').length).toBe(2)
    cleanup()
  })

  it('wd-swiper：默认插槽位于 v-for 内，提供插槽时替换默认图片（对齐参考源）', async () => {
    const list = ['https://example.com/1.png', 'https://example.com/2.png']
    const { container } = render({
      setup() {
        return () => h(Swiper as any, { list }, { default: () => h('view', { class: 'custom-slide' }, 'slide') })
      }
    } as any)
    await pause(50)
    expect(container.querySelectorAll('.wd-swiper__item').length).toBe(2)
    expect(container.querySelectorAll('.custom-slide').length).toBe(2)
    // 插槽优先：默认图片不再渲染
    expect(container.querySelectorAll('.wd-swiper__image').length).toBe(0)
    cleanup()
  })
})

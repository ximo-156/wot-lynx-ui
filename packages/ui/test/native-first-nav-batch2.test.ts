/**
 * 原生优先重写 · 布局居中契约回归（wd-tabbar / wd-tabbar-item / wd-sidebar /
 * wd-sidebar-item / wd-steps / wd-step / wd-sort-button）。
 *
 * 背景（NATIVE-REWRITE §3 / CONVENTIONS §15/§19/§20）：Lynx 3.x 默认 linear
 * 布局，`flex-direction` 等弹性属性只在 `display: flex` 上生效；
 * `inline-flex` / `inline-block` / `float` / `vertical-align` 写了即静默丢失
 * ——这是「样式不居中」的根因。本测试锁定本批组件「根节点三件套 + 居中成对
 * 书写 + 无 Web 专有写法 + DOM 结构不回退 + 原生元素优先」的静态契约：
 *
 * 1. 每个组件根 view 显式 `display: flex` + `flex-direction`（按内容方向）；
 * 2. 需要居中处 `justify-content` + `align-items` 成对写全，文本节点另加
 *    `text-align: center`（标签栏项、侧边导航项、步骤指示器、排序按钮
 *    右侧箭头区、步骤标题/描述逐处核查）；
 * 3. 编译产物中不出现 Lynx 不识别的 Web 专有写法（inline-flex /
 *    inline-block / float / vertical-align / cursor / user-select /
 *    outline / -webkit-*）；
 * 4. DOM 结构（BEM 类名 / 层级）与 wot-ui 2.3.2 对齐不回退；wd-sidebar 根
 *    元素为原生 scroll-view（NATIVE-REWRITE §3.3：滚动用 scroll-view）；
 * 5. 本批无拖动/滑动/缩放手势（交互均为 tap 提交类），不涉及 MTS 跟手；
 *    提交链路（change / update:modelValue）由行为用例覆盖。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import Tabbar from '../src/components/wd-tabbar/wd-tabbar.vue'
import TabbarItem from '../src/components/wd-tabbar-item/wd-tabbar-item.vue'
import Sidebar from '../src/components/wd-sidebar/wd-sidebar.vue'
import SidebarItem from '../src/components/wd-sidebar-item/wd-sidebar-item.vue'
import Steps from '../src/components/wd-steps/wd-steps.vue'
import Step from '../src/components/wd-step/wd-step.vue'
import SortButton from '../src/components/wd-sort-button/wd-sort-button.vue'
import { compRead } from './helpers/component-roots'


/** 本批全部组件 */
const BATCH = [
  'wd-tabbar',
  'wd-tabbar-item',
  'wd-sidebar',
  'wd-sidebar-item',
  'wd-steps',
  'wd-step',
  'wd-sort-button'
] as const

/** 根节点内容方向（按 wot-ui 视觉：横向排列为 row，纵向堆叠为 column） */
const ROOT_DIRECTION: Record<string, 'row' | 'column'> = {
  'wd-tabbar': 'row',
  'wd-tabbar-item': 'row',
  'wd-sidebar': 'column',
  'wd-sidebar-item': 'row',
  'wd-steps': 'row',
  'wd-step': 'column',
  'wd-sort-button': 'row'
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
 * `.wd-step.is-center .wd-step__title,.wd-step.is-center .wd-step__description{...}`），
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

  it.each(BATCH)('%s 不含 float / vertical-align / cursor / user-select / outline', (component) => {
    const css = compRead(component, 'index.css')
    expect(css, `${component} 残留 Web 专有声明`).not.toMatch(/(?:^|[;\s])(?:float|vertical-align|cursor|user-select|outline)\s*:/)
  })

  it.each(BATCH)('%s 不含 -webkit-*', (component) => {
    const css = compRead(component, 'index.css')
    expect(css).not.toMatch(/-webkit-/)
  })
})

describe('原生优先：居中成对写全（NATIVE-REWRITE §3.2）', () => {
  it('wd-tabbar：根与标签项横向排列，body 纵向居中，标题文本居中', () => {
    // 根：横向排列 + 双向居中（子项均 flex:1 撑满主轴）
    const root = rootRule('wd-tabbar')
    expect(root['flex-direction']).toBe('row')
    expectCenterPair(root, '.wd-tabbar')

    // 占位根（SFC 根 view）：纵向承载内部 tabbar
    const placeholder = ruleOf('wd-tabbar', '.wd-tabbar__placeholder')
    expect(placeholder.display).toBe('flex')
    expect(placeholder['flex-direction']).toBe('column')

    // 标签项：横向 + 双向居中
    const item = rootRule('wd-tabbar-item')
    expect(item['flex-direction']).toBe('row')
    expectCenterPair(item, '.wd-tabbar-item')

    // 图标 + 标题纵向组合：交叉轴居中 + 主轴居中成对
    const body = ruleOf('wd-tabbar-item', '.wd-tabbar-item__body')
    expect(body.display).toBe('flex')
    expect(body['flex-direction']).toBe('column')
    expectCenterPair(body, '.wd-tabbar-item__body')

    // 标题文本显式居中（Lynx text 不保证继承父级 text-align）
    expect(ruleOf('wd-tabbar-item', '.wd-tabbar-item__body-title')['text-align'], '标题需要 text-align: center').toBe('center')
  })

  it('wd-sidebar / wd-sidebar-item：侧边栏纵向排列，选项横向居中', () => {
    const root = rootRule('wd-sidebar')
    expect(root['flex-direction']).toBe('column')

    // 选项：图标 + 徽标（标签）横向排列，双向居中
    const item = rootRule('wd-sidebar-item')
    expect(item.display).toBe('flex')
    expect(item['flex-direction']).toBe('row')
    expectCenterPair(item, '.wd-sidebar-item')
  })

  it('wd-steps / wd-step：步骤条横向分栏，指示器与序号居中', () => {
    // 步骤条容器：横向分栏（align-items: flex-start 保持各 step 自然高度，
    // 避免 stretch 拉伸 step 盒子令连接线 top:50% 基准错位）
    const root = rootRule('wd-steps')
    expect(root['flex-direction']).toBe('row')
    expect(root['align-items']).toBe('flex-start')

    // step 根：header / content 纵向堆叠
    const step = rootRule('wd-step')
    expect(step['flex-direction']).toBe('column')

    // header 显式三件套：非居中态指示器贴左（连接线自指示器右侧起笔）
    const header = ruleOf('wd-step', '.wd-step__header')
    expect(header.display).toBe('flex')
    expect(header['flex-direction']).toBe('row')
    expect(header['justify-content']).toBe('flex-start')
    expect(header['align-items']).toBe('flex-start')

    // 指示器与圆形序号：双向居中
    const indicator = ruleOf('wd-step', '.wd-step__indicator')
    expect(indicator.display).toBe('flex')
    expect(indicator['flex-direction']).toBe('row')
    expectCenterPair(indicator, '.wd-step__indicator')

    const circle = ruleOf('wd-step', '.wd-step__circle')
    expect(circle.display).toBe('flex')
    expectCenterPair(circle, '.wd-step__circle')

    // 序号文本显式居中
    expect(ruleOf('wd-step', '.wd-step__circle-text')['text-align'], '序号需要 text-align: center').toBe('center')

    // 内容区纵向堆叠且不压缩（space 定高时内容原样溢出，CONVENTIONS §19）
    const content = ruleOf('wd-step', '.wd-step__content')
    expect(content.display).toBe('flex')
    expect(content['flex-direction']).toBe('column')
    expect(content['flex-shrink']).toBe('0')
  })

  it('wd-step is-center：指示器经 flex 主轴居中 + 标题/描述文本居中', () => {
    // 参考源经 text-align 居中 header 内 inline-flex 指示器（Web 行内盒）；
    // Lynx 无行内盒，改由 header 容器 justify-content: center 等价实现，
    // 与连接线 left: calc(50% + ...) 几何配套
    const header = ruleOf('wd-step', '.wd-step.is-center .wd-step__header')
    expect(header['justify-content'], 'is-center 态指示器应水平居中').toBe('center')

    // 标题 / 描述：容器交叉轴居中 + 文本显式居中（多行逐行居中）
    const content = ruleOf('wd-step', '.wd-step.is-center .wd-step__content')
    expect(content['align-items'], 'is-center 态内容应水平居中').toBe('center')

    for (const sel of ['.wd-step.is-center .wd-step__title', '.wd-step.is-center .wd-step__description']) {
      expect(ruleOf('wd-step', sel)['text-align'], `${sel} 需要 text-align: center`).toBe('center')
    }
  })

  it('wd-sort-button：标题区与箭头区横向排列，箭头区双向居中', () => {
    const root = rootRule('wd-sort-button')
    expect(root['flex-direction']).toBe('row')
    expect(root['align-items'], '.wd-sort-button 需要 align-items: center').toBe('center')

    // 标题 + 下划线区：横向 + 交叉轴居中
    const wrapper = ruleOf('wd-sort-button', '.wd-sort-button__wrapper')
    expect(wrapper.display).toBe('flex')
    expect(wrapper['flex-direction']).toBe('row')
    expect(wrapper['align-items']).toBe('center')

    const left = ruleOf('wd-sort-button', '.wd-sort-button__left')
    expect(left.display).toBe('flex')
    expect(left['flex-direction']).toBe('row')
    expect(left['align-items']).toBe('center')

    // 上下箭头区：纵向 + 双向居中
    const right = ruleOf('wd-sort-button', '.wd-sort-button__right')
    expect(right.display).toBe('flex')
    expect(right['flex-direction']).toBe('column')
    expectCenterPair(right, '.wd-sort-button__right')
  })
})

describe('原生优先：DOM 结构不回退（BEM 类名 / 层级，PORTING §3.1）', () => {
  afterEach(() => cleanup())

  it('wd-tabbar / wd-tabbar-item：占位根三件套经内联样式下发，选中项切换', async () => {
    const changes: unknown[] = []
    const { container } = render({
      setup() {
        const value = ref(0)
        return () =>
          h(
            Tabbar as any,
            {
              modelValue: value.value,
              'onUpdate:modelValue': (v: number | string) => {
                value.value = v as number
              },
              onChange: (v: unknown) => changes.push(v)
            },
            {
              default: () => [
                h(TabbarItem as any, { name: 0, title: '首页', icon: 'home' }),
                h(TabbarItem as any, { name: 1, title: '我的', icon: 'user' })
              ]
            }
          )
      }
    } as any)
    await new Promise((r) => setTimeout(r, 30))

    const root = container.firstElementChild!
    // 占位根（SFC 根）经 Style Funnel 下发 display/flex-direction 常量键——
    // 占位类名仅在 round + fixed + placeholder + 安全区场景挂载，未挂载时
    // 根 view 不得退回 Lynx 默认 linear 布局
    expect(styleOf(root)).toMatch(/display:\s*flex/)
    expect(styleOf(root)).toMatch(/flex-direction:\s*column/)

    expect(container.querySelector('.wd-tabbar')).toBeTruthy()
    const items = container.querySelectorAll('.wd-tabbar-item')
    expect(items.length).toBe(2)
    expect(container.querySelector('.wd-tabbar-item__body')).toBeTruthy()
    expect(container.querySelectorAll('.wd-tabbar-item__body-title').length).toBe(2)
    // 激活态类名下发到图标与标题
    expect(container.querySelector('.wd-tabbar-item__body-title.is-active')).toBeTruthy()
    expect(container.querySelectorAll('.wd-tabbar-item__body-title.is-inactive').length).toBe(1)

    // tap 提交链路：change 携带 value
    fireEvent.tap(items[1])
    await new Promise((r) => setTimeout(r, 30))
    expect(changes).toEqual([{ value: 1 }])
  })

  it('wd-sidebar / wd-sidebar-item：根为原生 scroll-view，选中项切换 + 指示条', async () => {
    const changes: unknown[] = []
    const { container } = render({
      setup() {
        const value = ref('a')
        return () =>
          h(
            Sidebar as any,
            {
              modelValue: value.value,
              'onUpdate:modelValue': (v: number | string) => {
                value.value = String(v)
              },
              onChange: (v: unknown) => changes.push(v)
            },
            {
              default: () => [
                h(SidebarItem as any, { label: '选项A', value: 'a' }),
                h(SidebarItem as any, { label: '选项B', value: 'b' })
              ]
            }
          )
      }
    } as any)
    await new Promise((r) => setTimeout(r, 30))

    // 原生优先（NATIVE-REWRITE §3.3）：根元素为 scroll-view（scroll-y），
    // Lynx 普通 view 的 overflow-y: auto 不产生滚动
    const scroll = container.querySelector('scroll-view')!
    expect(scroll, 'wd-sidebar 根应为原生 scroll-view').toBeTruthy()
    expect(scroll.classList.contains('wd-sidebar')).toBe(true)
    // scroll-y 为布尔属性（裸属性渲染为空串，:scroll-y="true" 渲染为 true）
    expect(['true', '']).toContain(scroll.getAttribute('scroll-y'))

    const items = container.querySelectorAll('.wd-sidebar-item')
    expect(items.length).toBe(2)
    expect(items[0].classList.contains('wd-sidebar-item--active')).toBe(true)
    // 激活指示条为模板真实元素（参考源 ::before 伪元素的适配），仅激活时渲染
    expect(items[0].querySelector('.wd-sidebar-item__indicator')).toBeTruthy()
    expect(items[1].querySelector('.wd-sidebar-item__indicator')).toBeFalsy()

    fireEvent.tap(items[1])
    await new Promise((r) => setTimeout(r, 30))
    expect(changes).toEqual([{ value: 'b', label: '选项B' }])
  })

  it('wd-sidebar-item：disabled 早退不发 change', async () => {
    const changes: unknown[] = []
    const { container } = render({
      setup() {
        const value = ref('a')
        return () =>
          h(
            Sidebar as any,
            {
              modelValue: value.value,
              'onUpdate:modelValue': (v: number | string) => {
                value.value = String(v)
              },
              onChange: (v: unknown) => changes.push(v)
            },
            {
              default: () => [
                h(SidebarItem as any, { label: '选项A', value: 'a' }),
                h(SidebarItem as any, { label: '选项B', value: 'b', disabled: true })
              ]
            }
          )
      }
    } as any)
    await new Promise((r) => setTimeout(r, 30))
    const items = container.querySelectorAll('.wd-sidebar-item')
    expect(items[1].classList.contains('wd-sidebar-item--disabled')).toBe(true)
    fireEvent.tap(items[1])
    await new Promise((r) => setTimeout(r, 30))
    expect(changes).toEqual([])
  })

  it('wd-steps / wd-step：状态推导 + 连接线 + 默认文案走 locale', async () => {
    const { container } = render({
      setup() {
        return () =>
          h(
            Steps as any,
            { active: 1 },
            {
              default: () => [
                h(Step as any, { title: '步骤一', description: '描述一' }),
                h(Step as any, { title: '步骤二', description: '描述二' }),
                h(Step as any, { title: '步骤三', description: '描述三' })
              ]
            }
          )
      }
    } as any)
    await new Promise((r) => setTimeout(r, 30))

    expect(container.querySelector('.wd-steps')).toBeTruthy()
    const steps = container.querySelectorAll('.wd-step')
    expect(steps.length).toBe(3)
    // active=1：第一项 finished、第二项 process、第三项 wait
    expect(steps[0].classList.contains('wd-step--finished')).toBe(true)
    expect(steps[1].classList.contains('wd-step--process')).toBe(true)
    expect(steps[2].classList.contains('wd-step--wait')).toBe(true)
    // 连接线仅在非末项渲染
    expect(container.querySelectorAll('.wd-step__line').length).toBe(2)
    // 序号 / 标题 / 描述均在 text 元素中：finished 态显示对勾图标（无序号），
    // process / wait 态显示序号
    expect(steps[0].querySelector('.wd-step__circle-text')).toBeFalsy()
    expect(steps[0].querySelector('.wd-step__finished-icon')).toBeTruthy()
    expect(steps[1].querySelector('.wd-step__circle-text')!.textContent).toBe('2')
    expect(steps[2].querySelector('.wd-step__circle-text')!.textContent).toBe('3')
    expect(steps[1].querySelector('.wd-step__title')!.textContent).toBe('步骤二')
    expect(steps[1].querySelector('.wd-step__description')!.textContent).toBe('描述二')
  })

  it('wd-steps：vertical / dot / alignCenter / space 变体类名与内联宽度', async () => {
    const { container } = render({
      setup() {
        return () =>
          h(
            Steps as any,
            { active: 0, vertical: true, dot: true, space: '80px' },
            {
              default: () => [h(Step as any, { title: '步骤一' }), h(Step as any, { title: '步骤二' })]
            }
          )
      }
    } as any)
    await new Promise((r) => setTimeout(r, 30))

    expect(container.querySelector('.wd-steps.is-vertical')).toBeTruthy()
    const steps = container.querySelectorAll('.wd-step')
    expect(steps[0].classList.contains('wd-step--finished')).toBe(false)
    expect(steps[0].classList.contains('wd-step--process')).toBe(true)
    // 点状指示器
    expect(container.querySelectorAll('.wd-step__dot').length).toBe(2)
    expect(container.querySelector('.wd-step__header.is-dot')).toBeTruthy()
    // vertical + space：高度经内联样式下发（对象语法）
    expect(styleOf(steps[0])).toMatch(/height:\s*80px/)

    // alignCenter（横向）：is-center 类名下发，指示器居中几何见 CSS 契约
    cleanup()
    const centered = render({
      setup() {
        return () =>
          h(
            Steps as any,
            { active: 0, alignCenter: true },
            {
              default: () => [h(Step as any, { title: '步骤一' }), h(Step as any, { title: '步骤二' })]
            }
          )
      }
    } as any)
    await new Promise((r) => setTimeout(r, 30))
    const centeredSteps = centered.container.querySelectorAll('.wd-step')
    expect(centeredSteps[0].classList.contains('is-center')).toBe(true)
    // 横向默认宽度 100%/n 经内联样式下发
    expect(styleOf(centeredSteps[0])).toMatch(/width:\s*50%/)
  })

  it('wd-sort-button：三态循环 + descFirst + line 下划线', async () => {
    const updates: number[] = []
    const renderButton = (props: Record<string, any>) =>
      render({
        setup() {
          const value = ref(props.modelValue ?? 0)
          return () =>
            h(SortButton as any, {
              ...props,
              modelValue: value.value,
              'onUpdate:modelValue': (v: number) => {
                value.value = v
                updates.push(v)
              }
            })
        }
      } as any)

    // 默认循环：0 → 1 → -1 → 0（allowReset）
    const { container } = renderButton({ title: '价格', allowReset: true })
    const btn = container.querySelector('.wd-sort-button')!
    expect(container.querySelector('.wd-sort-button__wrapper')).toBeTruthy()
    expect(container.querySelector('.wd-sort-button__left')!.textContent).toBe('价格')
    expect(container.querySelectorAll('.wd-sort-button__icon-up').length).toBe(1)
    expect(container.querySelectorAll('.wd-sort-button__icon-down').length).toBe(1)

    fireEvent.tap(btn)
    await new Promise((r) => setTimeout(r, 20))
    expect(updates[updates.length - 1]).toBe(1)
    // 升序激活：icon-down--active
    expect(container.querySelector('.wd-sort-button__icon-down--active')).toBeTruthy()

    fireEvent.tap(btn)
    await new Promise((r) => setTimeout(r, 20))
    expect(updates[updates.length - 1]).toBe(-1)

    fireEvent.tap(btn)
    await new Promise((r) => setTimeout(r, 20))
    expect(updates[updates.length - 1]).toBe(0)

    cleanup()
    updates.length = 0

    // descFirst：0 → -1 → 1 → -1（不允许重置）
    const desc = renderButton({ title: '价格', descFirst: true })
    fireEvent.tap(desc.container.querySelector('.wd-sort-button')!)
    await new Promise((r) => setTimeout(r, 20))
    expect(updates[updates.length - 1]).toBe(-1)
    fireEvent.tap(desc.container.querySelector('.wd-sort-button')!)
    await new Promise((r) => setTimeout(r, 20))
    expect(updates[updates.length - 1]).toBe(1)
    fireEvent.tap(desc.container.querySelector('.wd-sort-button')!)
    await new Promise((r) => setTimeout(r, 20))
    expect(updates[updates.length - 1]).toBe(-1)

    cleanup()
    // line 变体：下划线为模板真实元素（参考源 ::after 伪元素适配）
    const line = renderButton({ title: '价格', line: true, modelValue: 1 })
    const lineBtn = line.container.querySelector('.wd-sort-button')!
    expect(lineBtn.classList.contains('wd-sort-button--line')).toBe(true)
    expect(line.container.querySelector('.wd-sort-button__underline')).toBeTruthy()
    expect(line.container.querySelector('.wd-sort-button__underline.is-active')).toBeTruthy()
  })
})

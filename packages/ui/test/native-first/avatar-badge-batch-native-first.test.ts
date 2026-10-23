/**
 * 原生优先重写 · 布局居中契约回归测试（wd-avatar / wd-avatar-group /
 * wd-badge / wd-tag / wd-progress / wd-circle）。
 *
 * 背景（NATIVE-REWRITE §3 / CONVENTIONS §15/§19）：Lynx 3.x 默认 linear 布局，
 * `flex-direction` 等弹性属性只在 `display: flex` 上生效；`inline-flex` /
 * `inline-block` / `float` / `vertical-align` 写了即静默丢失——这是「样式
 * 不居中」的根因。本批六个组件均为「静态 / 展示」类别：无拖动 / 滑动 / 缩放
 * 的跟手手势（头像 / 徽标 / 标签为点选交互，进度推进与圆环动画由定时器 +
 * CSS transition 驱动），按 NATIVE-REWRITE §8 分工不涉及 MTS worklet；重写
 * 重点是根节点三件套、居中补全与绝对定位居中写法：
 *
 * 1. 每个组件根 view（含 avatar-group 根、badge 角标、progress 的 outer /
 *    inner、circle 的文案层）显式 `display: flex` + `flex-direction`；
 * 2. 需要居中处 `justify-content` + `align-items` 成对写全，文本节点另加
 *    `text-align: center`（头像文本、圆环文案逐处核查）；
 * 3. 编译产物中不出现 Lynx 不识别的 Web 专有写法（inline-flex /
 *    inline-block / float / vertical-align / cursor / user-select /
 *    outline / -webkit-*）；
 * 4. 绝对定位居中用四边 0 + flex 成对居中，禁 top/left: 50% + translate
 *    （wd-circle 的 __text 由参考源的 top: 50% + translateY(-50%) 改写）；
 * 5. DOM 结构（BEM 类名 / 层级 / 原生元素）与 wot-ui 2.3.2 对齐不回退，
 *    各组件既有交互事件链路（error / click / close / confirm / tap /
 *    update:modelValue）保持可用。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'
import Avatar from '../../src/components/wd-avatar/wd-avatar.vue'
import AvatarGroup from '../../src/components/wd-avatar-group/wd-avatar-group.vue'
import Badge from '../../src/primitives/wd-badge/wd-badge.vue'
import Tag from '../../src/components/wd-tag/wd-tag.vue'
import Progress from '../../src/components/wd-progress/wd-progress.vue'
import Circle from '../../src/components/wd-circle/wd-circle.vue'
import { compRead } from '../helpers/component-roots'

// 双组件根解析（ADR-012）：rel 形如 'wd-cell/index.css'，跨 primitives/components 定位
const css = (rel: string) => compRead(...rel.split('/'))

/** 抽取指定选择器的声明体（编译产物为压缩单行，按选择器精确切分） */
function ruleOf(cssText: string, selector: string): string {
  const re = new RegExp(`(?:^|[,}])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^{}]*)\\}`, 'm')
  const m = cssText.match(re)
  if (!m) throw new Error(`selector not found in compiled css: ${selector}`)
  return m[1]
}

/** 根节点三件套：display: flex + 显式 flex-direction */
function expectRootFlex(cssText: string, selector: string, direction: 'row' | 'column') {
  const body = ruleOf(cssText, selector)
  expect(body, `${selector} 必须显式 display: flex`).toMatch(/(^|;)display:flex(;|$)/)
  expect(body, `${selector} 必须显式 flex-direction: ${direction}`).toMatch(
    new RegExp(`(^|;)flex-direction:${direction}(;|$)`)
  )
}

/** 居中成对：justify-content + align-items 同时出现 */
function expectCenterPair(cssText: string, selector: string) {
  const body = ruleOf(cssText, selector)
  expect(body, `${selector} 需要 justify-content: center`).toMatch(/(^|;)justify-content:center(;|$)/)
  expect(body, `${selector} 需要 align-items: center`).toMatch(/(^|;)align-items:center(;|$)/)
}

/** Lynx 不识别、写了即静默丢失的 Web 专有写法 */
const SILENTLY_DROPPED = [
  /display:inline-flex/,
  /display:inline-block/,
  /(^|;)float:/,
  /(^|;)vertical-align:/,
  /(^|;)cursor:/,
  /(^|;)user-select:/,
  /(^|;)outline:/,
  /-webkit-/
]

const BATCH_CSS = [
  'wd-avatar/index.css',
  'wd-avatar-group/index.css',
  'wd-badge/index.css',
  'wd-tag/index.css',
  'wd-progress/index.css',
  'wd-circle/index.css'
]

/** 按选择器拆成声明表（与 layout-native-first.test.ts 同构） */
function cssRules(rel: string): Array<{ selector: string; decls: Record<string, string> }> {
  const cssText = css(rel)
  const rules: Array<{ selector: string; decls: Record<string, string> }> = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(cssText))) {
    const selector = m[1]!.trim()
    if (selector.startsWith('@')) continue
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

/** 取规则的「基础元素选择器」：去掉 is-* / --* 修饰类 */
function baseSelector(selector: string): string {
  return selector
    .replace(/\.[\w-]*--[\w-]+/g, '')
    .replace(/\.is-[\w-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('原生优先重写 · 布局居中契约（avatar / avatar-group / badge / tag / progress / circle）', () => {
  afterEach(() => cleanup())

  it('编译产物不含 Lynx 静默丢失的 Web 专有写法', () => {
    for (const rel of BATCH_CSS) {
      const text = css(rel)
      for (const re of SILENTLY_DROPPED) {
        expect(re.test(text), `${rel} 含 Lynx 不识别写法: ${re}`).toBe(false)
      }
    }
  })

  it('根节点三件套：六个组件根显式 flex + 方向', () => {
    // 横向行：头像（内容自适应方块）、头像组（层叠行）、徽标（包裹内容）、
    // 标签（图标+文字行）、进度条（条体+文案行）、圆环（svg + 文案层）
    expectRootFlex(css('wd-avatar/index.css'), '.wd-avatar', 'row')
    expectRootFlex(css('wd-avatar-group/index.css'), '.wd-avatar-group', 'row')
    expectRootFlex(css('wd-badge/index.css'), '.wd-badge', 'row')
    expectRootFlex(css('wd-tag/index.css'), '.wd-tag', 'row')
    expectRootFlex(css('wd-progress/index.css'), '.wd-progress', 'row')
    expectRootFlex(css('wd-circle/index.css'), '.wd-circle', 'row')
    // 垂直层叠变体：头像组纵向排列
    expect(ruleOf(css('wd-avatar-group/index.css'), '.wd-avatar-group.is-vertical')).toMatch(
      /(^|;)flex-direction:column(;|$)/
    )
  })

  it('wd-progress：outer / inner 显式 flex 行（参考源 display: block 引擎不识别）', () => {
    const c = css('wd-progress/index.css')
    // 参考源 outer 为 display: block（Lynx 仅认 flex/none/linear，CONVENTIONS §15），
    // 显式改写为 flex + row；inner 的文案 / 图标同为横向行
    expectRootFlex(c, '.wd-progress__outer', 'row')
    expectRootFlex(c, '.wd-progress__inner', 'row')
    expect(c).not.toMatch(/display:block/)
  })

  it('居中成对：avatar 根 / badge 角标 / circle 根 + 文案层 / tag 交叉轴', () => {
    const avatar = css('wd-avatar/index.css')
    // 头像内容（图片 / 文本 / 图标）在根内成对居中，文本节点另加 text-align
    expectCenterPair(avatar, '.wd-avatar')
    expect(ruleOf(avatar, '.wd-avatar__text')).toMatch(/(^|;)text-align:center(;|$)/)

    const badge = css('wd-badge/index.css')
    // 角标内容（数字 / 圆点）成对居中
    expectCenterPair(badge, '.wd-badge__content')

    const tag = css('wd-tag/index.css')
    // 图标 + 文字 + 关闭按钮同一横向行，交叉轴居中
    expect(ruleOf(tag, '.wd-tag')).toMatch(/(^|;)align-items:center(;|$)/)

    const circle = css('wd-circle/index.css')
    // 圆环（svg）在根内成对居中；文案层四边 0 + flex 成对居中 + 文本居中
    expectCenterPair(circle, '.wd-circle')
    expectCenterPair(circle, '.wd-circle__text')
    expect(ruleOf(circle, '.wd-circle__text')).toMatch(/(^|;)text-align:center(;|$)/)
  })

  it('wd-circle：文案层绝对定位居中用四边 0 + flex，禁 top:50% + translate', () => {
    const text = ruleOf(css('wd-circle/index.css'), '.wd-circle__text')
    // 四边 0 撑满父级（禁 left/top: 50% + translate 的百分比 + transform 组合）
    for (const prop of ['left', 'right', 'top', 'bottom']) {
      expect(text, `.wd-circle__text 需要 ${prop}: 0`).toMatch(new RegExp(`(^|;)${prop}:0(;|$)`))
    }
    expect(text).not.toMatch(/top:\s*50%/)
    expect(text).not.toMatch(/transform/)
    expect(text).not.toMatch(/width:\s*100%/)
  })

  it('六个组件所有含 flex-direction 的规则，其元素都声明了 display:flex', () => {
    for (const rel of BATCH_CSS) {
      const rules = cssRules(rel)
      const flexElements = new Set<string>()
      for (const rule of rules) {
        if (rule.decls.display === 'flex') flexElements.add(baseSelector(rule.selector))
      }
      for (const rule of rules) {
        if (!Object.prototype.hasOwnProperty.call(rule.decls, 'flex-direction')) continue
        expect(
          flexElements.has(baseSelector(rule.selector)),
          `${rel} 的 ${rule.selector} 用了 flex-direction，但其元素未声明 display: flex —— Lynx 3.x 下该声明被静默丢弃`
        ).toBe(true)
      }
    }
  })

  it('DOM 对齐：avatar 文本 / 图标 / 自定义尺寸内联样式', async () => {
    const { container } = render(Avatar as any, { text: 'A' })
    await pause(50)
    const root = container.querySelector('.wd-avatar')!
    expect(root.classList.contains('is-round')).toBe(true)
    expect(root.classList.contains('wd-avatar--normal')).toBe(true)
    // 文本节点包 text 元素（CONVENTIONS §4）
    expect(root.querySelector('text.wd-avatar__text')!.textContent).toBe('A')
    cleanup()

    // 图标模式：wd-icon 以 custom-class wd-avatar__icon 挂载
    const icon = render(Avatar as any, { icon: 'picture' })
    await pause(50)
    expect(icon.container.querySelector('.wd-avatar__icon')).not.toBeNull()
    cleanup()

    // 自定义尺寸：内联样式对象语法（字符串 :style 会被静默丢弃，§19；
    // jsdom 会把 calc(48px * 0.45) 归一为 calc(21.6px)）
    const custom = render(Avatar as any, { text: 'B', size: 48 })
    await pause(50)
    const style = custom.container.querySelector('.wd-avatar')!.getAttribute('style') || ''
    expect(style).toMatch(/width:\s*48px/)
    expect(style).toMatch(/height:\s*48px/)
    expect(style).toMatch(/font-size:\s*calc\((?:48px \* 0\.45|21\.6px)\)/)
  })

  it('交互链路：avatar 根 view @tap 同时转发 click 与 tap（CONVENTIONS §14）', async () => {
    const clicks: number[] = []
    const taps: number[] = []
    const { container } = render({
      setup() {
        return () =>
          h(Avatar as any, {
            text: 'A',
            onClick: () => clicks.push(1),
            onTap: () => taps.push(1)
          })
      }
    } as any)
    await pause(50)
    fireEvent.tap(container.querySelector('.wd-avatar')!)
    await pause(50)
    expect(clicks.length).toBe(1)
    expect(taps.length).toBe(1)
  })

  it('DOM 对齐：avatar-group 层叠 / maxCount 折叠 / z-index 与折叠头像', async () => {
    const { container } = render({
      setup() {
        return () =>
          h(AvatarGroup as any, { maxCount: 2, cascading: 'left-up' }, {
            default: () => [
              h(Avatar as any, { text: 'A' }),
              h(Avatar as any, { text: 'B' }),
              h(Avatar as any, { text: 'C' })
            ]
          })
      }
    } as any)
    await pause(50)
    const group = container.querySelector('.wd-avatar-group')!
    expect(group.classList.contains('wd-avatar-group--left-up')).toBe(true)
    const avatars = container.querySelectorAll('.wd-avatar')
    // 前两个注册头像 + 一个 _internal 折叠头像
    expect(avatars.length).toBe(3)
    // 超出 maxCount 的第三个注册头像由自身 isShow 隐藏（v-if 不渲染）
    expect(avatars[0].classList.contains('is-first')).toBe(true)
    expect(avatars[1].classList.contains('is-first')).toBe(false)
    // 层叠间距类名（Lynx 无 :first-child / 兄弟选择器，改用索引类名）
    expect(avatars[0].classList.contains('wd-avatar__group-item')).toBe(true)
    // left-up：越后面 z-index 越大（1, 2, …）
    expect(avatars[0].getAttribute('style')).toMatch(/z-index:\s*1/)
    expect(avatars[1].getAttribute('style')).toMatch(/z-index:\s*2/)
    // 折叠头像：+N 文案 + 参考源同源灰底（jsdom 把 8 位十六进制归一为 rgb()）
    const collapse = avatars[2]
    expect(collapse.textContent).toBe('+1')
    expect(collapse.getAttribute('style')).toMatch(/background:\s*(?:#ebedf0ff|rgb\(235,\s*237,\s*240\))/)
    expect(collapse.getAttribute('style')).toMatch(/z-index:\s*3/)
  })

  it('DOM 对齐：avatar-group 纵向层叠与 right-up 方向', async () => {
    const { container } = render({
      setup() {
        return () =>
          h(AvatarGroup as any, { vertical: true, cascading: 'right-up' }, {
            default: () => [h(Avatar as any, { text: 'A' }), h(Avatar as any, { text: 'B' })]
          })
      }
    } as any)
    await pause(50)
    expect(container.querySelector('.wd-avatar-group.is-vertical')).not.toBeNull()
    const avatars = container.querySelectorAll('.wd-avatar')
    expect(avatars[0].classList.contains('wd-avatar__group-item--vertical')).toBe(true)
    // right-up：越前面 z-index 越大
    expect(avatars[0].getAttribute('style')).toMatch(/z-index:\s*2/)
    expect(avatars[1].getAttribute('style')).toMatch(/z-index:\s*1/)
  })

  it('DOM 对齐：badge 数字 / max 截断 / 圆点 / 隐藏与类型', async () => {
    const num = render(Badge as any, { value: 5 })
    await pause(50)
    expect(num.container.querySelector('.wd-badge__content')!.textContent).toBe('5')
    cleanup()

    const max = render(Badge as any, { value: 100, max: 99 })
    await pause(50)
    expect(max.container.querySelector('.wd-badge__content')!.textContent).toBe('99+')
    cleanup()

    const dot = render(Badge as any, { isDot: true })
    await pause(50)
    const dotContent = dot.container.querySelector('.wd-badge__content')!
    expect(dotContent.classList.contains('is-dot')).toBe(true)
    cleanup()

    const hidden = render(Badge as any, { value: 5, hidden: true })
    await pause(50)
    expect(hidden.container.querySelector('.wd-badge__content')).toBeNull()
    cleanup()

    const typed = render(Badge as any, { value: 3, type: 'primary', bgColor: '#ff0000', top: 4, right: 6 })
    await pause(50)
    const content = typed.container.querySelector('.wd-badge__content')!
    expect(content.classList.contains('wd-badge__content--primary')).toBe(true)
    // top / right / bgColor 经内联对象样式下发（§19；jsdom 把 hex 归一为 rgb()）
    const style = content.getAttribute('style') || ''
    expect(style).toMatch(/top:\s*4px/)
    expect(style).toMatch(/right:\s*6px/)
    expect(style).toMatch(/background-color:\s*(?:#ff0000|rgb\(255,\s*0,\s*0\))/)
  })

  it('交互链路：tag 根 view @tap 转发 click + tap，关闭按钮 emit close', async () => {
    const clicks: number[] = []
    const closes: number[] = []
    const { container } = render({
      setup() {
        return () =>
          h(Tag as any, {
            type: 'primary',
            closable: true,
            onClick: () => clicks.push(1),
            onTap: () => clicks.push(2),
            onClose: () => closes.push(1)
          }, { default: () => h('text', '标签') })
      }
    } as any)
    await pause(50)
    const root = container.querySelector('.wd-tag')!
    expect(root.classList.contains('is-primary')).toBe(true)
    // 图标 + 文字行：slot 内容 + 关闭按钮
    expect(root.querySelector('.wd-tag__close')).not.toBeNull()

    fireEvent.tap(root.querySelector('.wd-tag__close')!)
    await pause(50)
    expect(closes.length).toBe(1)

    fireEvent.tap(root)
    await pause(50)
    expect(clicks).toEqual([1, 2])
  })

  it('DOM 对齐：tag dynamic 新增态渲染原生 input', async () => {
    const { container } = render(Tag as any, { dynamic: true })
    await pause(50)
    // 默认展示「+ 添加」按钮（图标 + 文案同行）
    const addBtn = container.querySelector('.wd-tag__text')!
    expect(addBtn).not.toBeNull()
    fireEvent.tap(addBtn)
    await pause(50)
    // 点击后切换为原生 input 录入（Lynx 原生键盘）
    expect(container.querySelector('input.wd-tag__input')).not.toBeNull()
  })

  it('DOM 对齐：progress 条体 / 进度内联宽度 / inner 态文案 / status 图标', async () => {
    const { container } = render(Progress as any, { percentage: 60 })
    await pause(100)
    const root = container.querySelector('.wd-progress')!
    expect(root.querySelector('.wd-progress__outer')).not.toBeNull()
    // 进度宽度经内联对象样式下发（字符串 :style 会被静默丢弃，§19）
    const inner = root.querySelector('.wd-progress__inner')!
    expect(inner.getAttribute('style')).toMatch(/width:\s*60%/)
    // 外侧文案（默认 percentPosition.type = outer）
    expect(root.querySelector('.wd-progress__label text')!.textContent).toBe('60%')
    cleanup()

    // inner 态：文案渲染到进度条内部，带对齐修饰类
    const innerMode = render(Progress as any, { percentage: 30, percentPosition: { type: 'inner', align: 'left' } })
    await pause(100)
    expect(innerMode.container.querySelector('.wd-progress--inner')).not.toBeNull()
    const label = innerMode.container.querySelector('.wd-progress__inner .wd-progress__label')!
    expect(label.classList.contains('is-align-left')).toBe(true)
    expect(label.querySelector('text')!.textContent).toBe('30%')
    cleanup()

    // status 态：hideText 时以内置图标替代文案
    const status = render(Progress as any, { percentage: 100, status: 'success', hideText: true })
    await pause(100)
    const icon = status.container.querySelector('.wd-progress__label.wd-progress__icon')!
    expect(icon.classList.contains('is-hide-text')).toBe(true)
  })

  it('DOM 对齐：circle SVG 双圆 + 文案层（含插槽分支）', async () => {
    const { container } = render(Circle as any, { modelValue: 0, text: '0%' })
    await pause(100)
    const root = container.querySelector('.wd-circle')!
    // SVG 矢量绘制（平台降级：canvas 2d → svg，CONVENTIONS §12）
    const svg = root.querySelector('svg')!
    expect(svg).not.toBeNull()
    expect(svg.getAttribute('style')).toMatch(/width:\s*120px/)
    expect(svg.getAttribute('style')).toMatch(/height:\s*120px/)
    // content 仅用白名单元素（svg / circle，CONVENTIONS §8）
    const content = String(svg.getAttribute('content') || '')
    expect(content).toMatch(/<svg /)
    expect(content).toMatch(/<circle /)
    // 进度 0：按参考源 renderDot 在顶部绘制圆点
    expect(content).toMatch(/<circle[^>]*r="4.5"/)
    // 文案分支：text prop 渲染 text 元素
    expect(root.querySelector('text.wd-circle__text')!.textContent).toBe('0%')
    cleanup()

    // 默认插槽分支：view 承载消费方内容
    const slot = render({
      setup() {
        return () => h(Circle as any, { modelValue: 50 }, { default: () => h('text', '半数') })
      }
    } as any)
    await pause(100)
    const slotRoot = slot.container.querySelector('.wd-circle')!
    expect(slotRoot.querySelector('view.wd-circle__text text')!.textContent).toBe('半数')
    // 进度 50：进度弧以 stroke-dasharray / dashoffset 表达
    const arc = String(slotRoot.querySelector('svg')!.getAttribute('content') || '')
    expect(arc).toMatch(/stroke-dasharray=/)
    expect(arc).toMatch(/stroke-dashoffset=/)
  })

  it('交互链路：circle modelValue 动画推进（speed 步进）', async () => {
    const value = ref(0)
    const updates: number[] = []
    const { container } = render({
      setup() {
        return () =>
          h(Circle as any, {
            modelValue: value.value,
            speed: 50,
            'onUpdate:modelValue': (v: number) => updates.push(v)
          })
      }
    } as any)
    await pause(100)
    const before = String(container.querySelector('svg')!.getAttribute('content') || '')
    // 初始 0 态：顶部圆点（renderDot）
    expect(before).toMatch(/<circle[^>]*r="4.5"/)

    value.value = 100
    await pause(300)
    const after = String(container.querySelector('svg')!.getAttribute('content') || '')
    // 动画推进后切换为进度弧
    expect(after).toMatch(/stroke-dasharray=/)
    expect(after).not.toMatch(/r="4.5"/)
  })
})

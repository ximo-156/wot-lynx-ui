/**
 * 原生优先重写 · 展示家族布局居中契约回归（wd-count-down / wd-count-to /
 * wd-skeleton / wd-loadmore / wd-notice-bar / wd-watermark）。
 *
 * 背景（NATIVE-REWRITE §3 / CONVENTIONS §15/§19）：本批组件均为「静态/展示」
 * 类别——无拖动/滑动/缩放的跟手手势（倒计时与数字滚动由 rAF 在后台线程驱动
 * 数值、通知栏滚动由 CSS transition 在 UI 线程原生执行、水印平铺为静态网格），
 * 按 §8 分工不涉及 MTS worklet；重写重点是根节点三件套与居中补全：
 *
 * 1. Lynx 3.x 默认 linear 布局，`flex-direction` 只在 `display: flex` 上生效
 *    （CONVENTIONS §15）——六组件根视图（含 skeleton 的 __row / __col、
 *    watermark 的 __unit 等可见组合）显式 display: flex + flex-direction；
 * 2. 需要居中处 justify-content + align-items 成对写全，文本节点另加
 *    text-align: center；
 * 3. 编译产物不出现 Lynx 静默丢失的 Web 专有写法（inline-flex /
 *    inline-block / float / vertical-align / cursor / user-select /
 *    outline / -webkit-*）——wd-count-to 参考源的 vertical-align: bottom
 *    即属此类，已由 align-items: flex-end 原生等价承担；
 * 4. 绝对定位铺满用四边 0（watermark 水印图层），fixed 语义落在图层自身
 *    （CONVENTIONS §9：fixed 节点必须是显隐/动画节点本身）；
 * 5. DOM 结构（BEM 类名 / 层级 / 原生元素）与 wot-ui 2.3.2 对齐不回退，
 *    各组件既有交互事件链路（change / finish / close / click / reload /
 *    next）保持可用。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { pause } from '../../src/common/util'
import { fireEvent } from '../fire-event'
import CountDown from '../../src/components/wd-count-down/wd-count-down.vue'
import CountTo from '../../src/components/wd-count-to/wd-count-to.vue'
import Skeleton from '../../src/components/wd-skeleton/wd-skeleton.vue'
import Loadmore from '../../src/components/wd-loadmore/wd-loadmore.vue'
import NoticeBar from '../../src/components/wd-notice-bar/wd-notice-bar.vue'
import Watermark from '../../src/components/wd-watermark/wd-watermark.vue'
import { compRead } from '../helpers/component-roots'

// 双组件根解析（ADR-012）：rel 形如 'wd-cell/index.css'
const css = (rel: string) => compRead(...rel.split('/'))

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

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
  'wd-count-down/index.css',
  'wd-count-to/index.css',
  'wd-skeleton/index.css',
  'wd-loadmore/index.css',
  'wd-notice-bar/index.css',
  'wd-watermark/index.css'
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

/** 取规则的「基础元素选择器」：去掉 is-* / --* 修饰类与 :active 伪类 */
function baseSelector(selector: string): string {
  return selector
    .replace(/\.[\w-]*--[\w-]+/g, '')
    .replace(/\.is-[\w-]+/g, '')
    .replace(/:active/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('原生优先重写 · 展示家族布局居中契约（count-down / count-to / skeleton / loadmore / notice-bar / watermark）', () => {
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
    // 横向行：单行文本 / 前后缀文本组合 / 图标+文案 / 前缀+内容+后缀
    expectRootFlex(css('wd-count-down/index.css'), '.wd-count-down', 'row')
    expectRootFlex(css('wd-count-to/index.css'), '.wd-count-to', 'row')
    expectRootFlex(css('wd-loadmore/index.css'), '.wd-loadmore', 'row')
    expectRootFlex(css('wd-notice-bar/index.css'), '.wd-notice-bar', 'row')
    // 纵向堆叠：多行骨架 / 插槽内容 + 水印图层
    expectRootFlex(css('wd-skeleton/index.css'), '.wd-skeleton', 'column')
    expectRootFlex(css('wd-watermark/index.css'), '.wd-watermark', 'column')
  })

  it('wd-count-to：移除 Web 专有 vertical-align，align-items: flex-end 等价承担底边对齐', () => {
    const c = css('wd-count-to/index.css')
    // 参考源 .wd-count-to { vertical-align: bottom } —— Lynx 不识别（写了即
    // 静默丢失），其「小字号分隔文本与大字号主体底边对齐」语义由 flex-end 承担
    expect(c).not.toMatch(/vertical-align/)
    expect(ruleOf(c, '.wd-count-to')).toMatch(/(^|;)align-items:flex-end(;|$)/)
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

  it('居中成对：loadmore 根 / skeleton 行列 / watermark 单元 / notice-bar 根', () => {
    // wd-loadmore：根成对居中 + 文本节点 text-align: center 双保险
    const loadmore = css('wd-loadmore/index.css')
    expectCenterPair(loadmore, '.wd-loadmore')
    for (const sel of ['.wd-loadmore__text,.wd-loadmore__refresh-text', '.wd-loadmore__refresh-text']) {
      expect(ruleOf(loadmore, sel), `${sel} 需要 text-align: center`).toMatch(/(^|;)text-align:center(;|$)/)
    }

    // wd-skeleton：行两端对齐 + 交叉轴居中；占位块成对居中（承载渐变扫描层）
    const skeleton = css('wd-skeleton/index.css')
    const row = ruleOf(skeleton, '.wd-skeleton__row')
    expect(row).toMatch(/(^|;)justify-content:space-between(;|$)/)
    expect(row).toMatch(/(^|;)align-items:center(;|$)/)
    expectCenterPair(skeleton, '.wd-skeleton__col')

    // wd-watermark：平铺单元成对居中 + 文本节点 text-align: center
    // （对齐参考源 canvas textAlign='center' 的居中绘制语义）
    const watermark = css('wd-watermark/index.css')
    expectCenterPair(watermark, '.wd-watermark__unit')
    expect(ruleOf(watermark, '.wd-watermark__text')).toMatch(/(^|;)text-align:center(;|$)/)

    // wd-notice-bar：前缀图标 / 内容区 / 后缀图标横向行交叉轴居中
    const noticeBar = ruleOf(css('wd-notice-bar/index.css'), '.wd-notice-bar')
    expect(noticeBar).toMatch(/(^|;)align-items:center(;|$)/)

    // wd-count-down：横向行交叉轴居中（自定义「时/分/秒」多块场景垂直对齐）
    expect(ruleOf(css('wd-count-down/index.css'), '.wd-count-down')).toMatch(/(^|;)align-items:center(;|$)/)
  })

  it('wd-watermark：水印图层四边 0 绝对定位铺满，全屏语义落 fixed 在图层自身', () => {
    const c = css('wd-watermark/index.css')
    const layer = ruleOf(c, '.wd-watermark__layer')
    expect(layer).toMatch(/(^|;)position:absolute(;|$)/)
    for (const prop of ['left', 'right', 'top', 'bottom']) {
      expect(layer, `图层应四边铺满: ${prop}: 0`).toMatch(new RegExp(`(^|;)${prop}:0(;|$)`))
    }
    // CONVENTIONS §9：fixed 节点必须是显隐/动画节点本身——全屏定位落在图层
    expect(ruleOf(c, '.wd-watermark.is-fullscreen .wd-watermark__layer')).toMatch(/(^|;)position:fixed(;|$)/)
  })
})

describe('原生优先重写 · 展示家族 DOM 对齐与交互（count-down / count-to / skeleton / loadmore / notice-bar / watermark）', () => {
  afterEach(() => cleanup())

  it('wd-count-down：默认渲染文本 + format 占位符；插槽优先；change / finish 链路', async () => {
    const { container } = render(CountDown as any, { time: 3661000, format: 'HH:mm:ss' })
    expect(container.querySelector('.wd-count-down__text')!.textContent).toBe('01:01:01')
    cleanup()

    // 默认插槽优先于内置文本（wot-ui 语义）
    const slot = render(
      {
        setup() {
          return () =>
            h(CountDown as any, { time: 60000 }, { default: ({ current }: any) => h('text', { class: 'custom' }, `剩余 ${current.seconds}s`) })
        }
      } as any
    )
    expect(slot.container.querySelector('.wd-count-down__text')).toBeNull()
    expect(slot.container.querySelector('.custom')!.textContent).toContain('剩余')
    cleanup()

    // rAF 驱动（测试环境为 setTimeout 实现）：倒计时结束触发 finish
    const finishes: number[] = []
    const changes: any[] = []
    render({
      setup() {
        return () =>
          h(CountDown as any, {
            time: 50,
            onChange: (c: any) => changes.push(c.total),
            onFinish: () => finishes.push(1)
          })
      }
    } as any)
    await pause(400)
    expect(finishes.length, '倒计时结束应触发 finish').toBeGreaterThanOrEqual(1)
    expect(changes.length, '倒计时进行中应触发 change').toBeGreaterThanOrEqual(1)
  })

  it('wd-count-to：前缀 / 主体 / 后缀三槽位结构；mounted / finish 链路', async () => {
    const mounted: number[] = []
    const finishes: number[] = []
    const { container } = render({
      setup() {
        return () =>
          h(CountTo as any, {
            startVal: 0,
            endVal: 100,
            duration: 100,
            prefix: '¥',
            suffix: '元',
            onMounted: () => mounted.push(1),
            onFinish: () => finishes.push(1)
          })
      }
    } as any)
    // wot-ui 结构：wd-text 子组件 + separator-text / main-text 类名
    expect(container.querySelectorAll('.wd-count-to__separator-text').length).toBe(2)
    expect(container.querySelector('.wd-count-to__main-text')).not.toBeNull()
    await pause(50)
    expect(mounted.length).toBe(1)
    await pause(500)
    expect(finishes.length, '动画结束应触发 finish').toBeGreaterThanOrEqual(1)
    // 落定值：endVal 经 formatNumber 输出（千分位 + decimals=0）
    expect(container.querySelector('.wd-count-to__main-text')!.textContent).toBe('100')
  })

  it('wd-skeleton：默认行列 / rowCol 自定义 / loading 结束渲染插槽 / 渐变扫描层为真实元素', () => {
    // 默认 theme=text → themeMap.text = [1, [col, col]]，2 行 3 列（wot-ui 对齐）
    const { container } = render(Skeleton as any, {})
    expect(container.querySelectorAll('.wd-skeleton__row').length).toBe(2)
    expect(container.querySelectorAll('.wd-skeleton__col').length).toBe(3)
    // 末行索引类名（替代参考源 :last-child 伪类）
    expect(container.querySelectorAll('.wd-skeleton__row.is-last').length).toBe(1)
    cleanup()

    // rowCol：数字项 = 1 列，对象项 = 1 列
    const custom = render(Skeleton as any, { rowCol: [2, { width: '50%' }] as any })
    expect(custom.container.querySelectorAll('.wd-skeleton__row').length).toBe(2)
    expect(custom.container.querySelectorAll('.wd-skeleton__col').length).toBe(2)
    cleanup()

    // loading=false → 渲染默认插槽（骨架隐藏）
    const loaded = render(Skeleton as any, { loading: false }, [])
    expect(loaded.container.querySelector('.wd-skeleton__content')).toBeNull()
    cleanup()

    // gradient 动画：参考源 ::after 伪元素 → 模板真实元素 wd-skeleton__gradient
    const gradient = render(Skeleton as any, { animation: 'gradient' })
    expect(gradient.container.querySelectorAll('.wd-skeleton__gradient').length).toBe(3)
    expect(gradient.container.querySelectorAll('.wd-skeleton__col.wd-skeleton--animation-gradient').length).toBe(3)
  })

  it('wd-loadmore：三态渲染；error 态 tap 触发 reload', () => {
    const loading = render(Loadmore as any, { state: 'loading' })
    expect(loading.container.querySelector('.wd-loadmore__loading')).not.toBeNull()
    expect(loading.container.querySelector('.wd-loadmore__text')!.textContent).toContain('加载')
    cleanup()

    const finished = render(Loadmore as any, { state: 'finished' })
    expect(finished.container.querySelector('.wd-loadmore__divider')).not.toBeNull()
    cleanup()

    const reloads: number[] = []
    const { container } = render({
      setup() {
        return () => h(Loadmore as any, { state: 'error', onReload: () => reloads.push(1) })
      }
    } as any)
    expect(container.querySelector('.wd-loadmore__text')!.textContent).toContain('失败')
    expect(container.querySelector('.wd-loadmore__refresh-text')!.textContent).toContain('重试')
    fireEvent.tap(container.querySelector('.wd-loadmore')!)
    expect(reloads.length, 'error 态点击应触发 reload').toBe(1)
  })

  it('wd-notice-bar：结构对齐；关闭与内容点击事件；纵向模式堆叠多条文本', async () => {
    // 横向默认：前缀图标 + wrap > content > text
    const { container } = render(NoticeBar as any, { text: '通知', prefix: 'notification' })
    expect(container.querySelector('.wd-notice-bar__prefix')).not.toBeNull()
    expect(container.querySelector('.wd-notice-bar__wrap > .wd-notice-bar__content > text')!.textContent).toBe('通知')
    cleanup()

    // 关闭图标：tap → close 事件 + 根节点不再渲染（wot-ui 语义）
    const closes: number[] = []
    const closable = render({
      setup() {
        return () => h(NoticeBar as any, { text: '通知', closable: true, onClose: () => closes.push(1) })
      }
    } as any)
    const suffix = closable.container.querySelector('.wd-notice-bar__suffix')!
    expect(suffix).not.toBeNull()
    fireEvent.tap(suffix)
    expect(closes.length).toBe(1)
    // v-if 卸载经下一 tick 落地（双线程管线的渲染调度）
    await pause(50)
    expect(closable.container.querySelector('.wd-notice-bar')).toBeNull()
    cleanup()

    // 内容区点击：{ index, text }（数组文案取当前索引）
    const clicks: any[] = []
    const clickable = render({
      setup() {
        return () => h(NoticeBar as any, { text: ['第一条', '第二条'], onNext: () => {}, onClick: (r: any) => clicks.push(r) })
      }
    } as any)
    fireEvent.tap(clickable.container.querySelector('.wd-notice-bar__content')!)
    expect(clicks[0]).toEqual({ index: 0, text: '第一条' })
    cleanup()

    // 纵向模式：textArray 全部渲染 + 重复首项（滚动回路），行内文本包 text 元素
    const vertical = render(NoticeBar as any, { text: ['甲', '乙'], direction: 'vertical' })
    const items = vertical.container.querySelectorAll('.wd-notice-bar__content > view')
    expect(items.length, '纵向模式应渲染 N+1 个文本项（含重复首项）').toBe(3)
    expect(vertical.container.querySelector('.wd-notice-bar--ellipse')).not.toBeNull()
    for (const item of items) {
      expect(item.querySelector('text')).not.toBeNull()
    }
  })

  it('wd-notice-bar：color / background-color 内联下发且与 customStyle 合并（Style Funnel §20）', () => {
    const { container } = render(NoticeBar as any, {
      text: '通知',
      color: '#f00',
      backgroundColor: '#fff',
      customStyle: 'margin-top: 4px'
    })
    const style = styleOf(container.querySelector('.wd-notice-bar'))
    expect(style).toMatch(/color:\s*rgb\(255, 0, 0\)/)
    expect(style).toMatch(/background:\s*rgb\(255, 255, 255\)/)
    expect(style, 'customStyle 经 parseStyle 归一后合并').toMatch(/margin-top:\s*4px/)
    cleanup()

    // 不传时键集回落中性值（由 is-{type} 状态类兜底配色），不写脏值
    const plain = render(NoticeBar as any, { text: '通知' })
    const plainStyle = styleOf(plain.container.querySelector('.wd-notice-bar'))
    expect(plainStyle).not.toMatch(/color:\s*rgb/)
    expect(plainStyle).not.toMatch(/background:\s*rgb/)
  })

  it('wd-watermark：文本 / 图片平铺单元 + 全屏类名 + 原生 image 元素', async () => {
    const { container } = render(Watermark as any, { content: '水印' })
    // fullScreen 默认 true → is-fullscreen（wot-ui 语义）
    expect(container.querySelector('.wd-watermark')!.classList.contains('is-fullscreen')).toBe(true)
    await pause(50)
    const units = container.querySelectorAll('.wd-watermark__unit')
    expect(units.length, '应渲染平铺单元（容器回退 375×667）').toBeGreaterThan(0)
    expect(container.querySelector('.wd-watermark__layer')).not.toBeNull()
    expect(container.querySelectorAll('.wd-watermark__text').length).toBe(units.length)
    expect(container.querySelector('.wd-watermark__text')!.textContent).toBe('水印')
    cleanup()

    // 图片模式：原生 image 元素（CONVENTIONS §8：不用背景图/内嵌 SVG）
    const img = render(Watermark as any, { image: 'https://example.com/wm.png' })
    await pause(50)
    expect(img.container.querySelector('image.wd-watermark__image')!.getAttribute('src')).toBe('https://example.com/wm.png')
    expect(img.container.querySelector('.wd-watermark__text')).toBeNull()
    cleanup()

    // 非全屏：无 is-fullscreen 类
    const inline = render(Watermark as any, { content: '水印', fullScreen: false })
    expect(inline.container.querySelector('.wd-watermark')!.classList.contains('is-fullscreen')).toBe(false)
  })

  it('wd-watermark：平铺单元样式键集完整——staggered 错位与 grid 中性值（Style Funnel §20）', async () => {
    // staggered：奇数行右移半个单元宽度（width=100 + gutterX=0 → 单元 100px，半宽 50px）
    const staggered = render(Watermark as any, { content: '水印', layout: 'staggered', width: 100, height: 50 })
    await pause(50)
    const units = staggered.container.querySelectorAll('.wd-watermark__unit')
    expect(units.length).toBeGreaterThan(1)
    // 第 1 个单元（第 0 行，非错位行）：margin-left 中性值 0px 在场
    expect(styleOf(units[0]), '非错位行 margin-left 应为中性值 0px').toMatch(/margin-left:\s*0px/)
    expect(styleOf(units[0])).toMatch(/width:\s*100px/)
    expect(styleOf(units[0])).toMatch(/height:\s*50px/)
    cleanup()

    // grid：所有单元 margin-left 均为中性值 0px（staggered → grid 切换不留残移）
    const grid = render(Watermark as any, { content: '水印', layout: 'grid', width: 100, height: 50 })
    await pause(50)
    for (const unit of grid.container.querySelectorAll('.wd-watermark__unit')) {
      expect(styleOf(unit), 'grid 布局所有单元 margin-left 应为中性值 0px').toMatch(/margin-left:\s*0px/)
    }
  })

  it('wd-skeleton：col 尺寸样式对象语法下发（rowCol 自定义宽高圆角）', () => {
    const { container } = render(Skeleton as any, {
      rowCol: [{ type: 'rect', width: '80px', height: '20px', borderRadius: '4px', backgroundColor: '#eee' }] as any
    })
    const col = container.querySelector('.wd-skeleton__col')!
    const style = styleOf(col)
    expect(style, 'rowCol 的 width 应经 addUnit 归一为对象语法下发').toMatch(/width:\s*80px/)
    expect(style).toMatch(/height:\s*20px/)
    expect(style).toMatch(/border-radius:\s*4px/)
    expect(style).toMatch(/background-color:\s*rgb\(238, 238, 238\)/)
    // size 展开为 width + height（参考源语义）
    cleanup()

    const sized = render(Skeleton as any, { rowCol: [{ type: 'circle', size: 40 }] as any })
    const sizedStyle = styleOf(sized.container.querySelector('.wd-skeleton__col')!)
    expect(sizedStyle).toMatch(/width:\s*40px/)
    expect(sizedStyle).toMatch(/height:\s*40px/)
  })
})

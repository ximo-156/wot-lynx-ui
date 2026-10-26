/**
 * 原生优先重写 · 布局居中契约回归测试（wd-calendar / wd-calendar-view /
 * wd-keyboard / wd-password-input）。
 *
 * 背景（NATIVE-REWRITE §3 / CONVENTIONS §15）：Lynx 3.x 默认 linear 布局，
 * `flex-direction` 等弹性属性只在 `display: flex` 上生效；`inline-flex` /
 * `inline-block` / `float` / `vertical-align` 写了即静默丢失——这是「样式
 * 不居中」的根因。上述四组件无拖动/滑动/缩放跟手手势（密码格展示、按键
 * 点击、弹层选择、scroll-view 原生滚动），不涉及 MTS worklet；本测试锁定
 * 其「根节点三件套 + 居中成对书写 + 无 Web 专有属性」的静态契约：
 *
 * 1. 每个组件根 view（含 calendar-view 的 month / year / month-panel /
 *    year-panel 子面板根）显式 `display: flex` + `flex-direction`；
 * 2. 需要居中的容器 `justify-content` + `align-items` 成对写全，文本节点
 *    另加 `text-align: center`；
 * 3. 编译产物中不出现 Lynx 不识别的 Web 专有写法（inline-flex /
 *    inline-block / float / vertical-align / cursor / user-select /
 *    outline / -webkit-*）；
 * 4. DOM 结构（BEM 类名 / 层级）与 wot-ui 2.3.2 对齐不回退。
 *
 * 历史包袱：早期这些根节点一个 display 都没写，flex-direction 被静默丢弃，
 * 表现为「一行一个、方向错、间距丢」；CSS 断言能在真机截图前拦住同类回归。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { pause } from '../../src/common/util'
import PasswordInput from '../../src/components/wd-password-input/wd-password-input.vue'
import Keyboard from '../../src/components/wd-keyboard/wd-keyboard.vue'
import Calendar from '../../src/components/wd-calendar/wd-calendar.vue'
import CalendarView from '../../src/components/wd-calendar-view/wd-calendar-view.vue'
import { compRead } from '../helpers/component-roots'

// 双组件根解析（ADR-012）：rel 形如 'wd-cell/index.css'
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
  'wd-password-input/index.css',
  'wd-keyboard/index.css',
  'wd-keyboard/key/index.css',
  'wd-calendar/index.css',
  'wd-calendar-view/index.css',
  'wd-calendar-view/month/index.css',
  'wd-calendar-view/year/index.css',
  'wd-calendar-view/monthPanel/index.css',
  'wd-calendar-view/yearPanel/index.css'
]

describe('原生优先重写 · 布局居中契约（calendar / calendar-view / keyboard / password-input）', () => {
  afterEach(() => cleanup())

  it('编译产物不含 Lynx 静默丢失的 Web 专有写法', () => {
    for (const rel of BATCH_CSS) {
      const text = css(rel)
      for (const re of SILENTLY_DROPPED) {
        expect(re.test(text), `${rel} 含 Lynx 不识别写法: ${re}`).toBe(false)
      }
    }
  })

  it('wd-password-input：根节点纵向三件套 + 格子/提示行成对居中', () => {
    const c = css('wd-password-input/index.css')
    expectRootFlex(c, '.wd-password-input', 'column')
    // 格子行：flex row + 交叉轴居中
    expectRootFlex(c, '.wd-password-input__security', 'row')
    // 输入格：成对居中 + 文本居中
    expectCenterPair(c, '.wd-password-input__item')
    expect(ruleOf(c, '.wd-password-input__item')).toMatch(/(^|;)text-align:center(;|$)/)
    // 提示信息行：成对居中 + 文本居中
    expectCenterPair(c, '.wd-password-input__info')
    expect(ruleOf(c, '.wd-password-input__info')).toMatch(/(^|;)text-align:center(;|$)/)
  })

  it('wd-keyboard：根节点纵向三件套 + 头部成对居中', () => {
    const c = css('wd-keyboard/index.css')
    expectRootFlex(c, '.wd-keyboard', 'column')
    expectCenterPair(c, '.wd-keyboard__header')
    // 键区 / 侧栏 / 按键的横向流向
    expectRootFlex(c, '.wd-keyboard__body', 'row')
    expectRootFlex(c, '.wd-keyboard__keys', 'row')
    expectRootFlex(c, '.wd-keyboard__sidebar', 'column')
    const key = css('wd-keyboard/key/index.css')
    expectCenterPair(key, '.wd-key')
  })

  it('wd-calendar：根/头部/视图纵向三件套 + 区间行成对居中', () => {
    const c = css('wd-calendar/index.css')
    expectRootFlex(c, '.wd-calendar', 'column')
    expectRootFlex(c, '.wd-calendar__header', 'column')
    expectRootFlex(c, '.wd-calendar__view', 'column')
    expectCenterPair(c, '.wd-calendar__range')
    // 区间起止标签：text-align 之外补成对 flex 居中
    expectCenterPair(c, '.wd-calendar__range-item')
    // 快捷选项行：wrap + 居中
    expectRootFlex(c, '.wd-calendar__shortcuts', 'row')
    expect(ruleOf(c, '.wd-calendar__shortcuts')).toMatch(/(^|;)justify-content:center(;|$)/)
  })

  it('wd-calendar-view：各面板根节点三件套 + 日期/月份/周表头成对居中', () => {
    expectRootFlex(css('wd-calendar-view/index.css'), '.wd-calendar-view', 'column')
    expectRootFlex(css('wd-calendar-view/month/index.css'), '.wd-month', 'column')
    expectRootFlex(css('wd-calendar-view/year/index.css'), '.wd-year', 'column')
    expectRootFlex(css('wd-calendar-view/monthPanel/index.css'), '.wd-month-panel', 'column')
    expectRootFlex(css('wd-calendar-view/yearPanel/index.css'), '.wd-year-panel', 'column')
    // 日期格：显式行结构（每周一个 row）+ 内容起点对齐 + 文本容器成对居中
    // 真机 2026-10-26 巡检：`flex-wrap: wrap` 平铺在 Lynx 上多行容器高度只
    // 按前两行结算，下个月标题会插进本月网格中间（图五缺陷），故改为
    // column 容器 + 每周一个 row，容器高度由行数逐行累加。
    const month = css('wd-calendar-view/month/index.css')
    expectRootFlex(month, '.wd-month__days', 'column')
    expectRootFlex(month, '.wd-month__row', 'row')
    expect(ruleOf(month, '.wd-month__days')).not.toMatch(/(^|;)flex-wrap:wrap(;|$)/)
    expect(ruleOf(month, '.wd-month__day')).toMatch(/(^|;)flex:1(;|$)/)
    expectCenterPair(month, '.wd-month__day-container')
    expect(ruleOf(month, '.wd-month__day-text')).toMatch(/(^|;)text-align:center(;|$)/)
    // 月份格：wrap 网格 + 内容盒成对居中
    const year = css('wd-calendar-view/year/index.css')
    expectRootFlex(year, '.wd-year__months', 'row')
    expect(ruleOf(year, '.wd-year__months')).toMatch(/(^|;)flex-wrap:wrap(;|$)/)
    expectCenterPair(year, '.wd-year__month')
    expectCenterPair(year, '.wd-year__month-container')
    // 周表头单元格成对居中
    expectCenterPair(css('wd-calendar-view/monthPanel/index.css'), '.wd-month-panel__week')
    // 控制栏两端对齐 + 交叉轴居中
    const panel = css('wd-calendar-view/monthPanel/index.css')
    expectRootFlex(panel, '.wd-month-panel__controls', 'row')
    expect(ruleOf(panel, '.wd-month-panel__controls')).toMatch(/(^|;)justify-content:space-between(;|$)/)
    expect(ruleOf(panel, '.wd-month-panel__controls')).toMatch(/(^|;)align-items:center(;|$)/)
  })

  it('DOM 对齐：密码格 / 日历格 / 按键的结构与 wot-ui 一致', async () => {
    // 密码输入框：length 个格子 + 掩码圆点 + 光标分支
    const { container } = render(PasswordInput as any, { modelValue: '12', length: 6, mask: true, focused: true })
    await pause(50)
    const items = container.querySelectorAll('.wd-password-input__item')
    expect(items.length).toBe(6)
    // value.length = 2 → 第 3 格（index 2）渲染光标，其余渲染 __value + __mask
    expect(container.querySelectorAll('.wd-password-input__cursor').length).toBe(1)
    expect(container.querySelectorAll('.wd-password-input__value').length).toBe(5)
    expect(container.querySelectorAll('.wd-password-input__mask').length).toBe(5)
    cleanup()

    // 日历视图：默认月面板，日期格为 __day > __day-container > (__day-top /
    // __day-text / __day-bottom) 结构（对齐 wot-ui）。显式行结构下月初有
    // 空位格（无内容容器），取第一个有日期的格子断言内部结构。
    const view = render(CalendarView as any, { modelValue: Date.now(), type: 'date' })
    await pause(100)
    const days = view.container.querySelectorAll('.wd-month__day')
    expect(days.length).toBeGreaterThanOrEqual(28)
    const firstDay = view.container.querySelector('.wd-month__day-container')!.parentElement!
    expect(firstDay.classList.contains('wd-month__day')).toBe(true)
    expect(firstDay.querySelector('.wd-month__day-container')).not.toBeNull()
    expect(firstDay.querySelector('.wd-month__day-text')).not.toBeNull()
    expect(firstDay.querySelector('.wd-month__day-top')).not.toBeNull()
    expect(firstDay.querySelector('.wd-month__day-bottom')).not.toBeNull()
    cleanup()

    // 键盘：default 模式 12 键（9 数字 + extra + 0 + delete）
    const kb = render(Keyboard as any, { visible: true, modelValue: '' })
    await pause(200)
    expect(kb.container.querySelectorAll('.wd-keyboard__keys .wd-key-wrapper').length).toBe(12)
    cleanup()
  })

  it('DOM 对齐：日历弹层承载 calendar-view + 确认按钮（结构不回退）', async () => {
    // wot-ui 的 inited 由 pickerShow（visible 的同步镜像）的 watch 置位，
    // 挂载时即 visible=true 不会触发该 watch——与参考源行为一致，故经
    // 「关闭 → 打开」的真实使用流程驱动（同 bugfix-regression-pickers #8）。
    const visible = ref(false)
    const { container } = render(
      {
        setup() {
          return () =>
            h(Calendar as any, {
              visible: visible.value,
              modelValue: Date.now(),
              type: 'date',
              showConfirm: true,
              'onUpdate:visible': (v: boolean) => {
                visible.value = v
              }
            })
        }
      } as any
    )
    await pause(50)
    visible.value = true
    await pause(300)
    // 弹层结构：wd-root-portal > wd-popup-wrapper > [overlay + transition]（CONVENTIONS §9）
    const popup = container.querySelector('.wd-calendar__popup')
    expect(popup, '日历弹层应渲染').not.toBeNull()
    expect(container.querySelector('.wd-calendar__view'), '日历视图容器应渲染').not.toBeNull()
    expect(container.querySelector('.wd-calendar__view .wd-calendar-view'), '内部 calendar-view 应渲染').not.toBeNull()
    // 确认栏为 .wd-calendar__confirm > .wd-calendar__confirm-btn-wrapper > wd-button
    const btn = container.querySelector('.wd-calendar__confirm .wd-button')
    expect(btn, '确认按钮应渲染').not.toBeNull()
    cleanup()
  })
})

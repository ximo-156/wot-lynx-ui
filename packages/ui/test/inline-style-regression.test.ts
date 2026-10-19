/**
 * 内联样式回归测试 — CONVENTIONS §19 字符串 :style 被 vue-lynx 静默丢弃。
 *
 * 背景：vue-lynx 的 patchProp（runtime/dist/node-ops.js）对 style 只处理
 * 对象/数组：`'object' == typeof nextValue ? normalizeStyle(nextValue) : {}`。
 * 字符串值（`:style="`height: 44px`"` / custom-style="color: red"）被替换
 * 为 {}，不报错但样式全部消失。picker-view 的列高、translateY 位移、
 * 指示带/遮罩尺寸曾因此整体失效（列不滚动、选中项不居中、指示带消失）。
 *
 * 本测试经「双线程管线 + JSDOM」挂载，直接断言元素 style 属性非空。
 */
import { describe, it, expect } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import PickerView from '../src/components/wd-picker-view/wd-picker-view.vue'
import DatetimePickerView from '../src/components/wd-datetime-picker-view/wd-datetime-picker-view.vue'
import CalendarView from '../src/components/wd-calendar-view/wd-calendar-view.vue'
import Button from '../src/components/wd-button/wd-button.vue'
import Progress from '../src/components/wd-progress/wd-progress.vue'
import ConfigProvider from '../src/components/wd-config-provider/wd-config-provider.vue'
import Switch from '../src/components/wd-switch/wd-switch.vue'
import { mapThemeVarsToCSSVars } from '../src/composables/useConfigProvider'

function styleOf(el: Element | null): string {
  return el ? el.getAttribute('style') || '' : ''
}

describe('内联样式：字符串 :style 不得被静默丢弃（CONVENTIONS §19）', () => {
  it('WdPickerView 列项高度 / 指示带 / 遮罩为对象样式且已应用', () => {
    const { container } = render(PickerView, {
      modelValue: ['b'],
      columns: [['a', 'b', 'c']],
      itemHeight: 44,
      visibleItemCount: 6
    })
    const item = container.querySelector('.wd-picker-view__column-item')
    expect(styleOf(item)).toContain('height')
    expect(styleOf(item)).toMatch(/44px/)

    // wot-ui 2.3.2：选中指示带经 indicator-class 下发，类名为 __roller
    const indicator = container.querySelector('.wd-picker-view__roller')
    expect(styleOf(indicator)).toMatch(/height/)
    expect(styleOf(indicator)).toMatch(/44px/)
    expect(styleOf(indicator)).toMatch(/top/)

    const mask = container.querySelector('.wd-picker-view__mask--top')
    expect(styleOf(mask)).toMatch(/height/)

    const main = container.querySelector('.wd-picker-view__main')
    // 6 * 44 = 264
    expect(styleOf(main)).toMatch(/264px/)
    cleanup()
  })

  it('WdPickerView 列内容按选中索引 translateY（位移不得丢失）', () => {
    const { container } = render(PickerView, {
      modelValue: ['b'],
      columns: [['a', 'b', 'c']],
      itemHeight: 44,
      visibleItemCount: 6
    })
    const content = container.querySelector('.wd-picker-view__column-content')
    // 选中 b（索引 1）→ translateY(-44px)
    expect(styleOf(content)).toMatch(/translateY\(-44px\)/)
    cleanup()
  })

  it('WdPickerView customStyle 字符串被解析应用', () => {
    const { container } = render(PickerView, {
      modelValue: ['a'],
      columns: [['a', 'b']],
      customStyle: 'background-color: rgb(1, 2, 3)'
    })
    const root = container.querySelector('.wd-picker-view')
    expect(styleOf(root)).toContain('background-color')
    cleanup()
  })

  it('WdDatetimePickerView 五列高度与位移均生效', () => {
    const value = new Date(2026, 9, 15, 15, 26).getTime()
    const { container } = render(DatetimePickerView, {
      modelValue: value,
      type: 'datetime',
      itemHeight: 44,
      visibleItemCount: 6
    })
    const contents = container.querySelectorAll('.wd-picker-view__column-content')
    expect(contents.length).toBe(5)
    contents.forEach((c) => {
      expect(styleOf(c)).toMatch(/translateY\(/)
    })
    cleanup()
  })

  it('WdButton customStyle 字符串被解析应用', () => {
    const { container } = render(Button, { text: '按钮', customStyle: 'color: rgb(9, 9, 9)' })
    const root = container.querySelector('.wd-button')
    expect(styleOf(root)).toContain('color')
    cleanup()
  })

  it('WdProgress 内外层宽度样式为对象且已应用', async () => {
    const { container } = render(Progress, { percentage: 60 })
    await pause(50)
    const inner = container.querySelector('.wd-progress__inner')
    expect(styleOf(inner)).toMatch(/width/)
    cleanup()
  })

  it('WdCalendarView 月网格首格按周偏移（对齐 wot-ui：margin-left 百分比）', () => {
    // wot-ui 2.3.2 结构：月面板 > .wd-month > .wd-month__days > .wd-month__day；
    // 每月只渲染当月日期（无前/后月补位格），首格经 firstDayStyle 的
    // margin-left 百分比偏移到正确星期列。2026-10-01 是周四，
    // firstDayOfWeek=0（周日）→ offset=4 → margin-left = 4/7*100%
    const value = new Date(2026, 9, 15).getTime()
    const { container } = render(CalendarView, { modelValue: value, type: 'date' })
    const panel = Array.from(container.querySelectorAll('.wd-month')).find(
      (m) => m.querySelector('.wd-month__title')?.textContent === '2026年10月'
    )!
    expect(panel, '应渲染 2026年10月 面板').toBeTruthy()
    const days = [...panel.querySelectorAll('.wd-month__day')]
    expect(days.length, '10 月共 31 天（无补位格）').toBe(31)
    expect((days[0].querySelector('.wd-month__day-text')?.textContent || '').trim()).toBe('1')
    // 首格（10 月 1 日，周四）左偏 4 列（100/7*4 = 57.142857...%）
    expect(styleOf(days[0])).toMatch(/margin-left:\s*57\.14/)
    // 其余格无内联偏移
    expect(styleOf(days[1])).not.toMatch(/margin-left/)
    cleanup()
  })

  it('WdCalendarView 月网格按周分行（对齐 wot-ui：flex-wrap 周行结构）', () => {
    const { container } = render(CalendarView, { modelValue: Date.now(), type: 'date' })
    // wot-ui 2.3.2：日期格直接在 .wd-month__days 容器内按 flex-wrap 排布，
    // 无显式 row 包装（旧本地「显式行」结构已按参考源移除）
    const grid = container.querySelector('.wd-month__days')!
    expect(grid).not.toBeNull()
    const directDays = grid.querySelectorAll(':scope > .wd-month__day')
    expect(directDays.length, '首个面板的日期格直接挂在 days 容器下').toBeGreaterThan(28)
    cleanup()
  })

  it('WdConfigProvider themeVars 映射为 --wot-* 对象（定制主题曾整体失效）', () => {
    // mapThemeVarsToCSSVars 输出对象（字符串形式会被 patchProp 丢弃）；
    // 真机经 enableCSSInlineVariables 支持内联 CSS 变量，测试环境的
    // JSDOM 不支持 setProperty 自定义属性，故在单元层断言映射结果。
    const vars = mapThemeVarsToCSSVars({ colorPrimary: '#ff0000', fontSizeSmall: '12px' })
    expect(vars).toEqual({
      '--wot-color-primary': '#ff0000',
      '--wot-font-size-small': '12px'
    })
  })

  it('WdConfigProvider customStyle 合并进根节点对象样式', () => {
    const { container } = render(ConfigProvider, {
      theme: 'light',
      customStyle: 'background-color: rgb(1, 2, 3)'
    })
    const root = container.querySelector('.wot-theme-light')
    expect(styleOf(root)).toContain('background-color')
    expect(styleOf(root)).toContain('rgb(1, 2, 3)')
    cleanup()
  })

  it('WdSwitch 轨道 / 滑块尺寸由 SCSS 类承担（对齐 wot-ui：em 基准改 --wot-switch-size）', () => {
    const { container } = render(Switch, { modelValue: true, activeColor: '#34C759' })
    const root = container.querySelector('.wd-switch')
    // wot-ui 2.3.2：尺寸体系在 SCSS（--wot-switch-size 基准的 calc 链），
    // JS 侧只经内联 font-size（+ 同名 CSS 变量）下发 size prop；
    // 对象语法断言：内联样式必须是对象而非被丢弃的字符串
    expect(styleOf(root)).toMatch(/font-size/)
    expect(styleOf(root)).toContain('--wot-switch-size')
    const action = container.querySelector('.wd-switch__action')
    expect(action).not.toBeNull()
    cleanup()
  })
})

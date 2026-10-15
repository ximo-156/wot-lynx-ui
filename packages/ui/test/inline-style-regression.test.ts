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

    const indicator = container.querySelector('.wd-picker-view__indicator')
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

  it('WdCalendarView 网格首行从「本月 1 号上周日」开始（含前月补位）', () => {
    // 2026-10-01 是周四；firstDayOfWeek=0（周日）时首行应为 27..3（9 月 27 日起）
    const value = new Date(2026, 9, 15).getTime()
    const { container } = render(CalendarView, { modelValue: value, type: 'date' })
    const days = [...container.querySelectorAll('.wd-calendar-view__day')]
    expect(days.length).toBe(42)
    const texts = days.slice(0, 7).map((d) => (d.textContent || '').trim())
    expect(texts).toEqual(['27', '28', '29', '30', '1', '2', '3'])
    // 10 月 1 号在第 5 格（周四）且是本月日；9 月 27 日是补位日
    const oct1 = days[4]
    expect((oct1.textContent || '').trim()).toBe('1')
    expect(oct1.getAttribute('class') || '').not.toContain('is-adjacent')
    expect(days[0].getAttribute('class') || '').toContain('is-adjacent')
    // 10 月 31 日之后是 11 月补位
    expect(days[34].getAttribute('class') || '').not.toContain('is-adjacent')
    expect((days[34].textContent || '').trim()).toBe('31')
    expect(days[35].getAttribute('class') || '').toContain('is-adjacent')
    cleanup()
  })

  it('WdCalendarView 行为显式行结构（grid > row > day），不依赖 flex-wrap', () => {
    const { container } = render(CalendarView, { modelValue: Date.now(), type: 'date' })
    const rows = container.querySelectorAll('.wd-calendar-view__row')
    expect(rows.length).toBe(6)
    rows.forEach((row) => {
      expect(row.querySelectorAll('.wd-calendar-view__day').length).toBe(7)
    })
    const grid = container.querySelector('.wd-calendar-view__grid')
    expect(grid).not.toBeNull()
    // 网格下不再直接挂 day（全部包在 row 内）
    expect(grid!.querySelectorAll(':scope > .wd-calendar-view__day').length).toBe(0)
    cleanup()
  })

  it('WdConfigProvider themeVars 映射为 --wd-* 对象（定制主题曾整体失效）', () => {
    // mapThemeVarsToCSSVars 输出对象（字符串形式会被 patchProp 丢弃）；
    // 真机经 enableCSSInlineVariables 支持内联 CSS 变量，测试环境的
    // JSDOM 不支持 setProperty 自定义属性，故在单元层断言映射结果。
    const vars = mapThemeVarsToCSSVars({ colorPrimary: '#ff0000', fontSizeSmall: '12px' })
    expect(vars).toEqual({
      '--wd-color-primary': '#ff0000',
      '--wd-font-size-small': '12px'
    })
  })

  it('WdConfigProvider customStyle 合并进根节点对象样式', () => {
    const { container } = render(ConfigProvider, {
      theme: 'light',
      customStyle: 'background-color: rgb(1, 2, 3)'
    })
    const root = container.querySelector('.wd-theme-light')
    expect(styleOf(root)).toContain('background-color')
    expect(styleOf(root)).toContain('rgb(1, 2, 3)')
    cleanup()
  })

  it('WdSwitch 轨道 / 滑块样式为对象且已应用', () => {
    const { container } = render(Switch, { modelValue: true, activeColor: '#34C759' })
    const root = container.querySelector('.wd-switch')
    expect(styleOf(root)).toMatch(/height|width/)
    const action = container.querySelector('.wd-switch__action')
    expect(styleOf(action)).toMatch(/width/)
    expect(styleOf(action)).toMatch(/transform/)
    const inner = container.querySelector('.wd-switch__inner')
    if (inner) expect(styleOf(inner)).toMatch(/background/)
    cleanup()
  })
})

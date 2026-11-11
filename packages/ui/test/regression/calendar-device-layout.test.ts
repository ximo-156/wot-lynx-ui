/**
 * 双线程挂载 + SCSS 内存编译后的原生布局契约（不生成 index.css）。
 * 不使用 JSDOM 几何/文字继承冒充真机布局；点击走 Lynx tap 与受控回写。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolve } from 'node:path'
import postcss from 'postcss'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '@wot-lynx/core/common/util'
import CalendarView from '@wot-lynx/ui-picker/wd-calendar-view'
import Calendar from '@wot-lynx/ui-picker/wd-calendar'
import type { CalendarDayItem, CalendarType } from '@wot-lynx/ui-picker/wd-calendar/types'
import { compileScss } from '../helpers/scss'
import { compPath } from '../helpers/component-roots'

const stamp = (month: number, day: number) => new Date(2026, month - 1, day).getTime()
const bounds = { minDate: stamp(6, 1), maxDate: stamp(7, 31) }
const rules: Array<{ selector: string; specificity: number; declarations: Record<string, string> }> = []
for (const panel of ['month', 'year']) {
  postcss.parse(compileScss(compPath('wd-calendar-view', panel, 'index.scss'))).walkRules((rule) => {
    const declarations: Record<string, string> = {}
    rule.walkDecls((decl) => { declarations[decl.prop] = decl.value })
    for (const selector of rule.selectors) {
      rules.push({ selector, specificity: (selector.match(/\.[\w-]+/g) || []).length, declarations })
    }
  })
}

function resolveFallbacks(value: string, overrides: Record<string, string>): string {
  for (let depth = 0; depth < 30; depth++) {
    const next = value.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g, (match, name, fallback) =>
      overrides[name] ?? fallback?.trim() ?? match
    )
    if (next === value) return value
    value = next
  }
  throw new Error('cyclic calendar token fallback')
}

/** 只匹配当前元素的声明，不把 view 的字体参数继承给 text。 */
function ownStyle(element: Element, overrides: Record<string, string> = {}): Record<string, string> {
  const values: Record<string, { value: string; specificity: number }> = {}
  for (const rule of rules) {
    if (!element.matches(rule.selector)) continue
    for (const [property, value] of Object.entries(rule.declarations)) {
      if (!values[property] || rule.specificity >= values[property].specificity) {
        values[property] = { value, specificity: rule.specificity }
      }
    }
  }
  return Object.fromEntries(Object.entries(values).map(([property, entry]) => [property, resolveFallbacks(entry.value, overrides)]))
}

const children = (element: Element, className: string) =>
  Array.from(element.children).filter((child) => child.classList.contains(className))
const label = (cell: Element) => cell.querySelector('.wd-month__day-text')?.textContent?.trim() || ''
const monthAt = (container: Element, index = 0) => container.querySelectorAll('.wd-month')[index]
function dayAt(container: Element, day: number, monthIndex = 0) {
  const cell = Array.from(monthAt(container, monthIndex).querySelectorAll('.wd-month__day')).find((item) => label(item) === String(day))
  if (!cell) throw new Error(`missing day ${day} in month index ${monthIndex}`)
  return cell
}
async function flush() {
  await nextTick()
  await pause(120)
  await nextTick()
}
function controlled(type: CalendarType, extra: Record<string, unknown> = {}) {
  const value = ref<any>(null)
  const updates = vi.fn((next) => { value.value = next })
  const changes = vi.fn()
  const mounted = render({
    setup: () => () => h(CalendarView as any, {
      ...bounds, type, modelValue: value.value, ...extra,
      'onUpdate:modelValue': updates, onChange: changes
    })
  } as any)
  return { ...mounted, value, updates, changes }
}
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 5, 15, 12).getTime())
})
afterEach(async () => {
  cleanup()
  // Transition 的两帧回调经测试宿主的真实 RAF 运行，退出文件前让其收尾。
  await pause(50)
  vi.restoreAllMocks()
})

describe('CalendarView 原生日期盒与行结构', () => {
  it.each([
    { month: 2, days: 28, firstDay: 0, offset: 0, rows: 4 },
    { month: 6, days: 30, firstDay: 0, offset: 1, rows: 5 },
    { month: 7, days: 31, firstDay: 0, offset: 3, rows: 5 },
    { month: 8, days: 31, firstDay: 0, offset: 6, rows: 6 },
    { month: 6, days: 30, firstDay: 1, offset: 0, rows: 5 },
    { month: 7, days: 31, firstDay: 1, offset: 2, rows: 5 }
  ])('$month 月 / firstDay=$firstDay：每行七格且补位不丢日期', ({ month, days, firstDay, offset, rows }) => {
    const { container } = render(CalendarView, {
      modelValue: null, minDate: stamp(month, 1), maxDate: stamp(month, days), firstDayOfWeek: firstDay
    })
    const grid = monthAt(container).querySelector('.wd-month__days')!
    const weekRows = children(grid, 'wd-month__row')
    expect(weekRows).toHaveLength(rows)
    expect(children(grid, 'wd-month__day')).toHaveLength(0)
    const cells = weekRows.flatMap((row) => {
      const cells = children(row, 'wd-month__day')
      expect(cells).toHaveLength(7)
      return cells
    })
    expect(cells.slice(0, offset).every((cell) => cell.classList.contains('wd-month__day--empty'))).toBe(true)
    expect(cells.slice(offset, offset + days).map(label)).toEqual(Array.from({ length: days }, (_, index) => String(index + 1)))
    expect(cells.slice(offset + days).every((cell) => cell.classList.contains('wd-month__day--empty'))).toBe(true)
    for (const cell of cells.filter((cell) => label(cell))) {
      expect(cell.querySelector('.wd-month__day-text')!.tagName.toLowerCase()).toBe('text')
    }
  })

  it('六月/七月内容盒独立定高，行不压缩，字形不借 view 行高撑开', () => {
    const { container } = render(CalendarView, { ...bounds, modelValue: null })
    expect(container.querySelector('.wd-month-panel__title')!.textContent).toBe('2026年6月')
    expect(monthAt(container, 1).querySelector('.wd-month__title')!.textContent).toBe('2026年7月')
    for (const month of container.querySelectorAll('.wd-month')) {
      const grid = month.querySelector('.wd-month__days')!
      expect(ownStyle(grid)).toMatchObject({ display: 'flex', 'flex-direction': 'column' })
      expect(ownStyle(grid)['flex-wrap']).not.toBe('wrap')
      for (const row of children(grid, 'wd-month__row')) {
        expect(ownStyle(row)).toMatchObject({ display: 'flex', 'flex-direction': 'row', 'flex-shrink': '0' })
        for (const cell of children(row, 'wd-month__day')) {
          const box = ownStyle(cell)
          expect(box).toMatchObject({ display: 'flex', 'flex-direction': 'column', flex: '1', height: '60px' })
          expect(box['line-height']).toBeUndefined()
          if (!label(cell)) continue
          expect(ownStyle(cell.querySelector('.wd-month__day-container')!)).toMatchObject({
            display: 'flex', width: '100%', height: '100%', 'align-items': 'center', 'justify-content': 'center'
          })
          const marker = cell.querySelector('.wd-month__day-value')!
          expect(ownStyle(marker)).toMatchObject({
            display: 'flex', width: '40px', height: '40px', 'align-items': 'center', 'justify-content': 'center', 'flex-shrink': '0'
          })
          const text = cell.querySelector('.wd-month__day-text')!
          expect(ownStyle(text)).toMatchObject({ 'font-size': '16px', 'line-height': '16px' })
          expect(ownStyle(text).color).toBeTruthy()
          const custom = { '--wot-calendar-view-day-height': '72px', '--wot-calendar-view-day-size': '44px' }
          expect(ownStyle(cell, custom).height).toBe('72px')
          expect(ownStyle(marker, custom)).toMatchObject({ width: '44px', height: '44px' })
          expect(ownStyle(text, custom)['line-height']).toBe('16px')
        }
      }
    }
  })

  it.each([
    { type: 'date', value: stamp(6, 5), selected: [5] },
    { type: 'datetime', value: stamp(6, 5), selected: [5] },
    { type: 'dates', value: [stamp(6, 5), stamp(6, 6), stamp(6, 7), stamp(6, 10)], selected: [5, 6, 7, 10] },
    { type: 'daterange', value: [stamp(6, 5), null], selected: [5] },
    { type: 'daterange', value: [stamp(6, 5), stamp(6, 12)], selected: [5, 12] },
    { type: 'daterange', value: [stamp(6, 5), stamp(6, 5)], selected: [5] },
    { type: 'datetimerange', value: [stamp(6, 5), stamp(6, 12)], selected: [5, 12] },
    { type: 'week', value: stamp(6, 15), selected: [14, 20] },
    { type: 'weekrange', value: [stamp(6, 15), stamp(6, 22)], selected: [14, 27] }
  ])('$type 选中数字用等宽高圆形，不把点击格一起缩小', ({ type, value, selected }) => {
    const { container } = render(CalendarView, { ...bounds, type, modelValue: value, allowSameDay: true } as any)
    for (const day of selected) {
      const cell = dayAt(container, day)
      const marker = cell.querySelector('.wd-month__day-value')!
      expect(ownStyle(cell)).toMatchObject({ flex: '1', height: '60px' })
      expect(ownStyle(marker)).toMatchObject({ width: '40px', height: '40px', 'border-radius': '9999px' })
      expect(ownStyle(marker).background).toBeTruthy()
      expect(ownStyle(cell.querySelector('.wd-month__day-container')!).background).toBeUndefined()
      expect(ownStyle(marker, { '--wot-calendar-view-border-radius-active': '8px' })['border-radius']).toBe('8px')
    }
    if (type === 'dates') {
      expect(dayAt(container, 6).classList.contains('is-multiple-middle')).toBe(true)
      expect(container.querySelector('.wd-month__day-range')).toBeNull()
    }
  })

  it('普通日期不升层，范围连接带居中且位于圆形内容之后', () => {
    const { container } = render(CalendarView, { ...bounds, type: 'daterange', modelValue: [stamp(6, 5), stamp(6, 12)] })
    expect(ownStyle(dayAt(container, 2).querySelector('.wd-month__day-container')!)['z-index']).toBeUndefined()
    for (const day of [5, 8, 12]) {
      const cell = dayAt(container, day)
      const content = cell.querySelector('.wd-month__day-container')!
      const range = cell.querySelector('.wd-month__day-range')!
      expect(ownStyle(cell)).toMatchObject({ position: 'relative', 'z-index': '0' })
      expect(ownStyle(range)).toMatchObject({ position: 'absolute', top: '50%', height: '40px', transform: 'translateY(-50%)', 'pointer-events': 'none' })
      expect(ownStyle(range, { '--wot-calendar-view-day-size': '44px' }).height).toBe('44px')
      expect(Number(ownStyle(content)['z-index'])).toBeGreaterThan(Number(ownStyle(range)['z-index']))
      expect(Array.from(cell.children).indexOf(content)).toBeLessThan(Array.from(cell.children).indexOf(range))
      expect(ownStyle(range).left).toBe(day === 5 ? '50%' : '0')
      expect(ownStyle(range).right).toBe(day === 12 ? '50%' : '0')
    }
  })

  it('formatter 辅助字形直接拿字体与状态色，不继承 view 的行高', async () => {
    const formatter = (item: CalendarDayItem) => ({ ...item, topInfo: '上', bottomInfo: '下', customClass: 'calendar-formatted' })
    const mounted = controlled('date', { minDate: stamp(6, 3), maxDate: stamp(6, 30), formatter })
    const normalColor = ownStyle(dayAt(mounted.container, 5).querySelector('.wd-month__day-text')!).color
    fireEvent.tap(dayAt(mounted.container, 5))
    await flush()
    const selectedColor = ownStyle(dayAt(mounted.container, 5).querySelector('.wd-month__day-text')!).color
    expect(selectedColor).not.toBe(normalColor)
    const marker = dayAt(mounted.container, 5).querySelector('.wd-month__day-value')!
    expect(ownStyle(marker)).toMatchObject({ width: '28px', height: '28px', 'border-radius': '9999px' })
    expect(ownStyle(marker, { '--wot-calendar-view-day-size-with-info': '24px' })).toMatchObject({ width: '24px', height: '24px' })
    for (const selector of ['.wd-month__day-top', '.wd-month__day-bottom']) {
      const infoBox = dayAt(mounted.container, 5).querySelector(selector)!
      const infoText = infoBox.querySelector('text')!
      expect(ownStyle(infoBox)['line-height']).toBeUndefined()
      expect(ownStyle(infoText).color).toBe(ownStyle(marker).background)
      expect(ownStyle(infoText).color).not.toBe(selectedColor)
      expect(parseFloat(ownStyle(infoText)['font-size'])).toBeGreaterThan(0)
      const infoHeight = parseFloat(ownStyle(infoText)['line-height'])
      const inset = parseFloat(ownStyle(infoBox)[selector.endsWith('top') ? 'top' : 'bottom'])
      expect(inset + infoHeight).toBeLessThanOrEqual((60 - parseFloat(ownStyle(marker).height)) / 2)
    }
    const disabled = dayAt(mounted.container, 1)
    expect(disabled.classList.contains('is-disabled')).toBe(true)
    expect(ownStyle(disabled.querySelector('.wd-month__day-text')!).color).not.toBe(normalColor)
    expect(disabled.classList.contains('calendar-formatted')).toBe(true)
  })

  it.each([
    { type: 'month', value: stamp(6, 1), selected: [6] },
    { type: 'monthrange', value: [stamp(6, 1), null], selected: [6] },
    { type: 'monthrange', value: [stamp(6, 1), stamp(8, 1)], selected: [6, 8] },
    { type: 'monthrange', value: [stamp(6, 1), stamp(6, 1)], selected: [6] }
  ])('$type 月份选中态和范围端点保持完整圆形', ({ type, value, selected }) => {
    const { container } = render(CalendarView, {
      type, modelValue: value, minDate: stamp(1, 1), maxDate: stamp(12, 31), allowSameDay: true
    } as any)
    const cells = Array.from(container.querySelectorAll('.wd-year__month'))
    for (const month of selected) {
      const cell = cells[month - 1]
      const marker = cell.querySelector('.wd-year__month-container')!
      expect(ownStyle(marker)).toMatchObject({ width: '60px', height: '60px', 'border-radius': '9999px' })
      const range = cell.querySelector('.wd-year__month-range')
      if (range) {
        expect(ownStyle(cell)['z-index']).toBe('0')
        expect(Number(ownStyle(marker)['z-index'])).toBeGreaterThan(Number(ownStyle(range)['z-index']))
        expect(ownStyle(range)['pointer-events']).toBe('none')
        if (cell.classList.contains('is-without-end')) expect(ownStyle(range).display).toBe('none')
      }
    }
  })

  it('空选择首次定位今天，不将 epoch 0 钳制到 minDate', async () => {
    const { container } = render(CalendarView, { modelValue: null, minDate: stamp(5, 1), maxDate: stamp(7, 31) })
    await flush()
    // 五月六行 6*60+5*4；六月十五日第三行 2*64；第二个月标题 40。
    expect(Number(container.querySelector('scroll-view')!.getAttribute('scroll-top'))).toBe(380 + 128 + 40)
  })
  it.each([
    { type: 'date' as const, selector: '.wd-month', minDate: stamp(6, 1), maxDate: stamp(7, 31), values: [stamp(6, 1), stamp(7, 1)], scrollTop: [0, 356] },
    {
      type: 'month' as const, selector: '.wd-year',
      minDate: new Date(2025, 0, 1).getTime(), maxDate: new Date(2026, 11, 31).getTime(),
      values: [new Date(2025, 0, 1).getTime(), new Date(2026, 0, 1).getTime()], scrollTop: [0, 228]
    }
  ])('$type 双实例不注册重复内部 ID，scrollIntoView 仍各自定位', async ({ type, selector, minDate, maxDate, values, scrollTop }) => {
    const warn = vi.spyOn(console, 'warn')
    const instances: Array<{ scrollIntoView: () => void } | null> = []
    const { container } = render({
      setup: () => () => h('view', {}, values.map((value, index) => h(CalendarView, {
        type, minDate, maxDate, modelValue: value,
        ref: (instance: any) => { instances[index] = instance }
      })))
    })
    await flush()
    const views = Array.from(container.querySelectorAll('.wd-calendar-view'))
    expect(views).toHaveLength(2)
    expect(instances).toHaveLength(2)
    // 验证是两个真实组件，每个确实挂载两个月份/年份，而非未知标签空跑。
    for (const view of views) expect(view.querySelectorAll(selector)).toHaveLength(2)
    const ids = Array.from(container.querySelectorAll('[id]')).map((element) => element.getAttribute('id'))
    expect(new Set(ids).size).toBe(ids.length)
    expect(warn.mock.calls.filter(([message]) => String(message).includes('Duplicate id'))).toEqual([])
    for (const instance of instances) {
      expect(typeof instance?.scrollIntoView).toBe('function')
      instance!.scrollIntoView()
    }
    await flush()
    expect(views.map((view) => Number(view.querySelector('scroll-view')!.getAttribute('scroll-top')))).toEqual(scrollTop)
  })
})

describe('CalendarView 点击及弹层 API', () => {
  it('空位、边界外及 formatter 禁用日期不可选；已选日不重复 emit', async () => {
    const mounted = controlled('date', {
      minDate: stamp(6, 3), maxDate: stamp(6, 20),
      formatter: (item: CalendarDayItem) => ({ ...item, disabled: item.disabled || new Date(item.date).getDate() === 8 })
    })
    fireEvent.tap(mounted.container.querySelector('.wd-month__day--empty')!)
    for (const day of [1, 21, 8]) fireEvent.tap(dayAt(mounted.container, day))
    await flush()
    expect(mounted.updates).not.toHaveBeenCalled()
    expect(mounted.changes).not.toHaveBeenCalled()
    fireEvent.tap(dayAt(mounted.container, 5))
    await flush()
    expect(mounted.value.value).toBe(stamp(6, 5))
    expect(mounted.changes).toHaveBeenLastCalledWith({ value: stamp(6, 5) })
    expect(dayAt(mounted.container, 5).classList.contains('is-selected')).toBe(true)
    fireEvent.tap(dayAt(mounted.container, 5))
    await flush()
    expect(mounted.updates).toHaveBeenCalledTimes(1)
  })

  it('dates 多选在同一原生格切换选中与取消', async () => {
    const mounted = controlled('dates')
    fireEvent.tap(dayAt(mounted.container, 5))
    await flush()
    expect(mounted.value.value).toEqual([stamp(6, 5)])
    expect(dayAt(mounted.container, 5).classList.contains('is-multiple-selected')).toBe(true)
    fireEvent.tap(dayAt(mounted.container, 5))
    await flush()
    expect(mounted.value.value).toEqual([])
    expect(dayAt(mounted.container, 5).classList.contains('is-multiple-selected')).toBe(false)
  })

  it('跨月范围由 pending 到完整区间，再次点击开始新范围', async () => {
    const mounted = controlled('daterange')
    fireEvent.tap(dayAt(mounted.container, 29))
    await flush()
    expect(mounted.value.value).toEqual([stamp(6, 29), null])
    expect(dayAt(mounted.container, 29).classList.contains('is-without-end')).toBe(true)
    fireEvent.tap(dayAt(mounted.container, 29))
    await flush()
    expect(mounted.updates).toHaveBeenCalledTimes(1)
    fireEvent.tap(dayAt(mounted.container, 3, 1))
    await flush()
    expect(mounted.value.value).toEqual([stamp(6, 29), stamp(7, 3)])
    expect(dayAt(mounted.container, 29).classList.contains('is-start')).toBe(true)
    expect(dayAt(mounted.container, 30).classList.contains('is-middle')).toBe(true)
    expect(dayAt(mounted.container, 1, 1).classList.contains('is-middle')).toBe(true)
    expect(dayAt(mounted.container, 3, 1).classList.contains('is-end')).toBe(true)
    expect(dayAt(mounted.container, 29).classList.contains('is-without-end')).toBe(false)
    fireEvent.tap(dayAt(mounted.container, 7, 1))
    await flush()
    expect(mounted.value.value).toEqual([stamp(7, 7), null])
  })

  it('allowSameDay 支持同日起止；maxRange 超限钳制终点', async () => {
    const same = controlled('daterange', { allowSameDay: true })
    fireEvent.tap(dayAt(same.container, 5))
    await flush()
    fireEvent.tap(dayAt(same.container, 5))
    await flush()
    expect(same.value.value).toEqual([stamp(6, 5), stamp(6, 5)])
    expect(dayAt(same.container, 5).classList.contains('is-same')).toBe(true)
    const limited = controlled('daterange', { maxRange: 3 })
    fireEvent.tap(dayAt(limited.container, 5))
    await flush()
    fireEvent.tap(dayAt(limited.container, 20))
    await flush()
    expect(limited.value.value).toEqual([stamp(6, 5), stamp(6, 7)])
  })

  it('Calendar 弹层复用日期格且保留 change/confirm/modelValue 协议', async () => {
    const change = vi.fn(), confirm = vi.fn(), update = vi.fn()
    const { container } = render(Calendar, {
      ...bounds, modelValue: null, visible: true, duration: 0,
      onChange: change, onConfirm: confirm, 'onUpdate:modelValue': update
    })
    await flush()
    fireEvent.tap(dayAt(container, 5))
    await flush()
    expect(change).toHaveBeenLastCalledWith({ value: stamp(6, 5) })
    expect(update).not.toHaveBeenCalled()
    fireEvent.tap(container.querySelector('.wd-calendar__confirm .wd-button')!)
    await flush()
    expect(update).toHaveBeenLastCalledWith(stamp(6, 5))
    expect(confirm).toHaveBeenLastCalledWith({ value: stamp(6, 5), type: 'date' })
  })
})

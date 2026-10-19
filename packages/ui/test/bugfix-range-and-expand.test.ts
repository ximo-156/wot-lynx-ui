/**
 * 任务 #6 缺陷锁定（P0-4 / P1）：
 *
 * ① wd-swipe-action：编程展开在「操作区宽度落地前」静默失效。
 *    onMounted 里的 getRect 是异步的；若 modelValue 在宽度落地前就是
 *    left/right（或在其落地前被置为 left/right），changeState 会以
 *    leftWidth/rightWidth=0 调 swipeMove → offsetX 停在 0；而 watch(modelValue)
 *    不会再触发（值没变），于是「编程展开」永远不生效。
 *    修复：宽度落地后，若当前仍处于未位移的 left/right 态，补一次展开。
 *
 * ② wd-calendar-view：已完成区间的起点不高亮。
 *    旧实现 `isSameDay(start, time) && (!end || props.allowSameDay)`：默认
 *    allowSameDay=false 时，只要区间已完成（end 存在），起点就被判为非 start，
 *    起点格子失去 is-start 高亮。参考实现中 date == startDate 一律返回 'start'。
 *    allowSameDay 的真正落点是点击守卫（禁止点同一天成区间），本文件一并锁定。
 */
import { describe, it, expect } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import { pause } from '../src/common/util'
import SwipeAction from '../src/components/wd-swipe-action/wd-swipe-action.vue'
import CalendarView from '../src/components/wd-calendar-view/wd-calendar-view.vue'

async function frames(n = 8) {
  for (let i = 0; i < n; i++) await pause()
}

/**
 * 按选择器关键字返回不同宽度的 SelectorQuery mock。
 * setup.ts 的默认 mock 对所有选择器返回零矩形，无法驱动「操作区宽度」相关逻辑。
 */
function installSelectorQueryByKey(widths: { left?: number; right?: number }) {
  const lynx = (globalThis as any).lynx
  const rect = (w: number) => ({ id: '', left: 0, top: 0, right: w, bottom: 40, width: w, height: 40 })
  const makeRef = (payload: any) => ({
    invoke(options: any) {
      if (options && typeof options.success === 'function') {
        setTimeout(() => options.success(payload), 0)
      }
      return { exec: () => {} }
    },
    boundingClientRect(cb: any) {
      if (typeof cb === 'function') setTimeout(() => cb(payload), 0)
      return { exec: () => {} }
    },
    fields(_: any, cb: any) {
      if (typeof cb === 'function') setTimeout(() => cb(payload), 0)
      return { exec: () => {} }
    }
  })
  const makeQuery = () => ({
    select: (selector: string) => {
      if (selector.includes('__left')) return makeRef(rect(widths.left ?? 0))
      if (selector.includes('__right')) return makeRef(rect(widths.right ?? 0))
      return makeRef(rect(0))
    },
    selectAll: () => makeRef([]),
    in: () => makeQuery(),
    exec: () => {}
  })
  lynx.createSelectorQuery = () => makeQuery()
}

function wrapperStyle(container: Element): string {
  return container.querySelector('.wd-swipe-action__wrapper')?.getAttribute('style') || ''
}

describe('wd-swipe-action：编程展开（宽度落地补齐）', () => {
  it('modelValue 初始为 right 时，宽度落地后应补展开（旧实现停在 translateX(0px)）', async () => {
    installSelectorQueryByKey({ left: 80, right: 90 })
    const { container } = render({
      setup() {
        return () =>
          h(
            SwipeAction as any,
            { modelValue: 'right' },
            {
              left: () => h('view', { class: 'op-left' }, '收藏'),
              default: () => h('view', { class: 'op-content' }, '单元格'),
              right: () => h('view', { class: 'op-right' }, '删除')
            }
          )
      }
    } as any)

    await frames()
    // 右区宽度 90 → 编程展开应位移 -90px。
    // 旧实现：宽度落地前 changeState 以 0 位移静默失效，watch 不再触发 → 停在 0px。
    expect(
      wrapperStyle(container),
      'modelValue=right 应在宽度落地后展开为 translateX(-90px)'
    ).toContain('translateX(-90px)')
    cleanup()
  })

  it('modelValue 初始为 left 时，宽度落地后应补展开', async () => {
    installSelectorQueryByKey({ left: 80, right: 90 })
    const { container } = render({
      setup() {
        return () =>
          h(
            SwipeAction as any,
            { modelValue: 'left' },
            {
              left: () => h('view', { class: 'op-left' }, '收藏'),
              default: () => h('view', { class: 'op-content' }, '单元格'),
              right: () => h('view', { class: 'op-right' }, '删除')
            }
          )
      }
    } as any)

    await frames()
    expect(wrapperStyle(container), 'modelValue=left 应展开为 translateX(80px)').toContain('translateX(80px)')
    cleanup()
  })
})

describe('wd-calendar-view：区间高亮与 allowSameDay', () => {
  // wot-ui 2.3.2 结构：日历视图按「月面板（默认渲染 minDate~maxDate 共约 13
  // 个月）> 月网格」组织，日期格子类名为 .wd-month__day / .wd-month__day-text
  // （对齐参考源）。测试需按月份标题定位到具体月份面板内查询，避免相邻
  // 补位月/范围外月份的「5 日」干扰。
  const dayText = (el: Element) => el.querySelector('.wd-month__day-text')?.textContent?.trim()
  const panelOf = (container: Element, title: string) =>
    Array.from(container.querySelectorAll('.wd-month')).find(
      (m) => m.querySelector('.wd-month__title')?.textContent === title
    ) || null
  const dayCells = (panel: Element) => Array.from(panel.querySelectorAll('.wd-month__day'))
  const cellOf = (panel: Element, n: string) => dayCells(panel).find((c) => dayText(c) === n)

  it('已完成区间的起点/终点/中间段分别带 is-start / is-end / is-middle', async () => {
    const start = new Date(2026, 9, 5).getTime() // 2026-10-05
    const end = new Date(2026, 9, 12).getTime() // 2026-10-12
    const { container } = render({
      setup() {
        return () => h(CalendarView as any, { type: 'daterange', modelValue: [start, end] })
      }
    } as any)

    await frames()

    const panel = panelOf(container, '2026年10月')!
    expect(panel, '应渲染 2026年10月 面板').toBeTruthy()
    const startCell = cellOf(panel, '5')
    const endCell = cellOf(panel, '12')
    const midCell = cellOf(panel, '8')
    expect(startCell, '应渲染 10 月 5 日格子').toBeTruthy()
    expect(endCell, '应渲染 10 月 12 日格子').toBeTruthy()
    expect(midCell, '应渲染 10 月 8 日格子').toBeTruthy()

    // 旧实现：默认 allowSameDay=false，起点被判为非 start → 无 is-start
    expect(startCell!.getAttribute('class'), '区间起点必须带 is-start').toContain('is-start')
    expect(endCell!.getAttribute('class'), '区间终点必须带 is-end').toContain('is-end')
    expect(midCell!.getAttribute('class'), '区间中间段必须带 is-middle').toContain('is-middle')
    cleanup()
  })

  it('allowSameDay=false（默认）时点击与起点同一天不成区间', async () => {
    const emitted: any[] = []
    // wot-ui 的区间状态机是无状态的：每次点击读 props.value 判定 pending /
    // 完成态，必须经 v-model 回写闭环（与参考源行为一致）
    const { container } = render({
      setup() {
        const value = ref<null | [number, null]>(null)
        return () =>
          h(CalendarView as any, {
            type: 'daterange',
            modelValue: value.value,
            'onUpdate:modelValue': (v: any) => {
              emitted.push(v)
              value.value = v
            }
          })
      }
    } as any)

    await frames()
    // 默认范围约为当前月份 ±6 个月，按标题定位当月面板
    const now = new Date()
    const panel = panelOf(container, `${now.getFullYear()}年${now.getMonth() + 1}月`)!
    expect(panel, '应渲染当月面板').toBeTruthy()
    const startCell = cellOf(panel, '5')!
    expect(startCell, '应渲染当月 5 日格子').toBeTruthy()

    fireEvent.tap(startCell)
    await frames()
    expect(emitted.length, '首次点击应发出起点（pending）').toBeGreaterThan(0)
    const afterFirst = emitted.length

    // 再次点击同一天：allowSameDay=false 应被守卫拦下（不成 [d, d]）
    fireEvent.tap(cellOf(panel, '5')!)
    await frames()
    expect(
      emitted.length,
      'allowSameDay=false 时再次点击同一天不得发出区间（旧实现会成 [d, d]）'
    ).toBe(afterFirst)
    cleanup()
  })
})

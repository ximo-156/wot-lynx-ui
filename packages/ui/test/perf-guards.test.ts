/**
 * 性能专项守护（任务 #7）：
 * - PERF-6 wd-watermark：平铺节点数必须有上限——小单元 + 大容器（整页水印）
 *   否则会铺出数千节点冻结渲染。旧实现无钳制。
 * - PERF-2 wd-calendar-view：时间列改由 computed 提供（不再在模板内联重建），
 *   列数须与 hideSecond 一致（重构守护）。
 * - PERF-1 wd-picker-view：行高/留白/指示带样式提为复用对象后，渲染结果不变
 *   （重构守护）。
 */
import { describe, it, expect } from 'vitest'
import { h } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import Watermark from '../src/components/wd-watermark/wd-watermark.vue'
import CalendarView from '../src/components/wd-calendar-view/wd-calendar-view.vue'
import PickerView from '../src/components/wd-picker-view/wd-picker-view.vue'

async function frames(n = 8) {
  for (let i = 0; i < n; i++) await pause()
}

describe('性能专项守护', () => {
  it('wd-watermark：小单元 + 大容器时平铺节点数必须被钳制在上限内', async () => {
    const { container } = render({
      setup() {
        return () => h(Watermark as any, { content: '水印', width: 10, height: 10 })
      }
    } as any)
    await frames()

    const units = container.querySelectorAll('.wd-watermark__unit')
    expect(units.length, '应渲染水印单元').toBeGreaterThan(0)
    // 容器回退 375×667、单元 10px → 无上限时 ≈ 38 × 67 = 2546 个节点
    expect(
      units.length,
      '平铺节点数必须被钳制到 ≤ 1000（旧实现无上限 → 2546 个节点）'
    ).toBeLessThanOrEqual(1000)
    cleanup()
  })

  it('wd-calendar-view：datetime 时间面板列数随 hideSecond 变化', async () => {
    const ts = new Date(2026, 9, 5, 8, 30, 15).getTime()

    const { container } = render({
      setup() {
        return () => h(CalendarView as any, { type: 'datetime', modelValue: ts })
      }
    } as any)
    await frames()
    expect(container.querySelectorAll('.wd-picker-view__column').length, '应渲染 时/分/秒 三列').toBe(3)
    cleanup()

    const { container: c2 } = render({
      setup() {
        return () => h(CalendarView as any, { type: 'datetime', modelValue: ts, hideSecond: true })
      }
    } as any)
    await frames()
    expect(c2.querySelectorAll('.wd-picker-view__column').length, 'hideSecond 时应只渲染 时/分 两列').toBe(2)
    cleanup()
  })

  it('wd-picker-view：行高/留白/指示带样式对象复用后渲染结果不变', async () => {
    const { container } = render({
      setup() {
        return () =>
          h(PickerView as any, {
            columns: [Array.from({ length: 5 }, (_, i) => ({ label: String(i), value: i }))],
            itemHeight: 44,
            visibleItemCount: 3
          })
      }
    } as any)
    await frames()

    const rows = container.querySelectorAll('.wd-picker-view__column-item')
    expect(rows.length).toBe(5)
    expect(rows[0]!.getAttribute('style') || '', '行高应为 44px').toContain('height: 44px')

    const pads = container.querySelectorAll('.wd-picker-view__column-pad')
    expect(pads.length).toBe(2)
    // 留白 = (visibleItemCount - 1) / 2 * itemHeight = (3-1)/2*44 = 44
    expect(pads[0]!.getAttribute('style') || '', '上下留白应为 44px').toContain('height: 44px')

    const indicator = container.querySelector('.wd-picker-view__roller')
    const indStyle = indicator?.getAttribute('style') || ''
    expect(indStyle, '指示带 top 应为 44px').toContain('top: 44px')
    expect(indStyle, '指示带高度应为 44px').toContain('height: 44px')
    cleanup()
  })
})

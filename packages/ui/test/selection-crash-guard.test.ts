/**
 * 选择器数据异常兜底回归测试。
 *
 * 背景：
 * - `formatColumnsData` 对脏数据（缺少 valueKey/labelKey、对象与原始值混用）
 *   会 throw，这是对外 API 的既有契约；但调用点是 wd-picker-view 的 watch
 *   回调，真机上抛错会变成未捕获异常并崩掉整张卡片。组件侧必须就地接住并
 *   降级为空列。
 * - columns 缩减 / 清空时 selectedIndex 可能短暂残留旧下标，
 *   useSelection 的 selectedOptions / selectedValues / selectedLabels
 *   若直接两段下标取值，会在渲染或 expose 读取时抛 TypeError。
 */
import { describe, it, expect } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { captureConsole } from './capture-console'
import { useSelection } from '../src/composables/useSelection'
import PickerView from '../src/components/wd-picker-view/wd-picker-view.vue'

describe('useSelection 脏下标兜底', () => {
  it('selectedIndex 越界 / formatColumns 为空时取值不抛 TypeError', () => {
    const sel = useSelection({ valueKey: 'value', labelKey: 'label' })
    sel.formatColumns.value = []
    sel.selectedIndex.value = [0, 1]

    expect(() => sel.selectedOptions.value).not.toThrow()
    expect(() => sel.selectedValues.value).not.toThrow()
    expect(() => sel.selectedLabels.value).not.toThrow()

    // 越界项降级为安全值，长度与 selectedIndex 对齐（消费方按列取值）
    expect(sel.selectedOptions.value).toEqual([{}, {}])
    expect(sel.selectedValues.value).toEqual([undefined, undefined])
    expect(sel.selectedLabels.value).toEqual(['', ''])
  })

  it('部分列缺失时只降级缺失列，正常列仍能取值', () => {
    const sel = useSelection({ valueKey: 'value', labelKey: 'label' })
    sel.formatColumns.value = [[{ value: 'a', label: '选项A' }]]
    sel.selectedIndex.value = [0, 3]

    expect(sel.selectedOptions.value[0]).toEqual({ value: 'a', label: '选项A' })
    expect(sel.selectedValues.value[0]).toBe('a')
    expect(sel.selectedLabels.value[0]).toBe('选项A')
    // 第二列不存在：安全降级
    expect(sel.selectedValues.value[1]).toBeUndefined()
    expect(sel.selectedLabels.value[1]).toBe('')
  })
})

describe('wd-picker-view 非法 columns 不崩', () => {
  it('缺少 valueKey/labelKey 时降级为空列并保持页面可用', async () => {
    const capture = captureConsole()
    try {
      const columns = ref<any[]>([
        { value: 'a', label: '选项A' },
        { value: 'b', label: '选项B' }
      ])
      const App = {
        setup() {
          return () => h(PickerView as any, { modelValue: ['a'], columns: columns.value })
        }
      }
      const { container } = render(App as any)
      await nextTick()

      expect(container.querySelectorAll('.wd-picker-view__column').length).toBe(1)

      // 脏数据：对象项既没有 value 也没有 label → formatColumnsData 会 throw
      columns.value = [{ text: '只有 text 字段' }]
      await nextTick()
      await nextTick()

      // 不崩、降级为空列，并留下可诊断的日志
      expect(container.querySelectorAll('.wd-picker-view__column').length).toBe(0)
      expect(
        capture.messages.some((message) => message.includes('columns 数据不合法，已降级为空列'))
      ).toBe(true)
    } finally {
      cleanup()
      capture.restore()
    }
  })
})

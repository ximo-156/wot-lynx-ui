/**
 * wd-picker-view v-memo 渲染回归（2026-11-10 真机卡顿排查配套）。
 *
 * 背景：后台响应式跟手每帧重渲染整棵列子树，而 @vue/runtime-core 对
 * `patchFlag & STYLE` 的元素**无条件**下发样式（无 prev !== next 守卫），
 * vue-lynx 的 patchProp 又把整个 style 对象推成一条 SET_STYLE op。修复是把
 * 列项 / 整列 / 遮罩 / 指示带加上 v-memo（withMemo 命中返回同一 vnode 对象，
 * patch 对 n1 === n2 早退），并按列缓存位移样式。
 *
 * v-memo 的风险是「依赖漏写 → 状态变了画面不更新」，因此本文件分两类守护：
 * 1. **正确性**：选中 / 行高 / 可见项数 / 列数据 / 取值键 / customStyle 变化后
 *    画面必须更新（任何一项失灵即回归）；
 * 2. **性能**：跟手帧下发的样式 op 必须有上限——旧实现 3 列 × 5 行也要
 *    28 op/帧（15 行 + 6 补位 + 3 列内容 + 遮罩/指示带/主区/根），修复后
 *    只有「拖动的那列（列内容 + 2 补位）+ 主区 + 根」5 op/帧。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { pause } from '../../src/common/util'
import { fireEvent } from '../fire-event'
import PickerView from '../../src/components/wd-picker-view/wd-picker-view.vue'

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

/** 列内容元素 */
function contentOf(container: Element, colIndex: number): Element {
  return container.querySelectorAll('.wd-picker-view__column-content')[colIndex]
}

/** 一次完整拖动（jsdom 不模拟冒泡，按真机结果直接派发到列内容） */
function drag(container: Element, colIndex: number, fromY: number, toY: number) {
  const content = contentOf(container, colIndex)
  fireEvent.touchstart(content, { touches: [{ clientX: 0, clientY: fromY }] })
  fireEvent.touchmove(content, { touches: [{ clientX: 0, clientY: toY }] })
  fireEvent.touchend(content, { touches: [], changedTouches: [{ clientX: 0, clientY: toY }] })
}

/**
 * 统计主线程样式下发次数。
 *
 * `__SetInlineStyles` 是测试宿主执行 OP.SET_STYLE 的入口（vue-lynx
 * main-thread/dist/ops-apply.js），一次调用对应真机一次原生样式应用。
 */
function countStyleOps() {
  const env = (globalThis as any).lynxTestingEnv
  env.switchToMainThread()
  const mt = env.mainThread.globalThis as any
  const origin = mt.__SetInlineStyles
  const counter = { ops: 0 }
  mt.__SetInlineStyles = (el: Element, styles: Record<string, string>) => {
    counter.ops++
    return origin(el, styles)
  }
  env.switchToBackgroundThread()
  return counter
}

describe('wd-picker-view v-memo 渲染回归', () => {
  afterEach(() => cleanup())

  describe('正确性：依赖变化必须刷新画面', () => {
    it('选中索引变化后 active 类迁移到新列项', async () => {
      const { container } = render({
        setup() {
          const value = ref<string[]>(['a'])
          return () =>
            h(PickerView as any, {
              modelValue: value.value,
              columns: [['a', 'b', 'c']],
              itemHeight: 44,
              'onUpdate:modelValue': (v: string[]) => {
                value.value = v
              }
            })
        }
      } as any)
      await nextTick()

      const activeText = () =>
        container.querySelector('.wd-picker-view__column-item--active')?.textContent
      expect(activeText()).toBe('a')

      drag(container, 0, 0, -44)
      await pause(260)
      expect(activeText(), '上拖一格后选中项应迁移到 b').toBe('b')
      cleanup()
    })

    it('禁用项迁移后 active 类跟随 correctSelected 结果', async () => {
      const { container } = render(PickerView, {
        modelValue: ['b'],
        columns: [
          [
            { value: 'a', label: 'a', disabled: true },
            { value: 'b', label: 'b' },
            { value: 'c', label: 'c', disabled: true }
          ]
        ],
        itemHeight: 44
      })
      await nextTick()
      // b 未禁用，保持选中
      expect(container.querySelector('.wd-picker-view__column-item--active')?.textContent).toBe('b')
      cleanup()

      // 选中项被禁用时迁移到最近的可用项
      const { container: c2 } = render(PickerView, {
        modelValue: ['a'],
        columns: [
          [
            { value: 'a', label: 'a', disabled: true },
            { value: 'b', label: 'b' },
            { value: 'c', label: 'c', disabled: true }
          ]
        ],
        itemHeight: 44
      })
      await nextTick()
      expect(c2.querySelector('.wd-picker-view__column-item--active')?.textContent).toBe('b')
      cleanup()
    })

    it('itemHeight / visibleItemCount 变化后行高、补位、指示带、主区高度刷新', async () => {
      const itemHeight = ref(44)
      const visibleItemCount = ref(3)
      const { container } = render({
        setup() {
          return () =>
            h(PickerView as any, {
              modelValue: ['a'],
              columns: [['a', 'b', 'c']],
              itemHeight: itemHeight.value,
              visibleItemCount: visibleItemCount.value
            })
        }
      } as any)
      await nextTick()

      const row = container.querySelector('.wd-picker-view__column-item')!
      const pad = container.querySelector('.wd-picker-view__column-pad')!
      const indicator = container.querySelector('.wd-picker-view__roller')!
      const main = container.querySelector('.wd-picker-view__main')!
      expect(styleOf(row)).toContain('height: 44px')
      expect(styleOf(pad), '(3-1)/2 × 44 = 44').toContain('height: 44px')
      expect(styleOf(indicator)).toContain('height: 44px')
      expect(styleOf(main), '3 × 44 = 132').toContain('height: 132px')

      itemHeight.value = 50
      visibleItemCount.value = 5
      await nextTick()
      await nextTick()
      expect(styleOf(container.querySelector('.wd-picker-view__column-item')!), '行高应随 itemHeight 刷新').toContain('height: 50px')
      expect(styleOf(container.querySelector('.wd-picker-view__column-pad')!), '(5-1)/2 × 50 = 100').toContain('height: 100px')
      expect(styleOf(container.querySelector('.wd-picker-view__roller')!), '指示带高度随 itemHeight 刷新').toContain('height: 50px')
      expect(styleOf(container.querySelector('.wd-picker-view__main')!), '主区高度 = 5 × 50').toContain('height: 250px')
      cleanup()
    })

    it('labelKey 变化后列项文本刷新', async () => {
      const labelKey = ref('label')
      const { container } = render({
        setup() {
          return () =>
            h(PickerView as any, {
              modelValue: ['a'],
              columns: [[{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }]],
              labelKey: labelKey.value,
              itemHeight: 44
            })
        }
      } as any)
      await nextTick()
      expect(container.querySelector('.wd-picker-view__column-label')?.textContent).toBe('甲')

      labelKey.value = 'name'
      await nextTick()
      await nextTick()
      // valueKey 仍为 value，name 缺失时回落 value 文本
      expect(container.querySelector('.wd-picker-view__column-label')?.textContent).toBe('a')
      cleanup()
    })

    it('列数据变化（列数 / 选项 / 禁用）后重新渲染', async () => {
      const columns = ref<any[]>([['a', 'b'], ['x', 'y']])
      const { container } = render({
        setup() {
          return () =>
            h(PickerView as any, {
              modelValue: ['a', 'x'],
              columns: columns.value,
              itemHeight: 44
            })
        }
      } as any)
      await nextTick()
      expect(container.querySelectorAll('.wd-picker-view__column').length).toBe(2)

      // 列数变化
      columns.value = [['a', 'b', 'c']]
      await nextTick()
      await nextTick()
      expect(container.querySelectorAll('.wd-picker-view__column').length, '列数应随 columns 刷新').toBe(1)
      expect(container.querySelectorAll('.wd-picker-view__column-item').length).toBe(3)

      // 同列数的内容 + 禁用变化（新数组）
      columns.value = [
        [
          { value: 'a', label: 'a' },
          { value: 'b', label: 'b', disabled: true },
          { value: 'c', label: 'c' }
        ]
      ]
      await nextTick()
      await nextTick()
      expect(container.querySelectorAll('.wd-picker-view__column-item--disabled').length, '禁用态应刷新').toBe(1)
      cleanup()
    })

    it('customStyle 变化后根节点样式刷新', async () => {
      const customStyle = ref('background-color: rgb(1, 2, 3)')
      const { container } = render({
        setup() {
          return () =>
            h(PickerView as any, {
              modelValue: ['a'],
              columns: [['a', 'b']],
              customStyle: customStyle.value,
              itemHeight: 44
            })
        }
      } as any)
      await nextTick()
      expect(styleOf(container.querySelector('.wd-picker-view'))).toContain('background-color')

      customStyle.value = 'background-color: rgb(4, 5, 6)'
      await nextTick()
      await nextTick()
      expect(styleOf(container.querySelector('.wd-picker-view'))).toContain('rgb(4, 5, 6)')
      cleanup()
    })

    it('级联模式拖动父列后子列重建', async () => {
      const { container } = render(PickerView, {
        modelValue: ['zhejiang', 'hangzhou'],
        columns: [
          { value: 'zhejiang', label: '浙江', children: [{ value: 'hangzhou', label: '杭州' }, { value: 'ningbo', label: '宁波' }] },
          { value: 'jiangsu', label: '江苏', children: [{ value: 'nanjing', label: '南京' }] }
        ],
        cascade: true,
        itemHeight: 44
      })
      await nextTick()
      await nextTick()
      expect(container.querySelectorAll('.wd-picker-view__column').length).toBe(2)

      drag(container, 0, 0, -44)
      await pause(260)
      const items = container.querySelectorAll('.wd-picker-view__column')[1].querySelectorAll('.wd-picker-view__column-item')
      expect(items.length, '子列应重建为江苏的 children').toBe(1)
      expect(items[0].textContent).toContain('南京')
      cleanup()
    })
  })

  describe('性能：跟手帧样式下发上限', () => {
    it('拖动一列时每帧只下发该列与主区/根的样式（旧实现 28 op/帧）', async () => {
      const { container } = render(PickerView, {
        modelValue: ['a', 'x', 'm'],
        columns: [
          ['a', 'b', 'c', 'd', 'e'],
          ['x', 'y', 'z', 'u', 'v'],
          ['m', 'n', 'o', 'p', 'q']
        ],
        itemHeight: 44
      })
      await nextTick()
      await nextTick()

      const counter = countStyleOps()
      const content = contentOf(container, 1)
      fireEvent.touchstart(content, { touches: [{ clientX: 0, clientY: 300 }] })
      await nextTick()
      counter.ops = 0

      // 跟手 3 帧：只有第 2 列的位移在变
      for (let i = 1; i <= 3; i++) {
        fireEvent.touchmove(content, { touches: [{ clientX: 0, clientY: 300 - i * 20 }] })
        await nextTick()
      }
      const perFrame = counter.ops / 3
      // 修复后：拖动列的内容 + 2 补位 + 主区 + 根 = 5 op/帧
      expect(perFrame, '跟手帧样式 op 必须有上限').toBeLessThanOrEqual(8)

      // 跟手位移仍然生效
      expect(styleOf(content)).toMatch(/translateY\(-60px\)/)
      expect(styleOf(content)).toContain('transition: none')

      // 其余两列完全不被下发
      expect(styleOf(contentOf(container, 0))).toMatch(/translateY\(0px\)/)
      expect(styleOf(contentOf(container, 2))).toMatch(/translateY\(0px\)/)

      fireEvent.touchend(content, { touches: [], changedTouches: [{ clientX: 0, clientY: 240 }] })
      await pause(260)
      expect(styleOf(content)).toMatch(/translateY\(-44px\)/)
      cleanup()
    })
  })
})

/**
 * wd-picker-view MTS 跟手测试（原生优先重写版，参照 slider-mts.test.ts）。
 *
 * 覆盖「主线程跟手直改 + 后台落定 commit」的完整链路：
 * 1. **跟手直改**：touchmove 经主线程 worklet 把触点经「起点位移 + 手指位移」
 *    公式换算后 setStyleProperty 直改列内容 transform——零线程跨越；
 * 2. **落定 commit**：touchend 后台用同一公式由 changedTouches 重算终值、
 *    对齐到最近列项后 commit（update:modelValue + change），并派发
 *    pickstart / pickend；
 * 3. **事件分工与真机冒泡语义**（jsdom 不模拟冒泡，按冒泡结果分别派发）：
 *      列内容（子）绑后台 touchstart / touchend + 主线程 touchmove；
 *      列（父）绑主线程 touchstart（记跟手起点，几何经元素属性下发）；
 * 4. **边缘阻尼**：越界拖动阻尼后跟手，落定钳制回最近列项；
 * 5. **多列独立**：只拖一列，另一列位移与选中不变；
 * 6. **immediateChange**：true 在松手时提交，false 在吸附结束时提交；
 * 7. **级联**：拖动父列落定后子列重建为新 children。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import { fireEvent } from './fire-event'
import PickerView from '../src/components/wd-picker-view/wd-picker-view.vue'

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

/** 树形级联数据 */
const CASCADE_TREE = [
  {
    value: 'zhejiang',
    label: '浙江',
    children: [
      { value: 'hangzhou', label: '杭州' },
      { value: 'ningbo', label: '宁波' }
    ]
  },
  {
    value: 'jiangsu',
    label: '江苏',
    children: [{ value: 'nanjing', label: '南京' }]
  }
]

/**
 * 一次完整拖动（MTS 分工派发）。
 *
 * 真机上触摸列内容时：内容的后台 touchstart（目标）→ 列的主线程 touchstart
 * （冒泡）→ 内容的主线程 touchmove（目标，逐帧）→ 内容的后台 touchend（目标）。
 * jsdom 不模拟冒泡，此处按各处理器所在元素分别派发，等价真机冒泡结果。
 */
function drag(container: Element, colIndex: number, fromY: number, toY: number) {
  const column = container.querySelectorAll('.wd-picker-view__column')[colIndex]
  const content = column.querySelector('.wd-picker-view__column-content')!
  fireEvent.touchstart(content, { touches: [{ clientX: 0, clientY: fromY }] })
  fireEvent.touchstart(column, { touches: [{ clientX: 0, clientY: fromY }] })
  fireEvent.touchmove(content, { touches: [{ clientX: 0, clientY: toY }] })
  fireEvent.touchend(content, { touches: [], changedTouches: [{ clientX: 0, clientY: toY }] })
}

/** 仅跟手（不落定）：派发 touchstart + touchmove，验证主线程直改 */
function followHand(container: Element, colIndex: number, fromY: number, toY: number) {
  const column = container.querySelectorAll('.wd-picker-view__column')[colIndex]
  const content = column.querySelector('.wd-picker-view__column-content')!
  fireEvent.touchstart(content, { touches: [{ clientX: 0, clientY: fromY }] })
  fireEvent.touchstart(column, { touches: [{ clientX: 0, clientY: fromY }] })
  fireEvent.touchmove(content, { touches: [{ clientX: 0, clientY: toY }] })
}

describe('wd-picker-view MTS 跟手', () => {
  afterEach(() => cleanup())

  it('touchmove 经主线程 worklet 直改列内容；touchend 后台落定 commit', async () => {
    const updates: any[] = []
    const changes: any[] = []
    const picks: string[] = []
    const { container } = render({
      setup() {
        const value = ref<string[]>(['a', 'x'])
        return () =>
          h(PickerView as any, {
            immediateChange: true,
            modelValue: value.value,
            columns: [
              ['a', 'b', 'c'],
              ['x', 'y']
            ],
            itemHeight: 44,
            'onUpdate:modelValue': (v: any) => {
              value.value = v
              updates.push(v)
            },
            onChange: (e: any) => changes.push(e),
            onPickstart: () => picks.push('start'),
            onPickend: () => picks.push('end')
          })
      }
    } as any)
    await pause(50)

    const content0 = container.querySelectorAll('.wd-picker-view__column-content')[0]
    const content1 = container.querySelectorAll('.wd-picker-view__column-content')[1]

    // 跟手：第 1 列从 clientY 0 拖到 -50 → 位移 50px（未对齐列项）
    // worklet 应把列内容直改为 translateY(-50px)，且显式写 transition: none
    followHand(container, 0, 0, -50)
    expect(styleOf(content0), '跟手应直改 transform').toMatch(/translateY\(-50px\)/)
    expect(styleOf(content0), '跟手期过渡必须显式为 none').toContain('transition: none')
    // 另一列不受影响
    expect(styleOf(content1)).toMatch(/translateY\(0px\)/)

    // 落定：后台 touchend 以同一公式重算 → 50/44 ≈ 1.14 → 对齐到索引 1（b）
    fireEvent.touchend(
      container.querySelectorAll('.wd-picker-view__column')[0].querySelector('.wd-picker-view__column-content')!,
      { touches: [], changedTouches: [{ clientX: 0, clientY: -50 }] }
    )
    await pause(230)
    expect(updates[updates.length - 1]).toEqual(['b', 'x'])
    expect(changes[changes.length - 1].selectedValues).toEqual(['b', 'x'])
    expect(changes[changes.length - 1].columnIndex).toBe(0)
    expect(picks).toEqual(['start', 'end'])
    // 落定后位移对齐到列项（1 × 44）并恢复吸附过渡
    expect(styleOf(content0)).toMatch(/translateY\(-44px\)/)
    expect(styleOf(content0)).toContain('transform 0.2s')
    cleanup()
  })

  it('边缘阻尼：越界拖动阻尼跟手，落定钳制回最近列项', async () => {
    const updates: any[] = []
    const { container } = render({
      setup() {
        const value = ref<string[]>(['b'])
        return () =>
          h(PickerView as any, {
            immediateChange: true,
            modelValue: value.value,
            columns: [['a', 'b', 'c']],
            itemHeight: 44,
            'onUpdate:modelValue': (v: any) => {
              value.value = v
              updates.push(v)
            }
          })
      }
    } as any)
    await pause(50)
    const content0 = container.querySelectorAll('.wd-picker-view__column-content')[0]

    // 起点位移 44（索引 1）；向下拖 100 → 原始位移 -56 → 阻尼 -16.8
    followHand(container, 0, 0, 100)
    expect(styleOf(content0)).toMatch(/translateY\(16\.8px\)/)

    // 落定：钳制到 [0, max] → 索引 0（a）
    fireEvent.touchend(
      container.querySelectorAll('.wd-picker-view__column')[0].querySelector('.wd-picker-view__column-content')!,
      { touches: [], changedTouches: [{ clientX: 0, clientY: 100 }] }
    )
    await pause(50)
    expect(updates[updates.length - 1]).toEqual(['a'])
    expect(styleOf(content0)).toMatch(/translateY\(0px\)/)
    cleanup()
  })

  it('多列独立：只拖第 2 列，第 1 列位移与选中不变', async () => {
    const updates: any[] = []
    const { container } = render({
      setup() {
        const value = ref<string[]>(['a', 'x'])
        return () =>
          h(PickerView as any, {
            immediateChange: true,
            modelValue: value.value,
            columns: [
              ['a', 'b', 'c'],
              ['x', 'y']
            ],
            itemHeight: 44,
            'onUpdate:modelValue': (v: any) => {
              value.value = v
              updates.push(v)
            }
          })
      }
    } as any)
    await pause(50)
    const content0 = container.querySelectorAll('.wd-picker-view__column-content')[0]
    const content1 = container.querySelectorAll('.wd-picker-view__column-content')[1]

    // 第 2 列（索引 1）向上拖 44 → 选中 y
    drag(container, 1, 0, -44)
    await pause(50)
    expect(updates[updates.length - 1]).toEqual(['a', 'y'])
    expect(styleOf(content1)).toMatch(/translateY\(-44px\)/)
    expect(styleOf(content0)).toMatch(/translateY\(0px\)/)
    cleanup()
  })

  it('immediateChange：跟手不提交，松手提交并在吸附结束后发 pickend', async () => {
    const updates: any[] = []
    const { container } = render({
      setup() {
        const value = ref<string[]>(['a'])
        return () =>
          h(PickerView as any, {
            immediateChange: true,
            modelValue: value.value,
            columns: [['a', 'b', 'c']],
            itemHeight: 44,
            'onUpdate:modelValue': (v: any) => {
              value.value = v
              updates.push(v)
            }
          })
      }
    } as any)
    await pause(50)
    const column = container.querySelectorAll('.wd-picker-view__column')[0]
    const content = column.querySelector('.wd-picker-view__column-content')!

    // 跟手到 60px（超过 1.5 × 44 的一半 → 索引在 1 与 2 之间变化）
    fireEvent.touchstart(content, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchstart(column, { touches: [{ clientX: 0, clientY: 0 }] })
    // 移到 50px：即使 immediateChange=true，touchmove 不提交（官方为松手时提交）
    fireEvent.touchmove(content, { touches: [{ clientX: 0, clientY: -50 }] })
    fireEvent.touchmove(column, { touches: [{ clientX: 0, clientY: -50 }] })
    await pause(50)
    expect(updates, '手指未松开不得提交').toHaveLength(0)
    // 继续移到 100px：只跟手直改，到松手才提交最终 c
    fireEvent.touchmove(content, { touches: [{ clientX: 0, clientY: -100 }] })
    fireEvent.touchmove(column, { touches: [{ clientX: 0, clientY: -100 }] })
    await pause(50)
    expect(updates, '第二次 move 仍不提交').toHaveLength(0)
    // 跟手位移同步到 Vue 状态（v-model 回写重渲染不得让列内容跳变）：
    // 100px 超过 maxOffset(2×44=88) → 阻尼 88 + 12×0.3 = 91.6px
    expect(styleOf(content)).toMatch(/translateY\(-91\.6px\)/)

    fireEvent.touchend(content, { touches: [], changedTouches: [{ clientX: 0, clientY: -100 }] })
    await pause(50)
    expect(updates[updates.length - 1]).toEqual(['c'])
    cleanup()
  })

  it('级联：拖动父列落定后子列重建为新 children', async () => {
    const updates: any[] = []
    const { container } = render({
      setup() {
        const value = ref<string[]>(['zhejiang', 'hangzhou'])
        return () =>
          h(PickerView as any, {
            immediateChange: true,
            modelValue: value.value,
            columns: CASCADE_TREE,
            cascade: true,
            itemHeight: 44,
            'onUpdate:modelValue': (v: any) => {
              value.value = v
              updates.push(v)
            }
          })
      }
    } as any)
    await pause(50)
    // 初始两列，第 2 列 2 项（杭州 / 宁波）
    expect(container.querySelectorAll('.wd-picker-view__column').length).toBe(2)
    expect(container.querySelectorAll('.wd-picker-view__column')[1].querySelectorAll('.wd-picker-view__column-item').length).toBe(2)

    // 第 1 列向上拖 44 → 选中"江苏" → 子列重建为 [南京]
    drag(container, 0, 0, -44)
    await pause(50)
    expect(updates[updates.length - 1]).toEqual(['jiangsu', 'nanjing'])
    const columns = container.querySelectorAll('.wd-picker-view__column')
    expect(columns.length, '级联后仍为两列').toBe(2)
    const secondItems = columns[1].querySelectorAll('.wd-picker-view__column-item')
    expect(secondItems.length, '第 2 列应重建为新 children').toBe(1)
    expect(secondItems[0].textContent).toContain('南京')
    cleanup()
  })

  it('禁用项：拖到禁用索引后落定自动就近迁移', async () => {
    const updates: any[] = []
    const { container } = render({
      setup() {
        const value = ref<string[]>(['a'])
        return () =>
          h(PickerView as any, {
            immediateChange: true,
            modelValue: value.value,
            columns: [['a', 'b', { value: 'c', label: 'c', disabled: true }, 'd']],
            itemHeight: 44,
            'onUpdate:modelValue': (v: any) => {
              value.value = v
              updates.push(v)
            }
          })
      }
    } as any)
    await pause(50)
    const content0 = container.querySelectorAll('.wd-picker-view__column-content')[0]

    // 拖到 100px：round(100/44) = 2 → c 禁用 → 就近迁移到 b（索引 1）
    drag(container, 0, 0, -100)
    await pause(50)
    expect(updates[updates.length - 1]).toEqual(['b'])
    // 位移跟随迁移后的索引
    expect(styleOf(content0)).toMatch(/translateY\(-44px\)/)
    cleanup()
  })

  it('无位移点击（touchstart 即 touchend）不改变选中', async () => {
    const updates: any[] = []
    const { container } = render({
      setup() {
        const value = ref<string[]>(['b'])
        return () =>
          h(PickerView as any, {
            immediateChange: true,
            modelValue: value.value,
            columns: [['a', 'b', 'c']],
            itemHeight: 44,
            'onUpdate:modelValue': (v: any) => {
              value.value = v
              updates.push(v)
            }
          })
      }
    } as any)
    await pause(50)
    const content0 = container.querySelectorAll('.wd-picker-view__column-content')[0]

    fireEvent.touchstart(content0, { touches: [{ clientX: 0, clientY: 200 }] })
    fireEvent.touchend(content0, { touches: [], changedTouches: [{ clientX: 0, clientY: 200 }] })
    await pause(50)
    expect(updates).toHaveLength(0)
    // 位移保持落位值（列内容不得残留在拖动位）
    expect(styleOf(content0)).toMatch(/translateY\(-44px\)/)
    cleanup()
  })
})

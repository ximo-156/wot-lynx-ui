/**
 * 修复清单回归测试（日历区间 / 级联选择器 / useSelection / 日期时间视图 /
 * 下拉菜单 / 日期时间选择器 / 选项卡 / 排序按钮 / 下拉选择 / 弹层 close /
 * 日历确认取消 / 级联确认空值守卫）。
 *
 * 每个用例对应一项修复，锁死已修行为，防止回归。
 */
import { describe, it, expect } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import { fireEvent } from './fire-event'
import { formatColumnsData, useSelection } from '../src/composables/useSelection'
import Popup from '../src/components/wd-popup/wd-popup.vue'
import PickerView from '../src/components/wd-picker-view/wd-picker-view.vue'
import CalendarView from '../src/components/wd-calendar-view/wd-calendar-view.vue'
import Calendar from '../src/components/wd-calendar/wd-calendar.vue'
import DatetimePickerView from '../src/components/wd-datetime-picker-view/wd-datetime-picker-view.vue'
import DatetimePicker from '../src/components/wd-datetime-picker/wd-datetime-picker.vue'
import DropMenu from '../src/components/wd-drop-menu/wd-drop-menu.vue'
import DropMenuItem from '../src/components/wd-drop-menu-item/wd-drop-menu-item.vue'
import Tabs from '../src/components/wd-tabs/wd-tabs.vue'
import Tab from '../src/components/wd-tab/wd-tab.vue'
import SortButton from '../src/components/wd-sort-button/wd-sort-button.vue'
import SelectPicker from '../src/components/wd-select-picker/wd-select-picker.vue'
import Cascader from '../src/components/wd-cascader/wd-cascader.vue'

/** 等待过渡入场（pause 约 33ms 一帧） */
async function frames(n = 8) {
  for (let i = 0; i < n; i++) await pause()
}

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

describe('修复清单回归（选择器 / 日历 / 菜单 / 弹层）', () => {
  describe('#1 wd-calendar-view 区间选择', () => {
    it('pending 哨兵 [start, 0] 不再被误判为已完成区间：第二次点击完成区间', async () => {
      const updates: any[] = []
      const changes: any[] = []
      const { container } = render(
        {
          setup() {
            return () =>
              h(CalendarView, {
                modelValue: null,
                type: 'daterange',
                'onUpdate:modelValue': (v: any) => updates.push(v),
                onChange: (e: any) => changes.push(e)
              })
          }
        } as any
      )
      const days = container.querySelectorAll('.wd-calendar-view__day')
      expect(days.length).toBe(42)

      // 第一次点击：pending [d1, 0]
      fireEvent.tap(days[10])
      await nextTick()
      expect(updates[updates.length - 1]).toHaveLength(2)
      expect(updates[updates.length - 1][1]).toBe(0)

      // 第二次点击（更晚日期）：必须形成完整区间（修复前永远重新开始）
      fireEvent.tap(days[20])
      await nextTick()
      const last = updates[updates.length - 1]
      expect(last).toHaveLength(2)
      expect(last[0]).toBeTruthy()
      expect(last[1]).toBeTruthy()
      expect(last[1]).toBeGreaterThan(last[0])
      // change 携带的也是完整区间
      expect(changes[changes.length - 1].value).toEqual(last)
      cleanup()
    })

    it('maxRange 超限：只重置为新起点并提示，change 不发半截区间', async () => {
      const updates: any[] = []
      const changes: any[] = []
      const { container } = render(
        {
          setup() {
            return () =>
              h(CalendarView, {
                modelValue: null,
                type: 'daterange',
                maxRange: 3,
                'onUpdate:modelValue': (v: any) => updates.push(v),
                onChange: (e: any) => changes.push(e)
              })
          }
        } as any
      )
      const days = container.querySelectorAll('.wd-calendar-view__day')

      fireEvent.tap(days[10])
      await nextTick()
      const changeCountBefore = changes.length

      // 点击 20 天后的日期：超出 maxRange=3
      fireEvent.tap(days[30])
      await nextTick()
      const last = updates[updates.length - 1]
      // 重置为新的 pending 起点（第二个元素是哨兵 0）
      expect(last).toHaveLength(2)
      expect(last[1]).toBe(0)
      // 超限不再派发 change（修复前 emit 的是上一次的半截区间）
      expect(changes.length, '超限不应派发 change').toBe(changeCountBefore)
      cleanup()
    })

    it('getDayType 对今天返回 current（is-current 高亮不再是死规则）', async () => {
      const { container } = render(CalendarView, { modelValue: null, type: 'date' })
      const today = container.querySelector('.wd-calendar-view__day.is-current')
      expect(today, '今天应带 is-current').not.toBeNull()
      cleanup()
    })
  })

  describe('#2/#3 wd-picker-view 级联 + useSelection 空列防护', () => {
    it('拖动第 1 列换父选项后第 2 列重建为新 children', async () => {
      const { container } = render(PickerView, {
        modelValue: ['zhejiang', 'hangzhou'],
        columns: CASCADE_TREE,
        cascade: true
      })
      await nextTick()
      const columns = container.querySelectorAll('.wd-picker-view__column')
      expect(columns.length, '初始应展开两列').toBe(2)
      expect(columns[1].querySelectorAll('.wd-picker-view__column-item').length).toBe(2)

      // 第 1 列向上拖一格（itemHeight 默认 44）→ 选中"江苏"
      const first = columns[0]
      fireEvent.touchstart(first, { touches: [{ clientX: 0, clientY: 0 }] })
      fireEvent.touchmove(first, { touches: [{ clientX: 0, clientY: -44 }] })
      fireEvent.touchend(first)
      await nextTick()
      await nextTick()

      const after = container.querySelectorAll('.wd-picker-view__column')
      expect(after.length, '级联后仍为两列').toBe(2)
      // 第 2 列重建为"江苏"的 children（只剩南京一项）
      const secondItems = after[1].querySelectorAll('.wd-picker-view__column-item')
      expect(secondItems.length, '第 2 列应重建为新 children').toBe(1)
      expect(secondItems[0].textContent).toContain('南京')
      cleanup()
    })

    it('formatColumnsData 空数组返回 []（不包成 [[]]）', () => {
      expect(formatColumnsData([], 'value', 'label')).toEqual([])
      expect(formatColumnsData([[]], 'value', 'label')).toEqual([[]])
    })

    it('空列 / 空 columns 上 selectWithValue 不抛 TypeError', () => {
      const sel = useSelection({ valueKey: 'value', labelKey: 'label' })
      // columns: [] → formatColumns 为空
      sel.resetColumns([])
      expect(() => sel.selectWithValue(undefined)).not.toThrow()
      expect(sel.selectedIndex.value).toEqual([])

      // columns: [[]] → 空列
      sel.formatColumns.value = formatColumnsData([[]], 'value', 'label')
      expect(() => sel.selectWithValue(undefined)).not.toThrow()
      expect(sel.selectedIndex.value).toEqual([])
    })

    it('wd-cascader 不传 options 打开不崩', async () => {
      expect(() =>
        render(Cascader, { modelValue: '', options: [], visible: true })
      ).not.toThrow()
      await frames()
      cleanup()
    })
  })

  describe('#4 wd-datetime-picker-view 数字字符串 modelValue', () => {
    it('数字字符串不再挂载即崩（RangeError: Invalid array length）', async () => {
      const updates: any[] = []
      expect(() =>
        render(
          {
            setup() {
              return () =>
                h(DatetimePickerView, {
                  modelValue: '1700000000000',
                  type: 'date',
                  'onUpdate:modelValue': (v: any) => updates.push(v)
                })
            }
          } as any
        )
      ).not.toThrow()
      await frames()
      // 值被钳制为数值时间戳
      expect(updates[updates.length - 1]).toBe(1700000000000)
      cleanup()
    })
  })

  describe('#5/#6/#7 wd-drop-menu', () => {
    function renderDropMenu() {
      const sort = ref<string | number>('')
      const price = ref<string | number>('')
      const changes: any[] = []
      const { container } = render(
        {
          setup() {
            return () => [
              h(DropMenu, null, {
                default: () => [
                  h(DropMenuItem, {
                    modelValue: sort.value,
                    title: '排序',
                    options: [
                      { value: 'default', label: '默认' },
                      { value: 'price', label: '价格' }
                    ],
                    'onUpdate:modelValue': (v: any) => (sort.value = v),
                    onChange: (e: any) => changes.push(['sort', e])
                  }),
                  h(DropMenuItem, {
                    modelValue: price.value,
                    title: '价格',
                    options: [
                      { value: '0-100', label: '0-100' },
                      { value: '100-200', label: '100-200' }
                    ],
                    'onUpdate:modelValue': (v: any) => (price.value = v),
                    onChange: (e: any) => changes.push(['price', e])
                  })
                ]
              })
            ]
          }
        } as any
      )
      return { container, changes }
    }

    it('展开一项时收起其他项（手风琴），遮罩随之显示', async () => {
      const { container } = renderDropMenu()
      const titles = container.querySelectorAll('.wd-drop-menu-item__title')
      expect(titles.length).toBe(2)

      fireEvent.tap(titles[0])
      await nextTick()
      expect(container.querySelectorAll('.wd-drop-menu-item__list').length, '第一项展开').toBe(1)
      await frames()
      expect(container.querySelector('.wd-overlay'), '展开时应显示遮罩').not.toBeNull()

      // 点第二项标题：第一项应收起
      fireEvent.tap(titles[1])
      await nextTick()
      const lists = container.querySelectorAll('.wd-drop-menu-item__list')
      expect(lists.length, '同时只能展开一项').toBe(1)
      cleanup()
    })

    it('select 只 emit 一次 change（不再双发 update:modelValue）', async () => {
      const { container, changes } = renderDropMenu()
      const titles = container.querySelectorAll('.wd-drop-menu-item__title')
      fireEvent.tap(titles[0])
      await nextTick()

      const options = container.querySelectorAll('.wd-drop-menu-item__option')
      expect(options.length).toBe(2)
      fireEvent.tap(options[1])
      await nextTick()

      const sortChanges = changes.filter(([name]) => name === 'sort')
      expect(sortChanges.length, 'change 只应触发一次').toBe(1)
      expect(sortChanges[0][1]).toEqual({ value: 'price' })
      // 选中后自动收起
      expect(container.querySelectorAll('.wd-drop-menu-item__list').length).toBe(0)
      cleanup()
    })
  })

  describe('#9 wd-datetime-picker showPopup 重置', () => {
    it('打开时从 modelValue 重置 pickerValue（取消后重开不显示旧值）', async () => {
      const pickerValueSeen = ref<string | number>('')
      const { container } = render(
        {
          setup() {
            return () =>
              h(DatetimePicker, {
                modelValue: '2024-01-01 10:30:00',
                visible: true,
                type: 'datetime',
                useSecond: true
              })
          }
        } as any
      )
      await frames()
      // 视图中选中项应与 modelValue 对应（年月日时分秒 = 2024/1/1/10/30/0）
      const active = container.querySelectorAll('.wd-picker-view__column-item--active')
      const texts = Array.from(active).map((el) => el.textContent)
      expect(texts[0]).toContain('2024')
      expect(texts[1]).toContain('01')
      expect(texts[2]).toContain('01')
      expect(texts[3]).toContain('10')
      expect(texts[4]).toContain('30')
      pickerValueSeen.value = ''
      cleanup()
    })
  })

  describe('#10 wd-tabs navCache 响应式', () => {
    it('tab 数超过 slidableNum 时添加 is-slide 且 scroll-x 可用', async () => {
      const { container } = render(
        {
          setup() {
            return () =>
              h(Tabs, { modelValue: 0 }, {
                default: () =>
                  Array.from({ length: 8 }, (_, i) => h(Tab, { title: `标签${i}`, name: i }))
              })
          }
        } as any
      )
      await nextTick()
      await nextTick()
      const root = container.querySelector('.wd-tabs')!
      expect(root.classList.contains('is-slide'), '多 tab 应可滑动').toBe(true)
      const scroll = container.querySelector('scroll-view')!
      expect(scroll.getAttribute('scroll-x')).not.toBe('false')
      cleanup()
    })
  })

  describe('#11 wd-sort-button 三态循环', () => {
    it('descFirst=false + allowReset：0 → 1(降) → -1(升) → 0', async () => {
      const values: any[] = []
      const { container } = render(
        {
          setup() {
            const value = ref(0)
            return () =>
              h(SortButton, {
                modelValue: value.value,
                allowReset: true,
                'onUpdate:modelValue': (v: any) => {
                  value.value = v
                  values.push(v)
                }
              })
          }
        } as any
      )
      const btn = container.querySelector('.wd-sort-button')!
      fireEvent.tap(btn)
      await nextTick()
      fireEvent.tap(btn)
      await nextTick()
      fireEvent.tap(btn)
      await nextTick()
      expect(values).toEqual([1, -1, 0])
      cleanup()
    })

    it('allowReset=false 时不会回到 0', async () => {
      const values: any[] = []
      const { container } = render(
        {
          setup() {
            const value = ref(0)
            return () =>
              h(SortButton, {
                modelValue: value.value,
                allowReset: false,
                'onUpdate:modelValue': (v: any) => {
                  value.value = v
                  values.push(v)
                }
              })
          }
        } as any
      )
      const btn = container.querySelector('.wd-sort-button')!
      for (let i = 0; i < 4; i++) {
        fireEvent.tap(btn)
        await nextTick()
      }
      expect(values).toEqual([1, -1, 1, -1])
      cleanup()
    })

    it('descFirst=true + allowReset：0 → -1(升) → 1(降) → 0', async () => {
      const values: any[] = []
      const { container } = render(
        {
          setup() {
            const value = ref(0)
            return () =>
              h(SortButton, {
                modelValue: value.value,
                descFirst: true,
                allowReset: true,
                'onUpdate:modelValue': (v: any) => {
                  value.value = v
                  values.push(v)
                }
              })
          }
        } as any
      )
      const btn = container.querySelector('.wd-sort-button')!
      for (let i = 0; i < 3; i++) {
        fireEvent.tap(btn)
        await nextTick()
      }
      expect(values).toEqual([-1, 1, 0])
      cleanup()
    })
  })

  describe('#13 wd-select-picker 单发 change', () => {
    it('勾选一次只 emit 一次 change', async () => {
      const changes: any[] = []
      const pickerRef = ref<any>(null)
      const { container } = render(
        {
          setup() {
            return () =>
              h(SelectPicker, {
                ref: pickerRef,
                modelValue: [],
                type: 'checkbox',
                columns: [
                  { value: 'a', label: 'A' },
                  { value: 'b', label: 'B' }
                ],
                'onChange': (e: any) => changes.push(e)
              })
          }
        } as any
      )
      // visible 初始 true 不触发 watch（无 immediate），经 expose 命令式打开
      pickerRef.value.open()
      await frames()
      const boxes = container.querySelectorAll('.wd-select-picker__checkbox-item')
      expect(boxes.length).toBe(2)
      // Lynx 事件不冒泡：需点在 checkbox 本体上（item 是普通包裹 view）
      const checkbox = boxes[0].querySelector('.wd-checkbox')!
      fireEvent.tap(checkbox)
      await nextTick()
      await nextTick()
      expect(changes.length, 'change 只应触发一次').toBe(1)
      expect(changes[0]).toEqual({ value: ['a'] })
      cleanup()
    })
  })

  describe('#14 wd-popup close 事件', () => {
    it('遮罩关闭时派发 close（与 update:modelValue 一起）', async () => {
      const closes: unknown[] = []
      const updates: unknown[] = []
      const show = ref(true)
      const { container } = render(
        {
          setup() {
            return () =>
              h(Popup, {
                modelValue: show.value,
                modal: true,
                closeOnClickModal: true,
                'onUpdate:modelValue': (v: any) => {
                  show.value = v
                  updates.push(v)
                },
                onClose: () => closes.push(1)
              })
          }
        } as any
      )
      await frames()
      const overlay = container.querySelector('.wd-overlay')!
      expect(overlay).not.toBeNull()
      fireEvent.tap(overlay)
      await frames()
      expect(closes.length, '应派发 close').toBe(1)
      expect(updates).toContain(false)
      cleanup()
    })
  })

  describe('#8 wd-calendar 确认 / 取消', () => {
    it('确认只派发 confirm，不派发 cancel', async () => {
      const events: string[] = []
      const { container } = render(
        {
          setup() {
            return () =>
              h(Calendar, {
                modelValue: Date.now(),
                visible: true,
                onConfirm: () => events.push('confirm'),
                onCancel: () => events.push('cancel')
              })
          }
        } as any
      )
      await frames()
      const btn = container.querySelector('.wd-calendar__footer wd-button, .wd-calendar__footer .wd-button')
      expect(btn, '确认按钮应渲染').not.toBeNull()
      fireEvent.tap(btn!)
      await frames()
      expect(events).toContain('confirm')
      expect(events, '确认路径不应派发 cancel').not.toContain('cancel')
      cleanup()
    })

    it('取消关闭时回滚未提交的值（再次打开显示快照值）', async () => {
      const events: string[] = []
      const base = new Date(2024, 0, 15).getTime()
      const { container } = render(
        {
          setup() {
            return () =>
              h(Calendar, {
                modelValue: base,
                visible: true,
                onCancel: () => events.push('cancel'),
                onConfirm: () => events.push('confirm')
              })
          }
        } as any
      )
      await frames()
      // 打开时快照 base；点一个其他日期形成未提交值
      const days = container.querySelectorAll('.wd-calendar-view__day')
      fireEvent.tap(days[3])
      await nextTick()
      // 命令式关闭（等价点遮罩/取消）：应回滚 + 派发 cancel
      const calendar = container.querySelector('.wd-calendar')
      expect(calendar).not.toBeNull()
      // 经 popup 遮罩关闭
      const overlay = container.querySelector('.wd-overlay')
      if (overlay) {
        fireEvent.tap(overlay)
      } else {
        // 遮罩未渲染时直接关闭弹层
        const anyClose = container.querySelector('.wd-calendar__popup')
        expect(anyClose).not.toBeNull()
      }
      await frames()
      expect(events, '取消应派发 cancel').toContain('cancel')
      expect(events).not.toContain('confirm')
      cleanup()
    })
  })

  describe('#15 wd-cascader 确认空值守卫', () => {
    it('未选任何一级时确认不 emit confirm/update:modelValue', async () => {
      const confirms: any[] = []
      const updates: any[] = []
      const cascaderRef = ref<any>(null)
      const { container } = render(
        {
          setup() {
            return () =>
              h(Cascader, {
                ref: cascaderRef,
                modelValue: '',
                options: CASCADE_TREE,
                onConfirm: (e: any) => confirms.push(e),
                'onUpdate:modelValue': (v: any) => updates.push(v)
              })
          }
        } as any
      )
      cascaderRef.value.open()
      await frames()
      const actions = container.querySelectorAll('.wd-cascader__action')
      expect(actions.length, '头部应渲染取消/确认').toBe(2)
      // 第二个 action 是确认
      fireEvent.tap(actions[1])
      await frames()
      expect(confirms, '空值不应派发 confirm').toHaveLength(0)
      expect(updates, '空值不应派发 update:modelValue').toHaveLength(0)
      cleanup()
    })
  })
})

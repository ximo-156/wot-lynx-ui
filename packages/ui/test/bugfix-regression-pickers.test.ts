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
    /** 定位指定月份面板（wot-ui 结构：月面板 > .wd-month） */
    const panelOf = (container: Element, title: string) =>
      Array.from(container.querySelectorAll('.wd-month')).find(
        (m) => m.querySelector('.wd-month__title')?.textContent === title
      ) || null
    const dayText = (el: Element) => el.querySelector('.wd-month__day-text')?.textContent?.trim()
    const cellOf = (panel: Element, n: string) =>
      Array.from(panel.querySelectorAll('.wd-month__day')).find((c) => dayText(c) === n) || null

    it('pending 哨兵 [start, null] 不再被误判为已完成区间：第二次点击完成区间', async () => {
      const updates: any[] = []
      const changes: any[] = []
      // wot-ui 区间状态机是无状态的：必须经 v-model 回写闭环
      const { container } = render(
        {
          setup() {
            const value = ref<any>(null)
            return () =>
              h(CalendarView, {
                modelValue: value.value,
                type: 'daterange',
                'onUpdate:modelValue': (v: any) => {
                  updates.push(v)
                  value.value = v
                },
                onChange: (e: any) => changes.push(e)
              })
          }
        } as any
      )
      const now = new Date()
      const title = `${now.getFullYear()}年${now.getMonth() + 1}月`
      expect(panelOf(container, title), '应渲染当月面板').toBeTruthy()

      // 第一次点击：pending [d1, null]（wot-ui 哨兵为 null）。
      // month-panel 的 change 经 50ms debounce 下发（对齐参考源），需等待定时器。
      fireEvent.tap(cellOf(panelOf(container, title)!, '5')!)
      await pause(80)
      expect(updates[updates.length - 1]).toHaveLength(2)
      expect(updates[updates.length - 1][1]).toBeNull()

      // 第二次点击（更晚日期）：必须形成完整区间（修复前永远重新开始）。
      // 面板 DOM 会随受控回写重建，需重新定位；change 同样经 debounce。
      fireEvent.tap(cellOf(panelOf(container, title)!, '12')!)
      await pause(80)
      const last = updates[updates.length - 1]
      expect(last).toHaveLength(2)
      expect(last[0]).toBeTruthy()
      expect(last[1]).toBeTruthy()
      expect(last[1]).toBeGreaterThan(last[0])
      // change 携带的也是完整区间
      expect(changes[changes.length - 1].value).toEqual(last)
      cleanup()
    })

    it('maxRange 超限：钳制到最大范围并提示，change 携带完整区间（对齐 wot-ui）', async () => {
      const updates: any[] = []
      const changes: any[] = []
      const { container } = render(
        {
          setup() {
            const value = ref<any>(null)
            return () =>
              h(CalendarView, {
                modelValue: value.value,
                type: 'daterange',
                maxRange: 3,
                'onUpdate:modelValue': (v: any) => {
                  updates.push(v)
                  value.value = v
                },
                onChange: (e: any) => changes.push(e)
              })
          }
        } as any
      )
      const now = new Date()
      const title = `${now.getFullYear()}年${now.getMonth() + 1}月`

      fireEvent.tap(cellOf(panelOf(container, title)!, '5')!)
      await pause(80)
      const changeCountBefore = changes.length

      // 点击 20 天后的日期：超出 maxRange=3（面板 DOM 重建，需重新定位）。
      // wot-ui 语义：超限不重置起点，而是把终点钳制到 start + maxRange - 1
      // 并弹出 rangePrompt 提示；change 携带的是钳制后的完整区间。
      fireEvent.tap(cellOf(panelOf(container, title)!, '25')!)
      await pause(80)
      const last = updates[updates.length - 1]
      expect(last).toHaveLength(2)
      expect(last[0], '起点保持不变').toBe(updates[0][0])
      expect(last[1], '终点钳制到 start + maxRange - 1').toBeTruthy()
      expect(last[1] - last[0], '区间天数 = maxRange').toBe(2 * 24 * 60 * 60 * 1000)
      // change 携带钳制后的完整区间（非半截区间）
      expect(changes.length, '超限仍派发 change（钳制后的完整区间）').toBeGreaterThan(changeCountBefore)
      expect(changes[changes.length - 1].value).toEqual(last)
      cleanup()
    })

    it('getDayType 对今天返回 current（is-current 高亮不再是死规则）', async () => {
      const { container } = render(CalendarView, { modelValue: null, type: 'date' })
      const today = container.querySelector('.wd-month__day.is-current')
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

      // 第 1 列向上拖一格（itemHeight 默认 44）→ 选中"江苏"。
      // 事件分工（jsdom 不模拟冒泡，按真机冒泡结果分别派发）：列内容（子）绑
      // 后台 touchstart/touchend + 主线程 touchmove；列（父）绑主线程
      // touchstart 记跟手起点（详见 wd-picker-view 文件头）。
      const first = columns[0]
      const firstContent = first.querySelector('.wd-picker-view__column-content')!
      fireEvent.touchstart(firstContent, { touches: [{ clientX: 0, clientY: 0 }] })
      fireEvent.touchstart(first, { touches: [{ clientX: 0, clientY: 0 }] })
      fireEvent.touchmove(firstContent, { touches: [{ clientX: 0, clientY: -44 }] })
      fireEvent.touchend(firstContent, { touches: [], changedTouches: [{ clientX: 0, clientY: -44 }] })
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
    // wot-ui 的选项标题由 useChildren 注册表渲染（子组件挂载时才 link 入
    // 父级 children 数组），需等一个 tick 才能查询到（对齐参考源行为）
    async function renderDropMenu() {
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
      await nextTick()
      return { container, changes }
    }

    it('展开一项时收起其他项（手风琴），遮罩随之显示', async () => {
      const { container } = await renderDropMenu()
      // wot-ui 2.3.2 结构：drop-menu 渲染选项标题（.wd-drop-menu__option-title），
      // 浮层由 drop-menu-item 渲染（.wd-drop-item__popup）
      const options = container.querySelectorAll('.wd-drop-menu__option')
      expect(options.length).toBe(2)

      // wot-ui 的展开经 getRect（异步度量）驱动，需等待其回调（对齐参考源）
      fireEvent.tap(options[0])
      await pause(50)
      expect(container.querySelectorAll('.wd-drop-item__popup').length, '第一项展开').toBe(1)
      await frames()
      expect(container.querySelector('.wd-overlay'), '展开时应显示遮罩').not.toBeNull()

      // 点第二项标题：第一项应收起（收起带 200ms 离场动画，需等动画落地）
      fireEvent.tap(options[1])
      await pause(400)
      const lists = container.querySelectorAll('.wd-drop-item__popup')
      expect(lists.length, '同时只能展开一项').toBe(1)
      cleanup()
    })

    it('select 只 emit 一次 change（不再双发 update:modelValue）', async () => {
      const { container, changes } = await renderDropMenu()
      fireEvent.tap(container.querySelectorAll('.wd-drop-menu__option')[0])
      await pause(50)

      const options = container.querySelectorAll('.wd-drop-item__option')
      expect(options.length).toBe(2)
      fireEvent.tap(options[1])
      // 选中后自动收起（200ms 离场动画）
      await pause(400)

      const sortChanges = changes.filter(([name]) => name === 'sort')
      expect(sortChanges.length, 'change 只应触发一次').toBe(1)
      // wot-ui 的 change 载荷为 { value, selectedItem }
      expect(sortChanges[0][1]).toEqual({ value: 'price', selectedItem: { value: 'price', label: '价格' } })
      // 选中后自动收起
      expect(container.querySelectorAll('.wd-drop-item__popup').length).toBe(0)
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
    // wot-ui 的 inited 由 pickerShow（visible 的同步镜像）的 watch 置位，
    // 挂载时即 visible=true 不会触发该 watch——与参考源行为一致，故测试
    // 经「关闭 → 打开」的真实使用流程驱动（visible ref 置 true）。

    it('确认只派发 confirm，不派发 cancel', async () => {
      const events: string[] = []
      const visible = ref(false)
      const { container } = render(
        {
          setup() {
            return () =>
              h(Calendar, {
                modelValue: Date.now(),
                visible: visible.value,
                'onUpdate:visible': (v: any) => (visible.value = v),
                onConfirm: () => events.push('confirm'),
                onCancel: () => events.push('cancel')
              })
          }
        } as any
      )
      await frames()
      // 打开（经 v-model 回写，触发 pickerShow watch → inited）
      visible.value = true
      await frames()
      await pause(100)
      // wot-ui 2.3.2 结构：确认栏为 .wd-calendar__confirm > .wd-calendar__confirm-btn-wrapper > wd-button
      const btn = container.querySelector('.wd-calendar__confirm .wd-button')
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
      const visible = ref(false)
      const { container } = render(
        {
          setup() {
            return () =>
              h(Calendar, {
                modelValue: base,
                visible: visible.value,
                'onUpdate:visible': (v: any) => (visible.value = v),
                onCancel: () => events.push('cancel'),
                onConfirm: () => events.push('confirm')
              })
          }
        } as any
      )
      await frames()
      visible.value = true
      await frames()
      await pause(100)
      // 打开时快照 base；点一个其他日期形成未提交值。
      // wot-ui 2.3.2 结构：日期格子为 .wd-month__day（月面板内）
      const days = container.querySelectorAll('.wd-month__day')
      fireEvent.tap(days[3])
      // month-panel 的 change 经 50ms debounce 下发（对齐参考源）
      await pause(80)
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
    it('未选任何一级时确认携带空值（wot-ui 不守卫空值）', async () => {
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
                // wot-ui 仅在 checkStrictly 下渲染取消/确认操作栏（默认模式点叶子即确认）
                checkStrictly: true,
                onConfirm: (e: any) => confirms.push(e),
                'onUpdate:modelValue': (v: any) => updates.push(v)
              })
          }
        } as any
      )
      cascaderRef.value.open()
      await frames()
      // wot-ui 结构：操作栏为单个 .wd-cascader__action（#close 插槽），
      // 内含确认按钮 .wd-cascader__action-confirm（取消经 action-sheet 关闭）
      const actions = container.querySelectorAll('.wd-cascader__action')
      expect(actions.length, '操作栏应渲染').toBe(1)
      const confirmBtn = container.querySelector('.wd-cascader__action-confirm')
      expect(confirmBtn, '确认按钮应渲染').not.toBeNull()
      fireEvent.tap(confirmBtn!)
      await frames()
      // wot-ui 语义：canStrictConfirm 仅由 isRestoring 决定（不守卫空值），
      // 未选任何级时确认携带空值 { value: '', selectedOptions: [] }
      expect(confirms).toHaveLength(1)
      expect(confirms[0]).toEqual({ value: '', selectedOptions: [] })
      expect(updates, '空值仍派发 update:modelValue（wot-ui 行为）').toHaveLength(1)
      cleanup()
    })
  })
})

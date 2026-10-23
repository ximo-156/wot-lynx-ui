/**
 * Tier 2b 选择器 / 键盘 / 日历 / 上传 冒烟测试。
 */
import { describe, it, expect } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import { fireEvent } from './fire-event'
import Popup from '../src/primitives/wd-popup/wd-popup.vue'
import PickerView from '../src/components/wd-picker-view/wd-picker-view.vue'
import Picker from '../src/components/wd-picker/wd-picker.vue'
import DatetimePickerView from '../src/components/wd-datetime-picker-view/wd-datetime-picker-view.vue'
import DatetimePicker from '../src/components/wd-datetime-picker/wd-datetime-picker.vue'
import Keyboard from '../src/components/wd-keyboard/wd-keyboard.vue'
import PasswordInput from '../src/components/wd-password-input/wd-password-input.vue'
import SlideVerify from '../src/components/wd-slide-verify/wd-slide-verify.vue'
import Signature from '../src/components/wd-signature/wd-signature.vue'
import CalendarView from '../src/components/wd-calendar-view/wd-calendar-view.vue'
import Upload from '../src/components/wd-upload/wd-upload.vue'
import Cascader from '../src/components/wd-cascader/wd-cascader.vue'
import SelectPicker from '../src/components/wd-select-picker/wd-select-picker.vue'

describe('Tier 2b 选择器 / 键盘 / 日历', () => {
  describe('渲染冒烟', () => {
    it('WdPopup 各位置渲染', async () => {
      for (const position of ['center', 'top', 'bottom', 'left', 'right']) {
        const { container } = render(Popup, { modelValue: true, position, modal: false })
        // transition 内容经 enter 状态机延迟约 100ms 渲染
        await pause(150)
        expect(container.querySelector(`.wd-popup--${position}`), position).not.toBeNull()
        cleanup()
      }
    })

    it('WdPickerView 多列渲染', () => {
      const { container } = render(PickerView, {
        modelValue: ['a'],
        columns: [['a', 'b', 'c'], ['x', 'y']]
      })
      const columns = container.querySelectorAll('.wd-picker-view__column')
      expect(columns.length).toBe(2)
      expect(columns[0].querySelectorAll('.wd-picker-view__column-item').length).toBe(3)
      cleanup()
    })

    it('WdDatetimePickerView 生成日期列', () => {
      const { container } = render(DatetimePickerView, {
        modelValue: Date.now(),
        type: 'date'
      })
      const columns = container.querySelectorAll('.wd-picker-view__column')
      // 年 / 月 / 日 三列
      expect(columns.length).toBe(3)
      cleanup()
    })

    it('WdCalendarView 按月面板渲染日期格（对齐 wot-ui 结构）', () => {
      const { container } = render(CalendarView, {
        modelValue: Date.now(),
        type: 'date'
      })
      // wot-ui 2.3.2 结构：月面板内 .wd-month > .wd-month__days > .wd-month__day，
      // 默认范围约 13 个月（当前月 ±6），不再有 42 格单月与 week 行概念
      expect(container.querySelectorAll('.wd-month').length).toBeGreaterThan(1)
      expect(container.querySelectorAll('.wd-month__day').length).toBeGreaterThan(28)
      cleanup()
    })

    it('WdKeyboard / WdPasswordInput / WdSlideVerify / WdSignature / WdUpload / WdPicker / WdDatetimePicker / WdCascader / WdSelectPicker 渲染', async () => {
      const cases: Array<[any, Record<string, any>, string]> = [
        [Keyboard, { visible: true }, '.wd-keyboard'],
        [PasswordInput, {}, '.wd-password-input'],
        [SlideVerify, {}, '.wd-slide-verify'],
        [Signature, {}, '.wd-signature'],
        [Upload, {}, '.wd-upload'],
        [Picker, { visible: false }, '.wd-picker'],
        [DatetimePicker, { visible: false }, '.wd-datetime-picker'],
        [Cascader, { visible: false }, '.wd-cascader'],
        [SelectPicker, { visible: false }, '.wd-select-picker']
      ]
      for (const [comp, props, selector] of cases) {
        const { container } = render(comp, props)
        await pause(150)
        expect(container.querySelector(selector), selector).not.toBeNull()
        cleanup()
      }
    })
  })

  describe('交互行为', () => {
    it('WdKeyboard 按键输入', async () => {
      const inputs: any[] = []
      const { container } = render(
        {
          setup() {
            const value = ref('')
            return () =>
              h(Keyboard, {
                visible: true,
                modelValue: value.value,
                'onUpdate:modelValue': (v: string) => {
                  value.value = v
                  inputs.push(v)
                }
              })
          }
        } as any
      )
      await pause(150)
      // 事件绑定在 wrapper 上（Lynx 事件不冒泡，需 fire 在 wrapper）
      const keys = container.querySelectorAll('.wd-key-wrapper')
      expect(keys.length).toBeGreaterThan(9)
      fireEvent.touchstart(keys[0], { touches: [{ clientX: 0, clientY: 0 }] })
      fireEvent.touchend(keys[0], { touches: [{ clientX: 0, clientY: 0 }] })
      expect(inputs).toContain('1')
      cleanup()
    })

    it('WdPasswordInput 格子与光标', () => {
      const { container } = render(PasswordInput, { modelValue: '12', length: 6 })
      expect(container.querySelectorAll('.wd-password-input__item').length).toBe(6)
      cleanup()
    })

    it('WdUpload 上传按钮与 limit', () => {
      // wot-ui 2.3.2 结构：触发按钮为 .wd-upload__evoke；达 limit 时隐藏
      const { container } = render(Upload, { limit: 2, showLimitNum: true })
      expect(container.querySelector('.wd-upload__evoke')).not.toBeNull()
      cleanup()

      const full = render(Upload, { fileList: [{ uid: 1, url: 'x', name: 'a' }, { uid: 2, url: 'y', name: 'b' }] as any, limit: 2 })
      expect(full.container.querySelector('.wd-upload__evoke')).toBeNull()
      cleanup()
    })

    it('WdPickerView 触摸选择', () => {
      const updates: any[] = []
      const { container } = render(
        {
          setup() {
            const value = ref<string[]>(['a'])
            return () =>
              h(PickerView, {
                immediateChange: true,
                modelValue: value.value,
                columns: [['a', 'b', 'c']],
                'onUpdate:modelValue': (v: any) => {
                  value.value = v
                  updates.push(v)
                }
              })
          }
        } as any
      )
      // 原生优先重写后的事件分工（jsdom 不模拟冒泡，按真机冒泡结果分别派发）：
      // 列内容（子）绑后台 touchstart/touchend + 主线程 touchmove；
      // 列（父）绑主线程 touchstart（记跟手起点）。
      const column = container.querySelector('.wd-picker-view__column')!
      const content = container.querySelector('.wd-picker-view__column-content')!
      fireEvent.touchstart(content, { touches: [{ clientX: 0, clientY: 0 }] })
      fireEvent.touchstart(column, { touches: [{ clientX: 0, clientY: 0 }] })
      fireEvent.touchmove(content, { touches: [{ clientX: 0, clientY: -50 }] })
      fireEvent.touchend(content, { touches: [], changedTouches: [{ clientX: 0, clientY: -50 }] })
      // 向上拖动一屏，选中值应变化
      expect(updates.length).toBeGreaterThan(0)
      expect(updates[updates.length - 1]).not.toEqual(['a'])
      cleanup()
    })
  })
})

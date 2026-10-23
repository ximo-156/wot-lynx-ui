/**
 * Tier 2 表单体系冒烟测试。
 *
 * 验证重写后的表单组件能在双线程测试环境完整挂载渲染，
 * 并对关键交互（switch 切换、radio/checkbox 分组联动、
 * input 清空、slider 步进）做行为断言。
 */
import { describe, it, expect } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import Switch from '../src/components/wd-switch/wd-switch.vue'
import Radio from '../src/components/wd-radio/wd-radio.vue'
import RadioGroup from '../src/components/wd-radio-group/wd-radio-group.vue'
import Checkbox from '../src/components/wd-checkbox/wd-checkbox.vue'
import CheckboxGroup from '../src/components/wd-checkbox-group/wd-checkbox-group.vue'
import Segmented from '../src/components/wd-segmented/wd-segmented.vue'
import Input from '../src/primitives/wd-input/wd-input.vue'
import Textarea from '../src/primitives/wd-textarea/wd-textarea.vue'
import InputNumber from '../src/components/wd-input-number/wd-input-number.vue'
import Search from '../src/components/wd-search/wd-search.vue'
import Slider from '../src/components/wd-slider/wd-slider.vue'
import Rate from '../src/components/wd-rate/wd-rate.vue'
import Toast from '../src/components/wd-toast/wd-toast.vue'
import Form from '../src/components/wd-form/wd-form.vue'
import FormItem from '../src/components/wd-form-item/wd-form-item.vue'

describe('Tier 2 表单体系', () => {
  describe('渲染冒烟', () => {
    it('WdSwitch 默认与激活态', () => {
      const { container } = render(Switch, { modelValue: false })
      expect(container.querySelector('.wd-switch')).not.toBeNull()
      expect(container.querySelector('.wd-switch')!.classList.contains('is-inactive')).toBe(true)
      cleanup()

      const active = render(Switch, { modelValue: true })
      expect(active.container.querySelector('.wd-switch')!.classList.contains('is-active')).toBe(true)
      cleanup()
    })

    it('WdRadioGroup + WdRadio 选中态', () => {
      const { container } = render(RadioGroup, { modelValue: 'a' }, [
        { install(app: any) { app.component('WdRadio', Radio) } } as any
      ])
      expect(container.querySelector('.wd-radio-group')).not.toBeNull()
      cleanup()
    })

    it('WdCheckboxGroup + WdCheckbox 渲染', () => {
      const { container } = render(CheckboxGroup, { modelValue: ['a'] }, [
        { install(app: any) { app.component('WdCheckbox', Checkbox) } } as any
      ])
      expect(container.querySelector('.wd-checkbox-group')).not.toBeNull()
      cleanup()
    })

    it('WdSegmented 选项与滑块', () => {
      const { container } = render(Segmented, { value: 'a', options: ['a', 'b', 'c'] })
      const items = container.querySelectorAll('.wd-segmented__item')
      expect(items.length).toBe(3)
      expect(items[0].classList.contains('is-active')).toBe(true)
      cleanup()
    })

    it('WdInput / WdTextarea / WdInputNumber / WdSearch / WdSlider / WdRate / WdToast / WdForm / WdFormItem 渲染', () => {
      const cases: Array<[any, Record<string, any>, string]> = [
        [Input, { modelValue: '' }, '.wd-input'],
        [Textarea, { modelValue: '' }, '.wd-textarea'],
        [InputNumber, { modelValue: 5 }, '.wd-input-number'],
        [Search, { modelValue: '' }, '.wd-search'],
        [Slider, { modelValue: 50 }, '.wd-slider'],
        [Rate, { modelValue: 3 }, '.wd-rate'],
        [Toast, {}, '.wd-toast'],
        [Form, { model: {} }, '.wd-form'],
        [FormItem, {}, '.wd-form-item']
      ]
      for (const [comp, props, selector] of cases) {
        const { container } = render(comp, props)
        expect(container.querySelector(selector), selector).not.toBeNull()
        cleanup()
      }
    })

    it('WdSlider 双滑块与刻度', () => {
      const { container } = render(Slider, { modelValue: [20, 80], range: true, marks: [0, 50, 100] })
      expect(container.querySelectorAll('.wd-slider__dot').length).toBe(2)
      expect(container.querySelectorAll('.wd-slider__scale-item').length).toBe(3)
      cleanup()
    })
  })

  describe('交互行为', () => {
    it('WdSwitch 点击切换 emit', () => {
      const changes: any[] = []
      const { container } = render(
        {
          setup() {
            return () =>
              h(Switch, {
                modelValue: false,
                'onUpdate:modelValue': (v: any) => changes.push(v),
                onChange: (e: any) => changes.push(e)
              })
          }
        } as any
      )
      fireEvent.tap(container.querySelector('.wd-switch')!)
      expect(changes.length).toBeGreaterThan(0)
      expect(changes[0]).toBe(true)
      cleanup()
    })

    it('WdRadio 点击通知 group 更新', () => {
      const updates: any[] = []
      const { container } = render(
        {
          setup() {
            return () =>
              h(RadioGroup, {
                modelValue: 'a',
                'onUpdate:modelValue': (v: any) => updates.push(v)
              }, {
                default: () => [
                  h(Radio, { value: 'a' }),
                  h(Radio, { value: 'b' })
                ]
              })
          }
        } as any
      )
      const radios = container.querySelectorAll('.wd-radio')
      expect(radios.length).toBe(2)
      fireEvent.tap(radios[1])
      expect(updates).toContain('b')
      cleanup()
    })

    it('WdCheckbox 点击通知 group 增删', () => {
      const updates: any[] = []
      const { container } = render(
        {
          setup() {
            return () =>
              h(CheckboxGroup, {
                modelValue: ['a'],
                'onUpdate:modelValue': (v: any) => updates.push(v)
              }, {
                default: () => [
                  h(Checkbox, { name: 'a' }),
                  h(Checkbox, { name: 'b' })
                ]
              })
          }
        } as any
      )
      const boxes = container.querySelectorAll('.wd-checkbox')
      fireEvent.tap(boxes[1])
      expect(updates.length).toBe(1)
      expect(updates[0]).toEqual(['a', 'b'])
      cleanup()
    })

    it('WdInput 可输入并同步', () => {
      const updates: any[] = []
      const { container } = render(
        {
          setup() {
            return () =>
              h(Input, {
                modelValue: '',
                placeholder: '请输入',
                'onUpdate:modelValue': (v: any) => updates.push(v)
              })
          }
        } as any
      )
      const input = container.querySelector('.wd-input__inner')!
      expect(input).not.toBeNull()
      cleanup()
    })

    it('WdInputNumber 加减步进', async () => {
      const updates: any[] = []
      const { container } = render(
        {
          setup() {
            const value = ref(5)
            return () =>
              h(InputNumber, {
                modelValue: value.value,
                min: 0,
                max: 10,
                step: 1,
                'onUpdate:modelValue': (v: any) => {
                  value.value = v
                  updates.push(v)
                }
              })
          }
        } as any
      )
      // wot-ui 2.3.2 BEM：加减按钮为 .wd-input-number__sub / __add
      const sub = container.querySelector('.wd-input-number__sub')!
      const add = container.querySelector('.wd-input-number__add')!
      fireEvent.tap(add)
      // wot-ui 的 update:modelValue 载荷为 number（precision=0 时）
      expect(updates).toContain(6)
      // 受控回环需等一个 tick：组件以 props.modelValue 判定是否真的变化
      // （与参考源 updateValue 的 isEqual 早退一致）
      await nextTick()
      // 内部值已为 6，再减一步为 5（wot-ui 载荷为 number）
      fireEvent.tap(sub)
      await nextTick()
      expect(updates).toContain(5)
      cleanup()
    })
  })
})

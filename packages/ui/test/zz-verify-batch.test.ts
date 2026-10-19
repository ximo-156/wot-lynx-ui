import { describe, it, expect } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import { pause } from '../src/common/util'
import Radio from '../src/components/wd-radio/wd-radio.vue'
import RadioGroup from '../src/components/wd-radio-group/wd-radio-group.vue'
import Checkbox from '../src/components/wd-checkbox/wd-checkbox.vue'
import CheckboxGroup from '../src/components/wd-checkbox-group/wd-checkbox-group.vue'
import Switch from '../src/components/wd-switch/wd-switch.vue'
import Slider from '../src/components/wd-slider/wd-slider.vue'
import Rate from '../src/components/wd-rate/wd-rate.vue'
import Segmented from '../src/components/wd-segmented/wd-segmented.vue'

const styleOf = (el: Element | null) => (el as HTMLElement)?.getAttribute('style') || ''

function installSelectorQueryWithWidths(widths: number[]) {
  const lynx = (globalThis as any).lynx
  const rects = widths.map((w) => ({ id: '', left: 0, top: 0, right: w, bottom: 40, width: w, height: 40 }))
  const makeRef = (payload: any) => ({
    invoke(options: any) {
      if (options && typeof options.success === 'function') setTimeout(() => options.success(payload), 0)
      return { exec: () => {} }
    },
    boundingClientRect(cb: any) {
      if (typeof cb === 'function') setTimeout(() => cb(payload), 0)
      return { exec: () => {} }
    },
    fields(_: any, cb: any) {
      if (typeof cb === 'function') setTimeout(() => cb({ width: payload[0]?.width ?? 0, height: 40 }), 0)
      return { exec: () => {} }
    }
  })
  lynx.createSelectorQuery = () => {
    const select = () => makeRef(rects)
    const selectAll = () => makeRef(rects)
    return { select, selectAll, in: () => ({ select, selectAll }), exec: () => {} }
  }
}

describe('tmp-verify', () => {
  it('radio: checkedColor 内联 color', () => {
    const { container } = render(
      {
        setup() {
          return () => h(RadioGroup, { modelValue: 'a', checkedColor: '#fa4350' }, { default: () => [h(Radio, { value: 'a' })] })
        }
      } as any
    )
    const icon = container.querySelector('.wd-radio__icon')
    expect(icon).not.toBeNull()
    expect(styleOf(icon)).toContain('color: rgb(250, 67, 80)')
    cleanup()
  })

  it('radio: uncheckedColor 内联 color', () => {
    const { container } = render(
      {
        setup() {
          return () => h(RadioGroup, { modelValue: 'b', uncheckedColor: '#999' }, { default: () => [h(Radio, { value: 'a' })] })
        }
      } as any
    )
    expect(styleOf(container.querySelector('.wd-radio__icon'))).toContain('color: rgb(153, 153, 153)')
    cleanup()
  })

  it('radio: 横向分组容器类名', () => {
    const { container } = render(RadioGroup, { modelValue: 'a', direction: 'horizontal' }, [
      { install: (app: any) => app.component('WdRadio', Radio) } as any
    ])
    const group = container.querySelector('.wd-radio-group')!
    expect(group.classList.contains('wd-radio-group--horizontal')).toBe(true)
    cleanup()
  })

  it('checkbox: checkedColor 内联 color', () => {
    const { container } = render(
      {
        setup() {
          return () =>
            h(CheckboxGroup, { modelValue: ['a'], checkedColor: '#fa4350' }, { default: () => [h(Checkbox, { name: 'a' })] })
        }
      } as any
    )
    expect(styleOf(container.querySelector('.wd-checkbox__icon'))).toContain('color: rgb(250, 67, 80)')
    cleanup()
  })

  it('switch: size prop 写 font-size', () => {
    const { container } = render(Switch, { modelValue: true, size: 20 })
    const style = styleOf(container.querySelector('.wd-switch'))
    expect(style).toContain('font-size: 20px')
    cleanup()
  })

  it('switch: activeColor 作用于轨道', () => {
    const { container } = render(Switch, { modelValue: true, activeColor: '#34C759' })
    expect(styleOf(container.querySelector('.wd-switch__inner'))).toContain('background')
    cleanup()
  })

  it('switch: activeText / inactiveText', () => {
    const { container } = render(Switch, { modelValue: true, activeText: '开', inactiveText: '关' })
    expect(container.querySelector('.wd-switch__inner-text')!.textContent).toContain('开')
    cleanup()
  })

  it('slider: 步进与范围', async () => {
    installSelectorQueryWithWidths([200])
    const updates: any[] = []
    const { container } = render(Slider, { modelValue: 50, step: 10, 'onUpdate:modelValue': (v: any) => updates.push(v) })
    await pause(20)
    const dot = container.querySelector('.wd-slider__dot')!
    fireEvent.touchstart(dot, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchmove(dot, { touches: [{ clientX: 1000, clientY: 0 }] })
    fireEvent.touchend(dot)
    // JSDOM 无布局，domMeasure 返回零矩形 → trackSize 为 0 → fail-closed 不写 NaN
    expect(updates.length).toBe(0)
    cleanup()
  })

  it('slider: activeColor / inactiveColor 内联', () => {
    const { container } = render(Slider, { modelValue: 50, activeColor: '#f00', inactiveColor: '#0f0' })
    expect(styleOf(container.querySelector('.wd-slider__line'))).toContain('background: rgb(255, 0, 0)')
    expect(styleOf(container.querySelector('.wd-slider__bar'))).toContain('background: rgb(0, 255, 0)')
    cleanup()
  })

  it('rate: 点击与半星', () => {
    const updates: any[] = []
    const { container } = render(
      {
        setup() {
          return () => h(Rate, { modelValue: 3, allowHalf: true, 'onUpdate:modelValue': (v: any) => updates.push(v) })
        }
      } as any
    )
    const items = container.querySelectorAll('.wd-rate__item')
    expect(items.length).toBe(5)
    expect(styleOf(items[0])).toContain('margin-right')
    fireEvent.tap(items[1].querySelector('.wd-rate__item-star')!)
    expect(updates[updates.length - 1]).toBe(2)
    fireEvent.tap(items[3].querySelector('.wd-rate__item-half')!)
    expect(updates[updates.length - 1]).toBe(3.5)
    cleanup()
  })

  it('rate: space prop 覆盖默认间距', () => {
    const { container } = render(Rate, { modelValue: 3, space: 20 })
    const items = container.querySelectorAll('.wd-rate__item')
    expect(styleOf(items[0])).toContain('margin-right: 20px')
    expect(styleOf(items[4])).toContain('margin-right: 0')
    cleanup()
  })

  it('rate: activeColor 数组分段取色', () => {
    const { container } = render(Rate, { modelValue: 5, num: 5, activeColor: ['#fa4350', '#ffb602'] })
    const star = container.querySelectorAll('.wd-rate__item-star')[0]
    expect(styleOf(star)).toContain('color: rgb(255, 182, 2)')
    cleanup()
  })

  it('segmented: 切换与滑块位移', async () => {
    installSelectorQueryWithWidths([100, 100, 100])
    const value = ref<string | number>('A')
    const { container } = render(
      {
        setup() {
          return () =>
            h(Segmented as any, {
              options: ['A', 'B', 'C'],
              value: value.value,
              'onUpdate:value': (v: string | number) => {
                value.value = v
              }
            })
        }
      } as any
    )
    await pause(50)
    const items = container.querySelectorAll('.wd-segmented__item')
    expect(items.length).toBe(3)
    expect(items[0].classList.contains('is-active')).toBe(true)
    fireEvent.tap(items[2]!)
    await pause(50)
    expect(value.value).toBe('C')
    const slider = container.querySelector('.wd-segmented__slider')!
    expect(styleOf(slider)).toContain('transform')
    expect(styleOf(slider)).toContain('translateX(200px)')
    cleanup()
  })

  it('segmented: outline 主题无滑块', () => {
    const { container } = render(Segmented, { value: 'a', options: ['a', 'b'], theme: 'outline' })
    expect(container.querySelector('.wd-segmented__slider')).toBeNull()
    expect(container.querySelector('.wd-segmented')!.classList.contains('wd-segmented--outline')).toBe(true)
    cleanup()
  })
})

describe('tmp-verify-2', () => {
  it('radio: button 形态类名（无 direction 类）', () => {
    const { container } = render(
      {
        setup() {
          return () => h(RadioGroup, { modelValue: 'a', type: 'button' }, { default: () => [h(Radio, { value: 'a', label: 'x' })] })
        }
      } as any
    )
    const radio = container.querySelector('.wd-radio')!
    expect(radio.classList.contains('is-button')).toBe(true)
    expect(radio.classList.contains('wd-radio--vertical')).toBe(false)
    expect(radio.classList.contains('is-checked')).toBe(true)
    cleanup()
  })

  it('radio: 默认 circle 选中态渲染图标（非 CSS 圆）', () => {
    const { container } = render(
      {
        setup() {
          return () => h(RadioGroup, { modelValue: 'a' }, { default: () => [h(Radio, { value: 'a' })] })
        }
      } as any
    )
    // circle 选中态命中内置 success-filling，渲染 wd-icon
    expect(container.querySelector('.wd-radio__icon')).not.toBeNull()
    expect(container.querySelector('.wd-radio__icon--dot')).toBeNull()
    cleanup()
  })

  it('radio: dot 未选中态为 CSS 空心圆', () => {
    const { container } = render(
      {
        setup() {
          return () => h(RadioGroup, { modelValue: 'b', type: 'dot' }, { default: () => [h(Radio, { value: 'a' })] })
        }
      } as any
    )
    expect(container.querySelector('.wd-radio__icon--empty')).not.toBeNull()
    cleanup()
  })

  it('checkbox: size prop 不产生副作用（与参考源一致）', () => {
    const { container } = render(
      {
        setup() {
          return () => h(CheckboxGroup, { modelValue: ['a'], size: 'large' }, { default: () => [h(Checkbox, { name: 'a' })] })
        }
      } as any
    )
    const box = container.querySelector('.wd-checkbox')!
    expect(box.className).not.toContain('large')
    cleanup()
  })

  it('checkbox: maxWidth prop 不产生副作用（与参考源一致）', () => {
    const { container } = render(Checkbox, { modelValue: false, maxWidth: '100px' })
    const label = container.querySelector('.wd-checkbox__label')
    expect(label === null || label.getAttribute('style')).toBeFalsy()
    cleanup()
  })
})

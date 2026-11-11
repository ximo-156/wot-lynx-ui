/** InputNumber 原生 blur 缺值与 falsy 值回归：双线程事件派发及受控 v-model。 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { useChildren } from '@wot-lynx/core/composables/useChildren'
import { FORM_ITEM_VALIDATE_KEY } from '@wot-lynx/core/composables/useFormItemValidate'
import InputNumber from '@wot-lynx/ui-form/wd-input-number'

afterEach(() => cleanup())

function mountInputNumber() {
  const value = ref<number | string>(12)
  const update = vi.fn((next: number | string) => { value.value = next })
  const change = vi.fn()
  const blur = vi.fn()
  const beforeChange = vi.fn(() => true)
  const validate = vi.fn(async () => {})
  const { container } = render({
    setup() {
      const { linkChildren } = useChildren(FORM_ITEM_VALIDATE_KEY)
      linkChildren({ shouldTrigger: () => true, validateByTrigger: validate })
      return () => h(InputNumber, {
        modelValue: value.value, min: 0, max: 100, allowNull: true, immediateChange: false,
        beforeChange, 'onUpdate:modelValue': update, onChange: change, onBlur: blur
      })
    }
  })
  const input = container.querySelector('.wd-input-number__input')!
  expect(input).not.toBeNull()
  return { input, value, update, change, blur, beforeChange, validate }
}

function expectBlurValidation(mounted: ReturnType<typeof mountInputNumber>, value: number | string) {
  expect(mounted.blur).toHaveBeenCalledExactlyOnceWith({ value })
  expect(mounted.validate).toHaveBeenCalledExactlyOnceWith('blur')
}

describe('InputNumber 原生 blur payload', () => {
  it('缺 detail 时提交当前未提交草稿，不抛错、不回退旧 modelValue', async () => {
    const mounted = mountInputNumber()
    fireEvent.input(mounted.input, { detail: { value: '27' } })
    await nextTick()
    expect(mounted.value.value).toBe(12)
    expect(mounted.input.getAttribute('value')).toBe('27')

    fireEvent.blur(mounted.input)
    await nextTick()
    expect(mounted.value.value).toBe(27)
    expect(mounted.update).toHaveBeenCalledExactlyOnceWith(27)
    expect(mounted.change).toHaveBeenCalledExactlyOnceWith({ value: 27 })
    expect(mounted.beforeChange).toHaveBeenCalledExactlyOnceWith(27)
    expect(mounted.input.getAttribute('value')).toBe('27')
    // blur 仍上报原始草稿 string；标准化 number 只用于 change/v-model。
    expectBlurValidation(mounted, '27')
  })

  it('detail 缺 value 时保留当前 number，未变化不误发 change，仍触发 blur 校验', async () => {
    const mounted = mountInputNumber()
    fireEvent.blur(mounted.input, { detail: {} })
    await nextTick()
    expect(mounted.value.value).toBe(12)
    expect(mounted.input.getAttribute('value')).toBe('12')
    expect(mounted.update).not.toHaveBeenCalled()
    expect(mounted.change).not.toHaveBeenCalled()
    expect(mounted.beforeChange).not.toHaveBeenCalled()
    expectBlurValidation(mounted, 12)
  })

  it('明确 number 0 不被当作空字符串，blur 保留 number 类型', async () => {
    const mounted = mountInputNumber()
    fireEvent.blur(mounted.input, { detail: { value: 0 } })
    await nextTick()
    expect(mounted.value.value).toBe(0)
    expect(mounted.input.getAttribute('value')).toBe('0')
    expect(mounted.update).toHaveBeenCalledExactlyOnceWith(0)
    expect(mounted.change).toHaveBeenCalledExactlyOnceWith({ value: 0 })
    expect(mounted.beforeChange).toHaveBeenCalledExactlyOnceWith(0)
    expectBlurValidation(mounted, 0)
  })

  it('明确空字符串仍清空 allowNull 输入，不回退当前数字', async () => {
    const mounted = mountInputNumber()
    fireEvent.blur(mounted.input, { detail: { value: '' } })
    await nextTick()
    expect(mounted.value.value).toBe('')
    expect(mounted.input.getAttribute('value')).toBe('')
    expect(mounted.update).toHaveBeenCalledExactlyOnceWith('')
    expect(mounted.change).toHaveBeenCalledExactlyOnceWith({ value: '' })
    expect(mounted.beforeChange).toHaveBeenCalledExactlyOnceWith('')
    expectBlurValidation(mounted, '')
  })
})

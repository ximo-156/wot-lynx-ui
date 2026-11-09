/**
 * Android 输入可编辑性回归：不能直接合成一个未经原生过滤的 input 事件就宣称可输入。
 * Lynx 4.0 setMaxLength 直接创建 Android LengthFilter(-1) 时会拒绝全部新增字符：
 * https://github.com/lynx-family/lynx/blob/4.0.0/platform/android/lynx_xelement/lynx_xelement_input/src/main/java/com/lynx/xelement/input/LynxUIBaseInput.kt
 * nativeText 独立于 DOM value，按下发属性过滤编辑；不模拟硬件命中、键盘显示及像素布局。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import { nativeRuntime } from '../helpers/native-stubs'
import Input from '../../src/primitives/wd-input/wd-input.vue'
import type { InputProps } from '../../src/primitives/wd-input/types'
import Form from '../../src/components/wd-form/wd-form.vue'
import FormItem from '../../src/components/wd-form-item/wd-form-item.vue'

const restores: Array<() => void> = []
beforeEach(() => vi.useFakeTimers())
afterEach(async () => {
  cleanup()
  await vi.advanceTimersByTimeAsync(200)
  restores.splice(0).reverse().forEach((restore) => restore())
  vi.clearAllTimers()
  vi.useRealTimers()
})
async function flush(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms)
  await nextTick()
  await nextTick()
}

type NativeInvocation = {
  method: string
  params?: { value?: string | number }
  success?: (result: Record<string, unknown>) => void
  fail?: (error: { code: number }) => void
}

function nativeEditor() {
  const runtime = nativeRuntime()
  const original = runtime.createSelectorQuery
  const doc: Document = (globalThis as any).lynxTestingEnv.jsdom.window.document
  const nativeText = new Map<Element, string>()
  const setValues: string[] = []
  // Android LengthFilter 处理 UTF-16，保留剩余长度；不能把 -1 在桩里也当作不限。
  function accepted(node: Element, inserted: string, retainedLength = 0) {
    const limit = Number(node.getAttribute('maxlength') ?? 2147483647)
    let keep = limit - retainedLength
    if (keep <= 0) return ''
    if (keep >= inserted.length) return inserted
    if (/^[\uD800-\uDBFF]$/.test(inserted.charAt(keep - 1))) keep--
    return inserted.slice(0, keep)
  }
  function changed(node: Element, value: string, isComposing = false) {
    nativeText.set(node, value)
    fireEvent.input(node, { detail: { value, isComposing, selectionStart: value.length, selectionEnd: value.length } })
  }
  runtime.createSelectorQuery = () => ({
    select: (selector: string) => ({
      invoke: (options: NativeInvocation) => ({
        exec: () => {
          const node = doc.querySelector(selector)
          if (!node) { options.fail?.({ code: 1 }); return }
          if (options.method === 'setValue') {
            const requested = String(options.params?.value ?? '')
            setValues.push(requested)
            // TextWatcher 的 input 回声先于 setValue success，符合 Android 通道。
            changed(node, accepted(node, requested))
          }
          options.success?.({})
        }
      })
    })
  })
  restores.push(() => { runtime.createSelectorQuery = original })
  return {
    setValues,
    text: (node: Element) => nativeText.get(node) || '',
    insert(node: Element, text: string, isComposing = false) {
      if (node.getAttribute('disabled') === 'true' || node.getAttribute('readonly') === 'true') return
      const before = nativeText.get(node) || ''
      const addition = accepted(node, text, before.length)
      if (addition) changed(node, before + addition, isComposing)
    }
  }
}

function mountInput(props: Partial<InputProps> = {}) {
  const model = ref('')
  const updates: string[] = []
  const clears: boolean[] = []
  const { container } = render(defineComponent(() => () => h(Input, {
    ...props, modelValue: model.value,
    'onUpdate:modelValue': (value: string) => { model.value = value; updates.push(value) },
    onClear: () => clears.push(true)
  })))
  return { container, model, updates, clears, input: () => container.querySelector('input')! }
}

describe('Input / Form / FormItem 的原生编辑通道', () => {
  it('默认 -1 在原生为有效无限长度，中文、数字和超过 140 字的内容可连续输入', async () => {
    const native = nativeEditor()
    const mounted = mountInput()
    await flush()
    expect(mounted.input().getAttribute('maxlength')).toBe('2147483647')
    expect(mounted.updates, '原生初始化 setValue 回声不应触发用户更新事件').toEqual([])
    native.insert(mounted.input(), '张三123🙂')
    await flush()
    native.insert(mounted.input(), '文'.repeat(160), true)
    await flush()
    expect(mounted.model.value).toBe('张三123🙂' + '文'.repeat(160))
    expect(native.text(mounted.input())).toBe(mounted.model.value)
    expect(native.setValues, '已经显示的用户编辑不能再次 setValue 打扰输入法').toEqual([''])
  })

  it('测试替身确实拒绝未经转换的 -1，不靠合成事件绕过原生限制', async () => {
    const native = nativeEditor()
    const mounted = mountInput()
    await flush()
    mounted.input().setAttribute('maxlength', '-1')
    native.insert(mounted.input(), '不会进入模型')
    await flush()
    expect(native.text(mounted.input())).toBe('')
    expect(mounted.model.value).toBe('')
  })

  it('有限长度、不限、零长度来回切换，原生过滤器不会残留旧限制', async () => {
    const native = nativeEditor()
    const max = ref(3)
    const value = ref('')
    const { container } = render(defineComponent(() => () => h(Input, { maxlength: max.value, modelValue: value.value,
      'onUpdate:modelValue': (next: string) => { value.value = next } })))
    const input = container.querySelector('input')!
    await flush()
    native.insert(input, '甲乙丙丁')
    await flush()
    expect(value.value).toBe('甲乙丙')
    max.value = -1
    await flush()
    native.insert(input, '丁戊')
    await flush()
    expect(value.value).toBe('甲乙丙丁戊')
    value.value = ''
    max.value = 0
    await flush()
    native.insert(input, '禁止新增')
    await flush()
    expect(value.value).toBe('')
    max.value = 2
    await flush()
    native.insert(input, '🙂甲')
    await flush()
    expect(value.value).toBe('🙂')
  })

  it('Form/FormItem 的姓名、手机号与垂直备注均可输入，schema 校验与重置仍可用', async () => {
    const native = nativeEditor()
    const model = ref({ name: '', phone: '', memo: '' })
    const form = ref<{ validate(): Promise<{ valid: boolean }>; reset(): void }>()
    const schema = { validate: (value: typeof model.value) => [
      ...(!value.name ? [{ path: ['name'], message: '请输入姓名' }] : []),
      ...(!/^1\d{10}$/.test(value.phone) ? [{ path: ['phone'], message: '手机号格式不正确' }] : [])
    ] }
    const fields = ['name', 'phone', 'memo'] as const
    const { container } = render(defineComponent(() => () => h(Form, { ref: form, model: model.value, schema, errorType: 'message' }, () => fields.map((field) =>
      h(FormItem, { prop: field, title: field, layout: field === 'memo' ? 'vertical' : 'horizontal' }, () => h(Input, {
        modelValue: model.value[field], placeholder: field,
        'onUpdate:modelValue': (value: string) => { model.value[field] = value }
      }))
    ))))
    await flush()
    expect((await form.value.validate()).valid).toBe(false)
    const inputs = container.querySelectorAll('input')
    expect(inputs).toHaveLength(3)
    const expected = ['张三', '13800138000', '备注可以输入文字']
    inputs.forEach((input, index) => native.insert(input, expected[index]))
    await flush()
    expect(model.value).toEqual({ name: expected[0], phone: expected[1], memo: expected[2] })
    expect((await form.value.validate()).valid).toBe(true)
    model.value.name = ''
    await flush()
    await form.value.validate()
    await flush()
    expect(container.querySelector('.wd-form-item__error-message')?.textContent).toBe('请输入姓名')
    form.value.reset()
    await flush()
    expect(container.querySelector('.wd-form-item__error-message')).toBeNull()
  })

  it('禁用与只读仍禁止用户编辑，恢复启用后无需重建输入框', async () => {
    const native = nativeEditor()
    const disabled = ref(true)
    const readonly = ref(false)
    const model = ref('')
    const { container } = render(defineComponent(() => () => h(Input, { disabled: disabled.value, readonly: readonly.value, modelValue: model.value,
      'onUpdate:modelValue': (value: string) => { model.value = value } })))
    const input = container.querySelector('input')!
    await flush()
    native.insert(input, '不应写入')
    expect(model.value).toBe('')
    disabled.value = false
    readonly.value = true
    await flush()
    native.insert(input, '仍不能写入')
    expect(model.value).toBe('')
    readonly.value = false
    await flush()
    native.insert(input, '恢复编辑')
    await flush()
    expect(model.value).toBe('恢复编辑')
    expect(container.querySelector('input')).toBe(input)
  })

  it('清除不会被 Android 同值回声取消，清除后可再次输入', async () => {
    const native = nativeEditor()
    const mounted = mountInput({ clearable: true })
    await flush()
    native.insert(mounted.input(), '第一次输入')
    await flush()
    fireEvent.tap(mounted.container.querySelector('.wd-input__clear')!)
    await flush(100)
    expect(native.text(mounted.input())).toBe('')
    expect(mounted.model.value).toBe('')
    expect(mounted.clears).toEqual([true])
    expect(mounted.updates).toEqual(['第一次输入', ''])
    native.insert(mounted.input(), '第二次输入')
    await flush()
    expect(mounted.model.value).toBe('第二次输入')
  })
})

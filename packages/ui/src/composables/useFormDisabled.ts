import { computed, inject, type ComputedRef, type InjectionKey } from 'vue-lynx'
import { isDef } from '../common/util'

/** WdForm 向下提供的上下文（完整契约） */
export type FormProvide = {
  props: {
    model?: Record<string, any>
    disabled?: boolean | null
    border?: boolean
    center?: boolean
    size?: string
    titleWidth?: string | number
    layout?: string
    valueAlign?: string
    ellipsis?: boolean
    asteriskPosition?: string
    hideAsterisk?: boolean
    validateTrigger?: string | string[]
  }
  errorMessages?: Record<string, string>
  validate?: (prop?: string | string[]) => Promise<{ valid: boolean; errors: { prop: string; message: string }[] }>
}

export const FORM_KEY: InjectionKey<FormProvide> = Symbol('wd-form')

/** WdFormItem 向下提供的禁用态上下文 */
export type FormItemDisabledProvide = {
  disabled: ComputedRef<boolean | undefined>
}

export const FORM_ITEM_DISABLED_KEY: InjectionKey<FormItemDisabledProvide> = Symbol(
  'wd-form-item-disabled'
)

export function useFormDisabled(props: { disabled?: boolean | null }) {
  const form = inject<FormProvide | null>(FORM_KEY, null)
  const formItem = inject<FormItemDisabledProvide | null>(FORM_ITEM_DISABLED_KEY, null)

  return computed(() => {
    // 控件默认 disabled=false 不应阻断 Form 的禁用继承。
    // 与官方一致：控件 true 优先；FormItem 的显式 false 可单独启用字段。
    if (props.disabled) {
      return true
    }
    if (formItem && isDef(formItem.disabled.value)) {
      return formItem.disabled.value
    }
    return Boolean(form?.props.disabled)
  })
}

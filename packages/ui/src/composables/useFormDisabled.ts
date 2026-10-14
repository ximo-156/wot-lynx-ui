import { computed, inject, type ComputedRef, type InjectionKey } from 'vue-lynx'
import { isDef } from '../common/util'

/** WdForm 向下提供的上下文（useFormDisabled 只消费 disabled） */
export type FormProvide = {
  props: {
    disabled?: boolean | null
  }
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
    if (props.disabled) {
      return true
    }
    if (formItem && isDef(formItem.disabled.value)) {
      return formItem.disabled.value
    }
    return Boolean(form?.props.disabled)
  })
}

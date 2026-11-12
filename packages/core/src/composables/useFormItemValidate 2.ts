import type { InjectionKey } from 'vue-lynx'

/** 校验触发时机 */
export type FormValidateTrigger = 'onBlur' | 'onInput' | 'onSubmit'

/** 校验事件 */
export type FormValidateEvent = 'change' | 'blur' | 'submit'

/** WdFormItem 向下提供的校验上下文 */
export type FormItemValidateProvide = {
  /** 表单域 model 字段名 */
  prop?: string
  /** 事件是否应触发校验 */
  shouldTrigger: (event: FormValidateEvent) => boolean
  /** 由事件触发校验 */
  validateByTrigger: (event: FormValidateEvent) => Promise<void>
}

export const FORM_ITEM_VALIDATE_KEY: InjectionKey<FormItemValidateProvide> = Symbol('wd-form-item-validate')

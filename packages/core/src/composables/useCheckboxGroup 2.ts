import { type InjectionKey } from 'vue-lynx'
import { useParent } from './useParent'
import type { RadioType } from './useRadioGroup'

/** 复选框类型（与 radio 一致） */
export type CheckboxType = RadioType

/** 文本位置 */
export type CheckboxPlacement = 'left' | 'right'

/** 布局方向 */
export type CheckboxDirection = 'horizontal' | 'vertical'

/** WdCheckboxGroup 向下提供的上下文 */
export type CheckboxGroupProvide = {
  props: {
    modelValue?: (string | number | boolean)[]
    type?: CheckboxType
    checkedColor?: string
    uncheckedColor?: string
    disabled?: boolean
    readonly?: boolean
    direction?: 'horizontal' | 'vertical'
    placement?: 'left' | 'right'
    min?: number
    max?: number
  }
  changeSelectState: (value: string | number | boolean) => void
}

export const CHECKBOX_GROUP_KEY: InjectionKey<CheckboxGroupProvide> = Symbol('wd-checkbox-group')

export function useCheckboxGroup() {
  const { parent: checkboxGroup, index } = useParent(CHECKBOX_GROUP_KEY)
  return { checkboxGroup, index }
}

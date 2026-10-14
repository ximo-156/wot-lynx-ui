import { type InjectionKey } from 'vue-lynx'
import { useParent } from './useParent'

/** 单选框类型 */
export type RadioType = 'dot' | 'circle' | 'square' | 'button'

/** 图标位置 */
export type RadioPlacement = 'left' | 'right'

/** 布局方向 */
export type RadioDirection = 'horizontal' | 'vertical'

/** WdRadioGroup 向下提供的上下文 */
export type RadioGroupProvide = {
  props: {
    modelValue?: string | number | boolean
    type?: RadioType
    checkedColor?: string
    uncheckedColor?: string
    disabled?: boolean
    readonly?: boolean
    placement?: RadioPlacement
    direction?: RadioDirection
    allowUncheck?: boolean
  }
  updateValue: (value: string | number | boolean | null) => void
}

export const RADIO_GROUP_KEY: InjectionKey<RadioGroupProvide> = Symbol('wd-radio-group')

export function useRadioGroup() {
  const { parent: radioGroup, index } = useParent(RADIO_GROUP_KEY)
  return { radioGroup, index }
}

/** 读取 group 配置，组件自身 props 优先 */
export function useGroupProp<T>(radioGroup: { value: RadioGroupProvide | null }, key: keyof RadioGroupProvide['props'], own: T | undefined): T | undefined {
  return own !== undefined ? own : (radioGroup.value?.props[key] as T | undefined)
}

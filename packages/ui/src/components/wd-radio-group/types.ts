import type { ExtractPropTypes, InjectionKey } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp } from '../../common/props'
import type { RadioDirection, RadioPlacement, RadioType } from '../../composables/useRadioGroup'
import { RADIO_GROUP_KEY, type RadioGroupProvide } from '../../composables/useRadioGroup'

// 兼容历史从 wd-radio-group/types 深度导入的用法
export { RADIO_GROUP_KEY }
export type { RadioDirection, RadioPlacement, RadioType, RadioGroupProvide }

export const radioGroupProps = {
  ...baseProps,
  /**
   * 会自动选中value对应的单选框
   */
  modelValue: [String, Number, Boolean],
  /**
   * 单选框类型
   * 可选值: dot | circle | square | button
   * 默认值: circle
   */
  type: makeStringProp<RadioType>('circle'),
  /**
   * 选中的颜色
   */
  checkedColor: String,
  /**
   * 未选中状态的颜色
   */
  uncheckedColor: String,
  /**
   * 是否禁用
   * 默认值: false
   */
  disabled: makeBooleanProp(false),
  /**
   * 是否只读
   * 默认值: false
   */
  readonly: makeBooleanProp(false),
  /**
   * 图标位置
   * 可选值: 'left' | 'right'
   * 默认值: left
   */
  placement: makeStringProp<RadioPlacement>('left'),
  /**
   * 布局方向
   * 可选值: 'horizontal' | 'vertical'
   * 默认值: vertical
   */
  direction: makeStringProp<RadioDirection>('vertical'),
  /**
   * 是否允许取消选中
   * 默认值: false
   */
  allowUncheck: makeBooleanProp(false)
}

export type RadioGroupProps = ExtractPropTypes<typeof radioGroupProps>

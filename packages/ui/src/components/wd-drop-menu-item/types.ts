import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp } from '../../common/props'

export const dropMenuItemProps = {
  ...baseProps,
  /**
   * 标题
   */
  title: String,
  /**
   * 选中值
   */
  modelValue: {
    type: [String, Number],
    default: ''
  },
  /**
   * 选项
   */
  options: {
    type: Array as PropType<Record<string, any>[]>,
    default: () => []
  },
  /**
   * 选中值对应的 key
   */
  valueKey: makeStringProp('value'),
  /**
   * 展示文本对应的 key
   */
  labelKey: makeStringProp('label'),
  /**
   * 是否禁用
   */
  disabled: makeBooleanProp(false)
}

export type DropMenuItemProps = ExtractPropTypes<typeof dropMenuItemProps>

import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeNumericProp, makeStringProp } from '../../common/props'

export const passwordInputProps = {
  ...baseProps,
  /**
   * 密码值
   */
  modelValue: makeStringProp(''),
  /**
   * 是否显示掩码圆点
   */
  mask: makeBooleanProp(true),
  /**
   * 提示信息
   */
  info: makeStringProp(''),
  /**
   * 错误信息
   */
  errorInfo: makeStringProp(''),
  /**
   * 格子间距
   */
  gutter: makeNumericProp(0),
  /**
   * 格子数量
   */
  length: makeNumberProp(6),
  /**
   * 是否聚焦
   */
  focused: makeBooleanProp(true)
}

export type PasswordInputProps = ExtractPropTypes<typeof passwordInputProps>

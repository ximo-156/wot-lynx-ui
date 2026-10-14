import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type SearchVariant = 'plain' | 'filled'

export const searchProps = {
  ...baseProps,
  /**
   * 原生输入框自定义类名
   */
  customInputClass: makeStringProp(''),
  /**
   * 输入框的值
   */
  modelValue: makeStringProp(''),
  /**
   * 占位提示文字
   */
  placeholder: String,
  /**
   * 取消按钮文字
   */
  cancelTxt: String,
  /**
   * 搜索框样式
   */
  variant: makeStringProp<SearchVariant>('plain'),
  /**
   * 是否隐藏取消按钮
   */
  hideCancel: makeBooleanProp(false),
  /**
   * 是否禁用
   */
  disabled: makeBooleanProp(false),
  /**
   * 最大输入长度，-1 为不限制
   */
  maxlength: makeNumberProp(-1),
  /**
   * 占位提示是否左对齐
   */
  placeholderLeft: makeBooleanProp(false),
  /**
   * 是否自动聚焦
   */
  focus: makeBooleanProp(false),
  /**
   * 清空输入框后是否重新聚焦
   */
  focusWhenClear: makeBooleanProp(false),
  /**
   * 占位提示文字样式
   */
  placeholderStyle: String,
  /**
   * 占位提示文字类名
   */
  placeholderClass: makeStringProp('')
}

export type SearchProps = ExtractPropTypes<typeof searchProps>

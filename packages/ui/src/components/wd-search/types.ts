import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type SearchVariant = 'filled' | 'plain' | 'light'

export const searchProps = {
  ...baseProps,

  /**
   * 自定义输入框类名
   * 类型: string
   * 默认值: ''
   */
  customInputClass: makeStringProp(''),

  /**
   * 输入框内容，双向绑定
   * 类型: string
   * 默认值: ''
   */
  modelValue: makeStringProp(''),

  /**
   * 搜索框占位文本
   * 类型: string
   */
  placeholder: String,

  /**
   * 搜索框右侧文本
   * 类型: string
   */
  cancelTxt: String,

  /**
   * 搜索框变体
   * 类型: string
   * 可选值: 'filled' | 'plain' | 'light'
   * 默认值: 'plain'
   */
  variant: makeStringProp<SearchVariant>('plain'),

  /**
   * 是否隐藏右侧文本
   * 类型: boolean
   * 默认值: false
   */
  hideCancel: makeBooleanProp(false),

  /**
   * 是否禁用搜索框
   * 类型: boolean
   * 默认值: false
   */
  disabled: makeBooleanProp(false),

  /**
   * 原生属性，设置最大长度。-1 表示无限制
   * 类型: string | number
   * 默认值: -1
   */
  maxlength: makeNumberProp(-1),

  /**
   * placeholder 居左边
   * 类型: boolean
   * 默认值: false
   */
  placeholderLeft: makeBooleanProp(false),

  /**
   * 是否自动聚焦
   * 类型: boolean
   * 默认值: false
   * 最低版本: 0.1.63
   */
  focus: makeBooleanProp(false),

  /**
   * 是否在点击清除按钮时聚焦输入框
   * 类型: boolean
   * 默认值: false
   * 最低版本: 0.1.63
   */
  focusWhenClear: makeBooleanProp(false),

  /**
   * 原生属性，指定 placeholder 的样式，目前仅支持color,font-size和font-weight
   * 类型: string
   */
  placeholderStyle: String,

  /**
   * 原生属性，指定 placeholder 的样式类
   * 类型: string
   * 默认值: ''
   */
  placeholderClass: makeStringProp('')
}

export type SearchProps = ExtractPropTypes<typeof searchProps>

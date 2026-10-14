import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeNumericProp, makeStringProp } from '../../common/props'

export type InputType = 'text' | 'number' | 'digit' | 'idcard' | 'tel' | 'password'

export type InputConfirmType = 'send' | 'search' | 'next' | 'go' | 'done'

export type InputClearTrigger = 'always' | 'focus'

export type InputMode = 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'

export const inputProps = {
  ...baseProps,
  /**
   * 输入框的值
   */
  modelValue: makeNumericProp(''),
  /**
   * 原生输入框自定义类名
   */
  customInputClass: makeStringProp(''),
  /**
   * 占位提示文字
   */
  placeholder: String,
  /**
   * 占位提示文字样式
   */
  placeholderStyle: String,
  /**
   * 占位提示文字类名
   */
  placeholderClass: makeStringProp(''),
  /**
   * 光标与键盘的距离，单位 px
   */
  cursorSpacing: makeNumberProp(0),
  /**
   * 光标位置
   */
  cursor: makeNumberProp(-1),
  /**
   * 选区起始位置
   */
  selectionStart: makeNumberProp(-1),
  /**
   * 选区结束位置
   */
  selectionEnd: makeNumberProp(-1),
  /**
   * 键盘弹起时是否自动上推页面
   */
  adjustPosition: makeBooleanProp(true),
  /**
   * 点击键盘完成时是否保持键盘不收起
   */
  holdKeyboard: makeBooleanProp(false),
  /**
   * 键盘右下角按钮类型
   */
  confirmType: makeStringProp<InputConfirmType>('done'),
  /**
   * 按住键盘右下角按钮时是否保持键盘不收起
   */
  confirmHold: makeBooleanProp(false),
  /**
   * 是否自动聚焦
   */
  focus: makeBooleanProp(false),
  /**
   * 输入框类型
   */
  type: makeStringProp<InputType>('text'),
  /**
   * 最大输入长度，-1 为不限制
   */
  maxlength: {
    type: [Number, String] as PropType<number | string>,
    default: -1
  },
  /**
   * 是否禁用
   */
  disabled: makeBooleanProp(false),
  /**
   * 是否总是嵌入
   */
  alwaysEmbed: makeBooleanProp(false),
  /**
   * 内容右对齐
   */
  alignRight: makeBooleanProp(false),
  /**
   * 是否显示密码可见切换
   */
  showPassword: makeBooleanProp(false),
  /**
   * 是否显示清空按钮
   */
  clearable: makeBooleanProp(false),
  /**
   * 是否只读
   */
  readonly: makeBooleanProp(false),
  /**
   * 前置图标名称
   */
  prefixIcon: String,
  /**
   * 后置图标名称
   */
  suffixIcon: String,
  /**
   * 图标类名前缀
   */
  iconPrefix: String,
  /**
   * CSS 图标类名
   */
  cssIcon: {
    type: [Boolean, String],
    default: false
  },
  /**
   * 是否显示字数统计
   */
  showWordLimit: makeBooleanProp(false),
  /**
   * 是否标错
   */
  error: makeBooleanProp(false),
  /**
   * 清空按钮触发方式
   */
  clearTrigger: makeStringProp<InputClearTrigger>('always'),
  /**
   * 清空输入框后是否重新聚焦
   */
  focusWhenClear: makeBooleanProp(true),
  /**
   * 是否忽略中文输入法组合事件
   */
  ignoreCompositionEvent: makeBooleanProp(true),
  /**
   * 输入模式（H5 有用，Lynx 透传）
   */
  inputmode: makeStringProp<InputMode>('text'),
  /**
   * 是否启用原生输入行为
   */
  enableNative: makeBooleanProp(true),
  /**
   * 紧凑模式（默认取 form-item 是否存在）
   */
  compact: makeBooleanProp(void 0)
}

export type InputProps = ExtractPropTypes<typeof inputProps>

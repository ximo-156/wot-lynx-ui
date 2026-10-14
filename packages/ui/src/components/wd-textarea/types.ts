import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeNumericProp, makeStringProp } from '../../common/props'
import type { InputClearTrigger, InputMode } from '../wd-input/types'

export type TextareaConfirmType = 'send' | 'search' | 'next' | 'go' | 'done'

export const textareaProps = {
  ...baseProps,
  /**
   * 原生文本域容器自定义类名
   */
  customTextareaContainerClass: makeStringProp(''),
  /**
   * 原生文本域自定义类名
   */
  customTextareaClass: makeStringProp(''),
  /**
   * 输入框的值
   */
  modelValue: makeNumericProp(''),
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
   * 是否禁用
   */
  disabled: makeBooleanProp(false),
  /**
   * 最大输入长度，-1 为不限制
   */
  maxlength: makeNumberProp(-1),
  /**
   * 是否自动聚焦
   */
  autoFocus: makeBooleanProp(false),
  /**
   * 是否受控聚焦
   */
  focus: makeBooleanProp(false),
  /**
   * 是否自动增高
   */
  autoHeight: makeBooleanProp(false),
  /**
   * 固定在页面
   */
  fixed: makeBooleanProp(false),
  /**
   * 光标与键盘的距离，单位 px
   */
  cursorSpacing: makeNumberProp(0),
  /**
   * 光标位置
   */
  cursor: makeNumberProp(-1),
  /**
   * 键盘右下角按钮类型
   */
  confirmType: String as PropType<TextareaConfirmType>,
  /**
   * 按住键盘右下角按钮时是否保持键盘不收起
   */
  confirmHold: makeBooleanProp(false),
  /**
   * 是否显示键盘上方完成栏
   */
  showConfirmBar: makeBooleanProp(true),
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
   * 是否去掉 iOS 默认内边距
   */
  disableDefaultPadding: makeBooleanProp(false),
  /**
   * 点击键盘完成时是否保持键盘不收起
   */
  holdKeyboard: makeBooleanProp(false),
  /**
   * 是否显示为密码框
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
   * 输入模式
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

export type TextareaProps = ExtractPropTypes<typeof textareaProps>

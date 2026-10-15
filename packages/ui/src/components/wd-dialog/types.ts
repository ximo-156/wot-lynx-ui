import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp, numericProp } from '../../common/props'
import type { InputProps } from '../wd-input/types'
import type { TextareaProps } from '../wd-textarea/types'

export type DialogType = 'alert' | 'confirm' | 'prompt'

export type DialogTheme = 'default' | 'button'

export type DialogActionLayout = 'horizontal' | 'vertical'

export type DialogResult = {
  action: 'confirm' | 'cancel' | 'modal'
  value?: string
}

export type DialogOptions = {
  title?: string
  msg?: string
  type?: DialogType
  show?: boolean
  closeOnClickModal?: boolean
  zIndex?: number
  lazyRender?: boolean
  headerImage?: string
  icon?: string
  iconColor?: string
  inputProps?: Partial<InputProps>
  textareaProps?: Partial<TextareaProps>
  inputPattern?: RegExp
  inputValidate?: (value: string) => boolean | Promise<boolean>
  inputError?: string
  showErr?: boolean
  theme?: DialogTheme
  actionLayout?: DialogActionLayout
  confirmButtonProps?: Record<string, any>
  cancelButtonProps?: Record<string, any>
  showCancelButton?: boolean
  showConfirmButton?: boolean
  inputValue?: string
  /** 确认回调 */
  confirm?: (result: DialogResult) => void
  /** 取消回调 */
  cancel?: (result: DialogResult) => void
  /** 关闭回调 */
  close?: () => void
}

export type DialogOptionsWithCallBack = DialogOptions & {
  confirm?: (result: DialogResult) => void
  cancel?: (result: DialogResult) => void
}

export interface Dialog {
  show(options: DialogOptions | string): void
  alert(options: DialogOptions | string): void
  confirm(options: DialogOptions | string): void
  prompt(options: DialogOptions | string): void
  close(): void
}

export const dialogProps = {
  ...baseProps,
  /**
   * 是否显示
   */
  modelValue: makeBooleanProp(false),
  /**
   * 选择器（区分多实例）
   */
  selector: makeStringProp(''),
  /**
   * 是否挂载到根节点
   */
  rootPortal: makeBooleanProp(false),
  /**
   * 标题
   */
  title: makeStringProp(''),
  /**
   * 消息内容
   */
  msg: makeStringProp(''),
  /**
   * 类型
   */
  type: makeStringProp<DialogType>('alert'),
  /**
   * 主题
   */
  theme: makeStringProp<DialogTheme>('button'),
  /**
   * 层级
   */
  zIndex: makeNumberProp(99),
  /**
   * 内容懒渲染
   */
  lazyRender: makeBooleanProp(true),
  /**
   * 头部图片
   */
  headerImage: String,
  /**
   * 图标
   */
  icon: String,
  /**
   * 图标颜色
   */
  iconColor: String,
  /**
   * 输入框配置（prompt）
   */
  inputProps: Object as PropType<Partial<InputProps>>,
  /**
   * 文本域配置（prompt）
   */
  textareaProps: Object as PropType<Partial<TextareaProps>>,
  /**
   * 输入校验正则
   */
  inputPattern: RegExp,
  /**
   * 输入校验函数
   */
  inputValidate: Function as PropType<DialogOptions['inputValidate']>,
  /**
   * 输入错误提示
   */
  inputError: String,
  /**
   * 是否显示错误
   */
  showErr: makeBooleanProp(false),
  /**
   * 按钮布局
   */
  actionLayout: makeStringProp<DialogActionLayout>('horizontal'),
  /**
   * 确认按钮配置
   */
  confirmButtonProps: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({})
  },
  /**
   * 取消按钮配置
   */
  cancelButtonProps: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({})
  },
  /**
   * 是否显示取消按钮
   */
  showCancelButton: {
    type: Boolean,
    default: undefined
  },
  /**
   * 是否显示确认按钮
   */
  showConfirmButton: {
    type: Boolean,
    default: undefined
  },
  /**
   * 输入框初始值
   */
  inputValue: {
    type: [String, Number] as PropType<string | number>,
    default: ''
  },
  /**
   * 关闭按钮位置
   */
  closePosition: String,
  /**
   * 关闭按钮文字
   */
  closeText: String,
  /**
   * 点击遮罩是否关闭
   */
  closeOnClickModal: {
    type: Boolean,
    default: false
  },
  /**
   * 是否显示关闭按钮
   */
  showClose: {
    type: Boolean,
    default: false
  }
}

export type DialogProps = ExtractPropTypes<typeof dialogProps>

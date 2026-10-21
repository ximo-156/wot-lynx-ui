import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeNumericProp, makeStringProp } from '../../common/props'
import type { ButtonType } from '../../composables/global-config'

export const submitBarProps = {
  ...baseProps,
  /**
   * 按钮文字
   * 类型: string
   * 默认值: '提交'
   */
  buttonText: makeStringProp('提交'),
  /**
   * 按钮类型
   * 类型: ButtonType
   * 默认值: 'primary'
   */
  buttonType: {
    type: String as PropType<ButtonType>,
    default: 'primary'
  },
  /**
   * 价格标签（左侧显示）
   * 类型: string
   * 默认值: ''
   */
  label: makeStringProp(''),
  /**
   * 价格数值
   * 类型: string | number
   * 默认值: ''
   */
  price: makeNumericProp(''),
  /**
   * 价格前缀（如 ¥）
   * 类型: string
   * 默认值: '¥'
   */
  pricePrefix: makeStringProp('¥'),
  /**
   * 价格后缀
   * 类型: string
   * 默认值: ''
   */
  priceSuffix: makeStringProp(''),
  /**
   * 是否显示按钮
   * 类型: boolean
   * 默认值: true
   */
  showButton: makeBooleanProp(true),
  /**
   * 按钮是否禁用
   * 类型: boolean
   * 默认值: false
   */
  buttonDisabled: makeBooleanProp(false),
  /**
   * 按钮是否加载中
   * 类型: boolean
   * 默认值: false
   */
  buttonLoading: makeBooleanProp(false),
  /**
   * 是否开启底部安全区适配
   * 类型: boolean
   * 默认值: true
   */
  safeAreaInsetBottom: makeBooleanProp(true),
  /**
   * 货币符号大小
   * 类型: number
   * 默认值: 14
   */
  priceSize: makeNumberProp(14),
  /**
   * 价格整数部分大小
   * 类型: number
   * 默认值: 20
   */
  priceIntegerSize: makeNumberProp(20),
  /**
   * 价格小数部分大小
   * 类型: number
   * 默认值: 14
   */
  priceDecimalSize: makeNumberProp(14)
}

export type SubmitBarProps = ExtractPropTypes<typeof submitBarProps>

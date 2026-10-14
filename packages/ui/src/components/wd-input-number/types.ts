import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeNumericProp, makeRequiredProp, makeStringProp, numericProp } from '../../common/props'

export type OperationType = 'sub' | 'add'

export type InputNumberTheme = 'default' | 'card'

export type InputNumberBeforeChange = (value: number | string) => boolean | Promise<boolean>

export const inputNumberProps = {
  ...baseProps,
  /**
   * 当前值
   */
  modelValue: makeRequiredProp(numericProp),
  /**
   * 最小值
   */
  min: makeNumberProp(1),
  /**
   * 最大值
   */
  max: makeNumberProp(Number.MAX_SAFE_INTEGER),
  /**
   * 步进
   */
  step: makeNumberProp(1),
  /**
   * 是否只能输入步进的整数
   */
  stepStrictly: makeBooleanProp(false),
  /**
   * 小数位数
   */
  precision: makeNumericProp(0),
  /**
   * 是否禁用
   */
  disabled: makeBooleanProp(false),
  /**
   * 是否禁用输入框
   */
  disableInput: makeBooleanProp(false),
  /**
   * 是否禁用减号
   */
  disableMinus: makeBooleanProp(false),
  /**
   * 是否禁用加号
   */
  disablePlus: makeBooleanProp(false),
  /**
   * 是否不显示输入框
   */
  withoutInput: makeBooleanProp(false),
  /**
   * 输入框宽度
   */
  inputWidth: numericProp,
  /**
   * 是否允许空值
   */
  allowNull: makeBooleanProp(false),
  /**
   * 占位提示
   */
  placeholder: makeStringProp(''),
  /**
   * 键盘弹起时是否自动上推页面
   */
  adjustPosition: makeBooleanProp(true),
  /**
   * 改变前执行的函数
   */
  beforeChange: Function as PropType<InputNumberBeforeChange>,
  /**
   * 是否支持长按连续步进
   */
  longPress: makeBooleanProp(false),
  /**
   * 是否立即触发 change（输入过程中）
   */
  immediateChange: makeBooleanProp(true),
  /**
   * 初始化时是否自动修正值
   */
  updateOnInit: makeBooleanProp(true),
  /**
   * 输入框类型
   */
  inputType: makeStringProp<'number' | 'digit'>('digit'),
  /**
   * 主题
   */
  theme: makeStringProp<InputNumberTheme>('default'),
  /**
   * 是否圆角
   */
  round: Boolean
}

export type InputNumberProps = ExtractPropTypes<typeof inputNumberProps>

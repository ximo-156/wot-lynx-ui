import type { ExtractPropTypes } from 'vue-lynx'
import { makeBooleanProp, makeNumericProp, makeStringProp } from '../../../common/props'

export type NumberKeyType = '' | 'delete' | 'extra' | 'close'

export const keyProps = {
  /**
   * 键盘按键类型
   * 可选值：'' | 'delete' | 'extra' | 'close'
   */
  type: makeStringProp<NumberKeyType>(''),
  /**
   * 按键文本
   */
  text: makeNumericProp(''),
  /**
   * 是否占据更宽的空间
   */
  wider: makeBooleanProp(false),
  /**
   * 是否是大按键
   */
  large: makeBooleanProp(false),
  /**
   * 是否正在加载中
   */
  loading: makeBooleanProp(false),
  /**
   * 是否为车牌键盘模式
   */
  isCar: makeBooleanProp(false)
}

export type KeyProps = ExtractPropTypes<typeof keyProps>

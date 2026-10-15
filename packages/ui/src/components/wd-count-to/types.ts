import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type CountToType = 'default' | 'primary' | 'success' | 'warning' | 'error'

export const countToProps = {
  ...baseProps,
  /**
   * 文字颜色
   */
  color: makeStringProp(''),
  /**
   * 主题类型
   */
  type: makeStringProp<CountToType>('default'),
  /**
   * 开始值
   */
  startVal: makeNumberProp(0),
  /**
   * 结束值
   */
  endVal: makeNumberProp(2024),
  /**
   * 动画时长（ms）
   */
  duration: makeNumberProp(3000),
  /**
   * 是否自动开始
   */
  autoStart: makeBooleanProp(true),
  /**
   * 小数位数
   */
  decimals: {
    type: [Number, String] as PropType<number | string>,
    default: 0
  },
  /**
   * 小数点符号
   */
  decimal: makeStringProp('.'),
  /**
   * 千分位符号
   */
  separator: makeStringProp(','),
  /**
   * 前缀
   */
  prefix: makeStringProp(''),
  /**
   * 后缀
   */
  suffix: makeStringProp(''),
  /**
   * 是否使用缓动
   */
  useEasing: makeBooleanProp(true)
}

export type CountToProps = ExtractPropTypes<typeof countToProps>

import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp, numericProp } from '../../common/props'

export const rateProps = {
  ...baseProps,
  /**
   * 评分星星个数
   * 类型: number
   * 默认值: 5
   */
  num: makeNumberProp(5),
  /**
   * 当前评分
   * 类型: number
   * 默认值: 0
   */
  modelValue: {
    type: Number,
    default: 0
  },
  /**
   * 是否只读
   * 类型: boolean
   * 默认值: false
   */
  readonly: makeBooleanProp(false),
  /**
   * 星星大小
   * 类型: string
   */
  size: String,
  /**
   * 星星间距
   * 类型: string | number
   */
  space: numericProp,
  /**
   * 未选中颜色
   * 类型: string
   * 默认值: #E7E8ED
   */
  color: makeStringProp('#E4E7ED'),
  /**
   * 选中颜色（数组时为 [低分色, 高分色]）
   */
  activeColor: {
    type: [String, Array] as PropType<string | string[]>,
    default: ''
  },
  /**
   * 未选中图标
   * 类型: string
   * 默认值: star-fill
   */
  icon: makeStringProp('star-fill'),
  /**
   * 选中图标
   * 类型: string
   * 默认值: star-fill
   */
  activeIcon: makeStringProp('star-fill'),
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
   * 是否禁用
   * 类型: boolean
   * 默认值: false
   */
  disabled: makeBooleanProp(false),
  /**
   * 是否允许半星
   * 类型: boolean
   * 默认值: false
   */
  allowHalf: makeBooleanProp(false),
  /**
   * 是否允许点击清空
   * 类型: boolean
   * 默认值: false
   */
  clearable: makeBooleanProp(false),
  /**
   * 是否撑满
   * 类型: boolean
   * 默认值: false
   */
  block: makeBooleanProp(false)
}

export type RateProps = ExtractPropTypes<typeof rateProps>

import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp } from '../../common/props'

export type TagType = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'volcano' | 'lightblue' | 'cyan' | 'pink' | 'purple'

export type TagVariant = 'light' | 'dark' | 'plain' | 'dashed' | 'text'

export type TagSize = 'small' | 'medium' | 'large' | 'extra-large' | 'default'

export const tagProps = {
  ...baseProps,
  /**
   * 尺寸
   */
  size: String as PropType<TagSize>,
  /**
   * 类型
   */
  type: makeStringProp<TagType>('default'),
  /**
   * 图标名称
   */
  icon: makeStringProp(''),
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
   * 是否可关闭
   */
  closable: makeBooleanProp(false),
  /**
   * 是否为动态标签（可新增）
   */
  dynamic: makeBooleanProp(false),
  /**
   * 文字颜色
   */
  color: makeStringProp(''),
  /**
   * 背景颜色
   */
  bgColor: makeStringProp(''),
  /**
   * 是否圆角
   */
  round: makeBooleanProp(false),
  /**
   * 变体
   */
  variant: makeStringProp<TagVariant>('light'),
  /**
   * 是否禁用
   */
  disabled: makeBooleanProp(false)
}

export type TagProps = ExtractPropTypes<typeof tagProps>

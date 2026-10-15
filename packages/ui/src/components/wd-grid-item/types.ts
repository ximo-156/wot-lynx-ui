import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp, numericProp } from '../../common/props'

export type LinkType = 'navigateTo' | 'redirectTo' | 'reLaunch' | 'switchTab'

export const gridItemProps = {
  ...baseProps,
  /**
   * 文字
   */
  text: String,
  /**
   * 跳转地址
   */
  url: String,
  /**
   * 跳转类型
   */
  linkType: makeStringProp<LinkType>('navigateTo'),
  /**
   * 图标名称
   */
  icon: makeStringProp(''),
  /**
   * 图标颜色
   */
  iconColor: String,
  /**
   * 图标大小
   */
  iconSize: numericProp,
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
   * 徽标值
   */
  value: numericProp,
  /**
   * 徽标是否为圆点
   */
  isDot: Boolean,
  /**
   * 徽标最大值
   */
  max: Number,
  /**
   * 文字自定义类名
   */
  customText: makeStringProp(''),
  /**
   * 图标自定义类名
   */
  customIcon: makeStringProp(''),
  /**
   * 文字是否省略
   */
  ellipsis: makeBooleanProp(true)
}

export type GridItemProps = ExtractPropTypes<typeof gridItemProps>

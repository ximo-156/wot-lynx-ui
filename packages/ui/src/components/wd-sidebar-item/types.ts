import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeRequiredProp, makeStringProp } from '../../common/props'
import type { BadgeProps } from '../wd-badge/types'

export const sidebarItemProps = {
  ...baseProps,
  /**
   * 标签
   */
  label: makeRequiredProp(String),
  /**
   * 值
   */
  value: makeRequiredProp([Number, String]),
  /**
   * 徽标值
   */
  badge: [String, Number] as PropType<string | number>,
  /**
   * 徽标配置
   */
  badgeProps: Object as PropType<Partial<BadgeProps>>,
  /**
   * 图标名称
   */
  icon: String,
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
   * 徽标是否为圆点
   */
  isDot: makeBooleanProp(false),
  /**
   * 是否禁用
   */
  disabled: makeBooleanProp(false)
}

export type SidebarItemProps = ExtractPropTypes<typeof sidebarItemProps>

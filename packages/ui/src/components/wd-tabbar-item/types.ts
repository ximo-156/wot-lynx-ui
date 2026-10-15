import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumericProp, makeStringProp, numericProp } from '../../common/props'

export const tabbarItemProps = {
  ...baseProps,
  /**
   * 唯一标识（默认取索引）
   */
  name: numericProp,
  /**
   * 标题
   */
  title: String,
  /**
   * 图标
   */
  icon: String,
  /**
   * 激活图标
   */
  activeIcon: String,
  /**
   * 徽标值
   */
  value: numericProp,
  /**
   * 徽标是否为圆点
   */
  isDot: makeBooleanProp(false),
  /**
   * 徽标最大值
   */
  max: numericProp
}

export type TabbarItemProps = ExtractPropTypes<typeof tabbarItemProps>

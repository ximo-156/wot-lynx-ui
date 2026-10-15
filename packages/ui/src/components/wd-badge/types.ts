import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp, numericProp } from '../../common/props'

export type BadgeType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

export type BadgeShape = 'circle' | 'square' | 'round' | 'ribbon' | 'ribbon-left' | 'ribbon-right'

export const badgeProps = {
  ...baseProps,
  /**
   * 形状
   */
  shape: makeStringProp<BadgeShape>('circle'),
  /**
   * 显示值
   */
  value: numericProp,
  /**
   * 为 0 时是否显示
   */
  showZero: makeBooleanProp(false),
  /**
   * 背景色
   */
  bgColor: String,
  /**
   * 最大值（超出显示 max+）
   */
  max: Number,
  /**
   * 是否显示为圆点
   */
  isDot: Boolean,
  /**
   * 是否隐藏
   */
  hidden: Boolean,
  /**
   * 类型
   */
  type: String as PropType<BadgeType>,
  /**
   * 顶部偏移
   */
  top: numericProp,
  /**
   * 右侧偏移
   */
  right: numericProp,
  /**
   * 是否显示边框
   */
  border: makeBooleanProp(false)
}

export type BadgeProps = ExtractPropTypes<typeof badgeProps>

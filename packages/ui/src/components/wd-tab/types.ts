import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumericProp, makeStringProp, numericProp } from '../../common/props'
import type { BadgeProps } from '../wd-badge/types'

export const tabProps = {
  ...baseProps,
  /**
   * 选项卡名称（与 modelValue 对应）
   */
  name: numericProp,
  /**
   * 标题
   */
  title: String,
  /**
   * 是否禁用
   */
  disabled: makeBooleanProp(false),
  /**
   * 是否懒渲染
   */
  lazy: makeBooleanProp(true),
  /**
   * 徽标配置
   */
  badgeProps: Object as PropType<Partial<BadgeProps>>
}

export type TabProps = ExtractPropTypes<typeof tabProps>

import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp, numericProp } from '../../common/props'

export const collapseItemProps = {
  ...baseProps,
  /**
   * 唯一标识
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
   * 是否使用标题插槽
   */
  useTitleSlot: makeBooleanProp(true)
}

export type CollapseItemProps = ExtractPropTypes<typeof collapseItemProps>

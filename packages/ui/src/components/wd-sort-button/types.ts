import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type SortButtonValue = -1 | 0 | 1

export type SortButtonChangeDetail = {
  value: SortButtonValue
}

export const sortButtonProps = {
  ...baseProps,
  /**
   * 当前排序状态（-1 升序 / 0 无 / 1 降序）
   */
  modelValue: makeNumberProp<SortButtonValue>(0),
  /**
   * 标题
   */
  title: makeStringProp(''),
  /**
   * 是否允许重置
   */
  allowReset: makeBooleanProp(false),
  /**
   * 是否降序优先
   */
  descFirst: makeBooleanProp(false),
  /**
   * 是否显示下划线
   */
  line: makeBooleanProp(false)
}

export type SortButtonProps = ExtractPropTypes<typeof sortButtonProps>

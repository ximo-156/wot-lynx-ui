import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeStringProp } from '../../common/props'

export const tableColumnProps = {
  ...baseProps,
  /**
   * 列字段名
   */
  prop: makeStringProp(''),
  /**
   * 列表头
   */
  label: makeStringProp(''),
  /**
   * 列宽
   */
  width: makeStringProp('')
}

export type TableColumnProps = ExtractPropTypes<typeof tableColumnProps>

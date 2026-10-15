import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeNumberProp, makeStringProp } from '../../common/props'

export type RowJustify = 'start' | 'end' | 'center' | 'space-around' | 'space-between'

export type RowAlign = 'top' | 'center' | 'bottom'

export const rowProps = {
  ...baseProps,
  /**
   * 列间距（px）
   */
  gutter: makeNumberProp(0),
  /**
   * 水平排列
   */
  justify: makeStringProp<RowJustify>('start'),
  /**
   * 垂直对齐
   */
  align: makeStringProp<RowAlign>('top')
}

export type RowProps = ExtractPropTypes<typeof rowProps>

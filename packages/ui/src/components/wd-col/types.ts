import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeNumberProp } from '../../common/props'

export const colProps = {
  ...baseProps,
  /**
   * 栅格占据数（24 制）
   */
  span: makeNumberProp(24),
  /**
   * 栅格左侧偏移
   */
  offset: makeNumberProp(0)
}

export type ColProps = ExtractPropTypes<typeof colProps>
